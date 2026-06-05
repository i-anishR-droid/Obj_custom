---
name: set-fields
description: Create or update DevRev custom fields using schema_engine.py for incremental, validated payload construction. Changes are saved as drafts and surfaced in the Chrome extension for review before publishing.
allowed-tools: ["Task", "Skill"]
---

# Set Fields Command

Create, update, and manage DevRev custom fields including reordering, group management, and conditional requirements. All changes are **saved as drafts** — the Chrome extension shows a banner listing pending changes, and the user promotes them to production by clicking **Publish**.

## When to Use This Command

- **Creating fields** (text, enum, date, id, bool, int, double, etc.)
- **Updating fields** (change properties, allowed values)
- **Reordering fields** (stock, custom, subtype fields)
- **Group management** (create, delete, configure visibility)
- **Field configuration** (toggle hidden, required, filterable)

## What This Command Does

Delegates to the schema-analyzer agent which will:
1. Load set-fields and devrev-object-model skills
2. Check existing resources from cache
3. Build field payloads using correct structures
4. Validate the payload
5. Save payload as a **draft** to `state/drafts/`
6. Return a summary table for your review
7. The Chrome extension banner will show the pending change — click **Publish** there to push to DevRev

## Quick Start

Simply describe what you need:
- "Create priority and customer_name fields for L1 Support subtype"
- "Reorder fields: priority first, then customer_name, then issue_description"
- "Create a group called 'Escalation Team' for UPI part only"
- "Make RRN Number required when Part=UPI AND Stage=Resolved"

---

## Core Concepts

### Stock Fields
Default system fields (Title, Description, Status, Priority, Part, Group, Stage, State). Cannot be deleted, only configured. Reorder using `stock_field_overrides`.

### Custom Fields
User-defined fields with types: text, rich_text, enum, int, double, bool, date, timestamp, id. Configurable: required, filterable, sortable, hidden. Defined in `tenant_fragment` or `custom_type_fragment`.

### Custom Type Fragments (Subtypes)
Subtype-specific fields that appear only for that subtype. Each subtype can have unique fields with a separate schema.

---

## Common Operations

### Create Fields

```
"Create priority (enum: low/medium/high), customer_name (text), and escalation_contact (text, hidden by default) fields for L1 Support tickets."
```

Agent: Loads skills → checks subtype exists → lists existing fields → builds payload → saves to draft → shows summary table.

### Reorder Fields

```
"Reorder fields: put priority first, then customer_name, then issue_description."
```

Agent: Identifies field types → updates `ui.order` (custom) or `stock_field_overrides` (stock) → saves draft.

### Create and Configure Groups

```
"Create 'One Touch Escalations' group that only appears when UPI part is selected."
```

Agent: Creates group via API → gets Part DON ID → updates `stock_field_override` with `search_query` → maps group to part.

### Make Fields Conditionally Required

```
"Make RRN Number, Transaction Date, and Transaction Amount required when Part=UPI, Group='One Touch Escalations', and Stage='Resolved'."
```

Agent: Gets all DON IDs → builds complex conditional expression → adds `require: true` effects → saves draft.

---

## Field Types (13 Total)

**Simple**: text, rich_text, int, double, bool, date, timestamp
**Complex**: enum (requires `allowed_values`), id (requires `id_type` array — valid: devu, revu, account, part, product, revo)
**Array support**: only `text` and `id` can be arrays (`is_array: true`)

---

## Draft Flow

```
schema_engine.py --save-draft
  → state/drafts/{leaf_type}_{subtype}_{timestamp}.json
  → Chrome extension reads state/drafts/
  → Banner: "3 pending changes [Publish]"
  → User clicks Publish → extension POSTs to DevRev API → clears draft
```

---

## Related Commands

- `/object-customization:dependency-fields` — Add field conditions after creating fields
- `/object-customization:stage-diagrams` — Create stage diagrams for stage-based conditions
- `/object-customization:export-draft` — Show all pending drafts

## Success Criteria

✅ Fields created with correct types and properties
✅ Draft saved to `state/drafts/`
✅ Chrome extension banner updated with pending count
✅ No data loss (hydration from cache)
✅ Validation passes before draft is written
