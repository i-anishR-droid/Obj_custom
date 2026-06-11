---
name: add-stages
description: Add stages with transitions to a stage diagram payload. Each stage has a DON ID, start flag, and list of allowed transitions.
---

# Add Stages Tool

Appends stages (with their transitions) to an existing stage diagram working file.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py \
  --payload-file state/payloads/working/<file>_stage_diagram.json \
  --add-stages '<json_array>'
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `--payload-file` | Yes | Path to stage diagram working file |
| `--add-stages` | Yes | JSON array of stage objects |

## Stage Object Structure

```json
{
  "stage_id": "don:core:dvrv-in-1:devo/214EXTd0bi:custom_stage/10",
  "is_start": true,
  "is_deprecated": false,
  "transitions": [
    {"target_stage_id": "don:core:dvrv-in-1:devo/214EXTd0bi:custom_stage/20"}
  ]
}
```

## Rules

- Exactly ONE stage must have `is_start: true`
- All `target_stage_id` values must reference stages present in the `stages` array
- Deprecated stages MUST have at least one outgoing transition (exit path)
- Transitions are nested INSIDE each stage, not at top level

## Workflow Patterns

| Pattern | Transitions |
|---|---|
| Linear | Each stage → next only |
| Branching | Start → multiple targets |
| Cyclic | A ⇄ B (bidirectional) |

## Resolving Stage DON IDs

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/don_resolver.py --type stage --name "in_progress"
```
