#!/usr/bin/env python3
"""
Draft HTTP bridge — serves draft metadata and auth to the Chrome extension.

The Chrome extension cannot read local files directly. This lightweight server
exposes state/drafts/ over http://localhost:7432 with CORS, letting the
extension's service worker poll for pending changes.

Also handles PAT sharing: the Claude agent writes the PAT here, and the
extension reads it — no manual token entry in the Chrome UI.

Usage:
  python3 draft_server.py          # starts on port 7432
  python3 draft_server.py --port 8080

Stop with Ctrl+C.
"""

import argparse
import json
import sys
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
import os

plugin_root = Path(os.getenv('CLAUDE_PLUGIN_ROOT', Path(__file__).parent.parent))
drafts_dir = plugin_root / 'state' / 'drafts'
auth_file = plugin_root / 'state' / '.auth.json'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


class DraftHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send_cors(self, code: int, body: bytes, content_type: str = 'application/json'):
        self.send_response(code)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self) -> bytes:
        length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(length) if length else b''

    def do_OPTIONS(self):
        self.send_cors(204, b'')

    def do_GET(self):
        if self.path == '/drafts':
            drafts = []
            for path in sorted(drafts_dir.glob('*.json')):
                try:
                    with open(path) as f:
                        data = json.load(f)
                    data['filename'] = path.name
                    drafts.append(data)
                except Exception:
                    drafts.append({'filename': path.name, 'error': 'unreadable'})
            body = json.dumps({'drafts': drafts}).encode()
            self.send_cors(200, body)

        elif self.path == '/auth':
            if auth_file.exists():
                try:
                    with open(auth_file) as f:
                        data = json.load(f)
                    self.send_cors(200, json.dumps(data).encode())
                except Exception:
                    self.send_cors(200, b'{"pat":null}')
            else:
                self.send_cors(200, b'{"pat":null}')

        elif self.path == '/health':
            self.send_cors(200, b'{"ok":true}')

        else:
            self.send_cors(404, b'{"error":"not found"}')

    def do_POST(self):
        if self.path == '/auth':
            body = self.read_body()
            try:
                data = json.loads(body)
                pat = data.get('pat', '')
                if not pat:
                    self.send_cors(400, b'{"error":"pat required"}')
                    return
                auth_file.parent.mkdir(parents=True, exist_ok=True)
                with open(auth_file, 'w') as f:
                    json.dump({'pat': pat}, f)
                self.send_cors(200, b'{"success":true}')
            except Exception as e:
                self.send_cors(400, json.dumps({'error': str(e)}).encode())
        else:
            self.send_cors(404, b'{"error":"not found"}')

    def do_DELETE(self):
        if self.path == '/drafts':
            for path in drafts_dir.glob('*.json'):
                path.unlink()
            self.send_cors(200, b'{"cleared":true}')
        elif self.path.startswith('/draft/'):
            from urllib.parse import unquote
            filename = unquote(self.path[len('/draft/'):])
            target = drafts_dir / filename
            if target.exists() and target.parent == drafts_dir:
                target.unlink()
                self.send_cors(200, b'{"deleted":true}')
            else:
                self.send_cors(404, b'{"error":"not found"}')
        elif self.path == '/auth':
            if auth_file.exists():
                auth_file.unlink()
            self.send_cors(200, b'{"cleared":true}')
        else:
            self.send_cors(404, b'{"error":"not found"}')


def main():
    parser = argparse.ArgumentParser(description='Draft HTTP bridge for Chrome extension')
    parser.add_argument('--port', type=int, default=7432)
    args = parser.parse_args()

    drafts_dir.mkdir(parents=True, exist_ok=True)
    server = HTTPServer(('127.0.0.1', args.port), DraftHandler)
    print(f"Draft server running at http://127.0.0.1:{args.port}")
    print(f"Serving drafts from: {drafts_dir}")
    print(f"Endpoints:")
    print(f"  GET  /drafts       — list pending drafts")
    print(f"  DELETE /drafts     — clear all drafts")
    print(f"  DELETE /draft/:name — delete one draft")
    print(f"  GET  /auth         — read PAT (shared by agent)")
    print(f"  POST /auth         — set PAT (called by agent)")
    print(f"  DELETE /auth       — clear PAT")
    print(f"  GET  /health       — health check")
    print("Stop with Ctrl+C — PAT will be cleared on shutdown")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nClearing PAT and stopping server...")
        if auth_file.exists():
            try:
                size = auth_file.stat().st_size
                if size > 0:
                    with open(auth_file, 'r+b') as f:
                        f.write(os.urandom(size))
                auth_file.unlink()
            except Exception:
                try: auth_file.unlink()
                except Exception: pass
        print("Server stopped.")


if __name__ == '__main__':
    main()
