---
name: init-stage-diagram
description: Initialize a stage diagram payload for a leaf type and subtype. Hydrates existing diagram from cache.
---

# Init Stage Diagram Tool

Creates a new working stage diagram payload file.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py \
  --init-stage-diagram --load-from-cache --leaf-type <leaf_type> --subtype "<subtype>"
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `--init-stage-diagram` | Yes | Create stage diagram payload |
| `--load-from-cache` | Recommended | Hydrate from cached diagram (preserves existing stages) |
| `--leaf-type` | Yes | `ticket`, `issue`, `conversation` |
| `--subtype` | Yes | Subtype name |

## Output

Creates: `state/payloads/working/{leaf_type}_{subtype}_stage_diagram.json`

## Stage Diagram Structure

```json
{
  "leaf_type": "ticket",
  "name": "l1_support_transitions",
  "stages": [
    {
      "stage_id": "don:core:...:custom_stage/10",
      "is_start": true,
      "is_deprecated": false,
      "transitions": [
        {"target_stage_id": "don:core:...:custom_stage/20"}
      ]
    }
  ]
}
```

**DO NOT include** in stage diagrams: `subtype`, `fields`, `description`, `subtype_display_name`
