# Dental OPD Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Dental OPD |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Document the dental examination and odontogram behavior found in branch-specific design evidence.

No dedicated current-branch implementation was found in the paths listed in section 18. Historical or other-branch evidence is explicitly labelled and is not treated as functionality deployed on this branch.

## 3. Business objectives

Document the dental examination and odontogram behavior found in branch-specific design evidence. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Dental clinician; Reception for booking intake; patient self-service only where explicitly authorized.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

No module-specific staff permission tuple was established in the inspected current routes. See API boundaries and the unresolved role/authorization decisions; do not invent a default grant.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-DENTAL-001 | Historical design observation or proposal; business validation required. The historical design describes a Dental Examination workspace. | `HMS Project/Design/Dental OPD/HMS_DENTAL_FLOW_INTAKE_SELF_CHECKIN_GAP_NOTE.md:13` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-DENTAL-002 | Historical design observation or proposal; business validation required. The historical design describes booking intake comprising chief complaint, HPI, past history, family history and allergies/sensitivities. | `HMS Project/Design/Dental OPD/HMS_DENTAL_FLOW_INTAKE_SELF_CHECKIN_GAP_NOTE.md:15` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-DENTAL-003 | Historical design observation or proposal; business validation required. The historical design describes copying booking intake to the OPD consultation at check-in. | `HMS Project/Design/Dental OPD/HMS_DENTAL_FLOW_INTAKE_SELF_CHECKIN_GAP_NOTE.md:16` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-DENTAL-004 | Historical design observation or proposal; business validation required. The historical design describes patient-authorized, appointment-date self-check-in; current general-branch support is unverified. | `HMS Project/Design/Dental OPD/HMS_DENTAL_FLOW_INTAKE_SELF_CHECKIN_GAP_NOTE.md:17` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-DENTAL-005 | Historical design observation or proposal; business validation required. Resolve service references and stable item identifiers; the historical gap note reports lost serialization. | `HMS Project/Design/Dental OPD/HMS_DENTAL_PHASE6_GAP_NOTE.md:13` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-DENTAL-006 | Historical design observation or proposal; business validation required. Protect completed dental exams against concurrent draft writes; this is an unresolved historical consistency requirement. | `HMS Project/Design/Dental OPD/HMS_DENTAL_PHASE6_GAP_NOTE.md:15` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-DENTAL-007 | Historical design observation or proposal; business validation required. Validate tooth identifiers and clinical-diagnosis linkage; current-branch implementation is absent. | `HMS Project/Design/Dental OPD/HMS_DENTAL_PHASE6_GAP_NOTE.md:17` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Use an existing appointment and OPD patient context.
2. Review the recorded booking intake.
3. Capture examined teeth and diagnosis using the documented dental workspace.
4. Associate eligible services and treatment items.
5. Validate and complete the exam without overwriting prior clinical data.
6. Use separately authorized prescription, referral, quotation or imaging flows.

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

OPD Consultation; Patient Management; Appointments; Service Catalog; Prescriptions; Referral Management; Imaging.

Observed backend import domains: No dedicated import dependency list established.. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-DENTAL-001 | FR-DENTAL-001 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: The historical design describes a Dental Examination workspace. |
| AC-DENTAL-002 | FR-DENTAL-002 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: The historical design describes booking intake comprising chief complaint, HPI, past history, family history and allergies/sensitivities. |
| AC-DENTAL-003 | FR-DENTAL-003 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: The historical design describes copying booking intake to the OPD consultation at check-in. |
| AC-DENTAL-004 | FR-DENTAL-004 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: The historical design describes patient-authorized, appointment-date self-check-in; current general-branch support is unverified. |
| AC-DENTAL-005 | FR-DENTAL-005 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Resolve service references and stable item identifiers; the historical gap note reports lost serialization. |
| AC-DENTAL-006 | FR-DENTAL-006 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Protect completed dental exams against concurrent draft writes; this is an unresolved historical consistency requirement. |
| AC-DENTAL-007 | FR-DENTAL-007 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Validate tooth identifiers and clinical-diagnosis linkage; current-branch implementation is absent. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-DENTAL-01: Dedicated dental backend and staff pages were not found on DEV-GENERAL; historical implementation reports are not current-branch evidence.
- GAP-DENTAL-02: No independent original dental business FSD was retained in the collection.
- GAP-DENTAL-03: Approve FDI validation, completion locking, quotation decisions and patient self-check-in scope.
- GAP-DENTAL-04: Historical dental notes describe new intake and self-check-in behavior that must not be assumed present in the current general appointment contracts.
- GAP-DENTAL-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Dental OPD/HMS_DENTAL_3D_ANATOMY_UI_GAP_NOTE.md` | 760012a09d45cf9da8dbe163cb2eaab214772e276ef6de403c1305b906980727 | Historical design evidence |
| `HMS Project/Design/Dental OPD/HMS_DENTAL_FLOW_INTAKE_SELF_CHECKIN_GAP_NOTE.md` | bb6fb6ee6a99bf700455f5f82d97dd0a1bf028bb65121727e9430ac0cf6bc8db | Historical design evidence |
| `HMS Project/Design/Dental OPD/HMS_DENTAL_ODONTOGRAM_UI_GAP_NOTE.md` | c4ffe662b9a400d99802f8169815958ca5fed2a3c3c0068a4bf165fcc89e2479 | Historical design evidence |
| `HMS Project/Design/Dental OPD/HMS_DENTAL_PHASE10_GAP_NOTE.md` | 41e352b90f7da8ab6bc92e218a59b248e203761a633edcbb8b44e973fd38bab5 | Historical design evidence |
| `HMS Project/Design/Dental OPD/HMS_DENTAL_PHASE11A_GAP_NOTE.md` | fc1db0ce84136ebe88ebfffb696f981d984d961c938121974b7cf002e55ea1ad | Historical design evidence |
| `HMS Project/Design/Dental OPD/HMS_DENTAL_PHASE6_GAP_NOTE.md` | d4658d0010a5b1fc336464317c969073a69e9adb62b92f89b91b3130c1aeecfa | Historical design evidence |
| `HMS Project/Design/Dental OPD/HMS_DENTAL_PHASE7_GAP_NOTE.md` | 7d494ecf34a63ad5ad371f441e2d8b90c61b2c9d5091f2191d90a857de681143 | Historical design evidence |
| `HMS Project/Design/Dental OPD/HMS_DENTAL_PHASE8_GAP_NOTE.md` | 91823adae7eb94e11271d15f59e41d5360cba31bbec08bfc394ade9e4e801108 | Historical design evidence |
| `HMS Project/Design/Dental OPD/HMS_DENTAL_PHASE9_GAP_NOTE.md` | 0fb48dfad0516cd105eeb6ddd97ec83fb25a2e608ce7ce348863fb661cf5ce30 | Historical design evidence |
| `HMS Project/Design/Dental OPD/HMS_GENERAL_ORAL_EXAMINATION_UI_CONSISTENCY_GAP_NOTE.md` | 6546462bd0b0712c85189a5bbd513aa34eac78fc29ede2e9800730f748873911 | Historical design evidence |
| `HMS Project/Design/Dental OPD/README.md` | 71f612dfb43310bd0381ad78005f00721f0c889dcb47e9e110e74112a70b721a | Historical design evidence |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- No dedicated current files found in: `apps/api/src/modules/dental`. Current module registration checked in `apps/api/src/modules/index.ts`.

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
