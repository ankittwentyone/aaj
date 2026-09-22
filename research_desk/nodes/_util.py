"""Shared trace helper for nodes."""
from __future__ import annotations

from datetime import datetime, timezone


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def trace_entry(stage: str, status: str, **extra) -> dict:
    return {"stage": stage, "status": status, "timestamp": now(), **extra}
