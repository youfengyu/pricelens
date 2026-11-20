"""轻量调度器：按业务线设置不同采集频率，失败自动退避重试。

生产环境建议换成 Celery / APScheduler + Redis 队列，
这里保持零外部依赖，方便直接观察任务生命周期。
"""
from __future__ import annotations

import asyncio
import logging
import signal
import time
from dataclasses import dataclass

from .collect import crawl_one
from .fetcher import Fetcher

log = logging.getLogger("pricelens.scheduler")


@dataclass
class Plan:
    name: str
    kind: str
    only: str
    interval: int  # 秒
    next_run: float = 0.0


PLANS = [
    Plan("京东商品池", "product", "jd", 2 * 3600),
    Plan("天猫商品池", "product", "tmall", 2 * 3600),
    Plan("拼多多商品池", "product", "pdd", 2 * 3600),
    Plan("苏宁商品池", "product", "suning", 4 * 3600),
    Plan("猫眼电影票价", "movie", "maoyan", 3600),
    Plan("淘票票电影票价", "movie", "taopiaopiao", 3600),
    Plan("携程机票价格", "flight", "ctrip", 4 * 3600),
    Plan("飞猪机票价格", "flight", "fliggy", 4 * 3600),
]

_stop = asyncio.Event()


async def _run_plan(plan: Plan, fetcher: Fetcher) -> None:
    for attempt in range(3):
        try:
            await asyncio.to_thread(_crawl_plan, plan, fetcher)
            return
        except Exception as exc:  # 单个任务失败不影响其他任务
            wait = 2**attempt + 1
            log.warning("%s 第 %d 次失败：%s，%ds 后重试", plan.name, attempt + 1, exc, wait)
            await asyncio.sleep(wait)
    log.error("%s 连续失败，跳过本轮", plan.name)


def _crawl_plan(plan: Plan, fetcher: Fetcher) -> None:
    from .sites import select_targets

    for target in select_targets(plan.kind, plan.only):
        crawl_one(target, fetcher)


async def _worker(plan: Plan, fetcher: Fetcher) -> None:
    while not _stop.is_set():
        await _run_plan(plan, fetcher)
        plan.next_run = time.time() + plan.interval
        try:
            await asyncio.wait_for(_stop.wait(), timeout=plan.interval)
        except asyncio.TimeoutError:
            continue


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    fetcher = Fetcher(delay=1.5)
    for plan in PLANS:
        log.info("%-14s 每 %d 分钟", plan.name, plan.interval // 60)

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _stop.set)
        except NotImplementedError:  # Windows 下退化为轮询
            pass

    await asyncio.gather(*(_worker(plan, fetcher) for plan in PLANS))
    fetcher.close()
    log.info("调度器已停止")


if __name__ == "__main__":
    asyncio.run(main())
