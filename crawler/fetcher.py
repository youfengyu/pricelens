"""HTTP 抓取：UA 轮换、限速抖动、指数退避重试，可选 Playwright 渲染。"""
from __future__ import annotations

import random
import time
from typing import Any

import httpx

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
]


class Fetcher:
    def __init__(self, delay: float = 1.2, retries: int = 3, timeout: float = 20.0) -> None:
        self.delay = delay
        self.retries = retries
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={"Accept-Language": "zh-CN,zh;q=0.9"},
        )

    def get(self, url: str, **kwargs: Any) -> str:
        last_error: Exception | None = None
        for attempt in range(self.retries):
            try:
                time.sleep(self.delay * (0.6 + random.random()))
                headers = {"User-Agent": random.choice(USER_AGENTS)}
                resp = self.client.get(url, headers=headers, **kwargs)
                resp.raise_for_status()
                return resp.text
            except Exception as exc:  # 网络异常统一重试
                last_error = exc
                time.sleep((2**attempt) + random.random())
        raise RuntimeError(f"抓取失败 {url}: {last_error}")

    def render(self, url: str) -> str:
        """动态页面渲染，需要安装 playwright 与浏览器内核。"""
        from playwright.sync_api import sync_playwright  # 延迟导入

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(user_agent=random.choice(USER_AGENTS), locale="zh-CN")
            page.goto(url, wait_until="domcontentloaded", timeout=45_000)
            page.wait_for_timeout(1_800)
            html = page.content()
            browser.close()
            return html

    def close(self) -> None:
        self.client.close()

    def __enter__(self) -> "Fetcher":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
