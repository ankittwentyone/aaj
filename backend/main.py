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

# Research Desk is PARKED (agent ships later for stock deep-research only).
# research_desk/ code stays dormant; its routes are intentionally NOT mounted.
# Re-enable by importing research_desk.stream.router here.

_ais_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _ais_task
    _ais_task = asyncio.create_task(_run_ais())
    _flush = asyncio.create_task(_periodic_flush())
    try:
        yield
    finally:
        for t in (_ais_task, _flush):
            if t:
                t.cancel()
                with contextlib.suppress(Exception):
                    await t


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


app = FastAPI(title="AI-Native Market Intelligence Terminal")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # single-process local terminal; tighten if ever deployed multi-origin
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)

# Simple MVP frontend (static SPA). Mounted LAST so /api/* routes take precedence.
import pathlib as _pl

from fastapi.staticfiles import StaticFiles

_FRONTEND = _pl.Path(__file__).resolve().parents[1] / "frontend"
if _FRONTEND.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND), html=True), name="frontend")


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/readyz")
def readyz():
    import pathlib

    from backend.cache.cache import cache_size
    from backend.providers.aisstream import is_alive

    db = pathlib.Path(__file__).resolve().parent / "data" / "chokepoints.db"
    return {"db_exists": db.exists(), "cache_size": cache_size(), "ais_task": is_alive()}
