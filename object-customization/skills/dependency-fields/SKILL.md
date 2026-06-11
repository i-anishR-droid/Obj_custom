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

**`in` and `not in` are NOT supported.** Expand to OR chains:
```json
// ❌ Rejected: "custom_fields.priority in ['high', 'critical']"
// ✅ Use: "custom_fields.priority == 'high' || custom_fields.priority == 'critical'"
```

## CRITICAL Rules

1. **Use `name` not `data_name`**: `custom_fields.priority` not `custom_fields.tnt__priority`
2. **ONE payload per trigger**: All values for the same expression in one condition object
3. **Combo conditions** for ambiguous mappings: `( custom_fields.l1 == 'X' ) && ( custom_fields.l2 == 'Y' )`

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

## Effect Types

| Effect | Values |
|---|---|
| `show` | `true` / `false` |
| `require` | `true` / `false` |
| `allowed_values` | `["value1", "value2", ...]` |
