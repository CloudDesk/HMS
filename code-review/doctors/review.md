# Module Review: `doctors`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/doctors/*` (`doctor.model.ts`, `doctor-scheduling.model.ts`, `doctor.repository.ts` [536 lines], `doctor.service.ts` [623 lines], `doctor.schemas.ts`, `doctor.types.ts`). Static code review.
**Live load testing: not executed** — doctor records are lower-sensitivity than patient/clinical data, but this module's `availableSlots()` reads live appointment data to compute conflicts, so the same caution applied to `appointments`/`patients` extends here; see §7.

---

## 1. Executive summary

This is, on balance, **the best-engineered module reviewed so far** in this series for the specific things that matter most to it: the index design is correct where several earlier modules got it wrong, the doctor-number sequence allocation avoids the inefficiency found in `patients`' equivalent code, and the onboarding flow is a genuinely well-built transactional operation. The one real finding is the cross-cutting timezone-default issue documented separately — found here, in this module's `availableSlots()` method, but affecting multiple modules.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 0 (1 tracked in the cross-cutting doc) | `availableSlots()`'s timezone fallback (`'Africa/Nairobi'`) — full writeup in `code-review/_infrastructure/market-localization-mismatch.md`, not re-derived here |
| 🟠 High | 0 | — |
| 🟡 Medium | 1 | Doctor leave overlap check has the same check-then-create race already flagged for appointment conflicts, though lower real-world risk given it's a rare admin action |
| 🟢 Low | 1 | In-progress schema migration debt (single time-range → multiple working blocks per day) left partially unexplained in the model |

---

## 2. What's correct (keep doing this) — and where this module should be the template for earlier ones

- **Index design matches actual query shape, correctly, including `deletedAt`.** `doctor.model.ts:111`: `{ deletedAt: 1, status: 1, branchId: 1, departmentId: 1, displayName: 1 }` — confirmed against `doctor.repository.ts:224-229`'s `list()` filter (`deletedAt`, optional `status`/`branchId`/`departmentId`), and they line up exactly. This is the first collection in this entire review series where the base soft-delete filter is actually covered by a real index from the start. `patients`, `opd_visits`, and `appointments` should all be fixed to look like this.
- **The doctor-number sequence allocation is a strictly better version of the pattern found lacking in `patients`.** Compare:
  - `patients`' `allocatePatientNumber` (reviewed earlier) runs an expensive regex-scan-and-sort query to find the "existing maximum" **on every single patient creation**, forever.
  - `doctors`' equivalent (`doctor.repository.ts:281-301`, `ensureDoctorNumberSequence`) does a **cheap existence check** (`DoctorSequenceModel.exists({_id: sequenceId})`) first, and only pays the expensive regex-scan reconciliation cost **once per year**, the first time a doctor is ever created in that year. The actual per-creation allocation (`nextDoctorNumber`, `:303-313`) is then a plain, cheap atomic `$inc`.

  This is exactly the fix already recommended for `patients` in that module's review — and it's sitting right here in the same codebase, already correctly implemented. Worth pointing whoever fixes the `patients` finding at this exact file as the reference implementation.
- **Doctor onboarding (`create`) is a well-built transactional operation** (`doctor.service.ts:108-140`, `:142-197`): optionally provisions a staff login account *and* creates the doctor record atomically via `executeTransaction`, with a thorough, specific duplicate-key error mapping (username/email/employee-code/registration-number/doctor-number, each with its own `AppError` code) rather than one generic conflict message.
- **Availability-exception uniqueness is DB-enforced correctly**: `doctorAvailabilityExceptionSchema.index({ doctorId: 1, date: 1 }, { unique: true })` (`doctor-scheduling.model.ts:73`) — "one exception record per doctor per date" is guaranteed at the database level, not just checked in application code.
- **`availableSlots()`'s conflict detection correctly reuses the same interval-overlap logic** as `appointments`' own conflict checks (`doctor.service.ts:421-426`: `startTime < appointment.end_time && endTime > appointment.start_time`), applied independently for both doctor-side and patient-side conflicts when computing which slots to offer — consistent logic shared conceptually across both modules, even though it's implemented in two places (see §3.2 for the one gap this creates).

---

## 3. Findings

### 3.1 🔴 CRITICAL (tracked cross-cuttingly, not re-derived here) — Timezone fallback defaults to Kenya, not India

**Where:** `doctor.service.ts:369`

```ts
const tz = (await this.settingsRepository?.get())?.localization?.timezone || 'Africa/Nairobi';
```

This is the entry point where this cross-cutting issue was found. Full detail, affected files across multiple modules, and recommended remediation are in **[`code-review/_infrastructure/market-localization-mismatch.md`](../_infrastructure/market-localization-mismatch.md)** — not duplicated here. The specific, module-relevant consequence: this timezone value directly determines what counts as "today," "already past," and which day-of-week's recurring availability applies inside `availableSlots()` (`:369-385`) — the exact function that decides which appointment slots are offered to staff and patients. If this fallback is ever actually reached (settings missing/misconfigured, or the optional `settingsRepository` being unset in some wiring path), bookable-slot computation silently runs 2.5 hours offset from where it should be for an India deployment.

### 3.2 🟡 MEDIUM — Doctor leave overlap check has the same unenforced race as appointment conflicts

**Where:** `doctor.service.ts:277-302` (`createLeave`), `doctor-scheduling.model.ts:58` (index, not unique)

```ts
const overlap = await this.repository.findOverlappingLeave(id, startDate, endDate);
if (overlap) throw new AppError(..., 409, 'DOCTOR_LEAVE_OVERLAP', ...);
const leave = await this.repository.createLeave(id, data, userId);
```

This is the same check-then-create shape already flagged as a real concurrency gap in the `appointments` review (§3.1 there) — `doctorLeaveSchema.index({doctorId,status,startDate,endDate})` is a plain compound index, not a unique constraint, so it supports the overlap *query* efficiently but doesn't prevent two concurrently-created overlapping leave records at the database level.

**Why this is lower priority than the equivalent `appointments` finding:** creating a doctor's leave record is a rare, low-concurrency administrative action (an HR/admin staff member doing this once per leave request), not a hot, repeatedly-invoked, time-pressured path the way appointment booking is. The realistic risk of two concurrent leave-creation requests for the same doctor landing within milliseconds of each other is low. Flagged for completeness and consistency with the `appointments` finding, not as an urgent item.

**Recommended fix:** lower priority than §3.2 in the `appointments` review; if addressed, the same style of fix (serialize via a coarser claim, or accept the current risk level given how rarely this path is actually exercised concurrently) applies.

### 3.3 🟢 LOW — Availability schema shows visible migration-in-progress debt

**Where:** `doctor.model.ts:18-23`, `:70-72`

```ts
export type DoctorAvailabilityFields = {
  ...
  workingBlocks: DoctorWorkingBlockFields[];
  // Retained temporarily so existing single-range records can be read and normalized.
  startTime?: string;
  endTime?: string;
  ...
};
```

This is the same category of issue flagged in the `departments` review (`branchId`→`branchIds` migration leftover) — a schema mid-migration from a single start/end time range per day to multiple named working blocks per day, with the old fields kept "temporarily" for backward-read compatibility. Unlike the `departments` case, this one doesn't appear to have produced an active bug in the code sampled during this review (no code path was found treating the legacy fields as authoritative in a way that would silently misbehave) — it's flagged as housekeeping debt and a readability cost for future maintainers, not a confirmed defect.

**Recommended fix:** confirm the migration is complete (no production doctor records still rely on the legacy single-range fields), then remove `startTime`/`endTime` from `DoctorAvailabilityFields` and the corresponding schema fields.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Doctor status transition legality | ✅ | `allowedStatusTransitions` lookup, same pattern as `opd`'s visit-status table | None |
| Duplicate username/email/employee code/registration number/doctor number on create | ✅ DB-enforced, specifically mapped | `create()`'s duplicate-key handling | None |
| Leave date range sanity (`start <= end`) | ✅ | `createLeave` | None |
| Overlapping leave for the same doctor | ⚠️ app-level only | `findOverlappingLeave` | §3.2 |
| One availability exception per doctor per date | ✅ DB-enforced | Unique index | None |
| Branch/department reference validity on create/update | ✅ | `validateDoctorReferences` | None |
| Doctor-user account mapping validity | ✅ | `validateUserMapping` | None |
| Available-slots timezone correctness | ⚠️ broken on fallback path | `availableSlots()` | §3.1 (cross-cutting) |
| Past-date slot requests rejected | ✅ | `availableSlots()`'s `isPastDate` check | None |

---

## 5. MongoDB index audit

**`doctors`** — 7 indexes: unique `doctorNumber` (implicit), unique partial on `userId` (correctly allows many doctors with no linked login — `partialFilterExpression: { userId: { $type: 'objectId' } }`), `displayName`, `{branchId,departmentId,status}`, **the correct `{deletedAt,status,branchId,departmentId,displayName}` compound** (the standout positive of this review), `specialization`, sparse indexes on `registrationNumber`/`email`. No gaps found relative to the actual query code reviewed.

**`doctor_leaves`** — `{doctorId,status,startDate,endDate}`, well-shaped for the overlap query; not unique (§3.2).

**`doctor_availability_exceptions`** — `{doctorId,date}`, unique — correct.

No index-level findings in this module beyond what's already noted above — this is the first module in the series with a genuinely clean index audit.

---

## 6. API performance & round-trip analysis

| Operation | Sequential round trips (excluding shared auth chain) | Notes |
|---|---|---|
| `GET /api/doctors` | ~3 (`list`+`count` parallel, branch scope) | |
| `POST /api/doctors` (onboarding) | ~6-8 inside one transaction (optional account provisioning, sequence allocation, doctor create, 2-3 audit writes) | Appropriately transactional; round-trip count reflects genuine multi-document consistency needs, consistent with the `opd` review's treatment of similarly-shaped transactional flows |
| `GET /api/doctors/:id/available-slots` | ~5 (doctor fetch, active-leave check, exception lookup, doctor-side appointment window fetch, optional patient-side appointment window fetch) | Reasonable; the real risk here is correctness (§3.1), not round-trip count |

Nothing in this module's round-trip profile stands out as a problem worth flagging independently — it's consistent with the complexity of what each operation actually needs to do.

---

## 7. Load testing (p65/p90) — status

**Not executed.** Doctor master-data records themselves are lower-sensitivity than patient/clinical data (no PHI), but `availableSlots()` reads live appointment windows to compute conflicts, which ties this module to the same "don't run load tests against real scheduling data without a separate decision" reasoning already applied to `appointments`. If/when that decision is made and the local ephemeral-harness approach is used, `availableSlots()` under concurrent load would also be a good candidate for confirming the `appointments` module's §3.1 race condition (the same overlap-check logic is duplicated here for slot-offering purposes).

---

## 8. Scalability & dynamic-approach recommendations

- **This module's index design and sequence-allocation pattern should be the explicit house standard**, not just a nice-to-have observation — concretely, that means pointing the `patients` module's fix at `ensureDoctorNumberSequence`/`nextDoctorNumber` (already tracked below) and pointing any future new entity's schema design at `doctor.model.ts:111`'s `{deletedAt,status,branchId,departmentId,displayName}` compound index as the template for "does this index actually match my base filter."
- **Fix the timezone fallback dynamically, not with another hardcoded literal** — per the cross-cutting finding, the right fix isn't just swapping `'Africa/Nairobi'` for `'Asia/Kolkata'` in three places; it's deriving the fallback from one shared constant (or, better, making the settings lookup required rather than optional) so the system's notion of "what timezone are we in" can actually change if this product is ever deployed to a different market again, without another multi-file hunt.
- **The doctor-leave overlap race (§3.2) is correctly deprioritized here**, but worth revisiting if leave-request volume or concurrency ever changes (e.g., a self-service leave-request feature for doctors, rather than admin-entered) — the same fix pattern already recommended for `appointments` would apply unchanged.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Fix the `'Africa/Nairobi'` timezone fallback — tracked in the cross-cutting doc, not duplicated here (§3.1).
- [ ] Decide whether the doctor-leave overlap race (§3.2) is worth fixing given its low real-world concurrency risk, or accepted as-is — lower priority than the equivalent `appointments` finding.
- [ ] Confirm the availability-schema migration (§3.3) is complete, then remove the legacy `startTime`/`endTime` fields from `DoctorAvailabilityFields`.
- [ ] **Point whoever fixes the `patients` module's patient-number allocation finding at this module's `ensureDoctorNumberSequence`/`nextDoctorNumber` pair as the reference implementation** — this is a concrete, ready-to-copy fix, not just a suggestion in the abstract.

---

## 10. Verdict

**The strongest module reviewed in this series on its own technical merits** — correct indexing, a better-than-average sequence-allocation pattern, and a well-built onboarding transaction. Its one real finding isn't really "about" this module at all — it's where a systemic, cross-module configuration problem happened to surface first. If every module in this codebase were held to this module's standard for index design and sequence allocation, several findings elsewhere in this review series wouldn't exist.
