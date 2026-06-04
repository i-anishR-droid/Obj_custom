#!/usr/bin/env python3
"""
Draft manager — write, list, show, and clear draft payload files.
Drafts are stored in state/drafts/ and read by the Chrome extension's draft banner.

Usage:
  python3 draft_manager.py --list
  python3 draft_manager.py --show <filename>
  python3 draft_manager.py --clear
  python3 draft_manager.py --write <payload_file>
  python3 draft_manager.py --publish-all   (POSTs each draft to DevRev API, then deletes it)
"""

import argparse
import json
import sys
import shutil
from datetime import datetime
from pathlib import Path
import os

plugin_root = Path(os.getenv('CLAUDE_PLUGIN_ROOT', Path(__file__).parent.parent))
drafts_dir = plugin_root / 'state' / 'drafts'
drafts_dir.mkdir(parents=True, exist_ok=True)


def draft_summary(path: Path) -> dict:
    try:
        with open(path) as f:
            data = json.load(f)
        fields = data.get('fields', [])
        conditions = data.get('conditions', [])
        stages = data.get('stages', [])
        leaf = data.get('leaf_type', 'unknown')
        subtype = data.get('subtype', '')
        dtype = data.get('draft_type', data.get('type', 'schema'))
        return {
            'filename': path.name,
            'draft_type': dtype,
            'leaf_type': leaf,
            'subtype': subtype,
            'fields': len(fields),
            'conditions': len(conditions),
            'stages': len(stages),
            'created': datetime.fromtimestamp(path.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
        }
    except Exception as e:
        return {'filename': path.name, 'error': str(e)}


def cmd_list():
    drafts = sorted(drafts_dir.glob('*.json'))
    if not drafts:
        print("No pending drafts.")
        return

    print(f"Pending drafts ({len(drafts)}):\n")
    for i, d in enumerate(drafts, 1):
        s = draft_summary(d)
        if 'error' in s:
            print(f"  {i}. {s['filename']} — ERROR: {s['error']}")
            continue
        subtype_str = f" | Subtype: {s['subtype']}" if s['subtype'] else ''
        print(f"  {i}. {s['filename']}")
        print(f"     Type: {s['draft_type']} | Leaf: {s['leaf_type']}{subtype_str}")
        if s['stages']:
            print(f"     Stages: {s['stages']}")
        else:
            print(f"     Fields: {s['fields']} | Conditions: {s['conditions']}")
        print(f"     Created: {s['created']}")
        print()

    print(f"Chrome extension banner will show: \"{len(drafts)} pending change{'s' if len(drafts) != 1 else ''}  [Publish]\"")


def cmd_show(filename: str):
    path = drafts_dir / filename
    if not path.exists():
        # Try partial match
        matches = list(drafts_dir.glob(f'*{filename}*'))
        if not matches:
            print(f"Draft not found: {filename}", file=sys.stderr)
            sys.exit(1)
        path = matches[0]

    with open(path) as f:
        data = json.load(f)
    print(json.dumps(data, indent=2))


def cmd_clear():
    drafts = list(drafts_dir.glob('*.json'))
    if not drafts:
        print("No drafts to clear.")
        return
    for d in drafts:
        d.unlink()
    print(f"Cleared {len(drafts)} draft(s).")
    print("⚠️  Changes were NOT published — they have been discarded.")


def cmd_write(payload_file: str):
    src = Path(payload_file)
    if not src.exists():
        print(f"Payload file not found: {src}", file=sys.stderr)
        sys.exit(1)

    with open(src) as f:
        data = json.load(f)

    leaf = data.get('leaf_type', 'unknown')
    subtype = data.get('subtype', 'tenant')
    dtype = data.get('draft_type', data.get('type', 'schema'))
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')

    if 'stage_diagram' in src.name or dtype == 'stage_diagram':
        draft_name = f"stage_diagram_{leaf}_{subtype}_{ts}.json"
    elif data.get('conditions'):
        draft_name = f"{leaf}_{subtype}_deps_{ts}.json"
    else:
        draft_name = f"{leaf}_{subtype}_fields_{ts}.json"

    dest = drafts_dir / draft_name
    shutil.copy2(src, dest)
    print(f"Draft saved: {dest}")
    print(f"\nChrome extension will show this in the draft banner.")
    print(f"Click Publish in the extension to apply to DevRev.")


def cmd_publish_all():
    sys.path.insert(0, str(plugin_root / 'scripts'))
    from devrev_client import DevRevClient

    drafts = sorted(drafts_dir.glob('*.json'))
    if not drafts:
        print("No pending drafts to publish.")
        return

    client = DevRevClient()
    published = 0
    failed = 0

    for path in drafts:
        print(f"\nPublishing: {path.name}")
        try:
            with open(path) as f:
                data = json.load(f)

            dtype = data.get('draft_type', 'schema')

            if 'stage_diagram' in path.name or dtype == 'stage_diagram':
                endpoint = 'stage-diagrams.create'
                payload = {k: v for k, v in data.items() if k not in ('draft_type',)}
            else:
                endpoint = 'schemas.custom.set'
                payload = {k: v for k, v in data.items() if k not in ('draft_type',)}

            result = client.post(endpoint, payload)
            print(f"  ✅ Published via {endpoint}")
            path.unlink()
            published += 1
        except Exception as e:
            print(f"  ❌ Failed: {e}", file=sys.stderr)
            failed += 1

    print(f"\nPublish complete: {published} succeeded, {failed} failed.")


def main():
    parser = argparse.ArgumentParser(description='Manage draft schema payloads for Chrome extension')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--list', action='store_true', help='List all pending drafts')
    group.add_argument('--show', metavar='FILENAME', help='Show a specific draft')
    group.add_argument('--clear', action='store_true', help='Clear all drafts (discards changes)')
    group.add_argument('--write', metavar='PAYLOAD_FILE', help='Save a working payload as a draft')
    group.add_argument('--publish-all', action='store_true', help='Publish all drafts to DevRev API')
    args = parser.parse_args()

    if args.list:
        cmd_list()
    elif args.show:
        cmd_show(args.show)
    elif args.clear:
        cmd_clear()
    elif args.write:
        cmd_write(args.write)
    elif args.publish_all:
        cmd_publish_all()


if __name__ == '__main__':
    main()
