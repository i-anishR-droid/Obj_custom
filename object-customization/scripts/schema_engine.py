#!/usr/bin/env python3
"""
Schema Engine — deterministic CLI tool for building, validating, saving drafts,
and publishing DevRev schema payloads incrementally.

Usage:
  # Initialize payload
  python3 schema_engine.py --init --load-from-cache --leaf-type ticket --subtype "L1 Support"

  # Add fields
  python3 schema_engine.py --payload-file payloads/working/ticket_l1_support.json \
    --add-fields '[{"name": "priority", "field_type": "enum", "allowed_values": ["low","medium","high"]}]'

  # Add conditions
  python3 schema_engine.py --payload-file payloads/working/ticket_l1_support.json \
    --add-conditions '[{"expression": "custom_fields.priority == \"high\"", "effects": [...]}]'

  # Init stage diagram
  python3 schema_engine.py --init-stage-diagram --leaf-type ticket --subtype "L1 Support"

  # Add stages
  python3 schema_engine.py --payload-file payloads/working/ticket_l1_support_stage_diagram.json \
    --add-stages '[{"stage_id": "don:...", "is_start": true, "transitions": []}]'

  # Validate
  python3 schema_engine.py --payload-file payloads/working/ticket_l1_support.json --validate

  # Save as draft (for Chrome extension)
  python3 schema_engine.py --payload-file payloads/working/ticket_l1_support.json --save-draft

  # Publish directly to DevRev API
  python3 schema_engine.py --payload-file payloads/working/ticket_l1_support.json \
    --publish --api-endpoint schemas.custom.set

  # List subtypes
  python3 schema_engine.py --list-subtype

  # List fields
  python3 schema_engine.py --subtype "L1 Support" --list-fields

  # Show payload
  python3 schema_engine.py --payload-file payloads/working/ticket_l1_support.json --show
"""

import argparse
import json
import re
import sys
import shutil
from datetime import datetime
from pathlib import Path
import os

plugin_root = Path(os.getenv('CLAUDE_PLUGIN_ROOT', Path(__file__).parent.parent))
sys.path.insert(0, str(plugin_root / 'scripts'))

cache_dir = plugin_root / '.cache' / 'schemas'
working_dir = plugin_root / 'state' / 'payloads' / 'working'
previous_dir = plugin_root / 'state' / 'payloads' / 'previous'
snapshots_dir = plugin_root / 'state' / 'payloads' / 'snapshots'
drafts_dir = plugin_root / 'state' / 'drafts'

for d in [working_dir, previous_dir, snapshots_dir, drafts_dir]:
    d.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_json(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def save_json(path: Path, data: dict):
    if path.exists():
        prev = previous_dir / path.name
        shutil.copy2(path, prev)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)


def cache_file(name: str) -> Path:
    return cache_dir / name


def to_snake(name: str) -> str:
    return re.sub(r'[^a-z0-9_]', '_', name.lower().replace(' ', '_'))


# ---------------------------------------------------------------------------
# Init payload
# ---------------------------------------------------------------------------

def init_payload(args):
    leaf_type = args.leaf_type or 'ticket'
    subtype = args.subtype
    load_from_cache = args.load_from_cache

    if subtype:
        subtype_snake = to_snake(subtype)
        filename = f"{leaf_type}_{subtype_snake}.json"
        payload = {
            'leaf_type': leaf_type,
            'type': 'custom_type_fragment',
            'subtype': subtype_snake,
            'subtype_display_name': subtype,
            'description': f'Custom fields for {subtype} {leaf_type}s',
            'fields': [],
            'conditions': [],
        }

        if load_from_cache:
            cache = cache_dir / f'custom_type_fragments_{leaf_type}.json'
            if cache.exists():
                data = load_json(cache)
                for frag in data.get('fragments', []):
                    if frag.get('subtype') == subtype_snake:
                        payload['fields'] = frag.get('fields', [])
                        payload['conditions'] = frag.get('conditions', [])
                        print(f"Loaded existing payload from cache: {subtype_snake}")
                        break
    else:
        filename = f"{leaf_type}_tenant.json"
        payload = {
            'leaf_type': leaf_type,
            'type': 'tenant_fragment',
            'description': f'Tenant-level custom fields for {leaf_type}s',
            'fields': [],
            'conditions': [],
            'stock_field_overrides': [],
        }

        if load_from_cache:
            cache = cache_dir / f'tenant_fragments_{leaf_type}.json'
            if cache.exists():
                data = load_json(cache)
                frags = data.get('fragments', [])
                if frags:
                    frag = frags[0]
                    payload['fields'] = frag.get('fields', [])
                    payload['conditions'] = frag.get('conditions', [])
                    payload['stock_field_overrides'] = frag.get('stock_field_overrides', [])
                    print(f"Loaded existing tenant payload from cache")

    out_path = working_dir / filename
    save_json(out_path, payload)
    print(f"Created new payload: {out_path}")
    return out_path


# ---------------------------------------------------------------------------
# Init stage diagram
# ---------------------------------------------------------------------------

def init_stage_diagram(args):
    leaf_type = args.leaf_type or 'ticket'
    subtype = args.subtype
    load_from_cache = args.load_from_cache

    subtype_snake = to_snake(subtype) if subtype else 'default'
    filename = f"{leaf_type}_{subtype_snake}_stage_diagram.json"

    payload = {
        'leaf_type': leaf_type,
        'name': f"{leaf_type}_{subtype_snake}_transitions",
        'stages': [],
        'draft_type': 'stage_diagram',
    }

    if load_from_cache:
        # Find stage diagram associated with this subtype
        frag_cache = cache_dir / f'custom_type_fragments_{leaf_type}.json'
        diagrams_cache = cache_dir / 'stage-diagrams.json'
        if frag_cache.exists() and diagrams_cache.exists():
            frags = load_json(frag_cache).get('fragments', [])
            for frag in frags:
                if frag.get('subtype') == subtype_snake:
                    sd = frag.get('stage_diagram', {})
                    sd_id = sd.get('id')
                    if sd_id:
                        diagrams = load_json(diagrams_cache).get('stage_diagrams', [])
                        for diag in diagrams:
                            if diag.get('id') == sd_id:
                                payload['stages'] = [
                                    {k: v for k, v in s.items() if k not in ('id', 'created_date', 'modified_date')}
                                    for s in diag.get('stages', [])
                                ]
                                payload['name'] = diag.get('name', payload['name'])
                                print(f"Loaded existing stage diagram from cache: {diag.get('name')}")
                                break
                    break

    out_path = working_dir / filename
    save_json(out_path, payload)
    print(f"Created stage diagram payload: {out_path}")
    return out_path


# ---------------------------------------------------------------------------
# Add fields
# ---------------------------------------------------------------------------

def add_fields(args):
    payload_path = Path(args.payload_file)
    payload = load_json(payload_path)
    new_fields = json.loads(args.add_fields)

    existing_names = {f['name'] for f in payload.get('fields', [])}
    added = []
    for field in new_fields:
        name = field.get('name', '')
        if name in existing_names:
            print(f"  Skipping duplicate field: {name}")
            continue
        payload.setdefault('fields', []).append(field)
        existing_names.add(name)
        added.append(name)

    save_json(payload_path, payload)
    print(f"Fields added successfully: {len(added)}")
    print(f"Total fields added: {len(added)}")
    for n in added:
        print(f"  + {n}")


# ---------------------------------------------------------------------------
# Add conditions
# ---------------------------------------------------------------------------

def add_conditions(args):
    payload_path = Path(args.payload_file)
    payload = load_json(payload_path)
    new_conditions = json.loads(args.add_conditions)

    payload.setdefault('conditions', []).extend(new_conditions)
    save_json(payload_path, payload)
    print(f"Conditions added successfully: {len(new_conditions)}")
    print(f"Total conditions added: {len(new_conditions)}")


# ---------------------------------------------------------------------------
# Add stages
# ---------------------------------------------------------------------------

def add_stages(args):
    payload_path = Path(args.payload_file)
    payload = load_json(payload_path)
    new_stages = json.loads(args.add_stages)

    existing_ids = {s['stage_id'] for s in payload.get('stages', [])}
    added = 0
    for stage in new_stages:
        sid = stage.get('stage_id', '')
        if sid in existing_ids:
            print(f"  Skipping duplicate stage: {sid}")
            continue
        payload.setdefault('stages', []).append(stage)
        existing_ids.add(sid)
        added += 1
        print(f"  Added stage: {sid}")

    save_json(payload_path, payload)
    print(f"Total stages added: {added}")


# ---------------------------------------------------------------------------
# Add transitions
# ---------------------------------------------------------------------------

def add_transitions(args):
    # Format: "stage_id:target1,target2"
    payload_path = Path(args.payload_file)
    payload = load_json(payload_path)
    raw = args.add_transitions
    parts = raw.split(':', 1)
    if len(parts) != 2:
        print("Error: --add-transitions format is 'stage_id:target1,target2'", file=sys.stderr)
        sys.exit(1)

    src_id, targets_str = parts
    targets = [t.strip() for t in targets_str.split(',') if t.strip()]

    for stage in payload.get('stages', []):
        if stage['stage_id'] == src_id:
            existing = {t['target_stage_id'] for t in stage.get('transitions', [])}
            for tgt in targets:
                if tgt not in existing:
                    stage.setdefault('transitions', []).append({'target_stage_id': tgt})
                    existing.add(tgt)
            break
    else:
        print(f"Error: stage_id {src_id} not found in payload.", file=sys.stderr)
        sys.exit(1)

    save_json(payload_path, payload)
    print(f"Transitions added to {src_id}")


# ---------------------------------------------------------------------------
# Set start stage
# ---------------------------------------------------------------------------

def set_start_stage(args):
    payload_path = Path(args.payload_file)
    payload = load_json(payload_path)
    target = args.set_start_stage

    found = False
    for stage in payload.get('stages', []):
        stage['is_start'] = (stage['stage_id'] == target)
        if stage['stage_id'] == target:
            found = True

    if not found:
        print(f"Error: stage_id {target} not found.", file=sys.stderr)
        sys.exit(1)

    save_json(payload_path, payload)
    print(f"Start stage set: {target}")


# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------

def validate(args):
    payload_path = Path(args.payload_file)
    payload = load_json(payload_path)
    errors = []
    warnings = []

    dtype = payload.get('draft_type', payload.get('type', ''))

    if 'stage_diagram' in str(payload_path) or dtype == 'stage_diagram':
        # Stage diagram validation
        stages = payload.get('stages', [])
        stage_ids = {s['stage_id'] for s in stages}
        start_count = sum(1 for s in stages if s.get('is_start'))

        if start_count == 0:
            errors.append("No is_start stage defined")
        elif start_count > 1:
            errors.append(f"Multiple start stages defined ({start_count})")

        for stage in stages:
            for t in stage.get('transitions', []):
                tgt = t.get('target_stage_id', '')
                if tgt not in stage_ids:
                    errors.append(f"Transition target {tgt} not in diagram")
            if not re.match(r'^don:.*:[a-z_]+/\d+$', stage.get('stage_id', '')):
                errors.append(f"Invalid stage_id format: {stage.get('stage_id')}")
    else:
        # Schema fragment validation
        fields = payload.get('fields', [])
        names = [f.get('name', '') for f in fields]
        if len(names) != len(set(names)):
            errors.append("Duplicate field names found")

        for field in fields:
            name = field.get('name', '')
            ftype = field.get('field_type', '')
            if not re.match(r'^[a-z][a-z0-9_]*$', name):
                warnings.append(f"Field name not snake_case: {name}")
            if ftype == 'enum' and not field.get('allowed_values'):
                errors.append(f"Enum field '{name}' missing allowed_values")
            if ftype == 'id' and not field.get('id_type'):
                errors.append(f"ID field '{name}' missing id_type")

        for i, cond in enumerate(payload.get('conditions', []), 1):
            if not cond.get('expression'):
                errors.append(f"Condition {i} missing expression")
            if not cond.get('effects'):
                errors.append(f"Condition {i} missing effects")

    if errors:
        print("❌ Validation FAILED:")
        for e in errors:
            print(f"  ERROR: {e}")
        if warnings:
            for w in warnings:
                print(f"  WARNING: {w}")
        sys.exit(1)
    else:
        print("✅ Validation passed")
        if warnings:
            for w in warnings:
                print(f"  WARNING: {w}")


# ---------------------------------------------------------------------------
# Show
# ---------------------------------------------------------------------------

def show_payload(args):
    payload_path = Path(args.payload_file)
    payload = load_json(payload_path)
    print(json.dumps(payload, indent=2))


# ---------------------------------------------------------------------------
# Save draft
# ---------------------------------------------------------------------------

def save_draft(args):
    import subprocess
    payload_path = Path(args.payload_file)
    result = subprocess.run(
        [sys.executable, str(plugin_root / 'scripts' / 'draft_manager.py'), '--write', str(payload_path)],
        capture_output=True,
        text=True,
    )
    print(result.stdout)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        sys.exit(result.returncode)


# ---------------------------------------------------------------------------
# Publish
# ---------------------------------------------------------------------------

def publish(args):
    from devrev_client import DevRevClient

    payload_path = Path(args.payload_file)
    payload = load_json(payload_path)
    endpoint = args.api_endpoint or 'schemas.custom.set'

    # Snapshot before publish
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    snap = snapshots_dir / f"{payload_path.stem}_{ts}.json"
    shutil.copy2(payload_path, snap)
    print(f"Snapshot: {snap}")

    clean = {k: v for k, v in payload.items() if k not in ('draft_type',)}
    client = DevRevClient()
    result = client.post(endpoint, clean)
    print(f"✅ Schema published successfully!")
    print(f"Fragment DON ID: {result.get('result', {}).get('id', 'N/A')}")
    print(f"Working file: {payload_path}")


# ---------------------------------------------------------------------------
# List subtypes
# ---------------------------------------------------------------------------

def list_subtypes(args):
    leaf_type = args.leaf_type or 'ticket'
    cache = cache_dir / f'subtypes_{leaf_type}.json'
    if not cache.exists():
        print(f"Cache not found for {leaf_type}. Run refresh_cache.py first.", file=sys.stderr)
        sys.exit(1)
    data = load_json(cache)
    subtypes = data.get('subtypes', [])
    if not subtypes:
        print(f"No subtypes found for {leaf_type}.")
        return
    print(f"Subtypes for {leaf_type} ({len(subtypes)}):")
    for s in subtypes:
        val = s.get('value', '')
        display = s.get('display_name', val)
        print(f"  {display} ({val})")


# ---------------------------------------------------------------------------
# List fields
# ---------------------------------------------------------------------------

def list_fields(args):
    if not args.subtype:
        print("Error: --subtype required with --list-fields", file=sys.stderr)
        sys.exit(1)
    leaf_type = args.leaf_type or 'ticket'
    subtype_snake = to_snake(args.subtype)

    cache = cache_dir / f'custom_type_fragments_{leaf_type}.json'
    if not cache.exists():
        print(f"Cache not found. Run refresh_cache.py first.", file=sys.stderr)
        sys.exit(1)

    data = load_json(cache)
    for frag in data.get('fragments', []):
        if frag.get('subtype') == subtype_snake:
            fields = frag.get('fields', [])
            print(f"Fields for {args.subtype} ({len(fields)}):")
            for f in fields:
                name = f.get('name', '')
                ftype = f.get('field_type', f.get('type', ''))
                req = ' [required]' if f.get('is_required') else ''
                print(f"  {name} ({ftype}){req}")
            return
    print(f"Subtype '{args.subtype}' not found in cache. Run refresh_cache.py.")


# ---------------------------------------------------------------------------
# Get examples
# ---------------------------------------------------------------------------

def get_examples(args):
    kind = args.get_examples
    if kind == 'field':
        print(json.dumps([
            {"name": "customer_name", "field_type": "text", "is_required": False, "ui": {"display_name": "Customer Name", "order": 1}},
            {"name": "priority", "field_type": "enum", "allowed_values": ["low", "medium", "high"], "ui": {"display_name": "Priority", "order": 2}},
            {"name": "related_account", "field_type": "id", "id_type": ["account"], "ui": {"display_name": "Related Account", "order": 3}},
            {"name": "is_escalated", "field_type": "bool", "ui": {"display_name": "Is Escalated", "order": 4}},
        ], indent=2))
    elif kind == 'stage':
        print(json.dumps([
            {"stage_id": "don:core:...:custom_stage/10", "is_start": True, "is_deprecated": False, "transitions": [{"target_stage_id": "don:core:...:custom_stage/20"}]},
            {"stage_id": "don:core:...:custom_stage/20", "is_start": False, "is_deprecated": False, "transitions": []},
        ], indent=2))
    elif kind == 'condition':
        print(json.dumps([
            {"expression": "custom_fields.priority == 'high'", "effects": [{"fields": ["custom_fields.escalation_notes"], "show": True}]},
            {"expression": "custom_fields.severity == 'critical'", "effects": [{"fields": ["custom_fields.root_cause"], "require": True}]},
        ], indent=2))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='DevRev Schema Engine')

    # Init
    parser.add_argument('--init', action='store_true', help='Initialize a new schema payload')
    parser.add_argument('--init-stage-diagram', action='store_true', help='Initialize a stage diagram payload')
    parser.add_argument('--load-from-cache', action='store_true', help='Hydrate payload from cache')
    parser.add_argument('--leaf-type', default='ticket', choices=['ticket', 'issue', 'conversation'])
    parser.add_argument('--subtype', help='Subtype name (e.g., "L1 Support")')

    # Operations on working files
    parser.add_argument('--payload-file', help='Path to working payload file')
    parser.add_argument('--add-fields', help='JSON array of fields to add')
    parser.add_argument('--add-conditions', help='JSON array of conditions to add')
    parser.add_argument('--add-stages', help='JSON array of stages to add')
    parser.add_argument('--add-transitions', help='stage_id:target1,target2')
    parser.add_argument('--set-start-stage', help='Set a stage as is_start')

    # Output
    parser.add_argument('--validate', action='store_true', help='Validate payload')
    parser.add_argument('--show', action='store_true', help='Print payload as JSON')
    parser.add_argument('--save-draft', action='store_true', help='Save payload as draft for Chrome extension')
    parser.add_argument('--publish', action='store_true', help='Publish payload directly to DevRev API')
    parser.add_argument('--api-endpoint', help='API endpoint for publish')

    # Listing
    parser.add_argument('--list-subtype', action='store_true', help='List all subtypes from cache')
    parser.add_argument('--list-fields', action='store_true', help='List fields for a subtype from cache')
    parser.add_argument('--get-examples', choices=['field', 'stage', 'condition'], help='Print example JSON')

    args = parser.parse_args()

    if args.init:
        init_payload(args)
    elif args.init_stage_diagram:
        init_stage_diagram(args)
    elif args.add_fields:
        add_fields(args)
    elif args.add_conditions:
        add_conditions(args)
    elif args.add_stages:
        add_stages(args)
    elif args.add_transitions:
        add_transitions(args)
    elif args.set_start_stage:
        set_start_stage(args)
    elif args.validate:
        validate(args)
    elif args.show:
        show_payload(args)
    elif args.save_draft:
        save_draft(args)
    elif args.publish:
        publish(args)
    elif args.list_subtype:
        list_subtypes(args)
    elif args.list_fields:
        list_fields(args)
    elif args.get_examples:
        get_examples(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
