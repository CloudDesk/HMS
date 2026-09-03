# HMS Dashboard-Focused Hardening Verification

## Implemented functionality

- Removed the Billing tab from the Super Administrator dashboard.
- Removed billed-revenue, revenue-trend, and financial-settlement presentation from the Super Administrator executive overview.
- Added the existing live Pharmacy, Laboratory, Imaging, and Reports dashboard views to the Super Administrator dashboard set.
- Restricted the Billing dashboard to users who have both the `BILLING_AUTHORIZED` role and the existing `Billing / Invoices / View` permission.
- Removed Emergency, Admissions, and Surgery shortcut-only tabs from the dashboard.
- Excluded Emergency, Admissions, and Surgery from the generic dashboard module-card fallback so the dashboard cannot navigate to those modules while meaningful summaries are unavailable.
- Preserved safe fallback behavior for stale or unauthorized `?tab=` values.
- Gated Appointment and OPD quick actions and row mutations by their existing permissions.
- Removed non-live Doctor placeholder KPIs and replaced the incorrect appointment-status mutation with navigation to the authorized clinical queue.
- Prevented incomplete paginated Appointment and OPD rows from being shown as complete totals or trends.
- Switched Pharmacy dispensing counts to status-filtered API totals.
- Rendered unavailable states, rather than real-looking zero values, when Billing or diagnostic summaries fail.
- Added permission-protected, read-only Appointment and OPD dashboard summary APIs so KPI totals do not depend on pagination.
- Added Doctor totals for follow-ups, urgent cases, waiting patients, and pending clinical work using existing scoped workflow states.
- Added OPD workload totals for awaiting nursing action, ready-for-doctor, completed, urgent, and walk-in patients.
- Applied the selected global branch context to Appointment and OPD rows and summaries; Doctor summaries are restricted to the authenticated user's linked doctor record, and Nurse/Clinician summaries to assigned departments.

## Existing functionality reused

- Existing authenticated role and expanded-permission context.
- Existing `hasPermission`, Super Administrator detection, URL tab state, and safe tab fallback.
- Existing live Doctor, Appointment, OPD, Pharmacy, Laboratory, Imaging, Billing, Administration, and Reports dashboard/queue pages.
- Existing sidebar and direct-route access without modification.
- Existing backend authorization and branch/department scope without modification.

## Files changed

- `apps/web/src/pages/DashboardShell.tsx`
- `apps/web/src/pages/DashboardShell.test.tsx`
- `apps/web/src/pages/DashboardRoleContent.test.tsx`
- `apps/web/src/pages/AppointmentDashboardPage.tsx`
- `apps/web/src/pages/DoctorDashboardPage.tsx`
- `apps/web/src/pages/OpdDashboardPage.tsx`
- `apps/web/src/pages/PrescriptionQueuePage.tsx`
- `apps/web/src/pages/BillingDashboardPage.tsx`
- `apps/web/src/components/diagnostics/DiagnosticQueue.tsx`
- Dashboard feature hooks for Appointments, Doctor, OPD, and Pharmacy dispensing
- Appointment and OPD dashboard-summary API types, routes, services, repositories, clients, and domain hooks
- Appointment and OPD dashboard-summary repository tests
- `HMS_DASHBOARD_FOCUSED_HARDENING_GAP_NOTE.md`
- `HMS_DASHBOARD_FOCUSED_HARDENING_VERIFICATION.md`
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md` (status tracker entry only)

No database model, mutation, transition map, permission seed, sidebar definition, or operational workflow changed. Backend additions are read-only dashboard aggregate endpoints protected by the existing View permissions.

## Authorization, scope, and error handling

- Billing dashboard selection now requires the existing Billing View permission in addition to the approved Billing User role.
- Super Administrator precedence prevents a combined Super Admin/Billing role assignment from exposing Billing in the Super Administrator dashboard set.
- Existing backend authorization remains authoritative.
- Existing branch, department, doctor, and user scoping remain unchanged.
- Invalid, stale, and hidden dashboard tab query values fall back to the first permitted meaningful dashboard without mounting hidden content.
- Users whose only accessible modules are Emergency, Admissions, or Surgery receive a non-navigating “No dashboard summary is available” state.

## UI patterns reused

- Existing HMS compact KPI cards, tab bar, operational states, branch selector, queue pages, and executive overview layout.
- The encounter chart was retained and relabeled after its financial series was removed.
- No new visual system or module UI was introduced.

## Automated verification

- Focused dashboard Vitest: passed, 5 files / 28 tests.
- Changed-file ESLint: passed.
- Web typecheck: passed.
- Web full lint: passed.
- Web production build: passed.
- API typecheck: passed.
- API full lint: passed.
- API production build: passed.
- `git diff --check`: passed.

Focused tests verify:

- Super Admin has no Billing tab or financial dashboard presentation.
- A stale Super Admin `?tab=billing` value cannot mount Billing.
- Doctor and other role-specific dashboard behavior remains intact.
- Billing requires both the Billing User role and Billing View permission.
- A custom role with Billing permission alone cannot mount the Billing dashboard.
- A Billing User without Billing View permission cannot mount the Billing dashboard.
- Emergency, Admissions, and Surgery permissions do not create dashboard tabs or dashboard navigation cards.
- Stale Emergency, Admissions, and Surgery tab values fall back without navigation.
- Authentication changes immediately rebuild the permitted dashboard set.
- View-only users do not receive create/edit appointment or OPD actions.
- Doctor dashboard does not expose placeholder metrics or the former incorrect status mutation.
- Failed Billing summaries are visibly unavailable rather than zero.

## Live browser verification

- Local API health returned HTTP 200.
- Super Admin login showed Overview, Doctors, Appointments, OPD, and Administration dashboard tabs.
- Super Admin showed no Billing tab, billed-revenue card, revenue trend, or financial-settlement panel.
- Billing User login opened the Billing dashboard and rendered the Billing summary and recent-invoice sections.
- Sidebar modules remained present according to their existing access rules.
- No operational mutation was performed during browser verification.

## Remaining dependency

- Emergency, Admissions, and Surgery remain intentionally absent from the dashboard until approved, meaningful, dashboard-specific summary contracts are available.
- The Phase 3 prompt DOCX, Release 2 FSD DOCX, and `scope/HMS Local` prototype directory were not present in this checkout. No missing business rule or visual contract was guessed.

The dashboard-focused hardening phase is complete; no non-dashboard phase has been started.
