---
name: dependency-fields
description: Create field dependencies (cascading dropdowns, conditional visibility, conditional requirements) using schema_engine.py. Changes are saved as drafts and surfaced in the Chrome extension for review before publishing.
allowed-tools: ["Read", "AskUserQuestion", "Task", "Skill"]
---

# Field Dependency Management Command

Create and manage field dependencies in DevRev objects. Field dependencies control when fields are required, visible, or have restricted values based on other field values. All changes are **saved as drafts** for review in the Chrome extension.

## When to Use This Command

- **Cascading dropdowns** (L1 → L2 → L3)
- **Conditional visibility** (show fields based on conditions)
- **Conditional requirements** (make fields mandatory based on conditions)
- **Part-specific dependencies** (different values per part)

## What This Command Does

Delegates to the schema-analyzer agent which will:
1. Load dependency-fields and devrev-object-model skills
2. Check existing resources from cache
3. Guide you through building conditions
4. Validate expressions
5. Save validated payload as a **draft** to `state/drafts/`
6. Return a summary table for review
7. The Chrome extension banner will show the pending change — click **Publish** to push

## Quick Start

- "Create cascading dropdowns for issue categories"
- "Show escalation_contact only when priority is high"
- "Make root_cause required when severity is critical"

---

## Common Patterns

### Pattern 1: Cascading Dropdowns (L1 → L2 → L3)

> "For Digital Silver part, create 3-level issue categories. L2 options depend on L1, L3 options depend on L1+L2."

Agent: Gets Part DON ID → builds L1 condition → builds L2 conditions (one per L1 value, all L2 values grouped) → builds L3 conditions.

### Pattern 2: Conditional Visibility

> "Show 'Escalation Contact' field only when Priority is 'High' or 'Critical'."

Expression: `custom_fields.priority in ['high', 'critical']`
Effect: `show: true` (field must be hidden by default)

### Pattern 3: Conditional Requirements

> "Make 'Root Cause' required when Severity is 'Critical'."

Expression: `custom_fields.severity == 'critical'`
Effect: `require: true`

### Pattern 4: Part-Specific Values

> "For UPI part, show different L1 categories than for Silver part."

Expression: `applies_to_part == 'don:...:capability/N'`

---

## Expression Syntax

**Custom fields**: `custom_fields.field_name == 'value'`
**Stock fields**: `applies_to_part == 'don:...'`, `stage == 'don:...'`, `group == 'don:...'`, `priority == 'P0'`

**Operators**: `==`, `!=`, `&&`, `||`, `in`, `not in`
**Effects**: `show: true/false`, `require: true/false`, `allowed_values: [...]`

---

## CRITICAL: The ONE Payload Rule

All values for a single trigger must be in **ONE** condition payload — multiple payloads for the same trigger means only the last one survives.

✅ CORRECT:
```json
{
  "expression": "custom_fields.category == 'billing'",
  "effects": [{"allowed_values": ["invoice", "payment", "refund"]}]
}
```

---

## Draft Flow

```
schema_engine.py --save-draft
  → state/drafts/{leaf_type}_{subtype}_deps_{timestamp}.json
  → Chrome extension banner: "2 pending changes [Publish]"
  → User clicks Publish → extension POSTs to DevRev API
```

---

## Related Commands

- `/object-customization:set-fields` — Create fields first, then add dependencies
- `/object-customization:stage-diagrams` — Create stage diagrams for stage-based conditions
- `/object-customization:export-draft` — Show all pending drafts
