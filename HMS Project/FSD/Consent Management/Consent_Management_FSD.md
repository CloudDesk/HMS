# Consent Management Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Consent Management |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Configure consent templates and determine whether patient-context consent prerequisites are satisfied.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Configure consent templates and determine whether patient-context consent prerequisites are satisfied. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Authorized administrator maintains templates; Reception or authorized uploader attaches documents; authorized verifier reviews consent.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Administration | Consent Templates | Create |
| Administration | Consent Templates | Edit |
| Administration | Consent Templates | View |
| Patients | Consent | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-CONSENT-001 | Documented source requirement; approval unverified. General and communication consent captured at registration and stored against the patient record. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1142 | `apps/api/src/modules/consents/consent.service.ts:25` — requirements | Partial |
| FR-CONSENT-002 | Documented source requirement; approval unverified. Admin can configure consent templates and document categories. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶438 | `apps/api/src/modules/consents/consent.service.ts:44` — create | Partial |
| FR-CONSENT-003 | Documented source requirement; approval unverified. Reception/authorized user can upload/attach consent document to patient/booking/admission/procedure. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶440 | `apps/api/src/modules/consents/consent.service.ts:25` — requirements | Partial |
| FR-CONSENT-004 | Documented source requirement; approval unverified. If configured, surgery/procedure/admission confirmation shall be blocked until consent is attached. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶442 | `apps/api/src/modules/consents/consent.service.ts:37` — assertMandatoryConsent | Partial |
| FR-CONSENT-005 | Documented source requirement; approval unverified. Consent attachment should store uploaded by, uploaded date/time and document version or category. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶444 | `apps/api/src/modules/consents/consent.service.ts:56` — update | Partial |
| FR-CONSENT-006 | Documented source requirement; approval unverified. Consent documents shall appear in patient documents/timeline for authorized users. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶446 | `apps/api/src/modules/consents/consent.service.ts:25` — requirements | Partial |
| FR-CONSENT-007 | Implementation observation — business validation required. Keep consent template code immutable on update. | `apps/api/src/modules/consents/consent.service.ts:56` | `apps/api/src/modules/consents/consent.service.ts:56` — update | Implemented |
| FR-CONSENT-008 | Implementation observation — business validation required. Require VERIFIED status for a mandatory template in the current implementation. | `apps/api/src/modules/consents/consent.service.ts:37` | `apps/api/src/modules/consents/consent.service.ts:37` — assertMandatoryConsent | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Configure an active template and context-specific mandatory rule.
2. Retrieve requirements for the patient, branch and admission or procedure.
3. Upload or attach the consent through Patient Documents.
4. Review or verify consent through the authorized patient-document workflow.
5. Re-evaluate mandatory consent before confirmation.
6. Retain actor, time and template/version context.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| BRANCH_ACCESS_DENIED — Branch access denied | 403 | `apps/api/src/modules/consents/consent.service.ts:10` |
| CONSENT_TEMPLATE_NOT_FOUND — Active consent template not found | 404 | `apps/api/src/modules/consents/consent.service.ts:21` |
| PATIENT_NOT_FOUND — Patient not found in selected branch | 404 | `apps/api/src/modules/consents/consent.service.ts:28` |
| MANDATORY_CONSENT_REQUIRED — Mandatory verified consent is required before confirmation | 409 | `apps/api/src/modules/consents/consent.service.ts:40` |
| DUPLICATE_CONSENT_TEMPLATE — Consent template code already exists in this branch and version | 409 | `apps/api/src/modules/consents/consent.service.ts:51` |
| CONSENT_TEMPLATE_CODE_IMMUTABLE — Consent template code cannot be changed | 400 | `apps/api/src/modules/consents/consent.service.ts:60` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/consents/consent.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/ConsentTemplatesPage.tsx` | useConsentTemplatesFeature, useState, useMemo |
| `apps/web/src/pages/PatientConsentPage.tsx` | usePatientConsentFeature, useState |
| `apps/web/src/hooks/consents/useConsentTemplatesFeature.ts` | useConsentTemplatesFeature, useAuth, useBranchesList, useState, useEffect, useConsentTemplates, useCreateConsentTemplate, useUpdateConsentTemplate |
| `apps/web/src/hooks/patients/usePatientConsentFeature.ts` | usePatientConsentFeature, useAuth, useAppLocation, usePatientsList, usePatientDetails, useConsentTemplates, usePatientDocuments, useUploadPatientDocument |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/consents/requirements | consents.requirements | Inline/custom validation; inspect source | `apps/api/src/modules/consents/consent.routes.ts:11` |
| GET /api/consent-templates | consents.list | Inline/custom validation; inspect source | `apps/api/src/modules/consents/consent.routes.ts:13` |
| POST /api/consent-templates | consents.create | Inline/custom validation; inspect source | `apps/api/src/modules/consents/consent.routes.ts:15` |
| PATCH /api/consent-templates/:id | consents.update | Inline/custom validation; inspect source | `apps/api/src/modules/consents/consent.routes.ts:17` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### ConsentTemplate

`apps/api/src/modules/consents/consent.types.ts:4`

| Field | Observed type |
| --- | --- |
| id | string |
| branch_id | string |
| code | string |
| name | string |
| category | string |
| context_type | ConsentContextType |
| mandatory | boolean |
| version | number |
| status | ConsentTemplateStatus |
| created_at | Date |
| updated_at | Date |

### SaveConsentTemplateDTO

`apps/api/src/modules/consents/consent.types.ts:24`

| Field | Observed type |
| --- | --- |
| branch_id | string |
| code | string |
| name | string |
| category | string |
| context_type | ConsentContextType |
| mandatory | boolean |
| status? | ConsentTemplateStatus |

### ConsentTemplateListQuery

`apps/api/src/modules/consents/consent.types.ts:18`

| Field | Observed type |
| --- | --- |
| branch_id | string |
| context_type? | ConsentContextType |
| status? | ConsentTemplateStatus |

### ConsentRequestMetadata

`apps/api/src/modules/consents/consent.types.ts:34`

| Field | Observed type |
| --- | --- |
| ipAddress? | string |
| userAgent? | string |

### ConsentRequirementQuery

`apps/api/src/modules/consents/consent.types.ts:35`

| Field | Observed type |
| --- | --- |
| branch_id | string |
| patient_id | string |
| context_type | ConsentContextType |
| context_id | string |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| ConsentTemplateStatus | 'ACTIVE' \| 'INACTIVE' | `apps/api/src/modules/consents/consent.types.ts:2` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Patient Documents; Patient Management; IPD; Surgery; RBAC.

Observed backend import domains: `auth`, `branches`, `patients`, `roles`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-CONSENT-001 | FR-CONSENT-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: General and communication consent captured at registration and stored against the patient record. |
| AC-CONSENT-002 | FR-CONSENT-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Admin can configure consent templates and document categories. |
| AC-CONSENT-003 | FR-CONSENT-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Reception/authorized user can upload/attach consent document to patient/booking/admission/procedure. |
| AC-CONSENT-004 | FR-CONSENT-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: If configured, surgery/procedure/admission confirmation shall be blocked until consent is attached. |
| AC-CONSENT-005 | FR-CONSENT-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Consent attachment should store uploaded by, uploaded date/time and document version or category. |
| AC-CONSENT-006 | FR-CONSENT-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Consent documents shall appear in patient documents/timeline for authorized users. |
| AC-CONSENT-007 | FR-CONSENT-007 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Keep consent template code immutable on update. |
| AC-CONSENT-008 | FR-CONSENT-008 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Require VERIFIED status for a mandatory template in the current implementation. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-CONSENT-01: R2 says mandatory consent must be attached; current assertMandatoryConsent requires VERIFIED. Confirm whether verification is an additional approved prerequisite.
- GAP-CONSENT-02: Confirm expiry, withdrawal, rejection and template version rollover semantics.
- GAP-CONSENT-03: Do not interpret a suggested consent status list as an approved transition matrix.
- GAP-CONSENT-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Consent Management/review.md` | 0cae2b216c9d61eee5ac701e7b3ff7499153302ac9249f3ceb6ed854962f2be2 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/consents/consent.service.ts` | f2ef31c21c538b0648774d38430c69f56aed2185bc92f59f9f21c7ac47198c8d | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/consents/consent.model.ts`
- `apps/api/src/modules/consents/consent.repository.ts`
- `apps/api/src/modules/consents/consent.routes.ts`
- `apps/api/src/modules/consents/consent.schemas.ts`
- `apps/api/src/modules/consents/consent.service.ts`
- `apps/api/src/modules/consents/consent.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
