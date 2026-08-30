# HMS UI Modernization Phase 1 Gap Note

## Scope

Phase 1 is limited to Staff Web foundation mechanics: fluid tokens, shell sizing, tablet sidebar defaults, mobile drawer preservation, dynamic viewport height, and the large-screen content cap. Patient Portal and later modernization phases are excluded.

## Reusable implementation

- `apps/web/src/components/layout/DashboardLayout.tsx` already owns sidebar collapsed state and mobile drawer state.
- `Sidebar.tsx`, `MobileSidebarDrawer.tsx`, and `MobileSidebarBackdrop.tsx` already provide expanded, collapsed, off-canvas, and backdrop interactions.
- `TopHeader.tsx` already composes `BranchSelector`, `NotificationsMenu`, and `UserMenu`.
- `apps/web/src/styles.css` already contains the Staff Web shell rules and mobile adaptations.
- `scope/HMS Local/dashboard.css` confirms the existing dark sidebar, white header, collapsed rail, and mobile drawer visual patterns.

## Gaps to close

- Root foundation lacks the Phase 1 fluid spacing, type, structural, and breakpoint tokens.
- Sidebar structural widths remain fixed at `280px` and `72px`.
- Header height remains fixed at `70px`.
- The dashboard shell uses only `100vh`.
- Direct main-content children have no `1600px` large-monitor cap.
- Sidebar state always initializes expanded; there is no tablet-width default or breakpoint transition handling.
- The existing mobile media query includes `768px`, which conflicts with the approved `768px` tablet lower bound.

## Dependencies and decisions

- No backend, API, routing, React Query, business workflow, or cross-developer contract is required for this mechanical shell change.
- The unavailable release FSD and Developer 1 prompt do not affect these Staff Web layout mechanics.
- Existing uncommitted stylesheet restructuring and Patient Portal changes are user-owned and must be preserved.

## Intended files

- `apps/web/src/styles.css`
- `apps/web/src/components/layout/DashboardLayout.tsx`
- `HMS_UI_Modernization_Plan.md` (status only after verification)
- `HMS_UI_MODERNIZATION_PHASE1_VERIFICATION.md`

