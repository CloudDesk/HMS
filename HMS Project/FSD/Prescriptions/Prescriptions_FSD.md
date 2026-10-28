# Prescriptions Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Prescriptions |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Create medication orders in the clinical context and hand submitted prescriptions to Pharmacy.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Create medication orders in the clinical context and hand submitted prescriptions to Pharmacy. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Doctor or explicitly authorized prescriber; Pharmacy reads submitted prescriptions.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| OPD | OPD Prescription | Edit |
| OPD | OPD Prescription | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-RX-001 | Documented source requirement; approval unverified. Prescription, lab order and imaging order created directly from the consultation. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶513 | `apps/api/src/modules/opd/opd-prescription.service.ts:41` — submit | Partial |
| FR-RX-002 | Documented source requirement; approval unverified. System shall check new prescriptions against active medications and flag known interactions with severity level before dispensing. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶756 | `apps/api/src/modules/opd/opd-prescription.service.ts:41` — submit | Partial |
| FR-RX-003 | Documented source requirement; approval unverified. System shall cross-check prescribed medicine against the patient's recorded allergies and block/warn accordingly. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶758 | `apps/api/src/modules/opd/opd-prescription.service.ts:41` — submit | Partial |
| FR-RX-004 | Documented source requirement; approval unverified. System shall warn when a medicine of the same class/active ingredient is already active for the patient. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶760 | `apps/api/src/modules/opd/opd-prescription.service.ts:41` — submit | Partial |
| FR-RX-005 | Documented source requirement; approval unverified. Dispensing history is complete and linked to the correct visit and prescriber. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶807 | `apps/api/src/modules/opd/opd-prescription.service.ts:87` — getForContext | Partial |
| FR-RX-006 | Documented source requirement; approval unverified. Doctor creates an e-prescription from the consultation workflow. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶396 | `apps/api/src/modules/opd/opd-prescription.service.ts:27` — saveDraft | Partial |
| FR-RX-007 | Documented source requirement; approval unverified. Pharmacy opens the e-prescription and reviews all medicine line items before billing or dispensing. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶398 | `apps/api/src/modules/opd/opd-prescription.service.ts:82` — list | Partial |
| FR-RX-008 | Implementation observation — business validation required. Prevent ordinary draft editing after the prescription is submitted. | `apps/api/src/modules/opd/opd-prescription.service.ts:27` | `apps/api/src/modules/opd/opd-prescription.service.ts:27` — saveDraft | Implemented |
| FR-RX-009 | Implementation observation — business validation required. Submit prescriptions for supported cross-domain encounter contexts. | `apps/api/src/modules/opd/opd-prescription.service.ts:91` | `apps/api/src/modules/opd/opd-prescription.service.ts:91` — submitForContext | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Open an active visit or supported inpatient/procedure context.
2. Record medication lines using the current medicine references.
3. Save a draft while editing is permitted.
4. Validate required medication content and context before submission.
5. Submit the prescription.
6. Route to Pharmacy and retain status linkage without allowing submitted content to be silently overwritten.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| PRESCRIPTION_SUBMITTED — A submitted prescription cannot be edited | 400 | `apps/api/src/modules/opd/opd-prescription.service.ts:34` |
| MEDICATION_REQUIRED — Add at least one medication before submitting | 400 | `apps/api/src/modules/opd/opd-prescription.service.ts:53` |
| CONTEXT_PRESCRIPTION_CONFLICT — A different prescription already exists for this clinical context | 409 | `apps/api/src/modules/opd/opd-prescription.service.ts:97` |
| PRESCRIPTION_NOT_FOUND — Prescription not found | 404 | `apps/api/src/modules/opd/opd-prescription.service.ts:104` |
| BRANCH_ACCESS_DENIED — Branch access denied | 403 | `apps/api/src/modules/opd/opd-prescription.service.ts:108` |
| VALIDATION_ERROR — OPD visit id is invalid | 400 | `apps/api/src/modules/opd/opd-prescription.service.ts:115` |
| NOT_FOUND — OPD visit not found | 404 | `apps/api/src/modules/opd/opd-prescription.service.ts:121` |
| CONSULTATION_REQUIRED — Start the consultation before creating a prescription | 400 | `apps/api/src/modules/opd/opd-prescription.service.ts:148` |
| VISIT_CLOSED — Prescription cannot be updated for a closed OPD visit | 400 | `apps/api/src/modules/opd/opd-prescription.service.ts:159` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/opd/opd-prescription.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/OpdVisitPage.test.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/pages/OpdVisitPage.tsx` | useActiveBranch, useTimezone, useOpdVisitFeature, useState, useMemo, useEffect |
| `apps/web/src/hooks/opd/useOpdVisitFeature.test.tsx` | useOpdVisitFeature |
| `apps/web/src/hooks/opd/useOpdVisitFeature.ts` | useOpdVisitFeature, useAppLocation, useMemo, useState, useOpdWorkspace, useOpdVisits, useEffect, usePatientDetails |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/opd/prescriptions | opdPrescriptions.list | listOpdPrescriptionsQuerySchema | `apps/api/src/modules/opd/opd-prescription.routes.ts:15` |
| GET /api/opd/visits/:visitId/prescription | opdPrescriptions.getByVisit | opdPrescriptionVisitParamsSchema | `apps/api/src/modules/opd/opd-prescription.routes.ts:24` |
| PUT /api/opd/visits/:visitId/prescription | opdPrescriptions.saveDraft | saveOpdPrescriptionBodySchema, opdPrescriptionVisitParamsSchema | `apps/api/src/modules/opd/opd-prescription.routes.ts:33` |
| POST /api/opd/visits/:visitId/prescription/submit | opdPrescriptions.submit | saveOpdPrescriptionBodySchema, opdPrescriptionVisitParamsSchema | `apps/api/src/modules/opd/opd-prescription.routes.ts:43` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### OpdPrescriptionItem

`apps/api/src/modules/opd/opd-prescription.types.ts:3`

| Field | Observed type |
| --- | --- |
| id | string |
| medicine_name | string |
| strength | string \| null |
| dosage | string |
| route | string |
| frequency | string |
| duration | string |
| quantity | number \| null |
| intake_time? | string \| null |
| instructions? | string \| null |

### OpdPrescription

`apps/api/src/modules/opd/opd-prescription.types.ts:16`

| Field | Observed type |
| --- | --- |
| id | string |
| source_type | ClinicalContextSourceType |
| source_id | string |
| encounter_id | string \| null |
| admission_id | string \| null |
| procedure_id | string \| null |
| visit_id | string \| null |
| consultation_id | string \| null |
| branch_id | string |
| patient_id | string |
| patient_number | string |
| patient_name | string |
| doctor_id | string |
| doctor_name | string |
| status | OpdPrescriptionStatus |
| items | OpdPrescriptionItem[] |
| follow_up_date | Date \| null |
| doctor_instructions | string \| null |
| patient_instructions | string \| null |
| submitted_at | Date \| null |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### ListPrescriptionsParams

`apps/api/src/modules/opd/opd-prescription.types.ts:52`

| Field | Observed type |
| --- | --- |
| status? | OpdPrescriptionStatus |
| limit? | number |
| skip? | number |
| search? | string |
| sortBy? | string |
| sortOrder? | 'asc' \| 'desc' |

### SaveOpdPrescriptionDTO

`apps/api/src/modules/opd/opd-prescription.types.ts:45`

| Field | Observed type |
| --- | --- |
| items | SaveOpdPrescriptionItemDTO[] |
| follow_up_date? | string \| null |
| doctor_instructions? | string \| null |
| patient_instructions? | string \| null |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| OpdPrescriptionStatus | 'DRAFT' \| 'SUBMITTED' \| 'DISPENSED' \| 'CANCELLED' | `apps/api/src/modules/opd/opd-prescription.types.ts:1` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

OPD Consultation; Emergency; IPD; Surgery; Medicine Catalog; Pharmacy Dispensing; EMR.

Observed backend import domains: `patients`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-RX-001 | FR-RX-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Prescription, lab order and imaging order created directly from the consultation. |
| AC-RX-002 | FR-RX-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall check new prescriptions against active medications and flag known interactions with severity level before dispensing. |
| AC-RX-003 | FR-RX-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall cross-check prescribed medicine against the patient's recorded allergies and block/warn accordingly. |
| AC-RX-004 | FR-RX-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall warn when a medicine of the same class/active ingredient is already active for the patient. |
| AC-RX-005 | FR-RX-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Dispensing history is complete and linked to the correct visit and prescriber. |
| AC-RX-006 | FR-RX-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Doctor creates an e-prescription from the consultation workflow. |
| AC-RX-007 | FR-RX-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Pharmacy opens the e-prescription and reviews all medicine line items before billing or dispensing. |
| AC-RX-008 | FR-RX-008 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Prevent ordinary draft editing after the prescription is submitted. |
| AC-RX-009 | FR-RX-009 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Submit prescriptions for supported cross-domain encounter contexts. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-RX-01: Approve clinical dose/unit/frequency dictionaries and medication safety rules; code fields alone are not clinical guidance.
- GAP-RX-02: Confirm amendment or cancellation after submission and partial-dispensing semantics.
- GAP-RX-03: Automated interaction and allergy safeguards are required in R1 but not proved by prescription submission.
- GAP-RX-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/opd/opd-prescription.service.ts` | e8bf5b2f5596b66da2df4cf60ab86f74d4c5623824216ad4ad4f178434dbb3b7 | Current implementation or project rule |

Current implementation files inspected for this module:

- `apps/api/src/modules/opd/opd-prescription.routes.ts`
- `apps/api/src/modules/opd/opd-prescription.schemas.ts`
- `apps/api/src/modules/opd/opd-prescription.service.ts`
- `apps/api/src/modules/opd/opd-prescription.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
