# Ophthalmology OPD Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Ophthalmology OPD |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Record specialty encounter, laterality, test workflow and review requirements from the retained Ophthalmology contracts.

No dedicated current-branch implementation was found in the paths listed in section 18. Historical or other-branch evidence is explicitly labelled and is not treated as functionality deployed on this branch.

## 3. Business objectives

Record specialty encounter, laterality, test workflow and review requirements from the retained Ophthalmology contracts. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Ophthalmology clinician; doctor/reviewer; assigned station user; authorized configuration administrator.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

No module-specific staff permission tuple was established in the inspected current routes. See API boundaries and the unresolved role/authorization decisions; do not invent a default grant.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-EYE-001 | Historical design observation or proposal; business validation required. Use OD or OS for per-eye measurements and images in the referenced specialty contract. | `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1__9c8dd270aa.md:75` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-EYE-002 | Historical design observation or proposal; business validation required. Use expected versions for versioned clinical writes; confirm the accepted contract revision. | `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1__9c8dd270aa.md:25` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-EYE-003 | Historical design observation or proposal; business validation required. Preserve an original test task and create a linked repeat rather than overwrite it. | `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1__9c8dd270aa.md:111` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-EYE-004 | Historical design observation or proposal; business validation required. Keep internal, portal-approved and withdrawn publication states distinct. | `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1__9c8dd270aa.md:119` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-EYE-005 | Historical design observation or proposal; business validation required. Create specialty context from the authoritative OPD visit and active configuration/workflow profile. | `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1__9c8dd270aa.md:227` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-EYE-006 | Historical design observation or proposal; business validation required. The referenced specialty contract allows orders during an open consultation; reconcile with general OPD prerequisites. | `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1__9c8dd270aa.md:196` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-EYE-007 | Historical design observation or proposal; business validation required. Allow configuration edits only while the configuration remains a draft. | `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1__9c8dd270aa.md:231` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Use an authoritative OPD encounter and specialty context.
2. Select the permitted subtype, affected eye and active workflow profile.
3. Capture preliminary examination and clinician assessment.
4. Create and route test tasks to the assigned station.
5. Enter laterality-specific versioned results.
6. Submit and review results or request a linked repeat.
7. Complete clinical review and publish only through the approved portal disclosure decision.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

No complete module-specific business validation contract was established from simple service errors. The source gaps remain explicit; shared request validation is not a substitute for an approved rule.

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

No dedicated current-branch page was mapped. Source workflow descriptions remain design evidence only; no new screen, button or form field is invented.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

No dedicated current-branch endpoint family is established here. Shared implementation files and source-design contracts are listed in section 18; future API naming and payloads require approval.

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

No dedicated current-branch entity contract was established. Source-described fields, such as those in section 6, remain requirements to reconcile. Do not invent a schema from screen labels or prototype data.

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

No complete explicit current transition map was established. Inspect the linked service guards or obtain an approved lifecycle before specifying new status actions. A simple active flag or report state must not be expanded into an invented clinical lifecycle.

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

OPD Consultation; Patient Management; Service Catalog; Patient Documents; RBAC; Patient Portal.

Observed backend import domains: No dedicated import dependency list established.. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-EYE-001 | FR-EYE-001 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Use OD or OS for per-eye measurements and images in the referenced specialty contract. |
| AC-EYE-002 | FR-EYE-002 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Use expected versions for versioned clinical writes; confirm the accepted contract revision. |
| AC-EYE-003 | FR-EYE-003 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Preserve an original test task and create a linked repeat rather than overwrite it. |
| AC-EYE-004 | FR-EYE-004 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Keep internal, portal-approved and withdrawn publication states distinct. |
| AC-EYE-005 | FR-EYE-005 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Create specialty context from the authoritative OPD visit and active configuration/workflow profile. |
| AC-EYE-006 | FR-EYE-006 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: The referenced specialty contract allows orders during an open consultation; reconcile with general OPD prerequisites. |
| AC-EYE-007 | FR-EYE-007 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Allow configuration edits only while the configuration remains a draft. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-EYE-01: The specialty backend is absent on DEV-GENERAL; retained contracts belong to other refs or working-tree snapshots.
- GAP-EYE-02: Three materially different backend-contract copies exist; version text and internal approved-decision claims do not establish which is the accepted baseline.
- GAP-EYE-03: Clinical scales, reference ranges, units, device mapping and publication policy remain owner decisions.
- GAP-EYE-04: Contract behavior allowing orders before consultation completion must be reconciled with general OPD rules.
- GAP-EYE-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Ophthalmology OPD/HMS_MONGODB_COLLECTION_USAGE.md` | 1572e28dc8426816957c7b4699b567db138851d019622e917b17d526ee4ffe7a | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_ACTUAL_WORKFLOW_CONTINUATION.md` | b3876689c617f9a9a447c9fed159fd8cfa58bc31cb66ce051edd852c35cef9e7 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_AUDIT_FIX_VERIFICATION.md` | 5809a11f00d9a07b3a02eb465470b0bbc94590905c454759c1ebd5e9cadbbd77 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1__9c8dd270aa.md` | 9c8dd270aa316c5c38ef726bf76eeebacba921862d72a5cc5cef841148198d1e | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1__d4850d927e.md` | d4850d927e575a67acb05b53cb7a6d0afacac159b3380514222186d8cf04e9e3 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1__f7f9470cc4.md` | f7f9470cc4700f8345c226a02e4fffd7484d6ef67ec4f928c3f6a626bde24d1f | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_C10_STRUCTURED_TREATMENT_FRONTEND_GAP_NOTE.md` | 253b81608c3bfdad566d47828b2f3e6e6325e82b9378f0cbea53a16ae99985f5 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_C9_STRUCTURED_TREATMENT_BACKEND_GAP_NOTE.md` | 61384546a481e3aa40f51eb67bfb9f4cee76c49f10c0530a95b2b621f7697936 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_COMBINED_WORKFLOW_GAP_CLOSURE.md` | 3bbe21de7a0dcfdf1716c214029861710e1268ad87665bb6b7f37e02a37b2a76 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_DEFERRED_ISSUES.md` | c0a3db2b49163b6637452ed52867566779c3a6a7b917de37efcb521775edd416 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_B0_ASSESSMENT.md` | 204ac03dd3d5fc0d94eb48468fd0375140154551e32701fccd9203c249d3a4b6 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_B0_FIELD_MAPPING.md` | e04a3ba1eccb0bc06f0b5141b2f5bd048479de6946e599127409aee320168d82 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_B1_B2_REMAINING_GAPS__2cae150617.md` | 2cae1506179f5d635d30b136ff58889d7cdb1b1e090676febc187305920915a5 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_B1_B2_REMAINING_GAPS__b3e90dd5e2.md` | b3e90dd5e27280bfd55903fd2ba771eaaacc9dfb14569f89577e00207e4df363 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_B1_GAP_NOTE.md` | 63b021def2a8e2eb372446737dfbb5b28d24b1c3b65933b974bc52a8faf2606e | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_B2_GAP_NOTE.md` | 298b13be87cc57f9d741a45ee5dd70618a0fe930ba5e99d42876d13bb00e478c | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_B3_GAP_NOTE.md` | 7f2c1f33b888e2b6c568167ca3a0fbaa70fcf5ae4f60f8b595e16af9beb8d7a4 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_B4_GAP_NOTE.md` | 7aa2a5eff70b5e0e38ffccf32dafe3058d8d70c14a657336d5e44e5b7e5e370d | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_B5_GAP_NOTE.md` | aa47d696c2758300ae5a0a0de496400a863912bef2b2f2c2703b78e94f136368 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_B6_GAP_NOTE.md` | fb3bcd74e56562ca8b99e207e34a6757ded1936f3053f7c4b835a26769c9058e | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_C1_GAP_NOTE.md` | b25890d0bb9793e9bedb2769a045baef2ea106f4e33469e128ad7c9a7bd1b318 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_C2_GAP_NOTE.md` | 6992f7f068a1985a51b25948a0a50a3f7ec7f3c08ee83551f9e1ef99ae2e0b0f | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_C3_GAP_NOTE.md` | e81040ab9b5e6d221f79c2148fd727d71c16d1e29f324868fe9f603a029e6665 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_C4_GAP_NOTE.md` | bc046bf038845689e808cc501e9030e216366708829940dd9f1d6bb3f0759abf | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FRONTEND_CONTRACT_RECONCILIATION.md` | ef1fb0110f7a9be1d4b028516410269d2b52dfdd8c20a9fbb6f9ab522eed951c | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FULL_IMPLEMENTATION_PLAN__0f2a3f9e8c.md` | 0f2a3f9e8c90ed34655997e52785bcaa207a23e2ae599591412f651dc05920d4 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_FULL_IMPLEMENTATION_PLAN__3d07bac04a.md` | 3d07bac04aa2db0290f4649b96d89ad44427e609119b14770ee6164695455368 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_GAP_CLOSURE_20261020.md` | 7ab062c7ecc99d0a086c2ad7f775bc4911eca30c12ddb847bf23856b1f2404c4 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_GAP_CLOSURE_REPORT.md` | 3de7dc205e83c288a72fb9815c219a77f2ade798d7a17789620758d9f2540830 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_IMPLEMENTATION_AUDIT_REPORT.md` | 5cbb7cbab482195ec337de901abf241ab61a870108bd760a3662e8fee3981681 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_INTEGRATION_DECISIONS.md` | 499b2b22fe91b6e1ab3037cbe5f10cba4fcf7a192539532c494c6018e604b750 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX__127243a4ac.md` | 127243a4ac0c4efa6c197eb9c44886c706dbff326f5b4525db7f82ae32a0f9f0 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX__45d86d521f.md` | 45d86d521f4d83a1eb5a7895a9d7a7a307d2dadb52f09efdfca3b907b6edbfd7 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX__7966f800b8.md` | 7966f800b8f3a9c7cf32f41ee60cf974afa464dac7b715a337197fb598bac3f9 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE_0_GAP_NOTE.md` | 6c112bb4be9d86f7f1836f9dc834d827a36a0c8b21c5cd6f7f66c45f2c1143b6 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE_10_GAP_NOTE.md` | 61dc3d92028f608661c05231b8db0bea9f2f131112691b1eb9c1f7c25d8b7c15 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE_11_GAP_NOTE.md` | 45ee00958a58d9b011f5fe1f99282f90f3662ba1ee12cd9a9ebe4ec4fce7dc65 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE_1_GAP_NOTE.md` | e8c780c1084e477b87aff7948e757cd079d2c0fe200ab065eb70430a416e9809 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE_2_GAP_NOTE.md` | b4844a99d916fa087fb93d0e0afd8acab97125c34e7923ea41d760cc74662679 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE_3_GAP_NOTE.md` | 182e1f05843d2ef6f75c75de0ffb2f538d818feb84fd1de2540106f2bd52b12f | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE_4_GAP_NOTE.md` | 84912a672f2f3a5667dc0baa3ecdb220d1ae26f9074954af441f8656847d716a | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE_5_GAP_NOTE.md` | c9c73b137e6a7f5c7169f0590d7d094d597ed22d120b48ea983cf2ce804f44b5 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE_6_GAP_NOTE.md` | a731f7c8b67b858e900b521bc564f435422e3414e7ee359aa8cce721c084e079 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE_7_GAP_NOTE.md` | d367901cb033a9c9625cb3406a3593b6826a4fb278631225f1373a063d0fa121 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE_8_GAP_NOTE.md` | 1dbbc9b4543dc7f9678c0a83c3f275f3648d440685d7a493757551e0c0be31ba | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_PHASE_9_GAP_NOTE.md` | d1fe87afa546515a6babf518454aae1a5b406716a9688b543293cd0875675c6f | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_OPHTHALMOLOGY_WORKFLOW_TRACEABILITY.md` | f88e25fa95585a8c7ec7bb7daa63aadf2caba24b2ff80fde559e01bc7613efd7 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_Ophthalmology_OPD_Developer_A_Backend_Prompts__b03b3eb5cd.md` | b03b3eb5cda3713a61c98b9828fe05ca3d0b61bc7a906342a7997c66b5d3ba73 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_Ophthalmology_OPD_Developer_A_Backend_Prompts__bb02c6fc6e.md` | bb02c6fc6ea2ccf19457f8713aa11537b33d766e08a02055a8ddef5215870d5a | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_Ophthalmology_OPD_Developer_A_Backend_Prompts__ea9b98a682.md` | ea9b98a682a7b79d52f022712799c98025e198aeef97780d58b0bb4142b5292f | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_Ophthalmology_OPD_Developer_A_Backend_Prompts__ecf55e7e2a.md` | ecf55e7e2ad53ba47690e8a4887268a315bd795810c44a50a600b9d8639885c0 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_Ophthalmology_OPD_Developer_B_Frontend_Prompts__33faa31e72.md` | 33faa31e72c2b6e8ff3b9d43c20f2ea7bd69e783498454ab141380bbee73c6e2 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_Ophthalmology_OPD_Developer_B_Frontend_Prompts__69b8fbdd1c.md` | 69b8fbdd1c5ddcfe3a95f02fd45eca23a0c005051e5e330c7b011dafb0d84b7e | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/HMS_Ophthalmology_OPD_Developer_B_Frontend_Prompts__80e55810e2.md` | 80e55810e2c5d769fa21c0818cd52d4914eaa1fd9cfb29315ef36d040d4c488f | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/OPD_CONSULTATION_DENTAL_OPHTHALMOLOGY_END_TO_END_ANALYSIS.md` | ca0852c212cf6bc540d2720dff0612ce97e0f34578d01ec9a2d5be3b91822c7d | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/OPHTHALMOLOGY_OPD_CODEBASE_BA_ASSESSMENT.md` | c34ff34fdafb878c4b87a6758b1587ca5373e45b941edf713006fc6466806c5b | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/OPHTHALMOLOGY_REMEDIATION_GAP_NOTE.md` | b0a58f8d5139d46f8d73417222a247199de6f483664f0156c5e5228ca122f114 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/QUALITY_REVIEW.md` | 5c11e41dbf89e62f8cee72194ab4f2c8dafa1b11336cf93b42386da530e27ef8 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/README.md` | 160d80cab62cd916262d12c679b0bcb9c69b5949be1cc81820a9baa9b4a657d7 | Historical design evidence |
| `HMS Project/Design/Ophthalmology OPD/README__e4c7f68fbf.md` | e4c7f68fbf0cdfcb7467560964ffb5418b1647cebf688dbee398be8a311dbb63 | Historical design evidence |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- No dedicated current files found in: `apps/api/src/modules/ophthalmology`. Current module registration checked in `apps/api/src/modules/index.ts`.

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
