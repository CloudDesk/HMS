# HMS Role-Based Dashboard and Navigation Verification

## Implemented functionality

- Replaced the hardcoded staff dashboard tabs with permission-derived operational tabs.
- Preserved the six-tab Super Admin executive dashboard.
- Made `DOCTOR` open the existing authenticated-doctor dashboard as `My Clinical Day`.
- Added permission-selected operational defaults for Administration, Reception, Nursing, Pharmacy, Laboratory, Imaging, Billing, OPD, Emergency, Admissions, Surgery, and Reports.
- Added a safe `My Access` fallback for custom roles that have permitted sidebar routes but no dedicated dashboard.
- Rejected unauthorized or stale dashboard `tab` query values without mounting their page or query hooks.
- Added horizontal overflow and tab semantics to the existing dashboard tab bar.
- Gated every executive overview query and manual refetch by its existing View permission.
- Added missing permission-controlled route aliases and made Bed Management require `Beds:View` at page level while retaining action-level mutation checks.

## Existing functionality reused

- Database-expanded auth roles, permissions, user ID, and branch assignments returned by login, refresh, and `/auth/me`.
- `hasPermission`, `canAccessRoute`, `getAccessibleSidebarModules`, `AppRouter`, and the existing access-denied UI.
- Existing Doctor, Appointment, OPD, Emergency, Admission, Surgery, Pharmacy, Laboratory, Imaging, Billing, Administration, and Reports pages and hooks.
- Existing Fastify `requirePermission` middleware and backend branch/department/user scoping.
- Existing HMS Local compact KPI, operational queue, tab, card, and module navigation patterns.

## Roles covered

- `SUPER_ADMIN`
- `ADMINISTRATOR`
- `RECEPTIONIST`
- `CLINICIAN_NURSE`
- `DOCTOR`
- `PHARMACY_USER`
- `LABORATORY_USER`
- `IMAGING_USER`
- `BILLING_AUTHORIZED`
- Custom staff roles through permission-derived fallback

`PATIENT` and `GUARDIAN` remain patient-portal roles and continue to be rejected by staff login.

## Files changed

- `apps/web/src/auth/access-control.ts`
- `apps/web/src/hooks/dashboard/useDashboardOverviewFeature.ts`
- `apps/web/src/pages/DashboardShell.tsx`
- `apps/web/src/auth/access-control.test.ts`
- `apps/web/src/pages/DashboardShell.test.tsx`
- `apps/web/src/routing/AppRouter.test.tsx`
- `HMS_ROLE_BASED_DASHBOARD_GAP_NOTE.md`
- `HMS_ROLE_BASED_DASHBOARD_VERIFICATION.md`
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md` (shared status tracker only)

No backend models, repositories, services, routes, permissions, seeds, API contracts, or database indexes changed.

## Automated verification

- Focused Vitest: passed, 3 files / 22 tests.
- Changed-file ESLint: passed.
- Web typecheck: passed.
- Web production build: passed.
- API typecheck: passed.
- API production build: passed.
- `git diff --check`: passed.

The focused tests verify:

- Super Admin retains Overview, Doctors, Appointments, OPD, Billing, and Administration.
- Doctor receives `My Clinical Day`, does not receive Billing or Administration without permission, and does not call the executive hook.
- A Doctor-supplied `?tab=billing` does not mount Billing.
- Direct Doctor access to `/billing`, `/administration`, and `/administration/users` renders Access Denied.
- Administrator, Receptionist, Nurse, Pharmacy, Laboratory, Imaging, and Billing roles select their permitted operational default.
- Custom roles receive a safe permission-derived fallback.
- Re-rendering with a different authenticated user immediately changes the dashboard.
- Read-only Admissions users can see Bed Management without receiving mutation permission.

## Live API verification

- Local web server returned HTTP 200.
- Local API health returned HTTP 200.
- Live login returned the expected database-expanded role/module access for Super Admin, Receptionist, Nurse, Pharmacy, Laboratory, Imaging, and Billing seed users.
- A live Nurse token received HTTP 403 from Billing Summary and Administration Dashboard APIs.

## Known baseline failures and manual limitation

- Full web lint remains blocked by 33 pre-existing errors in unrelated inpatient, appointment, OPD, patient-profile, and prescription-queue files. All phase-owned files are lint-clean.
- Full API lint remains blocked by 42 pre-existing errors in scratch/fix scripts and unrelated appointment, patient, pharmacy, surgery, utility, and test files. No API file changed in this work.
- The in-app/extension browser was unavailable, so interactive visual checks, browser refresh, and a live Doctor login could not be completed in this session. Refresh safety is covered structurally by the existing auth-loading gate and session restoration, plus automated dashboard user-switch tests; it is not reported as a manual browser pass.
- The Phase 3 prompt DOCX and Release 2 FSD DOCX referenced by repository instructions are absent from this checkout. This task did not require a new lifecycle, safety, payment, consent, or data contract.

No additional backend support is required for current roles. New custom roles automatically receive the dashboard modules granted by their existing permissions; a new dedicated metric dashboard would require an existing authorized API before it can replace the safe fallback.

The next phase has not started.
