"""Alpha Vantage (primary) — spec §4b. Explicit contract, yfinance is fallback."""
from __future__ import annotations

import os

import requests

from backend.cache.cache import cache_key, get_or_fetch
from backend.models.source_record import make_record

BASE = "https://www.alphavantage.co/query"
TTL_QUOTE = 300
TTL_HIST = 4 * 3600
TTL_FUND = 24 * 3600


def _key() -> str:
    return os.environ.get("ALPHAVANTAGE_API_KEY", "")


def _call(params: dict) -> dict:
    from backend.cache.replay import lookup, replay_mode

    if replay_mode():
        rec = lookup("av", params)
        if rec is not None:
            return rec
        return {"Information": "unrecorded query — run warm_cache.py live", "mock": True}
    params = dict(params)
    params["apikey"] = _key()
    if not params["apikey"]:
        raise RuntimeError("ALPHAVANTAGE_API_KEY missing")
    r = requests.get(BASE, params=params, timeout=20)
    r.raise_for_status()
    return r.json()


def _av_error(raw: object) -> bool:
    return isinstance(raw, dict) and ("Error Message" in raw or "Information" in raw)


def _load_tickers() -> dict:
    import json
    import pathlib

    p = pathlib.Path(__file__).resolve().parents[1] / "data" / "curated" / "tickers.json"
    return json.loads(p.read_text())


def resolve(ticker: str) -> str:
    t = _load_tickers()
    return t.get(ticker, {}).get("av_symbol", ticker)


def quote(ticker: str) -> dict:
    sym = resolve(ticker)
    key = cache_key("av", "quote", {"t": sym}, TTL_QUOTE)

    def fetch():
        try:
            raw = _call({"function": "GLOBAL_QUOTE", "symbol": sym})
        except Exception:
            raw = None
        if _av_error(raw) or not (isinstance(raw, dict) and raw.get("Global Quote")):
            # AV returns {} for Yahoo-style symbols (e.g. BZ=F) and rate-limit
            # Information dicts on exhausted quota — fall back to yfinance (keyless).
            from backend.providers import yfinance_provider

            try:
                return yfinance_provider.quote(ticker)
            except Exception:
                pass
        return make_record("alphavantage", "quote", raw if isinstance(raw, dict) else {"error": "alphavantage unreachable"}, entity_id=ticker)

    return get_or_fetch(key, TTL_QUOTE, fetch)


def historical(ticker: str, range_: str = "3m") -> dict:
    sym = resolve(ticker)
    fn = "TIME_SERIES_DAILY" if range_ in ("1m", "3m", "6m") else "TIME_SERIES_WEEKLY"
    key = cache_key("av", "historical", {"t": sym, "r": range_}, TTL_HIST)

    def fetch():
        try:
            raw = _call({"function": fn, "symbol": sym, "outputsize": "compact"})
        except Exception:
            raw = None
        if _av_error(raw):
            from backend.providers import yfinance_provider

            try:
                return yfinance_provider.historical(ticker, range_)
            except Exception:
                pass
        from backend.providers.chart_rows import parse_av_time_series

        rows = parse_av_time_series(raw if isinstance(raw, dict) else {})
        if not rows:
            # AV returns {} for Yahoo-style symbols (e.g. BZ=F) or unrecognized
            # shapes without an Error Message — fall back to yfinance (keyless).
            from backend.providers import yfinance_provider

            try:
                return yfinance_provider.historical(ticker, range_)
            except Exception:
                pass
        payload = {"range": range_, "rows": rows, "tail": rows[-5:] if rows else []}
        if not rows and isinstance(raw, dict):
            payload["raw"] = raw
        return make_record("alphavantage", "historical", payload, entity_id=ticker)

    return get_or_fetch(key, TTL_HIST, fetch)


def fundamentals(ticker: str) -> dict:
    sym = resolve(ticker)
    key = cache_key("av", "fundamentals", {"t": sym}, TTL_FUND)

    def fetch():
        raw = _call({"function": "OVERVIEW", "symbol": sym})
        return make_record("alphavantage", "fundamentals", raw, entity_id=ticker)

    return get_or_fetch(key, TTL_FUND, fetch)


def fx_rate(pair: str) -> dict:
    """pair like EURUSD or USDINR."""
    key = cache_key("av", "fx", {"p": pair}, TTL_QUOTE)

    def fetch():
        frm, to = pair[:3], pair[3:6]
        raw = _call({"function": "CURRENCY_EXCHANGE_RATE", "from_currency": frm, "to_currency": to})
        return make_record("alphavantage", "fx", raw, entity_id=pair)

    return get_or_fetch(key, TTL_QUOTE, fetch)


# Alpha Vantage dedicated commodity functions (free tier, interval=daily).
# GOLD has no dedicated function -> GLD ETF proxy via GLOBAL_QUOTE.
COMMODITY_AV_FN = {
    "BRENT": "BRENT",
    "WTI": "WTI",
    "NATGAS": "NATURAL_GAS",
    "COPPER": "COPPER",
}

TTL_COMMODITY = 6 * 3600


def _latest_av_series(raw: dict) -> dict:
    data = raw.get("data", []) if isinstance(raw, dict) else []
    latest = data[0] if data else {}
    return {"value": latest.get("value"), "date": latest.get("date"),
            "unit": raw.get("unit"), "name": raw.get("name")}


def commodity(name: str) -> dict:
    """Brent/WTI/NatGas/Copper via AV dedicated functions; GOLD via GLD proxy.
    yfinance fallback if the AV path fails (not only on AV error-messages)."""
    up = name.upper()
    key = cache_key("av", "commodity", {"t": up}, TTL_COMMODITY)

    def fetch():
        if up in COMMODITY_AV_FN:
            try:
                raw = _call({"function": COMMODITY_AV_FN[up], "interval": "daily"})
                if isinstance(raw, dict) and "data" in raw:
                    return make_record("alphavantage", "commodity", {"raw": raw, **_latest_av_series(raw)}, entity_id=up)
            except Exception:
                pass  # fall through to yfinance
        elif up == "GOLD":
            try:
                raw = _call({"function": "GLOBAL_QUOTE", "symbol": "GLD"})
                if isinstance(raw, dict) and "Global Quote" in raw:
                    return make_record("alphavantage", "commodity", raw, entity_id=up)
            except Exception:
                pass
        # fallback: yfinance proxy symbols from tickers.json
        from backend.providers import yfinance_provider

        return yfinance_provider.quote(up)

    return get_or_fetch(key, TTL_COMMODITY, fetch)
