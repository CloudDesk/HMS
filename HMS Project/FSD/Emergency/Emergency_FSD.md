# Emergency Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Emergency |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Process emergency registration, triage, evaluation, downstream orders and disposition in one encounter.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Process emergency registration, triage, evaluation, downstream orders and disposition in one encounter. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Emergency clinician or nurse; emergency doctor; Reception and Admission Officer for conversion; authorized billing user.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Appointments | Appointment Booking | Create |
| Emergency | Consultation | Edit |
| Emergency | Disposition | Cancel |
| Emergency | Disposition | MarkLeft |
| Emergency | Disposition | MarkNoShow |
| Emergency | Encounters | Register |
| Emergency | Encounters | View |
| Emergency | Orders | Create |
| Emergency | Patient Linking | Correct |
| Emergency | Patient Linking | Link |
| Emergency | Triage | OverridePriority |
| OPD | OPD Referral | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-ER-001 | Documented source requirement; approval unverified. Minimum-data registration (name/estimated age/sex if identity unknown), unidentified/John Doe patient support, mode of arrival (walk-in, ambulance, referral) and instant MRN generation without payment blocking. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶562 | `apps/api/src/modules/emergency/emergency.service.ts:265` — create | Partial |
| FR-ER-002 | Documented source requirement; approval unverified. Real-time ED queue displaying triage category, waiting time and treating clinician; queue re-sequenced automatically by triage priority, not arrival time alone. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶564 | `apps/api/src/modules/emergency/emergency.service.ts:127` — list | Partial |
| FR-ER-003 | Documented source requirement; approval unverified. Triage category configuration (e.g. Red/Critical, Yellow/Urgent, Green/Non-Urgent) using a configurable triage scale, vitals capture and time-stamped triage decision. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶566 | `apps/api/src/modules/emergency/emergency.service.ts:417` — triage | Partial |
| FR-ER-004 | Documented source requirement; approval unverified. Treatment/procedure log, medication administration record (time, dose, administering nurse) and response-to-treatment notes. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶570 | `apps/api/src/modules/emergency/emergency.service.ts:605` — consultation | Partial |
| FR-ER-005 | Documented source requirement; approval unverified. Disposition decision (admit to IPD, discharge, refer out, transfer, or deceased) captured with clinician sign-off and time stamp; admit triggers Admission Management directly. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶572 | `apps/api/src/modules/emergency/emergency.service.ts:920` — disposition | Partial |
| FR-ER-006 | Documented source requirement; approval unverified. System shall allow treatment to proceed and billing to be settled after stabilization per client policy. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶606 | `apps/api/src/modules/emergency/emergency.service.ts:920` — disposition | Partial |
| FR-ER-007 | Documented source requirement; approval unverified. Link emergency encounter to existing patient record. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶358 | `apps/api/src/modules/emergency/emergency.service.ts:343` — linkPatient | Partial |
| FR-ER-008 | Documented source requirement; approval unverified. Create downstream requests linked to emergency encounter. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶360 | `apps/api/src/modules/emergency/emergency.service.ts:744` — order | Partial |
| FR-ER-009 | Documented source requirement; approval unverified. Route to Reception/admission workflow for bed allotment and advance payment if required. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶364 | `apps/api/src/modules/emergency/emergency.service.ts:920` — disposition | Partial |
| FR-ER-010 | Documented source requirement; approval unverified. Mark status as left/abandoned with reason and pending billing status if applicable. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶366 | `apps/api/src/modules/emergency/emergency.service.ts:1074` — markLeft | Partial |
| FR-ER-011 | Implementation observation — business validation required. Allow an authorized priority override through its dedicated service path. | `apps/api/src/modules/emergency/emergency.service.ts:530` | `apps/api/src/modules/emergency/emergency.service.ts:530` — overridePriority | Implemented |
| FR-ER-012 | Implementation observation — business validation required. Link a temporary emergency record to a patient using the guarded linking operation. | `apps/api/src/modules/emergency/emergency.service.ts:343` | `apps/api/src/modules/emergency/emergency.service.ts:343` — linkPatient | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Search existing identity or register minimum emergency information according to policy.
2. Create the emergency encounter and queue entry.
3. Capture triage and priority with timestamps.
4. Call the patient for clinician evaluation and record consultation.
5. Submit pharmacy, laboratory or imaging requests in the emergency context.
6. Record disposition and either discharge, refer or hand off to IP admission.
7. Resolve billing closure and timeline updates under the applicable policy.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| EMERGENCY_STATE_CONFLICT — Emergency request conflicts with an existing record | 409 | `apps/api/src/modules/emergency/emergency.service.ts:28` |
| BRANCH_ACCESS_DENIED — Branch access denied | 403 | `apps/api/src/modules/emergency/emergency.service.ts:47` |
| DEPARTMENT_ACCESS_DENIED — Department access denied | 403 | `apps/api/src/modules/emergency/emergency.service.ts:53` |
| EMERGENCY_ENCOUNTER_NOT_ACTIONABLE — Encounter is not actionable from its current state | 409 | `apps/api/src/modules/emergency/emergency.service.ts:91` |
| EMERGENCY_ENCOUNTER_NOT_FOUND — Emergency encounter not found | 404 | `apps/api/src/modules/emergency/emergency.service.ts:123` |
| EMERGENCY_REFERRAL_NOT_FOUND — Submitted Emergency referral not found | 404 | `apps/api/src/modules/emergency/emergency.service.ts:152` |
| EMERGENCY_DOCTOR_REQUIRED — Doctor evaluation is required before referral | 409 | `apps/api/src/modules/emergency/emergency.service.ts:171` |
| EMERGENCY_REFERRAL_ALREADY_SUBMITTED — An Emergency referral is already submitted for this encounter | 409 | `apps/api/src/modules/emergency/emergency.service.ts:181` |
| DEPARTMENT_NOT_FOUND — Target clinical department was not found in this branch | 404 | `apps/api/src/modules/emergency/emergency.service.ts:186` |
| DOCTOR_NOT_FOUND — Target doctor was not found in the selected department | 404 | `apps/api/src/modules/emergency/emergency.service.ts:191` |
| EMERGENCY_REFERRAL_CONFLICT — Emergency referral was submitted concurrently; refresh and retry | 409 | `apps/api/src/modules/emergency/emergency.service.ts:204` |
| EMERGENCY_PATIENT_REQUIRED — Link a registered patient before booking this Emergency referral | 409 | `apps/api/src/modules/emergency/emergency.service.ts:227` |
| REFERRED_DOCTOR_REQUIRED — Assign an HMS doctor before booking this Emergency referral | 400 | `apps/api/src/modules/emergency/emergency.service.ts:229` |
| EMERGENCY_REFERRAL_BOOKING_CONFLICT — Emergency referral was booked concurrently; refresh the queue | 409 | `apps/api/src/modules/emergency/emergency.service.ts:251` |
| BRANCH_NOT_FOUND — Active branch not found | 404 | `apps/api/src/modules/emergency/emergency.service.ts:270` |
| PATIENT_NOT_FOUND — Active patient not found | 404 | `apps/api/src/modules/emergency/emergency.service.ts:278` |
| EMERGENCY_PATIENT_LINK_CONFLICT — Terminal encounter identity cannot be changed | 409 | `apps/api/src/modules/emergency/emergency.service.ts:356` |
| VALIDATION_ERROR — Correction reason is required | 400 | `apps/api/src/modules/emergency/emergency.service.ts:368` |
| ATTENDING_DOCTOR_REQUIRED — Attending doctor could not be established | 400 | `apps/api/src/modules/emergency/emergency.service.ts:641` |
| EMERGENCY_SOURCE_CONTEXT_UNSUPPORTED — Link an existing patient before placing downstream orders | 409 | `apps/api/src/modules/emergency/emergency.service.ts:780` |
| CLINICAL_ORDER_SERVICE_NOT_FOUND — One or more active catalogue services were not found | 404 | `apps/api/src/modules/emergency/emergency.service.ts:845` |
| EMERGENCY_DISPOSITION_NOT_ALLOWED — Doctor evaluation is required before disposition | 409 | `apps/api/src/modules/emergency/emergency.service.ts:931` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/emergency/emergency.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/EmergencyDashboardPage.test.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/pages/EmergencyDashboardPage.tsx` | useEmergencyWorkspaceFeature, useState, useMemo |
| `apps/web/src/pages/EmergencyQueuePage.test.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/pages/EmergencyQueuePage.tsx` | useEmergencyWorkspaceFeature, useState, useMemo |
| `apps/web/src/pages/EmergencyWorkspacePage.test.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/pages/EmergencyWorkspacePage.tsx` | useEmergencyWorkspaceFeature, useState, useEffect |
| `apps/web/src/hooks/emergency/useEmergencyWorkspaceFeature.test.tsx` | useEmergencyWorkspaceFeature |
| `apps/web/src/hooks/emergency/useEmergencyWorkspaceFeature.ts` | useEmergencyWorkspaceFeature, useAuth, useAppLocation, useState, useBranchesList, useEffect, useEmergency, useDepartmentsList |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/emergency/referrals | emergency.listReferrals | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:115` |
| GET /api/emergency/encounters/:id/referral | emergency.getReferral | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:121` |
| POST /api/emergency/encounters/:id/referral | emergency.submitReferral | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:130` |
| POST /api/emergency/encounters/:id/referral/book | emergency.bookReferral | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:145` |
| GET /api/emergency/encounters | emergency.list | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:165` |
| GET /api/emergency/summary | emergency.summary | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:173` |
| GET /api/emergency/encounters/:id | emergency.get | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:181` |
| POST /api/emergency/encounters | emergency.create | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:192` |
| POST /api/emergency/encounters/:id/link-patient | emergency.linkPatient | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:208` |
| POST /api/emergency/encounters/:id/correct-patient | emergency.linkPatient | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:228` |
| POST /api/emergency/encounters/:id/triage | emergency.triage | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:248` |
| POST /api/emergency/encounters/:id/override-priority | emergency.overridePriority | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:267` |
| POST /api/emergency/encounters/:id/call | emergency.call | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:286` |
| POST /api/emergency/encounters/:id/skip | emergency.skip | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:303` |
| PUT /api/emergency/encounters/:id/consultation | emergency.consultation | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:326` |
| POST /api/emergency/encounters/:id/orders | emergency.order | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:343` |
| POST /api/emergency/encounters/:id/disposition | emergency.disposition | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:364` |
| POST /api/emergency/encounters/:id/no-show | emergency.markNoShow | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:383` |
| POST /api/emergency/encounters/:id/left | emergency.markLeft | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:400` |
| POST /api/emergency/encounters/:id/cancel | emergency.cancel | Inline/custom validation; inspect source | `apps/api/src/modules/emergency/emergency.routes.ts:417` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### CreateEmergencyDTO

`apps/api/src/modules/emergency/emergency.types.ts:30`

| Field | Observed type |
| --- | --- |
| branch_id | string |
| department_id | string |
| patient_id? | string \| null |
| display_name | string |
| estimated_age? | number \| null |
| gender? | 'MALE' \| 'FEMALE' \| 'OTHER' \| 'UNKNOWN' \| null |
| contact? | string \| null |
| identity_notes? | string \| null |
| arrival_mode | string |
| arrival_at? | string |
| chief_complaint | string |
| arrival_notes? | string \| null |

### EmergencyTriageDTO

`apps/api/src/modules/emergency/emergency.types.ts:46`

| Field | Observed type |
| --- | --- |
| level | EmergencyTriageLevel |
| area | string |
| pain_score? | number \| null |
| systolic_bp? | number \| null |
| diastolic_bp? | number \| null |
| pulse? | number \| null |
| temperature_c? | number \| null |
| spo2? | number \| null |
| respiratory_rate? | number \| null |
| gcs? | number \| null |
| airway | string |
| breathing | string |
| circulation | string |
| disability | string |
| exposure | string |
| notes? | string \| null |

### EmergencyConsultationDTO

`apps/api/src/modules/emergency/emergency.types.ts:68`

| Field | Observed type |
| --- | --- |
| doctor_id? | string |
| chief_complaint | string |
| history | string |
| examination | string |
| diagnosis | string |
| plan | string |
| treatment? | string \| null |
| notes? | string \| null |
| ready_for_disposition? | boolean |

### EmergencyOrderDTO

`apps/api/src/modules/emergency/emergency.types.ts:79`

| Field | Observed type |
| --- | --- |
| order_type | EmergencyOrderType |
| priority | 'ROUTINE' \| 'URGENT' \| 'STAT' |
| service_id? | string |
| medicine_name? | string |
| name | string |
| category | string |
| dosage? | string |
| route? | string |
| frequency? | string |
| duration? | string |
| quantity? | number \| null |
| destination? | string \| null |
| specimen_type? | string \| null |
| clinical_notes? | string \| null |
| instructions? | string \| null |

### EmergencyDispositionDTO

`apps/api/src/modules/emergency/emergency.types.ts:98`

| Field | Observed type |
| --- | --- |
| decision | EmergencyDisposition |
| reason? | string \| null |
| summary? | string \| null |
| instructions? | string \| null |
| transfer_destination? | string \| null |

### EmergencyReasonDTO

`apps/api/src/modules/emergency/emergency.types.ts:105`

| Field | Observed type |
| --- | --- |
| reason | string |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| EmergencyStatus | \| 'REGISTERED' \| 'WAITING_FOR_TRIAGE' \| 'TRIAGED' \| 'WAITING_FOR_DOCTOR' \| 'IN_CONSULTATION' \| 'IN_TREATMENT' \| 'READY_FOR_DISPOSITION' \| 'DISCHARGED' \| 'TRANSFERRED' \| 'CONVERTED_TO_IP' \| 'LEFT' \| 'NO_SHOW' \| 'CANCELLED' | `apps/api/src/modules/emergency/emergency.types.ts:3` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Patient Management; Nursing and Triage; OPD downstream order services; IPD; Billing; Referral Management.

Observed backend import domains: `appointments`, `auth`, `billing`, `branches`, `departments`, `doctors`, `inpatient-admissions`, `opd`, `patients`, `roles`, `services`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/emergency/emergency.service.ts:70` — return executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/emergency/emergency.service.ts:163` — return executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/emergency/emergency.service.ts:253` — await executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/emergency/emergency.service.ts:268` — return await executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/emergency/emergency.service.ts:353` — return executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/emergency/emergency.service.ts:425` — return executeTransaction(this.repository, async (session) => {

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-ER-001 | FR-ER-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Minimum-data registration (name/estimated age/sex if identity unknown), unidentified/John Doe patient support, mode of arrival (walk-in, ambulance, referral) and instant MRN generation without payment blocking. |
| AC-ER-002 | FR-ER-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Real-time ED queue displaying triage category, waiting time and treating clinician; queue re-sequenced automatically by triage priority, not arrival time alone. |
| AC-ER-003 | FR-ER-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Triage category configuration (e.g. Red/Critical, Yellow/Urgent, Green/Non-Urgent) using a configurable triage scale, vitals capture and time-stamped triage decision. |
| AC-ER-004 | FR-ER-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Treatment/procedure log, medication administration record (time, dose, administering nurse) and response-to-treatment notes. |
| AC-ER-005 | FR-ER-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Disposition decision (admit to IPD, discharge, refer out, transfer, or deceased) captured with clinician sign-off and time stamp; admit triggers Admission Management directly. |
| AC-ER-006 | FR-ER-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall allow treatment to proceed and billing to be settled after stabilization per client policy. |
| AC-ER-007 | FR-ER-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Link emergency encounter to existing patient record. |
| AC-ER-008 | FR-ER-008 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Create downstream requests linked to emergency encounter. |
| AC-ER-009 | FR-ER-009 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Route to Reception/admission workflow for bed allotment and advance payment if required. |
| AC-ER-010 | FR-ER-010 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Mark status as left/abandoned with reason and pending billing status if applicable. |
| AC-ER-011 | FR-ER-011 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Allow an authorized priority override through its dedicated service path. |
| AC-ER-012 | FR-ER-012 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Link a temporary emergency record to a patient using the guarded linking operation. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-ER-01: R1 includes deceased and referral-out disposition; approve mapping to the current emergency status and referral contracts.
- GAP-ER-02: Confirm temporary identity reconciliation, emergency treatment before payment and discharge closure policy.
- GAP-ER-03: The August plan reports no Emergency backend; current routes invalidate that historical implementation claim.
- GAP-ER-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Emergency/HMS_EMERGENCY_TRIAGE_CONSULTATION_GAP_NOTE.md` | 300f835d5982ebf4445833bc63ba0fca13ec7d368f32f10e42efbe2b126ed609 | Historical design evidence |
| `HMS Project/Design/Emergency/M-010_EMERGENCY_WORKSPACE_LAYERING_GAP_NOTE.md` | f12cc6c263002f9df67bccd6327e75a6ed9e02dd420f14827850ec2c051006fb | Historical design evidence |
| `HMS Project/Design/Emergency/review.md` | 17f5a5754a427acc19c1591cc0994a599abe3f8b0cd0430b79dec549ee8c33fc | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/emergency/emergency.service.ts` | 031517b84e2978cdb6d2ce928d2c4de9e5b42196f95edb93584487b000e358e3 | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/emergency/emergency.model.ts`
- `apps/api/src/modules/emergency/emergency.repository.ts`
- `apps/api/src/modules/emergency/emergency.routes.ts`
- `apps/api/src/modules/emergency/emergency.schemas.ts`
- `apps/api/src/modules/emergency/emergency.service.ts`
- `apps/api/src/modules/emergency/emergency.types.ts`
- `apps/api/src/modules/emergency/index.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
