"""Fixed 7-stage pipeline, ONE conditional branch. Spec §3.

START -> resolve -> market_pull -> news_search -> trends_search -> decide_followup
  |- follow_up_query set   -> web_search -> physical_corroborate
  |- None                  -> physical_corroborate
  -> synthesize -> END
"""
from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from research_desk.nodes.decide_followup import decide_followup
from research_desk.nodes.market_pull import market_pull
from research_desk.nodes.news_search import news_search
from research_desk.nodes.physical_corroborate import physical_corroborate
from research_desk.nodes.resolve import resolve
from research_desk.nodes.synthesize import synthesize
from research_desk.nodes.trends_search import trends_search
from research_desk.nodes.web_search import web_search
from research_desk.state import ResearchState


def _needs_search(state: ResearchState) -> str:
    return "web_search" if state.get("follow_up_query") else "physical_corroborate"


def build_graph():
    g = StateGraph(ResearchState)
    g.add_node("resolve", resolve)
    g.add_node("market_pull", market_pull)
    g.add_node("news_search", news_search)
    g.add_node("trends_search", trends_search)
    g.add_node("decide_followup", decide_followup)
    g.add_node("web_search", web_search)
    g.add_node("physical_corroborate", physical_corroborate)
    g.add_node("synthesize", synthesize)
    g.add_edge(START, "resolve")
    g.add_edge("resolve", "market_pull")
    g.add_edge("market_pull", "news_search")
    g.add_edge("news_search", "trends_search")
    g.add_edge("trends_search", "decide_followup")
    g.add_conditional_edges("decide_followup", _needs_search, ["web_search", "physical_corroborate"])
    g.add_edge("web_search", "physical_corroborate")
    g.add_edge("physical_corroborate", "synthesize")
    g.add_edge("synthesize", END)
    return g.compile()


graph = build_graph()


def run(query: str) -> dict:
    """Blocking run; returns final state (report + trace + evidence)."""
    from research_desk.state import fresh_state

    return graph.invoke(fresh_state(query))
