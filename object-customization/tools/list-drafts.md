---
name: list-drafts
description: List all pending draft files awaiting publish in the Chrome extension.
---

# List Drafts Tool

Shows all pending drafts that the Chrome extension will display.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/draft_manager.py --list
```

## Output

Lists each draft with:
- Filename
- Type (schema_fields, schema_conditions, stage_diagram)
- Leaf type and subtype
- Field/condition/stage count
- Created timestamp

## Via Draft Server (if running)

```bash
curl -s http://127.0.0.1:7432/drafts | python3 -m json.tool
```
