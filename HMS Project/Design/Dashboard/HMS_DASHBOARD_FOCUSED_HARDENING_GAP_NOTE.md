# HMS Dashboard-Focused Hardening Gap Note

## Scope

Apply the owner-confirmed role-to-dashboard mapping without changing existing sidebar access, operational module routes, permissions, backend business rules, or module workflows.

## Confirmed decisions

- The Billing dashboard and Billing dashboard data are visible only when the authenticated user has the `BILLING_AUTHORIZED` role and the existing `Billing / Invoices / View` permission.
- Super Administrators do not receive the Billing dashboard or financial dashboard content.
- Emergency, Admissions, and Surgery do not appear in the dashboard until meaningful dashboard summaries exist.
- Dashboard content must not provide shortcut navigation to Emergency, Admissions, or Surgery modules while those summaries are unavailable.
- Existing authorized sidebar and direct module access remain unchanged.

## Reusable implementation

- `DashboardShell` already builds role/permission-aware dashboard tabs and rejects stale or unauthorized `?tab=` values.
- Existing Doctor, Appointment, OPD, Pharmacy, Laboratory, Imaging, Billing, Administration, and Reports pages provide live dashboard or queue data.
- `hasPermission` and authenticated role records provide the current frontend access context.
- `getAccessibleSidebarModules` remains the source for the generic access fallback, with dashboard-only filtering applied locally.
- Existing backend route authorization remains authoritative and requires no change for this dashboard-only correction.

## Confirmed gaps

- The Super Administrator tab set includes Billing.
- The Super Administrator executive overview renders billed revenue, revenue trends, and settlement figures.
- Any non-Super-Administrator role with Billing view permission receives the Billing dashboard, even without the Billing User role.
- Emergency, Admissions, and Surgery permissions create dashboard tabs containing only module-navigation shortcuts.
- The generic dashboard fallback can still expose Emergency, Admissions, and Surgery module shortcuts.
- Existing focused tests preserve the superseded behavior and must be updated.
- Appointment and OPD dashboard actions are not independently gated by their existing action permissions.
- Doctor dashboard contains non-live placeholder metrics and a consultation action that mutates appointment status instead of opening the clinical workflow.
- Paginated appointment, OPD, and dispensing rows are used as if they were complete summary datasets.
- Failed Billing and diagnostic summary requests can be presented as real zero values.

## Shared dependencies

- Authenticated roles and expanded permissions from the existing auth session.
- Existing sidebar definitions, used read-only; sidebar content and access rules will not be changed.
- Existing dashboard pages and live API hooks.

## Intended files

- `apps/web/src/pages/DashboardShell.tsx`
- `apps/web/src/pages/DashboardShell.test.tsx`
- Dashboard pages and feature hooks for Doctor, Appointments, OPD, Pharmacy dispensing, Billing, Laboratory, and Imaging
- `apps/web/src/pages/DashboardRoleContent.test.tsx`
- This gap note and a matching verification note

Read-only Appointment and OPD dashboard-summary contracts are included because paginated list responses cannot provide authoritative KPIs. No model, mutation, permission seed, sidebar definition, or operational workflow is changed.

## Approved workload interpretation

- Doctor pending clinical work: visits ready for consultation or currently in consultation.
- Nurse action: checked-in or waiting-for-vitals visits; prepared patients are ready for consultation.
- Reception arrivals: OPD visits checked in today; walk-ins are visits whose existing type is `WALK_IN`.
- Follow-ups and urgent cases use the existing visit types and priorities; no new lifecycle value is introduced.

## Verification plan

- Verify Super Admin sees no Billing tab or financial dashboard content.
- Verify a stale `?tab=billing` value cannot mount Billing for Super Admin.
- Verify Billing dashboard visibility requires both the Billing User role and existing View permission.
- Verify a Billing User without View permission does not mount Billing.
- Verify Emergency, Admissions, and Surgery permissions do not create dashboard tabs or shortcut cards.
- Verify stale URL values for those three areas fall back safely without module navigation.
- Run focused dashboard tests, web typecheck, changed-file lint, web build, API typecheck/lint/build, and `git diff --check`.
