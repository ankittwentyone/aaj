"""Env vars + SerpApi key pool config. Spec §7."""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


def serpapi_keys() -> list[str]:
    keys: list[str] = []
    # SERPAPI_KEY_1..N (+ bare SERPAPI_KEY / SERPAPI_API_KEY for convenience)
    for i in range(1, 11):
        v = os.environ.get(f"SERPAPI_KEY_{i}")
        if v:
            keys.append(v)
    for alias in ("SERPAPI_KEY", "SERPAPI_API_KEY"):
        v = os.environ.get(alias)
        if v and v not in keys:
            keys.append(v)
    return keys


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


ALPHAVANTAGE_API_KEY = lambda: env("ALPHAVANTAGE_API_KEY")  # noqa: E731
FRED_API_KEY = lambda: env("FRED_API_KEY")  # noqa: E731
AISSTREAM_API_KEY = lambda: env("AISSTREAM_API_KEY")  # noqa: E731
EIA_API_KEY = lambda: env("EIA_API_KEY")  # noqa: E731
SEC_USER_AGENT = lambda: env("SEC_USER_AGENT")  # noqa: E731
DEEPSEEK_API_KEY = lambda: env("DEEPSEEK_API_KEY")  # noqa: E731
# Groq is the active LLM provider. LLM_API_KEY is the canonical groq key
# (GROQ_API_KEY accepted as alias). DEEPSEEK_API_KEY kept as legacy fallback.
LLM_API_KEY = lambda: env("LLM_API_KEY") or env("GROQ_API_KEY")  # noqa: E731
GROQ_API_KEY = lambda: env("GROQ_API_KEY") or env("LLM_API_KEY")  # noqa: E731
LLM_MODEL = lambda: env("LLM_MODEL", "qwen/qwen3.8-27b")  # noqa: E731
MOCK_MODE = lambda: env("MOCK_MODE", "").lower() == "true"  # noqa: E731


def llm_key() -> str:
    """Precedence: LLM_API_KEY (groq) > GROQ_API_KEY > DEEPSEEK_API_KEY."""
    return env("LLM_API_KEY") or env("GROQ_API_KEY") or env("DEEPSEEK_API_KEY")
