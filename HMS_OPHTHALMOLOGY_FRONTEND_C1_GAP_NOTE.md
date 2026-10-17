# Ophthalmology frontend C1 gap note

**Date:** 17 October 2026  
**Phase:** C1 - Dashboard integration  
**Entry status:** APPROVED TO START

## Reuse

- Backend `GET /api/ophthalmology/dashboard` and `POST /api/ophthalmology/dashboard/refresh` with branch scope and existing Reports permissions.
- Existing API client, service registry, TanStack Query, auth permission helpers, active-branch context, branch lookup, URL navigation, Sonner and OPD KPI/card patterns.
- Shared HMS Local reports-dashboard and OPD dashboard interaction patterns. No prototype file will be changed.

## Contract findings

- The snapshot response is the current backend Mongo projection: `branchId`, `generatedAt` and six non-negative task metrics (`waiting`, `in_progress`, `pending_review`, `reviewed`, `repeat_required`, `unable`). It is branch-wide and not date-filtered.
- A missing snapshot returns `DASHBOARD_NOT_READY`; the frontend must not replace it with zero metrics.
- Dashboard read requires Ophthalmology Reports `View`. Snapshot refresh currently requires Ophthalmology Reports `Export`; refresh is not an export and will not be labelled as one.
- No expiry/staleness threshold is published. The UI will show the server generation time and use “possibly stale” only when refreshing/refetching an already displayed snapshot fails.
- The snapshot contains no trend, station split, patient detail, surgery, follow-up, revenue, publication or export data. None will be inferred.

## Intended files

- New dashboard API schema/client, domain hook, feature hook, page and focused tests under `apps/web/src`.
- Minimal registration changes in the Ophthalmology service, route permission registry, router and OPD sidebar.
- Minimal specialty CSS only where existing KPI/card patterns are insufficient.

## Verification plan

- Validate exact response metrics, route/method/query and malformed responses.
- Test View/Export independence, branch and URL validation, denied cached-data protection, not-ready/error/retry, zero-valued successful snapshots, refresh success/failure and late-state safety supplied by scoped query keys.
- Run focused tests, owned lint, API/web typecheck and build, and report unrelated repository failures separately.

## Stop boundary

C1 does not implement report export, publication, cross-domain reporting, queue review submission, final consultation completion, amendment/reapproval, or blocked clinical fields. Stop after C1 verification.
