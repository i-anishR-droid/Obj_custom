---
name: DevRev Object Model
description: This skill should be used when the user asks about "DevRev schemas", "schema fragments", "field dependencies", "conditional fields", "stage customization", "subtype creation", "tenant fragments", "custom type fragments", "DevRev APIs", or mentions "schemas.custom.list", "schemas.custom.set", "stages.custom.list", "schemas.subtypes.list". Provides comprehensive knowledge about DevRev object customization framework.
version: 0.2.0
---

# DevRev Object Model Skill

## Schema Fragment Types

| Type | Purpose | Key fields |
|---|---|---|
| `tenant_fragment` | Org-wide fields for all objects of a leaf type | `leaf_type`, `fields`, `conditions`, `stock_field_overrides` |
| `custom_type_fragment` | Fields specific to one subtype | `leaf_type`, `subtype`, `subtype_display_name`, `fields`, `conditions` |
| `app_fragment` | Fields added by a snap-in | `leaf_type`, `app`, `fields` |

## Leaf Types

`ticket`, `issue`, `conversation`

## DON ID Format

```
don:core:{region}:{devo}/{org_id}:{resource_type}/{id}
```

Use **resolve-don** tool (`tools/resolve-don.md`) to convert names to DON IDs.

## Field Structure

```json
{
  "name": "customer_name",
  "field_type": "text",
  "is_required": false,
  "ui": {"display_name": "Customer Name", "order": 3}
}
```

## Condition Structure

```json
{
  "expression": "custom_fields.priority == 'high'",
  "effects": [{"fields": ["custom_fields.escalation_notes"], "show": true}]
}
```

## Stock Field Override

```json
{
  "stock_field_overrides": [
    {"name": "applies_to_part", "ui": {"order": 1}},
    {"name": "group", "ui": {"search_query": "custom_fields.tnt__parts:$object.applies_to_part"}}
  ]
}
```

## States

| Name | DON | 
|---|---|
| open | `custom_state/1` |
| in_progress | `custom_state/2` |
| closed | `custom_state/3` |

## Tool Operations

All operations are documented in individual tool files under `tools/`. See `tools/` directory or load the **schema-engine** skill for the full index.
