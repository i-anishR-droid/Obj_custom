---
name: start-draft-server
description: Start the draft server (HTTP bridge between Claude and Chrome extension) on port 7432.
---

# Start Draft Server Tool

Launches the HTTP server that bridges draft data to the Chrome extension.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && python3 scripts/draft_server.py &
```

## Health Check

```bash
curl -s http://127.0.0.1:7432/health
```

Expected: `{"ok": true}`

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/drafts` | GET | List all pending drafts |
| `/drafts` | DELETE | Clear all drafts |
| `/draft/:name` | DELETE | Delete one draft |
| `/auth` | GET | Read PAT |
| `/auth` | POST | Save PAT |
| `/auth` | DELETE | Clear PAT |

## When to Use

- At the start of a customization session
- When the Chrome extension can't find drafts (server not running)
- After system restart

## Authentication Setup

After starting, save the PAT:
```bash
curl -X POST http://127.0.0.1:7432/auth -H 'Content-Type: application/json' -d '{"pat":"<token>"}'
```
