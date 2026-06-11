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

## --save-draft vs --publish

| Flag | What happens |
|---|---|
| `--save-draft` | Copies payload to `state/drafts/`, Chrome extension will show it |
| `--publish` | POSTs directly to DevRev API — **DO NOT USE on the user's behalf** |

**Agent rule: NEVER call `--publish`.** Stop at `--save-draft`. The human reviews the side-by-side diff in the Chrome extension and clicks Publish themselves. Same applies to direct `curl POST` to `schemas.custom.set` / `stages.custom.set` / any write endpoint — do not bypass the extension.

When a publish fails (user reports an error from the extension):
1. Read the error message the user shares.
2. If you need the raw API response to debug, **ask the user for permission first** before doing a one-shot API call.
3. Fix the payload, re-save the draft, and let the user retry Publish.

## Common publish-time errors and fixes

These errors only surface when the API actually validates the payload (during publish) — `--validate` won't catch them.

| API error message | Cause | Fix |
|---|---|---|
| `Parse error: expected [== && \|\| !=] operators, got in` | Used `in` / `not in` operator in a condition expression | Expand to OR chain: `field == "a" \|\| field == "b"` |
| `non-existent custom field tnt__<name> provided in conditions` | Used the `data_name` (with `tnt__` prefix) instead of `name` | Strip `tnt__` from both `expression` and `effects[].fields`. Use `custom_fields.<name>`, not `custom_fields.tnt__<name>` |
| 401 Unauthorized from `refresh_cache.py` | PAT got truncated when written to `.env` (long JWT, shell escaping) | `wc -c` the PAT in `.env`, compare last 20 chars to user-supplied token, rewrite with `echo "DEVREV_PAT=$VAR" > .env` |
