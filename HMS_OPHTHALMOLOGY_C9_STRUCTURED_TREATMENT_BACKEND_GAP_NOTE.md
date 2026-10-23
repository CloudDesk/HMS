# HMS Ophthalmology C9 Structured Treatment Plan Backend Gap Note

## Phase authority

The project owner explicitly approved implementation of C9 on 22 October 2026 after reviewing the current diagnosis and treatment-plan flow. C9 is limited to the backend treatment-plan contract and its verification. Frontend action creation and selection remain the next separately approved phase.

The controlling requirements are Ophthalmology FSD v1.0 sections 10.2, 10.4, 11, 14 and 16; Tables 33, 35, 36, 39 and 44; approved DEC-03, DEC-07, DEC-08 and DEC-09; and the owner-approved C9 clarification.

## Reusable implementation

- The shared OPD consultation remains the diagnosis source of truth, including diagnosis code, laterality and `SUSPECTED | CONFIRMED | RULED_OUT` status.
- `OphthalmologyClinicalReview` already provides append-only clinical versions, optimistic concurrency, transaction-required saves, doctor attribution and audit events.
- Medication prescriptions, clinical orders, procedure recommendations, referrals and follow-ups remain shared-domain records referenced by ID.
- The separate Ophthalmology optical prescription remains the optical source of truth.
- Consultation completion already revalidates current diagnosis and downstream references inside the finalization transaction.
- Existing `Ophthalmology Consultation / Diagnose` permission, active Ophthalmology doctor enforcement and encounter scope checks remain authoritative.

## Gaps to close

1. Treatment `category` is free text and does not encode a stable action contract.
2. Downstream references are optional and are not conditionally matched to the intended action.
3. Optical prescriptions cannot be referenced by a treatment action.
4. Planned or active treatment can currently target a diagnosis that has subsequently become `RULED_OUT`.
5. Diagnosis validation currently omits diagnosis status.
6. Completion revalidates scope references but does not reject legacy/unclassified action semantics.
7. Amendment validation mirrors the old free-text contract.

## Approved C9 contract

New and amended treatment-plan writes use required `action_type`:

- `MEDICATION`
- `OPTICAL`
- `INVESTIGATION`
- `PROCEDURE`
- `REFERRAL`
- `FOLLOW_UP`
- `OTHER`

The previous write field `category` is removed from the C9 request contract. Existing stored category values are retained only as `legacy_category` in historical reads. Historical rows expose `action_type: null`; they remain readable but must be explicitly classified through the controlled amendment path before reapproval or completion.

Reference rules are backend authoritative:

- `MEDICATION` requires exactly one `medication_prescription_id`.
- `OPTICAL` requires exactly one `optical_prescription_id`.
- `INVESTIGATION` requires one or more unique `clinical_order_ids`.
- `PROCEDURE` requires exactly one `procedure_recommendation_id`.
- `REFERRAL` requires exactly one `referral_id`.
- `FOLLOW_UP` requires exactly one `follow_up_id`.
- `OTHER` requires the existing non-empty treatment narrative and permits no downstream reference.
- A row cannot carry references belonging to another action type; related care is represented as another diagnosis-linked action row.

Every referenced record must resolve to the same authoritative patient, OPD visit/encounter, branch and department context. Shared records without their own department field inherit department scope only through the already validated authoritative OPD visit.

`PLANNED` and `ACTIVE` actions cannot reference a `RULED_OUT` diagnosis. `COMPLETED` and `CANCELLED` rows may remain for historical accuracy. If a diagnosis becomes ruled out after a plan is saved, completion must fail until every active/planned row is cancelled, completed or reassigned through an approved clinical edit/amendment.

## Compatibility and migration

This is an owner-approved breaking write-contract change and therefore advances the documented API contract to 2.0.0. No automatic clinical classification is permitted. Existing historical free-text categories are not mapped to an action type. Existing completed snapshots remain immutable; reopened or draft records require explicit clinician classification before they can be approved again.

C9 does not create, submit, approve, schedule, dispense or fulfil downstream shared records. It validates and links authoritative records only.

## Intended files

- `apps/api/src/modules/ophthalmology/ophthalmology.types.ts`
- `apps/api/src/modules/ophthalmology/ophthalmology.schemas.ts`
- `apps/api/src/modules/ophthalmology/ophthalmology-review.model.ts`
- `apps/api/src/modules/ophthalmology/ophthalmology.repository.ts`
- `apps/api/src/modules/ophthalmology/ophthalmology.service.ts`
- `apps/api/src/modules/ophthalmology/ophthalmology-clinical-correction.ts`
- `apps/api/src/modules/ophthalmology/ophthalmology-public-payload.ts`
- Focused Ophthalmology backend tests
- `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md`
- `HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX.md`
- `HMS_OPHTHALMOLOGY_WORKFLOW_TRACEABILITY.md`
- `HMS_Ophthalmology_OPD_Developer_A_Backend_Prompts.md`
- C9 verification documentation

No frontend file, shared-domain model, permission seed, router registry, service registry or HMS Local prototype will be changed in C9.

## Acceptance criteria

- Strict schemas reject missing, unknown or unsupported action types.
- Each action type requires only its matching authoritative reference.
- Optical references are persisted, projected and scope validated.
- Planned/active actions against ruled-out diagnoses are rejected on draft save, amendment and completion revalidation.
- Stale writes, transaction rollback, doctor permission, encounter scope and audit behavior remain intact.
- Historical free-text treatment versions remain readable without invented classification.
- API typecheck and build pass; focused treatment, completion and amendment tests pass; C9-owned files pass lint. Any unrelated repository-wide lint failure is recorded precisely.
- Web typecheck, lint and build are run to identify contract-adjacent regressions, without starting C10 frontend implementation.
