"""EIA — built with graceful skip. Spec §10b. One function series().

MVP watchlist: backend/data/curated/eia_watchlist.json (4 IDs).
Exact v2 routes resolved at implementation time via API browser; route recorded
in watchlist + verification date in comment below.
Verified: 2026-09-17 — routes are placeholders; confirm against
https://www.eia.gov/opendata/browser before demo week.
If EIA_API_KEY missing -> {"status":"skipped"}; spine still works on AIS alone.
"""
from __future__ import annotations

import os

import requests

from backend.cache.cache import cache_key, get_or_fetch
from backend.models.source_record import make_record

TTL = 6 * 3600


class SkipProvider(Exception):
    pass


def series(series_id: str) -> dict:
    import json
    import pathlib

    key = cache_key("eia", "series", {"id": series_id}, TTL)

    def fetch():
        api_key = os.environ.get("EIA_API_KEY", "")
        if not api_key or os.environ.get("MOCK_MODE", "").lower() == "true":
            if not api_key:
                return make_record("eia", "series", {"status": "skipped", "reason": "no EIA_API_KEY"}, entity_id=series_id)
            return make_record("eia", "series", {"status": "skipped", "reason": "mock", "series_id": series_id}, entity_id=series_id)
        # resolve route from watchlist
        route = "v2/petroleum/stoc/wstk/data"
        try:
            p = pathlib.Path(__file__).resolve().parents[1] / "data" / "curated" / "eia_watchlist.json"
            for row in json.loads(p.read_text()):
                if row.get("id") == series_id and row.get("route"):
                    route = row["route"]
                    break
        except Exception:
            pass
        try:
            r = requests.get(f"https://api.eia.gov/{route}", params={"api_key": api_key, "facets[series][]": series_id, "length": 5}, timeout=20)
            r.raise_for_status()
            return make_record("eia", "series", r.json(), entity_id=series_id)
        except Exception as e:
            return make_record("eia", "series", {"status": "skipped", "reason": str(e)}, entity_id=series_id)

    return get_or_fetch(key, TTL, fetch)
