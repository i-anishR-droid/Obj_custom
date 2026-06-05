#!/usr/bin/env python3
"""
Refresh local schema cache from DevRev API.
Pulls stages, states, stage diagrams, subtypes, and schema fragments into .cache/schemas/.

Usage:
  python3 refresh_cache.py
  python3 refresh_cache.py --leaf-type ticket
"""

import argparse
import json
import sys
from pathlib import Path
import os

plugin_root = Path(os.getenv('CLAUDE_PLUGIN_ROOT', Path(__file__).parent.parent))
sys.path.insert(0, str(plugin_root / 'scripts'))

from devrev_client import DevRevClient

cache_dir = plugin_root / '.cache' / 'schemas'
cache_dir.mkdir(parents=True, exist_ok=True)

LEAF_TYPES = ['ticket', 'issue', 'conversation']


def save(filename: str, data: dict):
    path = cache_dir / filename
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"  Saved: {filename} ({len(json.dumps(data))} bytes)")


def refresh_stages(client: DevRevClient):
    print("Fetching stages...")
    results = client.fetch_paginated('stages.custom.list', {}, result_key='custom_stages')
    save('stages.json', {'custom_stages': results})


def refresh_states(client: DevRevClient):
    print("Fetching states...")
    results = client.fetch_paginated('states.custom.list', {}, result_key='custom_states')
    save('states.json', {'custom_states': results})


def refresh_stage_diagrams(client: DevRevClient):
    print("Fetching stage diagrams...")
    results = client.fetch_paginated('stage-diagrams.list', {}, result_key='stage_diagrams')
    save('stage-diagrams.json', {'stage_diagrams': results})


def refresh_subtypes(client: DevRevClient, leaf_type: str):
    print(f"Fetching subtypes for {leaf_type}...")
    try:
        result = client.post('schemas.subtypes.list', {'leaf_type': leaf_type})
        subtypes = result.get('subtypes', [])
        save(f'subtypes_{leaf_type}.json', {'subtypes': subtypes})
    except Exception as e:
        print(f"  Warning: could not fetch subtypes for {leaf_type}: {e}", file=sys.stderr)
        save(f'subtypes_{leaf_type}.json', {'subtypes': []})


def refresh_fragments(client: DevRevClient, leaf_type: str):
    for ftype in ['tenant_fragment', 'custom_type_fragment']:
        print(f"Fetching {ftype} for {leaf_type}...")
        try:
            results = client.fetch_paginated(
                'schemas.custom.list',
                {'leaf_type': [leaf_type], 'types': [ftype]},
                result_key='result',
            )
            save(f'{ftype}s_{leaf_type}.json', {'fragments': results})
        except Exception as e:
            print(f"  Warning: could not fetch {ftype} for {leaf_type}: {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description='Refresh DevRev schema cache')
    parser.add_argument('--leaf-type', choices=LEAF_TYPES + ['all'], default='all')
    args = parser.parse_args()

    leaf_types = LEAF_TYPES if args.leaf_type == 'all' else [args.leaf_type]

    client = DevRevClient()

    refresh_stages(client)
    refresh_states(client)
    refresh_stage_diagrams(client)

    for lt in leaf_types:
        refresh_subtypes(client, lt)
        refresh_fragments(client, lt)

    print("\nCache refresh completed successfully.")
    print(f"Cache location: {cache_dir}")


if __name__ == '__main__':
    main()
