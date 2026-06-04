#!/bin/bash
# otel-logger.sh — PostToolUse OTel logging for schema operations.
# Captures schema_engine.py, draft_manager.py, and refresh_cache.py invocations.
# Exits 0 always — logging never blocks operations.

set -euo pipefail

input=$(cat)

TOOL_NAME=$(echo "$input" | jq -r '.tool_name // "unknown"')
TOOL_INPUT=$(echo "$input" | jq -c '.tool_input // {}')
TOOL_RESULT=$(echo "$input" | jq -r '.tool_result // ""')

OPERATION="unknown"
STATUS="success"
BODY="Tool $TOOL_NAME executed"
ATTRIBUTES="{}"

case "$TOOL_NAME" in
  "Bash")
    COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // ""')

    if [[ "$COMMAND" =~ schema_engine\.py ]]; then
      if [[ "$COMMAND" =~ --add-fields ]]; then
        OPERATION="add_fields"
        if [[ "$TOOL_RESULT" =~ "added successfully" ]] || [[ "$TOOL_RESULT" =~ "Total fields added:" ]]; then
          STATUS="success"; BODY="Fields added via schema_engine.py"
        else
          STATUS="failed"; BODY="Field addition failed"
        fi

      elif [[ "$COMMAND" =~ --add-conditions ]]; then
        OPERATION="add_conditions"
        if [[ "$TOOL_RESULT" =~ "added successfully" ]] || [[ "$TOOL_RESULT" =~ "Total conditions added:" ]]; then
          STATUS="success"; BODY="Conditions added via schema_engine.py"
        else
          STATUS="failed"; BODY="Condition addition failed"
        fi

      elif [[ "$COMMAND" =~ --add-stages ]]; then
        OPERATION="add_stages"
        if [[ "$TOOL_RESULT" =~ "Total stages added:" ]] || [[ "$TOOL_RESULT" =~ "Added stage:" ]]; then
          STATUS="success"; BODY="Stages added via schema_engine.py"
        else
          STATUS="failed"; BODY="Stage addition failed"
        fi

      elif [[ "$COMMAND" =~ --save-draft ]]; then
        OPERATION="save_draft"
        if [[ "$TOOL_RESULT" =~ "Draft saved" ]] || [[ "$TOOL_RESULT" =~ "state/drafts/" ]]; then
          STATUS="success"; BODY="Draft saved to state/drafts/"
        else
          STATUS="failed"; BODY="Draft save failed"
        fi

      elif [[ "$COMMAND" =~ --publish ]]; then
        OPERATION="publish_schema"
        if [[ "$TOOL_RESULT" =~ "published successfully" ]] || [[ "$TOOL_RESULT" =~ "✅" ]]; then
          STATUS="success"; BODY="Schema published via schema_engine.py"
        else
          STATUS="failed"; BODY="Schema publish failed"
        fi

      elif [[ "$COMMAND" =~ --validate ]]; then
        OPERATION="validate_payload"
        if [[ "$TOOL_RESULT" =~ "validation passed" ]] || [[ "$TOOL_RESULT" =~ "✅" ]]; then
          STATUS="success"; BODY="Payload validated"
        else
          STATUS="failed"; BODY="Validation failed"
        fi

      elif [[ "$COMMAND" =~ --init ]]; then
        OPERATION="init_payload"
        STATUS="success"; BODY="Payload initialized"
      fi

    elif [[ "$COMMAND" =~ draft_manager\.py ]]; then
      OPERATION="draft_manager"
      STATUS="success"; BODY="Draft manager invoked"

    elif [[ "$COMMAND" =~ refresh_cache\.py ]]; then
      OPERATION="refresh_cache"
      if [[ "$TOOL_RESULT" =~ "completed" ]]; then
        STATUS="success"; BODY="Cache refreshed"
      else
        STATUS="failed"; BODY="Cache refresh failed"
      fi
    else
      OPERATION="bash_command"
    fi

    ATTRIBUTES=$(jq -n \
      --arg op "$OPERATION" \
      --arg cmd_preview "${COMMAND:0:120}" \
      '{"operation": $op, "command_preview": $cmd_preview, "tool_name": "Bash"}')
    ;;

  "Write"|"Edit")
    FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // ""')
    OPERATION="${TOOL_NAME,,}_file"
    BODY="File ${TOOL_NAME,,}: $(basename "$FILE_PATH")"
    ATTRIBUTES=$(jq -n --arg fp "$FILE_PATH" --arg t "$TOOL_NAME" '{"file_path": $fp, "tool_name": $t}')
    ;;

  "AskUserQuestion")
    OPERATION="user_interaction"
    BODY="User question asked"
    Q_COUNT=$(echo "$TOOL_INPUT" | jq '.questions | length // 0')
    ATTRIBUTES=$(jq -n --argjson qc "$Q_COUNT" '{"question_count": $qc, "tool_name": "AskUserQuestion"}')
    ;;
esac

"${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3" "${CLAUDE_PLUGIN_ROOT}/scripts/otel_logger.py" \
  --plugin-root "${CLAUDE_PLUGIN_ROOT}" \
  --operation "$OPERATION" \
  --status "$STATUS" \
  --body "$BODY" \
  --attributes "$ATTRIBUTES" \
  2>/dev/null || true

exit 0
