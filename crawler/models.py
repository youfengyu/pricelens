"""采集数据模型。"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any


@dataclass
class PriceCandidate:
    """单个提取策略给出的价格候选。"""

    value: float
    source: str
    confidence: float
    raw: str = ""
    currency: str = "CNY"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class VoteResult:
    """多策略投票结果。"""

    price: float
    confidence: float
    winner: str
    agreement: int
    total: int
    needs_review: bool
    candidates: list[PriceCandidate] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["candidates"] = [c.to_dict() for c in self.candidates]
        return data


@dataclass
class Snapshot:
    """一次采集落库的价格快照。"""

    kind: str  # product / movie / flight
    target_id: str
    platform: str
    price: float
    currency: str = "CNY"
    confidence: float = 0.0
    agreement: int = 0
    source_url: str = ""
    status: str = "ok"
    error: str = ""
    extra: dict[str, Any] = field(default_factory=dict)
    captured_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
