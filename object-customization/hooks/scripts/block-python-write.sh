#!/bin/bash
# block-python-write.sh — Block Write tool for .py files.
# Hook: PreToolUse (Write matcher)
# Prevents Claude from creating temporary Python scripts; all operations go through schema_engine.py.

set -u

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')

if [[ "$file_path" =~ \.py$ ]]; then
  echo "BLOCK: Writing .py files is not allowed in the object-customization plugin."
  echo "Use schema_engine.py CLI commands instead of creating new Python scripts."
  echo "File attempted: $file_path"
  exit 2
fi

exit 0
