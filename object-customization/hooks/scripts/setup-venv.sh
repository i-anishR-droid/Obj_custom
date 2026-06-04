#!/bin/bash
# setup-venv.sh — create .venv and install requirements if not already present.
# Hook: SessionStart — exits 0 always.

set -u

PLUGIN="${CLAUDE_PLUGIN_ROOT:-.}"
VENV="$PLUGIN/../../.venvs/object-customization"
REQ="$PLUGIN/requirements.txt"

if [ -f "$VENV/bin/python3" ]; then
  exit 0  # already set up
fi

echo "⚙️  object-customization: setting up Python venv..."

python3 -m venv "$VENV" 2>&1
"$VENV/bin/pip" install -r "$REQ" -q 2>&1

if [ -f "$VENV/bin/python3" ]; then
  echo "✅  object-customization: venv ready at $VENV"
else
  echo "⚠️  object-customization: venv setup failed — run manually:"
  echo "    python3 -m venv $VENV && $VENV/bin/pip install -r $REQ"
fi

exit 0
