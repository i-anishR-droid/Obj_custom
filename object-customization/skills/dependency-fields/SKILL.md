---
name: Field Dependencies and Conditions
description: This skill should be used when the user mentions "cascading dropdowns", "conditional fields", "show field when", "hide field when", "make field required when", "field dependencies", "L1 L2 L3 categories", "conditional visibility", "allowed values based on", or any condition/dependency-related field operations.
version: 0.2.0
---

# Dependency Fields Skill

Route to these tools in order:

1. **refresh-cache** — sync latest schema
2. **list-fields** — verify referenced fields exist
3. **init-payload** — create working payload (always `--load-from-cache`)
4. **add-conditions** — append dependency rules
5. **validate-payload** — ensure correctness
6. **save-draft** — write to `state/drafts/`

## Tool Reference

See `tools/` directory:
- `tools/refresh-cache.md`
- `tools/list-fields.md`
- `tools/init-payload.md`
- `tools/add-conditions.md`
- `tools/validate-payload.md`
- `tools/save-draft.md`
- `tools/resolve-don.md` (for part/stage/group DON IDs in expressions)

## Expression Operators

ONLY these four are accepted by `schemas.custom.set`. The API rejects anything else with `Parse error: expected [== && || !=] operators, got <op>`.

| Operator | Usage |
|---|---|
| `==` | Equals |
| `!=` | Not equals |
| `&&` | Logical AND |
| `\|\|` | Logical OR |

❌ `in` and `not in` are NOT supported. To match against a list, expand to OR chains:

```json
// ❌ Rejected by API:
{"expression": "custom_fields.priority in ['high', 'critical']"}

// ✅ Use this instead:
{"expression": "custom_fields.priority == 'high' || custom_fields.priority == 'critical'"}
```

## CRITICAL: Use `name`, NOT `data_name` (no `tnt__` prefix)

The cached/published schema shows custom tenant fields with `data_name: "tnt__priority"` and `name: "priority"`. **Conditions must reference the `name`** in both `expression` and `effects[].fields`.

❌ `custom_fields.tnt__priority == 'high'` → API: `non-existent custom field tnt__priority provided in conditions`
✅ `custom_fields.priority == 'high'`

Same rule applies in `effects[].fields`:
```json
{"effects": [{"fields": ["custom_fields.escalation_notes"], "show": true}]}  // ✅
{"effects": [{"fields": ["custom_fields.tnt__escalation_notes"], "show": true}]}  // ❌
```

## CRITICAL: ONE Payload Per Trigger

All values for the same expression in one condition object. Multiple conditions with same expression → last wins.

## Common Patterns

### Cascading Dropdown (L1 → L2)
```json
{"expression": "custom_fields.issue_type == 'Billing'", "effects": [{"fields": ["custom_fields.sub_issue_type"], "allowed_values": ["Invoice", "Payment"]}]}
```

### Conditional Visibility
```json
{"expression": "custom_fields.priority == 'high' || custom_fields.priority == 'critical'", "effects": [{"fields": ["custom_fields.escalation_notes"], "show": true}]}
```

### Conditional Requirement
```json
{"expression": "custom_fields.severity == 'critical'", "effects": [{"fields": ["custom_fields.root_cause"], "require": true}]}
```

### Combo conditions for ambiguous mappings
```json
{"expression": "( custom_fields.l1 == 'X' ) && ( custom_fields.l2 == 'Y' )", "effects": [{"fields": ["custom_fields.l3"], "allowed_values": ["A", "B"]}]}
```

## Effect Types

| Effect | Values |
|---|---|
| `show` | `true` / `false` |
| `require` | `true` / `false` |
| `allowed_values` | `["value1", "value2", ...]` |
