"""多种价格提取策略：JSON-LD / 站点适配 / CSS 启发式 / AI 兜底。

借鉴 PriceGhost 的「四路提取 + 置信度」思路：
任何单一选择器都可能因改版失效，多路结果互相印证才能稳定。
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Callable

from bs4 import BeautifulSoup

from .models import PriceCandidate

PRICE_RE = re.compile(r"(?:¥|￥|RMB|CNY)?\s*([0-9][0-9,]*\.?[0-9]{0,2})")

# 各平台常见价格容器；真实项目应放到配置文件并加回归测试
SITE_SELECTORS: dict[str, list[str]] = {
    "jd": [".price .p-price", ".summary-price .p-price", "[class*='price'] em"],
    "tmall": [".tm-price", ".tm-promo-price", "[class*='Price--priceText']"],
    "pdd": ["[class*='price']", "[class*='Price']"],
    "suning": [".mainprice .price", "#promotionPrice", "[class*='price']"],
}


def _to_price(text: str) -> float | None:
    text = text.replace(",", "").strip()
    match = PRICE_RE.search(text)
    if not match:
        return None
    try:
        value = float(match.group(1))
    except ValueError:
        return None
    return value if 0 < value < 1_000_000 else None


def _json_ld_candidates(html: str) -> list[PriceCandidate]:
    """策略 1：读取 schema.org 结构化数据，可靠度最高。"""
    soup = BeautifulSoup(html, "lxml")
    out: list[PriceCandidate] = []
    for tag in soup.find_all("script", {"type": "application/ld+json"}):
        try:
            payload = json.loads(tag.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        for price in _walk_prices(payload):
            out.append(PriceCandidate(price, "json-ld", 0.95, raw=str(price)))
    return out


def _walk_prices(node: Any) -> list[float]:
    found: list[float] = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key in {"price", "lowPrice", "highPrice"} and isinstance(value, (str, int, float)):
                price = _to_price(str(value))
                if price:
                    found.append(price)
            else:
                found.extend(_walk_prices(value))
    elif isinstance(node, list):
        for item in node:
            found.extend(_walk_prices(item))
    return found


def _site_adapter_candidates(html: str, platform: str) -> list[PriceCandidate]:
    """策略 2：站点定制选择器。"""
    soup = BeautifulSoup(html, "lxml")
    out: list[PriceCandidate] = []
    for selector in SITE_SELECTORS.get(platform, []):
        for node in soup.select(selector)[:3]:
            price = _to_price(node.get_text(" ", strip=True))
            if price:
                out.append(PriceCandidate(price, f"adapter:{selector}", 0.85, raw=node.get_text(strip=True)))
    return out


def _css_heuristic_candidates(html: str) -> list[PriceCandidate]:
    """策略 3：类名包含 price 的通用启发式，覆盖面广但噪声大。"""
    soup = BeautifulSoup(html, "lxml")
    out: list[PriceCandidate] = []
    for node in soup.find_all(True, class_=re.compile("price", re.I))[:20]:
        text = node.get_text(" ", strip=True)
        if len(text) > 40:
            continue
        price = _to_price(text)
        if price:
            out.append(PriceCandidate(price, "css-heuristic", 0.6, raw=text))
    return out


def _ai_candidates(html: str) -> list[PriceCandidate]:
    """策略 4：可选的大模型兜底，未配置 key 时直接跳过。"""
    if not os.getenv("PRICE_AI_API_KEY"):
        return []
    try:
        import httpx
    except ImportError:
        return []

    endpoint = os.getenv("PRICE_AI_ENDPOINT", "https://api.openai.com/v1/chat/completions")
    snippet = re.sub(r"<script[\s\S]*?</script>", " ", html)[:4000]
    prompt = (
        "从下面的电商页面文本中提取当前到手价，只返回一个数字，无法确定返回 0。\n\n" + snippet
    )
    try:
        resp = httpx.post(
            endpoint,
            headers={"Authorization": f"Bearer {os.environ['PRICE_AI_API_KEY']}"},
            json={
                "model": os.getenv("PRICE_AI_MODEL", "gpt-4o-mini"),
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
            },
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        price = _to_price(content)
        return [PriceCandidate(price, "ai", 0.75, raw=content[:80])] if price else []
    except Exception:  # 兜底策略不应中断主流程
        return []


def collect_candidates(html: str, platform: str) -> list[PriceCandidate]:
    """并行执行全部策略并去重。"""
    strategies: list[Callable[[], list[PriceCandidate]]] = [
        lambda: _json_ld_candidates(html),
        lambda: _site_adapter_candidates(html, platform),
        lambda: _css_heuristic_candidates(html),
        lambda: _ai_candidates(html),
    ]
    results: list[PriceCandidate] = []
    for strategy in strategies:
        results.extend(strategy())

    # 同一价格同一来源只保留一条
    seen: set[tuple[float, str]] = set()
    unique: list[PriceCandidate] = []
    for item in results:
        key = (round(item.value, 2), item.source)
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique
