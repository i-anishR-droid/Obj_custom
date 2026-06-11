# Object Customization Agent Skill

Conversational agent that guides users through DevRev object schema customization. It asks what changes are needed, determines the correct API operations, builds validated payloads, and saves them as drafts for the Chrome extension to display with side-by-side comparison.

## Capabilities

This skill can perform ALL object customization operations:

### Field Operations
- **Add custom fields** — text, enum, bool, int, double, timestamp, id, tokens, array, struct
- **Update field properties** — display name, order, required, filterable, allowed_values
- **Remove fields** — from subtypes or tenant-level schemas
- **Reorder fields** — change ui.order values

### Dependency / Condition Operations
- **Cascading dropdowns** — field B's allowed values depend on field A
- **Conditional show/hide** — show field B only when field A has a certain value
- **Conditional require** — make field B required based on field A's value

### Stage Diagram Operations
- **Create stage diagrams** — define workflow stages for a subtype
- **Add/remove stages** — with transitions between them
- **Set start stage** — define initial workflow state

### Subtype Operations
- **List subtypes** — see available subtypes for ticket/issue/conversation
- **Create schemas per subtype** — custom fields scoped to specific subtypes

## Available DevRev API Endpoints

| Endpoint | Purpose |
|---|---|
| `schemas.custom.set` | Create or update custom field schemas |
| `schemas.custom.list` | List custom schemas (by leaf_type, subtype, fragment type) |
| `schemas.stock.list` | List built-in stock fields |
| `schemas.subtypes.list` | List all subtypes for a leaf type |
| `stage-diagrams.create` | Create a stage diagram |
| `groups.create` | Create a field group |
| `groups.update` | Update a field group |
| `groups.list` | List field groups |
| `parts.list` | List parts (products, features, capabilities) |

## Workflow

1. **Ask** — Understand what the user wants to customize
2. **Discover** — Check current state (existing fields, subtypes, schemas)
3. **Plan** — Determine which endpoint(s) and payload structure
4. **Build** — Construct the validated payload using schema_engine.py
5. **Draft** — Save with original state for side-by-side comparison in Chrome extension
6. **Confirm** — Tell user to check the Draft tab in the Chrome extension and publish

## Field Type Reference

| Type | JSON key | Required properties |
|---|---|---|
| Text | `text` | — |
| Enum | `enum` | `allowed_values: [...]` |
| User Enum | `uenum` | `allowed_values: [...]` |
| Boolean | `bool` | — |
| Integer | `int` | — |
| Double | `double` | — |
| Timestamp | `timestamp` | — |
| ID Reference | `id` | `id_type: ["account"\|"dev_user"\|...]` |
| Tokens | `tokens` | — |
| Array | `array` | `base_type`, `allowed_values` (if enum array) |
| Struct | `struct` | `fields: [...]` |

## Payload Structure

### Schema payload (schemas.custom.set)
```json
{
  "leaf_type": "ticket",
  "type": "custom_type_fragment",
  "subtype": "l1_support",
  "subtype_display_name": "L1 Support",
  "description": "Custom fields for L1 Support tickets",
  "fields": [
    {
      "name": "priority",
      "field_type": "enum",
      "allowed_values": ["low", "medium", "high"],
      "is_required": false,
      "is_filterable": true,
      "ui": { "display_name": "Priority", "order": 1 }
    }
  ],
  "conditions": [
    {
      "expression": "custom_fields.priority == 'high'",
      "effects": [
        { "fields": ["custom_fields.escalation_notes"], "show": true }
      ]
    }
  ]
}
```

### Stage diagram payload (stage-diagrams.create)
```json
{
  "leaf_type": "ticket",
  "name": "l1_support_transitions",
  "stages": [
    {
      "stage_id": "don:core:...:custom_stage/1",
      "is_start": true,
      "transitions": [{ "target_stage_id": "don:core:...:custom_stage/2" }]
    }
  ]
}
```

## Naming Conventions
- Field names: `snake_case` — "Customer Name" -> `customer_name`
- Subtype names: `lowercase_snake` — "L1 Support" -> `l1_support`
- Stage IDs: DON format — `don:core:<dev-org>:custom_stage/<number>`

## PAT Sharing

When the user provides their PAT, save it to the draft server so the Chrome extension can auto-authenticate:
```bash
curl -X POST http://127.0.0.1:7432/auth -H 'Content-Type: application/json' -d '{"pat":"<token>"}'
```

## Instructions for the Agent

When invoked:

1. First check if the draft server is running (`curl http://127.0.0.1:7432/health`)
2. If not running, start it: `python3 object-customization/scripts/draft_server.py &`
3. Ask the user: "What would you like to customize?" with examples:
   - Add fields to a ticket subtype
   - Set up conditional show/hide rules
   - Create a stage diagram
   - Add dependencies between fields
4. Ask for the PAT if not already saved
5. Refresh the schema cache to get current state
6. Build the payload step by step, confirming with the user
7. Save as draft with `--save-draft`
8. Tell the user to open the Chrome extension Draft tab to review and publish

## CRITICAL Rules (Do Not Violate)

### NEVER publish on the user's behalf
The whole purpose of the draft-server + Chrome-extension flow is that the human owns the publish decision after reviewing the side-by-side diff. **Do not** call `--publish` and **do not** `curl POST` to `schemas.custom.set` / `stages.custom.set` / any write endpoint, even when debugging a publish failure. Stop at `--save-draft` and let the user click Publish.

If a publish fails:
- Ask the user to share the error from the extension, OR
- Ask explicitly for permission before doing a one-shot API call to reproduce the error.
- Then fix the payload, re-save the draft, and let the user retry Publish themselves.

Read-only API calls (e.g. `dev-users.self`, `schemas.custom.list`) are fine — that's how `refresh_cache.py` works.

### Merge — don't accept "Skipping duplicate field"
`schema_engine.py --add-fields` silently skips any field whose `name` already exists. **Do not treat the skip as success** — the existing field on the tenant likely has the wrong `allowed_values`, ordering, or visibility for the user's request.

When you see `Skipping duplicate field: <name>`:
1. Open the working payload
2. Find the existing field — preserve `data_name`, `db_name`, `oasis`, `dql_filter_ops`, `ordinal` (these come from the live schema and the API requires them intact)
3. Overwrite only what the user asked for (`allowed_values`, `ui.display_name`, `ui.is_hidden_during_create`, etc.)
4. Re-validate and re-save the draft

### Condition expression rules (see [dependency-fields](../dependency-fields/SKILL.md))
- Only `==`, `!=`, `&&`, `||` are supported. **No `in` / `not in`** — expand to OR chains.
- Reference fields by their `name`, **never the `tnt__`-prefixed `data_name`**, in both `expression` and `effects[].fields`.
- Validate locally first, but the real semantic errors only surface on publish — so let the user publish and report back.

### Plugin enforces "no temp Python scripts"
Two `PreToolUse` hooks block it:
- `block-python-write.sh` — rejects any `Write` to a `.py` file (exit 2)
- `block-python-eof.sh` — rejects Bash commands with `python3 << 'EOF'` or `python3 << 'PYEOF'` (exit 2)

For ad-hoc data parsing (xlsx → JSON, surgical payload edits), use:
- `python3 -c '<inline code>'`, or
- `python3 << 'PY'` heredoc (any tag other than EOF/PYEOF works)

Use the project venv when third-party libs are needed:
`/Users/macbookpro/Documents/.venvs/object-customization/bin/python3` (has `openpyxl`, etc.)

### PAT integrity
When writing the PAT to `.env` or shell vars, watch for truncation — long JWTs can lose characters through quote-stripping or escape handling. After saving, verify length with `wc -c` or compare last 20 characters to the user-supplied token. A 401 from `refresh_cache.py` with a known-good PAT is almost always truncation, not a region/permissions issue. The default endpoint `https://api.devrev.ai/internal` works for all regions including `dvrv-in-1`.
