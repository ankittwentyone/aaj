"""Normalized envelope — implement first, everything depends on it.
Spec: api_implementation_plan.md §2 (unchanged from apis_aaj.md §29).
"""
from __future__ import annotations

from typing import TypedDict


class SourceRecord(TypedDict, total=False):
    provider: str
    dataset: str
    entity_id: str | None
    observed_at: str | None
    retrieved_at: str
    source_url: str | None
    query: str | None
    payload: dict
    confidence: float | None


def make_record(
    provider: str,
    dataset: str,
    payload: dict,
    entity_id: str | None = None,
    observed_at: str | None = None,
    retrieved_at: str | None = None,
    source_url: str | None = None,
    query: str | None = None,
    confidence: float | None = None,
) -> SourceRecord:
    from datetime import datetime, timezone

    return SourceRecord(
        provider=provider,
        dataset=dataset,
        entity_id=entity_id,
        observed_at=observed_at,
        retrieved_at=retrieved_at or datetime.now(timezone.utc).isoformat(),
        source_url=source_url,
        query=query,
        payload=payload,
        confidence=confidence,
    )
