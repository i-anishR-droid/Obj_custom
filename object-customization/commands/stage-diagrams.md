---
name: stage-diagrams
description: Create DevRev stage diagrams using schema_engine.py for incremental, validated payload construction. Changes are saved as drafts and surfaced in the Chrome extension for review before publishing.
allowed-tools: ["Read", "AskUserQuestion", "Task"]
---

# Stage Diagram Builder

Create or update stage diagrams for DevRev object subtypes. Stage diagrams define the workflow states and allowed transitions for tickets, issues, or conversations. All changes are **saved as drafts** for review in the Chrome extension.

## What This Command Does

1. Understand stage diagram requirements
2. Find existing stages from cache
3. Build stage diagram with schema_engine
4. Define transitions between stages
5. Validate and save to draft
6. Chrome extension banner shows pending change — click **Publish** to go live

## Prerequisites

- Cache must be up-to-date (`refresh_cache.py`)
- DEVREV_PAT configured in `.env`
- Stages should exist (or be ready to create)

## CRITICAL: Tool Usage Policy

**FORBIDDEN**: Bash tool, heredoc python3 patterns, Write tool for .py files, temp scripts
**REQUIRED**: Task tool → schema-analyzer agent, schema_engine.py exclusively, AskUserQuestion for approval

## Stage Diagram Payload Structure

Transitions are INSIDE each stage. Payload includes only: `leaf_type`, `name`, `stages`.

```json
{
  "leaf_type": "ticket",
  "name": "l1_support_transitions",
  "stages": [
    {
      "stage_id": "don:core:...:custom_stage/10",
      "is_start": true,
      "transitions": [
        {"target_stage_id": "don:core:...:custom_stage/20"}
      ]
    },
    {
      "stage_id": "don:core:...:custom_stage/20",
      "is_start": false,
      "transitions": []
    }
  ]
}
```

**Do NOT include**: `subtype`, `fields`, `description` — stage diagrams are not subtype-specific.

## Workflow

### Step 1: List Existing Resources
```bash
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py --list-subtype
grep -i "stage_name" ${CLAUDE_PLUGIN_ROOT}/.cache/schemas/stages.json
```

### Step 2: Initialize Stage Diagram
```bash
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --init-stage-diagram --leaf-type ticket --subtype "L1 Support"
```

### Step 3: Add Stages with Transitions
```bash
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --payload-file payloads/working/ticket_l1_support_stage_diagram.json \
  --add-stages '[{"stage_id": "don:...", "is_start": true, "transitions": [...]}]'
```

### Step 4: Validate
```bash
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --payload-file payloads/working/ticket_l1_support_stage_diagram.json \
  --validate
```

### Step 5: Save Draft
```bash
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/schema_engine.py \
  --payload-file payloads/working/ticket_l1_support_stage_diagram.json \
  --save-draft
```

Chrome extension banner will show the pending stage diagram change.

### Step 6: Publish (via Chrome Extension)
User clicks **Publish** in the extension banner → extension POSTs to `stage-diagrams.create` or `stage-diagrams.update`.

---

## Naming Conventions

- Stage names: snake_case — "In Progress" → `in_progress`
- Subtype display names preserve user case — "L1 Support" stays "L1 Support"
- Exactly one `is_start: true` stage

## Draft Flow

```
schema_engine.py --save-draft
  → state/drafts/stage_diagram_{leaf_type}_{name}_{timestamp}.json
  → Chrome extension banner: "1 pending change [Publish]"
```

## Common Patterns

**Linear**: New → In Progress → Resolved → Closed
**Branching**: New → (Triage → Resolved) OR (Rejected)
**Cyclic**: New → In Progress ⇄ Review → Resolved

## Related Commands

- `/object-customization:set-fields` — Create fields for the subtype first
- `/object-customization:dependency-fields` — Add field dependencies
- `/object-customization:export-draft` — Show all pending drafts
