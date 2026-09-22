"""ResearchState — spec §2. Accumulated evidence feeds report + hover cards."""
from __future__ import annotations

from typing import TypedDict


class ResearchState(TypedDict, total=False):
    query: str
    asset: str | None
    resolved_entity: dict | None
    market_data: dict | None
    news_results: list
    trends_results: dict | None
    follow_up_query: str | None
    search_results: list
    physical_signal: dict | None
    evidence: list
    report: str | None
    trace: list[dict]


def fresh_state(query: str) -> ResearchState:
    return ResearchState(
        query=query,
        asset=None,
        resolved_entity=None,
        market_data=None,
        news_results=[],
        trends_results=None,
        follow_up_query=None,
        search_results=[],
        physical_signal=None,
        evidence=[],
        report=None,
        trace=[],
    )
