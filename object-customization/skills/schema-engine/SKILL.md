---
name: Schema Engine Reference
description: Reference documentation for schema_engine.py commands. This skill provides complete CLI reference, workflows, and examples. LOAD THIS SKILL when an agent needs detailed information about schema_engine.py commands, flags, validation rules, or troubleshooting.
version: 0.1.0
---

# Schema Engine Skill

`schema_engine.py` is the single CLI tool for all schema payload operations. Always use it — never write Python scripts inline.

## Core Flags

```bash
# Initialize a new payload (load from cache if exists)
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --init --load-from-cache --leaf-type ticket --subtype "L1 Support"

# Add fields to working payload
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --payload-file payloads/working/ticket_l1_support.json \
  --add-fields '[{"name": "priority", "field_type": "enum", "allowed_values": ["low","medium","high"]}]'

# Add conditions
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --payload-file payloads/working/ticket_l1_support.json \
  --add-conditions '[{"expression": "custom_fields.priority == \"high\"", "effects": [{"fields": ["custom_fields.escalation_notes"], "show": true}]}]'

# Initialize a stage diagram payload
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --init-stage-diagram --load-from-cache --leaf-type ticket --subtype "L1 Support"

# Add stages to diagram
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --payload-file payloads/working/ticket_l1_support_stage_diagram.json \
  --add-stages '[{"stage_id": "don:...", "is_start": true, "transitions": []}]'

# Validate payload
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --payload-file payloads/working/ticket_l1_support.json \
  --validate

# Save payload as draft (for Chrome extension to pick up)
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --payload-file payloads/working/ticket_l1_support.json \
  --save-draft

# List existing subtypes
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py --list-subtype

# List fields for a subtype
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py --subtype "L1 Support" --list-fields

# Show current payload content
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --payload-file payloads/working/ticket_l1_support.json --show

# Get examples for fields or stages
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py --get-examples field
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py --get-examples stage
```

## Working File Naming

| Object type | Subtype | Working file |
|---|---|---|
| ticket | l1_support | `payloads/working/ticket_l1_support.json` |
| ticket | l1_support (stage diagram) | `payloads/working/ticket_l1_support_stage_diagram.json` |
| issue | bug | `payloads/working/issue_bug.json` |
| ticket | (tenant) | `payloads/working/ticket_tenant.json` |

## Draft Files

Draft files are written to `state/drafts/` with timestamp:
```
state/drafts/ticket_l1_support_fields_20260603_141523.json
state/drafts/ticket_l1_support_deps_20260603_141801.json
state/drafts/stage_diagram_ticket_l1_support_20260603_142100.json
```

The Chrome extension reads this directory to populate the draft banner.

## --save-draft vs --publish

| Flag | What happens |
|---|---|
| `--save-draft` | Copies payload to `state/drafts/`, Chrome extension will show it |
| `--publish` | POSTs directly to DevRev API — **DO NOT USE on the user's behalf** |

**Agent rule: NEVER call `--publish`.** Stop at `--save-draft`. The human reviews the side-by-side diff in the Chrome extension and clicks Publish themselves. Same applies to direct `curl POST` to `schemas.custom.set` / `stages.custom.set` / any write endpoint — do not bypass the extension.

When a publish fails (user reports an error from the extension):
1. Read the error message the user shares.
2. If you need the raw API response to debug, **ask the user for permission first** before doing a one-shot API call.
3. Fix the payload, re-save the draft, and let the user retry Publish.

## Common publish-time errors and fixes

These errors only surface when the API actually validates the payload (during publish) — `--validate` won't catch them.

| API error message | Cause | Fix |
|---|---|---|
| `Parse error: expected [== && \|\| !=] operators, got in` | Used `in` / `not in` operator in a condition expression | Expand to OR chain: `field == "a" \|\| field == "b"` |
| `non-existent custom field tnt__<name> provided in conditions` | Used the `data_name` (with `tnt__` prefix) instead of `name` | Strip `tnt__` from both `expression` and `effects[].fields`. Use `custom_fields.<name>`, not `custom_fields.tnt__<name>` |
| 401 Unauthorized from `refresh_cache.py` | PAT got truncated when written to `.env` (long JWT, shell escaping) | `wc -c` the PAT in `.env`, compare last 20 chars to user-supplied token, rewrite with `echo "DEVREV_PAT=$VAR" > .env` |
