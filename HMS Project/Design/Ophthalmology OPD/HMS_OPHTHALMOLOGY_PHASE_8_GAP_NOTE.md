# HMS Ophthalmology OPD Phase 8 Gap Note

**Date:** 15 October 2026  
**Phase:** 8 - Doctor review diagnosis treatment and prescriptions  
**Status:** COMPLETE

## Approved scope

Phase 8 implements FSD sections 10.1 through 10.4 and Tables 32 through 35. It adds a permission-scoped consolidated doctor-review projection, minimally extends the authoritative OPD diagnosis contract with Ophthalmology clinical attributes and history, persists structured Ophthalmology treatment plans, integrates existing shared-domain records by reference, and creates a separate versioned optical-prescription resource with authenticated approval.

## Existing functionality reused

- Ophthalmology context, intake, alerts, test tasks, current/versioned results, branch and department scope, transactions, audit, and workflow configuration from Phases 1 through 7.
- Existing OPD consultation as the authoritative diagnosis and narrative-assessment resource.
- Existing OPD medication prescription and pharmacy flow as the authoritative medication-prescription resource.
- Existing OPD clinical-order, referral, follow-up, Surgery/Procedure recommendation, Patient, and Patient Document resources.
- Existing `Ophthalmology Consultation` permissions: `View`, `Edit`, `Diagnose`, and `Prescribe`. No permission seed expansion is required.
- HMS Local OPD consultation tabs, patient header, diagnosis chips, prescription builder, referral and follow-up patterns. Prototype data and `localStorage` are not production sources and no prototype file will be modified.

## Missing contracts and explicit boundaries

1. `doc/HMS_Release2_FSD.docx` remains absent. The root release document is unrelated to Ophthalmology; the supplied Ophthalmology FSD and approved DEC-01 through DEC-12 remain authoritative.
2. Production diagnosis terminology, condition-specific severity/stage values, optical lens/material/coating choices, treatment categories, and prescription validity rules remain DEC-06 configuration dependencies. Phase 8 validates configured values when provided and does not seed clinical defaults.
3. Diagnosis remains owned by the existing OPD consultation. Phase 8 extends its diagnosis item and preserves prior diagnosis/treatment state; it does not create a second diagnosis master or diagnosis collection.
4. Medication prescriptions remain owned by the existing OPD prescription/pharmacy endpoints. The doctor-review projection exposes their current state and structured treatment plans may reference them; Ophthalmology does not duplicate medication rows.
5. Laboratory, imaging, procedure/surgery, referral, and follow-up creation remains in their existing modules. Phase 8 reads and validates visit/patient-scoped references only. Final retry/compensation and publication integration remains Phase 10.
6. Phase 8 optical approval is an authenticated authorization event on an exact draft version. Consultation-completion approval, result acknowledgement/deferral/override, reopening, and cross-resource completion remain Phase 9.
7. Print/share in Phase 8 means an approved, structured, permission-scoped read suitable for the existing print/UI layer. Portal publication and external delivery remain Phase 10.

## Frozen Phase 8 design

- Extend each OPD diagnosis with optional Ophthalmology fields: `laterality`, `status`, `severity`, `stage`, and `differential`; require exactly one primary diagnosis when diagnoses are supplied, prevent duplicate code/laterality/status rows, and require laterality/status for Ophthalmology visits.
- Preserve diagnosis/treatment state snapshots with actor, timestamp, and prior consultation version before a changed draft overwrites current values.
- Persist one Ophthalmology clinical-review draft per visit. Its versions contain clinical summary and structured treatment plans linked to authoritative diagnosis code/laterality, treatment text, configured category, priority, status, clinician, and optional shared-resource references.
- The doctor-review projection returns patient/visit/intake context, current consultation and diagnosis history, current and historical test results, abnormal/review flags, current shared medication/order/procedure/referral/follow-up records, clinical-review versions, and optical-prescription state. Historical test comparison is limited to the same patient and branch and remains eye/form/version explicit.
- Persist one optical-prescription head per visit with append-only versions. Draft save requires task/consultation context, signed OD/OS power, structural axis rules, PD format, configured optical choices, instructions and validity. Approval records authenticated approver/time and locks the exact version.
- Every mutation uses expected versions, branch/department/encounter scope, transactions, audit events, and conditional updates. Approved optical prescriptions are immutable in Phase 8.

## Intended files

- Extend shared OPD consultation types, model, schema, repository, service, and focused diagnosis tests.
- Add Ophthalmology clinical-review and optical-prescription models.
- Extend Ophthalmology types, schemas, repository, service, routes, and service-registry construction.
- Add `apps/api/src/modules/ophthalmology/ophthalmology.phase8.test.ts`.
- Update API contract version, Phase 0 alignment matrix, Developer A prompt, this gap note, and add Phase 8 verification.
- Do not change frontend files, permission seeds, shared downstream service behavior, generated artifacts, or `scope/HMS Local`.

## Data indexes and safety

- Unique active head per visit for clinical review and optical prescription.
- Indexed patient/branch/update fields for historical review.
- Conditional version/status writes prevent stale draft and approval updates.
- Cross-patient, cross-visit, cross-branch, wrong-eye, duplicate-primary, duplicate-diagnosis, unconfigured-value, and wrong-resource references return explicit safe errors.
- Review projections use bounded indexed queries and projections; they do not load full collections or expose restricted patient-document bodies.

## Acceptance checks

- Consolidated current/historical read returns only the correct patient, branch, visit, eye, and authorized shared records.
- Diagnosis extensions, one-primary rule, duplicate prevention, status-history preservation, and stale updates.
- Structured treatment-plan linkage, configured options, shared-resource source-of-truth checks, and audit.
- Optical draft, exact-version approval, immutable approved state, laterality/axis/PD/conditional/configuration validation, unauthorized approval, concurrent approval, rollback, and audit.
- Existing OPD diagnosis and medication-prescription regressions remain passing.
- API/web typecheck, lint, build, focused tests, and full API regression are recorded.

## Stop gate

After Phase 8 verification and documentation are complete, stop. Do not begin Phase 9 without explicit owner approval.
