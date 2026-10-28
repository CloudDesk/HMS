# Patient Management Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Patient Management |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Maintain the shared patient identity, demographics and search foundation across all hospital workflows.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Maintain the shared patient identity, demographics and search foundation across all hospital workflows. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Reception; authorized clinical users; patient edits only through Patient Portal authorization.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Patients | Consent | Verify |
| Patients | Patient Documents | Create |
| Patients | Patient Documents | Delete |
| Patients | Patient Documents | Edit |
| Patients | Patient Documents | View |
| Patients | Patient Records | Create |
| Patients | Patient Records | Edit |
| Patients | Patient Records | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-PAT-001 | Documented source requirement; approval unverified. System-generated Patient ID/MRN, first name, middle name, last name, gender, date of birth/age. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶262 | `apps/api/src/modules/patients/patient.service.ts:55` — create | Partial |
| FR-PAT-002 | Documented source requirement; approval unverified. Mobile number, alternate number, email, address/location, county/district/region as applicable per country. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶264 | `apps/api/src/modules/patients/patient.service.ts:55` — create | Partial |
| FR-PAT-003 | Documented source requirement; approval unverified. National ID/passport/alternate ID; system shall allow emergency/minimum-data registration based on policy. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶266 | `apps/api/src/modules/patients/patient.service.ts:55` — create | Partial |
| FR-PAT-004 | Documented source requirement; approval unverified. Search patient by MRN, mobile number, ID or name before creating a new record. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶291 | `apps/api/src/modules/patients/patient.service.ts:41` — list | Partial |
| FR-PAT-005 | Documented source requirement; approval unverified. Show possible duplicate patient records if matching identifiers are found. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶294 | `apps/api/src/modules/patients/patient.service.ts:55` — create | Partial |
| FR-PAT-006 | Documented source requirement; approval unverified. Create patient profile if no existing record is selected, capturing demographic, contact, emergency and consent details. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶297 | `apps/api/src/modules/patients/patient.service.ts:55` — create | Partial |
| FR-PAT-007 | Documented source requirement; approval unverified. Capture or update allergies, medication history, chronic diseases, family history and immunization on first contact or as disclosed. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶300 | `apps/api/src/modules/patients/patient.service.ts:98` — update | Partial |
| FR-PAT-008 | Documented source requirement; approval unverified. System shall maintain audit trail with user, date/time and changed values. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶323 | `apps/api/src/modules/patients/patient.service.ts:98` — update | Partial |
| FR-PAT-009 | Documented source requirement; approval unverified. Maintain a single patient record across OPD, emergency, surgery/procedure and IP/admission-related workflows. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶196 | `apps/api/src/modules/patients/patient.service.ts:46` — getById | Partial |
| FR-PAT-010 | Documented source requirement; approval unverified. Search existing patient before creating new emergency/admission/surgery record. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶489 | `apps/api/src/modules/patients/patient.service.ts:41` — list | Partial |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Search by existing identifiers before registration.
2. Review potential duplicate matches.
3. Select an existing record or capture required patient details.
4. Save the branch-linked patient identity and generated MRN.
5. Update clinical/contact details using permitted fields.
6. Reuse the same patient in appointments, Emergency, admission and billing.
7. Retain audit and timeline information for sensitive changes.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| NOT_FOUND — Patient not found | 404 | `apps/api/src/modules/patients/patient.service.ts:50` |
| VALIDATION_ERROR — Date of birth is invalid | 400 | `apps/api/src/modules/patients/patient.service.ts:57` |
| BRANCH_REQUIRED — Registration branch is required | 400 | `apps/api/src/modules/patients/patient.service.ts:72` |
| DUPLICATE_PATIENT — Potential duplicate patient found | 409 | `apps/api/src/modules/patients/patient.service.ts:77` |
| DOCUMENT_REVIEW_NOT_REQUIRED — Hospital-uploaded documents do not require review | 400 | `apps/api/src/modules/patients/patient.service.ts:216` |
| DOCUMENT_ALREADY_REVIEWED — This document has already been reviewed | 409 | `apps/api/src/modules/patients/patient.service.ts:219` |
| REVIEW_REASON_REQUIRED — A rejection reason is required | 400 | `apps/api/src/modules/patients/patient.service.ts:223` |
| NOT_A_CONSENT — Document is not a consent | 400 | `apps/api/src/modules/patients/patient.service.ts:418` |
| CONSENT_NOT_ATTACHED — Only an attached consent can be verified | 409 | `apps/api/src/modules/patients/patient.service.ts:419` |
| CONSENT_STATUS_CONFLICT — Consent status changed; refresh and try again | 409 | `apps/api/src/modules/patients/patient.service.ts:421` |
| FILE_TOO_LARGE — Document file exceeds the allowed size | 400 | `apps/api/src/modules/patients/patient.service.ts:445` |
| INVALID_FILE_TYPE — Document file type is not allowed | 400 | `apps/api/src/modules/patients/patient.service.ts:449` |
| CONSENT_REQUIRED — A signed admission consent is required | 409 | `apps/api/src/modules/patients/patient.service.ts:471` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/patients/patient.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/PatientProfilePage.test.tsx` | useFeature |
| `apps/web/src/pages/PatientProfilePage.tsx` | useAuth, useAppLocation, usePatientProfileFeature, useState |
| `apps/web/src/pages/PatientRegistrationPage.tsx` | useState, useCallback, usePatientRegistrationFeature |
| `apps/web/src/pages/PatientSearchPage.test.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/pages/PatientSearchPage.tsx` | useAuth, useAppLocation, useState, useEffect, useHospitalSettings, usePatientSearchFeature, useMemo |
| `apps/web/src/hooks/patients/usePatientProfileFeature.test.tsx` | usePatientProfileFeature |
| `apps/web/src/hooks/patients/usePatientProfileFeature.ts` | usePatientProfileFeature, useAuth, useCurrencyFormatter, useState, usePatientDetails, usePatientTimeline, usePatientHistory, useOpdVisits |
| `apps/web/src/hooks/patients/usePatientRegistrationFeature.ts` | usePatientRegistrationFeature, useAuth, useActiveBranch, useBranchesList, useMemo, useCreatePatient, useEffect |
| `apps/web/src/hooks/patients/usePatientSearchFeature.ts` | usePatientSearchFeature, usePatientsList, useUpdatePatient |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/patients | patients.list | listPatientsQuerySchema | `apps/api/src/modules/patients/patient.routes.ts:104` |
| GET /api/patients/:id | patients.getById | patientIdParamsSchema | `apps/api/src/modules/patients/patient.routes.ts:116` |
| POST /api/patients | patients.create | createPatientBodySchema | `apps/api/src/modules/patients/patient.routes.ts:128` |
| PATCH /api/patients/:id | patients.update | patientIdParamsSchema, updatePatientBodySchema | `apps/api/src/modules/patients/patient.routes.ts:142` |
| GET /api/patients/:id/history | patients.getHistory | patientIdParamsSchema | `apps/api/src/modules/patients/patient.routes.ts:154` |
| GET /api/patients/:id/timeline | patients.getTimeline | patientIdParamsSchema, listPatientTimelineQuerySchema | `apps/api/src/modules/patients/patient.routes.ts:165` |
| GET /api/patients/:id/documents | patients.listDocuments | patientIdParamsSchema, listPatientDocumentsQuerySchema | `apps/api/src/modules/patients/patient.routes.ts:177` |
| POST /api/patients/:id/documents/upload | consents.get, inpatientAdmissions.get, opdVisits.getById, patients.getById, patients.uploadDocument | patientIdParamsSchema | `apps/api/src/modules/patients/patient.routes.ts:202` |
| PUT /api/patients/:id/documents/:documentId/upload | patients.getDocument, patients.replaceDocument | patientDocumentIdParamsSchema | `apps/api/src/modules/patients/patient.routes.ts:323` |
| GET /api/patients/:id/documents/:documentId/download | patients.downloadDocument | patientDocumentIdParamsSchema | `apps/api/src/modules/patients/patient.routes.ts:380` |
| PATCH /api/patients/:id/documents/:documentId/review | patients.reviewDocument | patientDocumentIdParamsSchema, reviewPatientDocumentBodySchema | `apps/api/src/modules/patients/patient.routes.ts:397` |
| PATCH /api/patients/:id/documents/:documentId/consent/verify | patients.verifyConsent | patientDocumentIdParamsSchema | `apps/api/src/modules/patients/patient.routes.ts:413` |
| DELETE /api/patients/:id/documents/:documentId | patients.deleteDocument, patients.getDocument | patientDocumentIdParamsSchema | `apps/api/src/modules/patients/patient.routes.ts:419` |
| GET /api/patients/:id/identifiers | patients.getIdentifiers | patientIdParamsSchema | `apps/api/src/modules/patients/patient.routes.ts:440` |
| POST /api/patients/:id/identifiers | patients.addIdentifier | patientIdParamsSchema, addPatientIdentifierBodySchema | `apps/api/src/modules/patients/patient.routes.ts:452` |
| PUT /api/patients/:id/identifiers/:identifierId/status | patients.updateIdentifierStatus | patientIdentifierIdParamsSchema, updatePatientIdentifierStatusBodySchema | `apps/api/src/modules/patients/patient.routes.ts:465` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### Patient

`apps/api/src/modules/patients/patient.types.ts:71`

| Field | Observed type |
| --- | --- |
| id | string |
| patient_number | string |
| first_name | string \| null |
| middle_name | string \| null |
| last_name | string |
| date_of_birth | Date |
| gender | PatientGender |
| phone | string \| null |
| email | string \| null |
| address | PatientAddress |
| emergency_contact | PatientEmergencyContact |
| parent_guardian | string \| null |
| registration_branch_id | string \| null |
| blood_group | string \| null |
| status | PatientStatus |
| notes | string \| null |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### PatientAddress

`apps/api/src/modules/patients/patient.types.ts:5`

| Field | Observed type |
| --- | --- |
| line1? | string \| null |
| line2? | string \| null |
| city? | string \| null |
| state? | string \| null |
| country? | string \| null |
| postal_code? | string \| null |

### PatientEmergencyContact

`apps/api/src/modules/patients/patient.types.ts:14`

| Field | Observed type |
| --- | --- |
| name? | string \| null |
| relationship? | string \| null |
| phone? | string \| null |

### PatientIdentifier

`apps/api/src/modules/patients/patient.types.ts:22`

| Field | Observed type |
| --- | --- |
| id | string |
| identifier_type | string |
| value | string |
| issuing_authority | string |
| status | PatientIdentifierStatus |
| effective_from | Date \| null |
| effective_to | Date \| null |
| source_environment? | string \| null |
| verified_at? | Date \| null |
| verified_by? | string \| null |
| created_at | Date |
| updated_at | Date |

### DhaPatientVerificationResult

`apps/api/src/modules/patients/patient.types.ts:37`

| Field | Observed type |
| --- | --- |
| matched | boolean |
| externalSystem | string |
| externalIdentifierType | string |
| mappingAvailable | boolean |
| reused? | boolean |
| message? | string |

### ShaPatientIdentifierReadiness

`apps/api/src/modules/patients/patient.types.ts:63`

| Field | Observed type |
| --- | --- |
| status | 'SHA_PATIENT_IDENTIFIER_AVAILABLE' \| 'SHA_PATIENT_IDENTIFIER_NOT_AVAILABLE' \| 'SHA_IDENTIFIER_SYSTEM_UNCONFIGURED' |
| identifierSystemConfigured | boolean |
| identifierAvailable | boolean |
| identifierSystem | string \| null |
| identifierType | string \| null |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| PatientStatus | 'ACTIVE' \| 'INACTIVE' \| 'DECEASED' | `apps/api/src/modules/patients/patient.types.ts:3` |
| PatientIdentifierStatus | 'ACTIVE' \| 'INACTIVE' | `apps/api/src/modules/patients/patient.types.ts:20` |
| PatientDocumentReviewStatus | 'NOT_REQUIRED' \| 'PENDING' \| 'VERIFIED' \| 'REJECTED' | `apps/api/src/modules/patients/patient.types.ts:128` |
| PatientConsentStatus | 'SIGNED' \| 'PENDING' \| 'EXPIRED' \| 'REJECTED' \| 'ATTACHED' \| 'VERIFIED' | `apps/api/src/modules/patients/patient.types.ts:129` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Branch Management; EMR; Patient Documents; Consent Management; all patient-facing workflows.

Observed backend import domains: `auth`, `branches`, `roles`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-PAT-001 | FR-PAT-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System-generated Patient ID/MRN, first name, middle name, last name, gender, date of birth/age. |
| AC-PAT-002 | FR-PAT-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Mobile number, alternate number, email, address/location, county/district/region as applicable per country. |
| AC-PAT-003 | FR-PAT-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: National ID/passport/alternate ID; system shall allow emergency/minimum-data registration based on policy. |
| AC-PAT-004 | FR-PAT-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Search patient by MRN, mobile number, ID or name before creating a new record. |
| AC-PAT-005 | FR-PAT-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Show possible duplicate patient records if matching identifiers are found. |
| AC-PAT-006 | FR-PAT-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Create patient profile if no existing record is selected, capturing demographic, contact, emergency and consent details. |
| AC-PAT-007 | FR-PAT-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Capture or update allergies, medication history, chronic diseases, family history and immunization on first contact or as disclosed. |
| AC-PAT-008 | FR-PAT-008 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall maintain audit trail with user, date/time and changed values. |
| AC-PAT-009 | FR-PAT-009 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Maintain a single patient record across OPD, emergency, surgery/procedure and IP/admission-related workflows. |
| AC-PAT-010 | FR-PAT-010 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Search existing patient before creating new emergency/admission/surgery record. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-PAT-01: R1 extended history fields need field-level reconciliation with the current patient entity.
- GAP-PAT-02: Confirm identity matching, duplicate override/merge, minimum emergency demographics and identifier jurisdictions.
- GAP-PAT-03: Patient profile edits must not silently redefine authentication ownership or guardian access.
- GAP-PAT-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Patient Management/M-010_PATIENT_PROFILE_LAYERING_GAP_NOTE.md` | f69b0ee45580550b79734d92325e8ab762520f968602a7ae7369d99d7fd3d434 | Historical design evidence |
| `HMS Project/Design/Patient Management/M-010_PATIENT_PROFILE_LAYERING_VERIFICATION.md` | 0bd6e02848b6d639c66511ca1dd14a4ec071f7d9f8442ed56d57e2370d67f4e3 | Historical design evidence |
| `HMS Project/Design/Patient Management/review.md` | ab75d115f2b5ffcba012ab28eeb1b4109131023496211fdbd5df6c55f90f2e28 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/patients/patient-identifier.utils.ts`
- `apps/api/src/modules/patients/patient-number.model.ts`
- `apps/api/src/modules/patients/patient-number.service.ts`
- `apps/api/src/modules/patients/patient.model.ts`
- `apps/api/src/modules/patients/patient.repository.ts`
- `apps/api/src/modules/patients/patient.routes.ts`
- `apps/api/src/modules/patients/patient.schemas.ts`
- `apps/api/src/modules/patients/patient.service.ts`
- `apps/api/src/modules/patients/patient.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
