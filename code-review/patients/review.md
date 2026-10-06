# Module Review: `patients`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/patients/*` (`patient.model.ts`, `patient.repository.ts` [1033 lines], `patient.service.ts` [1061 lines], `patient.routes.ts`, `patient.schemas.ts`, `patient-number.{model,service}.ts`). Static code review, informed by the real round-trip-cost measurement already taken against the live SIT MongoDB (~25-30ms per round trip from this review session's location — see `code-review/_infrastructure/render-region-vs-mongo-region.md`).
**Live load/latency testing: not executed this pass** — see §7. Read-only connectivity to SIT exists and was used in a prior pass; this review did not re-run queries against SIT because, unlike `branches`/`departments` (tiny reference tables), `patients` is a real, growing, real-patient-data collection, and I didn't want to run exploratory queries against it without first confirming with you what's acceptable (even read-only queries at volume are still "an AI script touching real patient records," and that's worth a deliberate decision, not an assumption).

---

## 1. Executive summary

`patients` is the single most important entity in the system — referenced by nearly every clinical module — and it shows. The patient-number allocation design (atomic counter + retry-on-race) and the batched related-entity lookups (profile photos, timeline-event creator names) are genuinely good engineering. But this pass found one **confirmed, functional, patient-facing bug** that should be the headline: **new patient registration actively rejects valid phone numbers in standard international format** for what is clearly an India-operating hospital system, because of a validation function that appears to be copy-pasted from an unrelated African-market codebase and never adapted or renamed.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 1 | Patient registration phone validation rejects valid international-format numbers (e.g. `+91...`) via a function literally named `isValidAfricanPhone` |
| 🟠 High | 1 | The `patients` collection — likely the largest, fastest-growing collection in the whole system — has **no index covering `deletedAt`**, the filter applied on every single read |
| 🟡 Medium | 3 | Duplicate-patient detection on every registration is an unindexed, case-insensitive regex scan; patient-number allocation does a redundant lookup query on every single creation; clinical timeline reconstruction relies on regex-parsing free text instead of a stored reference |
| 🟢 Low | 1 | Inconsistent phone validation between create (strict, buggy) and update (none at all) |

---

## 2. What's correct (keep doing this)

- **Atomic, race-free patient-number allocation**: `patient-number.service.ts`'s `allocatePatientNumber` uses a `findOneAndUpdate` with an aggregation-pipeline `$set` (`$add`/`$max`) to atomically increment a per-year counter, with a 3-attempt retry specifically catching Mongo's duplicate-key error (`code: 11000`). This is a correct, deliberate solution to the classic "two requests get the same sequence number" race condition — genuinely well done, and notably better than a naive read-then-increment pattern.
- **Batched related-entity resolution, consistently applied**: `list()` resolves all patients' profile photos in a single `$in` query rather than one query per patient (`patient.repository.ts:277-296`); `listTimeline()` resolves all event creators' names in one batched `UserModel.find({_id: {$in: creatorIds}})` (`:510-514`). This N+1-avoidance pattern shows up consistently across this module, not as a one-off — it's a good sign of a deliberate house convention.
- **Branch-scoping follows the same validated pattern** documented as correct (if fragile) in the `auth-rbac` review: `resolveBranchScope(userId, requestedBranchId)` validates branch existence and the actor's assignment to it before any data is touched, consistently used across `list`/`getById`/`create`/`update`/`findDuplicateCandidates`.
- **Document upload has a compensating cleanup on failure**: `uploadDocumentForPortal` (`patient.service.ts:278-333`) uploads the file to storage first, then creates the DB metadata record, and if the DB write fails, explicitly deletes the just-uploaded file (`this.documentStorage.deleteIfExists(storageKey)`) rather than leaving an orphaned file with no database record. This is the right instinct for a two-system (DB + blob storage) write, even though it isn't a full saga/transaction — see §4.4 for the remaining gap.
- **Profile photo upload has real validation**: MIME-type allowlist and a 5MB size cap enforced before storage (`patient.service.ts:335-343`) — simple but correct, and it's enforced at the service layer so it can't be bypassed by a client that skips UI validation.

---

## 3. Findings

### 3.1 🔴 CRITICAL — Patient registration rejects valid phone numbers via a misnamed, wrong-market validation function

**Where:** `patient.service.ts:139-143`, enforced at `:173-175`

```ts
const isValidAfricanPhone = (phone: string): boolean => {
  if (!phone || !phone.trim()) return true;
  const cleaned = phone.replace(/[\s()-]/g, '');
  return /^(\+?(?:2[0-9]{2}|27|20|21[0-9]|22[0-9]|23[0-9]|24[0-9]|25[0-9]|26[0-9]|29[0-9])|0)?[0-9]{8,12}$/.test(cleaned);
};
// ...
if (!isValidAfricanPhone(data.phone)) {
  throw new AppError('Phone number must be a valid African regional phone number', 400, 'VALIDATION_ERROR');
}
```

This function's name, its error message, and its regex are all explicitly scoped to **African country calling codes** (the alternation `2[0-9]{2}|27|20|21[0-9]|...|29[0-9]` covers the +20/+21x-+29x range — Egypt, South Africa, and other African country codes). Everything else about this codebase points to an **India-operating** hospital system: the MongoDB cluster is hosted in Mumbai (confirmed in this review series' infrastructure note), and — concretely, in this exact module — `patient.service.ts:48,108` formats consent-document timestamps with `.toLocaleString('en-IN')` (India English locale), right next to this phone check.

**What actually breaks, traced through the regex:**
- A phone entered in full international format with India's country code, e.g. `+919876543210`, **fails validation** — `91` does not match any alternative in the African-country-code group, and the `+` forces that group to be attempted (it can't just fall through to the bare-digits branch once a `+` is present, since the final `[0-9]{8,12}$` requires *only* digits after whatever the optional prefix group consumed).
- A **plain 10-digit number with no country code at all**, e.g. `9876543210`, happens to **pass** — not because it was recognized as a valid Indian mobile number, but because the entire prefix group is optional and `9876543210` is 10 digits, satisfying the bare `[0-9]{8,12}` fallback with no actual country-aware validation at all.

So the net effect is a validation rule that **actively rejects the correct, standard way to enter a phone number** for this system's actual market, while **silently accepting any 8-12 digit string** with no real validation when the country code is omitted — simultaneously too strict and too loose, in the wrong directions.

**Why it matters:** this is on the patient *registration* path — `patient.service.ts:166-207`'s `create()`, which every single new patient must pass through. Any front-desk/receptionist workflow that enters a patient's phone in full international format will get a confusing `400 VALIDATION_ERROR` with the message *"Phone number must be a valid African regional phone number"* for a patient who has never been near Africa. This is a real, user-facing, broken-feature bug, not a theoretical one.

**Recommended fix:** replace this with the phone-handling logic that already exists correctly elsewhere in the codebase — `utils/phone.ts`'s `buildPhoneMongoFilter` (used throughout `auth`, `patients`' own duplicate-detection, and elsewhere) presumably already has sane, market-appropriate phone normalization logic; audit it and reuse/extend it here instead of this one-off function. At minimum, rename the function and its error message away from "African" and make the regex actually validate Indian mobile numbers (or whatever the system's real target markets are) rather than silently accepting any digit string as a fallback.

### 3.2 🟠 HIGH — The `patients` collection has no index covering `deletedAt`, the filter on every single query

**Where:** `patient.model.ts:100-103`

```ts
patientSchema.index({ firstName: 1, lastName: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index({ email: 1 });
patientSchema.index({ status: 1 });
```

Every read path in this module — `list()`, `getById()`, `findDuplicateCandidates()`, `update()` — filters on `{ deletedAt: null, ... }` as the base condition (the standard soft-delete pattern used consistently across the whole codebase, per every other module reviewed so far). **None of the four indexes on this collection include `deletedAt`.** Compare this to `branches`, `departments`, and `users`, which all have a `{ deletedAt: 1, status: 1, createdAt: -1 }`-shaped compound index precisely for this reason.

**Why it matters more here than anywhere else reviewed so far:** `patients` is structurally different from `branches`/`departments`/`roles` — those are small, slow-growing reference tables (tens to low hundreds of rows, ever). `patients` is a transactional record that grows with every registration, indefinitely, for the lifetime of the hospital's operation — plausibly the largest collection in the entire database within a year or two of real use. A missing `deletedAt` index on a collection this size is the difference between an index-assisted filter and a genuine full-collection scan on **every single patient search, lookup, and duplicate check**, and the cost of that gap grows every day the system is in production.

Also missing: an index covering `registrationBranchId`, used in every branch-scoped `list`/`getById`/`update`/`findDuplicateCandidates` call for any non-`SUPER_ADMIN` user (`patient.repository.ts:244,311,374,398`).

**Recommended fix:** add, at minimum, `{ deletedAt: 1, status: 1, registrationBranchId: 1, createdAt: -1 }` (matching the shape already used correctly elsewhere in this codebase), and confirm `patientNumber`'s existing unique index is sufficient for `findLatestPatientNumber`'s prefix-regex lookup (it should be, since that one query correctly omits the case-insensitive flag — see the contrast in §3.3). This is the single most impactful fix in this review — likely more impactful at scale than any individual query-level finding in the `branches`/`departments` reviews, simply because of collection size trajectory.

### 3.3 🟡 MEDIUM — Duplicate-patient detection is an unindexed, case-insensitive regex scan on every registration

**Where:** `patient.repository.ts:359-378` (`findDuplicateCandidates`)

```ts
const filters: Record<string, unknown>[] = [
  { ...(data.first_name ? { firstName: new RegExp(`^${escapeRegex(data.first_name)}$`, 'i') } : {}),
    lastName: new RegExp(`^${escapeRegex(data.last_name)}$`, 'i'),
    dateOfBirth: new Date(data.date_of_birth) },
];
if (data.phone) filters.push(buildPhoneMongoFilter(data.phone));
const patients = await PatientModel.find({ deletedAt: null, ...(branchIds ? {...} : {}), $or: filters }).limit(5).lean();
```

This runs on every single patient registration (`patient.service.ts:186`, before the patient is created) to catch likely duplicates. It combines the same case-insensitive-regex-bypasses-index pattern already flagged repeatedly in this review series (`branches`/`departments`/`roles` all have the identical issue on their own `code` fields) with the missing `deletedAt` index from §3.2, on what's likely the largest collection in the system, on the hottest write path (every new patient).

**Why it matters:** as the patient base grows, this check gets slower on every single registration, not just on read-heavy pages — it's directly in the critical path of onboarding a new patient, which is often happening under real-world time pressure (a receptionist with a patient standing at the desk).

**Recommended fix:** fix §3.2's missing index first (that alone turns this from a full scan into an index-filtered scan on `deletedAt`/`registrationBranchId`), then consider a case-insensitive collation index on `lastName` (and `firstName`) specifically to support this exact-match-but-case-insensitive lookup pattern, following the same recommendation already made for `code` fields elsewhere in this series.

### 3.4 🟡 MEDIUM — Patient-number allocation does a redundant scan-and-sort query on every single creation

**Where:** `patient-number.service.ts:8-23`

```ts
export const allocatePatientNumber = async (patientRepository = new PatientRepository()) => {
  const year = new Date().getFullYear();
  const key = `PATIENT_MRN_${year}`;
  const latestPatientNumber = await patientRepository.findLatestPatientNumber(year);  // <- every call
  const existingMaximum = sequenceFromPatientNumber(latestPatientNumber);
  // then atomically allocate using existingMaximum as a floor
  ...
};
```

`findLatestPatientNumber` (`patient.repository.ts:342-348`) runs a regex-prefix query sorted by `patientNumber` descending, on **every single patient creation**, purely to compute a floor value (`existingMaximum`) that's then fed into the atomic counter as a safety net (`$max: [{$ifNull:['$value',0]}, existingMaximum]`, `patient.repository.ts:353`). This pattern makes sense as a one-time reconciliation step (e.g., to catch the counter up if historical patient numbers exist that predate the counter itself, or after a data migration) — but running it unconditionally on every creation, forever, means every single patient registration pays for a query whose answer only matters the very first time it's ever run for a given year (or after an out-of-band data import).

**Why it matters:** less severe than §3.2/§3.3 since it's a single, mostly-indexable query (the regex here correctly omits the case-insensitive flag, so it *can* use the `patientNumber` unique index reasonably well) — but it's still one fully avoidable extra round trip on the hottest write path in the module, every time, forever.

**Recommended fix:** either cache the reconciled "floor" value in-process after the first successful call per year (it can't decrease), or move the reconciliation to a one-time startup/migration check rather than a per-request cost.

### 3.5 🟡 MEDIUM — Clinical timeline descriptions are reconstructed via regex-parsing free text instead of a stored reference

**Where:** `patient.repository.ts:534-626` (`buildHistoricalConsultationDescriptions`)

When `listTimeline()` is called with `clinical_only: true`, for every `OPD_CONSULTATION_COMPLETED` event on the current page, the code does this to recover which visit the event refers to:

```ts
const visitNumber = event.description?.match(/\bOPD-\d{4}-\d+\b/)?.[0];
```

— extracting a visit number by **regex-matching it out of a human-readable description string** that was itself only ever meant for display, then using that extracted value to look up the real `OpdVisit` document, and from there running **six more parallel queries** across OPD sub-collections (consultations, prescriptions, clinical orders, dental exams, follow-ups, referrals) to reconstruct a detailed description retroactively, every time the timeline is viewed.

**Why it matters:** this works today only because the description text happens to always contain a well-formed `OPD-YYYY-NNNNN` substring. It is not a real foreign-key relationship — it's a string-parsing join. Any future change to how that description is worded (a copy edit, a localization pass, a template change) silently breaks this with no error raised anywhere — consultation details would simply stop appearing in the clinical timeline, with no exception, no log, nothing to point at the cause. It's also real, repeated DB cost (up to 7 extra queries) paid on every timeline view, for information that was already fully known at the moment the consultation was originally completed.

**Recommended fix:** when an `OPD_CONSULTATION_COMPLETED` (and the other clinically-relevant) timeline event is first created, store the resolved `visitId` directly on the timeline event document (add the field to `PatientTimelineEventFields`) and, ideally, write the already-composed rich description at that time too, rather than reconstructing it from six joined collections on every read. This removes both the fragility and the per-view query cost.

### 3.6 🟢 LOW — Inconsistent phone validation between create and update

**Where:** `patient.service.ts:166-176` (`create`, strict — if buggy — validation) vs. `:209-239` (`update`, no phone format validation at all)

`create()` requires a phone number and runs it through `isValidAfricanPhone` (§3.1). `update()` accepts a `phone` field change (`:224-226`, which even triggers `syncPortalOwnerPhone`) with **zero format validation** — any string passes. Once §3.1 is fixed, this inconsistency should be fixed alongside it: whatever the correct phone validation becomes, it should apply uniformly on both the create and update paths, not just one.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| `date_of_birth` is a parseable date | ✅ | `isValidDate`, both create and update | None |
| `phone` format on create | ⚠️ broken | `isValidAfricanPhone` | §3.1 |
| `phone` format on update | ❌ | — | §3.6 |
| `gender` enum | ✅ | Fastify schema | None |
| Duplicate patient (name+DOB or phone) | ⚠️ works, but unindexed | `findDuplicateCandidates` | §3.3 |
| `registration_branch_id` required & authorized | ✅ | `create()` derives/validates via `resolveBranchScope` | None |
| Unexpected body fields | ✅ | `additionalProperties: false` on schemas | None |
| `visit_id`/`admission_id`/`procedure_id` shape on document queries | ✅ | `Types.ObjectId.isValid(...)` checks in `listDocuments` | None |
| Profile photo MIME type / size | ✅ | `uploadProfilePhotoFile` | None |
| Orphaned storage file on failed document-metadata write | ✅ handled | `uploadDocumentForPortal`'s catch-and-cleanup | See §4.4 below for the remaining gap |

### 4.4 Note on the upload-then-write pattern's remaining gap (not a new numbered finding, a refinement of a positive)

The cleanup-on-failure in `uploadDocumentForPortal` only covers the case where the *document metadata write* fails after a *successful* upload. It does not (and structurally can't, without a saga/outbox pattern) handle the reverse: if the process crashes or the connection drops **after** the DB write succeeds but **before** the response is returned, or if the storage upload itself succeeds but the process is killed before the `try` block's metadata-create call even starts, there's no reconciliation job that would ever notice and clean up an orphaned file. This is a common, generally-acceptable tradeoff for this class of system (the orphan is a storage-cost leak, not a data-integrity problem — the patient never sees a broken reference), not something to fix urgently, but worth knowing about if storage costs are ever audited.

---

## 5. MongoDB index audit

**Collection: `patients`**

| Index | Used by | Assessment |
|---|---|---|
| `{ firstName: 1, lastName: 1 }` | Not actually targeted by any current query shape (searches use `$or` regex, not an exact compound match) | Likely dead weight as currently written — see below |
| `{ phone: 1 }` | Partially — only helps exact-match lookups, not the regex-based search/duplicate-check paths that actually query phone | Limited value given how phone is actually queried |
| `{ email: 1 }` | Same limitation as `phone` | Limited value |
| `{ status: 1 }` | Helps `status` filter alone, but `status` is never queried without `deletedAt` also in the filter, so a standalone index here is rarely usable on its own | Should be folded into a compound index with `deletedAt` |
| **Missing**: anything containing `deletedAt` | Every single read in this module | §3.2 — the highest-priority fix in this review |
| **Missing**: anything containing `registrationBranchId` | Every branch-scoped read/write | §3.2 |

**Collection: `patient_documents`** — by contrast, this one is well-indexed: `{patientId,status}`, `{patientId,visitId,status,createdAt}`, `{patientId,admissionId,status,createdAt}`, `{patientId,consentTemplateId,contextType,contextId,status}`, `{documentType}`, `{reviewStatus,source,createdAt}`, `{patientId,contextType,contextId,status}` — a thorough, query-shape-aware set, comparable to the best examples seen elsewhere in this series (e.g. `departments`' compound indexes). Worth noting the contrast: whoever indexed `patient_documents` clearly thought carefully about real query patterns; the core `patients` collection sitting right next to it did not get the same treatment.

**Collection: `patient_timeline_events`** — `{patientId,occurredAt:-1}` and `{patientId,eventType,occurredAt:-1}` — correctly shaped for `listTimeline()`'s actual filter/sort combination. No issues.

---

## 6. API performance & round-trip analysis

Representative endpoints, sequential round-trip counts (excluding the shared 4-round-trip auth/permission chain documented in `branches` §3.2 and `auth-rbac` §4.2, which applies identically here):

| Endpoint | Handler-level sequential round trips | Notes |
|---|---|---|
| `GET /api/patients` (list) | 3 (`list`+`countDocuments` parallel = 1, then photo batch lookup = 1, plus `resolveBranchScope` = 1) | Reasonable; the real cost here is query efficiency (§3.2), not round-trip count |
| `GET /api/patients/:id` | 3 (`resolveBranchScope`, `getById`, photo lookup) | |
| `POST /api/patients` (create) | ~7 (`findUserById`, `resolveBranchScope`, `findDuplicateCandidates`, `findLatestPatientNumber`, `allocatePatientNumberCounter`, `create`, `addTimelineEvent`) | The two patient-number steps (§3.4) and the duplicate check (§3.3) are the avoidable ones here |
| `GET /api/patients/:id/timeline?clinical_only=true` | 3 baseline + up to 7 more per page when any `OPD_CONSULTATION_COMPLETED` events are present (§3.5) | The variable, data-dependent cost here is the standout risk — a page full of consultation events costs meaningfully more than a page without any |

Given the real measured ~25-30ms per round trip against the actual Mumbai Mongo cluster (from this series' infrastructure finding), the `clinical_only` timeline view's worst case (~10 round trips) is already approaching ~250-300ms from round trips alone, before considering the region-mismatch risk flagged separately — this is worth keeping in mind as a candidate for real load testing once that's set up (§7).

---

## 7. Load testing (p65/p90) — gap and reasoning for not closing it this pass

Unlike the `branches`/`departments` reviews, read-only access to a real database (SIT) is now available and was used in this series' infrastructure finding. I deliberately did not reuse it here: `patients` holds real patient data (names, dates of birth, phone numbers, addresses — PII in a healthcare context), and "read-only" doesn't fully neutralize the judgment call of running exploratory or load-generating queries against it without first confirming that's acceptable to you, separately from the acceptable-use decision already made for the schema/reference-table modules. This is flagged as an open question rather than decided unilaterally.

**What I'd want before running load tests here:** either (a) explicit confirmation that read-only query timing against the real `patients` collection in SIT is fine, or (b) a synthetic dataset seeded into the local ephemeral-MongoDB harness built for the `auth-rbac` review, sized to approximate realistic patient volumes, so load characteristics (especially around §3.2's missing index) can be demonstrated without touching real data at all. Option (b) is probably the better path regardless of (a), since it would let me actually demonstrate the *before/after* effect of the missing-index fix with a controlled, repeatable dataset size — something a one-off read against SIT's current (likely much smaller, non-representative) data volume wouldn't show convincingly anyway.

---

## 8. Scalability & dynamic-approach recommendations

- **The missing `deletedAt`-leading index (§3.2) is the single most important scalability fix in this entire review series so far** — not because it's the most severe bug, but because `patients` is the one collection in the whole system guaranteed to keep growing for the lifetime of the hospital's operation, with no natural ceiling the way `branches`/`departments`/`roles` have. A query-shape mistake here costs more every single day it's left unfixed, unlike almost every other finding in this series.
- **Fix the duplicate-detection and patient-number allocation costs (§3.3, §3.4) together with the index fix**, since both compound the same problem: they run on the hottest write path (every new registration) against the fastest-growing collection in the system. The `doctors` module's `ensureDoctorNumberSequence` pattern (one-time reconciliation via a cheap existence check, rather than a scan on every call) is a ready-made, already-proven-out fix for §3.4 specifically.
- **Replace the regex-parsed timeline-description reconstruction (§3.5) with a write-time stored reference** — beyond fixing its fragility, this is a scalability win in its own right: it trades a read-time cost that scales with how often the timeline is viewed for a write-time cost that's paid once, when the information is first known.
- **Treat the phone-validation bug (§3.1) as a reminder to audit other market-specific assumptions dynamically** — this finding, combined with the `doctors`/`settings`/`billing` findings documented in `code-review/_infrastructure/market-localization-mismatch.md`, suggests the system would benefit from centralizing market-specific logic (phone formats, currency, timezone) behind one configuration-driven boundary rather than having each module independently decide what "valid" or "default" means.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Fix or replace `isValidAfricanPhone` with market-correct phone validation, applied consistently on both create and update (§3.1, §3.6). **Highest priority — this is an active, user-facing broken feature.**
- [ ] Add a `{ deletedAt, status, registrationBranchId, createdAt }`-shaped compound index to the `patients` collection (§3.2). **Second priority — scales with data growth, unlike most findings in this series.**
- [ ] Apply a case-insensitive collation (or normalized shadow field) for the name-matching portion of duplicate detection, following the same recommendation made for `code` fields in `branches`/`departments`/`roles` (§3.3).
- [ ] Cache or one-time-reconcile the patient-number "existing maximum" lookup instead of running it on every creation (§3.4).
- [ ] Store a real `visitId` (and ideally the composed description) on clinically-relevant timeline events at write time, instead of regex-parsing it back out of free text on every read (§3.5).
- [ ] Decide on an approach for load-testing this module that doesn't touch real patient data without explicit sign-off — either confirm SIT read-only use is fine, or seed a synthetic dataset into the local harness (§7).
- [ ] Re-run this review's "what breaks" check once §3.1 is fixed, specifically confirming existing production patient records that *did* get stored with a bare 8-12-digit phone (the "too loose" side of the bug) aren't silently malformed in ways that matter for SMS/notification delivery elsewhere in the system (`patient-portal`'s OTP delivery, in particular, depends on phone format correctness and would be a good follow-on check).

---

## 10. Verdict

**Not production-ready, and for a different reason than the previous modules in this series**: the issues here aren't primarily architectural fragility or missing caching — they're one confirmed broken feature (§3.1) sitting on top of one real scalability time-bomb (§3.2) in the single collection most likely to grow large enough for that time-bomb to matter. The good engineering in this module (the atomic sequence counter, the consistent batched-lookup pattern) shows the team knows how to do this well when they're paying attention — the phone validation bug in particular reads like something that shipped once, worked in whatever environment it was first written for, and was never revisited once the project's actual target market became clear.
