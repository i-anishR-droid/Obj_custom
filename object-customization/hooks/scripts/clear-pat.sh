#!/bin/bash
# Clear PAT at session end — securely wipes the token from:
#   1. .env file (sets DEVREV_PAT to placeholder)
#   2. state/.auth.json (deletes the file)
#   3. Draft server (DELETE /auth, if running)
#
# Best-effort overwrite is used before deletion to reduce disk recovery risk.

set -e

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/../..}"
ENV_FILE="$PLUGIN_ROOT/.env"
AUTH_FILE="$PLUGIN_ROOT/state/.auth.json"
DRAFT_SERVER="${DRAFT_SERVER_URL:-http://127.0.0.1:7432}"

secure_remove() {
  local f="$1"
  [ -f "$f" ] || return 0
  # Overwrite with random bytes before unlinking (best effort on macOS/Linux)
  local size
  size=$(wc -c < "$f" 2>/dev/null || echo 0)
  if [ "$size" -gt 0 ]; then
    dd if=/dev/urandom of="$f" bs=1 count="$size" conv=notrunc 2>/dev/null || true
  fi
  rm -f "$f"
}

# 1. Wipe PAT from .env (keep file but reset placeholder)
if [ -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
# DevRev Personal Access Token (cleared on last session end)
DEVREV_PAT=your_pat_here
DEVREV_ENDPOINT=https://api.devrev.ai/internal
EOF
fi

# 2. Securely remove auth state file
secure_remove "$AUTH_FILE"

# 3. Tell draft server to clear its in-memory PAT (if running)
curl -s -X DELETE "$DRAFT_SERVER/auth" -m 2 >/dev/null 2>&1 || true

# 4. Log the cleanup (without exposing the PAT)
mkdir -p "$PLUGIN_ROOT/state/logs"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] PAT cleared at session end" >> "$PLUGIN_ROOT/state/logs/pat-lifecycle.log"

exit 0
