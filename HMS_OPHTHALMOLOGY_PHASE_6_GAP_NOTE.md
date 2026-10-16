# HMS Ophthalmology OPD Phase 6 Gap Note

**Date:** 15 October 2026  
**Phase:** 6 - Advanced diagnostic test results  
**Status:** COMPLETE - AWAITING PHASE 7 APPROVAL

## Approved scope

Phase 6 extends the Phase 5 result resource for Pachymetry, Colour Vision, Motility/Squint/Binocular Vision, Dry Eye, Visual Field, OCT, Fundus Photography, Corneal Topography, Biometry/IOL Calculation, B-scan, and Gonioscopy. It covers every FSD table row, manual/correction provenance, retained source readings, configured calculations/options/ranges, quality and reliability conditions, eligible historical comparisons, same-patient document references, review-required flags, append-only amendment, optimistic concurrency, scoped reads, and audit.

## Existing functionality reused

- Phase 5's single result head per task, append-only clinical versions, form-profile snapshots, transactional draft/completion, controlled amendment, performer authorization, task/result version checks, and safe audit metadata.
- Phase 4's configured test task, branch/department/station scope, assignment, selected device/calibration snapshot, clinical-order item reference, and permission-visible task read.
- Phase 2's branch-versioned `FORM_PROFILE`, `IOL_CATALOGUE`, `GRADE`, `CLINICAL_THRESHOLD`, and station/device configuration resources.
- Existing active same-patient `PatientDocument` references for reports, maps, images, and videos. No storage subsystem is duplicated.
- The existing unified `GET /api/ophthalmology/test-tasks/:taskId/result` read model, which exposes current and historical clinical versions only after task scope/permission validation.
- HMS Local OPD, imaging, and patient-document interaction patterns were inspected for compatibility. There is no dedicated advanced Ophthalmology prototype; no prototype file will be changed.

## Missing contracts and explicit boundaries

1. `doc/HMS_Release2_FSD.docx` remains absent. The similarly named root release document concerns the separate IP/Surgery/Emergency release and does not replace the supplied Ophthalmology FSD or approved DEC-01 through DEC-12.
2. DEC-06 production clinical option values, thresholds, grading scales, equipment protocols, formula identifiers, and IOL catalogue entries remain configuration dependencies. Phase 6 validates active profile values and does not seed clinical defaults.
3. DEC-10 vendor import formats and file MIME/size/video/DICOM/retention policies remain unapproved. `DEVICE_IMPORT` stays rejected; files remain active same-patient document references.
4. Shared clinical orders do not currently expose requested scan lists, indications, or laterality. Phase 6 validates result laterality against the authoritative task and preserves its order/item reference, but will not invent or mutate missing order attributes.
5. Phase 8 owns the consolidated doctor consultation view and final IOL selection; Phase 9 owns submit/review/acknowledgement transitions. Phase 6 records proposed IOL choices and `doctor_review_required`; it rejects client-supplied reviewer identity, review time, or final approval.
6. Eligible comparison is limited to a prior completed result for the same patient, branch, form, compatible eye, and exact referenced clinical version, with an earlier performed time. Progression other than `NOT_COMPARED` requires that reference. The source version is retained for traceability.

## Frozen Phase 6 design

- Add eleven advanced form discriminators to the existing result DTO/model; do not create parallel collections or routes.
- Contract each FSD row as structured payload fields. Completion requires the FSD minimum data plus active `FORM_PROFILE` required/range/option rules; drafts may remain incomplete but reject unknown fields, invalid axes, invalid calculations, unsafe review claims, and laterality conflicts.
- Pachymetry retains repeat readings and verifies reported averages. Colour Vision verifies plate counts and calculated score. Corneal Topography verifies average K and corneal astigmatism from retained K1/K2 where reported. Biometry retains formula, catalogue/model, inputs, outputs, alternatives, and proposed/backup selections without granting final approval.
- Poor quality/reliability requires explanation or repeat/review disposition. Positive artefact, lesion, nystagmus, diplopia, abnormal head posture, PAS, and neovascularization require the relevant structured detail.
- Visual Field and OCT comparison outcomes are server-validated against eligible prior clinical versions. No progression outcome is accepted without an eligible source.
- All document IDs found in the common list or nested advanced payload remain subject to active same-patient ownership validation.

## Intended files

- Extend `apps/api/src/modules/ophthalmology/ophthalmology.types.ts`, `ophthalmology-test-result.model.ts`, `ophthalmology-core-test-contract.ts`, repository/service comparison validation, and schemas only where the shared contract requires it.
- Add `apps/api/src/modules/ophthalmology/ophthalmology.phase6.test.ts` covering all eleven forms and advanced error paths.
- Update the versioned API contract, Developer A prompt, Phase 0 alignment matrix, this gap note, and add the Phase 6 verification record.
- Do not change the frontend, shared order/document subsystems, permission seed, service registry, or `scope/HMS Local`.

## Acceptance checks

- Successful draft, completion, read, amendment, and persistence for every advanced form.
- Required/conditional fields, task laterality, axis bounds, configured options/ranges, retained-source calculations, poor-quality explanation, order linkage, and proposed-only IOL selection.
- Eligible/ineligible/missing/stale comparison references, including wrong patient, branch, form, eye, version, time, and unfinished source.
- Same-patient active nested documents; rejection of wrong-patient/inactive references and unsupported device import.
- Wrong assignee/station/branch, stale task/result version, finalized overwrite, profile mismatch, permission visibility, audit, concurrent completion, and transaction rollback.
- API/web typecheck, lint, build, focused Phase 6 tests, and full API regression checks.

## Stop gate

After Phase 6 verification and documentation are complete, stop. Do not begin Phase 7 without explicit owner approval.
