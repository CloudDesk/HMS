# HMS Ophthalmology OPD Phase 5 Gap Note

**Date:** 15 October 2026  
**Phase:** 5 - Core clinical test results  
**Status:** COMPLETE - AWAITING PHASE 6 APPROVAL

## Approved scope

Phase 5 implements backend result capture for Visual Acuity, Lensometry, Autorefraction/Keratometry, Objective Refraction, Subjective Refraction, Intraocular Pressure, Slit-lamp/Anterior Segment, and Posterior/Fundus Examination. It covers the FSD field contract, manual-entry provenance, configured form versions, draft saves, completion, controlled amendment, optimistic concurrency, assignment/scope enforcement, document-reference validation, audit, and task transitions to `DRAFT` and `COMPLETED`. Submission/review, advanced tests, consultation completion, portal publication, and frontend screens remain later phases.

## Existing functionality reused

- Phase 2 branch-versioned `FORM_PROFILE`, visual-acuity, threshold, drug, optical-product, station/device, permission, scope, audit, and transaction foundations.
- Phase 4 test-task identity, patient/visit/context linkage, station assignment, selected device, performer eligibility, status/version concurrency, repeat preservation, and queue visibility.
- Existing patient-document metadata as the only attachment reference source. Phase 5 stores document IDs and never embeds binary data or creates a second storage subsystem.
- Existing MongoDB transaction helper, audit-log model, error envelope, and route permission middleware.
- HMS Local OPD consultation and patient-document patterns were inspected for contract compatibility only. The prototype contains no dedicated Ophthalmology test forms and is not modified.

## Missing contracts and explicit boundaries

1. `doc/HMS_Release2_FSD.docx` remains absent. It concerns the separate Scope 2 Phase 3 IP/Surgery/Emergency release and does not replace the supplied Ophthalmology FSD or approved DEC-01 through DEC-12.
2. DEC-06 clinical values remain pending. Phase 5 will require an active branch `FORM_PROFILE`, snapshot its exact revision/values, and apply configured required paths, option sets, ranges, and IOP thresholds. It will not seed or infer clinical values.
3. Vendor/device adapter formats are not approved. Phase 5 supports authorized `MANUAL` entry only and rejects `DEVICE_IMPORT` instead of pretending a vendor import occurred. The already validated Phase 4 device context is retained.
4. MIME, size, video, DICOM, retention, annotation, and portal-publication policies remain pending. Phase 5 accepts references only to active existing documents owned by the same patient; upload/publication is outside this phase.
5. Phase 9 owns review, acknowledgement, reopening of finalized consultations, and downstream republish. Phase 5 nevertheless provides the required result-level append-only amendment for a `COMPLETED` unreviewed task. Historical completed versions are immutable; a reasoned replacement version is appended and the task remains `COMPLETED` pending later review.
6. The FSD does not supply canonical test codes. A task is matched to a Phase 5 form through the active form profile's configured `test_codes`, never through a guessed code.

## Frozen Phase 5 design

- One result head per task and append-only result versions. Draft re-save replaces only the current unfinished draft while incrementing the result head version; completion freezes that version. Amendment appends a new completed version linked to the superseded version.
- Every version snapshots form type/schema, form-profile ID/revision/values, task laterality, station/device, performer, performed time, source type, reliability/quality, comments, attachment document IDs, and the structured form payload.
- Common source type is `MANUAL` in this phase. Reliability is `GOOD | FAIR | POOR`; `POOR` requires a reason. All result writes require the eligible assigned station performer. Read requires normal scoped task visibility.
- Draft accepts incomplete content but still enforces identity, form/task/profile compatibility, source, laterality, document ownership, structural field types, and safe bounds such as axis `0..180`. Completion additionally applies the active profile's configured required paths, allowed values, numeric ranges, and form-specific FSD conditional rules.
- Completion atomically freezes the exact result version, conditionally changes the exact task `IN_PROGRESS | DRAFT -> COMPLETED`, records completion time/history, and writes a safe audit event. Amendment atomically appends a version, conditionally increments the result/task versions, and audits before/after version references plus reason.

## Intended files

- Add `ophthalmology-test-result.model.ts`, form-contract/validation support, and `ophthalmology.phase5.test.ts` under `apps/api/src/modules/ophthalmology/`.
- Extend Ophthalmology types, schemas, repository, service, routes, and the Phase 4 task transition history.
- Update the versioned API contract, alignment/status documents, Developer A prompt, and add Phase 5 verification after all checks pass.
- Do not change the frontend, shared patient-document implementation, clinical masters, vendor adapters, or `scope/HMS Local`.

## Acceptance checks

- Draft and completion success for all eight forms with exact form/profile/task binding.
- Axis, laterality, required/conditional field, poor-reliability reason, selected-reading, calculated-value source, dilation/cycloplegia, and configuration-driven range/option/threshold paths.
- Same-patient active document references and rejection of wrong-patient/inactive references.
- Wrong assignee/station/branch, stale task/result version, finalized draft overwrite, unsupported form/test mapping, missing/inactive profile, unsupported import, and invalid transition errors.
- Concurrent completion produces one success; transactional failure leaves task/result unchanged; controlled amendment retains the old version and audits the new one.
- Phase 1-4, OPD, patient-document, permissions, typecheck, phase-owned lint, build, and full API regression checks.

## Stop gate

Phase 6 must not start until the Phase 5 implementation, focused tests, contract update, verification report, and owner acceptance are complete. Missing clinical values remain deployment/configuration dependencies, not invented defaults.
