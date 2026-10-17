# Ophthalmology frontend C1 verification

**Date:** 17 October 2026  
**Phase:** C1 - Dashboard integration  
**Status:** PARTIALLY COMPLETE - implementation and focused verification complete; repository-wide and live acceptance gates remain open

## Implemented functionality

- Added strict runtime schemas and typed clients for branch-scoped dashboard read and refresh.
- Added TanStack Query ownership with branch-aware keys, disabled-query gating and exact cache replacement after refresh.
- Added a feature hook with independent Ophthalmology Reports `View` and `Export` checks. Denied users cannot receive cached snapshot data or mutate URL state; View permits reading while Export alone does not.
- Added URL-backed branch selection using the active branch and existing authorized branch lookup. No automatic mount navigation or duplicate request was introduced.
- Added a dedicated `/opd/ophthalmology/dashboard` route, permission registry entry and OPD sidebar link.
- Added six exact server metrics: waiting, in progress, pending review, reviewed, repeat required and unable to perform. The UI does not invent trends, station splits, patient detail or cross-domain totals.
- Added explicit loading, invalid branch, missing/not-ready snapshot, retry, retained-data/stale warning, successful zero snapshot and permission-denied states.
- Added an Export-gated Generate/Refresh Snapshot action with top-right Sonner success/error feedback. It is explicitly not labelled as report export.
- Displayed the server generation timestamp and disclosed that the snapshot is branch-wide, all-time task state and not a live stream.

## Existing functionality reused

Reused the backend Phase 10 dashboard routes and branch enforcement, API client, Ophthalmology service, TanStack Query, auth permission helpers, active branch context, branch lookup, navigation, localization/timezone utility, Sonner and existing OPD `doc-*` KPI/card patterns. Shared HMS Local OPD and reports-dashboard patterns were inspected; no prototype was modified.

## Changed files and shared registries

New runtime files:

- `apps/web/src/api/ophthalmology-dashboard.ts`
- `apps/web/src/hooks/ophthalmology/useOphthalmologyDashboard.ts`
- `apps/web/src/hooks/ophthalmology/useOphthalmologyDashboardFeature.ts`
- `apps/web/src/pages/OphthalmologyDashboardPage.tsx`

New focused tests:

- `apps/web/src/api/ophthalmology-dashboard.test.ts`
- `apps/web/src/hooks/ophthalmology/useOphthalmologyDashboardFeature.test.tsx`
- `apps/web/src/pages/OphthalmologyDashboardPage.test.tsx`

Minimal shared changes:

- `apps/web/src/services/ophthalmology.service.ts`
- `apps/web/src/auth/access-control.ts` and its focused route/sidebar assertion
- `apps/web/src/data/ui-foundation.ts`
- `apps/web/src/routing/AppRouter.tsx`
- `apps/web/src/styles/ophthalmology.css`

Documentation: C1 gap note, this verification and the reconciliation/Developer B status records. No backend, patient portal, dependency manifest, lockfile, permission seed or prototype changed. Generated TypeScript build metadata was restored after checks.

## Permissions, scope, errors and safety

The backend remains authoritative for authenticated branch access and dashboard values. The route and query require Reports View. Snapshot generation requires Reports Export because that is the published backend permission, while the UI calls the operation refresh/generate. Invalid IDs are rejected before request. Response parsing rejects missing/negative/non-integer metrics. Query keys isolate branches; mutation success replaces only the returned branch snapshot. Missing server snapshot remains an error and is never converted to zero. A failed refetch may retain the last valid snapshot only with a visible stale warning.

No backend transaction, repository, audit, index or error behavior changed. Dashboard refresh is a snapshot write but the current backend implementation has no audit event; C1 does not claim otherwise.

## Automated verification

- Focused C1 API/feature/page tests: **3 files, 11 tests passed**.
- New access-control route/sidebar assertion: **1 passed, 10 skipped** when run by name.
- Owned C1/shared-file ESLint: **passed with zero errors**.
- API typecheck: **passed**.
- API build: **passed**.
- Frontend Vite production bundling without the repository TypeScript pre-step: **passed**, 839 modules transformed; the new dashboard lazy chunk was emitted.
- Full web regression: **79 files passed / 4 files failed; 386 tests passed / 5 failed of 391**. All C1 tests passed. The failures are outside C1: the existing Administration Medicine Master icon expectation, missing QueryClientProvider in auth refresh, two Surgery workspace tests missing AuthProvider, and the pre-existing B6 report-access test reading nonexistent `SidebarModule.children` rather than `links`.
- Global API lint: **50 existing errors** in insurance and patient modules; no C1/API files changed.
- Global web lint: **10 existing errors** in doctor, patient, appointment-calendar and user-management files. Owned lint is clean.
- `git diff --check`: **passed**.

Repository-wide web typecheck and the normal web build are blocked before bundling by two existing test-source errors:

1. `apps/web/src/api/ophthalmology-reports.test.ts:25` destructures a possibly undefined mock call.
2. `apps/web/src/auth/ophthalmology-reports-access.test.ts:6` reads `SidebarModule.children`, which is not a property of the current `SidebarModule` type.

Those B6 test files were not changed in C1. Because the mandated repository-wide typecheck/build are not green, C1 is not labelled fully complete despite clean focused verification and successful production bundling.

## Manual/browser acceptance

- The local staff frontend route returned HTTP 200.
- Browser navigation to `/opd/ophthalmology/dashboard` correctly redirected an unauthenticated session to `/login?redirect=%2Fopd%2Fophthalmology%2Fdashboard`; the secure login page rendered.
- The local API health endpoint was not running on the expected port, and no authenticated Reports View/Export fixture was available. Live dashboard read, generation, branch switching, responsive dashboard layout and persistence across logout/login are therefore not claimed.
- No login credentials, permissions, clinical records or server snapshots were created or changed during acceptance.

## Remaining dependency and next phase

C1 needs the unrelated web typecheck/build baseline corrected and authenticated live role/branch acceptance before release certification. The next planned item is **C2 - Queue review-submission contract (CR-08)**, owned first by Developer A because the backend has no transition route from `COMPLETED` to `SUBMITTED_FOR_REVIEW`.

**C2 has not started.**
