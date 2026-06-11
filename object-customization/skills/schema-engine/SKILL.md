---
name: Schema Engine Reference
description: Reference documentation for schema_engine.py commands. This skill provides complete CLI reference, workflows, and examples. LOAD THIS SKILL when an agent needs detailed information about schema_engine.py commands, flags, validation rules, or troubleshooting.
version: 0.2.0
---

# Schema Engine Skill

`schema_engine.py` is the single CLI tool for all schema payload operations. Each operation has its own tool doc in `tools/`.

## Tool Index

| Tool | File | Purpose |
|---|---|---|
| refresh-cache | `tools/refresh-cache.md` | Pull latest schema from DevRev |
| list-subtypes | `tools/list-subtypes.md` | List subtypes per leaf type |
| list-fields | `tools/list-fields.md` | List existing fields |
| init-payload | `tools/init-payload.md` | Initialize working payload |
| add-fields | `tools/add-fields.md` | Add custom fields |
| add-conditions | `tools/add-conditions.md` | Add dependency conditions |
| init-stage-diagram | `tools/init-stage-diagram.md` | Initialize stage diagram |
| add-stages | `tools/add-stages.md` | Add stages + transitions |
| validate-payload | `tools/validate-payload.md` | Validate before saving |
| save-draft | `tools/save-draft.md` | Save to drafts dir |
| show-payload | `tools/show-payload.md` | Print payload JSON |
| resolve-don | `tools/resolve-don.md` | Name → DON ID resolution |
| list-drafts | `tools/list-drafts.md` | Show pending drafts |
| clear-drafts | `tools/clear-drafts.md` | Discard all drafts |
| start-draft-server | `tools/start-draft-server.md` | Launch HTTP bridge |
| get-examples | `tools/get-examples.md` | Print example JSON |

## Standard Workflow

```
refresh-cache → list-subtypes → list-fields → init-payload → add-fields/add-conditions → validate-payload → save-draft
```

## Key Constraints

- All operations via `schema_engine.py` — never write temp scripts
- Always `--load-from-cache` on init (prevents data loss)
- Always `--validate` before `--save-draft`
- NEVER use `--publish` — drafts only
- Field names in snake_case
- Use `name` not `data_name` in expressions
