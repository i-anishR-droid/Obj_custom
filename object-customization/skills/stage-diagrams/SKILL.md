---
name: Stage Diagrams and Subtypes
description: This skill should be used when the user mentions "stage diagram", "workflow stages", "stage transitions", "create subtype", "subtype creation", "ticket workflow", "issue stages", "stage diagram builder", "linear workflow", "branching workflow", or any stage/state/subtype configuration operations.
version: 0.1.0
---

# Stage Diagrams Skill

## Core Concepts

**Stage** — a named step in a workflow (`in_progress`, `resolved`). Has a `state` (open/in_progress/closed) and `ordinal` for ordering.

**State** — the broad lifecycle category a stage maps to. Pre-created: `open`, `in_progress`, `closed`.

**Stage Diagram** — a directed graph of stages and allowed transitions. NOT subtype-specific — one diagram can be shared across subtypes.

**Subtype** — a named variant of a leaf type (e.g., "L1 Support" for tickets). Has its own field schema and can reference a stage diagram.

## Stage Diagram Payload (CORRECT structure)

Transitions are NESTED INSIDE each stage. Only include: `leaf_type`, `name`, `stages`.

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
    },
    {
      "stage_id": "don:core:...:custom_stage/20",
      "is_start": false,
      "is_deprecated": false,
      "transitions": []
    }
  ]
}
```

**DO NOT include**: `subtype`, `fields`, `description`, `subtype_display_name`

## Hydration (Non-Negotiable)

Always load existing diagram from cache before updating:
```bash
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --init-stage-diagram --load-from-cache --subtype "L1 Support"
```

This prevents data loss by including ALL existing stages/transitions in the working file.

## Stage Naming

- snake_case: "In Progress" → `in_progress`, "Needs Triage" → `needs_triage`
- Ordinals: space stages at 1000 increments (1000, 2000, 3000) for easy insertion

## Workflow Patterns

### Linear: New → In Progress → Resolved → Closed
Each stage transitions only to the next.

### Branching: New → (Triage → Resolved) OR (Rejected)
Start stage has two outgoing transitions.

### Cyclic: New → In Progress ⇄ Review → Resolved
In Progress and Review can transition to each other.

## Deprecating a Stage

Set `is_deprecated: true` AND provide at least one outgoing transition (exit path):
```json
{"stage_id": "don:...:custom_stage/99", "is_deprecated": true, "transitions": [{"target_stage_id": "don:...:custom_stage/20"}]}
```

## Draft Flow for Stage Diagrams

```bash
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --payload-file payloads/working/ticket_l1_support_stage_diagram.json \
  --save-draft
```

Draft file: `state/drafts/stage_diagram_ticket_l1_support_20260603_142100.json`
Chrome extension reads this, banner shows "1 pending change [Publish]".
On Publish, extension POSTs to `stage-diagrams.create` or `stage-diagrams.update`.
