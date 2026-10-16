# HMS Ophthalmology OPD Phase 9 Gap Note

**Date:** 15 October 2026  
**Phase:** 9 - Clinical review completion amendment and summary  
**Status:** COMPLETE

## Approved scope and FSD references

Phase 9 implements FSD sections 11.1, 12.2-12.3, 13, 14.1, 15, and 16.1-16.2; Tables 32, 37-39, and 43; alignment requirements OPH-REV-07, OPH-INT-03, and OPH-LIF-01 through OPH-LIF-07; and approved DEC-05 through DEC-09. It adds exact-version result review, configured completion readiness, documented result deferral, explicit override, authenticated doctor approval, atomic completion, append-only reopening/amendment episodes, and final summary/history reads.

## Existing functionality reused

- Phase 1 atomic OPD consultation/visit/appointment/timeline completion foundations and optimistic version checks.
- Phases 2-8 Ophthalmology context lifecycle, branch-scoped `COMPLETION_PROFILE` configuration type, intake/alerts, tasks/results, clinical review, optical prescription, doctor validation, transactions, audit, and doctor-review projection.
- Existing Patient timeline, Appointment, OPD Visit, OPD Consultation, medication prescription, clinical order, referral, follow-up, procedure recommendation, and optical-prescription records remain authoritative.
- Existing permissions: `Ophthalmology Test Review / Review` and `Ophthalmology Consultation / Complete`, `Override`, `Reopen`, and `Amend`. No permission seed expansion is required.
- HMS Local patient header, tabbed clinical workspace, sticky summary, explicit completion modal, return-to-queue behavior, status badges, and confirmation patterns. Prototype state and `localStorage` are not production sources.

## Missing contracts dependencies and stop boundaries

1. `doc/HMS_Release2_FSD.docx` remains absent. The approved Ophthalmology FSD and DEC-01 through DEC-12 remain the controlling specialty contract.
2. Hospital-approved production completion rules remain a DEC-06 configuration dependency. Phase 9 implements and validates the structural `COMPLETION_PROFILE` contract but does not seed or infer a clinical profile. Missing, ambiguous, duplicate, inactive, or malformed matching profiles return `OPHTHALMOLOGY_CONFIGURATION_REQUIRED`.
3. Portal publication/republishing, billing/pharmacy/procedure triggers, external delivery, and compensation remain Phase 10. Phase 9 records final local approval and timeline/audit state only.
4. Digital approval is an authenticated server event with linked active doctor, timestamp, exact consultation version, and audit record. It is not represented as a cryptographic/e-signature compliance claim.
5. A deferral records a task/result or shared clinical-order reference, reason, due date or review plan, and responsible active Ophthalmology doctor. It does not mark a result reviewed.
6. An override requires the dedicated permission, a reason, and an exact snapshot of current unmet prerequisites. It does not silently satisfy or mutate the underlying clinical records.
7. Reopening creates an amendment episode and never unlocks or overwrites a completed OPD consultation or prior specialty completion version. Amendments append before/after values and require a new approval before the specialty record returns to completed state.

## Frozen Phase 9 contracts

- Supported configured requirement codes are structural only: `INTAKE_COMPLETED`, `MANDATORY_TESTS_REVIEWED`, `ALL_RESULTS_RESOLVED`, `ALERTS_ACKNOWLEDGED`, `DIAGNOSIS_RECORDED`, `CLINICAL_REVIEW_RECORDED`, `TREATMENT_PLAN_RECORDED`, `OPTICAL_APPROVED_IF_PRESENT`, and `FOLLOW_UP_DECISION_RECORDED`. A profile lists the applicable subset and any mandatory test codes.
- Exactly one active branch completion profile must match the context visit subtype through `values.visit_subtypes`. Its ID, revision, and full values are snapshotted on each completion version.
- Result review changes one exact completed task/result clinical version to `REVIEWED`, storing reviewer, review time, decision/comment, transition history, and audit.
- One consultation-finalization head exists per visit. It contains append-only deferrals, overrides, completion versions, and amendment episodes; its mutable head is protected by expected status/version conditions.
- Completion accepts an idempotency key and exact context, OPD consultation, clinical-review, and optional optical-prescription versions. The same key/fingerprint returns the prior outcome; a reused key with different input is rejected.
- Initial completion atomically finalizes the Ophthalmology head, clinical review, context, OPD consultation, OPD visit, linked appointment when present, Patient timeline event, and audit event. Amendment re-approval appends a new specialty completion version without mutating the original OPD-finalized record.
- Summary/history responses return safe, scoped, versioned records and amendment metadata. Internal unverified result payloads and restricted document bodies are not exposed.

## Intended files and shared changes

- Add `ophthalmology-consultation.model.ts` for finalization, deferral, override, approval, and amendment history.
- Extend Ophthalmology types, schemas, repository, service, and routes.
- Minimally extend Ophthalmology task review metadata/transition history and Phase 8 clinical-review follow-up decision/status.
- Extend the service-registry construction to inject existing OPD Consultation, Appointment, and Patient repositories for the atomic shared finalization transaction.
- Add `ophthalmology.phase9.test.ts`.
- Update the Developer A prompt, Phase 0 alignment matrix, API contract, this gap note, and add Phase 9 verification.
- Do not change frontend files, prototype files, clinical permission grants, portal publication, finance calculations, or generated artifacts.

## Data indexes permission transition transaction audit and errors

- Unique finalization head per visit; indexed patient/branch/status/update fields; unique completion idempotency key within context.
- Explicit transitions: task `COMPLETED -> REVIEWED`; context `CLINICAL_REVIEW|REVIEW_COMPLETED -> CONSULTATION_COMPLETED`; finalization `OPEN -> COMPLETED -> AMENDMENT_OPEN -> COMPLETED`.
- All mutations revalidate patient, visit, branch, department, active doctor, permission middleware, resource state, and expected versions. Multi-document changes use the existing required transaction helper.
- Audit metadata records safe IDs, versions, statuses, requirement codes, reason presence, and before/after references; it excludes full clinical notes/result payloads.
- Explicit errors cover missing/malformed completion configuration, incomplete prerequisites, stale status/version, mismatched references, unauthorized doctor, missing deferral plan, invalid override snapshot, duplicate/idempotency conflict, finalized writes, and amendment state conflicts.

## Acceptance design

- Readiness returns configured satisfied/unmet items and exact resource versions.
- Review validates task/result/version/scope and rejects duplicate or stale review.
- Deferral validates same encounter/patient resources, reason, plan/due date, and responsible clinician.
- Completion blocks incomplete records, permits exact-snapshot authorized override, succeeds atomically and idempotently, rejects unauthorized/concurrent/stale requests, locks final state, and rolls back on audit/timeline failure.
- Reopen preserves completed versions; amendment preserves before/after/reason/actor/time and requires re-approval.
- Summary/history remain scoped and expose the current approved version plus immutable history.
- Focused tests cover incomplete, success, duplicate, concurrent, unauthorized, rollback, reopen, amendment, and audit behavior plus OPD/Ophthalmology regressions.

## Stop gate

After Phase 9 verification and documentation are complete, stop. Do not begin Phase 10 without explicit owner approval.
