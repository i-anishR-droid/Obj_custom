---
name: Field Dependencies and Conditions
description: This skill should be used when the user mentions "cascading dropdowns", "conditional fields", "show field when", "hide field when", "make field required when", "field dependencies", "L1 L2 L3 categories", "conditional visibility", "allowed values based on", or any condition/dependency-related field operations.
version: 0.1.0
---

# Dependency Fields Skill

## Cascading Dropdown Pattern (L1 → L2 → L3)

### L1 — values based on Part
```json
{
  "expression": "applies_to_part == 'don:...:capability/5'",
  "effects": [{"fields": ["custom_fields.issue_category_l1"], "allowed_values": ["Billing", "Technical", "Account"]}]
}
```

### L2 — values based on L1 (one condition per L1 value, ALL L2 values in one payload)
```json
{
  "expression": "custom_fields.issue_category_l1 == 'Billing'",
  "effects": [{"fields": ["custom_fields.issue_category_l2"], "allowed_values": ["Invoice", "Payment", "Refund"]}]
}
```

### L3 — values based on L1 AND L2
```json
{
  "expression": "( custom_fields.issue_category_l1 == 'Billing' ) && ( custom_fields.issue_category_l2 == 'Invoice' )",
  "effects": [{"fields": ["custom_fields.issue_category_l3"], "allowed_values": ["Duplicate", "Wrong Amount", "Missing"]}]
}
```

## CRITICAL: ONE Payload Rule

All values for a single trigger expression MUST be in ONE condition. Multiple payloads with the same expression → last one wins, earlier values disappear.

❌ Wrong — two separate conditions for same trigger:
```json
[
  {"expression": "custom_fields.cat == 'billing'", "effects": [{"allowed_values": ["invoice"]}]},
  {"expression": "custom_fields.cat == 'billing'", "effects": [{"allowed_values": ["payment"]}]}
]
```

✅ Correct — all values in ONE condition:
```json
[{"expression": "custom_fields.cat == 'billing'", "effects": [{"allowed_values": ["invoice", "payment"]}]}]
```

## Conditional Visibility Pattern

Field must be hidden by default:
```json
{"name": "escalation_notes", "ui": {"is_hidden_during_create": true, "create_view": {"is_hidden": true}}}
```

Then add show condition:
```json
{
  "expression": "custom_fields.priority in ['high', 'critical']",
  "effects": [{"fields": ["custom_fields.escalation_notes"], "show": true}]
}
```

## Conditional Requirement Pattern

```json
{
  "expression": "custom_fields.severity == 'critical'",
  "effects": [{"fields": ["custom_fields.root_cause", "custom_fields.impact"], "require": true}]
}
```

## Expression Operators

| Operator | Usage |
|---|---|
| `==` | Equals |
| `!=` | Not equals |
| `&&` | Logical AND |
| `\|\|` | Logical OR |
| `in` | Value in list: `custom_fields.priority in ['high', 'critical']` |
| `not in` | Value not in list |

## Effect Types

| Effect | Values |
|---|---|
| `show` | `true` / `false` |
| `require` | `true` / `false` |
| `allowed_values` | `["value1", "value2", ...]` |
