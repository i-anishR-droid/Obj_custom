---
name: list-fields
description: List all existing fields for a subtype or tenant fragment from the local cache.
---

# List Fields Tool

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py --list-fields --leaf-type <leaf_type> [--subtype "<subtype>"]
```

## Parameters

| Parameter | Required | Values |
|---|---|---|
| `--leaf-type` | Yes | `ticket`, `issue`, `conversation` |
| `--subtype` | No | Subtype name (omit for tenant-level fields) |

## Output

Table of field names, types, and key properties.

## Example

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py --list-fields --leaf-type ticket --subtype "l1_support"
```
