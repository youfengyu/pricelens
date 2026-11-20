"""把采集端最新快照导出为前端可接入的报价文件。

用法：
    python -m crawler.export
    python -m crawler.export --dry-run
    npm run ingest -- --source json --kind products --file data/real/products.json

只导出 status 为 ok / review 的记录，采集失败的快照不会进入前端数据。
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .sites import ALL_TARGETS
from .store import LATEST_FILE

ROOT = Path(__file__).resolve().parent.parent
CATALOG_FILE = ROOT / "public" / "data" / "products.json"
OUT_FILE = ROOT / "data" / "real" / "products.json"

PLATFORM_NAMES = {
    "jd": "京东",
    "tmall": "天猫",
    "pdd": "拼多多",
    "suning": "苏宁",
    "maoyan": "猫眼",
    "taopiaopiao": "淘票票",
    "ctrip": "携程",
    "fliggy": "飞猪",
}


def now_cn() -> str:
    t = datetime.now(timezone.utc) + timedelta(hours=8)
    return t.strftime("%Y-%m-%d %H:%M")


def load_catalog() -> dict[str, dict]:
    if not CATALOG_FILE.exists():
        return {}
    try:
        data = json.loads(CATALOG_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return {p["id"]: p for p in data.get("products", [])}


def target_names() -> dict[str, str]:
    names: dict[str, str] = {}
    for targets in ALL_TARGETS.values():
        for t in targets:
            names.setdefault(t.id, t.name)
    return names


def build_quotes(latest: dict, catalog: dict[str, dict]) -> tuple[list[dict], list[str]]:
    names = target_names()
    quotes: list[dict] = []
    skipped: list[str] = []

    for key, snap in latest.items():
        if snap.get("kind") != "product":
            continue
        status = snap.get("status")
        price = float(snap.get("price") or 0)
        if status not in {"ok", "review"} or price <= 0:
            skipped.append(f"{key}（{status or 'unknown'}）")
            continue

        pid = snap.get("target_id", "")
        platform = PLATFORM_NAMES.get(snap.get("platform", ""), snap.get("platform", ""))
        product = catalog.get(pid, {})
        prev = next((p for p in product.get("platforms", []) if p.get("platform") == platform), {})
        extra = snap.get("extra") or {}

        quotes.append(
            {
                "product_id": pid,
                "name": product.get("name") or extra.get("name") or names.get(pid, pid),
                "category": product.get("category") or extra.get("category") or "未分类",
                "spec": product.get("spec") or extra.get("spec") or "",
                "unit": product.get("unit") or extra.get("unit") or "件",
                "image": product.get("image") or extra.get("image") or "",
                "tags": "|".join(product.get("tags") or []),
                "platform": platform,
                "shop": extra.get("shop") or prev.get("shop") or f"{platform}官方店",
                "price": round(price, 2),
                "original_price": extra.get("original_price") or prev.get("originalPrice") or round(price, 2),
                "coupon": extra.get("coupon") or prev.get("coupon") or 0,
                "sales": extra.get("sales") or prev.get("sales") or "—",
                "rating": extra.get("rating") or prev.get("rating") or 4.8,
                "in_stock": extra.get("in_stock", True),
            }
        )

    return quotes, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description="导出采集快照为前端报价 JSON")
    parser.add_argument("--dry-run", action="store_true", help="只统计，不写文件")
    args = parser.parse_args()

    if not LATEST_FILE.exists():
        print(f"未找到采集快照 {LATEST_FILE}，请先运行 python -m crawler.collect")
        return 1

    latest = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
    quotes, skipped = build_quotes(latest, load_catalog())

    print(f"\n{'试运行（未写入）' if args.dry_run else '✓ 导出完成'}")
    print(f"  快照条目  {len(latest)}")
    print(f"  有效报价  {len(quotes)}")
    if skipped:
        print(f"  已跳过    {len(skipped)}（状态非 ok/review）")
        for s in skipped[:5]:
            print(f"            - {s}")

    if not quotes:
        print("  没有可导出的有效报价")
        return 1

    payload = {"updatedAt": now_cn(), "quotes": quotes}
    if not args.dry_run:
        OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
        OUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"  输出      {OUT_FILE.relative_to(ROOT)}")
        print("\n下一步：npm run ingest -- --source json --kind products --file data/real/products.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
