# HMS Ophthalmology OPD Phase 3 Gap Note

**Date:** 15 October 2026  
**Phase:** 3 - Triage, ophthalmic history, emergency screening, routing, and acknowledgement  
**Status:** COMPLETE - AWAITING PHASE 4 APPROVAL

## Approved scope

Phase 3 implements the backend intake aggregate for FSD sections 8.1-8.3 and the approved DEC-03, DEC-06, DEC-07, DEC-08, and DEC-10 rules. It includes draft persistence, completion validation, emergency alert creation, direct ophthalmologist routing, in-app notifications, acknowledgement, shared-history/document references, concurrency, audit, and read projections. Test queues, diagnostic results, abnormal IOP generation, consultation completion, uploads, frontend screens, and Phase 4+ workflows are excluded.

## Existing functionality reused

- Phase 2 Ophthalmology context, branch/department validation, configuration versions, workflow overlay, permissions, audit, and transaction infrastructure.
- Authoritative OPD consultation history/allergy text as a read-only shared projection; Phase 3 does not create a second allergy or general medical-history source of truth.
- Existing patient clinical documents. Intake stores validated document IDs for previous reports and does not duplicate files or storage metadata.
- Existing active doctor/user/role/permission records to derive routable ophthalmologists server-side.
- Existing notification service for transactional in-app notifications. It has no external delivery receipt contract, so Phase 3 records successful in-app persistence only and does not claim SMS, email, or push delivery.
- Existing HMS Local OPD history, clinical-alert, patient-summary, sticky action, and Emergency alert patterns were inspected for future frontend compatibility. Prototype files remain unchanged.

## Confirmed gaps

1. No structured Ophthalmology intake, complaint, ophthalmic-history, or emergency-screening record exists.
2. No versioned draft/completion lifecycle or one-intake-per-context index exists.
3. No specialty emergency alert, acknowledgement, or idempotent routing record exists.
4. No server-derived authorized ophthalmologist routing lookup exists.
5. Generic notifications do not track external delivery; only durable in-app notification creation is currently available.
6. Structured shared patient allergy/medical-history APIs do not exist. Existing OPD consultation fields can be reused read-only, but must not be silently promoted into a new patient-level source of truth.
7. Complaint and emergency criteria values are not seeded. Production completion must be gated by explicitly selected active `COMPLAINT` and `CLINICAL_THRESHOLD` configuration versions.
8. DEC-10 upload policy is not approved. Phase 3 can reference already-authorized patient clinical documents but cannot add a new upload path or invent file limits/types.

## Frozen Phase 3 contract

### Intake

- One intake per Ophthalmology context and OPD visit.
- Status is `DRAFT | COMPLETED`; completed content is immutable until the later approved amendment phase.
- Draft upsert requires `expected_version`: `null` for first creation and the current integer version for updates.
- Complaint fields cover configured complaint codes, context laterality, duration value/unit, onset, progression, optional severity, associated symptom codes, and description.
- Ophthalmic history covers no-significant-history, previous eye diseases, surgeries, current eye treatment, injury/laser, spectacle/contact-lens use, long-term steroid use, family history, and previous-report document references.
- Positive history details are structurally validated. `no_significant_ophthalmic_history` conflicts with positive ophthalmic history.
- Systemic history and allergies are read-only projections from the existing OPD consultation. Intake records only acknowledgement that those shared values were reviewed.
- Completion requires active branch-matching complaint and emergency configuration IDs supplied in the draft, validates every selected code against those exact versions, stores the configuration snapshots, and rejects missing/invalid clinical configuration.

### Emergency alerts and routing

- Selected configured emergency criteria create one `EMERGENCY_SCREENING` alert linked to the exact completed intake version.
- Alert status is `ACTIVE | ACKNOWLEDGED`. It records criteria, human-readable reason, source version, actor/time, notified user IDs, acknowledgement actor/time/note, and optimistic version.
- Alert creation never creates or changes a diagnosis.
- Routable recipients are active mapped doctors and active users in the same branch and Ophthalmology department whose active role grants `OPD / Ophthalmology Consultation / View`.
- Emergency completion fails safely if no eligible recipient exists. Intake remains a draft because completion, alert creation, workflow routing, notifications, and audit are one transaction.
- Direct routing moves eligible early workflow states to `AWAITING_DOCTOR`; it does not invent a new shared OPD visit status.
- Routing retries are idempotent and notify only eligible users not already recorded on the alert.
- Acknowledgement requires `Ophthalmology Intake / Escalate`, `expected_status=ACTIVE`, and `expected_version`. It records the exact alert version and does not alter clinical data.

## Intended files

- Extend the Phase 2 files under `apps/api/src/modules/ophthalmology/` with Phase 3 types, models, schemas, repository/service methods, routes, and focused tests.
- Minimally extend the existing internal notification service so transactional specialty notifications retain the authenticated actor.
- Update the API contract, execution status documents, and add a Phase 3 verification document after checks pass.
- No frontend or HMS Local file is in this phase.

## Index, transaction, and error plan

- Unique intake by `contextId` and `visitId`; branch/status/update indexes for future scoped reads.
- Unique alert by `contextId + type + sourceVersion`; branch/status/time indexes and recipient index.
- Draft updates, completion, routing, and acknowledgement use conditional expected-version/status filters.
- Completion atomically persists completed intake, workflow overlay, emergency alert when applicable, notifications, and audit.
- Routing and acknowledgement atomically persist their mutation, notifications where applicable, and audit.
- Use explicit configuration, scope, conditional-field, status, version, routing, document-reference, and not-found errors without returning clinical payloads in audit logs.

## Acceptance checks

- Draft create/update, duplicate prevention, stale versions, completed immutability, wrong context/branch/patient, and cross-patient documents.
- Missing/inactive/wrong-branch configuration, unknown complaint/emergency codes, mandatory complaint fields, no-history conflicts, and conditional details.
- Emergency creation without diagnosis, no-recipient rollback, eligible recipient routing, notification persistence, idempotent retry, bypass workflow mapping, acknowledgement permission contract, stale acknowledgement, and audit metadata.
- Read projection returns referenced shared history/allergy fields and document IDs without duplicating or overexposing patient data.
- Phase 2, shared OPD, General OPD, Dental, notification, typecheck, lint-owned-files, build, and full API regressions.

## Stop gate

Phase 4 must not start until Phase 3 implementation, focused tests, contract update, verification report, and owner approval are complete. Missing external notification delivery or upload policy must remain explicit dependencies rather than fabricated functionality.
