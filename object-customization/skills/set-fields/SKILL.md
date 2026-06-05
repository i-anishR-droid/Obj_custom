---
name: Field Operations and Management
description: This skill should be used when creating, updating, or managing DevRev custom fields. Use when the user mentions "create fields", "add fields", "reorder fields", "field ordering", "change field order", "toggle hidden", "make field required", "change allowed values", "stock field overrides", "group creation", "group visibility", "group management", or any field configuration operations.
version: 0.1.0
---

# Set Fields Skill

## Field Creation Workflow

1. Check if subtype exists: `schema_engine.py --list-subtype`
2. List existing fields: `schema_engine.py --subtype "X" --list-fields`
3. Initialize payload (hydrates from cache to preserve existing data): `--init --load-from-cache`
4. Add new fields: `--add-fields '[...]'`
5. Validate: `--validate`
6. Save draft: `--save-draft` (NEVER `--publish` — see [customize](../customize/SKILL.md))

## Handling name collisions (Skipping duplicate field)

When the user wants to "add" a field but `--load-from-cache` already pulled an existing one with the same `name`, `--add-fields` will print:
```
  Skipping duplicate field: <name>
```

**Do NOT accept the skip as done** — the existing field probably has stale `allowed_values` or wrong UI settings for what the user wants. Merge instead:

1. Open the working payload (`state/payloads/working/<file>.json`)
2. Locate the existing field entry — **preserve** these keys (the API requires them and they came from the live schema): `data_name`, `db_name`, `oasis`, `dql_filter_ops`, `supported_filter_ops`, `ordinal`
3. Overwrite ONLY what the user asked to change (`allowed_values`, `ui.display_name`, `ui.is_hidden_during_create`, `ui.create_view.is_hidden`, `is_required`, etc.)
4. If a duplicate "new" copy of the field was appended by your earlier `--add-fields` (i.e., the user-side script added a second entry), delete it
5. Re-validate, re-save the draft

After merge, the Chrome extension diff should show the field as **modified**, not **added**.

## Reordering Patterns

### Custom fields — update `ui.order` directly
```json
{"name": "priority", "ui": {"order": 1}}
```

### Stock fields — use `stock_field_overrides`
```json
{"stock_field_overrides": [{"name": "applies_to_part", "ui": {"order": 1}}]}
```

### Subtype fields — update individual subtype schema (one subtype at a time)

## Group Management

### Create group
```
POST /groups.create {"name": "...", "member_type": "dev_user", "type": "static"}
```
Returns Group DON ID — store it.

### Part-specific group visibility (two steps)

Step 1 — update `stock_field_override` for group:
```json
{
  "name": "group",
  "ui": {"search_query": "custom_fields.tnt__parts:$object.applies_to_part"}
}
```

Step 2 — map group to part:
```
POST /groups.update {"id": "don:identity:...:group/72", "custom_fields": {"tnt__parts": ["don:...:capability/5"]}}
```

## Conditional Requirements Pattern

For subtype fields (custom_type_fragment):
```json
{
  "expression": "( applies_to_part == 'don:...:capability/5' ) && ( stage == 'don:...:custom_stage/25' )",
  "effects": [{"fields": ["custom_fields.rrn_number"], "require": true}]
}
```

For tenant fields (tenant_fragment) — must also include `subtype` check:
```json
{
  "expression": "( applies_to_part == 'don:...:capability/5' ) && ( subtype == 'l1_support' )",
  "effects": [{"fields": ["custom_fields.customer_id"], "require": true}]
}
```

## Resource DON ID Resolution

```bash
# Parts
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/don_resolver.py --type part --name "UPI"

# Groups
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/don_resolver.py --type group --name "One Touch Escalations"

# Stages
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/don_resolver.py --type stage --name "resolved"

# Subtypes
${CLAUDE_PLUGIN_ROOT}/../../.venvs/object-customization/bin/python3 ${CLAUDE_PLUGIN_ROOT}/scripts/don_resolver.py --type subtype --name "L1 Support" --leaf-type ticket
```
