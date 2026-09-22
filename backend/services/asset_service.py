"""Asset service — spec §5. Physical-vs-Narrative = normalized comparison, NOT an LLM call."""
from __future__ import annotations


def _pct(a: float | None, b: float | None) -> float | None:
    try:
        if a is None or b in (None, 0):
            return None
        return round((a - b) / abs(b) * 100, 2)
    except Exception:
        return None


def get_asset(ticker: str) -> dict:
    from backend.providers import aisstream, alphavantage, sec, serpapi, yfinance_provider

    def safe(fn, *a, **k):
        try:
            return fn(*a, **k)
        except Exception as e:
            return {"status": "skipped", "reason": str(e)}

    q = safe(alphavantage.quote, ticker)
    # yfinance fallback on ANY AV failure (missing key, rate limit, error-message).
    if isinstance(q, dict) and (q.get("status") == "skipped" or q.get("payload", {}).get("Error Message")):
        q = safe(yfinance_provider.quote, ticker)
    chart = safe(alphavantage.historical, ticker, "3m")
    fund = safe(alphavantage.fundamentals, ticker)
    filings = safe(sec.filings, ticker)
    insider = safe(sec.insider, ticker)
    news = safe(serpapi.google_news, f"{ticker} stock", num=10)
    trends = safe(serpapi.google_trends, ticker)
    asking = safe(serpapi.google_autocomplete, f"why is {ticker} ")

    # Physical-vs-Narrative panel inputs (deterministic deltas)
    price_delta = None
    try:
        payload = q.get("payload", {}) if isinstance(q, dict) else {}
        qr = payload.get("Global Quote", payload)
        price = float(qr.get("05. price", qr.get("price", 0)) or 0)
        prev = float(qr.get("08. previous close", qr.get("prev_close", 0)) or 0)
        price_delta = _pct(price, prev) if price and prev else None
    except Exception:
        pass
    trends_payload = trends.get("payload", {}) if isinstance(trends, dict) else {}
    rising = trends_payload.get("rising_queries") or trends_payload.get("related_queries", {}).get("rising", [])
    regional = trends_payload.get("geo") or trends_payload.get("interest_by_region", [])
    try:
        phys = aisstream.most_anomalous()
        phys_delta = phys.get("payload", {}).get("pct_change")
    except Exception:
        phys, phys_delta = {}, None

    # Simple verdict: compare magnitudes, no LLM
    verdict = "NEUTRAL"
    if price_delta is not None and phys_delta is not None:
        if abs(price_delta) >= 2 and abs(phys_delta) >= 10:
            verdict = "PHYSICAL" if abs(phys_delta) >= abs(price_delta) * 3 else "NARRATIVE-LED"
        elif abs(price_delta) >= 2:
            verdict = "NARRATIVE-LED"
    from backend.services._evidence import collect

    evidence = collect(q, chart, fund, filings, insider, news, trends, asking, phys)
    return {
        "ticker": ticker, "quote": q, "chart": chart, "fundamentals": fund,
        "filings": filings, "insider": insider, "news_timeline": news,
        "trends": trends,
        "physical_vs_narrative": {"price_delta_pct": price_delta, "physical_delta_pct": phys_delta, "verdict": verdict},
        "rising_queries_badge": rising[:5] if isinstance(rising, list) else rising,
        "regional_interest_strip": regional[:5] if isinstance(regional, list) else regional,
        "what_people_are_asking": asking,
        "physical corroboration": phys,
        "evidence": evidence,
    }
