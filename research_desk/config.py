"""Groq model config per stage + budgets. Spec §5 + §10 (provider swapped DeepSeek->Groq).

Canonical key: LLM_API_KEY (groq, gsk_...). GROQ_API_KEY accepted as alias.
DEEPSEEK_API_KEY kept as legacy fallback only. Model via LLM_MODEL env.
"""
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

MODEL_CONFIG = {
    "decide_followup": {"provider": "groq", "model": "qwen/qwen3.8-27b", "temperature": 0},
    "synthesize": {"provider": "groq", "model": "qwen/qwen3.8-27b", "temperature": 0.2},
}
# Verified live 2026-09-24: llama-3.3-70b-versatile + llama-3.1-8b-instant return
# 404 model_not_found on this key; working: qwen/qwen3.8-27b (clean strict-JSON),
# openai/gpt-oss-20b/120b (empty content, reasoning-only). Override via LLM_MODEL
# env if account gains access.
DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b"
SEARCH_BUDGET = {"news": 10, "trends": 1, "web_search": 5}
TIMEOUT_S = 15
MAX_RETRIES = 2


def _resolve_model(stage: str) -> tuple[str, float]:
    import os

    cfg = MODEL_CONFIG[stage]
    model = os.environ.get("LLM_MODEL", cfg["model"])
    return model, cfg["temperature"]


def llm_key() -> str:
    import os

    return os.environ.get("LLM_API_KEY", "") or os.environ.get("GROQ_API_KEY", "") or os.environ.get("DEEPSEEK_API_KEY", "")


def llm_client(stage: str):
    """ChatGroq primary via LLM_API_KEY; legacy ChatDeepSeek if only DEEPSEEK key set."""
    import os

    groq_key = os.environ.get("LLM_API_KEY", "") or os.environ.get("GROQ_API_KEY", "")
    if groq_key:
        from langchain_groq import ChatGroq

        model, temp = _resolve_model(stage)
        # Free-tier OTPM 1000: cap output so synthesize never requests >1000 tokens.
        max_tok = 300 if stage == "decide_followup" else 800
        return ChatGroq(
            model=model,
            temperature=temp,
            timeout=TIMEOUT_S,
            max_retries=MAX_RETRIES,
            groq_api_key=groq_key,
            max_tokens=max_tok,
        )
    deepseek_key = os.environ.get("DEEPSEEK_API_KEY", "")
    if deepseek_key:
        from langchain_deepseek import ChatDeepSeek

        cfg = MODEL_CONFIG[stage]
        return ChatDeepSeek(
            model="deepseek-chat",
            temperature=cfg["temperature"],
            timeout=TIMEOUT_S,
            max_retries=MAX_RETRIES,
        )
    raise RuntimeError("LLM_API_KEY (groq) missing")


def deepseek_client(stage: str):
    """Back-compat alias; routes to Groq when LLM_API_KEY is set."""
    return llm_client(stage)
