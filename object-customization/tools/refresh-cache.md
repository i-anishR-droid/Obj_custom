---
name: refresh-cache
description: Pull latest schemas, stages, states, subtypes, and fragments from DevRev API into .cache/schemas/. Run this before any build operation to ensure data freshness.
---

# Refresh Cache Tool

Pulls the latest schema data from DevRev into the local cache.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/refresh_cache.py
```

## What It Fetches

- `stages.json` — all custom stages
- `states.json` — all custom states  
- `stage-diagrams.json` — all stage diagrams
- `subtypes_ticket.json`, `subtypes_issue.json`, `subtypes_conversation.json`
- `tenant_fragments_ticket.json`, `tenant_fragments_issue.json`, `tenant_fragments_conversation.json`
- `custom_type_fragments_ticket.json`, `custom_type_fragments_issue.json`, `custom_type_fragments_conversation.json`

## When to Use

- Before any `--init --load-from-cache` operation
- When the user says "refresh", "sync", or "pull latest"
- After a publish completes (to pick up new state)
- At the start of a new customization session

## Output

Prints each file saved with byte size. Exits 0 on success.
