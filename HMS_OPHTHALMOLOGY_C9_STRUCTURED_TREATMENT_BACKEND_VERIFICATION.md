# HMS Ophthalmology C9 Structured Treatment Plan Backend Verification

## Status

**COMPLETE — 22 October 2026.** C9 backend implementation and automated verification are complete against Ophthalmology API contract 2.0.0. C10 frontend implementation has not started.

## Implemented and reused

- Replaced free-text treatment-plan `category` writes with required `action_type`: `MEDICATION | OPTICAL | INVESTIGATION | PROCEDURE | REFERRAL | FOLLOW_UP | OTHER`.
- Enforced the exactly matching authoritative reference for each action; `OTHER` permits narrative treatment only.
- Added optical-prescription treatment linkage and patient/visit/branch/department scope validation.
- Reused shared medication prescription, clinical order, procedure recommendation, referral, follow-up, diagnosis, optical prescription, clinical-review versioning, transaction, doctor identity, audit and completion infrastructure.
- Revalidated action semantics, diagnosis/laterality/status and downstream scope during draft save, controlled correction, readiness, and completion.
- Blocked `PLANNED`/`ACTIVE` treatment against `RULED_OUT` diagnosis while preserving completed/cancelled history.
- Preserved historical category-only storage as read-only `legacy_category` with `action_type: null`; no automatic clinical classification or data migration was introduced.
- Updated patient-safe publication projection to expose `action_type`, or `legacy_category` for old snapshots, without internal downstream IDs.

## Files and shared surfaces changed

- Ophthalmology treatment types, strict schemas, review model, repository, service and controlled-correction schema.
- Ophthalmology patient-safe publication projection and its focused test.
- Existing Phase 8 and Phase 9 focused tests.
- API contract, Phase 0 alignment matrix, workflow traceability, Developer A prompt, C9 gap note and this verification record.
- No frontend source, shared-domain model, permission seed, route/service registry, or `scope/HMS Local` prototype was changed.

## Backend safeguards

- Permission and active-doctor behavior reuse the existing `Ophthalmology Consultation / Diagnose` boundary.
- Patient, encounter, branch and applicable department scope are authoritative; frontend identifiers are never trusted without repository validation.
- Clinical review versioning, expected-version conflicts, MongoDB transactions and audit rollback remain in force.
- New writes store `actionType` and clear the legacy category field. Existing stored category values remain intact and readable.
- Errors added: `OPHTHALMOLOGY_TREATMENT_ACTION_TYPE_REQUIRED`, `OPHTHALMOLOGY_TREATMENT_REFERENCE_REQUIRED`, `OPHTHALMOLOGY_TREATMENT_REFERENCE_CONFLICT`, and `OPHTHALMOLOGY_RULED_OUT_DIAGNOSIS_ACTIVE_TREATMENT`; existing diagnosis/reference/version/scope errors remain applicable.

## Automated verification

| Check | Result |
|---|---|
| `npm test --workspace=@hms/api -- src/modules/ophthalmology/ophthalmology-public-payload.test.ts src/modules/ophthalmology/ophthalmology.phase8.test.ts src/modules/ophthalmology/ophthalmology.phase9.test.ts` | PASS — 3 files, 33 tests |
| `npm run typecheck --workspace=@hms/api` | PASS |
| `npm run build --workspace=@hms/api` | PASS |
| Focused ESLint over all C9-owned TypeScript files | PASS |
| `npm run typecheck --workspace=@hms/web` | PASS |
| `npm run build --workspace=@hms/web` | PASS |
| `git diff --check` | PASS |

Repository-wide lint was run and remains blocked only by unrelated, pre-existing files:

- API: 50 errors in `insurance.repository.ts`, `insurance.service.ts`, `insurance.test.ts`, and `patient.service.ts`.
- Web: 18 errors in unchanged doctor, patient, shared media, appointment, workspace and user-management files. The only named Ophthalmology file is the unchanged `OphthalmologyWorkspacePage.tsx` unused intake import; C9 did not modify frontend source.

The C9-owned TypeScript file set passes ESLint with zero findings, which proves the phase changes did not add lint violations.

## Manual and release conditions

- No browser workflow was run because C9 is backend-only and C10 owns the frontend action editor/integration.
- The previously deferred live GCS smoke test and broader interactive multi-role/multi-branch release acceptance remain unchanged and are not C9 treatment-contract blockers.

## Next dependency and stop gate

C10 must migrate the treatment-plan frontend to API contract 2.0.0, provide action-specific live record selection, submit only the matching reference, render legacy rows as requiring explicit classification, and handle the documented validation/conflict states. **C10 has not started.**
