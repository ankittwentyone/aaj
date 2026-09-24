"""Normalize OHLCV rows for frontend lightweight-charts."""
from __future__ import annotations


def parse_av_time_series(raw: dict) -> list[dict]:
    if not isinstance(raw, dict):
        return []
    series = None
    for key, val in raw.items():
        if "Time Series" in str(key) and isinstance(val, dict):
            series = val
            break
    if not series:
        return []
    rows: list[dict] = []
    for date_str, vals in series.items():
        if not isinstance(vals, dict):
            continue
        try:
            rows.append(
                {
                    "ts": date_str[:10],
                    "open": float(vals.get("1. open", vals.get("open", 0))),
                    "high": float(vals.get("2. high", vals.get("high", 0))),
                    "low": float(vals.get("3. low", vals.get("low", 0))),
                    "close": float(vals.get("4. close", vals.get("close", 0))),
                    "volume": float(vals.get("5. volume", vals.get("volume", 0) or 0)),
                }
            )
        except (TypeError, ValueError):
            continue
    rows.sort(key=lambda r: r["ts"])
    return rows


def dataframe_to_rows(df) -> list[dict]:
    rows: list[dict] = []
    try:
        for idx, row in df.iterrows():
            ts = idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)[:10]
            rows.append(
                {
                    "ts": ts,
                    "open": float(row.get("Open", row.get("open", 0))),
                    "high": float(row.get("High", row.get("high", 0))),
                    "low": float(row.get("Low", row.get("low", 0))),
                    "close": float(row.get("Close", row.get("close", 0))),
                    "volume": float(row.get("Volume", row.get("volume", 0) or 0)),
                }
            )
    except Exception:
        return []
    return rows
