# Surgery Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Surgery |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Coordinate procedure recommendation, scheduling, prerequisites and completion with patient and encounter continuity.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Coordinate procedure recommendation, scheduling, prerequisites and completion with patient and encounter continuity. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Doctor recommends; Reception or procedure scheduler books; procedure user acts within assigned permissions; billing collector handles deposits.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| OPD | OPD Clinical Orders | Edit |
| OPD | OPD Clinical Orders | View |
| OPD | OPD Prescription | Edit |
| OPD | OPD Prescription | View |
| Surgery | Bookings | Cancel |
| Surgery | Bookings | Complete |
| Surgery | Bookings | Confirm |
| Surgery | Bookings | Create |
| Surgery | Bookings | Reschedule |
| Surgery | Bookings | View |
| Surgery | Recommendations | Cancel |
| Surgery | Recommendations | Create |
| Surgery | Recommendations | View |
| Surgery | Schedule | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-SURG-001 | Documented source requirement; approval unverified. 1. Doctor recommends surgery/procedure and selects department/service. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶262 | `apps/api/src/modules/surgery/surgery.service.ts:98` — createRecommendation | Partial |
| FR-SURG-002 | Documented source requirement; approval unverified. 5. System validates no doctor schedule conflict and no duplicate active surgery booking for same patient/service. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶266 | `apps/api/src/modules/surgery/surgery.service.ts:373` — validateSchedule | Partial |
| FR-SURG-003 | Documented source requirement; approval unverified. 6. Reception checks bed requirement and bed availability where surgery requires admission/bed. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶267 | `apps/api/src/modules/surgery/surgery.service.ts:137` — createBooking | Partial |
| FR-SURG-004 | Documented source requirement; approval unverified. 7. Reception attaches required consent form or marks consent pending. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶268 | `apps/api/src/modules/surgery/surgery.service.ts:185` — confirmBooking | Partial |
| FR-SURG-005 | Documented source requirement; approval unverified. 8. System checks whether advance payment is required. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶269 | `apps/api/src/modules/surgery/surgery.service.ts:185` — confirmBooking | Partial |
| FR-SURG-006 | Documented source requirement; approval unverified. 10. Reception confirms surgery/procedure booking and allotment status. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶271 | `apps/api/src/modules/surgery/surgery.service.ts:185` — confirmBooking | Partial |
| FR-SURG-007 | Documented source requirement; approval unverified. Reschedule booking and maintain audit trail with old/new date and reason. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶286 | `apps/api/src/modules/surgery/surgery.service.ts:211` — rescheduleBooking | Partial |
| FR-SURG-008 | Documented source requirement; approval unverified. Cancel booking, release bed/slot if held and update billing/advance payment status based on policy. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶288 | `apps/api/src/modules/surgery/surgery.service.ts:239` — cancelBooking | Partial |
| FR-SURG-009 | Implementation observation — business validation required. Submit downstream orders only for an active supported procedure context. | `apps/api/src/modules/surgery/surgery.service.ts:501` | `apps/api/src/modules/surgery/surgery.service.ts:501` — requireActiveBookingContext | Implemented |
| FR-SURG-010 | Implementation observation — business validation required. Complete only a booking eligible for completion. | `apps/api/src/modules/surgery/surgery.service.ts:252` | `apps/api/src/modules/surgery/surgery.service.ts:252` — completeBooking | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Create a recommendation for the patient, service and source encounter.
2. Select a valid doctor and proposed date/time.
3. Validate availability, capacity and duplicate booking conditions.
4. Check bed hold, consent and deposit prerequisites where configured.
5. Confirm the booking.
6. Reschedule or cancel with a reason and update dependent state.
7. Complete the procedure through its allowed lifecycle and preserve timeline evidence.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| INVALID_PROCEDURE_SCHEDULE — Invalid scheduled date or time | 400 | `apps/api/src/modules/surgery/surgery.service.ts:39` |
| PROCEDURE_DUPLICATE_CONFLICT — An active recommendation or booking already exists | 409 | `apps/api/src/modules/surgery/surgery.service.ts:60` |
| BRANCH_ACCESS_DENIED — Branch access denied | 403 | `apps/api/src/modules/surgery/surgery.service.ts:66` |
| DEPARTMENT_ACCESS_DENIED — Department access denied | 403 | `apps/api/src/modules/surgery/surgery.service.ts:67` |
| PROCEDURE_BOOKING_NOT_FOUND — Procedure booking not found | 404 | `apps/api/src/modules/surgery/surgery.service.ts:88` |
| DOCTOR_REQUIRED — Active recommending doctor is required | 400 | `apps/api/src/modules/surgery/surgery.service.ts:105` |
| PATIENT_NOT_FOUND — Active patient not found | 404 | `apps/api/src/modules/surgery/surgery.service.ts:108` |
| DOCTOR_NOT_FOUND — Active recommending doctor not found in the selected branch | 404 | `apps/api/src/modules/surgery/surgery.service.ts:109` |
| DEPARTMENT_NOT_FOUND — Active department not found in the selected branch | 404 | `apps/api/src/modules/surgery/surgery.service.ts:110` |
| PROCEDURE_SERVICE_NOT_FOUND — Active procedure service not found in the selected department | 404 | `apps/api/src/modules/surgery/surgery.service.ts:111` |
| ENCOUNTER_CONTEXT_MISMATCH — Clinical encounter does not match the selected patient and doctor | 409 | `apps/api/src/modules/surgery/surgery.service.ts:112` |
| PROCEDURE_RECOMMENDATION_NOT_FOUND — Procedure recommendation not found | 404 | `apps/api/src/modules/surgery/surgery.service.ts:127` |
| PROCEDURE_RECOMMENDATION_STATE_CONFLICT — Only an unbooked active recommendation can be cancelled | 409 | `apps/api/src/modules/surgery/surgery.service.ts:130` |
| PROCEDURE_RECOMMENDATION_NOT_ACTIVE — Active unbooked procedure recommendation not found | 409 | `apps/api/src/modules/surgery/surgery.service.ts:142` |
| PROCEDURE_SERVICE_CONFIGURATION_INVALID — Procedure service configuration is incomplete | 409 | `apps/api/src/modules/surgery/surgery.service.ts:144` |
| PROCEDURE_BOOKING_CONTEXT_INVALID — Procedure booking context is no longer active | 409 | `apps/api/src/modules/surgery/surgery.service.ts:191` |
| PROCEDURE_BED_HOLD_REQUIRED — An active bed hold for this patient is required | 409 | `apps/api/src/modules/surgery/surgery.service.ts:195` |
| PROCEDURE_BOOKING_STATE_CONFLICT — Booking changed before confirmation | 409 | `apps/api/src/modules/surgery/surgery.service.ts:204` |
| ADVANCE_DEPOSIT_REQUIRED — Advance deposit prerequisite is no longer satisfied | 409 | `apps/api/src/modules/surgery/surgery.service.ts:229` |
| PROCEDURE_BOOKING_NOT_COMPLETABLE — Only a started booked procedure can be completed | 409 | `apps/api/src/modules/surgery/surgery.service.ts:258` |
| PROCEDURE_SCHEDULE_IN_PAST — Cannot schedule a procedure in the past | 400 | `apps/api/src/modules/surgery/surgery.service.ts:457` |
| DOCTOR_PROCEDURE_CONFLICT — Doctor has an overlapping procedure booking | 409 | `apps/api/src/modules/surgery/surgery.service.ts:470` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/surgery/surgery.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/SurgeryWorkspacePage.test.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/pages/SurgeryWorkspacePage.tsx` | useState, useSurgeryWorkspaceFeature, useMemo |
| `apps/web/src/hooks/surgery/useSurgeryWorkspaceFeature.test.tsx` | useSurgeryWorkspaceFeature |
| `apps/web/src/hooks/surgery/useSurgeryDownstreamFeature.ts` | useSurgeryDownstreamFeature, useAuth, useSurgeryDownstream, useServicesList |
| `apps/web/src/hooks/surgery/useSurgeryWorkspaceFeature.ts` | useSurgeryWorkspaceFeature, useAuth, useAppLocation, useState, useBranchesList, useEffect, useSurgery, useAdvancePaymentFeature |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/surgery/recommendations | surgery.listRecommendations | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:25` |
| POST /api/surgery/recommendations | surgery.createRecommendation | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:26` |
| POST /api/surgery/recommendations/:id/cancel | surgery.cancelRecommendation | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:27` |
| GET /api/surgery/bookings | surgery.listBookings | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:28` |
| GET /api/surgery/bookings/:id | surgery.getBooking | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:29` |
| GET /api/surgery/bookings/:id/prescription | surgery.getPrescription | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:30` |
| POST /api/surgery/bookings/:id/prescription | surgery.submitPrescription | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:31` |
| GET /api/surgery/bookings/:id/clinical-orders/:orderType | surgery.getClinicalOrder | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:32` |
| POST /api/surgery/bookings/:id/clinical-orders/:orderType | surgery.submitClinicalOrder | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:33` |
| POST /api/surgery/bookings | surgery.createBooking | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:34` |
| POST /api/surgery/bookings/:id/confirm | surgery.confirmBooking | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:35` |
| POST /api/surgery/bookings/:id/reschedule | surgery.rescheduleBooking | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:36` |
| POST /api/surgery/bookings/:id/cancel | surgery.cancelBooking | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:37` |
| POST /api/surgery/bookings/:id/complete | surgery.completeBooking | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:38` |
| GET /api/surgery/schedule | surgery.listBookings | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:39` |
| GET /api/surgery/availability/alternatives | surgery.alternatives | Inline/custom validation; inspect source | `apps/api/src/modules/surgery/surgery.routes.ts:40` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### CreateProcedureRecommendationDTO

`apps/api/src/modules/surgery/surgery.types.ts:5`

| Field | Observed type |
| --- | --- |
| patient_id | string |
| branch_id | string |
| department_id | string |
| recommending_doctor_id? | string |
| service_id | string |
| encounter_type? | 'OPD_VISIT' \| 'DIRECT' \| 'EMERGENCY' |
| encounter_id? | string \| null |
| clinical_reason | string |
| notes? | string \| null |

### CreateProcedureBookingDTO

`apps/api/src/modules/surgery/surgery.types.ts:6`

| Field | Observed type |
| --- | --- |
| recommendation_id | string |
| branch_id | string |
| doctor_id | string |
| scheduled_start | string |
| hold_id? | string \| null |
| consent_document_id? | string \| null |
| deposit_invoice_id? | string \| null |
| notes? | string \| null |

### ConfirmProcedureBookingDTO

`apps/api/src/modules/surgery/surgery.types.ts:7`

| Field | Observed type |
| --- | --- |
| consent_document_id? | string \| null |
| deposit_invoice_id? | string \| null |
| hold_id? | string \| null |

### RescheduleProcedureBookingDTO

`apps/api/src/modules/surgery/surgery.types.ts:8`

| Field | Observed type |
| --- | --- |
| scheduled_start | string |
| reason | string |
| doctor_id? | string |
| hold_id? | string \| null |
| consent_document_id? | string \| null |
| deposit_invoice_id? | string \| null |

### ReasonDTO

`apps/api/src/modules/surgery/surgery.types.ts:9`

| Field | Observed type |
| --- | --- |
| reason | string |

### SurgeryListQuery

`apps/api/src/modules/surgery/surgery.types.ts:4`

| Field | Observed type |
| --- | --- |
| branch_id | string |
| status? | string |
| patient_id? | string |
| doctor_id? | string |
| service_id? | string |
| from? | string |
| to? | string |
| search? | string |
| page? | number |
| limit? | number |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| ProcedureRecommendationStatus | 'ACTIVE' \| 'BOOKED' \| 'CANCELLED' | `apps/api/src/modules/surgery/surgery.types.ts:1` |
| ProcedureBookingStatus | 'PENDING_CONFIRMATION' \| 'BOOKED' \| 'COMPLETED' \| 'CANCELLED' | `apps/api/src/modules/surgery/surgery.types.ts:2` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Doctor Management; Service Catalog; Bed and Ward Management; Consent Management; Billing; IPD; EMR.

Observed backend import domains: `admissions-configuration`, `advance-payment`, `appointments`, `auth`, `billing`, `branches`, `departments`, `doctors`, `inpatient-admissions`, `opd`, `patients`, `roles`, `services`, `settings`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/surgery/surgery.service.ts:102` — return await executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/surgery/surgery.service.ts:125` — return executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/surgery/surgery.service.ts:140` — return await executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/surgery/surgery.service.ts:187` — return executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/surgery/surgery.service.ts:213` — return executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/surgery/surgery.service.ts:241` — return executeTransaction(this.repository, async (session) => {

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-SURG-001 | FR-SURG-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: 1. Doctor recommends surgery/procedure and selects department/service. |
| AC-SURG-002 | FR-SURG-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: 5. System validates no doctor schedule conflict and no duplicate active surgery booking for same patient/service. |
| AC-SURG-003 | FR-SURG-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: 6. Reception checks bed requirement and bed availability where surgery requires admission/bed. |
| AC-SURG-004 | FR-SURG-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: 7. Reception attaches required consent form or marks consent pending. |
| AC-SURG-005 | FR-SURG-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: 8. System checks whether advance payment is required. |
| AC-SURG-006 | FR-SURG-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: 10. Reception confirms surgery/procedure booking and allotment status. |
| AC-SURG-007 | FR-SURG-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Reschedule booking and maintain audit trail with old/new date and reason. |
| AC-SURG-008 | FR-SURG-008 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Cancel booking, release bed/slot if held and update billing/advance payment status based on policy. |
| AC-SURG-009 | FR-SURG-009 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Submit downstream orders only for an active supported procedure context. |
| AC-SURG-010 | FR-SURG-010 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Complete only a booking eligible for completion. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-SURG-01: R2 calls this a booking scope, not a complete theatre, anesthesia or operative clinical record system.
- GAP-SURG-02: Current recommendation and booking enums are narrower than the suggested R2 status master.
- GAP-SURG-03: Approve duration, parallel capacity, duplicate scope, consent verification and financial cancellation policy.
- GAP-SURG-04: The old plan stating no surgery domain is outdated.
- GAP-SURG-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Surgery/M-010_SURGERY_WORKSPACE_LAYERING_GAP_NOTE.md` | 38de155aacf20dbc7c850ad5e75d3959b1f8c2148fd926e309d22d48f04ab04b | Historical design evidence |
| `HMS Project/Design/Surgery/review.md` | d996e41216561b19d492995c719d290e857cffbda67fe5b1e66da0fcaeae04ec | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/surgery/surgery.service.ts` | 7aee2662450011607e0438636e32428acfd8976178285989b0f8c716e5222cda | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/surgery/surgery.model.ts`
- `apps/api/src/modules/surgery/surgery.repository.ts`
- `apps/api/src/modules/surgery/surgery.routes.ts`
- `apps/api/src/modules/surgery/surgery.schemas.ts`
- `apps/api/src/modules/surgery/surgery.service.ts`
- `apps/api/src/modules/surgery/surgery.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
