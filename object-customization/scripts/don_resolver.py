#!/usr/bin/env python3
"""
DON ID resolver — look up DON IDs for groups, parts, stages, states, users, subtypes.

Usage:
  python3 don_resolver.py --type part --name "UPI"
  python3 don_resolver.py --type group --name "One Touch Escalations"
  python3 don_resolver.py --type stage --name "resolved"
  python3 don_resolver.py --type subtype --name "L1 Support" --leaf-type ticket
"""

import argparse
import json
import sys
from pathlib import Path
import os

plugin_root = Path(os.getenv('CLAUDE_PLUGIN_ROOT', Path(__file__).parent.parent))
cache_dir = plugin_root / '.cache' / 'schemas'


def load_cache(filename: str) -> dict:
    path = cache_dir / filename
    if not path.exists():
        print(f"Cache file not found: {path}", file=sys.stderr)
        print("Run refresh_cache.py first.", file=sys.stderr)
        sys.exit(1)
    with open(path) as f:
        return json.load(f)


def resolve_part(name: str) -> str:
    from devrev_client import DevRevClient
    client = DevRevClient()
    results = client.fetch_paginated('parts.list', {'name': name}, result_key='parts')
    for part in results:
        if part.get('name', '').lower() == name.lower():
            return part['id']
    if results:
        return results[0]['id']
    print(f"Part '{name}' not found.", file=sys.stderr)
    sys.exit(1)


def resolve_group(name: str) -> str:
    from devrev_client import DevRevClient
    client = DevRevClient()
    results = client.fetch_paginated('groups.list', {}, result_key='groups')
    for g in results:
        if g.get('name', '').lower() == name.lower():
            return g['id']
    print(f"Group '{name}' not found.", file=sys.stderr)
    sys.exit(1)


def resolve_stage(name: str) -> str:
    data = load_cache('stages.json')
    stages = data.get('custom_stages') or data.get('stages') or []
    snake = name.lower().replace(' ', '_')
    for s in stages:
        if s.get('name') == snake or s.get('display_name', '').lower() == name.lower():
            return s['id']
    print(f"Stage '{name}' not found in cache. Run refresh_cache.py.", file=sys.stderr)
    sys.exit(1)


def resolve_state(name: str) -> str:
    data = load_cache('states.json')
    states = data.get('custom_states') or data.get('states') or []
    snake = name.lower().replace(' ', '_')
    for s in states:
        if s.get('name') == snake or s.get('display_name', '').lower() == name.lower():
            return s['id']
    print(f"State '{name}' not found in cache.", file=sys.stderr)
    sys.exit(1)


def resolve_subtype(name: str, leaf_type: str) -> str:
    data = load_cache(f'subtypes_{leaf_type}.json')
    subtypes = data.get('subtypes') or []
    snake = name.lower().replace(' ', '_')
    for s in subtypes:
        if s.get('value') == snake or s.get('display_name', '').lower() == name.lower():
            return s.get('id') or s.get('value')
    print(f"Subtype '{name}' for leaf_type '{leaf_type}' not found in cache.", file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Resolve DON IDs for DevRev resources')
    parser.add_argument('--type', required=True, choices=['part', 'group', 'stage', 'state', 'subtype'])
    parser.add_argument('--name', required=True, help='Resource name to look up')
    parser.add_argument('--leaf-type', default='ticket', help='Leaf type for subtype resolution')
    args = parser.parse_args()

    sys.path.insert(0, str(Path(__file__).parent))

    resolvers = {
        'part': lambda: resolve_part(args.name),
        'group': lambda: resolve_group(args.name),
        'stage': lambda: resolve_stage(args.name),
        'state': lambda: resolve_state(args.name),
        'subtype': lambda: resolve_subtype(args.name, args.leaf_type),
    }

    don_id = resolvers[args.type]()
    print(don_id)


if __name__ == '__main__':
    main()
