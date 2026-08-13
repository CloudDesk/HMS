# HMS UI Reference Standard

## Source of Truth

All HMS Enterprise UI screens must follow HMS Local UI patterns.

Do not invent new layouts.

Do not redesign screens independently.

Before implementing any page:

1. Find the equivalent screen in HMS Local.
2. Analyze:
   - Layout
   - Filters
   - Cards
   - Table structure
   - Action buttons
   - Modal structure
   - Pagination
   - Colors
   - Spacing
3. Recreate the same UX pattern in HMS Enterprise.

Only modernize visuals where necessary.
Do not change workflows.

---

## Screen Mapping

Administration > User Management
Reference: HMS Local > User Management

Administration > Department Management
Reference: HMS Local > Department Management

Administration > Branch Management
Reference: HMS Local > Branch Management

Administration > Service Catalogue
Reference: HMS Local > Service Catalogue

...

---

## Implementation Rules

If a screen exists in HMS Local:

- Reuse the same layout.
- Reuse the same filter arrangement.
- Reuse the same table structure.
- Reuse the same actions.
- Reuse the same modal workflow.

Do not create a new UI from scratch.

If a required screen does not exist in HMS Local:

- Follow the closest matching HMS Local module.
- Maintain consistency with existing HMS Local patterns.

---

## Validation

Before marking a screen complete:

- Compare with HMS Local.
- Verify layout consistency.
- Verify filter consistency.
- Verify table consistency.
- Verify action consistency.
- Verify modal consistency.

Any deviation must be reported.

## Icon Standard

Library: Phosphor Icons v2.x

Rules:
- Never create custom ASCII fallback icons.
- Never override `.ph`, `.ph::before`, or icon font-family rules.
- All icons must come from the official Phosphor package.
- Any icon CSS override must be reviewed before merge.
- Icon rendering must be verified in:
  - Sidebar
  - Header actions
  - Table actions
  - KPI cards
  - Quick Actions panels