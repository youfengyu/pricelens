"""价格候选的置信度投票。

规则：
1. 丢弃离群值（与中位数偏差超过 35%）；
2. 按 1% 容差聚类，簇内置信度求和；
3. 得分最高簇为结果，簇内不同来源数量视为「同意票数」；
4. 同意票数 < 2 或最高置信度 < 0.8 时标记 needs_review，交由人工确认。
"""
from __future__ import annotations

from statistics import median

from .models import PriceCandidate, VoteResult

OUTLIER_RATIO = 0.35
CLUSTER_TOLERANCE = 0.01


def vote(candidates: list[PriceCandidate]) -> VoteResult | None:
    if not candidates:
        return None

    values = [c.value for c in candidates]
    center = median(values)
    kept = [c for c in candidates if abs(c.value - center) / center <= OUTLIER_RATIO]
    if not kept:
        return None

    kept.sort(key=lambda c: c.value)
    clusters: list[list[PriceCandidate]] = []
    for candidate in kept:
        if clusters and abs(candidate.value - clusters[-1][0].value) / clusters[-1][0].value <= CLUSTER_TOLERANCE:
            clusters[-1].append(candidate)
        else:
            clusters.append([candidate])

    def score(cluster: list[PriceCandidate]) -> float:
        return sum(c.confidence for c in cluster)

    best = max(clusters, key=score)
    weighted = sum(c.value * c.confidence for c in best) / sum(c.confidence for c in best)
    sources = {c.source.split(":")[0] for c in best}
    confidence = min(1.0, score(best) / 2)

    return VoteResult(
        price=round(weighted, 2),
        confidence=round(confidence, 2),
        winner=best[0].source,
        agreement=len(sources),
        total=len(candidates),
        needs_review=len(sources) < 2 or confidence < 0.8,
        candidates=candidates,
    )
