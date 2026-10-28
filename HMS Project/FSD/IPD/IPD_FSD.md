# IPD Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | IPD |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Manage admission requests, confirmation, inpatient clinical activity and discharge while preserving source encounters.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Manage admission requests, confirmation, inpatient clinical activity and discharge while preserving source encounters. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Doctor requests admission; Admission Officer validates and confirms; ward clinician records care; authorized billing staff handle deposits.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Admissions | Admission Recommendations | Create |
| Admissions | Admission Requests | Cancel |
| Admissions | Admission Requests | Confirm |
| Admissions | Admission Requests | Create |
| Admissions | Admission Requests | Validate |
| Admissions | Admission Requests | View |
| Admissions | Inpatient Admissions | Create |
| Admissions | Inpatient Admissions | Discharge |
| Admissions | Inpatient Admissions | Edit |
| Admissions | Inpatient Admissions | View |
| OPD | OPD Clinical Orders | Edit |
| OPD | OPD Clinical Orders | View |
| OPD | OPD Prescription | Edit |
| OPD | OPD Prescription | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-IPD-001 | Documented source requirement; approval unverified. Release 1 shall provide an end-to-end admission workflow from OPD, Emergency or direct referral, covering admission request, clinical/administrative approval, ward allocation, bed allocation and ongoing admission status tracking through to discharge readiness. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶632 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:190` — createRequest | Partial |
| FR-IPD-002 | Documented source requirement; approval unverified. Approving authority, admission conditions (e.g. deposit/insurance pre-authorization per policy), approval date/time and remarks. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶639 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:228` — validateRequest | Partial |
| FR-IPD-003 | Documented source requirement; approval unverified. Status lifecycle: Requested, Approved, Awaiting Bed, Admitted, Transferred, Discharge-Planned, Discharged. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶645 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:242` — confirmRequest | Partial |
| FR-IPD-004 | Documented source requirement; approval unverified. System shall allow ward/bed transfer while preserving admission history and updating both bed statuses. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶674 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-IPD-005 | Documented source requirement; approval unverified. Ward/bed transfer during an admission is supported without losing admission history. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶689 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-IPD-006 | Documented source requirement; approval unverified. 3. System checks existing active admission/IP context to avoid duplicate admission. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶331 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:190` — createRequest | Partial |
| FR-IPD-007 | Documented source requirement; approval unverified. 7. Consent form is attached where required. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶335 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:228` — validateRequest | Partial |
| FR-IPD-008 | Documented source requirement; approval unverified. 8. Advance payment/deposit is captured if required by configuration. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶336 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:228` — validateRequest | Partial |
| FR-IPD-009 | Documented source requirement; approval unverified. 9. Admission/IP context is created and linked to patient EMR timeline. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶337 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:242` — confirmRequest | Partial |
| FR-IPD-010 | Documented source requirement; approval unverified. 10. Emergency or OPD encounter is updated as converted to IP where applicable. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶338 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:242` — confirmRequest | Partial |
| FR-IPD-011 | Implementation observation — business validation required. Record inpatient round notes and vitals against an active admission. | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:89` | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:89` — createRoundNote | Implemented |
| FR-IPD-012 | Implementation observation — business validation required. Reject final discharge when its checklist is incomplete. | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:138` | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:138` — finalizeDischarge | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Create an admission request from OPD, Emergency or an allowed direct context.
2. Verify patient, source encounter and absence of an active admission.
3. Select eligible bed or hold and evaluate configured consent and deposit requirements.
4. Confirm admission and convert the originating context atomically.
5. Record inpatient rounds, vitals, prescriptions and clinical orders.
6. Complete discharge summary and checklist.
7. Finalize discharge and release the occupied bed through the owning service.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| ACTIVE_ADMISSION_CONFLICT — An active admission request or admission already exists for this patient or source | 409 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:17` |
| ADMISSION_NOT_FOUND — Inpatient admission not found | 404 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:37` |
| ADMISSION_REQUEST_NOT_FOUND — Admission request not found | 404 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:46` |
| INPATIENT_CONTEXT_NOT_ACTIVE — Inpatient admission is not active | 409 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:57` |
| ADMISSION_STATE_CONFLICT — Cancelled admission cannot record a discharge summary | 409 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:119` |
| DISCHARGE_CHECKLIST_INCOMPLETE — Clinical discharge readiness checklist must be fully completed and finalized by the attending doctor before final discharge | 409 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:160` |
| VALIDATION_ERROR — Source id is required | 400 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:192` |
| PATIENT_NOT_FOUND — Active patient not found | 404 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:197` |
| DOCTOR_NOT_FOUND — Active recommending doctor is not available in this branch | 404 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:198` |
| DEPARTMENT_NOT_FOUND — Active department is not available in this branch | 404 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:199` |
| PATIENT_ALREADY_ADMITTED — This patient already has an active inpatient admission | 409 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:200` |
| DUPLICATE_ADMISSION_REQUEST — This patient already has a pending admission request | 409 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:201` |
| ADMISSION_SOURCE_MISMATCH — OPD source context does not match the request | 409 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:205` |
| SOURCE_ALREADY_CONVERTED — This OPD visit has already been converted to an admission | 409 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:206` |
| ADMISSION_SOURCE_NOT_FOUND — Submitted referral source was not found | 404 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:211` |
| ADMISSION_REQUEST_STATE_CONFLICT — Admission request cannot be validated in its current state | 409 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:232` |
| ACTIVE_ADMISSION_EXISTS — Patient already has an active inpatient admission | 409 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:234` |
| ADMISSION_REQUEST_NOT_READY — Validate this request before confirmation | 409 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:250` |
| ADMISSION_CONTEXT_INVALID — Admission references are no longer active | 409 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:259` |
| ADMISSION_CREATE_FAILED — Admission could not be reloaded for bed allotment | 500 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:261` |
| ADMISSION_SOURCE_ALREADY_CONVERTED — The Emergency encounter was changed or already converted | 409 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:266` |
| BRANCH_ACCESS_DENIED — Branch access denied | 403 | `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:294` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/inpatient-admissions/inpatient-admission.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/InpatientAdmissionPage.tsx` | useAppLocation, useMemo, useState, useInpatientAdmissionFeature, useEffect |
| `apps/web/src/pages/InpatientWorkspacePage.test.tsx` | useFeature |
| `apps/web/src/pages/InpatientWorkspacePage.tsx` | useState, useEffect, useInpatientWorkspaceFeature, useMemo |
| `apps/web/src/hooks/admissions/useInpatientAdmissionFeature.test.tsx` | useInpatientAdmissionFeature |
| `apps/web/src/hooks/admissions/useInpatientWorkspaceFeature.test.tsx` | useInpatientWorkspaceFeature |
| `apps/web/src/hooks/admissions/useInpatientAdmissionFeature.ts` | useInpatientAdmissionFeature, useAuth, useAppLocation, useMemo, useState, useInpatientAdmissions, useEffect, useOpdVisits |
| `apps/web/src/hooks/admissions/useInpatientDownstreamFeature.ts` | useInpatientDownstreamFeature, useInpatientDownstream, useServicesList |
| `apps/web/src/hooks/admissions/useInpatientWorkspaceFeature.ts` | useInpatientWorkspaceFeature, useAuth, useAppLocation, useMemo, useBranchesList, useState, useEffect, useWardsList |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/admissions/inpatients | inpatientAdmissions.list | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:23` |
| GET /api/admissions/inpatients/:id | inpatientAdmissions.get | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:24` |
| GET /api/admissions/inpatients/:id/prescription | inpatientAdmissions.getPrescription | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:25` |
| POST /api/admissions/inpatients/:id/prescription | inpatientAdmissions.submitPrescription | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:26` |
| GET /api/admissions/inpatients/:id/clinical-orders/:orderType | inpatientAdmissions.getClinicalOrder | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:27` |
| POST /api/admissions/inpatients/:id/clinical-orders/:orderType | inpatientAdmissions.submitClinicalOrder | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:28` |
| GET /api/admissions/inpatients/:id/round-notes | inpatientAdmissions.listRoundNotes | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:29` |
| POST /api/admissions/inpatients/:id/round-notes | inpatientAdmissions.createRoundNote | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:30` |
| GET /api/admissions/inpatients/:id/vitals | inpatientAdmissions.listVitals | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:31` |
| POST /api/admissions/inpatients/:id/vitals | inpatientAdmissions.createVital | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:32` |
| POST /api/admissions/inpatients/:id/discharge-summary | inpatientAdmissions.saveDischargeSummary | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:33` |
| POST /api/admissions/inpatients/:id/finalize-discharge | inpatientAdmissions.finalizeDischarge | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:34` |
| GET /api/admissions/request-stats | inpatientAdmissions.getRequestStatusCounts | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:36` |
| GET /api/admissions/requests | inpatientAdmissions.listRequests | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:41` |
| GET /api/admissions/requests/:id | inpatientAdmissions.getRequest | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:42` |
| POST /api/admissions/requests | inpatientAdmissions.createRequest | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:43` |
| POST /api/admissions/recommendations | inpatientAdmissions.createRequest | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:44` |
| PATCH /api/admissions/requests/:id/validate | inpatientAdmissions.validateRequest | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:45` |
| POST /api/admissions/requests/:id/confirm | inpatientAdmissions.confirmRequest | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:46` |
| POST /api/admissions/requests/:id/cancel | inpatientAdmissions.cancelRequest | Inline/custom validation; inspect source | `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts:47` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### InpatientDischargeSummary

`apps/api/src/modules/inpatient-admissions/inpatient-admission.types.ts:37`

| Field | Observed type |
| --- | --- |
| hemodynamic_stability_24h | boolean |
| post_op_recovery_cleared | boolean |
| home_oral_med_converted | boolean |
| summary_finalized | boolean |
| notes | string \| null |
| saved_by | string \| null |
| saved_by_name | string \| null |
| saved_at | Date \| null |

### InpatientAdmission

`apps/api/src/modules/inpatient-admissions/inpatient-admission.types.ts:62`

| Field | Observed type |
| --- | --- |
| id | string |
| admission_number | string |
| patient_id | string |
| patient_number | string |
| patient_name | string |
| branch_id | string |
| ward_id | string |
| ward_name | string |
| bed_id | string |
| bed_number | string |
| admitting_doctor_id | string |
| admitting_doctor_name | string |
| department_id | string |
| department_name | string |
| admission_date | Date |
| admission_type | AdmissionType |
| reason | string |
| notes | string \| null |
| status | AdmissionStatus |
| request_id | string \| null |
| source_type | AdmissionSourceType |
| source_id | string \| null |
| discharge_summary | InpatientDischargeSummary \| null |
| discharged_at | Date \| null |
| discharged_by | string \| null |
| discharged_by_name | string \| null |
| created_at | Date |
| updated_at | Date |

### AdmissionPrerequisiteSnapshot

`apps/api/src/modules/inpatient-admissions/inpatient-admission.types.ts:93`

| Field | Observed type |
| --- | --- |
| consent_required | boolean |
| consent_satisfied | boolean |
| consent_document_id | string \| null |
| consent_kind | string \| null |
| consent_signed_at | Date \| null |
| deposit_required | boolean |
| deposit_satisfied | boolean |
| deposit_required_amount | number |
| deposit_paid_amount | number |
| deposit_invoice_id | string \| null |
| deposit_payment_ids | string[] |
| verified_at | Date |

### AdmissionRequest

`apps/api/src/modules/inpatient-admissions/inpatient-admission.types.ts:108`

| Field | Observed type |
| --- | --- |
| id | string |
| request_number | string |
| patient_id | string |
| patient_number | string |
| patient_name | string |
| branch_id | string |
| department_id | string |
| department_name | string |
| recommending_doctor_id | string |
| recommending_doctor_name | string |
| source_type | AdmissionSourceType |
| source_id | string \| null |
| source_reference | string \| null |
| admission_type | AdmissionType |
| priority | AdmissionPriority |
| reason | string |
| notes | string \| null |
| status | AdmissionRequestStatus |
| hold_id | string \| null |
| ward_id | string \| null |
| bed_id | string \| null |
| consent_document_id | string \| null |
| deposit_invoice_id | string \| null |
| prerequisite_snapshot | AdmissionPrerequisiteSnapshot \| null |
| admission_id | string \| null |
| cancellation_reason | string \| null |
| created_at | Date |
| updated_at | Date |

### AdmissionRequestStats

`apps/api/src/modules/inpatient-admissions/inpatient-admission.types.ts:173`

| Field | Observed type |
| --- | --- |
| pendingValidation | number |
| readyForConfirmation | number |
| confirmed | number |
| cancelled | number |

### SaveDischargeSummaryDTO

`apps/api/src/modules/inpatient-admissions/inpatient-admission.types.ts:29`

| Field | Observed type |
| --- | --- |
| hemodynamic_stability_24h | boolean |
| post_op_recovery_cleared | boolean |
| home_oral_med_converted | boolean |
| summary_finalized | boolean |
| notes? | string \| null |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| AdmissionStatus | 'DRAFT' \| 'ADMITTED' \| 'DISCHARGED' \| 'CANCELLED' | `apps/api/src/modules/inpatient-admissions/inpatient-admission.types.ts:15` |
| AdmissionRequestStatus | 'PENDING_VALIDATION' \| 'READY_FOR_CONFIRMATION' \| 'CONFIRMED' \| 'CANCELLED' | `apps/api/src/modules/inpatient-admissions/inpatient-admission.types.ts:26` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Bed and Ward Management; Patient Management; Emergency; OPD Consultation; Consent Management; Billing; Advance Payments.

Observed backend import domains: `admissions-configuration`, `advance-payment`, `auth`, `billing`, `branches`, `departments`, `doctors`, `emergency`, `opd`, `patients`, `roles`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:55` — return executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:73` — return executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:92` — return executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:107` — return executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:122` — return executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:142` — return executeTransaction(this.repository, async (session) => {

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-IPD-001 | FR-IPD-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Release 1 shall provide an end-to-end admission workflow from OPD, Emergency or direct referral, covering admission request, clinical/administrative approval, ward allocation, bed allocation and ongoing admission status tracking through to discharge readiness. |
| AC-IPD-002 | FR-IPD-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Approving authority, admission conditions (e.g. deposit/insurance pre-authorization per policy), approval date/time and remarks. |
| AC-IPD-003 | FR-IPD-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Status lifecycle: Requested, Approved, Awaiting Bed, Admitted, Transferred, Discharge-Planned, Discharged. |
| AC-IPD-004 | FR-IPD-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall allow ward/bed transfer while preserving admission history and updating both bed statuses. |
| AC-IPD-005 | FR-IPD-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Ward/bed transfer during an admission is supported without losing admission history. |
| AC-IPD-006 | FR-IPD-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: 3. System checks existing active admission/IP context to avoid duplicate admission. |
| AC-IPD-007 | FR-IPD-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: 7. Consent form is attached where required. |
| AC-IPD-008 | FR-IPD-008 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: 8. Advance payment/deposit is captured if required by configuration. |
| AC-IPD-009 | FR-IPD-009 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: 9. Admission/IP context is created and linked to patient EMR timeline. |
| AC-IPD-010 | FR-IPD-010 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: 10. Emergency or OPD encounter is updated as converted to IP where applicable. |
| AC-IPD-011 | FR-IPD-011 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Record inpatient round notes and vitals against an active admission. |
| AC-IPD-012 | FR-IPD-012 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Reject final discharge when its checklist is incomplete. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-IPD-01: R1 requested/approved/awaiting-bed/transfer/discharge-planned labels differ from current request and admission enums.
- GAP-IPD-02: Confirm administrative approval authority, discharge checklist and inpatient running-bill policy.
- GAP-IPD-03: Old notes describing only list/get/create are outdated; current service supports requests and clinical workspace operations.
- GAP-IPD-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/IPD/HMS_SCOPE2_PHASE3_ADMISSION_REQUEST_REFACTOR_GAP_NOTE.md` | 261fcb23384b0d449193543a72c58a504e3f8a0885a1cad775698444bd35937a | Historical design evidence |
| `HMS Project/Design/IPD/M-010_INPATIENT_WORKSPACE_LAYERING_GAP_NOTE.md` | 0e886019231b773e0dda638474a74e7c93772add68885a6511d9c8a537c13679 | Historical design evidence |
| `HMS Project/Design/IPD/M-010_INPATIENT_WORKSPACE_LAYERING_VERIFICATION.md` | 197151291b5f62ab68465bd8a5763f3900075321aed04127ea2bfdaf94c6f7a4 | Historical design evidence |
| `HMS Project/Design/IPD/review.md` | 985d0e98c48f093ce588e623b2dcfe489bd343303139cb4fcd083efa2fa38ee4 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts` | 8491682343e47c17ee84976bf0585fc049ed7b71d6df1f15ea75ac218f4ac149 | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/inpatient-admissions/index.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.model.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.schemas.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.types.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-clinical-record.model.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
