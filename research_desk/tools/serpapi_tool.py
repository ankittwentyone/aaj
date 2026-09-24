"""Thin wrapper exposing serpapi.py functions as LangGraph tools.

DeepSeek caveat mitigation #1: ONLY these tools are injected (Tavily default
disabled). decide_followup/synthesize don't take tools at all.
"""
from __future__ import annotations


def _clean(q: str) -> str:
    # SerpApi google_search 400s on raw $ and other symbols; LLM follow-ups
    # often include "$60". Strip to plain text, collapse whitespace.
    import re

    q = (q or "").replace("$", "").replace('"', "").replace("'", "")
    return re.sub(r"\s+", " ", q).strip()[:300]


def news_tool(query: str, num: int = 10) -> list:
    from research_desk.config import SEARCH_BUDGET

    from backend.providers import serpapi

    return serpapi.google_news(_clean(query), num=min(num, SEARCH_BUDGET["news"]))


def trends_tool(query: str) -> dict:
    from backend.providers import serpapi

    return serpapi.google_trends(_clean(query))


def search_tool(query: str, num: int = 5) -> list:
    from research_desk.config import SEARCH_BUDGET

    from backend.providers import serpapi

    return serpapi.google_search(_clean(query), num=min(num, SEARCH_BUDGET["web_search"]))


TOOLS = [news_tool, trends_tool, search_tool]
