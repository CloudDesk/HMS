# Ophthalmology B1/B2 remaining work and contract handoff

16 October 2026. Frontend only. Backend contract v1.10.0, commit 537c55a.

## Renewed B1/B2 implementation plan

The user again authorised full B1/B2 implementation. Reuse existing API/domain/feature layers and inspect actual clinical validators before edits. This continuation targets remaining contracted code-list controls, repeated dilation/image/IOL acquisition rows, multi-document references, patient/history header and 13-area navigation. Keep original versions, source readings, unknown historical values and exact permissions intact. Inspect shared navigation before adding a minimal optional unsaved-navigation guard. This paragraph records the earlier B1/B2 scope. The later user request now authorises B3 queue work; see `HMS_OPHTHALMOLOGY_FRONTEND_B3_GAP_NOTE.md`. Backend and B4/B5 remain outside scope. Unsupported clinical schemas remain explicit handoffs, not invented inputs. Intended files: specialty field/form helpers, specialty components/feature hook/tests, minimal navigation guard and this register/verification/prompt records.

The user approved B1 and B2. Both have progressed, but neither is fully implemented or release complete. This register is a frontend assessment, not a replacement backend contract. Preserve Developer A ownership.

## Contract dependencies

| Gap | Evidence and required handoff |
|---|---|
| Appointment specialty fields | Appointment API/frontend DTOs do not expose sub-speciality, affected eye or referral context. Appointment owner must publish the write/read mapping. Do not append unknown request fields. |
| Eight master value schemas | SUB_SPECIALITY, VISUAL_ACUITY_SCALE, DIAGNOSIS_REFERENCE, DRUG_OPTION, OPTICAL_PRODUCT, IOL_CATALOGUE, GRADE and REASON still use opaque configuration values. Their current admin editor edits metadata and preserves values. Publish precise structured schemas before value authoring. |
| Clinical lookup permission | Clinical configuration reads require Configuration View. Publish a clinical read projection or approve explicit grants; do not grant configuration-edit permission implicitly. |
| Eligible station membership | Current Users View lookup supplies active branch/department users. Backend remains authoritative for eligibility. A dedicated eligibility projection/filter is needed to guarantee every offered candidate is eligible. |
| Intake history masters | Separate previous-eye-disease/family-history choice bindings are unspecified. Preserve existing codes; do not infer them from complaints. |
| Nested result schemas | `apps/api/src/modules/ophthalmology/ophthalmology.types.ts` contains broad records for PD, segment height, cycloplegic medication, JCC/binocular, fundus findings, diagnostic measurements and paediatric structures. Publish field types, units, options and conditional validation. Explicit profile range/choice paths can already drive supported detailed controls. |
| Eligible comparisons | Existing result-reference validation does not publish all FSD patient/eye/test/protocol/unit compatibility rules as an eligible comparison projection. Publish exact clinical-version candidates and compatibility semantics. |
| Shared OPD version bodies | Reconcile A1 request-body contract with `opd-consultation.schemas.ts` and `opd-clinical-order.schemas.ts`; do not invent transport. |

## Implemented in this continuation

- Added all 13 FSD consultation navigation areas with exact View gates, the MRN/patient/consultant/priority header, separate OPD and specialty statuses, shared allergy/history display and active-alert warning. Later clinical areas link to the existing shared OPD encounter; this does not implement B4/B5 specialty approval/completion.
- Added versioned context editing for affected eye/subtype/workflow with original expected versions and modal-only lookups. Late successful mutation responses cannot trigger follow-up navigation after a patient/task switch.
- Added compatible subtype selection from the approved shared visit mapping. REVIEW and WALK_IN require an explicit choice when several subtypes fit; no clinical subtype is selected by assumption.
- Added structured code-array rows for the contracted core/advanced/specialised lists; add/remove dilation medication rows, fundus image sets and per-eye IOL calculation rows. Code positions use exact profile paths such as `conclusion_codes.0`, matching the backend validator; no unapproved choices or wildcard semantics were invented.
- Added multiple document references for slit-lamp/fundus images, OCT/B-scan images/video, photography sets and topography source maps. Selection is filtered by known eye metadata; existing off-page references remain available for removal. Backend validates patient/document scope.
- Added optional navigation guarding for active clinical/admin drafts to the existing custom navigation function; modal-only lookup pagination retains the draft. Native cancelable traversal events are guarded when supported; reload/close retains beforeunload protection. Uncancelable/cross-origin/unsupported browser traversal remains a platform acceptance limitation.
- Corrected explicit result reload to refresh reliability, comments, document references, payload and versions together. Newer background data never advances a dirty baseline or silently replaces a historical profile. Source data and unknown fields remain preserved.

## Remaining frontend acceptance and contract-dependent work

All 21 form families have entry controls, including the repeat/code/document controls above. This still does not certify all 178 FSD rows complete. Remaining detailed fields need the missing nested schemas and hospital-approved values in the contract table: PD/segment height, medication/strength, objective reflex/media, JCC/binocular/near, fundus findings, motility/dry-eye/VF/OCT measurement structures, IOL measurements/proposed/backup/alternative lenses, B-scan dimensions, gonioscopy overall and paediatric clinical/development structures. Approved profiles can already supply precise numeric and choice paths; unsupported types remain read-only.

Remaining acceptance includes all 178 rows, complete accessibility and clinical responsive workflows, same-eye media under changing image-set eyes, native Back/Forward across supported browsers, persistence after logout/login, scope/role/conflict paths and real storage/idempotent retry. Do not mark them passed on component tests alone. Appointment/master/history/comparison gaps remain backend-owner handoffs, not permission to invent fields.

## Acceptance prerequisites

Live authenticated configuration navigation, branch lookup, empty state, required-field/form-profile validation and 390-pixel configuration/workflow-editor layout were checked without saving hospital settings. A transient workflow lookup failure recovered using Retry. The original viewport was restored and the temporary tab closed. Available QA encounters inspected were General Medicine; specialty activation rejects them correctly. Approved active Ophthalmology profiles and authorised assigned QA tasks are needed for draft persistence after logout/login, emergency routing, result completion/amendment, real attachment storage/idempotency, role/branch and responsive clinical acceptance. Do not seed clinical choices merely to bypass missing fixtures.

Repository-wide baseline lint and regression failures remain documented in the phase verification records. B3 task creation, assignment, calling, starting, routing and repeat UI is now implemented against the published routes. B3 remains partial because submission, unassigned-task visibility, clinical lookup/display projections, sequencing and live acceptance are unresolved; see `HMS_OPHTHALMOLOGY_FRONTEND_B3_VERIFICATION.md`. B4 clinical treatment/optical/result-review work is now tracked in `HMS_OPHTHALMOLOGY_FRONTEND_B4_VERIFICATION.md`. B5 readiness/history and supported deferral/override UI are partially implemented; final completion/amendment/summary dependencies are tracked in `HMS_OPHTHALMOLOGY_FRONTEND_B5_VERIFICATION.md`. Portal publication and B6 have not started.
