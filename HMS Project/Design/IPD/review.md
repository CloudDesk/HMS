# Module Review: `inpatient-admissions` & `admissions-configuration`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/inpatient-admissions/*` (1,439 lines) and `apps/api/src/modules/admissions-configuration/*` (932 lines, including a dedicated 336-line `bed-concurrency.test.ts`). Reviewed together — `inpatient-admissions` calls directly into `admissions-configuration`'s service for every bed-related operation, and together they implement one real workflow: request → validate → confirm (consent + deposit + bed allotment) → care → discharge (clinical + financial clearance → bed release).
**Live load testing: not executed** — real admission/bed data; see §7.

---

## 1. Executive summary

**This is the best-engineered module pair in the entire review series.** Every single state-changing operation on a bed, hold, or admission is a `findOneAndUpdate` with the complete set of preconditions folded directly into the filter — status, current owner (hold/admission), expiry, branch — with `$inc: { version: 1 }` on top as a second, independent concurrency signal. The team clearly treated bed-allocation races as a first-class risk (there's a dedicated 336-line concurrency test file) and the result shows: idempotent request confirmation, idempotent discharge, a request-hash-verified idempotency key for bed holds (catching a key reused with *different* parameters, not just catching retries), and DB-level uniqueness backing every invariant that matters ("one active hold per bed," "one ADMITTED admission per bed," "one ADMITTED admission per patient," "one pending transfer per destination bed"). The one new finding is the second confirmed instance of the cross-cutting Kenya-currency bug.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 0 | — |
| 🟠 High | 0 | — |
| 🟡 Medium | 1 (confirmed, tracked cross-cuttingly) | A second hardcoded `KES` currency label, in the discharge financial-clearance error |
| 🟢 Low | 1 | `expireHolds` runs synchronously before every bed-hold creation — the third occurrence in this series of "reconciliation logic coupled to a request path," though the mildest version of it found so far |

---

## 2. What's correct (keep doing this)

- **Every bed/hold state transition is a single atomic `findOneAndUpdate` with the full precondition set in the filter**, not a check-then-write. A representative example, bed allotment from an active hold (`admissions-configuration.repository.ts:142-146`):
  ```ts
  const hold = await BedHoldModel.findOneAndUpdate(
    { _id: holdId, branchId, bedId, patientId, status: 'ACTIVE', expiresAt: { $gt: new Date() } },
    { $set: { status: 'CONSUMED', admissionId, consumedBy, consumedAt }, $inc: { version: 1 } },
    ...
  ).lean();
  if (!hold) return null;
  return BedModel.findOneAndUpdate(
    { _id: bedId, branchId, status: 'RESERVED', currentHoldId: hold._id, currentAdmissionId: null },
    { $set: { status: 'OCCUPIED', currentHoldId: null, currentAdmissionId: admission._id }, $inc: { version: 1 } },
    ...
  ).lean();
  ```
  Every other bed operation (`reserveBedForHold`, `closeHold`, `releaseAdmissionBed`) follows this identical shape. This is the single cleanest, most consistently-applied concurrency pattern in this entire review series — cleaner even than `pharmacy-dispensing`'s (already praised as the prior best example), because here *every* mutation follows the pattern with no exceptions, across two collections that have to stay mutually consistent (a bed's `currentHoldId`/`currentAdmissionId` vs. the hold/admission's own status).
- **DB-level uniqueness backs every invariant that matters, not just the obvious ones**: one active hold per bed (`bedHoldSchema`'s `{bedId,status}` partial unique), one `ADMITTED` admission per bed *and* per patient (`InpatientAdmissionModel`'s two separate partial unique indexes), one pending transfer per destination bed (`bedTransferSchema`'s `{destinationBedId,status}` partial unique), one admission per source admission-request (`{requestId}` partial unique) and per source encounter/visit (`{sourceType,sourceId}` partial unique). This directly closes the exact category of gap flagged as unresolved in both the `appointments` review (no DB backing for the overlap-conflict case) and the `opd` review (no DB backing for "one active visit per patient") — this module pair shows what the fully-solved version of that problem looks like.
- **Bed-hold idempotency is more sophisticated than the pattern already praised in `pharmacy-dispensing`**: `createHold` (`admissions-configuration.service.ts:91-109`) doesn't just deduplicate by key — it hashes the request parameters (`requestHash`) and compares them on replay, distinguishing a genuine retry (same key, same parameters → return the existing hold) from a key reused for a *different* request (same key, different parameters → `409 IDEMPOTENCY_CONFLICT`). This catches a client bug (key collision) that a simple idempotency-key check alone would silently mishandle.
- **Both `confirmRequest` and `finalizeDischarge` are explicitly idempotent on retry**, with the intent documented in-line: `finalizeDischarge` (`inpatient-admission.service.ts:147-151`) checks `if (admissionRecord.status === 'DISCHARGED') return existing!` with the comment *"Idempotency: If already DISCHARGED, return existing state safely without duplicate bed release or audit"*; `confirmRequest` does the equivalent for an already-confirmed request. This is exactly the right behavior for operations a client might reasonably retry after a timeout.
- **The DB-level safety net is correctly wired into clean error handling, not left as a raw 500**: `rethrowDuplicate` (`inpatient-admission.service.ts:16-19`) catches the Mongo duplicate-key error (`code: 11000`) that would fire if an app-level race slipped past every earlier check, and turns it into a friendly `409 ACTIVE_ADMISSION_CONFLICT`. This confirms the defense-in-depth is real end-to-end: app-level checks for the common case, DB-level uniqueness as the actual guarantee, and a clean error path if the DB-level guarantee is what actually catches a race.
- **`confirmRequest` builds a full prerequisite snapshot at confirmation time** (`inpatient-admission.service.ts:271`: `consent_required`/`consent_satisfied`/`deposit_required`/`deposit_satisfied`/amounts/invoice and payment IDs) and persists it on the admission request — a genuinely good compliance/audit practice, recording not just *that* an admission was confirmed but *exactly what policy requirements were checked and how they were satisfied* at that specific moment, independent of whatever the policy configuration might later become.
- **Source-conversion is itself idempotency-guarded**: converting an OPD visit or emergency encounter into an admission (`inpatient-admission.service.ts:263-270`) checks the source hasn't already been converted (`visit.inpatientAdmissionId`/encounter equivalent) both at request-creation time and again at confirmation time, and the conversion call itself returns `false` on a concurrent double-conversion attempt rather than silently succeeding twice — consistent with the same "re-check at every step, let the DB be the final word" discipline applied everywhere else in this module pair.

---

## 3. Findings

### 3.1 🟡 MEDIUM (confirmed; tracked cross-cuttingly) — A second hardcoded `KES` currency label

**Where:** `inpatient-admission.service.ts:172`

```ts
throw new AppError(`Financial clearance failed. Patient has an outstanding balance of KES ${totalOutstanding.toLocaleString()} that must be settled before discharge.`, 409, 'FINANCIAL_CLEARANCE_REQUIRED');
```

This is the identical bug already confirmed in the `billing` module review (`billing.service.ts:468`) — a literal `'KES'` in a live, user-facing financial error message, independent of the hospital's actually configured currency. A repo-wide grep for this exact `` `KES ${...}` `` interpolation shape across the whole backend turns up exactly these two occurrences, now both tracked in [`code-review/_infrastructure/market-localization-mismatch.md`](../_infrastructure/market-localization-mismatch.md), which has been updated with this second confirmation.

**Why flagged here specifically:** this is the discharge-blocking error a nurse or ward clerk would see every time a patient can't be discharged because of an unpaid balance — a genuinely common, real operational moment, not an edge case. Same fix as the `billing` instance: read `currencySymbol` from settings instead of the literal string.

### 3.2 🟢 LOW — Bed-hold expiry reconciliation runs synchronously before every hold creation

**Where:** `admissions-configuration.service.ts:91-92`

```ts
async createHold(bedId: string, data: CreateBedHoldDTO, actor: string, metadata: StatusActionMetadata) {
  await this.authorize(actor, data.branch_id);
  await this.expireHolds(data.branch_id, actor, metadata);   // <- runs on every hold creation, no error isolation
  ...
```

This is the third occurrence in this review series of the same architectural shape — a reconciliation sweep (`opd`'s `reconcileStaleVisits`, `appointments`'/`patient-portal`'s `reconcilePastAppointments`) coupled directly into a request path rather than run as a scheduled job. It's the mildest version found so far: unlike `opd`'s version (runs on every *read*, silently swallows errors) or `appointments`' version (runs on every patient-portal read, no error isolation, could break an unrelated read), this one runs on a *write* path (creating a new hold), is scoped to one branch at a time, and is sensibly batched (`MAX_BATCHES = 10`, 100 holds per batch, per `expireHolds`'s implementation) — so the blast radius of a failure here is "this specific hold-creation request fails," not "an unrelated read silently breaks" or "stale data silently accumulates forever."

**Why still worth flagging:** if `expireHolds` throws (a transient DB issue, say), `createHold` fails entirely for a reason that has nothing to do with the hold the caller is actually trying to create. Low severity given the batching and scoping already in place, but worth tracking alongside the other two instances as one shared architectural decision (move all three to scheduled jobs) rather than three independent module-level judgment calls about acceptable risk.

**Recommended fix:** same as the other two instances — move to a scheduled job, or at minimum isolate it so a reconciliation failure doesn't block the specific hold-creation request that triggered it.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| One active hold per bed | ✅ DB-enforced | Partial unique index + atomic transition | None |
| One `ADMITTED` admission per bed | ✅ DB-enforced | Partial unique index | None |
| One `ADMITTED` admission per patient | ✅ DB-enforced, checked at 3 separate lifecycle points | `hasActiveAdmission` in `createRequest`/`validateRequest`/`confirmRequest`, backed by the DB index as the final guarantee | None |
| One pending transfer per destination bed | ✅ DB-enforced | Partial unique index | None |
| Bed-hold idempotency key reused with different parameters | ✅ | `requestHash` comparison | None |
| Admission request source (OPD visit/referral/emergency) matches request context | ✅ | `createRequest`'s explicit field-by-field match checks | None |
| Source already converted to another admission | ✅ checked twice | `createRequest` and `confirmRequest` | None |
| Consent required before confirmation | ✅ policy-gated | `verifyContextConsent` | None |
| Deposit required before confirmation | ✅ policy-gated | `verifyAdmissionDeposit` | None |
| Discharge clinical checklist complete | ✅ | `finalizeDischarge`'s four-field checklist check | None |
| Discharge financial clearance | ✅ (message wording wrong) | `finalizeDischarge` | §3.1 |
| Retry of an already-confirmed/already-discharged request | ✅ idempotent | Explicit early-return checks | None |
| Ward deactivation with occupied/reserved beds | ✅ blocked | `updateWardStatus`'s `countProtectedBedsInWard` check | None |
| Manual bed status change to OCCUPIED/RESERVED | ✅ blocked | `updateBedStatus`'s explicit rejection — these states are "managed only by allotment and hold workflows" | None |

---

## 5. MongoDB index audit

**`hms_wards`** — unique `{branchId,name}`, `{branchId,status,floor}`. Correct.

**`hms_beds`** — unique `{branchId,wardId,bedNumber}`, `{branchId,status,wardId}`, `{branchId,bedCategory,roomNumber}`, and two correctly-designed partial unique indexes on `currentHoldId`/`currentAdmissionId`. No gaps.

**`admission_policies`** — unique partial `{branchId,status:'ACTIVE'}`, correctly modeling "at most one active policy per branch" while still allowing historical inactive policy records to exist.

**`bed_holds`** — unique `holdNumber`, unique `idempotencyKey`, unique partial `{bedId,status:'ACTIVE'}`, `{status,expiresAt,branchId}` (supports `expireHolds`' query well), `{patientId,status,createdAt}`. No gaps.

**`bed_assignment_histories`** — `{admissionId,occurredAt}`, `{bedId,occurredAt}`. Reasonable for an append-only audit trail.

**`bed_transfers`** — `{admissionId,status,requestedAt}`, unique partial `{destinationBedId,status:'PENDING'}`. No gaps.

**`inpatient_admissions`** — `{branchId,status,admissionDate}`, `{patientId,status,admissionDate}`, and the three partial unique indexes already praised in §2. No gaps.

**`admission_requests`** — `{branchId,status,createdAt}`, `{patientId,status,createdAt}`, unique partial `{activeSourceKey}` (the same well-designed "derived key + partial unique index" pattern already seen correctly applied in `appointments`' `activeSlotKey`). No gaps.

This is the only module pair in the entire review series with a completely clean index audit — every collection's indexes were verified against real query/mutation code and no gaps were found anywhere.

---

## 6. API performance & round-trip analysis

| Operation | Sequential round trips (excluding shared auth chain) | Notes |
|---|---|---|
| `POST /admissions-configuration/beds/:id/holds` | ~6-8 (expiry sweep, idempotency-key check, policy/patient/bed/ward lookups, atomic reserve, create, audit) | |
| `POST /inpatient-admissions/requests/:id/confirm` | **~20+ sequential steps inside one transaction** (request fetch, re-validation, active-admission re-check, optional emergency-source re-validation, policy fetch, consent verification, deposit verification, admission creation, admission re-fetch, bed allotment [itself 2 atomic updates], optional source-conversion [visit or encounter], 2-3 audit/timeline writes, final confirm) | This is almost certainly the single most expensive operation, in round-trip terms, of any endpoint reviewed in this entire series. It's justified — every step represents a genuine cross-module consistency requirement (billing, consent, bed allocation, source tracking) — but it's worth knowing this number explicitly before assuming any endpoint's latency "should" look like a simpler CRUD operation. If this ever needs to be faster, the right lever is the same one flagged throughout this series (reducing the *shared* auth/permission round-trip overhead that's paid once per request, not trying to trim this operation's genuinely-necessary step count). |
| `POST /inpatient-admissions/:id/discharge` | ~8-10 (record fetch, checklist validation, billing-invoice lookup, policy fetch, atomic discharge, atomic bed release, timeline, audit) | |

---

## 7. Load testing (p65/p90) — status

**Not executed.** Admission and bed-allocation data is real clinical/operational data, same reasoning as every other clinically-sensitive module in this series. **This module pair is the single best candidate in the entire codebase for a synthetic concurrent-load test**, precisely because it already has a dedicated `bed-concurrency.test.ts` demonstrating the team's own prior investment in proving this out — extending that existing test (or running it against the local ephemeral-MongoDB harness under real concurrent `app.inject()` load rather than just unit-level assertions) would be very low-risk, high-confirmation-value work, and there's already a starting point to build from rather than starting from nothing.

---

## 8. Scalability & dynamic-approach recommendations

- **This module pair's atomic-transition pattern is the reference implementation this whole review series has been building toward** — every unresolved concurrency finding still open elsewhere (`appointments`' overlap-conflict race, `opd`'s unenforced active-visit invariant) has its fully-solved counterpart sitting right here. Concretely: whoever picks up those two findings should read `admissions-configuration.repository.ts`'s `reserveBedForHold`/`allotBed`/`closeHold` methods first, not design from scratch.
- **The request-hash-verified idempotency key pattern (§2) is worth promoting above even `pharmacy-dispensing`'s idempotency-key pattern as the house standard** — it closes a gap (key-reused-with-different-parameters) that a bare idempotency key doesn't. Any future endpoint accepting a client-supplied idempotency key should hash and compare the request body the way `createHold` does.
- **The confirmation flow's ~20-step round-trip count (§6) is a case study in why the shared auth/permission caching fix (flagged repeatedly throughout this series, starting with the `branches` review) matters most for exactly this kind of operation** — a complex, already-necessarily-expensive transaction is where a fixed per-request overhead (currently paid once up front for auth/permission resolution) compounds most visibly. Fixing that shared cost once benefits this module's most expensive operation more than it benefits any single simple CRUD endpoint.
- **Move all three "reconciliation coupled to a request path" instances (this module's `expireHolds`, `opd`'s `reconcileStaleVisits`, `appointments`'/`patient-portal`'s `reconcilePastAppointments`) to scheduled jobs as one piece of work**, not three. This module's version is the mildest of the three, but fixing it alongside the other two (rather than leaving it as "probably fine") closes out the pattern completely rather than leaving one instance unaddressed.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Fix the hardcoded `KES` label in `finalizeDischarge`'s financial-clearance error (§3.1) — tracked cross-cuttingly, now a 2-for-1 fix alongside the `billing` module's identical instance.
- [ ] Move `expireHolds` to a scheduled job, or at minimum isolate its error handling from the hold-creation request that triggers it (§3.2) — as one piece of shared work with the `opd`/`appointments` equivalents.
- [ ] Extend the existing `bed-concurrency.test.ts` (or build a parallel version using the local ephemeral-MongoDB harness) into a true concurrent-load demonstration, and treat it as the reference example for any future concurrency-safety testing in this review series (§7).
- [ ] Point the `appointments` and `opd` modules' unresolved race-condition findings at this module pair's repository methods as the concrete reference implementation (§8).

---

## 10. Verdict

**Production-ready**, modulo the one shared, already-tracked currency-label fix. This is the strongest module pair reviewed in this entire series — every concurrency-sensitive invariant that matters is backed by the database, not just application logic; every retry-prone operation is genuinely idempotent; and the audit trail (prerequisite snapshots, assignment history, queue history patterns seen elsewhere) is detailed enough to reconstruct exactly what happened and why, after the fact. If one module in this codebase had to be pointed to as "this is what correct looks like here," it would be this one.
