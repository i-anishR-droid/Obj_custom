---
name: Field Operations and Management
description: This skill should be used when creating, updating, or managing DevRev custom fields. Use when the user mentions "create fields", "add fields", "reorder fields", "field ordering", "change field order", "toggle hidden", "make field required", "change allowed values", "stock field overrides", "group creation", "group visibility", "group management", or any field configuration operations.
version: 0.2.0
---

# Set Fields Skill

Route to these tools in order:

1. **refresh-cache** — sync latest schema from DevRev
2. **list-subtypes** — find available subtypes for the leaf type
3. **list-fields** — check existing fields to avoid duplicates
4. **init-payload** — create working payload (always `--load-from-cache`)
5. **add-fields** — append new fields to the payload
6. **validate-payload** — ensure correctness
7. **save-draft** — write to `state/drafts/` for Chrome extension (NEVER `--publish`)

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

## Tool Reference

See `tools/` directory for full usage of each tool:
- `tools/refresh-cache.md`
- `tools/list-subtypes.md`
- `tools/list-fields.md`
- `tools/init-payload.md`
- `tools/add-fields.md`
- `tools/validate-payload.md`
- `tools/save-draft.md`
- `tools/resolve-don.md` (for group/part visibility conditions)

## Reordering Fields

Custom fields: update `ui.order` via `--add-fields` (merges on collision).
Stock fields: use `stock_field_overrides` array in the payload.

## Group Management

1. Create group via DevRev API
2. Use **resolve-don** to get Part DON ID
3. Update `stock_field_overrides` with `search_query`
4. Map group to part via API

## Field Types

**Simple**: text, rich_text, int, double, bool, date, timestamp
**Complex**: enum (needs `allowed_values`), id (needs `id_type`)
**Array**: only `text` and `id` support `is_array: true`
