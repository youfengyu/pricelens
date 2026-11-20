"""采集结果落盘：JSONL 追加 + 最新价快照。"""
from __future__ import annotations

import json
from pathlib import Path

from .models import Snapshot

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SNAPSHOT_FILE = DATA_DIR / "snapshots.jsonl"
LATEST_FILE = DATA_DIR / "latest.json"


def save(snapshot: Snapshot) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with SNAPSHOT_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(snapshot.to_dict(), ensure_ascii=False) + "\n")
    _update_latest(snapshot)


def _update_latest(snapshot: Snapshot) -> None:
    latest: dict[str, dict] = {}
    if LATEST_FILE.exists():
        try:
            latest = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            latest = {}
    latest[f"{snapshot.kind}:{snapshot.target_id}:{snapshot.platform}"] = snapshot.to_dict()
    LATEST_FILE.write_text(json.dumps(latest, ensure_ascii=False, indent=2), encoding="utf-8")


def read_history(kind: str, target_id: str, platform: str) -> list[dict]:
    if not SNAPSHOT_FILE.exists():
        return []
    rows: list[dict] = []
    with SNAPSHOT_FILE.open(encoding="utf-8") as fh:
        for line in fh:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if (row.get("kind"), row.get("target_id"), row.get("platform")) == (kind, target_id, platform):
                rows.append(row)
    return rows
