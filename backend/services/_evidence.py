"""Standard evidence envelopes for hover cards: every number/claim carries
{provider, dataset, source_url, retrieved_at}. Services attach top-level
`evidence: [...]` built ONLY from SourceRecords (skips + static notes filtered
into `provenance` instead)."""
from __future__ import annotations


def summarize(rec: object) -> dict | None:
    if not isinstance(rec, dict):
        return None
    if "provider" not in rec or "retrieved_at" not in rec:
        return None
    return {
        "provider": rec.get("provider"),
        "dataset": rec.get("dataset"),
        "entity": rec.get("entity_id"),
        "query": rec.get("query"),
        "source_url": rec.get("source_url"),
        "retrieved_at": rec.get("retrieved_at"),
    }


def collect(*items: object) -> list[dict]:
    out: list[dict] = []
    seen: set[tuple] = set()

    def add(rec: object) -> None:
        s = summarize(rec)
        if s is None:
            return
        k = (s["provider"], s["dataset"], s["entity"], s["query"], s["source_url"])
        if k in seen:
            return
        seen.add(k)
        out.append(s)

    for it in items:
        if isinstance(it, list):
            for r in it:
                add(r)
        elif isinstance(it, dict):
            add(it)
    return out


def static_note(source: str, detail: str = "") -> dict:
    """Provenance for curated-static inputs (matrix, chains, seeds)."""
    return {"provider": "curated", "dataset": source, "entity": None,
            "query": None, "source_url": None, "retrieved_at": None, "note": detail}
