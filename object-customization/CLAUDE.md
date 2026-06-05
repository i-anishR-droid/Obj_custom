# Object Customization Plugin

Manage DevRev object schemas (custom fields, field dependencies, stage diagrams, subtypes) through AI-driven CLI workflows with a **draft/production split**.

## Draft ↔ Production Model

All changes produced by this plugin are **drafts** — JSON payloads saved to `state/drafts/`. The Chrome extension (`Obj_custom/`) reads these files and shows a persistent banner listing pending changes. Clicking **Publish** in the extension pushes the drafts to DevRev via the API and clears the draft files.

This means:
1. Claude proposes and validates changes locally (never touches the live API unsolicited)
2. The user reviews in the Chrome extension and clicks **Publish** to promote
3. On publish, the extension calls `service-worker.js` which posts to `schemas.custom.set`

## Commands

| Command | What it does |
|---|---|
| `/object-customization:set-fields` | Create/update/reorder custom fields, manage groups |
| `/object-customization:dependency-fields` | Build cascading dropdowns and conditional show/hide/require rules |
| `/object-customization:stage-diagrams` | Define stage diagrams and subtypes |
| `/object-customization:export-draft` | Show pending drafts and export them for the Chrome extension |

## Setup

```bash
cd 3-computer-capabilities-nxt/object-customization
cp .env.example .env
# Edit .env and add your DEVREV_PAT

pip install -r requirements.txt
```

## Core Scripts

| Script | Purpose |
|---|---|
| `scripts/schema_engine.py` | Main CLI: build, validate, save-to-draft, publish payloads |
| `scripts/devrev_client.py` | Authenticated DevRev API wrapper |
| `scripts/don_resolver.py` | Resolve DON IDs for groups, parts, stages, users, subtypes |
| `scripts/refresh_cache.py` | Pull latest schemas/stages from DevRev into `.cache/schemas/` |
| `scripts/draft_manager.py` | Write/read/clear draft files in `state/drafts/` |
| `scripts/otel_logger.py` | OpenTelemetry JSONL logging |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DEVREV_PAT` | Yes | Personal Access Token for DevRev API |
| `DEVREV_ENDPOINT` | No | Defaults to `https://api.devrev.ai/internal` |

## Pipeline

```
User describes change
  → schema_engine.py builds + validates payload
  → draft_manager.py saves to state/drafts/
  → Chrome extension shows banner with pending count
  → User clicks Publish → extension POSTs to DevRev API
```

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
- **Plugin prefix**: `object-customization`

## Key Constraints

- All schema operations go through `schema_engine.py` — never write temp scripts
- Blocked: `python3 << 'EOF'` heredocs and Write tool for `.py` files
- Drafts are saved to `state/drafts/` before any API call
- Validation must pass before a draft is written
