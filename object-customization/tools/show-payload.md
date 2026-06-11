---
name: show-payload
description: Print the current working payload as formatted JSON for inspection.
---

# Show Payload Tool

Displays the current state of a working payload file.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py \
  --payload-file state/payloads/working/<file>.json \
  --show
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `--payload-file` | Yes | Path to working payload |
| `--show` | Yes | Print as JSON |

## When to Use

- To inspect what fields/conditions are in a payload before saving
- To debug validation errors
- To show the user what will be published
