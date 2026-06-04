#!/usr/bin/env python3
"""
Draft HTTP bridge — serves draft metadata to the Chrome extension.

The Chrome extension cannot read local files directly. This lightweight server
exposes state/drafts/ over http://localhost:7432 with CORS, letting the
extension's service worker poll for pending changes.

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

CORS_HEADERS = {
    'Access-Control-Allow-Origin': 'chrome-extension://*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


class DraftHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # suppress default access log

    def send_cors(self, code: int, body: bytes, content_type: str = 'application/json'):
        self.send_response(code)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

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

        elif self.path == '/health':
            self.send_cors(200, b'{"ok":true}')

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
    print(f"Endpoints: GET /drafts  DELETE /drafts  GET /health")
    print(f"Configure extension: set draftServerPort={args.port} in chrome.storage.local")
    print("Stop with Ctrl+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")


if __name__ == '__main__':
    main()
