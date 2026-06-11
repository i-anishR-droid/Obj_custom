---
name: init-payload
description: Initialize a new schema payload for a leaf type and optional subtype. Hydrates from cache to preserve existing fields and conditions.
---

# Init Payload Tool

Creates a new working payload file, optionally hydrating from cached schema to avoid data loss.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py --init --load-from-cache --leaf-type <leaf_type> [--subtype "<subtype>"]
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `--init` | Yes | Create new payload |
| `--load-from-cache` | Recommended | Hydrate from cached schema (preserves existing fields) |
| `--leaf-type` | Yes | `ticket`, `issue`, `conversation` |
| `--subtype` | No | Subtype name. Omit for tenant-level payload |

## Output

Creates a working file at:
- With subtype: `state/payloads/working/{leaf_type}_{subtype}.json`
- Without subtype (tenant): `state/payloads/working/{leaf_type}_tenant.json`

## CRITICAL

Always use `--load-from-cache` to prevent losing existing fields. Without it, the payload starts empty.

## Example

```bash
# Tenant-level for conversation
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py --init --load-from-cache --leaf-type conversation

# Subtype-specific
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py --init --load-from-cache --leaf-type ticket --subtype "l1_support"
```
