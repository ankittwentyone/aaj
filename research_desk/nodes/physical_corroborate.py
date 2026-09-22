"""physical_corroborate — AIS anomaly (most-anomalous box, not hardcoded) + EIA + FRED."""
from __future__ import annotations


def physical_corroborate(state: dict) -> dict:
    from research_desk.nodes._util import now, trace_entry

    started = now()
    asset = (state.get("asset") or "").upper()
    trace = list(state.get("trace", []))
    signal: dict = {}
    try:
        from backend.providers import aisstream

        anom = aisstream.most_anomalous()
        signal["most_anomalous_chokepoint"] = anom.get("entity_id") if isinstance(anom, dict) else None
        signal["anomaly"] = anom.get("payload") if isinstance(anom, dict) else anom
        trace.append(trace_entry("physical_corroborate", "done", started_at=started, finished_at=now(),
                                 chokepoint=signal["most_anomalous_chokepoint"]))
    except Exception as e:
        signal["anomaly"] = {"status": "skipped", "reason": str(e)}
        trace.append(trace_entry("physical_corroborate", "skipped", started_at=started, finished_at=now(), reason=str(e)))
    # EIA for energy queries only; FRED macro baseline — both best-effort
    if asset in ("BRENT", "WTI", "NATGAS"):
        try:
            from backend.providers import eia

            signal["eia"] = eia.series("WTTSTUS1")
        except Exception as e:
            signal["eia"] = {"status": "skipped", "reason": str(e)}
    try:
        from backend.providers import fred

        signal["fred_10y"] = fred.series("DGS10")
    except Exception as e:
        signal["fred_10y"] = {"status": "skipped", "reason": str(e)}
    ev = [v for v in signal.values() if isinstance(v, dict)]
    return {"physical_signal": signal,
            "evidence": [*state.get("evidence", []), *ev],
            "trace": trace}
