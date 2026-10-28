# Cross-Module HMS Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Cross-Module HMS |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Define shared patient-context, authorization and operational controls across the discovered HMS module set.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Define shared patient-context, authorization and operational controls across the discovered HMS module set. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

All HMS actors within explicit roles, branch and department scope; operational and clinical owners approve cross-domain decisions.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

No module-specific staff permission tuple was established in the inspected current routes. See API boundaries and the unresolved role/authorization decisions; do not invent a default grant.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-HMS-001 | Documented source requirement; approval unverified. Release 1 shall provide a central patient record and an enhanced EMR timeline covering registration, clinical history and safety-critical data. The patient record shall be the single reference point for appointments, emergency visits, admissions, consultations, prescriptions, investigations, imaging and billing, and shall carry forward allergies, medication history, chronic conditions, family history and immunization status across every visit and department. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶257 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-HMS-002 | Documented source requirement; approval unverified. Every visit shall be tagged OPD, Emergency or IPD; visit type shall drive applicable screens and billing rules. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶346 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-HMS-003 | Documented source requirement; approval unverified. System shall support OPD-to-IPD and Emergency-to-IPD conversion without re-registering the patient. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶354 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-HMS-004 | Documented source requirement; approval unverified. Access limited to permitted tabs/screens/actions per role and branch. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1140 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-HMS-005 | Documented source requirement; approval unverified. User, date/time and change details logged for sensitive edits, access attempts and permission changes. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1144 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-HMS-006 | Documented source requirement; approval unverified. Maintain a single patient record across OPD, emergency, surgery/procedure and IP/admission-related workflows. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶196 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-HMS-007 | Documented source requirement; approval unverified. Pharmacy/lab/scan requests must remain linked to originating encounter/admission/procedure. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶505 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-HMS-008 | Documented source requirement; approval unverified. Capture user, role, action, date/time, module, old/new values and reason where applicable. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶509 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-HMS-009 | Documented source requirement; approval unverified. Require all requests, documents and payments to reference patient and encounter/admission/procedure ID. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶552 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-HMS-010 | Documented project rule; not evidence of functional approval. Keep database access in repositories and business behavior in the existing service architecture. | `PROJECT_RULES.md:85` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-HMS-011 | Documented project rule; not evidence of functional approval. Use transactions for multi-document atomic operations. | `PROJECT_RULES.md:110` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-HMS-012 | Documented project rule; not evidence of functional approval. Protect sensitive data in logs; no passwords, tokens or clinical notes may be exposed. | `PROJECT_RULES.md:429` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-HMS-013 | Documented project rule; not evidence of functional approval. Use the existing production document storage policy and protect private file access. | `PROJECT_RULES.md:396` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Identify or reuse the patient record.
2. Create the appropriate OPD, Emergency or IP context.
3. Perform department-specific care and service requests.
4. Preserve patient and encounter references across handoffs.
5. Record invoices, documents and status changes in the same context.
6. Review exception handling and obtain workflow-specific acceptance.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| SMS_DELIVERY_FAILED — Failed to deliver SMS verification code. Please try again later. | 502 | `apps/api/src/shared/services/sms.service.ts:69` |
| INVALID_STORAGE_KEY — Patient document storage key is invalid | 400 | `apps/api/src/shared/storage/patient-document-storage.service.ts:37` |
| DOCUMENT_FILE_NOT_FOUND — Stored patient document file was not found | 404 | `apps/api/src/shared/storage/patient-document-storage.service.ts:57` |

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

All 45 discovered modules and support areas.

Observed backend import domains: `errors`, `sequence`, `services`, `storage`, `types`, `utils`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-HMS-001 | FR-HMS-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Release 1 shall provide a central patient record and an enhanced EMR timeline covering registration, clinical history and safety-critical data. The patient record shall be the single reference point for appointments, emergency visits, admissions, consultations, prescriptions, investigations, imaging and billing, and shall carry forward allergies, medication history, chronic conditions, family history and immunization status across every visit and department. |
| AC-HMS-002 | FR-HMS-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Every visit shall be tagged OPD, Emergency or IPD; visit type shall drive applicable screens and billing rules. |
| AC-HMS-003 | FR-HMS-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall support OPD-to-IPD and Emergency-to-IPD conversion without re-registering the patient. |
| AC-HMS-004 | FR-HMS-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Access limited to permitted tabs/screens/actions per role and branch. |
| AC-HMS-005 | FR-HMS-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: User, date/time and change details logged for sensitive edits, access attempts and permission changes. |
| AC-HMS-006 | FR-HMS-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Maintain a single patient record across OPD, emergency, surgery/procedure and IP/admission-related workflows. |
| AC-HMS-007 | FR-HMS-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Pharmacy/lab/scan requests must remain linked to originating encounter/admission/procedure. |
| AC-HMS-008 | FR-HMS-008 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Capture user, role, action, date/time, module, old/new values and reason where applicable. |
| AC-HMS-009 | FR-HMS-009 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Require all requests, documents and payments to reference patient and encounter/admission/procedure ID. |
| AC-HMS-010 | FR-HMS-010 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Keep database access in repositories and business behavior in the existing service architecture. |
| AC-HMS-011 | FR-HMS-011 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Use transactions for multi-document atomic operations. |
| AC-HMS-012 | FR-HMS-012 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Protect sensitive data in logs; no passwords, tokens or clinical notes may be exposed. |
| AC-HMS-013 | FR-HMS-013 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Use the existing production document storage policy and protect private file access. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-HMS-01: R1 extended scope already includes Emergency and IPD while the Phase 2 document says it builds on Phase 1 OPD; release labels need reconciliation.
- GAP-HMS-02: The August plan says the Release 2 FSD and dedicated Emergency/Surgery domains were absent; that historical baseline no longer describes this snapshot.
- GAP-HMS-03: Source presence and internal claims of approval are not independent sign-off evidence.
- GAP-HMS-04: Support areas such as Infrastructure and UI Shell remain in the 45-item register but are not asserted to be separate clinical products.
- GAP-HMS-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Cross-Module HMS/C1-H11-security-follow-up.md` | 0e5b7d8724939e9e81f1dd6c54116a2a03e48bf2c897b785b696c6521e99dbd2 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/FLOW_ANALYSIS.md` | ea4ba2006fddcc86501df469255e06dcb7349cc15d4d47dd4574fe25ba0d21dc | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/H-005_CLINICAL_BROWSER_STORAGE_GAP_NOTE.md` | 2405e2c17556fc94ecb988e8a0246d07cb825103d09eacffb1b923e583399761 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/H13-soft-delete-indexes.md` | eba51560ea37188d019f36dd710b8fb331307d0ffe1d4959a8a8d602be5d041d | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_EMERGENCY_ADMISSIONS_SURGERY_CURRENT_IMPLEMENTATION.md` | b48f27d8a1e0bb65893128f9c27e602be5bc03a2958807b49dc4d7172d3c425a | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_Engineering_Best_Practices_Checklist.md` | 7acdc86b7e3ba64f39122e0493d52a5c2d10104c907e13173a36592199465fd9 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_GENERAL_PHASE3_LOCAL_CONNECTION_REPORT.md` | f14a748a1ab427bb84e728483b22e4198ebc65697d373da0fbbd839bba4e1984 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_PHASE1_PROGRESS_AUDIT.md` | 866159a21e61378f38c107147957c4162d7107778369bdf76634eda903f238bf | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_PHASE1_SECURITY_AUTHORIZATION_GAP_NOTE.md` | 1241300e84b019b635c5d51776fff18959818a2f9e2b7176855e0ed1bb188101 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_SCOPE2_PHASE3_CONTRACT.md` | 41ae5343ec9f84e44c6af3e6dd54e0536575e259a9229e1c9a71905bfacd7685 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_SCOPE2_PHASE3_FINAL_INTEGRATION_GAP_NOTE.md` | a8b0f1c5b22ead47260c7af5435ea4b361a26965fd7473118328fbd13865117c | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_SCOPE2_PHASE3_IP_SURGERY_DOWNSTREAM_GAP_NOTE.md` | 687be00b5f4d29a5c3fbac99c3eab942f821b126302d846f8f80637a626ef76e | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_SCOPE2_PHASE3_P5_GAP_NOTE.md` | f3c36198bbd8acfdb6cd116af25fdbcbe81817480a6effe6fee2a897a3c7f64e | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_SCOPE2_PHASE3_P6_GAP_NOTE.md` | c9c1cf9b6cb187e65fb8b870b11936e1b646b6f2adecf421a226e0b11bbf729b | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN__120083ea9f.md` | 120083ea9f238ca7ebe3628da70904e5d6d231ad73a175923043a4176550ce87 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN__1e681a30b9.md` | 1e681a30b91201f911d206214d2438c4c4dcd53b8bae9fba96025af8c27aea53 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN__78949460ed.md` | 78949460ed1fc9e9fd73716a0d4d7967457a020319cd621bbf3a80a6d893c0e5 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN__a2a66c0c02.md` | a2a66c0c0257d477b1bfcbc11205b79680c69c464a872ee6e842e672a7dcc04a | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN__a59f1ec12f.md` | a59f1ec12f6e6897f9e5cd59c379cf0af4306d8e530793e3b4077b02c58c4743 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN__ed1bcee77b.md` | ed1bcee77be403c72f4029af5e6af72272b0dfdd197f5bad1e99989c122c1b3e | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN__f80943164b.md` | f80943164b6ebe1a67a3300165d63a7d5f0b86430d350bc0e8907a5d9a12dc1a | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/M-013_HTTP_RESPONSE_CONTRACTS_GAP_NOTE.md` | 5aa9be9341456a51ebff3c0353a210f407b6ce693fa0208e95e17650eef5ba56 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/NEXT_RELEASE_PHARMACY_INPATIENT_GAP_ANALYSIS.md` | 793b2fa3382d251a7f8668535d78e6ba84be9e3b82188293472777b1c45367e1 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/NEXT_RELEASE_PHASE_WISE_EXECUTION_PLAN.md` | adf78909a374f499d5077cd01f936dc769990feb33737de0c7eb1c7110f97019 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/NEXT_RELEASE_R0_FOUNDATION_CONTRACT.md` | cb2b4ccd4be6e7ebbe940643bc2c31f8c3ee9ad997ed8c0b6e316dc41d1af83c | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/PROJECT_RULES__527200ff0d.md` | 527200ff0d408b75ecafcd59f8b5b61f76fadfab4d8b8ccaff2132bc896a45db | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/PROJECT_RULES__588556e2c5.md` | 588556e2c5003d2937123ae0f7f960d2e4e69c5243d0781c541a4ed22d5ebc17 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/PROJECT_RULES__9795a1d596.md` | 9795a1d596ec7e2a98da581d99b76a054510a3b0f49ab363dbf8e317115604d7 | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/README.md` | 3b7cbb18d478519b31b565a00eb87a956eca634aa637a5041bd00ebaf207e16f | Historical design evidence |
| `HMS Project/Design/Cross-Module HMS/REMOVED_INACTIVE_COLLECTIONS_HMS_GENERAL.md` | cb19734f405790bfd8f91026452c97f399ad330d75fe090118cd7ca157c37316 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/app.ts`
- `apps/api/src/middleware/authenticate.ts`
- `apps/api/src/middleware/error-handler.ts`
- `apps/api/src/middleware/request-context.ts`
- `apps/api/src/middleware/require-permission.ts`
- `apps/api/src/server.ts`
- `apps/api/src/shared/database/transaction.ts`
- `apps/api/src/shared/errors/app-error.ts`
- `apps/api/src/shared/http/csv.ts`
- `apps/api/src/shared/http/response.ts`
- `apps/api/src/shared/security/hash.ts`
- `apps/api/src/shared/security/jwt.ts`
- `apps/api/src/shared/security/password-policy.ts`
- `apps/api/src/shared/sequence/sequence.model.ts`
- `apps/api/src/shared/sequence/sequence.service.ts`
- `apps/api/src/shared/services/service-registry.ts`
- `apps/api/src/shared/services/sms.service.ts`
- `apps/api/src/shared/storage/patient-document-storage.service.ts`
- `apps/api/src/shared/types/auth.ts`
- `apps/api/src/shared/types/service-registry.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
