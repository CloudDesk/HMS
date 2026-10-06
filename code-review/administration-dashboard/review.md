# Module Review: `administration-dashboard`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/administration-dashboard/*` (906 lines) — the admin KPI dashboard, executive overview, and "Phase 2" operational reports. Static code review.
**Live load testing: not executed** — low-concurrency, admin-only reporting module; see §7.

---

## 1. Executive summary

This module is the answer to a question raised repeatedly elsewhere in this review series: what does it look like when a module that needs periodically-refreshed aggregate data does it correctly? The main admin dashboard is a scheduled, timer-based snapshot refresh (every 5 minutes, in `server.ts`, fully decoupled from any user request) backing a cheap read — the exact architecture already recommended as the fix for the "reconciliation coupled to a request path" pattern found in `opd`, `appointments`/`patient-portal`, `admissions-configuration`, and (most severely) `notifications`. Financial data is correctly, server-side gated by an actual permission check rather than trusted from the client. No findings of real significance in this pass.

| Severity | Count | Theme |
|---|---|---|
| — | 0 | No findings above informational severity |

---

## 2. What's correct (keep doing this) — the reference pattern this whole series has been asking for

- **The main dashboard snapshot is refreshed on a schedule, not on the request path.** `server.ts:38-43` runs `services.administrationDashboard.refresh()` on a 5-minute `setInterval`, independent of any incoming request, with its own error handling (`.catch(...)` logging, not silently swallowed and not blocking server startup). `GET /api/administration/dashboard` then just reads the pre-computed snapshot (`getSnapshot()` — one simple `findOne`). **This is exactly the architecture already recommended, in this review series, as the fix for `opd`'s `reconcileStaleVisits`, `appointments`/`patient-portal`'s `reconcilePastAppointments`, `admissions-configuration`'s `expireHolds`, and especially `notifications`' severely expensive per-item sync loop.** Those modules' fixes should point here as the concrete, working example in the same codebase, not just a general recommendation.
- **Financial figures are correctly gated by a real, server-side permission check**: `administration-dashboard.routes.ts` computes `financialAccess` from `services.permissions.userHasPermission(request.user!.id, 'Billing', 'Invoices', 'View')` — never trusted from client input — and `getExecutiveOverview`/`getPhaseTwoReports` thread that boolean through to null out revenue/collection figures for users without billing visibility (`administration-dashboard.repository.ts:260-278`). This is the right way to build a dashboard that mixes general KPIs with financially-sensitive ones.
- **`refreshSnapshot()`'s multiple aggregate queries are correctly parallelized** via one `Promise.all` (`:311-...`), consistent with the pattern already praised throughout this series for independent read operations.
- **The refresh timer is correctly cleaned up on shutdown** (`server.ts:11-13`: `clearInterval` in the graceful-shutdown handler) and marked `.unref()` so it doesn't itself keep the process alive — small details that show real operational care.

---

## 3. Findings

No findings reach even Low severity in this pass. Two informational observations, neither requiring action:

- `getExecutiveOverview` computes its figures live on every call rather than caching, unlike the main dashboard snapshot. This is a reasonable design choice given it's parameterized by branch/date-range/financial-access (harder to cache meaningfully than the single global snapshot), and it's already correctly parallelized — flagged only as something to revisit if this endpoint's call volume or aggregate complexity grows materially.
- `phase-two-report.repository.ts` (320 lines, the largest file in this module) was not reviewed to the same depth as the core dashboard/overview logic in this pass, given time allocated to this closing batch of smaller modules — its `authorizeBranch` gate was confirmed called correctly from the service layer, but its individual report aggregations were not independently audited line-by-line.

---

## 4-9. (Minimal findings; sections abbreviated)

Validation, indexing, and round-trip analysis were reviewed as part of §2 and produced no gaps. Load testing was not executed given this is a low-concurrency, admin-only reporting surface — not a priority target relative to the patient-facing and clinical-workflow modules reviewed earlier in this series.

---

## 10. Verdict

**Production-ready, and the module other reviews in this series should point back to.** This closes the review series on a genuinely positive note: the exact architectural pattern needed to fix the most-repeated finding type in this whole series (reconciliation coupled to a request path) already exists, correctly built, elsewhere in this same codebase.
