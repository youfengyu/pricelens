"""命令行采集入口。

用法：
    python -m crawler.collect --kind product --only huawei-band-11
    python -m crawler.collect --kind flight --dry-run
"""
from __future__ import annotations

import argparse
import logging

from .fetcher import Fetcher
from .models import Snapshot
from .sites import Target, select_targets
from .store import save
from .strategies import collect_candidates
from .vote import vote

log = logging.getLogger("pricelens.crawler")


def crawl_one(target: Target, fetcher: Fetcher, dry_run: bool = False) -> Snapshot:
    try:
        html = fetcher.render(target.url) if target.render else fetcher.get(target.url)
        result = vote(collect_candidates(html, target.platform))
    except Exception as exc:
        log.warning("采集失败 %s: %s", target.url, exc)
        return Snapshot(target.kind, target.id, target.platform, 0, status="error", error=str(exc), source_url=target.url)

    if result is None:
        return Snapshot(target.kind, target.id, target.platform, 0, status="no_price", source_url=target.url)

    snapshot = Snapshot(
        kind=target.kind,
        target_id=target.id,
        platform=target.platform,
        price=result.price,
        confidence=result.confidence,
        agreement=result.agreement,
        source_url=target.url,
        status="review" if result.needs_review else "ok",
    )
    if not dry_run:
        save(snapshot)
    log.info(
        "%-8s %-18s %-10s ¥%-9s 置信度 %.2f 票数 %d/%d %s",
        target.platform,
        target.name,
        target.id,
        result.price,
        result.confidence,
        result.agreement,
        result.total,
        "需复核" if result.needs_review else "",
    )
    return snapshot


def main() -> int:
    parser = argparse.ArgumentParser(description="PriceLens 公开页面价格采集")
    parser.add_argument("--kind", choices=["product", "movie", "flight"], default="product")
    parser.add_argument("--only", help="仅采集指定商品 id 或平台")
    parser.add_argument("--delay", type=float, default=1.2, help="请求间隔基数（秒）")
    parser.add_argument("--dry-run", action="store_true", help="只打印结果，不落盘")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    targets = select_targets(args.kind, args.only)
    if not targets:
        log.error("没有匹配的采集目标")
        return 1

    ok = 0
    with Fetcher(delay=args.delay) as fetcher:
        for target in targets:
            snapshot = crawl_one(target, fetcher, args.dry_run)
            ok += snapshot.status in {"ok", "review"}

    log.info("完成 %d/%d 个目标", ok, len(targets))
    return 0 if ok == len(targets) else 2


if __name__ == "__main__":
    raise SystemExit(main())
