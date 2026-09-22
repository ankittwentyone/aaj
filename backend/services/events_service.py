"""Events service — SerpApi news clustered by simple similarity; curated chain JSON."""
from __future__ import annotations

import json
import pathlib
import re


def _chain_map() -> dict:
    p = pathlib.Path(__file__).resolve().parents[1] / "data" / "curated" / "event_chain.json"
    return json.loads(p.read_text())


def _tokens(s: str) -> set[str]:
    return set(re.findall(r"[a-z]{4,}", s.lower()))


def get_events(query: str = "oil markets geopolitics", num: int = 20) -> dict:
    from backend.providers import serpapi

    try:
        items = serpapi.google_news(query, num=num)
    except Exception as e:
        return {"clusters": [], "status": "skipped", "reason": str(e)}
    clusters: list[dict] = []
    for it in items if isinstance(items, list) else []:
        p = it.get("payload", {}) if isinstance(it, dict) else {}
        title = p.get("title", "")
        toks = _tokens(title)
        placed = False
        for c in clusters:
            if len(toks & _tokens(c["title"])) >= 2:
                c["items"].append(it)
                placed = True
                break
        if not placed:
            clusters.append({"title": title, "items": [it], "chokepoint_ids": [], "lat": None, "lon": None})
    # tag obvious chokepoint mentions for map overlay
    tags = {"hormuz": "hormuz", "suez": "suez", "panama": "panama", "malacca": "malacca", "bab el-mandeb": "bab-el-mandeb", "bab-el-mandeb": "bab-el-mandeb"}
    centers = _chokepoint_centers()
    for c in clusters:
        t = c["title"].lower()
        c["chokepoint_ids"] = [v for k, v in tags.items() if k in t]
        # anchor map event dots at tagged chokepoint centroids (cheap geocode)
        c["lat"] = centers.get(c["chokepoint_ids"][0], (None, None))[0] if c["chokepoint_ids"] else None
        c["lon"] = centers.get(c["chokepoint_ids"][0], (None, None))[1] if c["chokepoint_ids"] else None
    # "what people are asking" — one cheap autocomplete call per events query (§5)
    try:
        asking = serpapi.google_autocomplete(f"{query} ")
        asking_payload = asking.get("payload", {}) if isinstance(asking, dict) else {}
        suggestions = asking_payload.get("suggestions", asking_payload)
    except Exception:
        asking, suggestions = {"status": "skipped"}, []
    from backend.services._evidence import collect, static_note

    evidence = collect(items, asking)
    evidence.append(static_note("event_chain.json", "curated event->commodity->sector->company map"))
    return {"clusters": clusters[:10], "count": len(clusters),
            "what_people_are_asking": suggestions, "evidence": evidence}


def _chokepoint_centers() -> dict:
    """bbox centers for anchoring event dots; config-driven, no hardcoded coords."""
    try:
        rows = json.loads((pathlib.Path(__file__).resolve().parents[1] / "data" / "curated" / "chokepoints.json").read_text())
        out = {}
        for r in rows:
            (la1, lo1), (la2, lo2) = r["bbox"]
            out[r["id"]] = ((la1 + la2) / 2, (lo1 + lo2) / 2)
        return out
    except Exception:
        return {}


def get_event_chain(event_id: str) -> dict:
    m = _chain_map()
    # event_id may be a category or cluster title; match loosely
    key = event_id.lower()
    for cat, chain in m.items():
        if cat in key:
            return {"event_id": event_id, "category": cat, **chain}
    d = m.get("default", {})
    # guess category by keyword
    for kw in ("opec", " Hormuz".lower(), "suez", "strike", "sanction"):
        if kw.strip() in key:
            g = m.get("geopolitical", d)
            return {"event_id": event_id, "category": "geopolitical", **g}
    return {"event_id": event_id, "category": "default", **d}
