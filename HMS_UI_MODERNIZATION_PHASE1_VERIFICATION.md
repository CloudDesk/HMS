# HMS UI Modernization Phase 1 Verification

## Implemented functionality

- Added the approved fluid spacing, typography, sidebar, header, and breakpoint tokens to the existing Staff Web stylesheet.
- Replaced Staff Web sidebar structural widths with `--sidebar-width` and `--sidebar-width-collapsed`.
- Replaced the Staff Web header's fixed `70px` sizing with `--header-height`.
- Added `100dvh` after the `100vh` dashboard-shell fallback.
- Capped direct main-content children at `1600px`, centered, with `width: 100%` compatibility.
- Added viewport-band handling so `768px` through `1024px` initializes as a collapsed icon rail, remains user-expandable, and resets only when crossing viewport bands.
- Preserved the off-canvas drawer below `768px` and kept narrow header controls compact through `900px`.

## Existing functionality reused

- Existing `DashboardLayout` collapsed and mobile-open state.
- Existing `Sidebar`, `MobileSidebarDrawer`, `MobileSidebarBackdrop`, and sidebar toggle interaction.
- Existing `TopHeader`, `BranchSelector`, `NotificationsMenu`, and `UserMenu` composition.
- Existing HMS Local dark sidebar, white sticky header, icon rail, and mobile drawer patterns.

## Files and shared modules changed

- `apps/web/src/styles.css`
- `apps/web/src/components/layout/DashboardLayout.tsx`
- `HMS_UI_Modernization_Plan.md`
- `HMS_UI_MODERNIZATION_PHASE1_GAP_NOTE.md`
- `HMS_UI_MODERNIZATION_PHASE1_VERIFICATION.md`

No backend, permission, route, API, React Query, patient workflow, or business-logic contract changed.

## Automated verification

- `npm run typecheck --workspace=@hms/web`: passed.
- `npm run build --workspace=@hms/web`: passed.
- Targeted ESLint for `DashboardLayout.tsx`: passed.
- Full Staff Web lint: blocked by 34 pre-existing errors in unrelated files; no error was reported in either Phase 1 file.
- `npm run typecheck --workspace=@hms/patient-web`: passed.
- `npm run build --workspace=@hms/patient-web`: passed with the existing Vite large-chunk warning.
- `npm run typecheck --workspace=@hms/api`: passed.
- `npm run build --workspace=@hms/api`: passed.
- Full API lint: blocked by 42 pre-existing errors in unrelated files.
- `git diff --check`: passed.

## Manual and browser verification

- Source-level checks confirm desktop expanded state, tablet collapsed default, retained toggle interaction, mobile drawer cutoff below `768px`, compact header controls through `900px`, dynamic viewport height, and the `1600px` content cap.
- Interactive viewport, zoom, clipping, and visual-regression checks were not run because no in-app or connected browser was available in the session. These remain required before declaring the phase fully accepted.

## Patient Portal confirmation

No Phase 1 edit was made under `apps/patient-web/**`. The two Patient Portal files already appeared modified before this phase began and were preserved unchanged by this work.

## Remaining risk and stop gate

- Visual behavior at the requested viewport and zoom matrix is not yet browser-verified.
- Existing unrelated Staff Web and API lint baselines remain red.
- Phase 2 has not started.

