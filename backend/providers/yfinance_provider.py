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
            fi = tk.fast_info
            # fast_info keys are camelCase (lastPrice, previousClose); be tolerant.
            def _g(*names):
                for n in names:
                    try:
                        v = fi.get(n)
                    except Exception:
                        v = None
                    if v is not None:
                        return v
                return None
            info = {"price": _g("last_price", "lastPrice", "regularMarketPrice"),
                    "prev_close": _g("previous_close", "previousClose", "regularMarketPreviousClose")}
        except Exception as e:
            info = {"error": str(e)}
        return make_record("yfinance", "quote", info, entity_id=ticker)

    return get_or_fetch(key, TTL, fetch)


def _normalize_range(range_: str) -> str:
    """Map UI/AV ranges ('1m','3m','6m') to yfinance periods ('1mo','3mo','6mo')."""
    alias = {"1m": "1mo", "3m": "3mo", "6m": "6mo"}
    r = (range_ or "3mo").strip()
    return alias.get(r, r)


def historical(ticker: str, range_: str = "3mo") -> dict:
    sym = _yf(ticker)
    range_ = _normalize_range(range_)
    key = cache_key("yf", "historical", {"t": sym, "r": range_}, 4 * 3600)

    def fetch():
        import yfinance as yf

        from backend.providers.chart_rows import dataframe_to_rows

        df = yf.Ticker(sym).history(period=range_)
        rows = dataframe_to_rows(df) if df is not None and len(df) else []
        return make_record(
            "yfinance",
            "historical",
            {"rows": rows, "tail": rows[-5:] if rows else []},
            entity_id=ticker,
        )

    return get_or_fetch(key, 4 * 3600, fetch)
