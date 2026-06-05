#!/bin/bash
# check-pats.sh — Warn early if DEVREV_PAT is not configured.
# Hook: SessionStart — exits 0 always (warning only, never blocks).

set -u

has_pat() {
  local name="$1"
  local val
  val=$(eval echo "\${$name:-}")
  if [ -n "$val" ]; then return 0; fi
  for f in "${CLAUDE_PLUGIN_ROOT:-.}/.env" "$HOME/.env"; do
    if [ -f "$f" ] && grep -q "^${name}=." "$f" 2>/dev/null; then return 0; fi
  done
  return 1
}

MISSING=()
has_pat DEVREV_PAT || MISSING+=("DEVREV_PAT")

if [ ${#MISSING[@]} -eq 0 ]; then
  exit 0
fi

echo "⚠️  object-customization: missing PAT(s): ${MISSING[*]}"
echo ""
echo "   Setup steps:"
echo "   1. cp .env.example .env"
echo "   2. Add your DEVREV_PAT"
echo "   3. Get token: DevRev → Settings → Tokens → Personal Access Token"
echo ""

exit 0
