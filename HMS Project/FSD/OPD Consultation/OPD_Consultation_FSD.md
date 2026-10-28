# OPD Consultation Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | OPD Consultation |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Manage outpatient encounter progression, structured consultation and downstream clinical outputs.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Manage outpatient encounter progression, structured consultation and downstream clinical outputs. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Reception creates and checks in visits; Nurse records vitals; Doctor consults and orders; each action requires its own permission.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Appointments | Appointment Booking | Create |
| OPD | OPD Clinical Orders | Edit |
| OPD | OPD Clinical Orders | View |
| OPD | OPD Consultation | Edit |
| OPD | OPD Consultation | View |
| OPD | OPD Follow-up | Edit |
| OPD | OPD Follow-up | View |
| OPD | OPD Prescription | Edit |
| OPD | OPD Prescription | View |
| OPD | OPD Referral | Edit |
| OPD | OPD Referral | View |
| OPD | OPD Visits | Create |
| OPD | OPD Visits | Edit |
| OPD | OPD Visits | View |
| OPD | OPD Vitals | Create |
| OPD | OPD Vitals | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-OPD-001 | Documented source requirement; approval unverified. Subjective, objective, assessment and plan fields with free text and structured templates. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶507 | `apps/api/src/modules/opd/opd-consultation.service.ts:29` — saveDraft | Partial |
| FR-OPD-002 | Documented source requirement; approval unverified. Primary and secondary diagnosis with reference to diagnosis/ICD master. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶509 | `apps/api/src/modules/opd/opd-consultation.service.ts:29` — saveDraft | Partial |
| FR-OPD-003 | Documented source requirement; approval unverified. Prescription, lab order and imaging order created directly from the consultation. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶513 | `apps/api/src/modules/opd/opd-clinical-order.service.ts:44` — submit | Partial |
| FR-OPD-004 | Documented source requirement; approval unverified. Option to initiate an internal or external referral from within the consultation. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶515 | `apps/api/src/modules/opd/opd-referral.service.ts:86` — submit | Partial |
| FR-OPD-005 | Documented source requirement; approval unverified. System shall allow multiple simultaneous orders from one consultation. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶539 | `apps/api/src/modules/opd/opd-clinical-order.service.ts:44` — submit | Partial |
| FR-OPD-006 | Documented source requirement; approval unverified. System shall require permission, reason and audit trail. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶541 | `apps/api/src/modules/opd/opd-consultation.service.ts:57` — complete | Partial |
| FR-OPD-007 | Documented source requirement; approval unverified. System shall allow follow-up date/reminder to be scheduled. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶543 | `apps/api/src/modules/opd/opd-follow-up.service.ts:38` — schedule | Partial |
| FR-OPD-008 | Documented source requirement; approval unverified. Edits to completed notes are permission-controlled and audited. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶556 | `apps/api/src/modules/opd/opd-consultation.service.ts:57` — complete | Partial |
| FR-OPD-009 | Documented source requirement; approval unverified. Continue to create downstream requests from emergency/surgery/IP context while keeping records connected. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶255 | `apps/api/src/modules/opd/opd-clinical-order.service.ts:110` — submitForContext | Partial |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Create the OPD visit from appointment or walk-in.
2. Record and review vitals and patient history.
3. Open the doctor consultation and save structured notes.
4. Complete required consultation data.
5. Submit prescriptions and investigation requests through their owning services.
6. Create follow-up, referral or admission recommendation where applicable.
7. Complete the visit through allowed state transitions.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| CLINICAL_ORDER_SUBMITTED — A submitted clinical order cannot be edited | 400 | `apps/api/src/modules/opd/opd-clinical-order.service.ts:36` |
| CONSULTATION_NOT_COMPLETED — Complete the consultation before submitting clinical orders | 400 | `apps/api/src/modules/opd/opd-clinical-order.service.ts:55` |
| INVESTIGATION_REQUIRED — Add at least one investigation before submitting | 400 | `apps/api/src/modules/opd/opd-clinical-order.service.ts:63` |
| CONTEXT_CLINICAL_ORDER_CONFLICT — A different clinical order already exists for this source and department | 409 | `apps/api/src/modules/opd/opd-clinical-order.service.ts:124` |
| VALIDATION_ERROR — OPD visit id is invalid | 400 | `apps/api/src/modules/opd/opd-clinical-order.service.ts:131` |
| NOT_FOUND — OPD visit not found | 404 | `apps/api/src/modules/opd/opd-clinical-order.service.ts:135` |
| CONSULTATION_REQUIRED — Start the consultation before creating clinical orders | 400 | `apps/api/src/modules/opd/opd-clinical-order.service.ts:142` |
| VISIT_CLOSED — Clinical orders cannot be updated for a closed OPD visit | 400 | `apps/api/src/modules/opd/opd-clinical-order.service.ts:152` |
| DUPLICATE_SERVICE — A service can only be added once to an order | 400 | `apps/api/src/modules/opd/opd-clinical-order.service.ts:165` |
| VISIT_NOT_READY_FOR_CONSULTATION — Patient must complete the vitals handoff before consultation | 400 | `apps/api/src/modules/opd/opd-consultation.service.ts:143` |
| VITALS_REQUIRED — Vitals must be recorded before completing consultation | 400 | `apps/api/src/modules/opd/opd-consultation.service.ts:151` |
| FOLLOW_UP_SCHEDULED — A scheduled follow-up cannot be edited here | 400 | `apps/api/src/modules/opd/opd-follow-up.service.ts:33` |
| PRESCRIPTION_SUBMITTED — A submitted prescription cannot be edited | 400 | `apps/api/src/modules/opd/opd-prescription.service.ts:34` |
| MEDICATION_REQUIRED — Add at least one medication before submitting | 400 | `apps/api/src/modules/opd/opd-prescription.service.ts:53` |
| CONTEXT_PRESCRIPTION_CONFLICT — A different prescription already exists for this clinical context | 409 | `apps/api/src/modules/opd/opd-prescription.service.ts:97` |
| PRESCRIPTION_NOT_FOUND — Prescription not found | 404 | `apps/api/src/modules/opd/opd-prescription.service.ts:104` |
| BRANCH_ACCESS_DENIED — Branch access denied | 403 | `apps/api/src/modules/opd/opd-prescription.service.ts:108` |
| REFERRAL_NOT_FOUND — Submitted referral not found | 404 | `apps/api/src/modules/opd/opd-referral.service.ts:42` |
| REFERRAL_ALREADY_BOOKED — Referral is already booked | 409 | `apps/api/src/modules/opd/opd-referral.service.ts:44` |
| REFERRAL_NOT_BOOKABLE — Only an internal referral with an assigned HMS doctor can be booked | 400 | `apps/api/src/modules/opd/opd-referral.service.ts:46` |
| REFERRAL_BOOKING_CONFLICT — Referral was booked by another user; refresh the queue | 409 | `apps/api/src/modules/opd/opd-referral.service.ts:58` |
| REFERRAL_SUBMITTED — A submitted referral cannot be edited | 400 | `apps/api/src/modules/opd/opd-referral.service.ts:77` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/opd/clinical-context.schemas.ts`
- `apps/api/src/modules/opd/opd-clinical-order.schemas.ts`
- `apps/api/src/modules/opd/opd-consultation.schemas.ts`
- `apps/api/src/modules/opd/opd-follow-up.schemas.ts`
- `apps/api/src/modules/opd/opd-prescription.schemas.ts`
- `apps/api/src/modules/opd/opd-referral.schemas.ts`
- `apps/api/src/modules/opd/opd-visit.schemas.ts`
- `apps/api/src/modules/opd/opd-vitals.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/OpdQueuePage.tsx` | useAppLocation, useOpdQueue, useEffect, useMemo, useState |
| `apps/web/src/pages/OpdVisitPage.test.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/pages/OpdVisitPage.tsx` | useActiveBranch, useTimezone, useOpdVisitFeature, useState, useMemo, useEffect |
| `apps/web/src/hooks/opd/useOpdVisitFeature.test.tsx` | useOpdVisitFeature |
| `apps/web/src/hooks/opd/useOpdVisitFeature.ts` | useOpdVisitFeature, useAppLocation, useMemo, useState, useOpdWorkspace, useOpdVisits, useEffect, usePatientDetails |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/opd/visits/:visitId/clinical-orders/:orderType | opdClinicalOrders.getByVisitAndType | clinicalOrderParamsSchema | `apps/api/src/modules/opd/opd-clinical-order.routes.ts:11` |
| PUT /api/opd/visits/:visitId/clinical-orders/:orderType | opdClinicalOrders.saveDraft | saveClinicalOrderBodySchema, clinicalOrderParamsSchema | `apps/api/src/modules/opd/opd-clinical-order.routes.ts:25` |
| POST /api/opd/visits/:visitId/clinical-orders/:orderType/submit | opdClinicalOrders.submit | saveClinicalOrderBodySchema, clinicalOrderParamsSchema | `apps/api/src/modules/opd/opd-clinical-order.routes.ts:42` |
| GET /api/opd/visits/:visitId/consultation | opdConsultations.getByVisit | opdConsultationVisitParamsSchema | `apps/api/src/modules/opd/opd-consultation.routes.ts:16` |
| PUT /api/opd/visits/:visitId/consultation | opdConsultations.saveDraft | saveOpdConsultationBodySchema, opdConsultationVisitParamsSchema | `apps/api/src/modules/opd/opd-consultation.routes.ts:27` |
| POST /api/opd/visits/:visitId/consultation/complete | opdConsultations.complete | saveOpdConsultationBodySchema, opdConsultationVisitParamsSchema | `apps/api/src/modules/opd/opd-consultation.routes.ts:39` |
| GET /api/opd/visits/:visitId/follow-up | opdFollowUps.getByVisit | followUpVisitParamsSchema | `apps/api/src/modules/opd/opd-follow-up.routes.ts:11` |
| PUT /api/opd/visits/:visitId/follow-up | opdFollowUps.saveDraft | saveFollowUpBodySchema, followUpVisitParamsSchema | `apps/api/src/modules/opd/opd-follow-up.routes.ts:16` |
| POST /api/opd/visits/:visitId/follow-up/schedule | opdFollowUps.schedule | saveFollowUpBodySchema, followUpVisitParamsSchema | `apps/api/src/modules/opd/opd-follow-up.routes.ts:21` |
| GET /api/opd/prescriptions | opdPrescriptions.list | listOpdPrescriptionsQuerySchema | `apps/api/src/modules/opd/opd-prescription.routes.ts:15` |
| GET /api/opd/visits/:visitId/prescription | opdPrescriptions.getByVisit | opdPrescriptionVisitParamsSchema | `apps/api/src/modules/opd/opd-prescription.routes.ts:24` |
| PUT /api/opd/visits/:visitId/prescription | opdPrescriptions.saveDraft | saveOpdPrescriptionBodySchema, opdPrescriptionVisitParamsSchema | `apps/api/src/modules/opd/opd-prescription.routes.ts:33` |
| POST /api/opd/visits/:visitId/prescription/submit | opdPrescriptions.submit | saveOpdPrescriptionBodySchema, opdPrescriptionVisitParamsSchema | `apps/api/src/modules/opd/opd-prescription.routes.ts:43` |
| GET /api/opd/referrals | opdReferrals.listSubmitted | listSubmittedReferralsSchema | `apps/api/src/modules/opd/opd-referral.routes.ts:11` |
| POST /api/opd/referrals/:referralId/book | opdReferrals.book | referralIdParamsSchema, bookReferralBodySchema | `apps/api/src/modules/opd/opd-referral.routes.ts:15` |
| GET /api/opd/visits/:visitId/referral | opdReferrals.getByVisit | referralVisitParamsSchema | `apps/api/src/modules/opd/opd-referral.routes.ts:19` |
| PUT /api/opd/visits/:visitId/referral | opdReferrals.saveDraft | saveReferralBodySchema, referralVisitParamsSchema | `apps/api/src/modules/opd/opd-referral.routes.ts:24` |
| POST /api/opd/visits/:visitId/referral/submit | opdReferrals.submit | saveReferralBodySchema, referralVisitParamsSchema | `apps/api/src/modules/opd/opd-referral.routes.ts:29` |
| GET /api/opd/dashboard-summary | opdVisits.dashboardSummary | listOpdVisitsQuerySchema | `apps/api/src/modules/opd/opd-visit.routes.ts:18` |
| GET /api/opd/visits | opdVisits.list | listOpdVisitsQuerySchema | `apps/api/src/modules/opd/opd-visit.routes.ts:23` |
| GET /api/opd/visits/:id | opdVisits.getById | opdVisitIdParamsSchema | `apps/api/src/modules/opd/opd-visit.routes.ts:34` |
| POST /api/opd/visits | opdVisits.create | createOpdVisitBodySchema | `apps/api/src/modules/opd/opd-visit.routes.ts:45` |
| PATCH /api/opd/visits/:id/status | opdVisits.updateStatus | opdVisitIdParamsSchema, updateOpdVisitStatusBodySchema | `apps/api/src/modules/opd/opd-visit.routes.ts:59` |
| POST /api/opd/visits/:id/call-next | opdVisits.callNextPatient | opdVisitIdParamsSchema | `apps/api/src/modules/opd/opd-visit.routes.ts:71` |
| GET /api/opd/visits/:visitId/vitals | opdVitals.listByVisit | opdVitalsVisitParamsSchema, listOpdVitalsQuerySchema | `apps/api/src/modules/opd/opd-vitals.routes.ts:17` |
| GET /api/opd/visits/:visitId/vitals/latest | opdVitals.getLatestByVisit | opdVitalsVisitParamsSchema | `apps/api/src/modules/opd/opd-vitals.routes.ts:29` |
| POST /api/opd/visits/:visitId/vitals | opdVitals.create | createOpdVitalsBodySchema, opdVitalsVisitParamsSchema | `apps/api/src/modules/opd/opd-vitals.routes.ts:40` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### ClinicalSourceContext

`apps/api/src/modules/opd/clinical-context.types.ts:7`

| Field | Observed type |
| --- | --- |
| source_type | ClinicalContextSourceType |
| source_id | string |
| encounter_id | string \| null |
| admission_id | string \| null |
| procedure_id | string \| null |
| patient_id | string |
| patient_number | string |
| patient_name | string |
| doctor_id | string |
| doctor_name | string |
| branch_id | string |

### ClinicalOrderItem

`apps/api/src/modules/opd/opd-clinical-order.types.ts:17`

| Field | Observed type |
| --- | --- |
| id | string |
| service_id | string |
| service_name | string |
| investigation_name | string |
| category | string |

### OpdClinicalOrder

`apps/api/src/modules/opd/opd-clinical-order.types.ts:25`

| Field | Observed type |
| --- | --- |
| id | string |
| originating_order_id | string |
| source_type | ClinicalOrderSourceType |
| encounter_id | string \| null |
| admission_id | string \| null |
| procedure_id | string \| null |
| source_id | string |
| visit_id | string \| null |
| consultation_id | string \| null |
| patient_id | string |
| patient_number | string |
| patient_name | string |
| doctor_id | string |
| doctor_name | string |
| branch_id | string |
| order_type | ClinicalOrderType |
| status | ClinicalOrderStatus |
| priority | ClinicalOrderPriority |
| destination | string \| null |
| specimen_type | string \| null |
| items | ClinicalOrderItem[] |
| clinical_notes | string \| null |
| instructions | string \| null |
| submitted_at | Date \| null |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### OpdStructuredDiagnosis

`apps/api/src/modules/opd/opd-consultation.types.ts:5`

| Field | Observed type |
| --- | --- |
| code | string |
| display | string |
| codingSystem | string |
| type | OpdDiagnosisType |
| notes? | string \| null |

### OpdConsultation

`apps/api/src/modules/opd/opd-consultation.types.ts:13`

| Field | Observed type |
| --- | --- |
| id | string |
| visit_id | string |
| patient_id | string |
| patient_number | string |
| patient_name | string |
| doctor_id | string |
| doctor_name | string |
| status | OpdConsultationStatus |
| chief_complaint | string \| null |
| history_present_illness | string \| null |
| past_history | string \| null |
| family_history | string \| null |
| allergies | string \| null |
| physical_examination | string \| null |
| assessment | string \| null |
| diagnoses | OpdStructuredDiagnosis[] |
| treatment_plan | string \| null |
| doctor_notes | string \| null |
| completed_at | Date \| null |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### OpdFollowUp

`apps/api/src/modules/opd/opd-follow-up.types.ts:5`

| Field | Observed type |
| --- | --- |
| id | string |
| visit_id | string |
| consultation_id | string |
| patient_id | string |
| patient_number | string |
| patient_name | string |
| originating_doctor_id | string |
| originating_doctor_name | string |
| assigned_doctor_id | string \| null |
| assigned_doctor_name | string \| null |
| appointment_id | string \| null |
| appointment_number | string \| null |
| follow_up_type | OpdFollowUpType \| null |
| next_visit_date | Date \| null |
| start_time | string \| null |
| duration_minutes | number \| null |
| reason | string \| null |
| reminder_type | OpdFollowUpReminderType |
| notes | string \| null |
| status | OpdFollowUpStatus |
| scheduled_at | Date \| null |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| ClinicalOrderStatus | \| 'DRAFT' \| 'SUBMITTED' \| 'RECEIVED' \| 'SAMPLE_COLLECTED' \| 'IN_PROGRESS' \| 'RESULT_ENTERED' \| 'REPORT_ENTERED' \| 'VERIFIED' \| 'COMPLETED' | `apps/api/src/modules/opd/opd-clinical-order.types.ts:4` |
| OpdConsultationStatus | 'DRAFT' \| 'COMPLETED' | `apps/api/src/modules/opd/opd-consultation.types.ts:1` |
| OpdFollowUpStatus | 'DRAFT' \| 'SCHEDULED' | `apps/api/src/modules/opd/opd-follow-up.types.ts:1` |
| OpdPrescriptionStatus | 'DRAFT' \| 'SUBMITTED' \| 'DISPENSED' \| 'CANCELLED' | `apps/api/src/modules/opd/opd-prescription.types.ts:1` |
| OpdReferralStatus | 'DRAFT' \| 'SUBMITTED' | `apps/api/src/modules/opd/opd-referral.types.ts:1` |
| OpdVisitStatus | \| 'CHECKED_IN' \| 'WAITING_FOR_VITALS' \| 'READY_FOR_CONSULTATION' \| 'IN_CONSULTATION' \| 'SKIPPED' \| 'COMPLETED' \| 'CANCELLED' \| 'NO_SHOW' | `apps/api/src/modules/opd/opd-visit.types.ts:1` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Appointments; Nursing and Triage; Patient Management; Prescriptions; Laboratory; Imaging; Referral Management; IPD; Surgery.

Observed backend import domains: `appointments`, `auth`, `branches`, `doctors`, `notifications`, `patients`, `roles`, `services`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/opd/opd-visit.service.ts:179` — await executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/opd/opd-visit.service.ts:248` — await executeTransaction(this.repository, async (session) => {

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-OPD-001 | FR-OPD-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Subjective, objective, assessment and plan fields with free text and structured templates. |
| AC-OPD-002 | FR-OPD-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Primary and secondary diagnosis with reference to diagnosis/ICD master. |
| AC-OPD-003 | FR-OPD-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Prescription, lab order and imaging order created directly from the consultation. |
| AC-OPD-004 | FR-OPD-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Option to initiate an internal or external referral from within the consultation. |
| AC-OPD-005 | FR-OPD-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall allow multiple simultaneous orders from one consultation. |
| AC-OPD-006 | FR-OPD-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall require permission, reason and audit trail. |
| AC-OPD-007 | FR-OPD-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall allow follow-up date/reminder to be scheduled. |
| AC-OPD-008 | FR-OPD-008 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Edits to completed notes are permission-controlled and audited. |
| AC-OPD-009 | FR-OPD-009 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Continue to create downstream requests from emergency/surgery/IP context while keeping records connected. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-OPD-01: R1 permits consultation-driven orders; current service prerequisites and other-branch Ophthalmology open-consultation ordering may differ.
- GAP-OPD-02: Confirm editing completed notes, required vitals exceptions and diagnosis terminology.
- GAP-OPD-03: An OPD status change is not proof of successful downstream completion.
- GAP-OPD-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/OPD Consultation/M-010_OPD_VISIT_LAYERING_GAP_NOTE.md` | a146125596499ba94d9998d734c8920c77cd19e80153322041b059be261d79d0 | Historical design evidence |
| `HMS Project/Design/OPD Consultation/review.md` | 19b26a86e45769775d6622f0141ce8e40ab37dc1614d99c13c10c29de8b2a01f | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/opd/clinical-context.schemas.ts`
- `apps/api/src/modules/opd/clinical-context.types.ts`
- `apps/api/src/modules/opd/opd-clinical-order.model.ts`
- `apps/api/src/modules/opd/opd-clinical-order.repository.ts`
- `apps/api/src/modules/opd/opd-clinical-order.routes.ts`
- `apps/api/src/modules/opd/opd-clinical-order.schemas.ts`
- `apps/api/src/modules/opd/opd-clinical-order.service.ts`
- `apps/api/src/modules/opd/opd-clinical-order.types.ts`
- `apps/api/src/modules/opd/opd-consultation.model.ts`
- `apps/api/src/modules/opd/opd-consultation.repository.ts`
- `apps/api/src/modules/opd/opd-consultation.routes.ts`
- `apps/api/src/modules/opd/opd-consultation.schemas.ts`
- `apps/api/src/modules/opd/opd-consultation.service.ts`
- `apps/api/src/modules/opd/opd-consultation.types.ts`
- `apps/api/src/modules/opd/opd-follow-up.model.ts`
- `apps/api/src/modules/opd/opd-follow-up.repository.ts`
- `apps/api/src/modules/opd/opd-follow-up.routes.ts`
- `apps/api/src/modules/opd/opd-follow-up.schemas.ts`
- `apps/api/src/modules/opd/opd-follow-up.service.ts`
- `apps/api/src/modules/opd/opd-follow-up.types.ts`
- `apps/api/src/modules/opd/opd-prescription.model.ts`
- `apps/api/src/modules/opd/opd-prescription.repository.ts`
- `apps/api/src/modules/opd/opd-prescription.routes.ts`
- `apps/api/src/modules/opd/opd-prescription.schemas.ts`
- `apps/api/src/modules/opd/opd-prescription.service.ts`
- `apps/api/src/modules/opd/opd-prescription.types.ts`
- `apps/api/src/modules/opd/opd-referral.model.ts`
- `apps/api/src/modules/opd/opd-referral.repository.ts`
- `apps/api/src/modules/opd/opd-referral.routes.ts`
- `apps/api/src/modules/opd/opd-referral.schemas.ts`
- `apps/api/src/modules/opd/opd-referral.service.ts`
- `apps/api/src/modules/opd/opd-referral.types.ts`
- `apps/api/src/modules/opd/opd-visit.model.ts`
- `apps/api/src/modules/opd/opd-visit.repository.ts`
- `apps/api/src/modules/opd/opd-visit.routes.ts`
- `apps/api/src/modules/opd/opd-visit.schemas.ts`
- `apps/api/src/modules/opd/opd-visit.service.ts`
- `apps/api/src/modules/opd/opd-visit.types.ts`
- `apps/api/src/modules/opd/opd-vitals.model.ts`
- `apps/api/src/modules/opd/opd-vitals.repository.ts`
- `apps/api/src/modules/opd/opd-vitals.routes.ts`
- `apps/api/src/modules/opd/opd-vitals.schemas.ts`
- `apps/api/src/modules/opd/opd-vitals.service.ts`
- `apps/api/src/modules/opd/opd-vitals.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
