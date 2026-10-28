# Referral Management Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Referral Management |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Link internal or external referral requests to originating clinical context and permitted booking.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Link internal or external referral requests to originating clinical context and permitted booking. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Referring doctor; Referral Coordinator or Reception; receiving clinician.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Appointments | Appointment Booking | Create |
| OPD | OPD Referral | Edit |
| OPD | OPD Referral | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-REF-001 | Documented source requirement; approval unverified. Referral from one department/specialist to another within the facility, with reason and urgency. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1014 | `apps/api/src/modules/opd/opd-referral.service.ts:71` — saveDraft | Partial |
| FR-REF-002 | Documented source requirement; approval unverified. Referral out to, or receipt of a referral in from, a partner/external hospital, with clinical summary attached. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1016 | `apps/api/src/modules/opd/opd-referral.service.ts:86` — submit | Partial |
| FR-REF-003 | Documented source requirement; approval unverified. Master list of referring/partner hospitals with contact details and agreement status. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1018 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-REF-004 | Documented source requirement; approval unverified. Master list of referring doctors with specialty and hospital affiliation. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1020 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-REF-005 | Documented source requirement; approval unverified. Status lifecycle: Initiated, Sent/Received, Accepted, Consulted, Closed, with time stamps at each stage. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1022 | `apps/api/src/modules/opd/opd-referral.service.ts:39` — book | Partial |
| FR-REF-006 | Documented source requirement; approval unverified. System shall allow visibility of pending/overdue referrals for follow-up. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1049 | `apps/api/src/modules/opd/opd-referral.service.ts:34` — listSubmitted | Partial |
| FR-REF-007 | Documented source requirement; approval unverified. Create referral entry; Reception can check availability and book future appointment. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶247 | `apps/api/src/modules/opd/opd-referral.service.ts:86` — submit | Partial |
| FR-REF-008 | Documented source requirement; approval unverified. Referral booking flow with doctor availability validation and same patient context. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶159 | `apps/api/src/modules/opd/opd-referral.service.ts:39` — book | Partial |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Create the referral from the consultation.
2. Record reason, urgency and internal doctor or external facility.
3. Submit the referral when its source context permits.
4. Reception reviews a bookable internal referral.
5. Check doctor availability and book the associated appointment.
6. Preserve referral-to-appointment linkage and expose pending work.
7. Close or acknowledge the external handoff only under a defined receiving workflow.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| VALIDATION_ERROR — Referral id is invalid | 400 | `apps/api/src/modules/opd/opd-referral.service.ts:40` |
| REFERRAL_NOT_FOUND — Submitted referral not found | 404 | `apps/api/src/modules/opd/opd-referral.service.ts:42` |
| REFERRAL_ALREADY_BOOKED — Referral is already booked | 409 | `apps/api/src/modules/opd/opd-referral.service.ts:44` |
| REFERRAL_NOT_BOOKABLE — Only an internal referral with an assigned HMS doctor can be booked | 400 | `apps/api/src/modules/opd/opd-referral.service.ts:46` |
| REFERRAL_BOOKING_CONFLICT — Referral was booked by another user; refresh the queue | 409 | `apps/api/src/modules/opd/opd-referral.service.ts:58` |
| REFERRAL_SUBMITTED — A submitted referral cannot be edited | 400 | `apps/api/src/modules/opd/opd-referral.service.ts:77` |
| CONSULTATION_NOT_COMPLETED — Complete the consultation before submitting referral | 400 | `apps/api/src/modules/opd/opd-referral.service.ts:91` |
| REFERRED_DOCTOR_REQUIRED — An internal referral requires an HMS doctor | 400 | `apps/api/src/modules/opd/opd-referral.service.ts:164` |
| REFERRAL_FACILITY_REQUIRED — External and emergency referrals require a facility | 400 | `apps/api/src/modules/opd/opd-referral.service.ts:167` |
| INVALID_DOCTOR — Active referred doctor is required | 400 | `apps/api/src/modules/opd/opd-referral.service.ts:175` |
| NOT_FOUND — OPD visit not found | 404 | `apps/api/src/modules/opd/opd-referral.service.ts:183` |
| CONSULTATION_REQUIRED — Start the consultation before creating referral | 400 | `apps/api/src/modules/opd/opd-referral.service.ts:189` |
| VISIT_CLOSED — Referral cannot be changed for a closed OPD visit | 400 | `apps/api/src/modules/opd/opd-referral.service.ts:195` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/opd/opd-referral.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/ReferralBookingPage.tsx` | useReferralBookingFeature, useState, useMemo |
| `apps/web/src/hooks/reception/useReferralBookingFeature.ts` | useReferralBookingFeature, useReceptionReferrals, useEmergencyReferrals |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/opd/referrals | opdReferrals.listSubmitted | listSubmittedReferralsSchema | `apps/api/src/modules/opd/opd-referral.routes.ts:11` |
| POST /api/opd/referrals/:referralId/book | opdReferrals.book | referralIdParamsSchema, bookReferralBodySchema | `apps/api/src/modules/opd/opd-referral.routes.ts:15` |
| GET /api/opd/visits/:visitId/referral | opdReferrals.getByVisit | referralVisitParamsSchema | `apps/api/src/modules/opd/opd-referral.routes.ts:19` |
| PUT /api/opd/visits/:visitId/referral | opdReferrals.saveDraft | saveReferralBodySchema, referralVisitParamsSchema | `apps/api/src/modules/opd/opd-referral.routes.ts:24` |
| POST /api/opd/visits/:visitId/referral/submit | opdReferrals.submit | saveReferralBodySchema, referralVisitParamsSchema | `apps/api/src/modules/opd/opd-referral.routes.ts:29` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### OpdReferral

`apps/api/src/modules/opd/opd-referral.types.ts:5`

| Field | Observed type |
| --- | --- |
| id | string |
| visit_id | string |
| branch_id | string |
| consultation_id | string |
| patient_id | string |
| patient_number | string |
| patient_name | string |
| referring_doctor_id | string |
| referring_doctor_name | string |
| referral_type | OpdReferralType \| null |
| specialty | string \| null |
| priority | OpdReferralPriority |
| facility | string \| null |
| referred_doctor_id | string \| null |
| referred_doctor_name | string \| null |
| reason | string \| null |
| clinical_summary | string \| null |
| appointment_id | string \| null |
| appointment_number | string \| null |
| appointment_date | Date \| null |
| appointment_start_time | string \| null |
| appointment_duration_minutes | number \| null |
| status | OpdReferralStatus |
| submitted_at | Date \| null |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### SaveOpdReferralDTO

`apps/api/src/modules/opd/opd-referral.types.ts:36`

| Field | Observed type |
| --- | --- |
| referral_type? | OpdReferralType \| null |
| specialty? | string \| null |
| priority? | OpdReferralPriority |
| facility? | string \| null |
| referred_doctor_id? | string \| null |
| referred_doctor_name? | string \| null |
| reason? | string \| null |
| clinical_summary? | string \| null |
| appointment_date? | string \| null |
| appointment_start_time? | string \| null |
| appointment_duration_minutes? | number \| null |

### BookOpdReferralDTO

`apps/api/src/modules/opd/opd-referral.types.ts:51`

| Field | Observed type |
| --- | --- |
| appointment_date | string |
| start_time | string |
| duration_minutes | number |
| visit_type | 'NEW_CONSULTATION' \| 'FOLLOW_UP' \| 'PROCEDURE' |
| priority? | 'ROUTINE' \| 'URGENT' \| 'EMERGENCY' |
| notes? | string \| null |

### OpdReferralListQuery

`apps/api/src/modules/opd/opd-referral.types.ts:50`

| Field | Observed type |
| --- | --- |
| booked? | boolean |
| page? | number |
| limit? | number |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| OpdReferralStatus | 'DRAFT' \| 'SUBMITTED' | `apps/api/src/modules/opd/opd-referral.types.ts:1` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

OPD Consultation; Emergency; Doctor Management; Appointments; Patient Management; Notifications.

Observed backend import domains: `appointments`, `doctors`, `notifications`, `patients`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-REF-001 | FR-REF-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Referral from one department/specialist to another within the facility, with reason and urgency. |
| AC-REF-002 | FR-REF-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Referral out to, or receipt of a referral in from, a partner/external hospital, with clinical summary attached. |
| AC-REF-003 | FR-REF-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Master list of referring/partner hospitals with contact details and agreement status. |
| AC-REF-004 | FR-REF-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Master list of referring doctors with specialty and hospital affiliation. |
| AC-REF-005 | FR-REF-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Status lifecycle: Initiated, Sent/Received, Accepted, Consulted, Closed, with time stamps at each stage. |
| AC-REF-006 | FR-REF-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall allow visibility of pending/overdue referrals for follow-up. |
| AC-REF-007 | FR-REF-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Create referral entry; Reception can check availability and book future appointment. |
| AC-REF-008 | FR-REF-008 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Referral booking flow with doctor availability validation and same patient context. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-REF-01: R1 requires referring-hospital and referring-doctor masters plus full Sent/Received/Accepted/Consulted/Closed lifecycle; a referral text field or booking action is incomplete evidence.
- GAP-REF-02: Confirm incoming external referrals, overdue escalation and receiving acknowledgement.
- GAP-REF-03: Other-branch calendar verification is historical evidence only.
- GAP-REF-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Referral Management/HMS_REFERRAL_CALENDAR_INTEGRATION_GAP_NOTE.md` | a636b0d2183fe06836472a14fdab93b92675b7691da8f9842da116d42fc2ff04 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/opd/opd-referral.routes.ts`
- `apps/api/src/modules/opd/opd-referral.schemas.ts`
- `apps/api/src/modules/opd/opd-referral.service.ts`
- `apps/api/src/modules/opd/opd-referral.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
