# Object Customization Plugin

Conversational agent for managing DevRev object schemas (custom fields, field dependencies, stage diagrams, subtypes). The agent asks what changes the user needs, builds validated payloads, and saves them as drafts. The Chrome extension shows a side-by-side comparison (current live state vs proposed changes) so the human can verify before publishing.

## How It Works

```
User describes what they want
  → Agent asks clarifying questions
  → Agent fetches current state (refresh_cache.py)
  → Agent builds payload (schema_engine.py)
  → Agent validates and saves draft (--save-draft)
  → Draft includes _original state for comparison
  → Chrome extension shows side-by-side diff
  → Human reviews: Current (Live) vs Proposed (Draft)
  → Human clicks Publish or Discard in the UI
```

## PAT Flow

The PAT is entered ONCE in the agent conversation:
1. Agent receives PAT from user
2. Agent writes it to `state/.auth.json` via draft server (`POST /auth`)
3. Agent writes it to `.env` for Python scripts
4. Chrome extension auto-syncs PAT from draft server (no manual entry needed)

## Main Command

`/object-customization:customize` — The primary entry point. Conversational, guides through everything.

## Other Commands

| Command | What it does |
|---|---|
| `/object-customization:set-fields` | Create/update/reorder custom fields, manage groups |
| `/object-customization:dependency-fields` | Build cascading dropdowns and conditional show/hide/require rules |
| `/object-customization:stage-diagrams` | Define stage diagrams and workflow transitions |
| `/object-customization:export-draft` | Show all pending drafts and their status |

## Core Scripts

| Script | Purpose |
|---|---|
| `scripts/schema_engine.py` | Main CLI: build, validate, save-to-draft, publish payloads |
| `scripts/devrev_client.py` | Authenticated DevRev API wrapper |
| `scripts/don_resolver.py` | Resolve DON IDs for groups, parts, stages, users, subtypes |
| `scripts/refresh_cache.py` | Pull latest schemas/stages from DevRev into `.cache/schemas/` |
| `scripts/draft_manager.py` | Write/read/clear draft files in `state/drafts/` |
| `scripts/draft_server.py` | HTTP bridge — serves drafts + auth to Chrome extension |

## Draft Server Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/drafts` | GET | List all pending drafts |
| `/drafts` | DELETE | Clear all drafts |
| `/draft/:name` | DELETE | Delete one draft |
| `/auth` | GET | Read PAT (extension syncs from here) |
| `/auth` | POST | Save PAT (agent writes here) |
| `/auth` | DELETE | Clear PAT |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DEVREV_PAT` | Yes | Personal Access Token for DevRev API |
| `DEVREV_ENDPOINT` | No | Defaults to `https://api.devrev.ai/internal` |

## Key Constraints

- All schema operations go through `schema_engine.py` — never write temp scripts
- Drafts are saved to `state/drafts/` before any API call
- Validation must pass before a draft is written
- The agent NEVER publishes directly — only saves drafts
- The human makes the final publish decision in the Chrome extension UI
- Draft files include `_original` field for side-by-side comparison

## Cache Layout

All cached data lives in `.cache/schemas/`:
- `stages.json` — all custom stages
- `states.json` — all custom states
- `stage-diagrams.json` — all stage diagrams
- `subtypes_ticket.json` / `subtypes_issue.json` — subtypes per leaf type
- `tenant_fragment_ticket.json` etc. — tenant schema fragments
- `custom_type_fragments_ticket.json` etc. — custom type fragments

## Naming Conventions

- **Field names**: snake_case — "Customer Name" → `customer_name`
- **Stage names**: snake_case — "In Progress" → `in_progress`
- **Subtype names**: lowercase snake_case (API requirement) — "L1 Support" → `l1_support`
