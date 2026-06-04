---
name: DevRev Object Model
description: This skill should be used when the user asks about "DevRev schemas", "schema fragments", "field dependencies", "conditional fields", "stage customization", "subtype creation", "tenant fragments", "custom type fragments", "DevRev APIs", or mentions "schemas.custom.list", "schemas.custom.set", "stages.custom.list", "schemas.subtypes.list". Provides comprehensive knowledge about DevRev object customization framework.
version: 0.1.0
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
Examples:
- Part: `don:core:dvrv-us-1:devo/xxx:capability/5`
- Group: `don:identity:dvrv-us-1:devo/xxx:group/72`
- Stage: `don:core:dvrv-us-1:devo/xxx:custom_stage/25`
- State: `don:core:dvrv-us-1:devo/xxx:custom_state/2`
- Stage diagram: `don:core:dvrv-us-1:devo/xxx:stage_diagram/8`

## Field Structure

```json
{
  "name": "customer_name",
  "field_type": "text",
  "is_required": false,
  "ui": {
    "display_name": "Customer Name",
    "order": 3,
    "is_hidden_during_create": false,
    "create_view": {"is_hidden": false}
  }
}
```

## Enum Field Structure

```json
{
  "name": "priority",
  "field_type": "enum",
  "allowed_values": ["low", "medium", "high"],
  "is_required": false,
  "ui": {"display_name": "Priority", "order": 1}
}
```

## ID Reference Field

```json
{
  "name": "related_account",
  "field_type": "id",
  "id_type": ["account"],
  "is_required": false,
  "ui": {"display_name": "Related Account", "order": 5}
}
```

## Condition Structure

```json
{
  "expression": "custom_fields.priority == 'high'",
  "effects": [
    {
      "fields": ["custom_fields.escalation_notes"],
      "show": true
    }
  ]
}
```

## Stock Field Override (reordering stock fields)

```json
{
  "stock_field_overrides": [
    {
      "name": "applies_to_part",
      "ui": {"order": 1}
    },
    {
      "name": "group",
      "ui": {
        "order": 2,
        "search_query": "custom_fields.tnt__parts:$object.applies_to_part"
      }
    }
  ]
}
```

## Stage Structure

```json
{
  "name": "in_progress",
  "ordinal": 2000,
  "state": "don:core:...:custom_state/2",
  "ui": {"display_name": "In Progress"}
}
```

## States

Standard states (usually pre-created):
- `open` — `custom_state/1`
- `in_progress` — `custom_state/2`
- `closed` — `custom_state/3`

## Key Reference Files

- `references/field-types.md` — complete field type reference
- `references/api-payload-examples.md` — minimal correct API payload examples
- `references/api-responses.md` — sample API response shapes
- `references/expression-patterns.md` — expression syntax and operator rules
- `examples/condition-examples.json` — real condition payload examples
