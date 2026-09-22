"""yfinance — ALWAYS live (free, keyless, no quota), even in MOCK_MODE.
Primary fallback whenever Alpha Vantage fails; never stubbed."""
from __future__ import annotations

from backend.cache.cache import cache_key, get_or_fetch
from backend.models.source_record import make_record

TTL = 600


def _yf(ticker: str) -> str:
    import json
    import pathlib

    p = pathlib.Path(__file__).resolve().parents[1] / "data" / "curated" / "tickers.json"
    t = json.loads(p.read_text())
    return t.get(ticker, {}).get("yf_symbol", ticker)


def quote(ticker: str) -> dict:
    sym = _yf(ticker)
    key = cache_key("yf", "quote", {"t": sym}, TTL)

    def fetch():
        import yfinance as yf

        tk = yf.Ticker(sym)
        info = {}
        try:
            info = {"price": tk.fast_info.get("last_price"), "prev_close": tk.fast_info.get("previous_close")}
        except Exception as e:
            info = {"error": str(e)}
        return make_record("yfinance", "quote", info, entity_id=ticker)

    return get_or_fetch(key, TTL, fetch)


def historical(ticker: str, range_: str = "3mo") -> dict:
    sym = _yf(ticker)
    key = cache_key("yf", "historical", {"t": sym, "r": range_}, 4 * 3600)

    def fetch():
        import yfinance as yf

        df = yf.Ticker(sym).history(period=range_)
        return make_record("yfinance", "historical", {"rows": len(df), "tail": df.tail(5).to_dict() if len(df) else {}}, entity_id=ticker)

    return get_or_fetch(key, 4 * 3600, fetch)
