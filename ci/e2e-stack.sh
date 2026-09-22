#!/usr/bin/env bash
# Throwaway E2E compose stack lifecycle (P17). Brings the docker-compose.yaml stack up
# on an EMPTY volume (Postgres → one-off migrate+seed → backend → frontend IMAGE), waits
# for the backend to be healthy, then — on `down` — tears it ALL down WITH its volume
# (`down -v`) so every run starts from a clean database. Never points at the cluster/dev
# DB: the compose Postgres is self-contained and disposable.
#
# Usage:
#   ci/e2e-stack.sh up     # build/pull-free: images must already exist; up + wait
#   ci/e2e-stack.sh down   # docker compose down -v (volume gone)
#
# Caller provides via env (the pipeline sets these; local defaults are fine):
#   COMPOSE_PROJECT_NAME   isolates networks/volumes for concurrent builds (default mm-e2e)
#   BACKEND_IMAGE          backend image ref   (default driftplain-backend:latest)
#   FRONTEND_IMAGE         frontend image ref under test (default driftplain-frontend:latest)
#   JWT_SECRET             REQUIRED for `up` (compose rejects the placeholder)
#   BACKEND_PORT           host port to poll for /healthz (default 8000)
#   FRONTEND_PORT          host port the FE image binds (default 8080)
set -euo pipefail

cmd="${1:-}"
cd "$(dirname "$0")/.."

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-mm-e2e}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
HEALTH_URL="http://localhost:${BACKEND_PORT}/healthz"

# Pick the available Compose CLI: prefer the v2 plugin (`docker compose`), fall back to
# the v1 standalone (`docker-compose`). The graded controller may have either; locally
# (OrbStack) it's v2. DC is intentionally unquoted at call sites so "docker compose"
# word-splits into two argv tokens.
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "ERROR: no Docker Compose found ('docker compose' v2 plugin or 'docker-compose' v1)" >&2
  exit 1
fi
echo "Using Compose CLI: ${DC} ($(${DC} version --short 2>/dev/null || ${DC} version 2>/dev/null | head -1))"

down() {
  # Compose interpolates the compose file's `${JWT_SECRET:?...}` on EVERY command (down
  # included), so provide a throwaway value when the caller's env no longer has it (e.g. a
  # Jenkins post{} block outside the test's withEnv). It is never used — down starts nothing.
  export JWT_SECRET="${JWT_SECRET:-teardown}"
  # -v drops the named volume so the next run gets an empty database; --remove-orphans
  # cleans any stage left from an earlier failed run.
  $DC down -v --remove-orphans
}

case "$cmd" in
  up)
    : "${JWT_SECRET:?set JWT_SECRET (a throwaway value for the E2E stack)}"
    # Fresh volume every time: clear any leftover from a prior aborted run first.
    down >/dev/null 2>&1 || true
    $DC up -d
    echo "Waiting for the backend to become healthy at ${HEALTH_URL} ..."
    for i in $(seq 1 60); do
      if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
        echo "Backend healthy after ${i} attempt(s)."
        exit 0
      fi
      sleep 2
    done
    echo "ERROR: backend did not become healthy in time. Recent logs:" >&2
    $DC ps >&2 || true
    $DC logs --tail=80 migrate backend >&2 || true
    down || true
    exit 1
    ;;
  down)
    down
    ;;
  *)
    echo "usage: $0 {up|down}" >&2
    exit 2
    ;;
esac
