"""DeepSeek model config per stage + budgets. Spec §5 + §10."""
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

MODEL_CONFIG = {
    "decide_followup": {"provider": "deepseek", "model": "deepseek-chat", "temperature": 0},
    "synthesize": {"provider": "deepseek", "model": "deepseek-chat", "temperature": 0.2},
}
SEARCH_BUDGET = {"news": 10, "trends": 1, "web_search": 5}
TIMEOUT_S = 15
MAX_RETRIES = 2


def deepseek_client(stage: str):
    """ChatDeepSeek with per-node timeout + max_retries. Raises if no key."""
    import os

    key = os.environ.get("DEEPSEEK_API_KEY", "")
    if not key:
        raise RuntimeError("DEEPSEEK_API_KEY missing")
    from langchain_deepseek import ChatDeepSeek

    cfg = MODEL_CONFIG[stage]
    return ChatDeepSeek(
        model=cfg["model"],
        temperature=cfg["temperature"],
        timeout=TIMEOUT_S,
        max_retries=MAX_RETRIES,
    )
