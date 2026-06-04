#!/bin/bash
# block-python-eof.sh — Block python3 heredoc patterns.
# Hook: PreToolUse (Bash matcher)
# Prevents inline Python execution; all operations must go through schema_engine.py.

set -u

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // ""')

if echo "$command" | grep -qE "python3[[:space:]]*<<[[:space:]]*['\"]?EOF|python3[[:space:]]*<<[[:space:]]*['\"]?PYEOF"; then
  echo "BLOCK: python3 heredoc (<<'EOF') is not allowed in the object-customization plugin."
  echo "Use schema_engine.py CLI commands instead."
  echo ""
  echo "Example:"
  echo "  python3 \${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py --add-fields '[...]'"
  exit 2
fi

exit 0
