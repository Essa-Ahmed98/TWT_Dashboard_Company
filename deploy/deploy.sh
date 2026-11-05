#!/usr/bin/env bash
# =============================================================================
# Deploy this dashboard to one environment (dev / live) - runs on the server from GitHub Actions
#
#   deploy/deploy.sh <dev|live> <tag>
#
# Steps:
#   1) Build the Docker image from the current code (local on the server, not pushed to Docker Hub)
#   2) Set the dashboard version in the environment's .env
#   3) Restart this dashboard only (the APIs and the other dashboard are not touched)
#   4) Check the page opens - if not: roll back to the previous version and fail
#   5) Keep the last 5 images for rollback
#
# The environment's docker-compose file is on the server (written by the backend deploy).
# =============================================================================
set -euo pipefail

# ── Dashboard settings ───────────────────────────────────────────────────────
APP="company"
IMAGE="twt-hajj/company"
VERSION_VAR="COMPANY_VERSION"
SERVICE="company"
PORT_VAR="COMPANY_PORT"
# ─────────────────────────────────────────────────────────────────────────────

ENV_NAME="${1:?usage: deploy.sh <dev|live> <tag>}"
TAG="${2:?usage: deploy.sh <dev|live> <tag>}"
APPS_DIR="${APPS_DIR:-$HOME/docker-apps/TWT-Hajj}"
KEEP_IMAGES=5
HEALTH_TIMEOUT_SECONDS=120

case "$ENV_NAME" in
  dev|live) ;;
  *) echo "unknown environment: $ENV_NAME" >&2; exit 2 ;;
esac
DIR="$APPS_DIR/$ENV_NAME"
COMPOSE="docker-compose.$ENV_NAME.yaml"
ENV_FILE="$DIR/.env"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
log() { echo "[$(date -u +%H:%M:%S)] [$APP/$ENV_NAME] $*"; }

[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE - the backend environment must be set up first" >&2; exit 1; }
[ -f "$DIR/$COMPOSE" ] || { echo "missing $DIR/$COMPOSE - deploy the backend to $ENV_NAME first" >&2; exit 1; }

set_env() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  awk -v k="$key" -v v="$value" -F= '
    BEGIN { done = 0 }
    $1 == k { print k "=" v; done = 1; next }
    { print }
    END { if (!done) print k "=" v }' "$ENV_FILE" > "$tmp"
  cat "$tmp" > "$ENV_FILE" && rm -f "$tmp"
}
get_env() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }
compose() { (cd "$DIR" && docker compose -f "$COMPOSE" --env-file "$ENV_FILE" "$@"); }

# ── 1) Build ────────────────────────────────────────────────────────────────
log "building $IMAGE:$TAG"
docker build --file "$REPO_ROOT/Dockerfile" --tag "$IMAGE:$TAG" \
  --label "twt.environment=$ENV_NAME" --label "twt.commit=${GITHUB_SHA:-unknown}" \
  "$REPO_ROOT"

# ── 2) .env ─────────────────────────────────────────────────────────────────
PREVIOUS_TAG="$(get_env "$VERSION_VAR")"
cp "$ENV_FILE" "$ENV_FILE.bak"
set_env "$VERSION_VAR" "$TAG"

# ── 3) Start the new version ────────────────────────────────────────────────
log "starting $SERVICE (${PREVIOUS_TAG:-none} -> $TAG)"
compose up -d --no-deps "$SERVICE"

# ── 4) Health check ─────────────────────────────────────────────────────────
URL="http://127.0.0.1:$(get_env "$PORT_VAR")/"
log "waiting for $URL"
healthy=false
for ((i = 0; i < HEALTH_TIMEOUT_SECONDS; i += 3)); do
  if curl -fsS --max-time 5 -o /dev/null "$URL" && curl -fsS --max-time 5 "${URL}env.js" | grep -q "apiBase"; then
    healthy=true; break
  fi
  sleep 3
done

if [ "$healthy" != true ]; then
  log "HEALTH CHECK FAILED - last logs:"
  docker logs --tail 50 "$(compose ps -q "$SERVICE")" 2>&1 || true
  if [ -n "$PREVIOUS_TAG" ] && docker image inspect "$IMAGE:$PREVIOUS_TAG" >/dev/null 2>&1; then
    log "rolling back to $PREVIOUS_TAG"
    set_env "$VERSION_VAR" "$PREVIOUS_TAG"
    compose up -d --no-deps "$SERVICE"
  fi
  exit 1
fi
log "healthy ✔ running $IMAGE:$TAG"

# ── 5) Cleanup ──────────────────────────────────────────────────────────────
docker images "$IMAGE" --format '{{.CreatedAt}}|{{.Tag}}' \
  | grep "|$ENV_NAME-" | sort -r | cut -d'|' -f2 | awk -v keep="$KEEP_IMAGES" 'NR > keep' \
  | while read -r old; do
      [ "$old" = "$TAG" ] || [ "$old" = "$PREVIOUS_TAG" ] && continue
      docker rmi "$IMAGE:$old" >/dev/null 2>&1 && log "removed old image $old" || true
    done
docker image prune -f >/dev/null 2>&1 || true
log "done"
