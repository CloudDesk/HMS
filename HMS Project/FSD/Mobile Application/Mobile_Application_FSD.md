# Mobile Application Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Mobile Application |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Record the proposed patient mobile scope and its dependency on approved patient APIs.

No dedicated current-branch implementation was found in the paths listed in section 18. Historical or other-branch evidence is explicitly labelled and is not treated as functionality deployed on this branch.

## 3. Business objectives

Record the proposed patient mobile scope and its dependency on approved patient APIs. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Patient and guardian within explicit access grants; product and clinical owners approve exposed data.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

No module-specific staff permission tuple was established in the inspected current routes. See API boundaries and the unresolved role/authorization decisions; do not invent a default grant.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-MOBILE-001 | Historical design observation or proposal; business validation required. Proposed MVP: show the permitted patient or guardian profile. | `HMS Project/Design/Mobile Application/A_MVP_SCOPE.md:14` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-MOBILE-002 | Historical design observation or proposal; business validation required. Proposed MVP: book using the patient appointment API with server availability checks. | `HMS Project/Design/Mobile Application/A_MVP_SCOPE.md:23` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-MOBILE-003 | Historical design observation or proposal; business validation required. Proposed MVP: list, upload and download permitted documents through patient-scoped APIs. | `HMS Project/Design/Mobile Application/A_MVP_SCOPE.md:30` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-MOBILE-004 | Historical design observation or proposal; business validation required. Proposed MVP: display billing information read-only; no patient checkout is implied. | `HMS Project/Design/Mobile Application/A_MVP_SCOPE.md:32` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-MOBILE-005 | Historical design observation or proposal; business validation required. Proposed MVP: distinguish offline and retry states from empty data or logout. | `HMS Project/Design/Mobile Application/A_MVP_SCOPE.md:49` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-MOBILE-006 | Historical design observation or proposal; business validation required. Proposal defers push notifications to a later phase pending provider and scope decisions. | `HMS Project/Design/Mobile Application/A_MVP_SCOPE.md:38` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-MOBILE-007 | Historical design observation or proposal; business validation required. Proposal excludes persisted offline clinical records until retention and synchronization policy is approved. | `HMS Project/Design/Mobile Application/A_MVP_SCOPE.md:48` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Authenticate an existing patient or guardian account using an approved native session contract.
2. Resolve permitted self or dependent context.
3. Display allowed overview and appointment information.
4. Book or reschedule through server eligibility checks.
5. Read permitted documents and billing information.
6. Handle offline and retry conditions without inventing offline clinical persistence.

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

Patient Portal; Authentication; Appointments; Patient Documents; Billing; Notifications; Medical Devices.

Observed backend import domains: No dedicated import dependency list established.. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-MOBILE-001 | FR-MOBILE-001 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Proposed MVP: show the permitted patient or guardian profile. |
| AC-MOBILE-002 | FR-MOBILE-002 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Proposed MVP: book using the patient appointment API with server availability checks. |
| AC-MOBILE-003 | FR-MOBILE-003 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Proposed MVP: list, upload and download permitted documents through patient-scoped APIs. |
| AC-MOBILE-004 | FR-MOBILE-004 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Proposed MVP: display billing information read-only; no patient checkout is implied. |
| AC-MOBILE-005 | FR-MOBILE-005 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Proposed MVP: distinguish offline and retry states from empty data or logout. |
| AC-MOBILE-006 | FR-MOBILE-006 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Proposal defers push notifications to a later phase pending provider and scope decisions. |
| AC-MOBILE-007 | FR-MOBILE-007 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Proposal excludes persisted offline clinical records until retention and synchronization policy is approved. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-MOBILE-01: Native application source is absent on DEV-GENERAL although other-branch documentation exists.
- GAP-MOBILE-02: The MVP scope document is explicitly proposed for approval and must not be promoted to a confirmed requirement.
- GAP-MOBILE-03: Confirm patient record disclosure, complete versus bounded history, session revocation, push scope and privacy/support process.
- GAP-MOBILE-04: R1 excludes native mobile; separate release ownership is required.
- GAP-MOBILE-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Mobile Application/API_ERROR_DIAGNOSTICS.md` | 5b5bfc3a9c3c05985b4ad4ab5af3ff9a3156b857ffbc5f9b57856c6b514f169e | Historical design evidence |
| `HMS Project/Design/Mobile Application/APPOINTMENT_MOBILE_UI_FIX.md` | 8c45c13204873e0f2d679340100c9ec86f19abe6775d6da66817619a0f4a17b6 | Historical design evidence |
| `HMS Project/Design/Mobile Application/A_MVP_SCOPE.md` | 6ee9719add87bfb0886be042916cc563602cdfead99c19d3bb10623f00658db4 | Historical design evidence |
| `HMS Project/Design/Mobile Application/BILLING_CAPABILITY_AUDIT.md` | 77874f8c9fa2322449b421efb566558e8576809aa28da72f27614a22ce9443c8 | Historical design evidence |
| `HMS Project/Design/Mobile Application/B_API_CONTRACT_GAPS.md` | b774a65be9be0081b3e5102e5312380fee2b214ffba1d947496594f11a8d3ce9 | Historical design evidence |
| `HMS Project/Design/Mobile Application/CAPABILITY_AUDIT.md` | b55d8572d73ba8004074571f7449b593b59bf01dbfbd262f55629e9f8e7dd9af | Historical design evidence |
| `HMS Project/Design/Mobile Application/CAPABILITY_AUDIT__c842c24aa4.md` | c842c24aa4360d39d22bc886865377bdd718db22be29b017832b250ab54a4fe8 | Historical design evidence |
| `HMS Project/Design/Mobile Application/CONSENT_SYNC_INVESTIGATION.md` | 47fa3537075ff56b9b2c6bb47dc593280de6b6e1de8942674c5e174f4159038d | Historical design evidence |
| `HMS Project/Design/Mobile Application/EAS_ACCOUNT_AND_FREE_TIER_INVESTIGATION.md` | d8fd39b4225feb34c30aa73df2f26b63c7199012840c3ee6f17e0eb6538803a2 | Historical design evidence |
| `HMS Project/Design/Mobile Application/EAS_PROJECT_LINK_REPORT.md` | 16ac8109d6e2bd49bbb2256693655e5b2da83e6ddd15614c71a17f9b629df566 | Historical design evidence |
| `HMS Project/Design/Mobile Application/EXPO_ACCOUNT_STATUS.md` | 72e2d3c8e4e25ffc727156f32c7fa26d6b8f93d9fcf55216f68f2717b4a99573 | Historical design evidence |
| `HMS Project/Design/Mobile Application/EXPO_GOOGLE_AUTH_STATUS.md` | 47bfbac753fa76249ed93da3231cfbc6b0f6c63f28df96daa1117f676b861c0e | Historical design evidence |
| `HMS Project/Design/Mobile Application/E_MOBILE_ARCHITECTURE.md` | 5093e7bc26cddd213a4b059650a162202fa7fd02b539c07111ad1b7a03665c07 | Historical design evidence |
| `HMS Project/Design/Mobile Application/GAP_NOTE.md` | 020d1756c312f4cb457596f8faefcf45390ef026a79cc1cdb9e8ac4b490ac442 | Historical design evidence |
| `HMS Project/Design/Mobile Application/LOGIN_RATE_LIMIT_INVESTIGATION.md` | e4c1ec40958e269579553184ed3861668ee40fc1f863cb521c49ca9e3b72d875 | Historical design evidence |
| `HMS Project/Design/Mobile Application/OPTIONAL_CLINICAL_HISTORY_DATA_FLOW_AUDIT.md` | 9497e4e28c20cbfa5df0e2fb5a7662b4e2a32c146ab84b4120749f242234d2a9 | Historical design evidence |
| `HMS Project/Design/Mobile Application/PATIENT MOBILE DEVELOPMENT — PATIENT WEB PROTECTION RULES.txt` | 717bfe707a1854e22578e16840f8111e70975f5fdb956a1b79e228f08214cffc | Historical design evidence |
| `HMS Project/Design/Mobile Application/PATIENT_MOBILE_READINESS_ANALYSIS.md` | a63ade9f861962a1ed32909e93a0a8d616ff204d4bc2fc2014b6d8eb4269f46a | Historical design evidence |
| `HMS Project/Design/Mobile Application/PHYSICAL_DEVICE_API_CONNECTIVITY_REPORT.md` | ad3b4ebf7912d6e240ebd03e01fa143038044462d441badaa2f08dcf4c0645a4 | Historical design evidence |
| `HMS Project/Design/Mobile Application/SECURITY_AUDIT.md` | 1d38a5a86a7a29c6af6f89070b2a64d647087bfcbc1e0935166fb10f1ca0d8a7 | Historical design evidence |
| `HMS Project/Design/Mobile Application/SESSION_RESTORE_PHYSICAL_DEVICE_DIAGNOSTIC.md` | e050907fd5d30700124fd0a6e7ef06b111f9b28e4ce2bf8ebbf4b66d51091bbd | Historical design evidence |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- No dedicated current files found in: `apps/patient-mobile/src`. Current module registration checked in `apps/api/src/modules/index.ts`.

Residual ignored build/dependency directories under apps/patient-mobile are not tracked application source and are not used as implementation evidence.

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
