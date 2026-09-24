"""Routes — split into routes_*.py only past ~300 lines; single file until then."""
from __future__ import annotations

from fastapi import APIRouter, WebSocket

router = APIRouter()


@router.get("/api/market-home")
def market_home():
    from backend.services import market_home_service

    return market_home_service.get_home()


@router.get("/api/asset/{ticker}")
def asset(ticker: str):
    from backend.services import asset_service

    return asset_service.get_asset(ticker.upper())


@router.get("/api/events")
def events(q: str = "oil markets geopolitics", num: int = 20):
    from backend.services import events_service

    return events_service.get_events(q, num)


@router.get("/api/events/{event_id}/chain")
def event_chain(event_id: str):
    from backend.services import events_service

    return events_service.get_event_chain(event_id)


@router.get("/api/cross-market")
def cross_market():
    from backend.services import cross_market_service

    return cross_market_service.get_matrix()


@router.post("/api/cross-market/simulate")
def simulate(body: dict):
    from backend.services import cross_market_service

    return cross_market_service.simulate(body.get("shock_asset", "BRENT"), float(body.get("shock_value", 10)))


@router.get("/api/map")
def map_all():
    from backend.services import map_service

    return map_service.get_all_maps()


@router.get("/api/map/layers/{feed}")
def map_layer(feed: str):
    """Cheap map toggles (no new screens): weather/disaster/aviation dots."""
    from backend.services import layers_service

    return layers_service.get_layer(feed)


@router.get("/api/map/{chokepoint_id}")
def map_one(chokepoint_id: str):
    from backend.services import map_service

    return map_service.get_map(chokepoint_id)


@router.get("/api/map/{chokepoint_id}/history")
def map_history(chokepoint_id: str, hours: int = 720):
    """Traffic counts + crossings per hour (mini-chart + 30-day playback)."""
    from backend.services import map_service

    return map_service.get_history(chokepoint_id, hours)


@router.get("/api/search")
def search(q: str, limit: int = 8):
    """Command-palette index: tickers + chokepoints + curated chains. No new fetch."""
    from backend.services import search_service

    return search_service.search(q, limit)


@router.get("/api/geo/{layer}")
def geo(layer: str):
    """Static committed geo layers. Never a live provider."""
    import json
    import pathlib

    base = pathlib.Path(__file__).resolve().parents[1] / "data"
    targets = {"ports": base / "geo" / "ports.geojson",
               "routes": base / "geo" / "routes.geojson",
               "tss_lanes": base / "geo" / "tss_lanes.geojson",
               "trade_arcs": base / "curated" / "trade_arcs.json"}
    if layer not in targets:
        return {"error": f"unknown layer {layer}", "layers": sorted(targets)}
    try:
        blob = json.loads(targets[layer].read_text())
        if layer == "trade_arcs":
            return {"type": "ArcCollection", "arcs": blob}
        return blob
    except Exception as e:
        return {"type": "FeatureCollection", "features": [], "status": "skipped", "reason": str(e)}


@router.websocket("/ws/map/{chokepoint_id}")
async def ws_map(ws: WebSocket, chokepoint_id: str):
    """Delta-only live diffs at 2/sec, cap ~2000 vessels. First frame is full."""
    import asyncio
    import json

    await ws.accept()
    prev: dict[str, tuple] = {}
    first = True
    try:
        while True:
            from backend.services import map_service

            data = map_service.get_map(chokepoint_id)
            cur = {p["mmsi"]: (p["lat"], p["lon"], p.get("sog", 0), p.get("cog", 0))
                   for p in data.get("positions", [])[:2000] if "mmsi" in p}
            if first:
                await ws.send_text(json.dumps({"type": "snapshot", "id": chokepoint_id, "data": data}))
                first = False
            else:
                added = [m for m in cur if m not in prev]
                removed = [m for m in prev if m not in cur]
                moved = [m for m in cur if m in prev and (abs(cur[m][0] - prev[m][0]) > 1e-4 or abs(cur[m][1] - prev[m][1]) > 1e-4)]
                if added or removed or moved:
                    await ws.send_text(json.dumps({
                        "type": "diff", "id": chokepoint_id,
                        "added": [{**next(p for p in data["positions"] if p.get("mmsi") == m)} for m in added],
                        "updated": [{"mmsi": m, "lat": cur[m][0], "lon": cur[m][1], "sog": cur[m][2], "cog": cur[m][3]} for m in moved],
                        "removed": removed,
                        "count": data.get("count"), "pct_change": data.get("pct_change"), "stale": data.get("stale"),
                    }))
            prev = cur
            await asyncio.sleep(0.5)
    except Exception:
        try:
            await ws.close()
        except Exception:
            pass
