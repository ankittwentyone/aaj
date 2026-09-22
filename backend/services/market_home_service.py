"""Market Home service — spec §5. Aggregates only; no new fetches for anomaly strip."""
from __future__ import annotations


def get_home() -> dict:
    from backend.providers import aisstream, alphavantage, fred, serpapi

    def safe(fn, *a, **k):
        try:
            return fn(*a, **k)
        except Exception as e:
            return {"status": "skipped", "reason": str(e)}

    def is_skipped(rec) -> bool:
        return isinstance(rec, dict) and rec.get("status") == "skipped"

    def quote_or_fallback(ticker: str) -> dict:
        """AV primary; yfinance fallback on ANY AV failure (not just error-messages)."""
        q = safe(alphavantage.quote, ticker)
        if is_skipped(q) or (isinstance(q, dict) and q.get("payload", {}).get("Error Message")):
            from backend.providers import yfinance_provider

            q = safe(yfinance_provider.quote, ticker)
        return q

    indices = {t: quote_or_fallback(t) for t in ("SPX", "NDX")}
    commodities = {t: safe(alphavantage.commodity, t) for t in ("BRENT", "WTI", "GOLD", "COPPER", "NATGAS")}
    fx = {t: safe(alphavantage.fx_rate, t) for t in ("EURUSD", "USDINR")}
    crypto = {t: quote_or_fallback(t) for t in ("BTC", "ETH")}
    # US10Y: FRED DGS10 primary (actual yield), AV TNX proxy as backup.
    rates = safe(fred.series, "DGS10")
    if is_skipped(rates):
        rates = safe(alphavantage.quote, "US10Y")
    try:
        ticker_news = serpapi.google_news("markets today", num=8)
    except Exception as e:
        ticker_news = [{"status": "skipped", "reason": str(e)}]
    try:
        max_box = aisstream.most_anomalous()
    except Exception as e:
        max_box = {"status": "skipped", "reason": str(e)}

    # anomaly strip: price delta + news volume + trends + max chokepoint delta.
    # Price/trends deltas are best-effort here; asset screen computes per-asset verdict.
    anomaly_strip = {
        "max_chokepoint_anomaly": max_box if isinstance(max_box, dict) else {},
        "news_count": len(ticker_news) if isinstance(ticker_news, list) else 0,
        "note": "price/trends deltas join per-asset; strip aggregates already-computed signals",
    }
    from backend.services._evidence import collect, static_note

    evidence = collect(*indices.values(), *commodities.values(), *fx.values(),
                       *crypto.values(), rates, ticker_news, max_box)
    evidence.append(static_note("tickers.json", "symbol map: display -> AV/yfinance symbols"))
    return {
        "indices": indices, "fx": fx, "rates": rates,
        "commodities": commodities, "crypto": crypto,
        "event_ticker": ticker_news, "anomaly_strip": anomaly_strip,
        "evidence": evidence,
    }
