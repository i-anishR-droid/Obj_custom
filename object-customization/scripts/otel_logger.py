#!/usr/bin/env python3
"""OpenTelemetry-format JSONL logger for schema operations."""

import argparse
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

plugin_root = Path(os.getenv('CLAUDE_PLUGIN_ROOT', Path(__file__).parent.parent))
logs_dir = plugin_root / 'state' / 'logs' / 'otel'
logs_dir.mkdir(parents=True, exist_ok=True)

session_file = plugin_root / 'state' / '.session_id'
if session_file.exists():
    SESSION_ID = session_file.read_text().strip()
else:
    SESSION_ID = str(uuid.uuid4())
    session_file.parent.mkdir(parents=True, exist_ok=True)
    session_file.write_text(SESSION_ID)


def log_event(operation: str, status: str, body: str, attributes: dict):
    now = datetime.now(timezone.utc)
    log_file = logs_dir / f"operations_{now.strftime('%Y%m%d')}.jsonl"

    record = {
        'timestamp': now.isoformat(),
        'trace_id': str(uuid.uuid4()).replace('-', ''),
        'session_id': SESSION_ID,
        'resource': {'service.name': 'object-customization'},
        'scope': {'name': 'claude-plugin'},
        'body': body,
        'attributes': {
            'operation': operation,
            'status': status,
            **attributes,
        },
    }

    with open(log_file, 'a') as f:
        f.write(json.dumps(record) + '\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--plugin-root')
    parser.add_argument('--operation', default='unknown')
    parser.add_argument('--status', default='success')
    parser.add_argument('--body', default='')
    parser.add_argument('--attributes', default='{}')
    args = parser.parse_args()

    try:
        attrs = json.loads(args.attributes)
    except json.JSONDecodeError:
        attrs = {'raw': args.attributes}

    log_event(args.operation, args.status, args.body, attrs)


if __name__ == '__main__':
    main()
