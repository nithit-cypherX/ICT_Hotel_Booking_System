#!/usr/bin/env bash
# =========================================================================
# deploy.sh — one-shot deployment helper for the uni server
# -------------------------------------------------------------------------
# Usage (on the server, inside the cloned repo):
#     chmod +x deploy.sh
#     ./deploy.sh
#
# What it does:
#   1. Pulls the latest code on the feature/docker-production branch
#   2. Verifies .env exists (otherwise copies .env.example and warns)
#   3. Brings the existing stack down
#   4. Rebuilds and starts the full stack (NGINX + app + MySQL + Redis)
#   5. Waits for /api/health to return 200
#   6. Prints the public URLs
# =========================================================================

set -euo pipefail

BRANCH="${BRANCH:-feature/docker-production}"
COMPOSE="${COMPOSE:-docker compose}"          # fallback: COMPOSE="docker-compose"
HEALTH_URL="http://localhost/api/health"
MAX_WAIT=120                                   # seconds

# ---- helpers -----------------------------------------------------------
bold()  { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn()  { printf '  \033[33m!\033[0m %s\n' "$1"; }
die()   { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }

# ---- 0. sanity --------------------------------------------------------
command -v git  >/dev/null || die "git is not installed"
command -v docker >/dev/null || die "docker is not installed"

# ---- 1. pull latest code ----------------------------------------------
bold "1/5  Pulling latest code on '${BRANCH}'"
git fetch --all --prune
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"
ok "Repo up to date"

# ---- 2. .env check ----------------------------------------------------
bold "2/5  Checking .env file"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    warn ".env was missing — copied .env.example. Edit it before production use!"
  else
    die "No .env and no .env.example found — cannot continue"
  fi
else
  ok ".env present"
fi

# Fail fast if JWT_SECRET is still the placeholder
if grep -qE '^JWT_SECRET=replace-this' .env; then
  die "JWT_SECRET in .env is still the placeholder — generate one with: openssl rand -base64 48"
fi

# ---- 3. tear down old stack ------------------------------------------
bold "3/5  Bringing old stack down"
sudo ${COMPOSE} down || true
ok "Old containers removed"

# ---- 4. build + start -------------------------------------------------
bold "4/5  Building & starting new stack"
sudo ${COMPOSE} up -d --build
ok "Containers started in detached mode"

# ---- 5. wait for health ----------------------------------------------
bold "5/5  Waiting for /api/health to respond (timeout ${MAX_WAIT}s)"
elapsed=0
until curl -fs "${HEALTH_URL}" >/dev/null 2>&1; do
  sleep 3
  elapsed=$((elapsed + 3))
  if [ "${elapsed}" -ge "${MAX_WAIT}" ]; then
    warn "Still not healthy after ${MAX_WAIT}s — check: sudo ${COMPOSE} logs -f app"
    sudo ${COMPOSE} ps
    exit 1
  fi
  printf '.'
done
echo
ok "Stack is healthy!"

# ---- done -------------------------------------------------------------
SERVER_IP="$(hostname -I | awk '{print $1}')"
bold "✅ Deployment complete"
echo "  Health:   http://${SERVER_IP}/api/health"
echo "  Swagger:  http://${SERVER_IP}/api/docs"
echo "  Logs:     sudo ${COMPOSE} logs -f app"
echo "  Status:   sudo ${COMPOSE} ps"
