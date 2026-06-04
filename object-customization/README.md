# Object Customization Plugin

Claude Code plugin for managing DevRev object schemas through AI-driven CLI workflows.
Changes are saved as **drafts** and pushed to the Chrome extension's banner for review — click **Publish** to go live.

## Quick Start

```bash
# 1. Configure credentials
cp .env.example .env
# Edit .env → add DEVREV_PAT

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Refresh schema cache from DevRev
python3 scripts/refresh_cache.py

# 4. Start the draft server (bridges plugin ↔ Chrome extension)
python3 scripts/draft_server.py
# Runs on http://127.0.0.1:7432
```

## Commands

| Command | What it does |
|---|---|
| `/object-customization:set-fields` | Create/update/reorder custom fields, manage groups |
| `/object-customization:dependency-fields` | Build cascading dropdowns and conditional show/hide/require rules |
| `/object-customization:stage-diagrams` | Define stage diagrams and workflow transitions |
| `/object-customization:export-draft` | Show all pending drafts and their status |

## Draft / Production Model

```
Claude plugin (you are here)          Chrome extension (Obj_custom/)
─────────────────────────────         ──────────────────────────────
/set-fields → schema_engine.py   →   draft_server.py (port 7432)
  --save-draft                   →   service-worker GET /drafts
  state/drafts/ticket_*.json     →   Banner: "3 pending changes [Publish]"
                                 →   User clicks Publish
                                 →   service-worker POST schemas.custom.set
                                 →   DELETE /drafts (clears on success)
```

**Production code** = what's currently live in DevRev (what you see in the Schema Explorer tab).
**Draft** = JSON payloads in `state/drafts/` validated by the plugin, not yet in DevRev.

## File Layout

```
object-customization/
├── .claude-plugin/plugin.json       # Plugin manifest
├── .env.example                     # Token template
├── CLAUDE.md                        # Claude context
├── requirements.txt
├── commands/                        # Slash commands
│   ├── set-fields.md
│   ├── dependency-fields.md
│   ├── stage-diagrams.md
│   └── export-draft.md
├── agents/                          # Sub-agents
│   ├── schema-analyzer.md           # Builds + saves drafts
│   └── schema-validator.md          # Read-only validation
├── skills/                          # Knowledge modules
│   ├── devrev-object-model/
│   ├── schema-engine/
│   ├── set-fields/
│   ├── dependency-fields/
│   └── stage-diagrams/
├── hooks/
│   ├── hooks.json
│   └── scripts/
│       ├── check-pats.sh
│       ├── block-python-write.sh
│       ├── block-python-eof.sh
│       └── otel-logger.sh
├── scripts/
│   ├── schema_engine.py             # Main CLI
│   ├── devrev_client.py             # API wrapper
│   ├── don_resolver.py              # DON ID lookup
│   ├── refresh_cache.py             # Cache sync
│   ├── draft_manager.py             # Draft read/write/clear
│   ├── draft_server.py              # HTTP bridge for extension
│   └── otel_logger.py              # OTel JSONL logging
└── state/
    ├── drafts/                      # Pending draft files (read by extension)
    ├── payloads/working/            # Active working payloads
    ├── payloads/previous/           # Auto-backups before overwrite
    ├── payloads/snapshots/          # Snapshots created on publish
    └── logs/otel/                   # OpenTelemetry JSONL logs
```

## Requirements

- Python 3.9+
- `requests`, `python-dotenv`, `pyyaml`, `jsonschema`
- DevRev Personal Access Token (PAT)
- Chrome extension (`Obj_custom/`) with `draft_server.py` running

## Example Session

```
You: Create priority (enum: low/medium/high) and customer_name (text) fields for L1 Support tickets

Claude: I'll use the schema-analyzer agent to build the field payload.
[Loads skills → refreshes cache → checks L1 Support subtype exists → builds payload]

  ## Draft Saved ✅
  | Operation   | Details                                      |
  | Leaf Type   | ticket                                       |
  | Subtype     | L1 Support                                   |
  | Fields Added| priority (enum), customer_name (text)        |
  | Draft File  | state/drafts/ticket_l1_support_fields_...json|

  Next step: Open the Chrome extension → banner shows "1 pending change" → click Publish.
```
