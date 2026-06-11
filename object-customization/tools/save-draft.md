---
name: save-draft
description: Save a validated working payload as a draft for the Chrome extension to display. The user reviews and clicks Publish in the extension.
---

# Save Draft Tool

Copies a validated payload to `state/drafts/` where the Chrome extension picks it up.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py \
  --payload-file state/payloads/working/<file>.json \
  --save-draft
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `--payload-file` | Yes | Path to working payload |
| `--save-draft` | Yes | Write to drafts directory |

## Output

Creates a timestamped file in `state/drafts/`:
```
state/drafts/{leaf_type}_{subtype}_fields_{timestamp}.json
state/drafts/{leaf_type}_{subtype}_deps_{timestamp}.json
state/drafts/stage_diagram_{leaf_type}_{subtype}_{timestamp}.json
```

Includes `_original` field for side-by-side comparison in the Chrome extension.

## What Happens Next

1. Chrome extension reads `state/drafts/` directory
2. Banner shows "N pending changes [Publish]"
3. User sees: Current (Live) vs Proposed (Draft) comparison
4. User clicks **Publish** → extension POSTs to DevRev API
5. On success, draft file is deleted

## CRITICAL

- **NEVER use `--publish`** — always `--save-draft`
- **Validate first** — run `--validate` before saving
- The human makes the final publish decision in the Chrome extension
