---
name: Stage Diagrams and Subtypes
description: This skill should be used when the user mentions "stage diagram", "workflow stages", "stage transitions", "create subtype", "subtype creation", "ticket workflow", "issue stages", "stage diagram builder", "linear workflow", "branching workflow", or any stage/state/subtype configuration operations.
version: 0.2.0
---

# Stage Diagrams Skill

Route to these tools in order:

1. **refresh-cache** — sync latest stages/diagrams
2. **list-subtypes** — find existing subtypes
3. **resolve-don** — get stage DON IDs
4. **init-stage-diagram** — create working diagram payload
5. **add-stages** — define stages and transitions
6. **validate-payload** — ensure correctness
7. **save-draft** — write to `state/drafts/`

## Tool Reference

See `tools/` directory:
- `tools/refresh-cache.md`
- `tools/list-subtypes.md`
- `tools/resolve-don.md`
- `tools/init-stage-diagram.md`
- `tools/add-stages.md`
- `tools/validate-payload.md`
- `tools/save-draft.md`

## Core Concepts

- **Stage** — a named step (`in_progress`, `resolved`). Has a state and ordinal.
- **State** — broad lifecycle: `open`, `in_progress`, `closed`
- **Stage Diagram** — directed graph of stages + allowed transitions
- **Subtype** — named variant of a leaf type with its own schema

## Stage Diagram Structure

Transitions are NESTED INSIDE each stage:
```json
{
  "leaf_type": "ticket",
  "name": "l1_support_transitions",
  "stages": [
    {"stage_id": "don:...:custom_stage/10", "is_start": true, "transitions": [{"target_stage_id": "don:...:custom_stage/20"}]},
    {"stage_id": "don:...:custom_stage/20", "is_start": false, "transitions": []}
  ]
}
```

**DO NOT include**: `subtype`, `fields`, `description`

## Workflow Patterns

| Pattern | Description |
|---|---|
| Linear | Each stage → next only |
| Branching | Start → multiple targets |
| Cyclic | A ⇄ B (bidirectional) |

## Naming

- Stage names: snake_case — "In Progress" → `in_progress`
- Ordinals: space at 1000 increments
- Exactly one `is_start: true` stage
- Deprecated stages MUST have exit transitions
