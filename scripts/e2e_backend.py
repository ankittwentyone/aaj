"""E2E backend + agent verification (quota-safe, replay-first).
Run: MOCK_MODE=true python scripts/e2e_backend.py  (default, zero quota)
Live (budgeted, single pass): MOCK_MODE=false python scripts/e2e_backend.py --live
Asserts SHAPE + evidence, not values. Seed counts allowed only with stale:true.
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv

load_dotenv()

LIVE = "--live" in sys.argv
if not LIVE:
    os.environ["MOCK_MODE"] = "true"

FAIL = []


def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name} {detail}")
    if not cond:
        FAIL.append(name)


def is_skipped(rec):
    return isinstance(rec, dict) and rec.get("status") == "skipped"


def has_evidence(obj):
    return isinstance(obj, dict) and isinstance(obj.get("evidence"), list) and len(obj["evidence"]) > 0


def main():
    from fastapi.testclient import TestClient

    from backend.main import app

    c = TestClient(app)
    # 1. healthz / readyz
    r = c.get("/healthz")
    check("healthz", r.status_code == 200 and r.json().get("ok") is True)
    r = c.get("/readyz")
    j = r.json()
    check("readyz shape", all(k in j for k in ("db_exists", "cache_size", "ais_task")), str(j))
    check("db exists", j.get("db_exists") is True, "run warm_cache backfill if false")

    # 2. market-home
    r = c.get("/api/market-home")
    j = r.json()
    check("market-home 200", r.status_code == 200)
    for k in ("indices", "fx", "rates", "commodities", "crypto", "event_ticker", "anomaly_strip", "evidence"):
        check(f"market-home has {k}", k in j)
    check("market-home evidence", has_evidence(j))
    if LIVE:
        # live: no unrecorded mocks allowed
        txt = json.dumps(j)
        check("market-home live no unrecorded", "unrecorded" not in txt, "quota/keys issue if fail")
    else:
        print("  (replay mode: mocks allowed, warm_cache.json required for full pass)")

    # 3. asset BRENT + AAPL
    for t in ("BRENT", "AAPL"):
        r = c.get(f"/api/asset/{t}")
        j = r.json()
        check(f"asset {t} 200", r.status_code == 200)
        check(f"asset {t} verdict", "physical_vs_narrative" in j and "verdict" in j["physical_vs_narrative"])
        check(f"asset {t} corroboration key", "physical_corroboration" in j and "physical corroboration" not in j)
        check(f"asset {t} evidence", has_evidence(j))

    # 4. events
    r = c.get("/api/events?q=oil&num=5")
    j = r.json()
    check("events shape", "clusters" in j and "evidence" in j)
    r = c.get("/api/events/oil-1/chain")
    check("event chain", r.status_code == 200 and "commodity" in r.json())

    # 5. cross-market
    r = c.get("/api/cross-market")
    j = r.json()
    check("cross-market matrix", "matrix" in j and "BRENT" in j["matrix"])
    r = c.post("/api/cross-market/simulate", json={"shock_asset": "BRENT", "shock_value": 10})
    j = r.json()
    check("simulate exposures", "exposures" in j and len(j["exposures"]) > 0)
    check("simulate chokepoints", "exposed_chokepoints" in j and "hormuz" in j["exposed_chokepoints"])

    # 6. map (seed allowed only with stale:true)
    r = c.get("/api/map")
    j = r.json()
    check("map 5 boxes", isinstance(j, list) and len(j) == 5, f"got {len(j) if isinstance(j,list) else type(j)}")
    for box in j if isinstance(j, list) else []:
        check(f"map {box.get('id')} stale-flag honest", box.get("stale") is True or box.get("count", 0) > 1,
              f"count={box.get('count')} stale={box.get('stale')}")
        check(f"map {box.get('id')} evidence", isinstance(box.get("evidence"), list))
    r = c.get("/api/map/hormuz")
    check("map hormuz", r.status_code == 200 and r.json().get("id") == "hormuz")
    r = c.get("/api/map/hormuz/history?hours=24")
    j = r.json()
    check("map history shape", "counts" in j and "crossings" in j)

    # 7. search + geo + layers
    r = c.get("/api/search?q=BRENT&limit=5")
    check("search BRENT", r.status_code == 200 and len(r.json().get("results", [])) > 0)
    for layer in ("ports", "trade_arcs"):
        r = c.get(f"/api/geo/{layer}")
        check(f"geo {layer}", r.status_code == 200)
    for feed in ("weather", "earthquakes", "disasters"):
        r = c.get(f"/api/map/layers/{feed}")
        check(f"layers {feed}", r.status_code == 200 and "feed" in r.json())

    # 8. DB direct
    import sqlite3

    db = ROOT / "backend" / "data" / "chokepoints.db"
    con = sqlite3.connect(str(db))
    tables = {x[0] for x in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    check("db tables", {"chokepoint", "traffic_hour", "positions_cache", "crossing_hour"} <= tables, str(tables))
    check("db chokepoints 5", con.execute("SELECT COUNT(*) FROM chokepoint").fetchone()[0] == 5)
    con.close()

    # 9. research (agent) — stub passes keyless, live needs langgraph + LLM_API_KEY
    try:
        from research_desk.graph import run  # noqa

        has_graph = True
    except Exception as e:
        has_graph = False
        print(f"  research graph import skipped: {e}")
    if has_graph:
        r = c.post("/api/research/run", json={"query": "Why is BRENT moving?"})
        check("research run 200", r.status_code == 200, r.text[:300])
        if r.status_code == 200:
            j = r.json()
            check("research report", isinstance(j.get("report"), str) and len(j["report"]) > 100)
            check("research trace", isinstance(j.get("trace"), list) and len(j["trace"]) >= 5,
                  f"stages={len(j.get('trace',[]))}")
            # Groq is live even in mock mode (yfinance + LLM are keyless/live);
            # stub only if Groq itself fails (e.g. 429). Assert non-stub in both modes.
            check("research not stub", "stub — no LLM_API_KEY" not in j.get("report", ""),
                  "LLM_API_KEY/groq issue if stub")
            if LIVE:
                check("research live evidence>=10", j.get("evidence_count", 0) >= 10 or len(j.get("trace", [])) >= 7,
                      f"evidence={j.get('evidence_count')}")
    else:
        check("research graph importable", False, "pip install langgraph langchain-groq required")

    # 10. websockets (frontend-critical): map snapshot + research stream
    try:
        with c.websocket_connect("/ws/map/hormuz") as ws:
            msg = json.loads(ws.receive_text())
            check("ws map snapshot", msg.get("type") == "snapshot" and msg.get("id") == "hormuz",
                  f"type={msg.get('type')}")
    except Exception as e:
        check("ws map snapshot", False, str(e)[:200])
    try:
        with c.websocket_connect("/ws/research/e2e") as ws:
            ws.send_text(json.dumps({"query": "Why is BRENT moving?"}))
            stages = []
            final = None
            for _ in range(12):
                msg = json.loads(ws.receive_text())
                if msg.get("final"):
                    final = msg
                    break
                stages.append(msg.get("node"))
            check("ws research stages", len(stages) >= 5, f"stages={stages}")
            check("ws research final", final is not None and isinstance(final.get("report"), str),
                  "no final report")
    except Exception as e:
        check("ws research stream", False, str(e)[:200])

    print()
    if FAIL:
        print(f"E2E FAIL ({len(FAIL)}): {FAIL}")
        sys.exit(1)
    print("E2E ALL PASS")


if __name__ == "__main__":
    main()
