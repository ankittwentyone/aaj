"""Cheap map-layer toggles (no new screens, no new routes beyond one endpoint).

Feeds: Open-Meteo marine/weather at chokepoint centers, USGS earthquakes,
GDACS disaster alerts. All keyless, cached for tens of minutes. OpenSky
skipped (now requires OAuth — friction outweighs a toggle dot).
"""
from __future__ import annotations

import os

import requests

from backend.cache.cache import cache_key, get_or_fetch
from backend.models.source_record import make_record

TTL = 30 * 60


def _centers() -> dict[str, tuple[float, float]]:
    import json
    import pathlib

    p = pathlib.Path(__file__).resolve().parents[1] / "data" / "curated" / "chokepoints.json"
    out = {}
    for r in json.loads(p.read_text()):
        (la1, lo1), (la2, lo2) = r["bbox"]
        out[r["id"]] = ((la1 + la2) / 2, (lo1 + lo2) / 2)
    return out


def _mock(feed: str) -> dict | None:
    from backend.cache.replay import lookup, replay_mode

    if not replay_mode():
        return None
    rec = lookup("layers", {"feed": feed})
    if rec is not None:
        return make_record("layers", feed, rec, entity_id=feed)
    return make_record("layers", feed, {"mock": True, "unrecorded": True, "dots": []}, entity_id=feed)


def weather() -> dict:
    m = _mock("weather")
    if m is not None:
        return m
    key = cache_key("layers", "weather", {"v": 1}, TTL)

    def fetch():
        dots = []
        for cid, (la, lo) in _centers().items():
            try:
                r = requests.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={"latitude": la, "longitude": lo, "current": "wind_speed_10m,weather_code"},
                    timeout=15,
                )
                r.raise_for_status()
                cur = r.json().get("current", {})
                dots.append({"chokepoint_id": cid, "lat": la, "lon": lo, **cur})
            except Exception as e:
                dots.append({"chokepoint_id": cid, "lat": la, "lon": lo, "status": "skipped", "reason": str(e)})
        return make_record("layers", "weather", {"dots": dots}, entity_id="all")

    return get_or_fetch(key, TTL, fetch)


def earthquakes(days: int = 7, min_mag: float = 4.5) -> dict:
    m = _mock("earthquakes")
    if m is not None:
        return m
    key = cache_key("layers", "earthquakes", {"d": days, "m": min_mag}, TTL)

    def fetch():
        r = requests.get(
            "https://earthquake.usgs.gov/fdsnws/event/1/query",
            params={"format": "geojson", "starttime": f"{days * -1}days", "minmagnitude": min_mag, "limit": 100},
            timeout=15,
        )
        r.raise_for_status()
        feats = r.json().get("features", [])
        dots = [{"lat": f["geometry"]["coordinates"][1], "lon": f["geometry"]["coordinates"][0],
                 "mag": f["properties"].get("mag"), "place": f["properties"].get("place")}
                for f in feats if f.get("geometry")]
        return make_record("layers", "earthquakes", {"dots": dots}, entity_id="all")

    return get_or_fetch(key, TTL, fetch)


def disasters() -> dict:
    m = _mock("disasters")
    if m is not None:
        return m
    key = cache_key("layers", "disasters", {"v": 1}, TTL)

    def fetch():
        import xml.etree.ElementTree as ET

        try:
            r = requests.get("https://www.gdacs.org/xml/rss.xml", timeout=15)
            r.raise_for_status()
            items = []
            for it in ET.fromstring(r.content).iter("item"):
                items.append({"title": (it.findtext("title") or "")[:160], "link": it.findtext("link")})
            return make_record("layers", "disasters", {"dots": [], "alerts": items[:30]}, entity_id="all")
        except Exception as e:
            return make_record("layers", "disasters", {"status": "skipped", "reason": str(e)}, entity_id="all")

    return get_or_fetch(key, TTL, fetch)
