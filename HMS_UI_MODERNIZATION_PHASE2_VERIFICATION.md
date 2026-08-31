# HMS UI Modernization Phase 2 Verification

## Table audit summary

- Audited 77 Staff Web table elements across 48 TSX files.
- Confirmed that the shared `DataTable` currently has no consumers and that all live tables are inline.
- Audited base `.data-table`, `.table-responsive`, `.doc-table`, `.adm-table`, specialized minimum widths, existing sticky matrices, mobile rules, and print-specific components.
- Selected only four simple live tables plus the shared component for the generic responsive behavior.

## Implemented functionality

- Added central `data-label` generation from `columns[].header` in `DataTable` without changing its public API.
- Added the opt-in `responsive-table` class to Patient Search, Bed Management ward configuration, Doctor Directory, and Inpatient Admission requests.
- Added explicit labels to every normal data cell in those inline tables.
- Added sticky first columns at `640px` and above with header/body/hover/selected background handling.
- Added stacked card rows below `640px`, including wrapping, action-cell support, and full-width `colSpan` state rows.
- Added horizontal scrolling to the Bed Management `table-scroll` wrapper.

## Preserved behavior

- The base `760px` `.data-table` minimum width remains unchanged for tablet and desktop.
- Specialized `720px`, `780px`, `1080px`, calendar, and clinical minimum widths remain unchanged.
- Sorting, filtering, pagination, row selection, action handlers, API calls, React Query, routes, and data columns are unchanged.
- Existing colors, borders, typography, hover states, status badges, and action groups are reused.

## Intentionally excluded tables

- Permission and configuration matrices with existing sticky/generated geometry.
- Appointment queues/calendars and other intentionally wide operational tables.
- OPD, inpatient workspace, Emergency, surgery, diagnostic, pharmacy, billing, reports, and patient-history tables requiring individual workflow review.
- All print-specific tables and document layouts.

## Files changed for Phase 2

- `apps/web/src/components/ui/DataTable.tsx`
- `apps/web/src/components/ui/DataTable.test.tsx`
- `apps/web/src/pages/PatientSearchPage.tsx`
- `apps/web/src/pages/BedManagementPage.tsx`
- `apps/web/src/pages/DoctorDirectoryPage.tsx`
- `apps/web/src/pages/InpatientAdmissionPage.tsx`
- `apps/web/src/styles.css`
- `apps/web/tsconfig.tsbuildinfo` (build-generated update recording the new test file; cleanup approval was declined)
- `HMS_UI_Modernization_Plan.md`
- `HMS_UI_MODERNIZATION_PHASE2_GAP_NOTE.md`
- `HMS_UI_MODERNIZATION_PHASE2_VERIFICATION.md`

## Automated verification

- Focused `DataTable` responsive-label test: passed, 1 test.
- Targeted ESLint for all changed TSX/test files: passed.
- Full Staff Web lint: blocked by the same 34 unrelated baseline errors; no Phase 2 file was reported.
- Staff Web typecheck: passed.
- Staff Web production build: passed.
- Patient Web typecheck: passed.
- Patient Web production build: passed with its existing Vite large-chunk warning.
- API typecheck and production build: passed; no API file changed.
- Full API lint: blocked by 42 unrelated baseline errors.
- `git diff --check`: passed.

## Print and Patient Portal safety

- Responsive rules use `@media screen`, so they do not participate in print rendering.
- Print components do not use `responsive-table` and were not modified.
- No Phase 2 edit was made under `apps/patient-web/**`; its pre-existing dirty files were preserved.

## Browser QA and remaining risk

- No in-app or connected browser was available, so the requested viewport and zoom matrix was not visually verified.
- Sticky-column overlap, card density, action wrapping, and absence of viewport overflow still require interactive acceptance.
- The tracked TypeScript build-info artifact remains changed because the generated cleanup operation was not approved.
- Full repository lint retains unrelated baseline failures; only the Phase 2 files are claimed lint-clean.
- Phase 3 has not started.
