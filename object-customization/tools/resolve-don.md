---
name: resolve-don
description: Resolve human-readable names to DevRev DON IDs for parts, groups, stages, users, and subtypes.
---

# Resolve DON ID Tool

Converts human-readable names to DevRev DON IDs needed in expressions and payloads.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/don_resolver.py --type <resource_type> --name "<name>" [--leaf-type <leaf_type>]
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `--type` | Yes | `part`, `group`, `stage`, `subtype`, `user` |
| `--name` | Yes | Human-readable name to resolve |
| `--leaf-type` | For subtypes | `ticket`, `issue`, `conversation` |

## Examples

```bash
# Resolve a part
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/don_resolver.py --type part --name "UPI"
# → don:core:dvrv-in-1:devo/214EXTd0bi:capability/5

# Resolve a group
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/don_resolver.py --type group --name "One Touch Escalations"
# → don:identity:dvrv-in-1:devo/214EXTd0bi:group/72

# Resolve a stage
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/don_resolver.py --type stage --name "resolved"
# → don:core:dvrv-in-1:devo/214EXTd0bi:custom_stage/25

# Resolve a subtype
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/don_resolver.py --type subtype --name "L1 Support" --leaf-type ticket
# → don:core:dvrv-in-1:devo/214EXTd0bi:custom_type/3
```

## DON ID Format

```
don:core:{region}:{devo}/{org_id}:{resource_type}/{id}
```

## When to Use

- Before writing condition expressions that reference parts, stages, or groups
- When building stage diagrams (need stage DON IDs)
- When creating group-visibility stock field overrides
