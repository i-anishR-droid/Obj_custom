# DevRev Object Customization

A two-part toolkit for customizing DevRev object schemas (custom fields, field dependencies, stage diagrams, subtypes) safely and conversationally.

It has two halves that work together:

1. **Claude Code Plugin** — `object-customization/` — a conversational agent (skills + commands + Python CLI) that gathers your requirements, fetches your live DevRev schema, builds validated payloads, and saves them as **drafts**.
2. **Chrome Extension** — repo root (`manifest.json`, `app/`, `popup/`, `service-worker.js`) — shows a side-by-side comparison of **Current (Live)** vs **Proposed (Draft)**, then lets a human click **Publish** to apply changes.

The agent never publishes. The human always does — from the extension UI.

---

## Architecture at a Glance

```
┌──────────────────────────┐                    ┌───────────────────────────┐
│   Claude Code plugin     │                    │     Chrome extension      │
│   object-customization/  │                    │   manifest.json + app/    │
│                          │                    │                           │
│  /customize, /set-fields │  ──── drafts ───►  │  Banner: "N pending"      │
│  schema_engine.py        │     state/drafts/  │  Draft tab: side-by-side  │
│  draft_server.py ────────┼────► localhost ◄───┤  service-worker.js        │
│  port 7432               │      :7432         │  Publish button           │
└──────────────────────────┘                    └─────────────┬─────────────┘
                                                              │
                                                              ▼
                                                    DevRev API
                                                    (schemas.custom.set, etc.)
```

The `draft_server.py` is the bridge: the plugin writes drafts and the PAT to it; the extension reads them via `http://127.0.0.1:7432`.

---

## Repository Layout

```
.
├── README.md                          ← you are here
├── manifest.json                      ← Chrome extension manifest (MV3)
├── service-worker.js                  ← Extension background worker
├── popup/                             ← Toolbar popup
│   ├── popup.html
│   └── popup.js
├── app/                               ← Extension dashboard (opens in a new tab)
│   ├── app.html
│   ├── app.js
│   ├── lib/                           ← api-client, draft-banner, router, state, toast
│   ├── pages/                         ← auth, schema-explorer, draft, field-management, …
│   └── styles/
├── icons/                             ← Extension icons
├── .claude-plugin/
│   └── marketplace.json               ← Local Claude Code marketplace manifest
└── object-customization/              ← The Claude Code plugin
    ├── .claude-plugin/plugin.json
    ├── .env.example                   ← DEVREV_PAT template
    ├── CLAUDE.md
    ├── README.md                      ← Plugin-specific README
    ├── requirements.txt
    ├── commands/                      ← Slash commands (customize, set-fields, …)
    ├── agents/                        ← schema-analyzer, schema-validator
    ├── skills/                        ← Knowledge modules per area
    ├── hooks/                         ← PAT checks, Python-write guards, OTel
    ├── scripts/                       ← schema_engine.py, draft_server.py, …
    ├── tools/                         ← Independent tools layer
    └── state/                         ← drafts/, payloads/, snapshots/, logs/
```

---

## Prerequisites

| Requirement | Why |
|---|---|
| Python 3.9+ | Runs `schema_engine.py` and `draft_server.py` |
| `pip` | Install `requests`, `python-dotenv`, `pyyaml`, `jsonschema` |
| Google Chrome (or Chromium-based browser) | Loads the extension |
| Claude Code CLI | Runs the plugin's slash commands and skills |
| DevRev Personal Access Token (PAT) | Auth for the DevRev API — get it from **DevRev → Settings → Tokens → Personal Access Token** |

---

# Part 1 — Claude Code Plugin (Skills + Commands)

The plugin lives in [object-customization/](object-customization/). It provides slash commands, skills, sub-agents, and a Python CLI (`schema_engine.py`) for building DevRev schema payloads.

## Install the Plugin

You can install via the local marketplace shipped in this repo, or by pointing Claude Code directly at the plugin folder.

### Option A — Local Marketplace (recommended)

The repo includes [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json), which registers a local marketplace containing the `object-customization` plugin.

1. Clone this repo:
   ```bash
   git clone https://github.com/i-anishR-droid/Obj_custom.git
   cd Obj_custom
   ```

2. Add this repo as a marketplace in Claude Code:
   ```bash
   claude plugin marketplace add /absolute/path/to/Obj_custom
   ```

3. Install the plugin:
   ```bash
   claude plugin install object-customization@obj-custom-experiment
   ```

4. Restart Claude Code so it picks up the new commands and skills.

### Option B — Direct plugin folder

Point Claude Code at the plugin directory directly:

```bash
claude plugin install /absolute/path/to/Obj_custom/object-customization
```

### Verify the install

From any Claude Code session, type `/` — you should see commands prefixed `object-customization:`:

- `/object-customization:customize`
- `/object-customization:set-fields`
- `/object-customization:dependency-fields`
- `/object-customization:stage-diagrams`
- `/object-customization:export-draft`

## Configure the Plugin

1. **Install Python dependencies**:
   ```bash
   cd object-customization
   pip install -r requirements.txt
   ```

2. **Set your DevRev PAT** — either let the agent prompt you the first time you run `/object-customization:customize`, or set it manually:
   ```bash
   cp .env.example .env
   # Edit .env and paste your DEVREV_PAT
   ```

3. **(Optional) Pre-warm the schema cache** — the agent will do this for you, but you can run it manually:
   ```bash
   python3 scripts/refresh_cache.py
   ```

4. **Start the draft server** — needed so the Chrome extension can read drafts:
   ```bash
   python3 scripts/draft_server.py
   # Listening on http://127.0.0.1:7432
   ```
   Leave this running in a terminal whenever you're working with drafts.

## How to Use the Skills / Commands

### Primary entry point — `/object-customization:customize`

A conversational flow that handles everything end-to-end. Start with:

```
/object-customization:customize
```

The agent will:

1. Check the draft server is up and start it if not.
2. Ask for your PAT if it doesn't have one (you only enter it once per session — it's written to `state/.auth.json` and `.env`).
3. Refresh your schema cache from DevRev.
4. Ask what you want to do (add fields, dependencies, stages, etc.).
5. Build a validated payload via `schema_engine.py`.
6. Save it as a draft into [object-customization/state/drafts/](object-customization/state/drafts/).
7. Tell you to open the Chrome extension's **Draft** tab to review and publish.

### Specialized commands

Use these when you already know what you want and prefer a tighter loop.

| Command | What it does |
|---|---|
| `/object-customization:set-fields` | Create/update/reorder custom fields, manage groups |
| `/object-customization:dependency-fields` | Build cascading dropdowns and conditional show/hide/require rules |
| `/object-customization:stage-diagrams` | Define stage diagrams and workflow transitions |
| `/object-customization:export-draft` | List all pending drafts (and optionally clear them) |

### Skills (knowledge modules)

Skills are auto-loaded by the agent when relevant. You can also invoke them directly:

| Skill | When the agent uses it |
|---|---|
| `object-customization:devrev-object-model` | Anything that needs the DevRev schema mental model — fragments, subtypes, leaf types |
| `object-customization:schema-engine` | Detailed CLI reference for `schema_engine.py` flags and workflows |
| `object-customization:set-fields` | Creating, updating, ordering custom fields and groups |
| `object-customization:dependency-fields` | Cascading dropdowns, conditional rules |
| `object-customization:stage-diagrams` | Stage / state / subtype workflows |
| `object-customization:customize` | The end-to-end conversational flow |

### Example session

```
You: I want to add a priority field (low/medium/high) and a customer_name text field
     to L1 Support tickets.

Claude: I'll use the schema-analyzer agent to build the field payload.
  [Loads skills → refreshes cache → checks L1 Support subtype exists → builds payload]

  ## Draft Saved ✅
  | Operation    | Details                                       |
  | Leaf Type    | ticket                                        |
  | Subtype      | L1 Support                                    |
  | Fields Added | priority (enum), customer_name (text)         |
  | Draft File   | state/drafts/ticket_l1_support_fields_…json   |

  Next: Open the Chrome extension → Draft tab shows "1 pending change" → click Publish.
```

### Draft / Production model

- **Production** = what's live in DevRev (visible in the **Schema Explorer** tab of the extension).
- **Draft** = JSON payloads in `state/drafts/`, validated by the plugin, not yet in DevRev.
- The agent only ever creates drafts. Publishing happens in the extension when a human clicks **Publish**.

---

# Part 2 — Chrome Extension

The extension lives at the repo root. It is a Manifest V3 unpacked extension.

## Install the Extension

1. Open Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the **root of this repo** (the folder containing [manifest.json](manifest.json)).
5. You should see **DevRev Object Customization** in your extensions list. Pin it for easy access.

> If you update the extension source, click the refresh icon on the extension card in `chrome://extensions` to reload it.

## Configure the Extension

The extension needs:

- The **draft server** running at `http://127.0.0.1:7432` (started by the plugin — see above).
- A **DevRev PAT** — either supplied by the plugin (auto-synced from the draft server) or pasted into the extension's **Auth** page on first launch.

### How the PAT flows

1. You give the PAT to the plugin once during `/object-customization:customize`.
2. The plugin posts it to `http://127.0.0.1:7432/auth`.
3. The extension's service worker fetches it from `/auth` and stores it in `chrome.storage.local`.
4. When the agent's session ends, the SessionEnd hook clears the PAT from the draft server. The extension detects this and stops using it.

You can also enter the PAT directly in the extension's **Auth** page if you prefer not to use the plugin.

## How to Use the Extension

1. Click the toolbar icon → **Open Dashboard** (popup → opens [app/app.html](app/app.html) in a new tab).
2. The dashboard has these pages:

| Page | Purpose |
|---|---|
| **Auth** | Enter / update your DevRev PAT manually (skip if plugin set it) |
| **Schema Explorer** | Browse what's currently live in DevRev — fields, subtypes, stages, groups |
| **Draft** | Side-by-side **Current (Live)** vs **Proposed (Draft)** diff; **Publish** / **Discard** controls |
| **Field Management** | Direct field create/edit/reorder UI (alternative to the plugin) |
| **Parts & Groups** | Manage parts and field groups |
| **Dependencies** | Browse/edit field dependency rules |
| **Conditional Rules** | Manage conditional show/hide/require rules |

### The publish loop

1. Run `/object-customization:customize` in Claude Code and describe your change.
2. The agent saves a draft to `state/drafts/`.
3. The extension's banner shows `N pending changes`.
4. Open the **Draft** tab. Review the diff.
5. Click **Publish** to call DevRev's `schemas.custom.set` (or the relevant API), or **Discard** to drop the draft.
6. On success, the draft is deleted from `state/drafts/` and a snapshot is saved to `state/payloads/snapshots/`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Extension banner is empty after the agent says "Draft Saved" | Draft server not running | `cd object-customization && python3 scripts/draft_server.py` |
| Extension says `Unauthorized` (401) | Stale/truncated PAT | Re-enter PAT via `/object-customization:customize` or the Auth page |
| `/object-customization:customize` not in slash menu | Plugin not installed or Claude Code not restarted | Reinstall via marketplace; restart Claude Code |
| `python3 scripts/draft_server.py` says port in use | Another instance is running | `lsof -i :7432` then kill the old PID |
| Schema cache out of date | Cache not refreshed since last DevRev change | `python3 scripts/refresh_cache.py` |
| Validation errors when saving a draft | Bad enum values, missing required props, naming convention | Read the error, fix the input, retry. Names must be snake_case |

---

## Environment Variables

Set in `object-customization/.env` (see [object-customization/.env.example](object-customization/.env.example)).

| Variable | Required | Default | Description |
|---|---|---|---|
| `DEVREV_PAT` | Yes | — | Personal Access Token for DevRev |
| `DEVREV_ENDPOINT` | No | `https://api.devrev.ai/internal` | DevRev API base (internal API required for schema ops) |

---

## Naming Conventions

The DevRev API enforces snake_case for most identifiers. The plugin will normalize, but it's clearer if your inputs match:

- **Field names**: `Customer Name` → `customer_name`
- **Stage names**: `In Progress` → `in_progress`
- **Subtype names**: `L1 Support` → `l1_support`

---

## Further Reading

- [object-customization/README.md](object-customization/README.md) — plugin-specific quick start and file layout
- [object-customization/CLAUDE.md](object-customization/CLAUDE.md) — agent context and constraints
- [object-customization/skills/schema-engine/SKILL.md](object-customization/skills/schema-engine/SKILL.md) — full CLI reference for `schema_engine.py`
- [object-customization/skills/devrev-object-model/SKILL.md](object-customization/skills/devrev-object-model/SKILL.md) — DevRev schema concepts

---

## License

MIT — see plugin manifest at [object-customization/.claude-plugin/plugin.json](object-customization/.claude-plugin/plugin.json).
