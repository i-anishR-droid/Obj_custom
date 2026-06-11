---
name: list-subtypes
description: List all subtypes for a given leaf type (ticket, issue, conversation) from the local cache.
---

# List Subtypes Tool

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py --list-subtype --leaf-type <leaf_type>
```

## Parameters

| Parameter | Required | Values |
|---|---|---|
| `--leaf-type` | Yes | `ticket`, `issue`, `conversation` |

## Output

Prints subtype names (one per line), or "No subtypes found for {leaf_type}." if none exist.

## Example

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py --list-subtype --leaf-type ticket
```

Output:
```
l1_support
l2_support
```
