# Module Review: `appointments`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/appointments/*` (`appointment.model.ts`, `appointment.repository.ts` [773 lines], `appointment.service.ts` [884 lines], `appointment.schemas.ts`, `appointment.types.ts`, `patient-pre-consultation.model.ts`). Static code review.
**Live load testing: not executed** — same reasoning as `patients`/`opd` (real scheduling data, not a reference table; see §7).

---

## 1. Executive summary

The headline mechanism in this module — `activeSlotKey`, a derived `doctorId:date:startTime` string backed by a partial unique index — correctly solves the narrowest and most common double-booking case at the database level, which is good, deliberate design. But it only solves the *narrow* case. The broader, more clinically meaningful conflict checks (overlapping-but-not-identical time ranges for a doctor, and any conflict at all for a patient) exist only as application-level check-then-create validation, with no database backing — a real race-condition gap sitting right next to a correctly-solved version of the same category of problem.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 0 | — |
| 🟠 High | 1 | Doctor/patient appointment-overlap conflict checks have no database-level guarantee — only the exact-start-time case does |
| 🟡 Medium | 2 | `reconcilePastAppointments` mixes a write-heavy reconciliation loop into a read path with no error handling (unhandled exception would break the patient portal's appointment list entirely); `appointments` collection has no index covering `deletedAt` |
| 🟢 Low | 1 | Same case-insensitive-regex-bypasses-index search pattern as every other module in this series (not re-documented in depth — see prior reviews) |

---

## 2. What's correct (keep doing this)

- **`activeSlotKey` is a well-designed, DB-enforced uniqueness mechanism** for the exact-duplicate-slot case: a derived string (`appointment.repository.ts:62-63`) with a partial unique index (`appointment.model.ts:123-126`), correctly cleared to `null` on every terminal status transition (cancel/reschedule/no-show/skip/complete — `:401-405`, `:613`, `:657`) so a freed slot can be rebooked. This is the right pattern, and it's the second time in this review series (after `opd_visits`' appointment/admission uniqueness) that this exact approach shows up correctly — it's clearly a house convention the team applies deliberately, not a one-off.
- **Reschedule is a real atomic operation**, not a cancel-then-create pair done by the client: `rescheduleAtomically` (referenced from `rescheduleForPortal`, `:258`) links the old and new appointment records (`rescheduledFromId`/`rescheduledToId`/`rescheduledAt`) and uses `findOneAndUpdate` with a status-match guard, correctly returning `409 APPOINTMENT_CHANGED` if the original was modified concurrently (`appointment.repository.ts:665-667`) rather than silently clobbering a concurrent change.
- **Portal reschedule eligibility is a clean, explicit rule set** (`appointment.service.ts:165-203`) — status-based gating plus a minimum-notice-hours check, each with its own specific, user-facing reason string. This is good UX-aware API design: the client doesn't have to guess why a reschedule isn't allowed.
- **Timezone handling is explicit and deliberate**, not implicit: `createInternal` (`:317-349`) resolves the hospital's configured timezone from settings and uses `formatInTimeZone`/`fromZonedTime` to convert between local wall-clock time and UTC consistently, storing both (`utcDateTime`/`utcEndTime` alongside `appointmentDate`/`startTime`) — this dual-storage is exactly what's needed to support both accurate interval-overlap queries (§3.1) and human-readable display, and it's a sign of someone having thought carefully about a notoriously error-prone area (timezone-aware scheduling).
- **Reschedule and creation share the same conflict-checking helpers** (`validateDoctorConflict`/`validatePatientConflict`, `:806-865`) rather than duplicating the logic — consistent application of one rule in both places it matters.

---

## 3. Findings

### 3.1 🟠 HIGH — Overlap-based conflict checks (the common case) have no database-level guarantee; only the exact-match case does

**Where:** `appointment.service.ts:806-865` (`validateDoctorConflict`, `validatePatientConflict`), compared against `appointment.model.ts:123-126` (`activeSlotKey`'s partial unique index)

`findDoctorConflict` (`appointment.repository.ts:425-450`) runs a real interval-overlap query — `utcDateTime < requestedEnd AND utcEndTime > requestedStart` — which correctly catches a doctor being booked for two appointments that overlap but don't start at the exact same time (e.g., an existing 10:00-10:30 appointment and a new request for 10:15-10:45). This is the check that actually matters clinically; `activeSlotKey`'s exact-string-match only catches the narrower case of two appointments requested for the identical start time.

**The gap:** `activeSlotKey` is the *only* one of these two checks with database backing. The overlap check is pure application-level check-then-create — `validateDoctorConflict`/`validatePatientConflict` query for a conflict, and if none is found, the code proceeds to create the new appointment entirely outside of any transaction or locking mechanism tying the check to the write. Two concurrent booking requests for overlapping-but-not-identical slots for the same doctor (or the same patient — `validatePatientConflict` has no unique-index backing at all, for any case) can both pass their respective conflict checks before either commits, and both succeed.

**Why it matters:** this is a real double-booking path that the system's own design (the careful UTC-interval overlap query) demonstrates it already knows how to detect correctly — it just doesn't make that detection airtight under concurrency. Scheduling requests are lower-frequency/lower-concurrency than, say, login, so the real-world race window is narrower than some other findings in this series — but a receptionist and a patient-portal self-service booking landing within milliseconds of each other for the same doctor is not an exotic scenario, especially around popular slots (first-thing-in-the-morning, post-lunch).

**Recommended fix:** this is genuinely harder to fully solve with a simple unique index (overlap uniqueness isn't expressible as a single-key or even simple compound unique constraint the way exact-match is) — the standard approaches are either (a) a short-lived advisory lock / `findOneAndUpdate`-based claim on a coarser key (e.g., doctor + date, serializing all booking attempts for that doctor on that day through one document) before running the overlap check and insert, or (b) wrapping the conflict-check-then-create sequence in a transaction with a retry-on-write-conflict loop, relying on MongoDB's transaction-level conflict detection rather than an index. Either is more involved than the fixes elsewhere in this review series, which is exactly why it's flagged as the priority finding here rather than something to defer.

**Update from the `surgery` module review**: option (b) above is no longer a general direction — it's a proven, working implementation sitting in this same codebase. `surgery.repository.ts`'s `acquireConcurrencyLock` does exactly this: a trivial write to the doctor (and service) document, in a globally-consistent sorted order to avoid deadlocks, inside the same transaction as the overlap check and the eventual write, relying on MongoDB's write-conflict detection plus the driver's automatic `TransientTransactionError` retry (already present in this codebase's `executeTransaction`/`withTransaction` usage) to transparently retry the loser. `surgery.service.ts`'s `createBooking` is the reference call site. The fix for this finding is to apply that exact pattern to `validateDoctorConflict`/`validatePatientConflict`, not to design a new mechanism from scratch. Full detail in [`code-review/surgery/review.md`](../surgery/review.md) §2.

### 3.2 🟡 MEDIUM — `reconcilePastAppointments` mixes a write loop into a read path with no error handling

**Where:** `appointment.service.ts:285-314`, called unconditionally from `patient-portal.service.ts:229` on every `listAppointments` call

```ts
async listAppointments(userId: string, requestedPatientId: string, query: {...}) {
  const patientId = await this.repository.resolveAccessiblePatientId(userId, requestedPatientId);
  if (!patientId || patientId !== requestedPatientId) throw new AppError(...);
  await this.appointments.reconcilePastAppointments(patientId);   // <- no try/catch
  return this.repository.listAppointments(patientId, query);
}
```

This is the same category of finding as `opd`'s `reconcileStaleVisits` (reconciliation logic running inline on a read path rather than as a scheduled job) — but with the opposite failure-handling mistake. `opd`'s version silently swallows every error (`.catch(() => 0)`), which hides real failures. This one has **no error handling at all**: if `reconcilePastAppointments` throws for any reason (a downstream `AppError`, an unexpected data shape, a transient DB blip during one of its sequential per-appointment writes), the entire "show me my appointments" call fails for that patient in the patient portal — a read-only request fails because of a side-effecting maintenance task bundled into it.

The loop itself (`:286-314`) is also sequential, one appointment at a time, issuing up to 2-4 DB round trips per stale appointment found (visit lookup, status update, conditional OPD-visit-skip update, audit write) — bounded in practice by how many *past, still-open* appointments one patient can plausibly have (usually small), so this is a much lower-severity version of a sequential-loop-per-item pattern than it would be if it ran system-wide, but it's the same structural shape.

**Why it matters:** a patient should never be unable to see their own appointment history because of an unrelated background reconciliation bug. These two concerns (view my appointments / keep historical appointment statuses accurate) have no reason to be coupled this tightly.

**Recommended fix:** move this to a scheduled job (as recommended for `opd`'s equivalent), or at minimum wrap the call in a try/catch that logs the failure and still returns the appointment list — reconciliation being temporarily stale is a far better failure mode than the read failing outright.

### 3.3 🟡 MEDIUM — `appointments` collection has no index covering `deletedAt`

**Where:** `appointment.model.ts:116-134`

Same pattern as `opd_visits` (previous review) and `patients` (two reviews ago): every read filters `{ deletedAt: null, ... }` as a base condition (confirmed at `appointment.repository.ts:248`), and none of the collection's indexes include it. As with `opd_visits`, the severity here is moderated by the fact that most real queries also filter on `doctorId`, `patientId`, or `branchId`+`departmentId`, each of which does have a leading compound index — so this is a real gap, not an urgent one.

**Recommended fix:** fold `deletedAt` into the existing compound indexes, consistent with the recommendation already made for `opd_visits`.

### 3.4 🟢 LOW — Same case-insensitive regex search pattern as the rest of the codebase

Not re-documented in depth here — `list()`'s `$or` search across `patientNumber`/`patientName`/`doctorName` uses the same unanchored, case-insensitive regex pattern flagged repeatedly across this review series (`branches`, `departments`, `patients`, `roles`). Same root cause, same recommended fix (collation-based index or normalized shadow field) as documented in those reviews.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Appointment date/time parse & window validity | ✅ | `validateAppointmentDate`/`validateAppointmentWindow` | None |
| Doctor exists and is active | ✅ | `getActiveDoctor` (pattern consistent with `opd`'s `getActiveDoctor`) | None |
| Patient exists and is active | ✅ | `getActivePatient` | None |
| Exact-duplicate slot (same doctor, date, start time) | ✅ DB-enforced | `activeSlotKey` unique index | None |
| Overlapping-but-not-identical doctor slot | ⚠️ app-level only | `validateDoctorConflict` | §3.1 |
| Any conflicting patient appointment | ⚠️ app-level only, no index at all | `validatePatientConflict` | §3.1 |
| Portal reschedule eligibility (status + notice window) | ✅ | `getPortalRescheduleEligibility` | None |
| Concurrent reschedule of the same appointment | ✅ | `rescheduleAtomically`'s status-matched `findOneAndUpdate` | None |
| Patient portal access scoping | ✅ | `resolveAccessiblePatientId` check before `listAppointments`/reconciliation | None |

---

## 5. MongoDB index audit

**`appointments`** — 9 indexes: doctor+time (good for schedule views), patient+time (good for history), status+time, branch+department+time, three single-field name/number fields (limited value given regex search — same as `patients`), plus the two well-designed partial indexes (`activeSlotKey` unique; dental episode/stage references, non-unique). Missing `deletedAt` coverage (§3.3). No index exists to support `validatePatientConflict`'s query shape (patient + time range) as efficiently as the doctor-side equivalent — worth adding a `{patientId, utcDateTime, utcEndTime}`-shaped index alongside the fix in §3.1, since fixing the race condition doesn't help if the check itself stays slow as the collection grows.

**`patient_pre_consultations`** — not independently audited this pass; small, single-purpose collection linked 1:1 to appointments, low risk given its scope.

---

## 6. API performance & round-trip analysis

| Operation | Sequential round trips (handler-level, excluding shared auth chain) | Notes |
|---|---|---|
| `GET /api/appointments` | ~3 (`resolveBranchScope`, `list`+`count` parallel) | Reasonable |
| `POST /api/appointments` (create) | ~7 (settings lookup for timezone, patient+doctor fetch parallel, doctor-availability check, doctor-conflict check, patient-conflict check, sequence allocation, create) | The two conflict checks (§3.1) are sequential, not parallelized, despite being independent of each other — `Promise.all`-able without weakening anything, since neither check depends on the other's result |
| `POST /api/appointments/:id/reschedule` (portal) | ~8, similar shape to create plus the atomic reschedule write | Same parallelization opportunity for the conflict checks |
| `GET /api/patient-portal/.../appointments` | 1 (reconciliation query, usually a no-op) + list query, **unbounded by stale-appointment count** when reconciliation actually finds work | §3.2 |

**One concrete, low-risk improvement available right now**: `validateDoctorConflict` and `validatePatientConflict` are independent of each other (`rescheduleForPortal` and `createInternal` both call them sequentially, one after the other) and could run via `Promise.all` to shave one round trip off every booking/reschedule without touching the conflict-detection logic itself.

---

## 7. Load testing (p65/p90) — status

**Not executed**, consistent with `patients`/`opd` — appointment records are real scheduling data tied to real patients, so the same "don't run exploratory/load queries against real clinical data without a separate decision" reasoning applies. The local ephemeral-MongoDB harness from the `auth-rbac` review would be the right tool to actually demonstrate §3.1's race condition concretely (fire concurrent overlapping booking requests and confirm both succeed) if you want that proven rather than just reasoned through — that's a good candidate for a focused follow-up given how much more involved its fix is than everything else in this review.

---

## 8. Scalability & dynamic-approach recommendations

- **The overlap-conflict race (§3.1) is the one finding in this review that needs an architectural decision, not just a fix** — whichever approach is chosen (coarser locking vs. transactional retry) should be designed to scale with booking volume and doctor count, since it will sit directly on the busiest, most time-pressured path in the scheduling system. Worth deciding this pattern once and reusing it for the equivalent `patientId`-side gap, rather than solving the two independently.
- **`pharmacy-dispensing`'s three-layer concurrency-safety pattern (atomic conditional update + optimistic version check + idempotency key) is the directly relevant reference implementation for §3.1** — that module already solves the "two concurrent actors can't both claim the same scarce resource" problem this module has, just for stock instead of time slots.
- **Move `reconcilePastAppointments` to a scheduled job (§3.2)**, as one piece of shared work with `opd`'s identical-shaped `reconcileStaleVisits` finding — fixing both together avoids maintaining two slightly-different versions of the same architectural fix.
- **Parallelizing the two independent conflict checks (§6) is a free scalability win available today**, with no dependency on resolving §3.1 first — worth doing immediately regardless of when the harder race-condition fix lands.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Close the overlap-conflict race condition for both doctor and patient bookings — requires a locking or transactional approach, not just an index (§3.1). **Priority finding for this module** given it's the one gap in this review that can't be fixed with a one-line index change.
- [ ] Add error handling around `reconcilePastAppointments` in `patient-portal.service.ts:229` so a reconciliation failure doesn't break the patient's ability to view their own appointments (§3.2); consider moving reconciliation to a scheduled job across both this module and `opd`'s equivalent.
- [ ] Fold `deletedAt` into the existing `appointments` compound indexes (§3.3).
- [ ] Add a `{patientId, utcDateTime, utcEndTime}` index to support `validatePatientConflict` efficiently once §3.1 is addressed (§5).
- [ ] Parallelize the doctor-conflict and patient-conflict checks in `createInternal`/`rescheduleForPortal` (§6) — a free, zero-risk round-trip reduction available independent of the harder fix in §3.1.
- [ ] Apply the same case-insensitive-regex/collation fix already recommended repeatedly in this series (§3.4), once a decision is made on how to handle it as a cross-module cleanup rather than module-by-module.

---

## 10. Verdict

**Not production-ready, but closer than most modules reviewed so far.** No critical bugs, no broken features — the one real finding that matters (§3.1) is a legitimate concurrency gap in a system that otherwise demonstrates it knows how to solve exactly this class of problem (per `activeSlotKey`), just not completely. The reconciliation-on-read pattern (§3.2) is this module's version of an anti-pattern that's now shown up twice in this series (`opd` had the same shape with the opposite failure-handling bug) — worth treating as one shared architectural decision to fix once (move both to scheduled jobs) rather than two separate module-level patches.
