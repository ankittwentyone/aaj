# AAJ Terminal — Run Guide

One command to build + serve frontend + backend for the hackathon presentation.

> **Judge quickstart (recommended):**
> ```bash
> chmod +x run.sh && ./run.sh --prod
> ```
> Opens the full product at **http://localhost:8000** (single server).
> API docs at **http://localhost:8000/docs**.

---

## 1 · Modes

| Mode | Command | What runs | Frontend URL |
|------|---------|-----------|--------------|
| **prod** (recommended) | `./run.sh --prod` | Builds `frontend/dist/`, shims it through FastAPI `StaticFiles(html=True)` at `/`, starts **one** server on `:8000` | `http://localhost:8000` |
| **dev** | `./run.sh --dev` | Same build + backend `:8000` **plus** Vite dev server `:5173` with proxy (`/api`, `/ws`, `/healthz`, `/readyz` → `:8000`) | `http://localhost:5173` (hot reload) |
| default | `./run.sh` | alias for `--prod` | `http://localhost:8000` |

`--help` prints the same.

### Why two modes?

- **prod** is what the judges should run — one `uvicorn` process, no extra ports, same shape as Render/Railway (`uvicorn backend.main:app --host 0.0.0.0 --port $PORT`). The built bundle is served from `/` via `backend/main.py:101-108`.
- **dev** is for iterating — Vite HMR + proxy. Backend still serves the built fallback at `:8000` so both URLs work.

---

## 2 · Prerequisites checked by `run.sh`

The script aborts with a clear message if any check fails:

- **Node ≥20.18** (`frontend/package.json:88-89` requires `>=20.18.0` + `pnpm@9.12.3`). `pnpm` preferred; if absent falls back to `npm install --legacy-peer-deps`.
- **Python ≥3.11** (`python3 --version` + `pip`).
- **Ports free**: `:8000` always, `:5173` in `--dev` only. The holder is printed (`ss -tlnp` / `lsof -i :PORT`) so you can `kill <pid>`.
- **uvicorn / FastAPI** importable after `pip install -r requirements.txt`.

No global installs are performed beyond `pip install` and `pnpm|npm install`.

---

## 3 · What `run.sh` does (8 steps)

```
1/8  prerequisites        node, pnpm|npm, python, ports, .env hint
2/8  backend deps         pip install -r requirements.txt   (root)
3/8  frontend deps        pnpm install  ||  npm install --legacy-peer-deps
4/8  aesthetic gate       (cd frontend && node scripts/check_aesthetic.js)
                          sha256 of src/index.css vs aesthetic.lock.json +
                          token checks (canvas #09090B, panel #111113 …)
                          fails fast if design tokens drift
5/8  build frontend       pnpm run build  ||  npm run build  → frontend/dist/
5b/8 prod shim            (prod only) exposes dist/ through backend mount:
                          cp dist/index.html → frontend/index.html
                          ln -sfn dist/assets → frontend/assets
                          original saved to frontend/index.dev.html.bak
                          restored on exit via trap
6/8  backend              uvicorn backend.main:app --host 0.0.0.0 --port 8000
                          log → /tmp/aaj_run.log  (terminal tails from backend boot: `[api]` uvicorn, `[agent]` research steps)
                          lifespan auto-warms in background (seed backfill + 9-service
                          TTL pre-fill); /healthz is instant, /readyz shows warming.
7/8  frontend             dev only: vite --port 5173 --host 0.0.0.0 → /tmp/aaj_vite.log (`[vite]` prefix)
                          prod: skipped (backend serves dist/)
8/8  health checks        curl /healthz {ok:true}, /readyz {db_exists,cache_size,…},
                          /api/market-home sample (truncated)
                          prints URLs + tails log until Ctrl+C
```

`Ctrl+C` (trap `EXIT INT TERM`) kills both processes, restores `frontend/index.html` from backup, removes the `frontend/assets` symlink, and leaves logs at `/tmp/aaj_run.log` + `/tmp/aaj_vite.log`.

---

## 4 · Environment setup (`.env.example` — never commit `.env`)

```bash
cp .env.example .env
# then fill keys — the app runs without them (seed fallbacks) but live data is degraded
```

Reference **`./.env.example`** (the source of truth — `run.sh` never cats `.env`):

```
SERPAPI_KEY_1=                 # SerpApi key 1 (rotation: SERPAPI_KEY_2..N, or SERPAPI_KEY / SERPAPI_API_KEY)
# SERPAPI_KEY_2=               # optional — backend/config.py:11-22 pools 1..10
ALPHAVANTAGE_API_KEY=          # Alpha Vantage — quotes, fundamentals, FX, commodities (25/day free)
FRED_API_KEY=                  # FRED — macro series (CPI, rates, etc.)
AISSTREAM_API_KEY=             # AISStream — live ship stream (wss://stream.aisstream.io/v0/stream)
EIA_API_KEY=                   # EIA — energy inventories/production
SEC_USER_AGENT=                # SEC EDGAR — required UA, e.g. "AAJ demo you@example.com"
LLM_API_KEY=                   # Groq key (canonical) — powers Research Desk (qwen/qwen3.8-27b)
# GROQ_API_KEY=                # alias for LLM_API_KEY  (backend/config.py:37-38)
# LLM_MODEL=qwen/qwen3.8-27b   # override — this model is verified live; llama models 404 on this key
# DEEPSEEK_API_KEY=            # legacy fallback — groq preferred (backend/config.py:43-45)
MOCK_MODE=false                # true → quota-free replay from cache/seed (for recording)
```

**Key notes:**

- **LLM_API_KEY vs GROQ_API_KEY**: canonical is `LLM_API_KEY` (`backend/config.py:37` — `LLM_API_KEY = env("LLM_API_KEY") or env("GROQ_API_KEY")`). Either works; set one.
- **SerpApi pool**: `backend/config.py:serpapi_keys()` reads `SERPAPI_KEY_1..10` plus bare `SERPAPI_KEY` / `SERPAPI_API_KEY` for convenience. Set at least `SERPAPI_KEY_1`.
- **SEC_USER_AGENT**: SEC fair-access requires 10 req/s max and a declared UA (`MUST` include contact — e.g. `Name email@domain`).
- **MOCK_MODE**: `true` replays `warm_cache.json` + SQLite baselines — zero SerpApi/LLM quota, perfect for recording demos (`docs/demo.mp4`). `false` is live.
- **Never commit `.env`** — `.gitignore` already excludes it.

---

## 5 · Endpoints & sockets (`backend/main.py` + `backend/api/routes.py` + `research_desk/stream.py`)

The script waits for these and prints them:

```
GET  /healthz              → {"ok": true}                          (liveness)
GET  /readyz               → {"db_exists","cache_size","ais_task","warming","warmed_at","warm_error","warm_services","mock_mode","recording_present"} (readiness + auto-warm status)
GET  /api/market-home      → {indices, fx, rates, commodities, crypto, event_ticker, anomaly_strip, evidence[]}
GET  /api/asset/{ticker}   → {quote, chart, fundamentals, filings, insider, news_timeline, trends, …}
GET  /api/events?q&num     → {clusters[], count, …}
GET  /api/events/{id}/chain
GET  /api/cross-market     → {matrix, candidate_edges, …}
POST /api/cross-market/simulate  {shock_asset, shock_value}
GET  /api/map              → 5 boxes [{id,name,bbox,count,baseline_7d,pct_change,positions[],stale,…}]
GET  /api/map/{id}  +  /history?hours=
GET  /api/search?q&limit   → curated index (no fetch)
GET  /api/geo/{ports,routes,tss_lanes,trade_arcs}
GET  /api/map/layers/{weather,earthquakes,disasters}
WS   /ws/map/{chokepoint_id}       → {type:"snapshot"} then 2/sec diffs {added,updated,removed}
POST /api/research/run     {query} → {report, trace[7-8 stages], evidence_count}  (Groq qwen)
WS   /ws/research/{session_id}    → per-node {stage,status,query,engine,result_count,timestamp} + final
GET  /docs                 → Swagger UI
```

`GET /` serves the built SPA (`frontend/dist/index.html` via the prod shim) — `StaticFiles(directory="frontend", html=True)` mounted **last** so `/api/*` and `/ws/*` take precedence (`backend/main.py:101-108`).

---

## 6 · Frontend notes (for judges & reviewers)

- **Stack**: Vite 8 + Rolldown, React 19, Tailwind 4, MapLibre + deck.gl, lightweight-charts (`frontend/vite.config.js`, `frontend/package.json`).
- **Build**: `vite build` → `frontend/dist/` with chunk split `map` / `chart` / `vendor` (`frontend/vite.config.js:16-25`).
- **Dev proxy** (`frontend/vite.config.js:27-33`): `/api`, `/ws` (ws:true), `/healthz`, `/readyz` → `http://localhost:8000`.
- **No mocks in the main UI**. MSW lives **only in tests** — `frontend/src/mocks/setup.ts` is wired via `frontend/vite.config.js:35-39` (`test.setupFiles: ["./src/mocks/setup.ts"]`) and `vitest` globals. The production bundle hits real `fetch("/api/...")` and `WebSocket("/ws/...")` via the proxy / backend mount.
- **Aesthetic gate**: `frontend/scripts/check_aesthetic.js` + `frontend/aesthetic.lock.json` + `frontend/src/index.css` (`@theme` tokens). Must stay in sync — canvas `#09090B`, panel `#111113`, raised `#18181B`, etc. `run.sh` runs it pre-build.
- **Ports**: backend `:8000` is canonical; dev vite is `:5173`. `run.sh --prod` needs only `:8000`.

---

## 7 · Troubleshooting

| Symptom | Fix |
|---------|-----|
| `port 8000 in use` | `lsof -i :8000 && kill <pid>` or `ss -tlnp \| grep 8000` |
| `port 5173 in use` (dev) | same, or just `./run.sh --prod` |
| `node <20.18` | `nvm install 20 && nvm use 20` (or upgrade system node) |
| `pip install` fails | `python3 -m pip install --upgrade pip` then retry; check `requirements.txt` at repo root |
| `aesthetic gate failed` | intentional token change → update `aesthetic.lock.json` hash; otherwise revert `src/index.css` drift (banned: `#0A0A0B`, `C9A86A`, `rounded-[16` …) |
| `/healthz` never becomes ready | `tail -f /tmp/aaj_run.log` / `cat /tmp/aaj_run.log` — missing env keys show as degraded, not crash; real crash prints traceback |
| `vite not ready` (dev) | `cat /tmp/aaj_vite.log` — usually port conflict or missing `frontend/dist/` (build still succeeds) |
| Backend serves dev `index.html` instead of built one | `run.sh --prod` shims `frontend/index.html` + `frontend/assets` symlink; if you killed it hard, `rm frontend/assets; cp frontend/index.dev.html.bak frontend/index.html` |
| Want zero-quota demo | `echo 'MOCK_MODE=true' >> .env` then `./run.sh --prod` — replays cache + seed positions (5 chokepoints, `stale:true` badge) |

Logs are always at `/tmp/aaj_run.log` (backend) and `/tmp/aaj_vite.log` (dev). The trap leaves them after exit for inspection.

---

## 8 · Manual fallback (if you prefer no script)

```bash
cp .env.example .env   # fill LLM_API_KEY/GROQ_API_KEY, SERPAPI_KEY_1, etc.
pip install -r requirements.txt
cd frontend && npm install --legacy-peer-deps   # or pnpm install
node scripts/check_aesthetic.js                  # must be run from frontend/
npm run build                                    # → frontend/dist/
cd .. && python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
# then open http://localhost:8000  (after the shim, or open frontend/dist/index.html via vite preview)
# dev alt: cd frontend && npx vite --port 5173 --host 0.0.0.0
```

`run.sh` just automates the above with checks, the prod shim, health waits, and clean `Ctrl+C` handling.

---

*MSW is test-only. The shipped UI is live — every number carries `evidence[]` + `stale`/`skipped` honesty flags. See `FRONTEND_CONTRACT.md` and `backend/main.py:101-108`.*
