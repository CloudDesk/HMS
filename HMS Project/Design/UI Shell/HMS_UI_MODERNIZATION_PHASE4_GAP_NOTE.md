# HMS UI Modernization Phase 4 KPI, Filters, and Dashboard Audit and Gap Note

## Scope

Phase 4 is limited to Staff Web KPI cards, dashboard/panel grids, filter and toolbar layouts, action areas, and dense workspace responsiveness. It does not change metrics, calculations, filters, API calls, React state, routing, tables, forms/modals, Patient Portal, print layouts, or business behavior.

## KPI audit

### Shared primitives

- `.stat-cards-container`/`.stat-card`, `.doc-kpi-grid`/`.doc-kpi`, `.um-kpi-row`, and `.kpi-grid.enhanced` are shared or cross-feature KPI systems.
- Shared cards generally use `min-width: 0`, but several text/value descendants do not consistently wrap.
- Executive Overview and Medicine Inventory force five columns inline, so the existing `.stat-cards-container` breakpoints cannot reflow them.
- `.doc-kpi-grid`, appointment/OPD variants, and `.um-kpi-row` use repeated fixed breakpoint counts that are structurally safe candidates for the plan's `auto-fit`/`minmax(160px, 1fr)` behavior.
- The enhanced reports KPI row is flex-based with no narrow-layout exception.

### Domain and feature ownership

- Administration, System Settings, Emergency, inpatient admissions, bed management, surgery, billing, and pharmacy inventory have meaningful owner-specific KPI counts and breakpoint progressions. These are retained rather than globally consolidated.
- Emergency preserves six/three/two/one operational grouping, surgery preserves four/two/one, bed management preserves five/three/two/one, and billing preserves four/two.
- Fixed icon dimensions are intentional alignment geometry, not structural width problems.

## Dashboard and dense workspace audit

- Shared `.doc-grid` dashboard panels and administration/OPD/Emergency domain layouts already stack at existing breakpoints and set safe `minmax(0, 1fr)` columns.
- Executive Overview sets its main two-column ratio inline, preventing the existing mobile `.doc-grid.dashboard-main` stack.
- Inpatient Workspace uses raw inline four-card, four-filter, and `380px + content` split layouts; the split cannot respond through domain CSS.
- Emergency Workspace uses a raw `content + 260px` split even though the domain already owns `.emergency-workspace-layout` and its responsive behavior.
- Sticky and side panels in OPD, Emergency, billing, inpatient, administration, and doctor screens already become static or move below primary content at their established breakpoints.

## Filter and toolbar audit

- Shared `FilterToolbar`, `.doc-toolbar`, `.filters-toolbar`, administration, appointments, doctor, bed-board, surgery, Emergency, and pharmacy toolbars already wrap or grid-stack.
- Shared `FilterToolbar` primary/actions rows need explicit wrapping and safe shrinking for long action labels.
- Billing's seven-control history filter becomes three columns below 1180px but has no phone/tablet progression.
- Inpatient Admission and Inpatient Workspace set seven/four columns inline, bypassing `.adm-filters` responsive rules. The Inpatient Workspace search field also uses an inline two-column span that must reset when stacked.
- The Patient Documents inline `gridTemplateColumns` is inert because `.emr-filter-row` is flex-based; its existing wrapping behavior is intentionally left unchanged.
- Table wrappers, sticky columns, pagination, row actions, loading, and empty states remain owned by Phase 2 and are not changed.

## Cascade, fixed-width, and special-case audit

- No KPI/filter/dashboard `!important` override is required for the intended implementation.
- Existing `!important` declarations belong to status colors, table geometry, clinical inputs, and established overlay/error behavior; none will be removed.
- Fixed table cells, icon buttons, clinical steppers, chart geometry, and operational timelines are intentional special cases.
- HMS Local confirms progressive KPI counts, wrapping toolbars, stacked dashboard side panels, and one-column mobile filters while retaining desktop composition.

## Intended implementation

- Replace the two inline five-column KPI declarations with a shared modifier and responsive `auto-fit` grid.
- Apply safe `auto-fit` behavior to the structurally shared doctor/appointment/OPD and administration KPI families and the reports KPI row.
- Add shared KPI text wrapping and panel shrink protection without changing colors, spacing, or typography.
- Move executive, inpatient, and Emergency major layout columns from inline styles into existing shared/domain ownership with responsive exceptions.
- Move inpatient filter counts and the wide search span into inpatient domain classes.
- Add billing-owned tablet/mobile filter progression and shared toolbar/action wrapping.
- Place every new responsive rule under `@media screen` so print output is unaffected.

## Intended files

- `apps/web/src/styles.css`
- `apps/web/src/domains/inpatient.css`
- `apps/web/src/domains/emergency.css`
- `apps/web/src/features/billing.css`
- `apps/web/src/features/pharmacy.css`
- `apps/web/src/pages/DashboardShell.tsx`
- `apps/web/src/pages/PharmacyMedicineInventoryPage.tsx`
- `apps/web/src/pages/InpatientAdmissionPage.tsx`
- `apps/web/src/pages/InpatientWorkspacePage.tsx`
- `apps/web/src/pages/EmergencyWorkspacePage.tsx`
- Phase 4 gap, verification, and modernization-plan status documents.

