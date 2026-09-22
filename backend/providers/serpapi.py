"""SerpApi provider — build first, everything else can stub. Spec §4a.

Engines: google_news, google_trends, google_search, google_autocomplete.
google_trends payload retains FULL raw response (rising_queries + geo breakdown
cost nothing extra — service layer decides what to surface).

All calls go through cache layer first. Key-rotation wrapper for dev/test
headroom; judged demo run uses one key against warm cache.
"""
from __future__ import annotations

import itertools
import os
import time

import requests

from backend.cache.cache import cache_key, get_or_fetch
from backend.models.source_record import make_record

SERPAPI_ENDPOINT = "https://serpapi.com/search.json"

_TTLS = {
    "google_news": 600,       # minutes class
    "google_trends": 3600,    # hours class
    "google_search": 3600,    # per query/time-bucket
    "google_autocomplete": 3600,
}


class SerpApiKeyPool:
    def __init__(self, keys: list[str] | None = None):
        from backend import config as cfg

        self.keys = keys if keys is not None else cfg.serpapi_keys()
        self._cycle = itertools.cycle(self.keys) if self.keys else None
        self._idx = 0

    def _next_key(self) -> str | None:
        if not self.keys:
            return None
        key = self.keys[self._idx % len(self.keys)]
        self._idx += 1
        return key

    def call(self, engine: str, params: dict) -> dict:
        """Round-robin; on 429/quota error advance to next key and retry once per key."""
        if not self.keys:
            raise RuntimeError("No SERPAPI keys configured (SERPAPI_KEY_1..N)")
        last_err: Exception | None = None
        for _ in range(len(self.keys)):
            key = self._next_key()
            q = dict(params)
            q["engine"] = engine
            q["api_key"] = key
            try:
                r = requests.get(SERPAPI_ENDPOINT, params=q, timeout=20)
                if r.status_code == 429:
                    last_err = RuntimeError(f"429 quota on key ...{key[-4:]}")
                    continue
                r.raise_for_status()
                data = r.json()
                if "error" in data and "quota" in str(data.get("error", "")).lower():
                    last_err = RuntimeError(str(data["error"]))
                    continue
                return data
            except requests.HTTPError as e:
                last_err = e
                continue
        raise RuntimeError(f"All SerpApi keys exhausted: {last_err}")


_POOL: SerpApiKeyPool | None = None


def _pool() -> SerpApiKeyPool:
    global _POOL
    if _POOL is None:
        _POOL = SerpApiKeyPool()
    return _POOL


def _mock(engine: str, params: dict) -> dict | None:
    """MOCK_MODE: faithful replay of warm_cache recording; degraded stub only if
    the query was never recorded (run warm_cache.py live first)."""
    from backend.cache.replay import lookup, replay_mode

    if not replay_mode():
        return None
    rec = lookup("serpapi", {"engine": engine, **params})
    if rec is not None:
        return rec
    import json
    import pathlib

    p = pathlib.Path(__file__).resolve().parents[1] / "data" / "warm_cache.json"
    keys = []
    try:
        keys = list(json.loads(p.read_text()).get("records", {}).get("serpapi", {}).keys())[:5]
    except Exception:
        pass
    return {"mock": True, "unrecorded": True, "engine": engine, "params": params, "recorded_keys": keys}


def google_news(query: str, num: int = 10) -> list:
    params = {"q": query, "num": num}
    key = cache_key("serpapi", "google_news", params, _TTLS["google_news"])

    def fetch():
        m = _mock("google_news", params)
        raw = m if m is not None else _pool().call("google_news", {"q": query, "num": num})
        items = raw.get("news_results", []) if isinstance(raw, dict) else []
        out = []
        for it in items[:num]:
            out.append(
                make_record(
                    provider="serpapi",
                    dataset="google_news",
                    entity_id=None,
                    query=query,
                    source_url=it.get("link"),
                    payload=it,
                )
            )
        return out

    return get_or_fetch(key, _TTLS["google_news"], fetch)


def google_trends(query: str, geo: str | None = None) -> dict:
    """Retain FULL raw response — rising + regional fields live here."""
    params = {"q": query, "geo": geo}
    key = cache_key("serpapi", "google_trends", params, _TTLS["google_trends"])

    def fetch():
        m = _mock("google_trends", params)
        if m is not None:
            raw = m
        else:
            p = {"q": query, "data_type": "TIMESERIES"}
            if geo:
                p["geo"] = geo
            raw = _pool().call("google_trends", p)
        return make_record(
            provider="serpapi",
            dataset="google_trends",
            query=query,
            payload=raw if isinstance(raw, dict) else {"raw": raw},
        )

    return get_or_fetch(key, _TTLS["google_trends"], fetch)


def google_search(query: str, num: int = 5) -> list:
    params = {"q": query, "num": num}
    key = cache_key("serpapi", "google_search", params, _TTLS["google_search"])

    def fetch():
        m = _mock("google_search", params)
        raw = m if m is not None else _pool().call("google_search", {"q": query, "num": num})
        items = raw.get("organic_results", []) if isinstance(raw, dict) else []
        out = []
        for it in items[:num]:
            out.append(
                make_record(
                    provider="serpapi",
                    dataset="google_search",
                    query=query,
                    source_url=it.get("link"),
                    payload=it,
                )
            )
        return out

    return get_or_fetch(key, _TTLS["google_search"], fetch)


def google_autocomplete(query: str) -> dict:
    params = {"q": query}
    key = cache_key("serpapi", "google_autocomplete", params, _TTLS["google_autocomplete"])

    def fetch():
        m = _mock("google_autocomplete", params)
        raw = m if m is not None else _pool().call("google_autocomplete", {"q": query})
        return make_record(
            provider="serpapi",
            dataset="google_autocomplete",
            query=query,
            payload=raw if isinstance(raw, dict) else {"raw": raw},
        )

    return get_or_fetch(key, _TTLS["google_autocomplete"], fetch)


def search_trace(engine: str, query: str) -> dict:
    """Helper for the Research Desk trace panel: literal call evidence."""
    return {"engine": engine, "query": query, "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
