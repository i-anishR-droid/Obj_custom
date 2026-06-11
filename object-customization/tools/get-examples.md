---
name: get-examples
description: Print example JSON for fields, stages, or conditions to guide payload construction.
---

# Get Examples Tool

Prints reference examples for building payloads.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py --get-examples <type>
```

## Parameters

| Parameter | Values |
|---|---|
| `--get-examples` | `field`, `stage`, `condition` |

## Output

Prints formatted JSON examples showing correct structure for the requested type.

## When to Use

- When unsure about the exact JSON structure for a field type
- To remind yourself of the condition expression format
- To show the user what format their data needs to be in
