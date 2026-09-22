"""FRED provider — spec §4d."""
from __future__ import annotations

import os

import requests

from backend.cache.cache import cache_key, get_or_fetch
from backend.models.source_record import make_record

BASE = "https://api.stlouisfed.org/fred"
TTL = 4 * 3600


def series(series_id: str) -> dict:
    key = cache_key("fred", "series", {"id": series_id}, TTL)

    def fetch():
        from backend.cache.replay import lookup, replay_mode

        if replay_mode():
            rec = lookup("fred", {"series_id": series_id, "file_type": "json", "limit": 20, "sort_order": "desc"})
            if rec is not None:
                return make_record("fred", "series", rec, entity_id=series_id)
            return make_record("fred", "series", {"status": "skipped", "reason": "unrecorded — run warm_cache.py live"}, entity_id=series_id)
        api_key = os.environ.get("FRED_API_KEY", "")
        if not api_key:
            raise RuntimeError("FRED_API_KEY missing")
        r = requests.get(
            f"{BASE}/series/observations",
            params={"series_id": series_id, "api_key": api_key, "file_type": "json", "limit": 20, "sort_order": "desc"},
            timeout=20,
        )
        r.raise_for_status()
        return make_record("fred", "series", r.json(), entity_id=series_id)

    return get_or_fetch(key, TTL, fetch)
