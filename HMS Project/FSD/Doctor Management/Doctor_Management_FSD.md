# Doctor Management Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Doctor Management |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Maintain clinician directory, availability and booking eligibility.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Maintain clinician directory, availability and booking eligibility. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Administrator; authorized doctor; Reception reads directory and slots.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Doctors | Doctor Availability | Edit |
| Doctors | Doctor Availability | View |
| Doctors | Doctor Directory | Create |
| Doctors | Doctor Directory | Edit |
| Doctors | Doctor Directory | Export |
| Doctors | Doctor Directory | Provision Login |
| Doctors | Doctor Directory | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-DOC-001 | Documented source requirement; approval unverified. Doctor profile, specialty, branch, availability, consultation duration and active/inactive status. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶229 | `apps/api/src/modules/doctors/doctor.service.ts:105` — create | Partial |
| FR-DOC-002 | Documented source requirement; approval unverified. Authorized admin shall create doctor profile, branch, specialty and availability before appointments can be booked. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶246 | `apps/api/src/modules/doctors/doctor.service.ts:105` — create | Partial |
| FR-DOC-003 | Documented source requirement; approval unverified. Working days, time blocks, consultation duration and branch/room assignment per doctor. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶403 | `apps/api/src/modules/doctors/doctor.service.ts:251` — updateAvailability | Partial |
| FR-DOC-004 | Documented source requirement; approval unverified. System shall auto-generate bookable slots from the configured schedule. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶405 | `apps/api/src/modules/doctors/doctor.service.ts:347` — availableSlots | Partial |
| FR-DOC-005 | Documented source requirement; approval unverified. Doctor or admin shall block breaks and leave so no slots are generated during that period. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶407 | `apps/api/src/modules/doctors/doctor.service.ts:274` — createLeave | Partial |
| FR-DOC-006 | Documented source requirement; approval unverified. System shall block overlapping schedule/appointment creation. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶440 | `apps/api/src/modules/doctors/doctor.service.ts:251` — updateAvailability | Partial |
| FR-DOC-007 | Documented source requirement; approval unverified. Do not allow surgery/procedure booking against unavailable/conflicting doctor slots. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶495 | `apps/api/src/modules/doctors/doctor.service.ts:347` — availableSlots | Partial |
| FR-DOC-008 | Implementation observation — business validation required. Maintain date-specific schedule exceptions. | `apps/api/src/modules/doctors/doctor.service.ts:316` | `apps/api/src/modules/doctors/doctor.service.ts:316` — saveException | Implemented |
| FR-DOC-009 | Implementation observation — business validation required. Validate unique user mapping and registration number before saving. | `apps/api/src/modules/doctors/doctor.service.ts:547` | `apps/api/src/modules/doctors/doctor.service.ts:547` — validateUserMapping | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Create the doctor profile with valid branch and clinical department.
2. Map the doctor to an eligible user account.
3. Configure working days, intervals and consultation duration.
4. Record leave or date-specific availability exceptions.
5. Generate available slots for the requested date.
6. Revalidate availability when an appointment or procedure is booked.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| NOT_FOUND — Doctor not found | 404 | `apps/api/src/modules/doctors/doctor.service.ts:88` |
| DOCTOR_USER_MAPPING_NOT_FOUND — The logged-in user is not mapped to a doctor profile | 404 | `apps/api/src/modules/doctors/doctor.service.ts:96` |
| DOCTOR_ONBOARDING_FAILED — Doctor onboarding transaction did not complete | 500 | `apps/api/src/modules/doctors/doctor.service.ts:117` |
| DUPLICATE_USERNAME — Username already exists | 409 | `apps/api/src/modules/doctors/doctor.service.ts:123` |
| DUPLICATE_EMAIL — Email already exists | 409 | `apps/api/src/modules/doctors/doctor.service.ts:124` |
| DUPLICATE_EMPLOYEE_CODE — Employee code already exists | 409 | `apps/api/src/modules/doctors/doctor.service.ts:126` |
| DUPLICATE_DOCTOR_REGISTRATION — Doctor registration number already exists | 409 | `apps/api/src/modules/doctors/doctor.service.ts:129` |
| DOCTOR_NUMBER_CONFLICT — Doctor number allocation conflicted; retry onboarding | 409 | `apps/api/src/modules/doctors/doctor.service.ts:132` |
| INVALID_LEAVE_RANGE — Leave start date must be on or before end date | 400 | `apps/api/src/modules/doctors/doctor.service.ts:283` |
| DOCTOR_LEAVE_OVERLAP — Doctor already has active leave in the selected date range | 409 | `apps/api/src/modules/doctors/doctor.service.ts:286` |
| VALIDATION_ERROR — From date must be on or before to date | 400 | `apps/api/src/modules/doctors/doctor.service.ts:503` |
| INVALID_BRANCH — Active branch is required | 400 | `apps/api/src/modules/doctors/doctor.service.ts:513` |
| INVALID_DEPARTMENT — Active department is required | 400 | `apps/api/src/modules/doctors/doctor.service.ts:515` |
| DEPARTMENT_BRANCH_MISMATCH — Department must belong to the selected branch | 400 | `apps/api/src/modules/doctors/doctor.service.ts:518` |
| DEPARTMENT_NOT_CLINICAL — Doctors can only be assigned to clinical departments | 400 | `apps/api/src/modules/doctors/doctor.service.ts:521` |
| INVALID_DOCTOR_EMAIL — Doctor email is invalid | 400 | `apps/api/src/modules/doctors/doctor.service.ts:540` |
| INVALID_DOCTOR_PHONE — Doctor phone is invalid | 400 | `apps/api/src/modules/doctors/doctor.service.ts:543` |
| INVALID_DOCTOR_USER — Active user is required | 400 | `apps/api/src/modules/doctors/doctor.service.ts:550` |
| DOCTOR_USER_ALREADY_MAPPED — User is already mapped to another doctor | 409 | `apps/api/src/modules/doctors/doctor.service.ts:553` |
| DUPLICATE_AVAILABILITY_DAY — Doctor availability has duplicate days | 400 | `apps/api/src/modules/doctors/doctor.service.ts:563` |
| WORKING_BLOCK_REQUIRED — At least one working block is required for an available day | 400 | `apps/api/src/modules/doctors/doctor.service.ts:575` |
| UNAVAILABLE_DAY_HAS_BLOCKS — Unavailable days cannot contain working blocks | 400 | `apps/api/src/modules/doctors/doctor.service.ts:578` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/doctors/doctor.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/DoctorAvailabilityPage.tsx` | useAppLocation, useDoctorAvailability |
| `apps/web/src/pages/DoctorDashboardPage.tsx` | useDoctorDashboard, useMemo |
| `apps/web/src/pages/DoctorDirectoryPage.tsx` | useAppLocation, useState, useMemo, useDoctorDirectory |
| `apps/web/src/pages/DoctorPerformancePage.tsx` | useDoctorPerformance |
| `apps/web/src/pages/DoctorProfilePage.tsx` | useAppLocation, useDoctorProfile |
| `apps/web/src/pages/DoctorSchedulePage.tsx` | useAppLocation, useState, useFirstDayOfWeek, useMemo, useDoctorSchedule |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/doctors | doctors.list | listDoctorsQuerySchema | `apps/api/src/modules/doctors/doctor.routes.ts:45` |
| GET /api/doctors/me | doctors.getCurrentDoctor | Inline/custom validation; inspect source | `apps/api/src/modules/doctors/doctor.routes.ts:54` |
| GET /api/doctors/user-options | doctors.listUserOptions | Inline/custom validation; inspect source | `apps/api/src/modules/doctors/doctor.routes.ts:60` |
| GET /api/doctors/export | doctors.export | listDoctorsQuerySchema | `apps/api/src/modules/doctors/doctor.routes.ts:66` |
| GET /api/doctors/:id | doctors.getById | doctorIdParamsSchema | `apps/api/src/modules/doctors/doctor.routes.ts:85` |
| POST /api/doctors | doctors.create, permissions.auditDeniedAccess, permissions.userHasPermission | createDoctorBodySchema | `apps/api/src/modules/doctors/doctor.routes.ts:94` |
| PATCH /api/doctors/:id | doctors.update | doctorIdParamsSchema, updateDoctorBodySchema | `apps/api/src/modules/doctors/doctor.routes.ts:129` |
| PATCH /api/doctors/:id/status | doctors.updateStatus | doctorIdParamsSchema, updateDoctorStatusBodySchema | `apps/api/src/modules/doctors/doctor.routes.ts:146` |
| PATCH /api/doctors/:id/user-mapping | doctors.mapUser | doctorIdParamsSchema, mapDoctorUserBodySchema | `apps/api/src/modules/doctors/doctor.routes.ts:163` |
| PATCH /api/doctors/:id/availability | doctors.updateAvailability | doctorIdParamsSchema, saveDoctorAvailabilityBodySchema | `apps/api/src/modules/doctors/doctor.routes.ts:180` |
| GET /api/doctors/:id/available-slots | doctors.availableSlots | doctorIdParamsSchema, availableSlotsQuerySchema | `apps/api/src/modules/doctors/doctor.routes.ts:197` |
| GET /api/doctors/:id/leaves | doctors.listLeaves | doctorIdParamsSchema, listDoctorLeavesQuerySchema | `apps/api/src/modules/doctors/doctor.routes.ts:206` |
| POST /api/doctors/:id/leaves | doctors.createLeave | doctorIdParamsSchema, createDoctorLeaveBodySchema | `apps/api/src/modules/doctors/doctor.routes.ts:215` |
| PATCH /api/doctors/:id/leaves/:childId/cancel | doctors.cancelLeave | doctorChildIdParamsSchema | `apps/api/src/modules/doctors/doctor.routes.ts:232` |
| GET /api/doctors/:id/availability-exceptions | doctors.listExceptions | doctorIdParamsSchema, listDoctorExceptionsQuerySchema | `apps/api/src/modules/doctors/doctor.routes.ts:249` |
| POST /api/doctors/:id/availability-exceptions | doctors.saveException | doctorIdParamsSchema, saveDoctorExceptionBodySchema | `apps/api/src/modules/doctors/doctor.routes.ts:258` |
| DELETE /api/doctors/:id/availability-exceptions/:childId | doctors.deleteException | doctorChildIdParamsSchema | `apps/api/src/modules/doctors/doctor.routes.ts:275` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### DoctorWorkingBlock

`apps/api/src/modules/doctors/doctor.types.ts:12`

| Field | Observed type |
| --- | --- |
| id | string |
| start_time | string |
| end_time | string |
| slot_duration_minutes | number |
| max_patients_per_slot? | number |

### DoctorAvailability

`apps/api/src/modules/doctors/doctor.types.ts:20`

| Field | Observed type |
| --- | --- |
| id | string |
| day_of_week | DoctorAvailabilityDay |
| is_available | boolean |
| working_blocks | DoctorWorkingBlock[] |

### Doctor

`apps/api/src/modules/doctors/doctor.types.ts:27`

| Field | Observed type |
| --- | --- |
| id | string |
| doctor_number | string |
| user_id | string \| null |
| first_name | string |
| last_name | string |
| display_name | string |
| specialization | string |
| qualification | string \| null |
| registration_number | string \| null |
| experience_years | number \| null |
| branch_id | string |
| department_id | string |
| consultation_room | string \| null |
| phone | string \| null |
| email | string \| null |
| status | DoctorStatus |
| notes | string \| null |
| availability | DoctorAvailability[] |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### DoctorOnboardingResult

`apps/api/src/modules/doctors/doctor.types.ts:112`

| Field | Observed type |
| --- | --- |
| doctor | Doctor |
| created | boolean |
| user_id | string \| null |
| username | string \| null |

### DoctorLeave

`apps/api/src/modules/doctors/doctor.types.ts:132`

| Field | Observed type |
| --- | --- |
| id | string |
| doctor_id | string |
| start_date | Date |
| end_date | Date |
| reason | string |
| status | DoctorLeaveStatus |
| created_by | string \| null |
| cancelled_by | string \| null |
| cancelled_at | Date \| null |
| created_at | Date |
| updated_at | Date |

### DoctorAvailabilityException

`apps/api/src/modules/doctors/doctor.types.ts:160`

| Field | Observed type |
| --- | --- |
| id | string |
| doctor_id | string |
| date | Date |
| is_available | boolean |
| working_blocks | DoctorWorkingBlock[] |
| reason | string |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| allowedStatusTransitions (observed transition map) | ACTIVE: ['INACTIVE', 'ON_LEAVE'], INACTIVE: ['ACTIVE'], ON_LEAVE: ['ACTIVE', 'INACTIVE'], | `apps/api/src/modules/doctors/doctor.service.ts:62` |
| DoctorStatus | 'ACTIVE' \| 'INACTIVE' \| 'ON_LEAVE' | `apps/api/src/modules/doctors/doctor.types.ts:1` |
| DoctorLeaveStatus | 'ACTIVE' \| 'CANCELLED' | `apps/api/src/modules/doctors/doctor.types.ts:130` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

User Administration; Branch Management; Department Management; Appointments; Surgery.

Observed backend import domains: `appointments`, `auth`, `branches`, `departments`, `roles`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/doctors/doctor.service.ts:62` — const allowedStatusTransitions: Record<Doctor['status'], Doctor['status'][]> = {
- `apps/api/src/modules/doctors/doctor.service.ts:114` — return await executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/doctors/doctor.service.ts:218` — if (!allowedStatusTransitions[existing.status].includes(data.status)) {

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-DOC-001 | FR-DOC-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Doctor profile, specialty, branch, availability, consultation duration and active/inactive status. |
| AC-DOC-002 | FR-DOC-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Authorized admin shall create doctor profile, branch, specialty and availability before appointments can be booked. |
| AC-DOC-003 | FR-DOC-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Working days, time blocks, consultation duration and branch/room assignment per doctor. |
| AC-DOC-004 | FR-DOC-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall auto-generate bookable slots from the configured schedule. |
| AC-DOC-005 | FR-DOC-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Doctor or admin shall block breaks and leave so no slots are generated during that period. |
| AC-DOC-006 | FR-DOC-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall block overlapping schedule/appointment creation. |
| AC-DOC-007 | FR-DOC-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Do not allow surgery/procedure booking against unavailable/conflicting doctor slots. |
| AC-DOC-008 | FR-DOC-008 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Maintain date-specific schedule exceptions. |
| AC-DOC-009 | FR-DOC-009 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Validate unique user mapping and registration number before saving. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-DOC-01: Confirm appointment versus surgery overlap rules and the handling of leave after bookings exist.
- GAP-DOC-02: Approve registration-number jurisdiction, consultation duration and doctor-user mapping policy.
- GAP-DOC-03: Current availability is observed behavior, not a signed scheduling contract.
- GAP-DOC-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Doctor Management/review.md` | fe195c67507969e226a0a269aa671bb1715fb2658bf2e25df95e84afeebba008 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/doctors/doctor.service.ts` | 9236fbce5d9b239da28bc017dd0ab9f4139491f6534d412a5590c2d2a837bd37 | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/doctors/doctor-scheduling.model.ts`
- `apps/api/src/modules/doctors/doctor.model.ts`
- `apps/api/src/modules/doctors/doctor.repository.ts`
- `apps/api/src/modules/doctors/doctor.routes.ts`
- `apps/api/src/modules/doctors/doctor.schemas.ts`
- `apps/api/src/modules/doctors/doctor.service.ts`
- `apps/api/src/modules/doctors/doctor.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
