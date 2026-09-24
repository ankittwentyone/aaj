"""Recordail (run LIVE) + replay (MOCK_MODE=true, zero quota burn).

- RECORD: `MOCK_MODE=false python scripts/warm_cache.py` — hits every endpoint
  once AND captures RAW provider responses into `records` (keyed by replay.key).
- REPLAY: `MOCK_MODE=true` — providers serve the recording; free/keyless
  providers (yfinance, SEC) stay live; anything unrecorded degrades to a stub.
- Also backfills the SQLite baseline from seed on fresh deploys.
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv()

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "backend" / "data" / "warm_cache.json"

# (engine, params-without-key) pairs mirroring provider code exactly.
SERPAPI_RECORDS = [
    ("google_news", {"q": "markets today", "num": 8}),
    ("google_news", {"q": "BRENT stock", "num": 10}),
    ("google_news", {"q": "oil markets geopolitics", "num": 20}),
    ("google_trends", {"q": "BRENT", "data_type": "TIMESERIES"}),
    ("google_search", {"q": "BRENT impact sectors stocks", "num": 3}),
    ("google_search", {"q": "WTI impact sectors stocks", "num": 3}),
    ("google_autocomplete", {"q": "why is BRENT "}),
    ("google_autocomplete", {"q": "oil markets geopolitics "}),
]

AV_RECORDS = [
    {"function": "GLOBAL_QUOTE", "symbol": s}
    for s in ("SPY", "QQQ", "GLD", "TNX", "BTCUSD", "ETHUSD", "AAPL", "XOM")
] + [
    {"function": "TIME_SERIES_DAILY", "symbol": "SPY", "outputsize": "compact"},
    {"function": "OVERVIEW", "symbol": "AAPL"},
    {"function": "CURRENCY_EXCHANGE_RATE", "from_currency": "EUR", "to_currency": "USD"},
    {"function": "CURRENCY_EXCHANGE_RATE", "from_currency": "USD", "to_currency": "INR"},
    {"function": "BRENT", "interval": "daily"},
    {"function": "WTI", "interval": "daily"},
    {"function": "NATURAL_GAS", "interval": "daily"},
    {"function": "COPPER", "interval": "daily"},
]


def _is_av_error(payload: object) -> bool:
    return isinstance(payload, dict) and ("Error Message" in payload or "Information" in payload)


# SerpApi wire engine differs from our dataset label: organic search wire is
# "google". Verified live 2026-09-24: wire "google_search" 400s.
SERPAPI_WIRE = {"google_search": "google"}


def record_raw() -> dict:
    from backend.cache.replay import record_key
    from backend.providers.serpapi import SerpApiKeyPool

    records: dict = {"serpapi": {}, "av": {}, "fred": {}, "layers": {}}
    # SerpApi raws
    try:
        pool = SerpApiKeyPool()
        for engine, params in SERPAPI_RECORDS:
            try:
                wire = SERPAPI_WIRE.get(engine, engine)
                payload = pool.call(wire, params)
                if isinstance(payload, dict) and payload.get("error"):
                    print(f"  SKIP serpapi {engine} {params.get('q')}: {payload.get('error')}")
                    continue
                records["serpapi"][record_key("serpapi", {"engine": engine, **params})] = payload
                print(f"  recorded serpapi {engine} {params.get('q')}")
            except Exception as e:
                print(f"  SKIP serpapi {engine} {params.get('q')}: {e}")
    except Exception as e:
        print(f"  serpapi pool unavailable: {e}")
    # AV raws (live _call) — skip rate-limit/error payloads so replay never poisons
    try:
        from backend.providers import alphavantage

        for params in AV_RECORDS:
            try:
                payload = alphavantage._call(dict(params))  # noqa: SLF001
                if _is_av_error(payload):
                    print(f"  SKIP av {params.get('function')} {params.get('symbol', '')}: rate-limited/error, not recording")
                    continue
                records["av"][record_key("av", params)] = payload
                print(f"  recorded av {params.get('function')} {params.get('symbol', '')}")
            except Exception as e:
                print(f"  SKIP av {params}: {e}")
    except Exception as e:
        print(f"  av unavailable: {e}")
    # FRED raws
    try:
        import requests

        for sid in ("DGS10", "CPIAUCSL"):
            try:
                r = requests.get(
                    "https://api.stlouisfed.org/fred/series/observations",
                    params={"series_id": sid, "api_key": os.environ.get("FRED_API_KEY", ""),
                            "file_type": "json", "limit": 20, "sort_order": "desc"},
                    timeout=20,
                )
                r.raise_for_status()
                records["fred"][record_key("fred", {"series_id": sid, "file_type": "json", "limit": 20, "sort_order": "desc"})] = r.json()
                print(f"  recorded fred {sid}")
            except Exception as e:
                print(f"  SKIP fred {sid}: {e}")
    except Exception as e:
        print(f"  fred unavailable: {e}")
    # Layers payloads
    try:
        from backend.providers import layers

        for feed, fn in (("weather", layers.weather), ("earthquakes", layers.earthquakes), ("disasters", layers.disasters)):
            try:
                rec = fn()
                records["layers"][record_key("layers", {"feed": feed})] = rec.get("payload", {})
                print(f"  recorded layers {feed}")
            except Exception as e:
                print(f"  SKIP layers {feed}: {e}")
    except Exception as e:
        print(f"  layers unavailable: {e}")
    return records


def main() -> None:
    from backend.services import asset_service, cross_market_service, events_service, layers_service, map_service, market_home_service, search_service

    mock = os.environ.get("MOCK_MODE", "").lower() == "true"
    blob: dict = {}
    if not mock:
        # Record raw provider responses FIRST while AV quota is fresh; service
        # calls after may rate-limit and fall back to yfinance honestly.
        print("live mode: recording raw provider responses ...")
        blob["records"] = record_raw()
    blob["market-home"] = market_home_service.get_home()
    blob["asset/BRENT"] = asset_service.get_asset("BRENT")
    blob["asset/AAPL"] = asset_service.get_asset("AAPL")
    blob["events"] = events_service.get_events()
    blob["cross-market"] = cross_market_service.get_matrix()
    blob["map"] = map_service.get_all_maps()
    blob["map/hormuz/history"] = map_service.get_history("hormuz", 48)
    blob["search"] = search_service.search("BRENT")
    blob["geo"] = {"layers": ["ports", "routes", "tss_lanes", "trade_arcs"]}
    blob["layers/weather"] = layers_service.get_layer("weather")
    if mock:
        print("MOCK_MODE=true: validating endpoints against replay (no recording)")

    def default(o):
        return str(o)

    def sanitize(o):
        if isinstance(o, dict):
            return {str(k): sanitize(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [sanitize(v) for v in o]
        return o

    OUT.write_text(json.dumps(sanitize(blob), default=default, indent=1)[:2_000_000])
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    try:
        from backend.services.warmup import backfill_db_from_seed

        print(backfill_db_from_seed())
    except Exception as e:
        print(f"db backfill skipped: {e}")


if __name__ == "__main__":
    main()
