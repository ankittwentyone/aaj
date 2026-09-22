"""Faithful MOCK replay: warm_cache.py records RAW provider responses live;
in MOCK_MODE providers serve the recording instead of degraded stubs.
Record with MOCK_MODE=false, replay with MOCK_MODE=true (zero quota)."""
from __future__ import annotations

import hashlib
import json
import pathlib

_FILE = pathlib.Path(__file__).resolve().parents[1] / "data" / "warm_cache.json"
_blob: dict | None = None
_loaded = False


def replay_mode() -> bool:
    import os

    return os.environ.get("MOCK_MODE", "").lower() == "true"


def key(params: dict) -> str:
    clean = {k: v for k, v in (params or {}).items() if k not in ("api_key", "apikey")}
    return hashlib.md5(json.dumps(clean, sort_keys=True, default=str).encode()).hexdigest()[:16]


def _blob_data() -> dict:
    global _blob, _loaded
    if not _loaded:
        _loaded = True
        try:
            _blob = json.loads(_FILE.read_text())
        except Exception:
            _blob = {}
    return _blob or {}


def lookup(section: str, params: dict) -> dict | list | None:
    rec = _blob_data().get("records", {}).get(section, {})
    return rec.get(f"{key(params)}")


def record_key(section: str, params: dict) -> str:
    return key(params)
