"""Single FastAPI process on Render/Railway. No Postgres/Redis/Celery.
Background work = asyncio tasks in lifespan. Research Desk imports services/* in-process.
Start: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
"""
from __future__ import annotations

import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI

from dotenv import load_dotenv

load_dotenv()

from backend.api.routes import router

_ais_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _ais_task
    _ais_task = asyncio.create_task(_run_ais())
    _flush = asyncio.create_task(_periodic_flush())
    _warm = asyncio.create_task(_auto_warm())
    try:
        yield
    finally:
        for t in (_ais_task, _flush, _warm):
            if t:
                t.cancel()
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await t


async def _auto_warm():
    """Background auto-warm: seed DB + pre-fill TTL cache if cold. Never blocks boot."""
    try:
        await asyncio.to_thread(_ensure_warm_sync)
    except Exception:
        pass


def _ensure_warm_sync():
    try:
        from backend.services import warmup

        warmup.ensure_warm()
    except Exception as e:
        print(f"warmup: disabled: {e}", flush=True)


async def _run_ais():
    try:
        from backend.providers import aisstream

        await aisstream.run_ais_manager()
    except Exception:
        pass


async def _periodic_flush():
    import asyncio as _a

    from backend.providers import aisstream

    n = 0
    while True:
        await _a.sleep(60)
        try:
            aisstream.flush_positions()
            n += 1
            if n % 60 == 0:
                aisstream.rollup_hour()
        except Exception:
            pass


app = FastAPI(title="AI-Native Market Intelligence Terminal", lifespan=lifespan)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # single-process local terminal; tighten if ever deployed multi-origin
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)

# Research Desk (agentic) — mounted BEFORE static so /api/research/* is reachable.
# Lazy import: backend stays up even if langgraph/langchain-groq are absent.
try:
    from research_desk.stream import router as _research_router

    app.include_router(_research_router)
except Exception as _e:  # pragma: no cover
    print(f"research_desk disabled: {_e}")


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/readyz")
def readyz():
    import pathlib

    from backend.cache.cache import cache_size
    from backend.providers.aisstream import is_alive
    from backend.services import warmup

    db = pathlib.Path(__file__).resolve().parent / "data" / "chokepoints.db"
    return {"db_exists": db.exists(), "cache_size": cache_size(), "ais_task": is_alive(),
            "warming": warmup.STATUS["warming"], "warmed_at": warmup.STATUS["warmed_at"],
            "warm_error": warmup.STATUS["warm_error"], "warm_services": warmup.STATUS["services"],
            "mock_mode": warmup.mock_mode(), "recording_present": warmup.recording_present()}


# Simple MVP frontend (static SPA). Mounted LAST so /api/* routes take precedence.
import pathlib as _pl

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

_FRONTEND = _pl.Path(__file__).resolve().parents[1] / "frontend"
_INDEX = _FRONTEND / "index.html"

# SPA fallback — MUST be registered BEFORE the StaticFiles mount below.
# StaticFiles(html=True) only serves `/` + real files; client routes like
# /map, /asset/BRENT, /events, /cross-market, /research all 404'd without this.
# /api/*, /ws/*, /healthz, /readyz, /docs, /openapi.json match earlier routes
# first, so this only fires for unmatched frontend paths.
if _FRONTEND.exists():

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        # Real file (assets, favicon, warm_cache.json...) → serve it directly.
        target = (_FRONTEND / full_path) if full_path else _INDEX
        try:
            if full_path and target.is_file():
                return FileResponse(str(target))
        except Exception:
            pass
        # Extensionless client route (/map, /asset/X, /events, ...) → SPA shell.
        # Dotted paths that aren't real files (e.g. /favicon.svg missing) → 404.
        name = full_path.rsplit("/", 1)[-1] if full_path else "index.html"
        if full_path and "." in name:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Not Found")
        if _INDEX.is_file():
            return FileResponse(str(_INDEX))
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Not Found")

    app.mount("/", StaticFiles(directory=str(_FRONTEND), html=True), name="frontend")
