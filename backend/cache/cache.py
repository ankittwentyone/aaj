"""Generic TTL cache: get_or_fetch(key, ttl, fetch_fn).

Key = f"{provider}:{dataset}:{normalized_params}:{time_bucket(ttl)}".
Backing: in-memory dict (background sweep) for API responses.
AIS traffic history lives in SQLite (see providers/aisstream.py), NOT here.
No Redis/Postgres per locked decision §9.4.
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
from collections.abc import Callable
from typing import Any

_store: dict[str, tuple[float, Any]] = {}
_lock = threading.Lock()


def _normalize_params(params: dict | None) -> str:
    if not params:
        return "noparams"
    try:
        raw = json.dumps(params, sort_keys=True, default=str)
    except Exception:
        raw = str(params)
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def cache_key(provider: str, dataset: str, params: dict | None, ttl_seconds: int) -> str:
    bucket = int(time.time() // max(ttl_seconds, 1))
    return f"{provider}:{dataset}:{_normalize_params(params)}:{bucket}"


def get_or_fetch(key: str, ttl_seconds: int, fetch_fn: Callable[[], Any]) -> Any:
    now = time.time()
    with _lock:
        hit = _store.get(key)
        if hit is not None:
            exp, val = hit
            if now < exp:
                return val
    val = fetch_fn()
    with _lock:
        _store[key] = (now + ttl_seconds, val)
        # opportunistic sweep (cheap, amortized)
        if len(_store) > 2000:
            expired = [k for k, (e, _) in _store.items() if e <= now]
            for k in expired:
                _store.pop(k, None)
    return val


def sweep() -> int:
    now = time.time()
    with _lock:
        expired = [k for k, (e, _) in _store.items() if e <= now]
        for k in expired:
            _store.pop(k, None)
        return len(expired)


def cache_size() -> int:
    with _lock:
        return len(_store)


def _sweep_loop(interval: int = 300) -> None:
    while True:
        time.sleep(interval)
        try:
            sweep()
        except Exception:
            pass


_sweeper = threading.Thread(target=_sweep_loop, daemon=True)
_sweeper.start()
