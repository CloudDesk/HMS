# Module Review: `surgery`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/surgery/*` (847 lines) — procedure recommendation → booking → confirm/reschedule/cancel/complete lifecycle. Static code review.
**Live load testing: not executed** — real OT scheduling data; see §7.

---

## 1. Executive summary

This module contains the single most sophisticated concurrency-control mechanism found anywhere in this review series — and it's the **direct, concrete answer to the unresolved doctor/patient double-booking race already flagged as unfixed in the `appointments` module**. `createBooking` acquires a deliberate, deadlock-safe advisory lock (by writing to the doctor and service documents in a globally-consistent sorted order, inside the transaction, relying on MongoDB's write-conflict detection and the driver's automatic transient-error retry) before validating the schedule — which correctly serializes concurrent booking attempts for overlapping time ranges, not just exact-match slots. The one real finding is that this same module doesn't consistently apply its own fix: `rescheduleBooking`, which introduces the identical race (moving a booking to a new time slot), doesn't acquire the lock before doing so.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 0 | — |
| 🟠 High | 1 | `rescheduleBooking` doesn't acquire the same concurrency lock `createBooking` uses, reintroducing the overlap race this module otherwise solves correctly |
| 🟡 Medium | 0 | — |
| 🟢 Low | 1 | Inconsistent timezone-fallback value (`'UTC'` here vs. `'Africa/Nairobi'` elsewhere) — not itself wrong, but worth normalizing |

---

## 2. What's correct (keep doing this) — and why this is the most important section in this review

- **`acquireConcurrencyLock` (`surgery.repository.ts:30-47`) is a genuinely sophisticated, correct distributed-locking pattern**, and it's worth understanding exactly how it works because it's the reference answer to a problem flagged as unresolved twice already in this series:
  ```ts
  async acquireConcurrencyLock(doctorId: string, serviceId: string, session?: ClientSession) {
    const locks = [{ type: 'Doctor', id: doctorId }, { type: 'Service', id: serviceId }]
      .sort((a, b) => a.id.localeCompare(b.id));   // <- globally consistent lock order
    for (const lock of locks) {
      // trivial no-op write to the Doctor or Service document, inside the transaction
      await (lock.type === 'Doctor' ? DoctorModel : ServiceModel)
        .updateOne({ _id: oid(lock.id) }, { $set: { updatedAt: new Date() } })
        .session(session);
    }
  }
  ```
  The technique: writing to a "resource" document inside a MongoDB transaction forces the server to detect a **write conflict** if a concurrent transaction tries to write to the same document before the first one commits. One of the two transactions gets aborted with a `WriteConflict` error carrying the `TransientTransactionError` label — and the MongoDB driver's `session.withTransaction()` (which `executeTransaction`, reviewed across this series, delegates to) has **built-in automatic retry** for exactly that error label. So the loser doesn't see a raw database error — its entire transaction callback is silently retried from the top, by the driver itself, and on retry it sees the winner's now-committed booking and correctly fails `validateSchedule`'s overlap check with a clean `409`. This is real pessimistic concurrency control, correctly wired into the transaction-retry machinery already in place.
  The **sorted lock order** is the detail that makes this safe against deadlocks: if one request books {Doctor A, Service X} and another books {Service X, Doctor A} without a consistent order, each could end up waiting on a resource the other already holds. Sorting both locks by ID string before acquiring them guarantees every concurrent transaction across the whole system acquires locks in the same global order, which is the standard, correct way to prevent circular-wait deadlocks in exactly this kind of manual locking scheme.
- **`validateSchedule` checks overlap against the doctor's *other* procedure bookings *and* their OPD appointments** (`surgery.repository.ts:103-104`, `hasDoctorOverlap`/`hasAppointmentOverlap`) — meaning this module doesn't just prevent two surgeries from double-booking a doctor, it prevents a surgery from being booked over an existing OPD appointment slot for the same doctor, a genuinely cross-module consistency check that wouldn't be visible reviewing either module in isolation. It also checks **service/OT capacity** (`countServiceOverlap`, respecting a per-service `bookingCapacity` rather than assuming one procedure room), and the doctor's actual availability (working hours, exceptions, approved leave) via the same logic already reviewed in the `doctors` module.
- **The prerequisite-snapshot pattern** (consent/deposit/bed-hold requirements recorded at confirmation time, `surgery.service.ts:202`) is the same good audit practice already praised in the `inpatient-admissions` review — applied consistently here too, not a one-off.
- **Bed holds are released on cancel, complete, and superseding reschedule** (`cancelBooking`, `completeBooking`, `rescheduleBooking`'s `releaseHoldSafe` call when the hold actually changes) — consistent, correct cleanup of a resource shared with `admissions-configuration`, reusing that module's own `releaseHoldSafe` idempotent-release logic rather than reimplementing it.

---

## 3. Findings

### 3.1 🟠 HIGH — `rescheduleBooking` doesn't acquire the concurrency lock before committing a new schedule

**Where:** `surgery.service.ts:211-237` (`rescheduleBooking`), compared against `:137-183` (`createBooking`)

`createBooking` correctly calls `this.repository.acquireConcurrencyLock(...)` before `validateSchedule` and before writing the new booking (§2). `rescheduleBooking` calls `validateSchedule` (`:219`) and then writes the new schedule (`:231`) — **without ever calling `acquireConcurrencyLock` first**. Rescheduling moves a booking to a new time slot (and potentially a new doctor), which is exactly the same kind of state change `createBooking`'s lock exists to protect — claiming a specific doctor/time-window combination that must not overlap with anything else.

**Why it matters:** two concurrent reschedule requests — say, rescheduling Booking A to Thursday 2:00pm for Doctor X, and separately rescheduling Booking B to Thursday 2:15pm for the same Doctor X (overlapping) — can both run `validateSchedule` before either has committed its new time, each correctly seeing no conflict against the *other's old* schedule, and both succeed, producing two overlapping bookings for the same doctor. This is the exact race this module otherwise demonstrably knows how to prevent — it's just not applied consistently to every code path that changes a booking's time.

**Why High, not Critical:** reschedules are lower-frequency than fresh bookings, and this module's own design already shows the fix is a one-line addition, not a redesign.

**Recommended fix:** add `await this.repository.acquireConcurrencyLock(doctorId, booking.serviceId.toString(), session)` to `rescheduleBooking` immediately before `validateSchedule`, mirroring `createBooking` exactly. Given `confirmBooking` doesn't change the booking's time (only its status), it doesn't need the same lock — the slot was already claimed and visible to other `validateSchedule` calls from the moment the booking was created — so this fix is specifically about `rescheduleBooking`, not a sign that every method needs it.

### 3.2 🟢 LOW — Inconsistent timezone-fallback value

**Where:** `surgery.service.ts:416`: `const tz = (await this.settingsRepository.get())?.localization?.timezone || 'UTC';`

This module's timezone fallback is the neutral, market-agnostic `'UTC'` — in contrast to the `'Africa/Nairobi'` fallback literals found in `doctors` and `opd`'s dental-stage sub-module (tracked in the cross-cutting localization finding). This isn't wrong on its own — `'UTC'` is a defensible neutral default — but it's worth noting the codebase has at least two different fallback strategies for the identical kind of missing-config scenario. Once the cross-cutting localization finding is resolved, it'd be worth standardizing on one fallback approach (ideally: no hardcoded literal at all, derived from one shared constant) rather than leaving this as an accidental inconsistency.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Doctor double-booked (procedure vs. procedure), on creation | ✅ DB-safe | `acquireConcurrencyLock` + `hasDoctorOverlap` | None |
| Doctor double-booked (procedure vs. procedure), on reschedule | ⚠️ app-level only | `validateSchedule` without a lock | §3.1 |
| Doctor double-booked (procedure vs. OPD appointment) | ✅ | `hasAppointmentOverlap` | None |
| Service/OT capacity exceeded | ✅ | `countServiceOverlap` vs. `bookingCapacity` | None |
| Doctor availability (hours/leave/exceptions) | ✅ | `validateDoctorAvailability`, reusing `doctors` module logic | None |
| Bed hold required and valid, when service requires one | ✅ | `confirmBooking`/`rescheduleBooking` | None |
| Consent required and verified, when service requires one | ✅ | `verifyContextConsent` | None |
| Advance deposit required and satisfied, when service requires one | ✅ | `verifyProcedureDeposit` | None |
| Recommendation consumed exactly once | ✅ DB-enforced | `markRecommendationBooked` + partial unique index on `ProcedureBookingModel.recommendationId` | None |
| Scheduling in the past / crossing midnight | ✅ | `validateSchedule`'s date/time checks | None |

---

## 5. MongoDB index audit

**`procedure_recommendations`** — `{branchId,status,createdAt}`, unique partial `{patientId,serviceId,status:'ACTIVE'}` (prevents duplicate active recommendations for the same patient+service), unique partial `{encounterType,encounterId,serviceId,status:'ACTIVE'}` (prevents duplicate recommendations from the same encounter). Well-targeted.

**`procedure_bookings`** — `{branchId,status,scheduledStart}`, `{doctorId,status,scheduledStart,scheduledEnd}` (supports the overlap queries directly), `{serviceId,status,scheduledStart,scheduledEnd}` (same, for capacity checks), unique partial `{recommendationId,status:{$in:['PENDING_CONFIRMATION','BOOKED']}}`. No gaps — every index maps directly to a real query in the service/repository code reviewed.

No soft-delete field on either collection — status-based lifecycle, consistent with the better-designed modules elsewhere in this series (no missing-`deletedAt`-index finding applies here).

---

## 6. API performance & round-trip analysis

| Operation | Sequential round trips (excluding shared auth chain) | Notes |
|---|---|---|
| `POST /surgery/bookings` (create) | ~10-12 inside one transaction (recommendation fetch, reference lookups, 2-step lock acquisition, 3 overlap/availability checks, booking create, optional invoice creation, recommendation-consumed update, timeline, audit) | Appropriately complex; the lock itself only adds 2 extra trivial writes |
| `POST /surgery/bookings/:id/confirm` | ~8-9 (booking/recommendation fetch, re-validation, bed-hold check, consent check, deposit check, confirm write, timeline, audit) | Reasonable |
| `POST /surgery/bookings/:id/reschedule` | ~8-10, **and racy** (§3.1) | Should gain 2 round trips (the lock) once fixed — a small cost for closing a real race |

---

## 7. Load testing (p65/p90) — status

**Not executed.** Real OT scheduling data. **This module's `acquireConcurrencyLock` mechanism is an excellent candidate for a direct, confirmatory concurrency test** using the local ephemeral-MongoDB harness — fire two concurrent `createBooking` requests for overlapping times with the same doctor and confirm exactly one succeeds (demonstrating the lock works as designed), then run the equivalent test against `rescheduleBooking` to concretely demonstrate §3.1 before and after the fix.

---

## 8. Scalability & dynamic-approach recommendations

- **This module's locking pattern should be formally adopted as the house solution to the exact class of problem still open in `appointments`** — not just referenced in passing. Concretely: `appointments`' `validateDoctorConflict`/`validatePatientConflict` should acquire the equivalent advisory lock (sorted, on the doctor and/or patient document) before their overlap checks, exactly mirroring `acquireConcurrencyLock`'s structure. This is a more direct, already-proven-correct fix than the "coarser locking or transactional retry" suggestion offered in that review at the time — now there's a concrete implementation to point at instead of a general direction.
- **Apply the fix in §3.1 and then audit for the same gap pattern** — "the lock is acquired on the path that creates a new claim, but not consistently on every path that changes which resource is claimed" is a specific, checkable shape. It's worth a quick audit of any other module with a similar create-vs-modify split (none currently reviewed in this series have an exact analog, but it's the kind of gap that's easy to reintroduce if this method gets copied into a new context without carrying the lock call along with it).
- **The cross-module overlap check (surgery vs. appointments, §2) is a good model for closing gaps that only exist at the intersection of two modules** — worth checking whether `appointments` itself checks against `surgery` bookings when validating a doctor's availability for a new OPD appointment (not verified in this pass) — if that check doesn't exist in the other direction, there's a one-way gap: surgery respects OPD appointments, but OPD booking might not respect existing surgery bookings when picking a doctor's slot.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Add `acquireConcurrencyLock` to `rescheduleBooking`, mirroring `createBooking` exactly (§3.1).
- [ ] Apply this module's locking pattern to close the equivalent, already-tracked race conditions in `appointments` (§8) — update that review's checklist to point here once this is actioned.
- [ ] Verify whether `appointments`' own doctor-availability checks consider existing `surgery` bookings (the reverse direction of the cross-module check already confirmed to exist here) — flagged as an open question, not a confirmed gap, given it wasn't directly checked in this pass.
- [ ] Normalize the timezone-fallback inconsistency (`'UTC'` here vs. `'Africa/Nairobi'` elsewhere) once the cross-cutting localization finding is resolved (§3.2).
- [ ] Add a synthetic concurrent-load test demonstrating `acquireConcurrencyLock`'s correctness and §3.1's race/fix, using the local ephemeral-MongoDB harness (§7).

---

## 10. Verdict

**Very close to production-ready, and technically the most impressive module in this review series.** The one finding is a real gap, but it's a gap in *consistently applying* a pattern this module already got right once — not a sign the team doesn't know how to solve the problem. If this codebase needed one module held up as proof that its hardest concurrency problems are solvable within its existing architecture, this would be it.
