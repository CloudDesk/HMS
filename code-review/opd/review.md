# Module Review: `opd` (Outpatient Department)

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/opd/*` — the largest module in the backend (13,412 LOC across ~20 sub-features). This review covers the **core OPD visit lifecycle in full depth** (`opd-visit`, `opd-clinical-order`, and their interaction with `opd-consultation`/`opd-prescription`/`opd-follow-up`/`opd-referral`) — roughly 5,000 LOC, the path every single OPD patient goes through regardless of specialty. The **dental sub-domain** (`dental-episode`, `dental-stage`, `dental-quotation`, `dental-lab-order`, `dental-chairside-image`, `opd-dental-examination` — roughly 7,900 LOC, 59% of the module) was **sampled, not exhaustively reviewed**: models/indexes were checked across the board, and one service file was read in depth as a representative sample. A full dental-domain-specific review is a reasonable follow-up given its size, and is called out explicitly as a gap rather than silently skipped.
**Static code review.** Live load testing: not executed — see §7.

---

## 1. Executive summary

This is the best-architected clinical module reviewed so far in terms of state-machine design and optimistic-concurrency discipline — the OPD visit status machine, transactional multi-step writes, and version-conflict detection on clinical orders are all done deliberately and correctly. But this pass found one **critical, confirmed access-control bug**: a dental imaging authorization check silently discards a legitimate access-denial and falls through to a path with no user-scoping at all.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 1 | A caught exception (including a legitimate 403 access denial) in `authorizeDentalImagingReport` is silently swallowed and falls through to a check that has no relation to the current user's authorization at all |
| 🟠 High | 1 | No unique constraint backs the "one active OPD visit per patient" business rule — it's enforced only by a check-then-create race, unlike the appointment-duplicate check right next to it which *is* DB-enforced |
| 🟡 Medium | 2 | A side-effecting bulk write (`reconcileStaleVisits`) runs synchronously inside every OPD queue read, with errors silently swallowed; `opd_visits` has no index covering `deletedAt`, the filter on every read |
| 🟢 Low | 1 | Dental sub-domain not exhaustively reviewed this pass (scope disclosure, not a code finding) |

---

## 2. What's correct (keep doing this)

- **Explicit, exhaustive status-transition table.** `opd-visit.service.ts:19-28`'s `allowedVisitStatusTransitions` map is the clearest state-machine definition seen in this review series — every status's legal next-states are spelled out as data, not scattered through conditional logic, and `isStatusTransitionAllowed` is a one-line lookup against it. This is exactly how a clinical workflow state machine should be written.
- **Real optimistic concurrency control, correctly wired end to end.** `updateStatus` (service → repository) passes the caller's *expected current status* all the way into the `findOneAndUpdate` filter itself (`opd-visit.repository.ts:307`: `status: expectedStatus`), so a conflicting concurrent status change can't silently overwrite another — it correctly returns no document, which the service turns into `409 VISIT_STATUS_CONFLICT`. The same pattern (`expected_updated_at` / `assertVersion`) is used again in `opd-clinical-order.service.ts:181-184` for clinical order edits. This is correctly and consistently applied, not a one-off.
- **Multi-document writes that need atomicity actually use transactions.** `callNextPatient` (`opd-visit.service.ts:199-250`) and `createFromAppointment` (`:252-325`) both wrap their multi-step writes (visit creation/claim, appointment status sync, timeline events, notifications) in `executeTransaction`. This matters specifically for `callNextPatient`, where the whole point is preventing two staff members from claiming the same "next patient" simultaneously — and it's backed by an actual DB-level claim check (`claimNextPatientCall`, returning `409 NEXT_PATIENT_ALREADY_CALLED` on conflict) inside the transaction, not just application-level sequencing.
- **The appointment-duplicate check is defense-in-depth, not the only defense.** `createFromAppointment` checks `findByAppointmentId` for a friendly error message, but the real guarantee is the DB-level partial unique index `{ appointmentId: 1 }` (`opd-visit.model.ts:85-88`) — so even if two requests race past the friendly check, the database itself prevents two OPD visits for one appointment, and the resulting duplicate-key error is correctly mapped to `409 DUPLICATE_OPD_VISIT` by the shared error handler (confirmed in this series' earlier review of `utils/errors.ts`). This is the right way to build this kind of check — compare to §3.2, where the equivalent protection for walk-in visits is missing.
- **Clinical-order validation is genuinely thorough**: duplicate-service-in-one-order rejection, active/inactive service-catalog verification against the real services collection (not just trusting client-submitted names), FDI tooth-number format validation scoped specifically to dental+imaging combinations, and a real `sameClinicalOrder` idempotency check that lets a resubmission of an *identical* already-submitted order succeed quietly instead of erroring (`opd-clinical-order.service.ts:133-138`) — a thoughtful UX/correctness detail for handling client retries.
- **Dental model indexing is, for the most part, better than the equivalent core-entity indexes.** `dental_chairside_images` explicitly includes `deletedAt` in all three of its indexes (`dental-chairside-image.model.ts:74-76`) — getting right the exact pattern that `patients` and `opd_visits` (§3.4) get wrong.

---

## 3. Findings

### 3.1 🔴 CRITICAL — Dental imaging authorization silently falls through to an unscoped check on any error

**Update from the `laboratory`/`imaging` module review**: this method's actual callers have since been traced, and the reach is wider — and more precisely scoped — than this entry originally stated. It is the literal authorization gate for three real `imaging` endpoints (`GET .../report`, `POST .../attachments`, `GET .../attachments/.../download`), and because the seeded `DOCTOR` role has no standalone `Imaging/Orders/*` permission, **every doctor's every view of any imaging report routes through this exact vulnerable code path as a matter of normal, everyday operation** — not a rare edge case. The actual unauthorized-access *outcome*, however, is confirmed to only occur for dental-context orders specifically (non-dental orders correctly fall through to the final `404` instead of the unscoped fallback, since they have no `dental_context` to match). Both facts — high exposure frequency, narrower-than-"anything" exploitable outcome — now belong together when prioritizing this fix. Full detail in [`code-review/laboratory-imaging/review.md`](../laboratory-imaging/review.md) §3.1.

**Where:** `opd-clinical-order.service.ts:145-166` (`authorizeDentalImagingReport`)

```ts
async authorizeDentalImagingReport(orderId: string, userId: string) {
  const scope = await this.repository.resolveBranchScope(userId);
  const order = await this.repository.getOperationalById(orderId, 'IMAGING', scope);
  if (!order) throw new AppError('Dental imaging order not found', 404, 'IMAGING_ORDER_NOT_FOUND');
  if (order.visit_id) {
    try {
      const visit = await this.getVisit(order.visit_id, userId, 'IMAGING');
      if ((await this.isDental(visit)) && order.patient_id === visit.patient_id &&
          order.branch_id === visit.branch_id && order.doctor_id === visit.doctor_id) {
        return;
      }
    } catch {
      // Fall through to episode check
    }
  }
  if (order.dental_context?.treatment_episode_id) {
    return;                      // <-- authorized with NO check on the current user at all
  }
  throw new AppError('Dental imaging order not found', 404, 'IMAGING_ORDER_NOT_FOUND');
}
```

`this.getVisit(...)` (`:193-213`) is where the real authorization logic lives — it checks the caller's department/doctor scope and throws `403 DEPARTMENT_ACCESS_DENIED` or `403 DOCTOR_ACCESS_DENIED` if the caller isn't allowed to see this visit. The `try/catch` around it swallows **every** exception it can throw — including those two 403s — with a comment that only accounts for one specific reason to fall through (an order not linked to a visit at all), not for a legitimate denial on an order that *is* linked to a visit.

The fallback it falls through to — `order.dental_context?.treatment_episode_id` being truthy — checks a property of the **order's data**, not anything about the **current caller**. Since dental imaging orders are routinely linked to a treatment episode (that's the normal dental workflow, per `dental-episode`'s design), this fallback will very commonly be true.

**Concretely, what this means:** a staff user whose department/doctor scope legitimately excludes a given visit (say, a doctor in Department A trying to authorize a dental imaging report for a patient under Department B's care) gets correctly denied by `getVisit()` inside the `try` — and then, because that denial is a thrown error, silently bypassed by the `catch`, landing on the episode check and getting authorized anyway. **This is a cross-department patient-data access-control bypass**, not a hypothetical — it's the direct, traceable result of the control flow as written.

For comparison, `authorizeDentalLaboratoryResult` right below it (`:168-179`) does the equivalent check **correctly** — no try/catch, no fallback, straight scoped validation. The inconsistency between the two strongly suggests this was an accidental regression (likely: the `try/catch` was added later to handle imaging orders that aren't linked to a visit at all, and it accidentally also swallows the case where a visit *is* linked and the scope check correctly failed).

**Recommended fix:** only attempt the episode-fallback path when `order.visit_id` is absent in the first place. When a `visit_id` *is* present, the visit-scope check must be authoritative — a thrown 403/404 from it should propagate, not be discarded:

```ts
if (!order.visit_id) {
  if (order.dental_context?.treatment_episode_id) return; // orders not tied to any visit: episode check is the only option
  throw new AppError(...);
}
const visit = await this.getVisit(order.visit_id, userId, 'IMAGING'); // let this throw for real
if ((await this.isDental(visit)) && /* match checks */) return;
throw new AppError(...);
```

This should be treated as a security fix, prioritized ahead of every other finding in this review.

### 3.2 🟠 HIGH — "One active OPD visit per patient" has no database-level guarantee

**Where:** `opd-visit.service.ts:392-399` (`ensureNoActiveVisit`), called from both `createFromAppointment` (`:272`) and `createWalkInVisit` (`:341`)

```ts
private async ensureNoActiveVisit(patientId: string) {
  const activeVisit = await this.repository.findActiveByPatient(patientId);
  if (activeVisit) {
    throw new AppError('Patient already has an active OPD visit', 409, 'ACTIVE_OPD_VISIT_EXISTS', { visit_id: activeVisit.id });
  }
}
```

This is a plain check-then-create with no backing constraint. Compare to the appointment-duplicate check in the same file (§2's fourth bullet), which has exactly this same application-level shape **but is additionally backed by a real partial unique index** on `opdVisitSchema` — so a race there fails safely at the DB level. There is no equivalent index here (e.g., a partial unique index on `{ patientId: 1 }` filtered to non-terminal statuses) — so two concurrent requests to check in the same patient (a walk-in and a portal self-check-in arriving at nearly the same time, say) can both pass this check before either commits, and both succeed in creating an active OPD visit for the same patient simultaneously.

**Why it matters:** the business rule this is meant to enforce ("a patient can't be in two OPD queues at once") is exactly the kind of invariant most valuable to guarantee at the database level, not just at the application level, precisely because the failure mode (a brief race window under real concurrent front-desk + portal traffic) is realistic, not theoretical.

**Recommended fix:** add a partial unique index scoped to active (non-terminal) statuses, mirroring the pattern already used correctly for the appointment/admission uniqueness constraints on this exact model:

```ts
opdVisitSchema.index(
  { patientId: 1 },
  { unique: true, partialFilterExpression: { status: { $nin: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] } } },
);
```

### 3.3 🟡 MEDIUM — A side-effecting bulk write runs on every OPD queue read, with errors silently discarded

**Where:** `opd-visit.service.ts:77` and `:91` — `await this.repository.reconcileStaleVisits().catch(() => 0);`, called at the top of both `list()` and `dashboardSummary()`

`reconcileStaleVisits` (`opd-visit.repository.ts:116-140`) is a real `updateMany` write — it marks any visit still open from a prior day as `NO_SHOW`. Running it synchronously inside every single `GET` request to the OPD queue/dashboard means:

1. Every page load of the OPD queue pays the cost of a write query, not just a read — on what is very likely one of the most frequently polled screens in the entire application (front-desk and doctor dashboards typically auto-refresh).
2. `.catch(() => 0)` means any failure here — a validation error, a transient connection blip, anything — is completely invisible. No log line, no metric, nothing. If this silently stopped working, the only symptom would be stale visits slowly accumulating in the queue with no error anywhere pointing at the cause.

**Why it matters:** this conflates "read the current queue" with "perform end-of-day reconciliation," which are two different operational concerns with different natural cadences (the former: every request; the latter: once, around end-of-day). It also means the system's correctness for this specific rule (auto-marking stale visits as no-show) depends on *someone* happening to call `list()` or `dashboardSummary()` at some point after midnight — if a branch's queue is quiet overnight and no one loads the dashboard until mid-morning, stale visits sit un-reconciled until then, which may or may not matter depending on what else reads visit status in that window.

**Recommended fix:** move this to a proper scheduled job (daily, e.g. via whatever cron/worker mechanism the deployment uses) rather than inline on every read; if an inline fallback is still wanted for safety, at minimum log the error instead of silently discarding it.

### 3.4 🟡 MEDIUM — `opd_visits` has no index covering `deletedAt`

**Where:** `opd-visit.model.ts:85-102`

Every read (`list`, `dashboardSummary`, `getById`, `findActiveByPatient`, etc.) filters on `{ deletedAt: null, ... }`. None of the eight indexes on this collection include `deletedAt` as a key. This is the same class of finding as the `patients` collection in the previous review, though meaningfully less severe here, because most real queries also filter on `branchId`, `doctorId`, or `patientId` — each of which *does* have a leading compound index (`{branchId,visitDate,queueTokenNumber}`, `{doctorId,visitDate,status}`, `{patientId,visitDate}`) — so MongoDB can narrow to a reasonably small candidate set via those before applying the `deletedAt` filter as a residual scan. It's a real gap, just a lower-urgency one than the equivalent finding on `patients`, where no compound index existed at all.

**Recommended fix:** fold `deletedAt` into the existing branch/doctor/patient compound indexes as a leading or secondary key (e.g. `{ deletedAt: 1, branchId: 1, visitDate: 1, queueTokenNumber: 1 }`) rather than adding it as yet another separate index.

---

## 4. Validation & edge-case audit (core visit lifecycle)

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Status transition legality | ✅ | Explicit transition table | None — the one deliberate exception (direct dental consultation skipping vitals) is itself gated by `areVitalsOptional`, a named policy function, not an ad hoc bypass |
| Required reason for terminal statuses | ✅ | `updateStatus` | None |
| Consultation completed before visit closes | ✅ | `updateStatus` | None |
| Duplicate OPD visit per appointment | ✅ DB-enforced | Partial unique index | None |
| Duplicate active OPD visit per patient | ⚠️ app-level only | `ensureNoActiveVisit` | §3.2 |
| ObjectId shape on list-query filters | ✅ | `validateListQuery` checks before hitting the DB | None — correctly avoids the wasted-round-trip pattern flagged elsewhere in this series |
| Date-range sanity (`date_from <= date_to`) | ✅ | `validateListQuery` | None |
| Clinical order version conflict | ✅ | `assertVersion` | None |
| Duplicate service within one clinical order | ✅ | `normalizeServices` | None |
| Referenced lab/imaging service is real and active | ✅ | `normalizeServices` cross-checks `ServiceRepository` | None |
| Dental-only fields (tooth number) gated to dental visits | ✅ | `validateToothAssociation` | None |
| Caller's department/doctor scope on dental imaging orders | ⚠️ broken on one path | `authorizeDentalImagingReport` | §3.1 |

---

## 5. MongoDB index audit

**`opd_visits`** — 8 indexes, well-shaped for the real query patterns (branch+date+queue-position for the live queue view, doctor+date+status for per-doctor schedules, patient+date for history lookups), two correctly-designed partial unique indexes for the appointment/admission 1:1 relationships. Gap: no `deletedAt` coverage (§3.4); no uniqueness backing for "one active visit per patient" (§3.2).

**`opd_clinical_orders`** — `{branchId,orderType,status,submittedAt}` (confirmed in an earlier pass of this review series) — reasonable for the department queue view; not independently re-verified against every query shape in this pass given time spent on the authorization finding instead.

**Dental collections (sampled)** — generally good: `dental_chairside_images` includes `deletedAt` in every index; `dental_episodes`, `dental_treatment_stages`, `dental_treatment_quotations`, `dental_prosthetic_lab_orders` all have patient-scoped and branch+department-scoped compound indexes. None of these four were confirmed to include `deletedAt` specifically — flagged as a lower-confidence observation (not verified against their actual query code, unlike the core-visit collection) worth a follow-up check in a dedicated dental-domain pass.

---

## 6. API performance & round-trip analysis

| Operation | Sequential round trips (handler-level, excluding the shared 4-RT auth chain) | Notes |
|---|---|---|
| `GET /api/opd/visits` (queue list) | 4 (`reconcileStaleVisits` write + `resolveBranchScope` + `list`/`count` parallel + doctor-scope lookup) | §3.3 — one of these four is a write that shouldn't be here at all |
| `POST /api/opd/visits` (check-in from appointment) | ~8 inside one transaction (appointment fetch, duplicate check, active-visit check, sequence allocation, visit create, appointment status update, optional consultation draft, timeline+audit) | Appropriately transactional given the invariants involved; the round-trip count is a consequence of genuine multi-document consistency needs, not sloppiness |
| `PATCH /api/opd/visits/:id/status` | ~5 (`getById`, `resolveBranchScope`, consultation-completion check when relevant, `updateStatus`, timeline event, conditional appointment sync) | |
| `POST /api/opd/visits/:id/call-next` | ~8, inside one transaction (start next visit, claim, audit, timeline, **two** notification writes) | The two notification writes (receptionist + nurse) are sequential inside the transaction; could be parallelized with `Promise.all` without weakening the atomicity guarantee, since neither depends on the other's result |

Given the real ~25-30ms per-round-trip measurement against the live Mumbai Mongo cluster (this series' infrastructure finding), the check-in and call-next flows' ~8 round trips each land in the ~200-250ms range from round trips alone under that measurement — worth keeping in mind for real load testing once set up (§7), especially since `callNextPatient` is a time-pressured, repeatedly-invoked action during a live clinic session.

---

## 7. Load testing (p65/p90) — status

**Not executed this pass**, consistent with the pattern established earlier in this series. `opd_visits` and its related collections hold real clinical encounter data, so the same reasoning applied to `patients` applies here: I did not run exploratory or load-generating queries against the real SIT database without confirming that's acceptable for clinical data specifically (distinct from the reference-table modules where this was already fine). The local ephemeral-MongoDB harness built for the `auth-rbac` review remains the right tool for actually exercising this module's write paths (visit creation, status transitions, the `callNextPatient` transaction) functionally without touching real data — that would be the natural next step if you want this module's business logic live-verified the way `auth-rbac` was.

---

## 8. Scalability & dynamic-approach recommendations

- **Fix the access-control bypass (§3.1) first, as a correctness/security matter — but note it also has a scalability-adjacent lesson**: the `try/catch`-swallows-everything pattern that caused it is exactly the kind of shortcut that becomes more dangerous as more fallback paths get added to a growing codebase. Any future "fall through to a looser check" pattern should scope its catch to the specific condition it's meant to handle, not blanket-swallow.
- **Move `reconcileStaleVisits` (§3.3) to a scheduled job** — this is the clearest pure-scalability fix in this module: a write cost currently paid on every single queue/dashboard read should instead be paid once, on a fixed schedule, regardless of how many times staff refresh their screens that day. The same recommendation applies to `appointments`' `reconcilePastAppointments` (see that review) — both should be fixed as one piece of shared work, not two module-level patches.
- **Add the partial unique index for "one active visit per patient" (§3.2) now, while volumes are manageable** — this kind of invariant gets harder to retrofit once real data might already violate it; enforcing it at the database level early avoids a painful cleanup-then-migrate exercise later.
- **The dental sub-domain (59% of this module, sampled not exhaustively reviewed) deserves a dedicated pass that applies the same scalability lens** — in particular, confirming whether `dental_episodes`/`dental_treatment_stages`/`dental_treatment_quotations`/`dental_prosthetic_lab_orders` have the `deletedAt`-index coverage gap already found in several core collections, since this sub-domain wasn't verified against its actual query code the way the core visit lifecycle was.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] **Fix the authorization bypass in `authorizeDentalImagingReport`** (§3.1) — security fix, should be prioritized ahead of everything else in this review.
- [ ] Add a partial unique index enforcing "one active OPD visit per patient" at the database level (§3.2).
- [ ] Move `reconcileStaleVisits` out of the request path into a scheduled job, or at minimum log its failures instead of silently discarding them (§3.3).
- [ ] Fold `deletedAt` into `opd_visits`' existing compound indexes (§3.4).
- [ ] Parallelize the two sequential notification writes inside `callNextPatient`'s transaction (§6) — low-risk, since neither notification depends on the other.
- [ ] Follow-up: a dedicated review pass specifically for the dental sub-domain (`dental-episode`, `dental-stage`, `dental-quotation`, `dental-lab-order`, `opd-dental-examination`, `dental-chairside-image`) — this pass sampled it but didn't cover it with the same depth as the core visit lifecycle, given its size (59% of the module).
- [ ] Decide on an approach for load/functional-testing this module without touching real clinical data, mirroring the decision already pending for `patients` (§7).

---

## 10. Verdict

**Not production-ready**, and for the first time in this review series, the headline reason is a confirmed security/access-control bug rather than a performance or data-integrity one. The quality of the surrounding engineering (the status-transition table, the optimistic-concurrency patterns, the transaction usage) makes §3.1 more notable, not less — this is clearly a team that knows how to build this correctly, and the bug reads like a genuine regression (an edge-case fix that over-reached) rather than a sign of broader carelessness. It should still be fixed before this module is considered safe for real patient data.
