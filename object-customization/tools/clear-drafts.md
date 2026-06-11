---
name: clear-drafts
description: Delete all pending drafts without publishing. Use to discard unwanted changes.
---

# Clear Drafts Tool

Removes all draft files from `state/drafts/` without publishing them.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/draft_manager.py --clear
```

## Via Draft Server (if running)

```bash
curl -s -X DELETE http://127.0.0.1:7432/drafts
```

## When to Use

- User wants to discard all pending changes
- Starting fresh after failed attempts
- After a manual publish when drafts weren't auto-cleaned

## WARNING

This does NOT publish the drafts — it discards them permanently. Ask the user for confirmation before running.
