---
name: validate-payload
description: Validate a working payload for correctness — checks field types, condition expressions, stage references, and API compliance.
---

# Validate Payload Tool

Runs validation against a working payload file before saving as draft.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py \
  --payload-file state/payloads/working/<file>.json \
  --validate
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `--payload-file` | Yes | Path to working payload |
| `--validate` | Yes | Run validation |

## What It Checks

### Fields
- Names are snake_case
- Enum fields have `allowed_values`
- ID fields have valid `id_type`
- No duplicate field names
- `ui.order` values are unique

### Conditions
- Expression syntax valid (only `==`, `!=`, `&&`, `||`)
- Referenced fields exist
- No duplicate trigger expressions
- Effects array not empty

### Stage Diagrams
- Exactly one `is_start: true`
- All target_stage_ids reference existing stages
- Deprecated stages have exit transitions

## Output

- `✅ Validation passed` — safe to save draft
- Error messages with specific field/condition indices on failure

## CRITICAL

Always validate BEFORE `--save-draft`. The draft system does not validate on write.
