# Appointments Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Appointments |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Book appointments and manage a patient queue against doctor availability without losing patient or visit context.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Book appointments and manage a patient queue against doctor availability without losing patient or visit context. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Receptionist; Doctor views and manages permitted queue actions; patient booking is governed by Patient Portal.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Appointments | Appointment Booking | Create |
| Appointments | Appointment Booking | Edit |
| Appointments | Appointment Records | Edit |
| Appointments | Appointment Records | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-APT-001 | Documented source requirement; approval unverified. System shall auto-generate bookable slots from the configured schedule. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶405 | `apps/api/src/modules/appointments/appointment.service.ts:699` — validateDoctorAvailability | Partial |
| FR-APT-002 | Documented source requirement; approval unverified. System shall prevent double-booking of the same doctor/slot. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶409 | `apps/api/src/modules/appointments/appointment.service.ts:750` — validateDoctorConflict | Partial |
| FR-APT-003 | Documented source requirement; approval unverified. Search patient, select doctor and available slot, and confirm appointment or walk-in check-in. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶418 | `apps/api/src/modules/appointments/appointment.service.ts:149` — create | Partial |
| FR-APT-004 | Documented source requirement; approval unverified. System shall allow no-show status with reason and free the slot. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶436 | `apps/api/src/modules/appointments/appointment.service.ts:522` — updateStatus | Partial |
| FR-APT-005 | Documented source requirement; approval unverified. System shall allow cancellation with reason and release the slot for rebooking. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶438 | `apps/api/src/modules/appointments/appointment.service.ts:522` — updateStatus | Partial |
| FR-APT-006 | Documented source requirement; approval unverified. Reception can book, check-in, reschedule and cancel appointments. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶447 | `apps/api/src/modules/appointments/appointment.service.ts:411` — update | Partial |
| FR-APT-007 | Documented source requirement; approval unverified. Referral booking flow with doctor availability validation and same patient context. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶159 | `apps/api/src/modules/appointments/appointment.service.ts:149` — create | Partial |
| FR-APT-008 | Implementation observation — business validation required. Reject a reschedule that omits the required reason. | `apps/api/src/modules/appointments/appointment.service.ts:411` | `apps/api/src/modules/appointments/appointment.service.ts:411` — update | Implemented |
| FR-APT-009 | Implementation observation — business validation required. Keep the explicit appointment transition map authoritative for status changes. | `apps/api/src/modules/appointments/appointment.service.ts:522` | `apps/api/src/modules/appointments/appointment.service.ts:522` — updateStatus | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Search and select the existing patient.
2. Select doctor and an available date and time.
3. Submit visit type, duration and optional reason.
4. Recheck doctor and patient conflicts on the server.
5. Confirm or check in using the permitted status action.
6. Reschedule or cancel with the required reason; retain the original context and audit history.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| INVALID_APPOINTMENT_DATA — Appointment is missing scheduling data | 500 | `apps/api/src/modules/appointments/appointment.service.ts:88` |
| DEPARTMENT_SCOPE_DENIED — Dashboard department access denied | 403 | `apps/api/src/modules/appointments/appointment.service.ts:126` |
| DOCTOR_SCOPE_DENIED — Doctor dashboard access is limited to the linked doctor record | 403 | `apps/api/src/modules/appointments/appointment.service.ts:130` |
| NOT_FOUND — Appointment not found | 404 | `apps/api/src/modules/appointments/appointment.service.ts:143` |
| VALIDATION_ERROR — UTC datetime is required for new appointments | 400 | `apps/api/src/modules/appointments/appointment.service.ts:321` |
| RESCHEDULE_REASON_REQUIRED — A reschedule reason is required when changing the appointment slot | 400 | `apps/api/src/modules/appointments/appointment.service.ts:454` |
| INVALID_STATUS_TRANSITION — Appointment status transition is not allowed | 400 | `apps/api/src/modules/appointments/appointment.service.ts:527` |
| STATUS_REASON_REQUIRED — A reason is required for this appointment status | 400 | `apps/api/src/modules/appointments/appointment.service.ts:535` |
| OPD_VISIT_REQUIRED — An OPD visit is required before completing the appointment | 400 | `apps/api/src/modules/appointments/appointment.service.ts:545` |
| OPD_VISIT_NOT_COMPLETED — Complete the linked OPD visit before completing the appointment | 400 | `apps/api/src/modules/appointments/appointment.service.ts:552` |
| INVALID_PATIENT — Active patient is required for appointment booking | 400 | `apps/api/src/modules/appointments/appointment.service.ts:622` |
| INVALID_DOCTOR — Active doctor is required for appointment booking | 400 | `apps/api/src/modules/appointments/appointment.service.ts:637` |
| PAST_APPOINTMENT_DATE — Appointment date cannot be in the past | 400 | `apps/api/src/modules/appointments/appointment.service.ts:654` |
| PAST_APPOINTMENT_TIME — Appointment start time must be in the future | 400 | `apps/api/src/modules/appointments/appointment.service.ts:691` |
| DOCTOR_ON_LEAVE — Doctor is on leave on the selected date | 400 | `apps/api/src/modules/appointments/appointment.service.ts:707` |
| DOCTOR_NOT_AVAILABLE — Doctor is not available on the selected date | 400 | `apps/api/src/modules/appointments/appointment.service.ts:721` |
| OUTSIDE_DOCTOR_AVAILABILITY — Appointment time is outside doctor availability | 400 | `apps/api/src/modules/appointments/appointment.service.ts:734` |
| INVALID_SLOT_DURATION — Appointment duration must match the doctor slot duration | 400 | `apps/api/src/modules/appointments/appointment.service.ts:742` |
| APPOINTMENT_SLOT_CONFLICT — Doctor already has an appointment in this time slot | 409 | `apps/api/src/modules/appointments/appointment.service.ts:770` |
| PATIENT_APPOINTMENT_CONFLICT — Patient already has an appointment in this time slot | 409 | `apps/api/src/modules/appointments/appointment.service.ts:800` |
| APPOINTMENT_NOT_ACTIVE — Only active appointments can be rescheduled | 400 | `apps/api/src/modules/appointments/appointment.service.ts:813` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/appointments/appointment.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/AppointmentBookingPage.tsx` | useAppLocation, useState, useTimezone, useAppointmentBookingFeature, useMemo, useEffect |
| `apps/web/src/pages/AppointmentCalendarPage.tsx` | useAppointmentCalendarFeature, useState, useFirstDayOfWeek, useMemo |
| `apps/web/src/pages/AppointmentDashboardPage.tsx` | useAppointmentDashboardFeature, useTimezone, useMemo |
| `apps/web/src/pages/AppointmentQueuePage.tsx` | useState, useAppointmentQueueFeature, useEffect, useMemo |
| `apps/web/src/hooks/appointments/useAppointmentBookingFeature.ts` | useAppointmentBookingFeature, useQueryClient, useReceptionReferral, useEmergencyReferral, usePatientDetails, usePatientsList, useDoctorsList, useDoctorAvailableSlots |
| `apps/web/src/hooks/appointments/useAppointmentCalendarFeature.ts` | useAppointmentCalendarFeature, useAuth, useAppLocation, useState, useMemo, useDepartmentsList, useDoctorsList, useBranchesList |
| `apps/web/src/hooks/appointments/useAppointmentDashboardFeature.ts` | useAppointmentDashboardFeature, useAuth, useActiveBranch, useAppLocation, useState, useAppointmentsList, useAppointmentDashboardSummary, useUpdateAppointmentStatus |
| `apps/web/src/hooks/appointments/useAppointmentQueueFeature.ts` | useAppointmentQueueFeature, useAuth, useAppLocation, useState, useEffect, useDepartmentsList, useDoctorsList, useBranchesList |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/appointments/dashboard-summary | appointments.dashboardSummary | listAppointmentsQuerySchema | `apps/api/src/modules/appointments/appointment.routes.ts:24` |
| GET /api/appointments | appointments.list | listAppointmentsQuerySchema | `apps/api/src/modules/appointments/appointment.routes.ts:29` |
| GET /api/appointments/:id | appointments.getById | appointmentIdParamsSchema | `apps/api/src/modules/appointments/appointment.routes.ts:40` |
| POST /api/appointments | appointments.create | createAppointmentBodySchema | `apps/api/src/modules/appointments/appointment.routes.ts:51` |
| PATCH /api/appointments/:id | appointments.update | appointmentIdParamsSchema, updateAppointmentBodySchema | `apps/api/src/modules/appointments/appointment.routes.ts:65` |
| PATCH /api/appointments/:id/status | appointments.updateStatus | appointmentIdParamsSchema, updateAppointmentStatusBodySchema | `apps/api/src/modules/appointments/appointment.routes.ts:77` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### Appointment

`apps/api/src/modules/appointments/appointment.types.ts:19`

| Field | Observed type |
| --- | --- |
| id | string |
| appointment_number | string |
| patient_id | string |
| patient_number | string |
| patient_name | string |
| doctor_id | string |
| doctor_name | string |
| doctor_specialization | string |
| branch_id | string |
| department_id | string |
| utc_datetime? | string |
| utc_end_time? | string |
| appointment_date? | Date |
| start_time? | string |
| end_time? | string |
| duration_minutes | number |
| visit_type | AppointmentVisitType |
| priority | AppointmentPriority |
| status | AppointmentStatus |
| reason | string \| null |
| notes | string \| null |
| rescheduled_from_id | string \| null |
| rescheduled_to_id | string \| null |
| rescheduled_at | Date \| null |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### AppointmentDashboardSummary

`apps/api/src/modules/appointments/appointment.types.ts:72`

| Field | Observed type |
| --- | --- |
| total | number |
| by_status | Record<AppointmentStatus, number> |
| follow_ups | number |
| urgent | number |

### PortalRescheduleAppointmentDTO

`apps/api/src/modules/appointments/appointment.types.ts:50`

| Field | Observed type |
| --- | --- |
| doctor_id | string |
| appointment_date | string |
| start_time | string |
| duration_minutes | number |

### CreateAppointmentDTO

`apps/api/src/modules/appointments/appointment.types.ts:79`

| Field | Observed type |
| --- | --- |
| patient_id | string |
| doctor_id | string |
| utc_datetime? | string |
| appointment_date? | string |
| start_time? | string |
| duration_minutes | number |
| visit_type | AppointmentVisitType |
| priority? | AppointmentPriority |
| reason? | string \| null |
| notes? | string \| null |

### UpdateAppointmentStatusDTO

`apps/api/src/modules/appointments/appointment.types.ts:99`

| Field | Observed type |
| --- | --- |
| status | AppointmentStatus |
| notes? | string \| null |

### AppointmentListQuery

`apps/api/src/modules/appointments/appointment.types.ts:57`

| Field | Observed type |
| --- | --- |
| search? | string |
| status? | AppointmentStatus |
| doctor_id? | string |
| patient_id? | string |
| branch_id? | string |
| department_id? | string |
| date_from? | string |
| date_to? | string |
| page? | number |
| limit? | number |
| sortBy? | 'appointment_number' \| 'appointment_date' \| 'start_time' \| 'created_at' \| 'updated_at' |
| sortOrder? | 'asc' \| 'desc' |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| allowedStatusTransitions (observed transition map) | SCHEDULED: ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW', 'SKIPPED'], CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW', 'SKIPPED'], CHECKED_IN: ['SKIPPED', 'NO_SHOW', 'COMPLETED'], SKIPPED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'], CANCELLED: [], RESCHEDULED: [], NO_SHOW: [], COMPLETED: [], | `apps/api/src/modules/appointments/appointment.service.ts:37` |
| AppointmentStatus | \| 'SCHEDULED' \| 'CONFIRMED' \| 'CHECKED_IN' \| 'CANCELLED' \| 'RESCHEDULED' \| 'NO_SHOW' \| 'SKIPPED' \| 'COMPLETED' | `apps/api/src/modules/appointments/appointment.types.ts:1` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Patient Management; Doctor Management; OPD Consultation; Patient Portal; Notifications.

Observed backend import domains: `auth`, `branches`, `doctors`, `opd`, `patients`, `roles`, `settings`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/appointments/appointment.service.ts:37` — const allowedStatusTransitions: Record<Appointment['status'], Appointment['status'][]> = {
- `apps/api/src/modules/appointments/appointment.service.ts:367` — return executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/appointments/appointment.service.ts:826` — return allowedStatusTransitions[current].includes(next);

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-APT-001 | FR-APT-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall auto-generate bookable slots from the configured schedule. |
| AC-APT-002 | FR-APT-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall prevent double-booking of the same doctor/slot. |
| AC-APT-003 | FR-APT-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Search patient, select doctor and available slot, and confirm appointment or walk-in check-in. |
| AC-APT-004 | FR-APT-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall allow no-show status with reason and free the slot. |
| AC-APT-005 | FR-APT-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall allow cancellation with reason and release the slot for rebooking. |
| AC-APT-006 | FR-APT-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Reception can book, check-in, reschedule and cancel appointments. |
| AC-APT-007 | FR-APT-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Referral booking flow with doctor availability validation and same patient context. |
| AC-APT-008 | FR-APT-008 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Reject a reschedule that omits the required reason. |
| AC-APT-009 | FR-APT-009 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Keep the explicit appointment transition map authoritative for status changes. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-APT-01: Availability checks in service code do not alone prove database-safe concurrent booking; verify with approved concurrency acceptance.
- GAP-APT-02: R1 queue labels differ from appointment and OPD status vocabularies; approve their mapping.
- GAP-APT-03: Confirm no-show timing, cancellation cutoff and patient rescheduling policy separately from staff actions.
- GAP-APT-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Appointments/HMS_PHASE1_DEVELOPER2_APPOINTMENT_QUEUE_GAP_ANALYSIS.md` | f5c1176d5abefea3ff60a7daf5187cf7bdd5721db3817646eab0df0b244578e8 | Historical design evidence |
| `HMS Project/Design/Appointments/M-007_PATIENT_APPOINTMENT_PAGINATION_GAP_NOTE.md` | ec8e3ba118d92c41dda73908866158b83db32ef9e1df191eadbc77d3991df9fb | Historical design evidence |
| `HMS Project/Design/Appointments/review.md` | 2a1ef7a6ddf5e3c00b3a54aa6373a8b8dadf7738ed97a3a77abb562a963738f6 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/appointments/appointment.service.ts` | 09778ef7e96e76979faf55d2c6b85652278f68846fef47da432495bc45ca0e32 | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/appointments/appointment.model.ts`
- `apps/api/src/modules/appointments/appointment.repository.ts`
- `apps/api/src/modules/appointments/appointment.routes.ts`
- `apps/api/src/modules/appointments/appointment.schemas.ts`
- `apps/api/src/modules/appointments/appointment.service.ts`
- `apps/api/src/modules/appointments/appointment.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
