---
name: add-conditions
description: Add field dependency conditions (cascading dropdowns, conditional show/hide, conditional require, allowed_values restrictions) to a working payload.
---

# Add Conditions Tool

Appends condition rules to an existing working payload for field dependencies.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/schema_engine.py \
  --payload-file state/payloads/working/<file>.json \
  --add-conditions '<json_array>'
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `--payload-file` | Yes | Path to working payload |
| `--add-conditions` | Yes | JSON array of condition objects |

## Condition Object Structure

```json
{
  "expression": "custom_fields.issue_type == 'Billing'",
  "effects": [
    {
      "fields": ["custom_fields.sub_issue_type"],
      "allowed_values": ["Invoice", "Payment", "Refund"]
    }
  ]
}
```

## Expression Operators

ONLY these are accepted by the API:

| Operator | Usage |
|---|---|
| `==` | Equals |
| `!=` | Not equals |
| `&&` | Logical AND |
| `||` | Logical OR |

**`in` and `not in` are NOT supported.** Expand to OR chains instead.

## Effect Types

| Effect | Values | Purpose |
|---|---|---|
| `show` | `true` / `false` | Show/hide a field |
| `require` | `true` / `false` | Make field required/optional |
| `allowed_values` | `["val1", ...]` | Restrict enum options |

## CRITICAL Rules

1. **Use `name` not `data_name`** in expressions: `custom_fields.priority` not `custom_fields.tnt__priority`
2. **ONE payload per trigger**: All values for a single expression MUST be in one condition. Multiple conditions with same expression → last wins.
3. **Combo conditions** for ambiguous cases: `( custom_fields.l1 == 'X' ) && ( custom_fields.l2 == 'Y' )`

## Common Patterns

### Cascading Dropdown (L1 → L2)
```json
{"expression": "custom_fields.category == 'Billing'", "effects": [{"fields": ["custom_fields.sub_category"], "allowed_values": ["Invoice", "Refund"]}]}
```

### Conditional Visibility
```json
{"expression": "custom_fields.priority == 'high'", "effects": [{"fields": ["custom_fields.escalation_notes"], "show": true}]}
```

### Conditional Requirement
```json
{"expression": "custom_fields.severity == 'critical'", "effects": [{"fields": ["custom_fields.root_cause"], "require": true}]}
```

### Stock Field in Expression
```json
{"expression": "applies_to_part == 'don:core:dvrv-in-1:devo/214EXTd0bi:capability/5'", "effects": [{"fields": ["custom_fields.issue_category_l1"], "allowed_values": ["UPI", "Cards"]}]}
```
