---
name: export-draft
description: Show all pending draft changes saved by this plugin and confirm they are visible in the Chrome extension banner. Optionally clear all drafts.
allowed-tools: ["Bash", "Read"]
---

# Export Draft Command

Show all pending draft changes and their status in the Chrome extension.

## What This Command Does

1. Lists all files in `state/drafts/`
2. Summarises each draft (leaf type, subtype, operation, field/stage count)
3. Confirms the Chrome extension banner will pick them up
4. Optionally clears all drafts (use with caution — this does NOT publish them)

## Quick Start

- "Show me what drafts are pending"
- "How many pending changes does the Chrome extension show?"
- "Clear all drafts" — cancels all pending changes without publishing

---

## Show Pending Drafts

```bash
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/draft_manager.py --list
```

**Output example:**
```
Pending drafts (3):

  1. ticket_l1_support_fields_20260603_141523.json
     Type: schema_fields | Leaf: ticket | Subtype: l1_support
     Fields: 3 | Conditions: 0
     Created: 2026-06-03 14:15:23

  2. ticket_l1_support_deps_20260603_141801.json
     Type: schema_conditions | Leaf: ticket | Subtype: l1_support
     Fields: 0 | Conditions: 2
     Created: 2026-06-03 14:18:01

  3. stage_diagram_ticket_l1_support_20260603_142100.json
     Type: stage_diagram | Leaf: ticket | Name: l1_support_transitions
     Stages: 4
     Created: 2026-06-03 14:21:00

Chrome extension banner will show: "3 pending changes  [Publish]"
```

---

## View a Specific Draft

```bash
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/draft_manager.py --show ticket_l1_support_fields_20260603_141523.json
```

---

## Clear All Drafts

```bash
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/draft_manager.py --clear
```

⚠️  This discards all pending changes without publishing them.

---

## How the Chrome Extension Reads Drafts

The extension's `service-worker.js` exposes a message handler `getDrafts` that reads `state/drafts/` via a path configured in the extension's storage (key: `draftDir`). When the user clicks **Publish**:

1. Extension calls `draft_manager.py --publish-all` (or iterates drafts and POSTs each)
2. Each draft is POSTed to DevRev API (`schemas.custom.set` or `stage-diagrams.create/update`)
3. On success, the draft file is deleted
4. Banner count decrements; disappears when count reaches 0

---

## Related Commands

- `/object-customization:set-fields` — Create field drafts
- `/object-customization:dependency-fields` — Create dependency drafts
- `/object-customization:stage-diagrams` — Create stage diagram drafts
