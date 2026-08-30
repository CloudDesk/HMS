# HMS UI Modernization Phase 2 Table Audit and Gap Note

## Scope

Phase 2 is limited to responsive table mechanics in Staff Web. It does not change data, columns, sorting, filtering, pagination, API behavior, React Query, routing, business logic, Patient Portal, forms/modals, KPI grids, or filter toolbars.

## Repository audit

- Staff Web contains 77 table elements across 48 TSX files.
- `apps/web/src/components/ui/DataTable.tsx` is the only shared `DataTable` component, but it currently has no consumers.
- Live tables use inline `.data-table`, `.doc-table`, `.adm-table`, `rp-matrix-table`, and print-specific markup.
- `.table-responsive`, `.doc-table-wrap`, and `.adm-table-wrap` already preserve horizontal scrolling.
- Base `.data-table` uses `min-width: 760px`; specialized tables retain additional minimum widths such as the `720px` admin table and `1080px` appointment queue.
- No generic mobile stacked-row behavior exists.
- Sticky positioning already exists in specialized permission/configuration matrices and must not be overridden.
- Print components use inline table styles and are not based on the responsive opt-in class.

## Safe responsive candidates

The generic behavior will be opt-in through `responsive-table`, so unlabeled or complex tables remain unchanged.

- Shared `DataTable`: header strings can safely populate `data-label` centrally without changing its public API.
- Patient Search: MRN is useful row identity; dynamic column visibility has matching conditional cells and explicit labels.
- Bed Management ward configuration: Ward is useful row identity; the five-column structure is simple.
- Doctor Directory: Doctor is useful row identity; the eight-column structure is simple and action buttons remain grouped.
- Inpatient Admission requests: Request ID is useful row identity; the eleven-column list is simple, while loading/error/empty `colSpan` rows can be handled as state cards.

## Intentionally excluded tables

- Permission matrices and branch/bed configuration matrices: existing sticky columns, generated headings, or matrix geometry.
- Appointment queues/calendars and other explicitly wide operational tables: horizontal context and specialized minimum widths are intentional.
- OPD, inpatient workspace, Emergency, surgery, laboratory, imaging, pharmacy, billing, and report tables: clinical/workflow density, state rows, nested content, or specialized layouts require individual review rather than a generic transform.
- Print prescription, order, result, invoice, receipt, and report tables: print geometry must remain unaffected.
- Patient profile/history tables and other inline `.data-table` instances without verified labels: remain horizontal-scroll tables in this phase.

## Implementation mechanics

- Keep current minimum widths and horizontal-scroll behavior at `640px` and above.
- Apply sticky first columns only to opted-in tables, with explicit header/body/hover/selected backgrounds.
- Override the base minimum width only below `640px` for opted-in tables.
- Add `data-label` to every data cell in the four approved inline tables and centrally in `DataTable`.
- Treat `colSpan` loading/error/empty cells as full-width state cards without generated labels.
- Use screen-width media queries only; no print rules or print components will be changed.

## Intended files

- `apps/web/src/components/ui/DataTable.tsx`
- `apps/web/src/pages/PatientSearchPage.tsx`
- `apps/web/src/pages/BedManagementPage.tsx`
- `apps/web/src/pages/DoctorDirectoryPage.tsx`
- `apps/web/src/pages/InpatientAdmissionPage.tsx`
- `apps/web/src/styles.css`
- Phase 2 gap, verification, and modernization-plan status documents.

