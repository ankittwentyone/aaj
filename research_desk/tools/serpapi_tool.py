"""Thin wrapper exposing serpapi.py functions as LangGraph tools.

DeepSeek caveat mitigation #1: ONLY these tools are injected (Tavily default
disabled). decide_followup/synthesize don't take tools at all.
"""
from __future__ import annotations


def news_tool(query: str, num: int = 10) -> list:
    from research_desk.config import SEARCH_BUDGET

    from backend.providers import serpapi

    return serpapi.google_news(query, num=min(num, SEARCH_BUDGET["news"]))


def trends_tool(query: str) -> dict:
    from backend.providers import serpapi

    return serpapi.google_trends(query)


def search_tool(query: str, num: int = 5) -> list:
    from research_desk.config import SEARCH_BUDGET

    from backend.providers import serpapi

    return serpapi.google_search(query, num=min(num, SEARCH_BUDGET["web_search"]))


TOOLS = [news_tool, trends_tool, search_tool]
