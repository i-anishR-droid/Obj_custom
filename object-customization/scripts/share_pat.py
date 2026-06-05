#!/usr/bin/env python3
"""
Share PAT with the Chrome extension via the draft server.

Usage:
  python3 share_pat.py <pat>
  python3 share_pat.py --from-env

Also writes the PAT to .env for use by other Python scripts.
"""

import argparse
import json
import sys
import os
from pathlib import Path

try:
    import requests
except ImportError:
    print("Error: requests library not installed. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

plugin_root = Path(os.getenv('CLAUDE_PLUGIN_ROOT', Path(__file__).parent.parent))
DRAFT_SERVER = os.getenv('DRAFT_SERVER_URL', 'http://127.0.0.1:7432')


def share_pat(pat: str):
    env_file = plugin_root / '.env'
    with open(env_file, 'w') as f:
        f.write(f"DEVREV_PAT={pat}\n")
        f.write("DEVREV_ENDPOINT=https://api.devrev.ai/internal\n")
    print(f"PAT written to {env_file}")

    try:
        resp = requests.post(f"{DRAFT_SERVER}/auth", json={'pat': pat}, timeout=3)
        if resp.ok:
            print(f"PAT shared with draft server at {DRAFT_SERVER}")
            print("Chrome extension will auto-authenticate on next load.")
        else:
            print(f"Warning: draft server returned {resp.status_code}", file=sys.stderr)
    except requests.ConnectionError:
        print("Warning: draft server not running. PAT saved to .env only.", file=sys.stderr)
        print("Start it with: python3 scripts/draft_server.py", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description='Share DevRev PAT with Chrome extension')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('pat', nargs='?', help='The PAT token to share')
    group.add_argument('--from-env', action='store_true', help='Read PAT from existing .env')
    args = parser.parse_args()

    if args.from_env:
        from dotenv import load_dotenv
        load_dotenv(plugin_root / '.env')
        pat = os.getenv('DEVREV_PAT')
        if not pat or pat == 'your_pat_here':
            print("Error: No valid PAT in .env file", file=sys.stderr)
            sys.exit(1)
    else:
        pat = args.pat

    if not pat:
        print("Error: PAT is required", file=sys.stderr)
        sys.exit(1)

    share_pat(pat)


if __name__ == '__main__':
    main()
