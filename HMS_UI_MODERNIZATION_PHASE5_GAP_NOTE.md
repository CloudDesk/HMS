# HMS UI Modernization Phase 5 Gap Note

## Reusable implementation under verification

- Phase 1 Staff Web shell tokens, dynamic viewport sizing, responsive sidebar/header behavior, and the 1600px content cap.
- Phase 2 opt-in responsive tables, generated or explicit `data-label` values, sticky identity columns, mobile row cards, and the focused `DataTable` test.
- Phase 3 screen-only form/control/modal containment, wrapping, viewport-bounded modal scrolling, and responsive action areas.
- Phase 4 KPI, dashboard, filter, toolbar, and side-panel reflow rules owned by shared, domain, and feature stylesheets.
- Existing print-specific CSS and application behavior; Phase 5 does not redesign or refactor these systems.

## Architecture and working-tree baseline

- The Staff Web entry point imports `tokens.css`, `reset.css`, `components.css`, domain styles, feature styles, `styles.css`, and the existing `diagnostics.css` in foundational-to-specific order.
- Every imported Staff Web stylesheet exists. No additional Phase 5 stylesheet is required or planned.
- The working tree contains accumulated Phase 1-4 changes and pre-existing Patient Portal changes. Phase 5 will not reset, restore, or overwrite them.
- Patient Portal currently references Staff Web `tokens.css` and `components.css` through its pre-existing `@web` imports. Phase 5 will not change those files and will verify their current contract through Patient Web typecheck and build.

## Verification gap and stop gate

- No in-app or connected browser is available. Interactive desktop, mobile, tablet, zoom, modal, sticky-column, and print-preview verification therefore cannot be completed in this session.
- Automated and source-level checks can prove compilation, type safety, focused table behavior, import integrity, screen/print separation, and absence of whitespace errors, but cannot substitute for visual acceptance.
- Unless a concrete automated/static regression is found, Phase 5 will make no application-code or CSS changes and its final status will remain pending browser QA.

