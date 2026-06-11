---
name: add-fields
description: Add one or more custom fields to an existing working payload. Supports text, enum, bool, int, double, date, timestamp, id, rich_text field types.
---

# Add Fields Tool

Appends fields to an existing working payload file.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py \
  --payload-file state/payloads/working/<file>.json \
  --add-fields '<json_array>'
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `--payload-file` | Yes | Path to the working payload file |
| `--add-fields` | Yes | JSON array of field objects |

## Field Object Structure

```json
{
  "name": "field_name",
  "field_type": "enum",
  "allowed_values": ["val1", "val2"],
  "is_required": false,
  "ui": {
    "display_name": "Field Name",
    "order": 1,
    "is_hidden_during_create": false
  }
}
```

## Field Types

| Type | Extra fields needed |
|---|---|
| `text` | none |
| `rich_text` | none |
| `enum` | `allowed_values: [...]` |
| `bool` | none |
| `int` | none |
| `double` | none |
| `date` | none |
| `timestamp` | none |
| `id` | `id_type: ["account"]` (valid: devu, revu, account, part, product, revo) |

## Naming Convention

- Always snake_case: "Customer Name" → `customer_name`
- Display name goes in `ui.display_name`

## Example

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py \
  --payload-file state/payloads/working/ticket_tenant.json \
  --add-fields '[{"name": "priority", "field_type": "enum", "allowed_values": ["low", "medium", "high"], "ui": {"display_name": "Priority", "order": 1}}]'
```

## Collision Handling

If a field with the same `name` already exists in the payload, the engine merges properties — preserving `data_name` and overwriting only the properties you specify.
