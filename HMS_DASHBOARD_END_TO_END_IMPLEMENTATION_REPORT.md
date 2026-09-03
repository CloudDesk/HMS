# HMS Dashboard End-to-End Implementation Report

## Scope

This report covers the dashboard-only implementation based on `HMS_Dashboard_Gap_Analysis_and_Fix_Plan.md` and the owner-confirmed overrides.

The implementation does not redesign or reimplement operational HMS modules. Existing sidebar access, module routes, database models, mutations, lifecycle transitions, and business workflows remain in place.

## Confirmed overrides

- Billing dashboard content is not included in the Super Administrator dashboard.
- Billing dashboard content is included only for a user with the `BILLING_AUTHORIZED` role and the existing `Billing / Invoices / View` permission.
- Emergency, Admissions, and Surgery are not shown as dashboard tabs or dashboard shortcuts until approved meaningful summaries are required.
- Existing separately authorized sidebar and module access for Emergency, Admissions, and Surgery remains unchanged.

## Role implementation matrix

| Role | Implemented dashboard focus | Data source and scope |
|---|---|---|
| Super Administrator | Enterprise overview, patients, doctors, appointments, OPD, pharmacy dispensing/inventory, laboratory, imaging, administration, and reports. Billing is excluded. | Existing executive snapshot and live module summary APIs. Enterprise scope is available where backend authorization permits it. |
| Administrator | Users, roles, departments, services, branches, configuration, and audit activity. | Existing Administration dashboard snapshot and Administration APIs. |
| Doctor | Today's appointments, waiting patients, follow-ups, urgent cases, clinical queue, and pending clinical work. | New read-only Appointment and OPD dashboard summaries, restricted to the authenticated user's linked doctor record. |
| Nurse / Clinician | Patients awaiting nursing action, vitals/triage workload, patient preparation, and patients ready for a doctor. | Existing OPD workflow statuses, restricted to authorized branches and assigned departments. |
| Receptionist | Today's appointments, arrivals, waiting patients, walk-ins, queues, patient search, booking, and permitted check-in actions. | Appointment and OPD summaries plus existing workflow routes. Every action is checked independently. |
| Pharmacy User | Pending prescriptions, dispensing workload, priority prescriptions, low stock, out-of-stock, and expiry information. | Existing dispensing APIs and authoritative inventory summary API. |
| Laboratory User | New orders, sample collection, work in progress, result entry, verification, urgent work, and overdue work. | Existing Laboratory summary and queue APIs. |
| Imaging User | New requests, urgent scans, work in progress, report entry, verification, and overdue work. | Existing Imaging summary and queue APIs. |
| Billing User | Invoices, billed amount, collected amount, outstanding amount, pending statuses, and recent invoices. | Existing Billing summary and invoice APIs, gated in the dashboard by role and permission. |

## Existing-state interpretations

No new clinical lifecycle values were introduced. Dashboard workload is derived from existing persisted states:

- Doctor waiting patients: `READY_FOR_CONSULTATION`.
- Doctor pending clinical work: `READY_FOR_CONSULTATION` plus `IN_CONSULTATION`.
- Nurse awaiting action: `CHECKED_IN` plus `WAITING_FOR_VITALS`.
- Patient prepared/ready for doctor: `READY_FOR_CONSULTATION`.
- Reception arrivals: OPD visits checked in for the selected date.
- Walk-ins: existing OPD visit type `WALK_IN`.
- Follow-ups: existing Appointment `FOLLOW_UP` type and OPD `FOLLOW_UP`/`REVIEW` types.
- Urgent cases: existing `URGENT` or `EMERGENCY` priority records that are not in a terminal state.

These mappings are read-only dashboard interpretations. They do not modify operational state transitions.

## Access and visibility

- Dashboard areas are selected from authenticated roles and expanded permissions.
- Actions are evaluated independently for View, Create, and Edit access.
- A View permission does not automatically expose create, check-in, cancel, or edit controls.
- Doctor-specific `My Clinical Day` behavior remains role-specific.
- Other dashboard visibility remains permission-driven to support custom and multiple roles.
- Invalid, stale, or unauthorized dashboard tab query parameters fall back to the first permitted dashboard.
- A user whose only modules are Emergency, Admissions, or Surgery receives a non-navigating empty dashboard state.

## Branch, department, and doctor scope

- Appointment and OPD dashboard rows and summaries use the active authorized branch context.
- Users with assigned branches continue using the existing global branch selector.
- An empty branch value represents all authorized branches only where backend authorization permits that scope.
- The backend validates requested branch access before running Appointment or OPD aggregates.
- Doctor dashboard summaries are restricted to the authenticated user's linked Doctor record.
- Nurse/Clinician dashboard summaries are restricted to assigned departments.
- A requested Nurse department outside the assigned department set is rejected.
- Frontend branch, department, and doctor values are not treated as authoritative.

## KPI accuracy

- Added `GET /api/appointments/dashboard-summary`.
- Added `GET /api/opd/dashboard-summary`.
- Both endpoints are read-only and protected by the corresponding existing View permission.
- Both endpoints apply backend branch scope before aggregation.
- Appointment summaries return total, status totals, follow-ups, and urgent counts.
- OPD summaries return total, status totals, follow-ups, walk-ins, and urgent counts.
- Appointment KPI filters match the visible search, status, date, and branch scope.
- Pharmacy dispensing totals use status-filtered API totals rather than the current table page.
- Laboratory and Imaging continue using their existing operational summary endpoints.
- Doctor status visualization uses authoritative Appointment summary totals.
- A trend derived from loaded rows is shown only when the complete dataset is available.
- Failed or unavailable summaries render an unavailable state instead of a real-looking zero.

## Navigation and actions

- Dashboard tabs render dashboard content rather than immediately redirecting to a module.
- Emergency, Admissions, and Surgery shortcut-only tabs were removed.
- Doctor Patient Search opens the existing Patient Search workflow when authorized.
- Doctor clinical work opens the existing OPD queue instead of incorrectly changing an Appointment to checked-in.
- Appointment booking, walk-in, calendar, queue, patient search, confirm, check-in, and cancellation actions are independently permission-gated.
- OPD patient search, queue, and check-in actions are independently permission-gated.
- Pharmacy, Laboratory, Imaging, and Billing actions continue to use their existing record/workspace routes.
- No dashboard action introduces a new operational mutation.

## Loading, empty, and error behavior

- Dashboard queries retain existing TanStack Query loading and retry behavior.
- Errors are presented separately from valid zero totals.
- Billing and diagnostic failures no longer appear as successful zero summaries.
- Incomplete paginated data is not presented as a complete KPI or trend.
- Empty dashboard access produces a clear non-navigating state.

## Files and modules changed

### Dashboard composition and pages

- `apps/web/src/pages/DashboardShell.tsx`
- `apps/web/src/pages/DoctorDashboardPage.tsx`
- `apps/web/src/pages/AppointmentDashboardPage.tsx`
- `apps/web/src/pages/OpdDashboardPage.tsx`
- `apps/web/src/pages/PrescriptionQueuePage.tsx`
- `apps/web/src/pages/BillingDashboardPage.tsx`
- `apps/web/src/components/diagnostics/DiagnosticQueue.tsx`

### Frontend hooks and API contracts

- `apps/web/src/hooks/appointments/useAppointmentDashboardFeature.ts`
- `apps/web/src/hooks/appointments/useAppointments.ts`
- `apps/web/src/hooks/doctors/useDoctorDashboard.ts`
- `apps/web/src/hooks/opd/useOpdDashboard.ts`
- `apps/web/src/hooks/opd/useOpd.ts`
- `apps/web/src/hooks/pharmacy/usePharmacyDispensingFeature.ts`
- `apps/web/src/api/appointments.ts`
- `apps/web/src/api/opd.ts`

### Read-only backend summaries

- `apps/api/src/modules/appointments/appointment.types.ts`
- `apps/api/src/modules/appointments/appointment.routes.ts`
- `apps/api/src/modules/appointments/appointment.service.ts`
- `apps/api/src/modules/appointments/appointment.repository.ts`
- `apps/api/src/modules/opd/opd-visit.types.ts`
- `apps/api/src/modules/opd/opd-visit.routes.ts`
- `apps/api/src/modules/opd/opd-visit.service.ts`
- `apps/api/src/modules/opd/opd-visit.repository.ts`

### Tests and documentation

- `apps/web/src/pages/DashboardShell.test.tsx`
- `apps/web/src/pages/DashboardRoleContent.test.tsx`
- `apps/api/src/modules/appointments/appointment-dashboard-summary.test.ts`
- `apps/api/src/modules/opd/opd-dashboard-summary.test.ts`
- `HMS_DASHBOARD_FOCUSED_HARDENING_GAP_NOTE.md`
- `HMS_DASHBOARD_FOCUSED_HARDENING_VERIFICATION.md`
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md`

## Existing functionality preserved

- No Mongoose schema or database model was changed.
- No lifecycle enum was added or changed.
- No Appointment or OPD transition map was changed.
- No create, edit, cancel, check-in, consultation, dispensing, result, report, invoice, or payment mutation was changed.
- No permission seed or permission meaning was changed.
- No sidebar module definition was changed.
- No Emergency, Admissions, or Surgery workflow was changed.
- Existing backend authorization remains authoritative.

## Verification completed

- Focused dashboard and summary tests: 5 files, 28 tests passed.
- API TypeScript typecheck passed.
- API ESLint passed.
- API production build passed.
- Web TypeScript typecheck passed.
- Web ESLint passed.
- Web production build passed.
- Final Doctor dashboard regression test passed.
- `git diff --check` passed.

The focused tests cover Super Administrator, Administrator, Doctor, Nurse/Clinician, Receptionist, Pharmacy User, Laboratory User, Imaging User, Billing User, custom permission behavior, stale dashboard tabs, unauthorized actions, summary failures, and dashboard-only Emergency/Admissions/Surgery suppression.

## Final status

The owner-confirmed dashboard scope is implemented on branch `dashboard-fixes`.

Emergency, Admissions, and Surgery remain intentionally absent from the dashboard until a future approved requirement requests meaningful summary content. Their separately authorized operational access remains unchanged.
