# HMS Ophthalmology OPD - Phase 1 Verification

**Date:** 15 October 2026  
**Phase:** 1 - Shared OPD contract hardening  
**Status:** COMPLETE - AWAITING EXPLICIT PHASE 2 APPROVAL

## Implemented functionality

- Removed the generic billing-service fallback from laboratory and imaging order validation. Every item must now resolve to an active service of the requested clinical type.
- Permitted authorized clinical-order submission while the linked consultation is still open/draft.
- Added additive `version` response fields and optional `expected_version` / `expected_status` mutation preconditions for visits, consultations, and clinical orders.
- Added repository compare-and-set guards for legacy callers that omit preconditions, including duplicate-create conflict translation.
- Added conditional OPD visit status updates so consultation workflows reject stale visit transitions.
- Made consultation draft transition, consultation completion, and clinical-order submission atomic across participating records.
- Added a required-transaction helper that returns `503 TRANSACTION_CAPABILITY_REQUIRED` instead of silently degrading safety-critical writes on unsupported MongoDB deployments.
- Included patient timeline and clinical audit writes in the same transaction; audit metadata records previous/resulting status and version.
- Preserved existing route paths, response envelope, permissions, branch scoping, and legacy request-body compatibility.

## Existing functionality reused

- OPD visit, consultation, clinical-order, appointment, patient timeline, audit, service-catalogue, permission, and branch-scope foundations.
- Existing MongoDB/Mongoose session support and repository/service architecture.
- Existing `OPD Clinical Orders` and `OPD Consultation` route permission gates.
- Existing General OPD and Dental shared contracts; no specialty-only route was introduced.

## Files and modules changed

### OPD shared backend

- `apps/api/src/modules/opd/opd-clinical-order.model.ts`
- `apps/api/src/modules/opd/opd-clinical-order.repository.ts`
- `apps/api/src/modules/opd/opd-clinical-order.schemas.ts`
- `apps/api/src/modules/opd/opd-clinical-order.service.ts`
- `apps/api/src/modules/opd/opd-clinical-order.types.ts`
- `apps/api/src/modules/opd/opd-consultation.model.ts`
- `apps/api/src/modules/opd/opd-consultation.repository.ts`
- `apps/api/src/modules/opd/opd-consultation.schemas.ts`
- `apps/api/src/modules/opd/opd-consultation.service.ts`
- `apps/api/src/modules/opd/opd-consultation.types.ts`
- `apps/api/src/modules/opd/opd-visit.model.ts`
- `apps/api/src/modules/opd/opd-visit.schemas.ts`
- `apps/api/src/modules/opd/opd-visit.repository.ts`
- `apps/api/src/modules/opd/opd-visit.service.ts`
- `apps/api/src/modules/opd/opd-visit.types.ts`
- `apps/api/src/modules/opd/opd-vitals.service.ts`
- `apps/api/src/modules/opd/opd-prescription.service.ts`
- `apps/api/src/modules/opd/opd-phase1-hardening.test.ts`

### Shared files

- `apps/api/src/modules/patients/patient.repository.ts` - additive optional audit session.
- `apps/api/src/modules/appointments/appointment.repository.ts` - additive optional read session for atomic visit completion.
- `apps/api/src/shared/database/transaction.ts` - additive required-transaction helper; the legacy permissive helper remains unchanged.

### Phase records

- `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md`
- `HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX.md`
- `HMS_OPHTHALMOLOGY_PHASE_1_GAP_NOTE.md`
- `HMS_OPHTHALMOLOGY_PHASE_1_VERIFICATION.md`
- `HMS_Ophthalmology_OPD_Developer_A_Backend_Prompts.md`

## Backend validation, transaction, permission, scope, audit, and errors

- Typed service validation rejects wrong-type or inactive services with `INVALID_CLINICAL_ORDER_SERVICE`.
- Stale consultation writes return `409 OPD_CONSULTATION_VERSION_CONFLICT` or `409 OPD_CONSULTATION_STATUS_CONFLICT`.
- Stale clinical-order writes return `409 CLINICAL_ORDER_VERSION_CONFLICT` or `409 CLINICAL_ORDER_STATUS_CONFLICT`.
- Stale visit completion returns `409 OPD_VISIT_STATUS_CONFLICT`; a missing linked appointment returns `409 OPD_APPOINTMENT_CONFLICT` and rolls back the transaction.
- Unsupported transaction capability returns `503 TRANSACTION_CAPABILITY_REQUIRED` with no non-transactional retry.
- Existing backend permission middleware and database-derived branch scope remain authoritative and unchanged.
- Timeline and audit records commit or roll back with the clinical mutation and contain safe identifiers/state metadata rather than clinical payloads.

## HMS Local UI patterns reused

No frontend screen was changed in this backend-only foundation phase. Existing OPD UI contracts and routes remain compatible.

## Automated checks and manual tests

### Passed

- `npm run typecheck --workspace=@hms/api`
- `npm run build --workspace=@hms/api`
- Phase-owned API ESLint invocation covering every changed TypeScript file.
- `npm run typecheck --workspace=@hms/web`
- `npm run build --workspace=@hms/web` (800 modules transformed).
- Focused/regression Vitest run: 4 files, 15 tests passed after final visit-concurrency and authorization coverage was added.
- Tests cover version increments, stale consultation/order writes, wrong service type, ordering during a draft consultation, branch-scope denial, transaction rollback, structured diagnoses, OPD dashboard summaries, and clinical-context indexes.
- `git diff --check` reports no Phase 1 whitespace errors.

### Pre-existing unrelated repository lint failures

- Full API lint remains blocked by 42 pre-existing Insurance errors: one unused import in `insurance.repository.ts`, 18 explicit-`any` errors in `insurance.service.ts`, and 23 explicit-`any` errors in `insurance.test.ts`.
- Full web lint remains blocked by five pre-existing Patient/UI errors: explicit `any` in `PatientAvatar.test.tsx` and `AuthenticatedMediaImage.tsx`, plus unused `patientInitials` imports/variables in `PatientCardModal.tsx`, `PatientProfileHeader.tsx`, and `PatientProfilePage.tsx`.
- No lint error is in a Phase 1-owned file. These unrelated files were not modified.

No UI was implemented in Phase 1, so responsive browser workflow testing is not applicable. Backend success, failure, authorization/scope, concurrency, transaction rollback, and compatibility behavior were exercised through focused integration/unit tests.

## Remaining dependency or clarification for Phase 2

- Phase 2 must use the approved DEC-02 subtype mapping, DEC-03 laterality contract, DEC-06 versioned branch configuration structure, DEC-07 permission inventory, and DEC-12 station/workflow/test-assignment model.
- Clinical master values that remain `PENDING CONFIGURATION` must not be invented.
- Phase 2 must begin with a fresh gap note and exact context/configuration request-response schemas.

## Stop confirmation

Phase 2 has not started. Work is stopped at the phase gate pending explicit owner approval.
