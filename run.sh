#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  AAJ Terminal — one-command hackathon launcher
#  Usage:
#    chmod +x run.sh && ./run.sh --prod   # single server (recommended for judging)
#    ./run.sh --dev                        # two servers (hot-reload)
#    ./run.sh --help
#
#  What it does:
#    1. checks prerequisites (node≥20.18, pnpm/npm, python≥3.11, uv, ports 8000/5173)
#    2. ensures .venv (uv venv) + installs backend (uv pip, with progress) + frontend deps
#    3. runs aesthetic gate (frontend/scripts/check_aesthetic.js)
#    4. builds frontend (vite build → dist/)
#    5. shims backend StaticFiles so prod serves the built bundle from /
#    6. starts uvicorn backend.main:app → :8000  (log /tmp/aaj_run.log)
#    7. (dev only) starts vite dev server → :5173 with proxy to :8000
#    8. waits for /healthz, /readyz, /api/market-home
#    9. prints URLs and tails logs; Ctrl+C kills everything
#
#  Env: copy .env.example → .env and fill keys (LLM_API_KEY/GROQ_API_KEY,
#       SERPAPI_KEY_1..N, ALPHAVANTAGE_API_KEY, AISSTREAM_API_KEY, etc).
#       The main UI has NO mocks — MSW lives only in tests (src/mocks/*).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── args ────────────────────────────────────────────────────────────────────
MODE="prod"
for arg in "$@"; do
  case "$arg" in
    --prod) MODE="prod" ;;
    --dev)  MODE="dev"  ;;
    --help|-h)
      cat <<'HELP'
Usage: ./run.sh [--prod|--dev]

  --prod   Single server (RECOMMENDED for judging). Builds frontend, mounts
           dist/ through FastAPI StaticFiles at http://localhost:8000.
           Judge quickstart:  chmod +x run.sh && ./run.sh --prod
  --dev    Two servers. Backend :8000 + Vite dev server :5173 (hot reload,
           Vite proxy forwards /api, /ws, /healthz, /readyz).

Env:  cp .env.example .env   then fill keys (see .env.example / README_RUN.md)
      LLM_API_KEY (alias GROQ_API_KEY), SERPAPI_KEY_1..N, ALPHAVANTAGE_API_KEY,
      FRED_API_KEY, AISSTREAM_API_KEY, EIA_API_KEY, SEC_USER_AGENT, etc.
      MOCK_MODE=false for live; =true for zero-quota demo replay.

Logs: live on terminal from step 6 (backend boot) — [api] uvicorn/warmup/[agent] research
      files: /tmp/aaj_run.log  •  /tmp/aaj_vite.log (dev, [vite] prefix)
HELP
      exit 0
      ;;
    *) echo "unknown arg: $arg  (try --help)"; exit 1 ;;
  esac
done

# ── paths ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR"
FRONTEND_DIR="$ROOT/frontend"
VENV_DIR="$ROOT/.venv"
VENV_PYTHON="$VENV_DIR/bin/python"
BACKEND_PORT=8000
FRONTEND_PORT=5173
LOG_FILE="/tmp/aaj_run.log"
VITE_LOG="/tmp/aaj_vite.log"
BACKEND_PID=""
FRONTEND_PID=""
TAIL_PIDS=()
LOG_STREAM_STARTED=0

# ── colors ──────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  BOLD="\033[1m"; DIM="\033[2m"; GREEN="\033[32m"; CYAN="\033[36m"
  YELLOW="\033[33m"; RED="\033[31m"; MAG="\033[35m"; RESET="\033[0m"
else
  BOLD=""; DIM=""; GREEN=""; CYAN=""; YELLOW=""; RED=""; MAG=""; RESET=""
fi

info()  { printf "${CYAN}▸${RESET} %s\n" "$*"; }
ok()    { printf "${GREEN}✔${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}⚠${RESET} %s\n" "$*"; }
err()   { printf "${RED}✘${RESET} %s\n" "$*"; }
step()  { printf "\n${BOLD}━━ %s ━━${RESET}\n" "$*"; }

# Follow a log file on the terminal (starts once; survives through health checks + live use)
start_log_stream() {
  local file=$1 prefix=$2
  [[ -f "$file" ]] || : > "$file"
  tail -n 0 -f "$file" 2>/dev/null | sed -u "s/^/${prefix} /" &
  TAIL_PIDS+=("$!")
}

start_all_log_streams() {
  if [[ "$LOG_STREAM_STARTED" -eq 1 ]]; then return 0; fi
  LOG_STREAM_STARTED=1
  printf "\n${DIM}── live logs (also in %s) ──${RESET}\n" "$LOG_FILE"
  start_log_stream "$LOG_FILE" "[api]"
  if [[ "$MODE" == "dev" && -f "$VITE_LOG" ]]; then
    start_log_stream "$VITE_LOG" "[vite]"
  fi
}

banner(){
  printf "${BOLD}${GREEN}"
  cat <<'BANNER'
  ◢◣ AAJ Terminal — AI-Native Market Intelligence ◢◣
  Markets move because the world moves first.
BANNER
  printf "${RESET}\n"
  printf "${DIM}  mode: %s  •  root: %s${RESET}\n" "$MODE" "$ROOT"
}

# ── cleanup ─────────────────────────────────────────────────────────────────
cleanup() {
  local code=$?
  printf "\n${DIM}── shutting down ──${RESET}\n"
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    info "stopping backend (pid $BACKEND_PID)"
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    info "stopping vite (pid $FRONTEND_PID)"
    kill "$FRONTEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
  fi
  # restore dev index.html if we shimmed prod
  if [[ -f "$FRONTEND_DIR/index.dev.html.bak" ]]; then
    info "restoring frontend/index.html (dev entry)"
    mv -f "$FRONTEND_DIR/index.dev.html.bak" "$FRONTEND_DIR/index.html" 2>/dev/null || true
  fi
  if [[ -L "$FRONTEND_DIR/assets" ]]; then
    rm -f "$FRONTEND_DIR/assets" 2>/dev/null || true
  fi
  for tp in "${TAIL_PIDS[@]:-}"; do
    if [[ -n "$tp" ]] && kill -0 "$tp" 2>/dev/null; then
      kill "$tp" 2>/dev/null || true
    fi
  done
  # keep logs for inspection; mention them
  printf "${DIM}logs: $LOG_FILE"
  [[ "$MODE" == "dev" ]] && printf " • $VITE_LOG"
  printf "${RESET}\n"
  exit $code
}
trap cleanup EXIT INT TERM

banner

# ── 1. prerequisites ────────────────────────────────────────────────────────
step "1/8  prerequisites"

# node ≥20.18
if ! command -v node >/dev/null 2>&1; then
  err "node not found — install Node ≥20.18  (https://nodejs.org)"
  exit 1
fi
NODE_VER="$(node --version | sed 's/^v//')"
NODE_MAJOR="$(echo "$NODE_VER" | cut -d. -f1)"
NODE_MINOR="$(echo "$NODE_VER" | cut -d. -f2)"
# compare >=20.18
if [[ "$NODE_MAJOR" -lt 20 ]] || { [[ "$NODE_MAJOR" -eq 20 ]] && [[ "$NODE_MINOR" -lt 18 ]]; }; then
  err "node $NODE_VER < 20.18 — please upgrade (nvm install 20 && nvm use 20)"
  exit 1
fi
ok "node $NODE_VER"

# pnpm or npm (prefer packageManager from frontend/package.json via corepack)
PKG_MGR=""
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    info "activating pnpm via corepack (packageManager: pnpm@9.12.3)"
    corepack enable 2>/dev/null || true
    corepack prepare pnpm@9.12.3 --activate 2>/dev/null || true
  fi
fi
if command -v pnpm >/dev/null 2>&1; then
  PKG_MGR="pnpm"
  ok "pnpm $(pnpm --version) — will use pnpm"
else
  if ! command -v npm >/dev/null 2>&1; then
    err "neither pnpm nor npm found — install Node.js (or: corepack enable)"
    exit 1
  fi
  PKG_MGR="npm"
  warn "pnpm not found — falling back to npm $(npm --version) --legacy-peer-deps"
fi

# python ≥3.11
if ! command -v python3 >/dev/null 2>&1; then
  err "python3 not found — install Python 3.11+"
  exit 1
fi
PY_VER="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")')"
PY_MAJOR="$(python3 -c 'import sys; print(sys.version_info.major)')"
PY_MINOR="$(python3 -c 'import sys; print(sys.version_info.minor)')"
if [[ "$PY_MAJOR" -lt 3 ]] || { [[ "$PY_MAJOR" -eq 3 ]] && [[ "$PY_MINOR" -lt 11 ]]; }; then
  err "python $PY_VER < 3.11 — please upgrade"
  exit 1
fi
ok "python $PY_VER ($(python3 --version))"

# uv (replaces pip — fast, shows progress)
if ! command -v uv >/dev/null 2>&1; then
  err "uv not found — install it:  curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi
ok "uv $(uv --version)"

# venv — auto-created with uv if missing so installs never hit system python
if [[ ! -x "$VENV_PYTHON" ]]; then
  info "creating venv ($VENV_DIR)"
  (cd "$ROOT" && uv venv .venv)
fi
ok "venv $VENV_PYTHON"

# ports
port_in_use() {
  local port=$1
  if command -v ss >/dev/null 2>&1; then
    ss -tlnH 2>/dev/null | grep -qE ":${port}\b"
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1
  else
    # fallback: try nc
    nc -z 127.0.0.1 "$port" 2>/dev/null
  fi
}
if port_in_use $BACKEND_PORT; then
  err "port $BACKEND_PORT in use — stop whatever is on :$BACKEND_PORT or:  lsof -i :$BACKEND_PORT && kill <pid>"
  # show holder if possible
  if command -v ss >/dev/null 2>&1; then ss -tlnp 2>/dev/null | grep ":$BACKEND_PORT" || true; fi
  if command -v lsof >/dev/null 2>&1; then lsof -i :$BACKEND_PORT || true; fi
  exit 1
fi
ok "port $BACKEND_PORT free"
if [[ "$MODE" == "dev" ]] && port_in_use $FRONTEND_PORT; then
  err "port $FRONTEND_PORT in use (dev mode needs it) — stop :$FRONTEND_PORT or run --prod"
  if command -v ss >/dev/null 2>&1; then ss -tlnp 2>/dev/null | grep ":$FRONTEND_PORT" || true; fi
  exit 1
fi
if [[ "$MODE" == "dev" ]]; then ok "port $FRONTEND_PORT free"; fi

# .env hint (never cat .env)
if [[ ! -f "$ROOT/.env" ]]; then
  warn ".env not found — copy template:  cp .env.example .env  then fill keys"
  warn "Without keys the app still starts (seed fallbacks) but live data will be degraded."
  if [[ -f "$ROOT/.env.example" ]]; then
    info "template vars (from .env.example):"
    sed 's/^\s*#.*//' "$ROOT/.env.example" | grep -E '^[A-Z_]+=' | sed 's/=.*/= ▸ set me/' | while read -r line; do
      printf "      ${DIM}%s${RESET}\n" "$line"
    done
  fi
else
  ok ".env present (not displayed)"
fi

# ── 2. backend deps (uv — visible progress, no --quiet) ─────────────────────
step "2/8  backend deps (uv)"
if [[ -f "$ROOT/requirements.txt" ]]; then
  info "uv pip install -r requirements.txt"
  if uv pip install --python "$VENV_PYTHON" -r "$ROOT/requirements.txt"; then
    ok "backend deps installed"
  else
    err "uv pip install -r requirements.txt failed — see output above"
    exit 1
  fi
else
  warn "requirements.txt not found at root — skipping backend install"
fi

# quick import check (venv python, not system python)
if ! "$VENV_PYTHON" -c "import fastapi, uvicorn" 2>/dev/null; then
  err "fastapi/uvicorn not importable after install — check uv errors"
  exit 1
fi

# ── 3. frontend deps ────────────────────────────────────────────────────────
step "3/8  frontend deps"
if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
  err "frontend/package.json not found at $FRONTEND_DIR"
  exit 1
fi
# MOCK replay: ensure backend warm_cache exists when only frontend/public copy is present
BACKEND_WARM="$ROOT/backend/data/warm_cache.json"
FRONTEND_WARM="$FRONTEND_DIR/public/warm_cache.json"
if [[ ! -f "$BACKEND_WARM" && -f "$FRONTEND_WARM" ]]; then
  mkdir -p "$ROOT/backend/data"
  cp -f "$FRONTEND_WARM" "$BACKEND_WARM"
  ok "seeded backend/data/warm_cache.json from frontend/public"
fi

if [[ "$PKG_MGR" == "pnpm" ]]; then
  info "pnpm install (frontend/)"
  (cd "$FRONTEND_DIR" && pnpm install)
else
  if [[ -f "$FRONTEND_DIR/package-lock.json" ]]; then
    info "npm ci --legacy-peer-deps (frontend/)"
    (cd "$FRONTEND_DIR" && npm ci --legacy-peer-deps)
  else
    info "npm install --legacy-peer-deps (frontend/)"
    (cd "$FRONTEND_DIR" && npm install --legacy-peer-deps)
  fi
fi
ok "frontend deps ready"

# ── 4. aesthetic gate ───────────────────────────────────────────────────────
step "4/8  aesthetic gate"
if [[ -f "$FRONTEND_DIR/scripts/check_aesthetic.js" ]]; then
  info "node scripts/check_aesthetic.js"
  if (cd "$FRONTEND_DIR" && node scripts/check_aesthetic.js); then
    ok "aesthetic lock verified — canvas #09090B / panel #111113"
  else
    err "aesthetic gate failed — tokens drifted. Fix src/index.css or update aesthetic.lock.json"
    exit 1
  fi
else
  warn "frontend/scripts/check_aesthetic.js not found — skipping gate"
fi

# ── 5. build frontend ───────────────────────────────────────────────────────
step "5/8  build frontend"
info "building frontend (vite build → dist/)"
if [[ "$PKG_MGR" == "pnpm" ]]; then
  (cd "$FRONTEND_DIR" && pnpm run build)
else
  (cd "$FRONTEND_DIR" && npm run build)
fi
if [[ ! -f "$FRONTEND_DIR/dist/index.html" ]]; then
  err "frontend/dist/index.html missing after build"
  exit 1
fi
ok "frontend/dist built — $(du -sh "$FRONTEND_DIR/dist" | cut -f1)  ($(ls -1 "$FRONTEND_DIR/dist/assets" 2>/dev/null | wc -l) assets)"

# ── 5b. prod shim: make backend StaticFiles serve built bundle at / ─────────
# backend/main.py mounts `frontend/` (not `frontend/dist`) with html=True.
# Vite dev entry is frontend/index.html (→ /src/main.jsx) while the built
# entry is frontend/dist/index.html (→ /assets/*.js). For --prod single-server
# we shim the mount so / serves the built bundle without touching backend code.
if [[ "$MODE" == "prod" ]]; then
  step "5b/8 prod shim — expose dist/ through backend StaticFiles"
  # backup dev index.html
  if [[ -f "$FRONTEND_DIR/index.html" && ! -f "$FRONTEND_DIR/index.dev.html.bak" ]]; then
    cp "$FRONTEND_DIR/index.html" "$FRONTEND_DIR/index.dev.html.bak"
  fi
  # make / serve the built index.html
  cp -f "$FRONTEND_DIR/dist/index.html" "$FRONTEND_DIR/index.html"
  # make /assets/* resolve (built index refs /assets/*.js)
  if [[ -L "$FRONTEND_DIR/assets" ]]; then rm -f "$FRONTEND_DIR/assets"; fi
  if [[ -d "$FRONTEND_DIR/assets" && ! -L "$FRONTEND_DIR/assets" ]]; then
    rm -rf "$FRONTEND_DIR/assets"
  fi
  ln -sfn "dist/assets" "$FRONTEND_DIR/assets"
  # purge stale hashed chunks at frontend root (old map-*.css/js 404 → WorldMap crash)
  find "$FRONTEND_DIR" -maxdepth 1 -type f \( -name 'index-*.js' -o -name 'map-*.js' -o -name 'map-*.css' \) -delete 2>/dev/null || true
  # also expose warm_cache if present at dist root for curious judges
  if [[ -f "$FRONTEND_DIR/dist/warm_cache.json" && ! -f "$FRONTEND_DIR/warm_cache.json" ]]; then
    ln -sfn "dist/warm_cache.json" "$FRONTEND_DIR/warm_cache.json" 2>/dev/null || true
  fi
  ok "shim ready — backend will serve built bundle at / (original saved to index.dev.html.bak)"
fi

# ── 6. start backend ────────────────────────────────────────────────────────
step "6/8  backend → http://localhost:$BACKEND_PORT"
: > "$LOG_FILE"
info "uvicorn backend.main:app --host 0.0.0.0 --port $BACKEND_PORT  (log $LOG_FILE)"
# run from ROOT so `backend.main` resolves; load .env via python-dotenv in app
(
  cd "$ROOT"
  export PYTHONPATH="$ROOT"
  export PYTHONUNBUFFERED=1
  # venv python so the running server matches the installed deps
  "$VENV_PYTHON" -m uvicorn backend.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --log-level info --access-log
) >> "$LOG_FILE" 2>&1 &
BACKEND_PID=$!
ok "backend pid $BACKEND_PID → $LOG_FILE"
start_all_log_streams

# ── 7. start frontend (dev only) ────────────────────────────────────────────
if [[ "$MODE" == "dev" ]]; then
  step "7/8  frontend dev → http://localhost:$FRONTEND_PORT"
  : > "$VITE_LOG"
  info "vite dev server --port $FRONTEND_PORT --host (log $VITE_LOG)"
  (
    cd "$FRONTEND_DIR"
    if [[ "$PKG_MGR" == "pnpm" ]]; then
      pnpm run dev -- --port "$FRONTEND_PORT" --host 0.0.0.0
    else
      npx vite --port "$FRONTEND_PORT" --host 0.0.0.0
    fi
  ) >> "$VITE_LOG" 2>&1 &
  FRONTEND_PID=$!
  ok "vite pid $FRONTEND_PID → $VITE_LOG"
  start_log_stream "$VITE_LOG" "[vite]"
else
  step "7/8  frontend — prod single-server (no vite process; backend serves dist/)"
  ok "skip vite — http://localhost:$BACKEND_PORT serves the UI"
fi

# ── 8. health checks ────────────────────────────────────────────────────────
step "8/8  health checks"

wait_for() {
  local url=$1 label=$2 max=${3:-30}
  local i=0
  while (( i < max )); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    # if backend died, abort early
    if [[ -n "${BACKEND_PID:-}" ]] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      err "backend died while waiting for $label — tail $LOG_FILE:"
      tail -n 60 "$LOG_FILE" || true
      return 1
    fi
    sleep 1
    i=$((i + 1))
    printf "${DIM}.${RESET}"
  done
  printf "\n"
  return 1
}

printf "${DIM}waiting for backend${RESET} "
if wait_for "http://localhost:$BACKEND_PORT/healthz" "healthz" 40; then
  printf " ${GREEN}up${RESET}\n"
else
  printf "\n"
  err "backend not healthy at /healthz after 40s — tail $LOG_FILE:"
  tail -n 80 "$LOG_FILE" || true
  exit 1
fi

# verify payloads
HEALTHZ="$(curl -fsS "http://localhost:$BACKEND_PORT/healthz" 2>/dev/null || echo '{}')"
READYZ="$(curl -fsS "http://localhost:$BACKEND_PORT/readyz" 2>/dev/null || echo '{}')"
MARKET="$(curl -fsS "http://localhost:$BACKEND_PORT/api/market-home" 2>/dev/null || echo '{}')"

if echo "$HEALTHZ" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
  ok "/healthz → $HEALTHZ"
else
  warn "/healthz unexpected: $HEALTHZ"
fi

if echo "$READYZ" | grep -q 'db_exists'; then
  ok "/readyz → $(echo "$READYZ" | head -c 220)"
else
  warn "/readyz unexpected: $(echo "$READYZ" | head -c 220)"
fi

printf "${DIM}waiting for warm (readyz)${RESET} "
WARM_I=0
while (( WARM_I < 45 )); do
  RZ="$(curl -fsS "http://localhost:$BACKEND_PORT/readyz" 2>/dev/null || echo '{}')"
  if echo "$RZ" | grep -q '"warming"[[:space:]]*:[[:space:]]*false'; then
    printf " ${GREEN}warm${RESET}\n"
    break
  fi
  sleep 1
  WARM_I=$((WARM_I + 1))
  printf "${DIM}.${RESET}"
done
printf "\n"

ASSET_SAMPLE="$(curl -fsS "http://localhost:$BACKEND_PORT/api/asset/BRENT" 2>/dev/null | head -c 120 || echo '')"
if [[ -n "$ASSET_SAMPLE" ]]; then
  ok "/api/asset/BRENT responds"
else
  warn "/api/asset/BRENT empty or slow"
fi

if echo "$MARKET" | grep -q 'evidence'; then
  ok "/api/market-home → live (sample: $(echo "$MARKET" | head -c 220)…)"
else
  # still ok if backend is up but providers degraded — show truncated
  warn "/api/market-home response (may be degraded without keys): $(echo "$MARKET" | head -c 300)"
fi

if [[ "$MODE" == "dev" ]]; then
  printf "${DIM}waiting for vite${RESET} "
  if wait_for "http://localhost:$FRONTEND_PORT" "vite" 30; then
    printf " ${GREEN}up${RESET}\n"
    ok "vite ready at http://localhost:$FRONTEND_PORT"
  else
    printf "\n"
    warn "vite not ready at :$FRONTEND_PORT after 30s — tail $VITE_LOG"
    tail -n 40 "$VITE_LOG" || true
    # not fatal — backend alone still usable
  fi
fi

# ── URLs ────────────────────────────────────────────────────────────────────
printf "\n${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
printf "${BOLD}  AAJ Terminal is LIVE${RESET}\n"
printf "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n\n"

if [[ "$MODE" == "prod" ]]; then
  printf "  ${BOLD}Frontend${RESET}       http://localhost:${BACKEND_PORT}  ${DIM}(backend serves dist/ — single server)${RESET}\n"
else
  printf "  ${BOLD}${YELLOW}Open UI here →${RESET} http://localhost:${FRONTEND_PORT}  ${DIM}(vite HMR + API proxy)${RESET}\n"
  printf "  ${DIM}Backend only (no HMR):${RESET} http://localhost:${BACKEND_PORT}/api/…\n"
fi
printf "  ${BOLD}Backend${RESET}        http://localhost:${BACKEND_PORT}\n"
printf "  ${BOLD}API docs${RESET}       http://localhost:${BACKEND_PORT}/docs  ${DIM}(FastAPI Swagger)${RESET}\n"
printf "  ${BOLD}Health${RESET}         http://localhost:${BACKEND_PORT}/healthz  → {\"ok\": true}\n"
printf "  ${BOLD}Ready${RESET}          http://localhost:${BACKEND_PORT}/readyz\n"
printf "  ${BOLD}Market${RESET}         http://localhost:${BACKEND_PORT}/api/market-home\n"
printf "  ${BOLD}WebSockets${RESET}     ws://localhost:${BACKEND_PORT}/ws/map/{hormuz,bab-el-mandeb,suez,malacca,panama}\n"
printf "                   ws://localhost:${BACKEND_PORT}/ws/research/{session_id}\n"
printf "\n"
printf "  ${DIM}logs:${RESET}  [api] FastAPI + research agent (LangGraph)  →  $LOG_FILE\n"
[[ "$MODE" == "dev" ]] && printf "           [vite] frontend HMR  →  $VITE_LOG\n"
printf "\n"
printf "  ${DIM}stop:${RESET}  Ctrl+C  (or kill $BACKEND_PID"
[[ -n "${FRONTEND_PID:-}" ]] && printf " $FRONTEND_PID"
printf ")\n"
printf "\n${YELLOW}  Tip:${RESET} set MOCK_MODE=true in .env for zero-quota demo replay.\n"
printf "\n"

# logs already streaming since backend boot — [api] = uvicorn + warmup; [agent] lines from research desk
info "live logs above — [api] FastAPI · [agent] research trace · Ctrl+C to stop"
wait "$BACKEND_PID" 2>/dev/null || true
