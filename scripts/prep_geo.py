"""One-time static geo build — pre-ingested ONCE and committed (no live queries ever).

Sources: OSM Overpass (harbours in the 5 bboxes), OurAirports (large/medium
airports near boxes), OpenFlights (routes between them), hand-drawn Hormuz /
Malacca TSS centerlines (marked approximate). Every fetch has a curated
fallback so the script never leaves the map empty. Stdlib only.
"""
from __future__ import annotations

import csv
import io
import json
import pathlib
import sys
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

GEO = pathlib.Path(__file__).resolve().parents[1] / "backend" / "data" / "geo"
CUR = pathlib.Path(__file__).resolve().parents[1] / "backend" / "data" / "curated"

MARGIN = 4.0  # degrees of padding around boxes for airport context

# Fallback major seaports (name, lat, lon) if Overpass is unreachable.
FALLBACK_PORTS = [
    ("Jebel Ali", 25.01, 55.06), ("Fujairah", 25.12, 56.34), ("Bandar Abbas", 27.14, 56.07),
    ("Djibouti", 11.59, 43.15), ("Aden", 12.77, 45.03), ("Port Said", 31.27, 32.30),
    ("Suez (Adabiya)", 29.93, 32.55), ("Singapore", 1.26, 103.82), ("Port Klang", 2.99, 101.39),
    ("Cristobal", 9.35, -79.89), ("Balboa", 8.79, -79.56), ("Colombo", 6.95, 79.83),
]

# Approximate TSS centerlines (public traffic-separation directions, NOT for navigation).
TSS = [
    {"name": "Hormuz TSS eastbound", "coords": [[56.0, 26.55], [56.45, 26.35], [56.9, 26.2]]},
    {"name": "Hormuz TSS westbound", "coords": [[56.9, 26.05], [56.45, 26.2], [56.0, 26.4]]},
    {"name": "Malacca TSS", "coords": [[98.5, 4.5], [100.0, 3.0], [101.5, 2.3], [103.5, 1.3]]},
]


def _get(url: str, timeout: int = 60, data: bytes | None = None) -> str:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "market-terminal-prep/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def boxes() -> list[dict]:
    return json.loads((CUR / "chokepoints.json").read_text())


def fetch_ports(bs: list[dict]) -> list[dict]:
    """ONE combined Overpass query for all boxes (fast); curated fallback on failure."""
    parts = []
    for b in bs:
        (la1, lo1), (la2, lo2) = b["bbox"]
        s = f"{min(la1,la2)},{min(lo1,lo2)},{max(la1,la2)},{max(lo1,lo2)}"
        parts.append(f"node['harbour']({s});node['seamark:type'='harbour']({s});")
    q = "[out:json][timeout:60];(" + "".join(parts) + ");out;"
    try:
        data = json.loads(_get("https://overpass-api.de/api/interpreter", data=q.encode(), timeout=90))
        feats = []
        for el in data.get("elements", []):
            feats.append({"type": "Feature", "properties": {"name": (el.get("tags") or {}).get("name", "harbour")},
                          "geometry": {"type": "Point", "coordinates": [el["lon"], el["lat"]]}})
        if feats:
            return feats
        print("  overpass returned 0 harbours; using fallback ports")
    except Exception as e:
        print(f"  overpass failed ({e}), using fallback ports")
    return [{"type": "Feature", "properties": {"name": n, "fallback": True},
             "geometry": {"type": "Point", "coordinates": [lo, la]}} for n, la, lo in FALLBACK_PORTS]


def fetch_airports(bs: list[dict]) -> tuple[list[dict], dict[str, tuple]]:
    print("fetching OurAirports airports.csv ...")
    rows = list(csv.DictReader(io.StringIO(_get("https://davidmegginson.github.io/ourairports-data/airports.csv"))))
    feats, coords = [], {}
    for r in rows:
        try:
            if r["type"] not in ("large_airport", "medium_airport"):
                continue
            la, lo = float(r["latitude_deg"]), float(r["longitude_deg"])
        except Exception:
            continue
        for b in bs:
            (a1, o1), (a2, o2) = b["bbox"]
            if min(a1, a2) - MARGIN <= la <= max(a1, a2) + MARGIN and min(o1, o2) - MARGIN <= lo <= max(o1, o2) + MARGIN:
                feats.append({"type": "Feature", "properties": {"name": r["name"], "iata": r["iata_code"], "box": b["id"]},
                              "geometry": {"type": "Point", "coordinates": [lo, la]}})
                # OpenFlights routes.dat keys by varying code types — index them all.
                for code in (r["ident"], r["gps_code"], r["iata_code"], r["local_code"]):
                    if code:
                        coords[code.strip()] = (lo, la)
                break
    return feats, coords


def fetch_routes(coords: dict) -> list[dict]:
    print("fetching OpenFlights routes.dat ...")
    feats, seen = [], set()
    for line in _get("https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat").splitlines():
        parts = line.split(",")
        if len(parts) < 6:
            continue
        src, dst = parts[2].strip(), parts[4].strip()
        if src in coords and dst in coords and (src, dst) not in seen:
            seen.add((src, dst))
            feats.append({"type": "Feature", "properties": {"src": src, "dst": dst},
                          "geometry": {"type": "LineString", "coordinates": [list(coords[src]), list(coords[dst])]}})
    return feats


def main() -> None:
    GEO.mkdir(parents=True, exist_ok=True)
    bs = boxes()
    print("fetching OSM harbours ...")
    (GEO / "ports.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": fetch_ports(bs)}))
    try:
        afeats, coords = fetch_airports(bs)
        rfeats = fetch_routes(coords)
    except Exception as e:
        print(f"  airports/routes failed ({e}); writing empty routes layer")
        afeats, rfeats = [], []
    (GEO / "routes.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": rfeats,
                                                     "_airports_near_boxes": len(afeats)}))
    (GEO / "tss_lanes.geojson").write_text(json.dumps({
        "type": "FeatureCollection", "_note": "approximate centerlines, NOT for navigation",
        "features": [{"type": "Feature", "properties": {"name": t["name"], "approximate": True},
                      "geometry": {"type": "LineString", "coordinates": t["coords"]}} for t in TSS]}))
    print(f"done -> {GEO}")


if __name__ == "__main__":
    main()
