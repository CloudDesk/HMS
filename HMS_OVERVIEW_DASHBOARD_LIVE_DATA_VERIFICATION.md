# Overview Dashboard Live Data Verification

## Implemented functionality

- Preserved the live MongoDB-backed KPI and trend aggregation for registered patients, active doctors, today's appointments, today's OPD visits, operational flow, recent visits, and authorized financial totals.
- Added an authoritative selected-day schedule to the Overview API.
- Combined branch-scoped appointments and OPD visits while suppressing an appointment after it has been converted into its linked visit.
- Made calendar day and week navigation refetch the selected date through TanStack Query instead of filtering the latest 20 visits in memory.
- Restricted waiting and in-consultation counters to today's OPD activity.
- Prevented API failures from appearing as real zero-value metrics; unavailable data now renders explicit unavailable states with retry guidance.
- Corrected Overview actions so the consultation-flow card opens OPD when financial data is not available, and the reports action falls back to OPD when Reports access is absent.
- Added keyboard activation to KPI cards and schedule entries.
- Corrected the Active Doctors note so it describes active doctor records rather than claiming on-duty availability.

## Existing functionality reused

- Existing Administration Dashboard permission and branch authorization.
- Existing Patient, Doctor, Appointment, OPD Visit, and Billing collections and indexes.
- Existing Overview feature hook, API client, dashboard tab navigation, branch selector, Refresh control, range selector, and HMS Local dashboard layout.

## Files changed

- `apps/api/src/modules/administration-dashboard/administration-dashboard.schemas.ts`
- `apps/api/src/modules/administration-dashboard/administration-dashboard.routes.ts`
- `apps/api/src/modules/administration-dashboard/administration-dashboard.service.ts`
- `apps/api/src/modules/administration-dashboard/administration-dashboard.repository.ts`
- `apps/api/src/modules/administration-dashboard/administration-dashboard.types.ts`
- `apps/api/test/executive-dashboard.test.ts`
- `apps/web/src/api/administration-dashboard.ts`
- `apps/web/src/hooks/dashboard/useDashboardOverviewFeature.ts`
- `apps/web/src/pages/DashboardShell.tsx`
- `apps/web/src/pages/DashboardShell.test.tsx`
- `HMS_OVERVIEW_DASHBOARD_LIVE_DATA_GAP_NOTE.md`
- `HMS_OVERVIEW_DASHBOARD_LIVE_DATA_VERIFICATION.md`

## Backend validation, permission, scope, and error handling

- The Overview query now validates `branch_id`, `range`, and ISO `schedule_date` with Zod.
- Existing Administration Dashboard View permission remains required.
- Existing branch authorization is applied to every KPI, trend, recent-visit, appointment, and visit schedule query.
- Schedule queries are bounded to 100 appointments and 100 visits for the selected day.
- No lifecycle transition, write operation, database model, or permission seed changed.

## Automated verification

- API executive dashboard tests: passed, 13/13.
- Web dashboard shell tests: passed, 21/21.
- API typecheck: passed.
- Web typecheck: passed.
- API production build: passed.
- Web production build: passed.
- Changed-file ESLint: passed.
- `git diff --check`: passed.

Full repository lint remains blocked by unrelated pre-existing errors outside the changed dashboard files: 19 API errors and 64 web errors. The focused dashboard-owned files are clean.

## Manual verification

- The local API was not already running, so authenticated live-browser acceptance was not performed in this session.
- Repository integration tests exercised real MongoDB models for aggregate counts, branch scope, selected-day schedule results, and appointment-to-visit deduplication.

## Remaining dependency

- No dashboard contract dependency remains for this correction.
- No next phase was started.
