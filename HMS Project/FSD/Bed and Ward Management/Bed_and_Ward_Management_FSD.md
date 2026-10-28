# Bed and Ward Management Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Bed and Ward Management |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Maintain ward and bed availability, temporary holds, allocation and transfers for admission workflows.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Maintain ward and bed availability, temporary holds, allocation and transfers for admission workflows. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Administrator; Admission Officer or configured Bed/Ward Coordinator; ward staff.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Admissions | Admission Policy | Edit |
| Admissions | Admission Policy | View |
| Admissions | Bed Holds | Cancel |
| Admissions | Bed Holds | Create |
| Admissions | Bed Holds | Release |
| Admissions | Bed Transfers | Cancel |
| Admissions | Bed Transfers | Complete |
| Admissions | Bed Transfers | Create |
| Admissions | Bed Transfers | CrossBranch |
| Admissions | Beds | ChangeStatus |
| Admissions | Beds | Create |
| Admissions | Beds | Edit |
| Admissions | Beds | View |
| Admissions | Wards | ChangeStatus |
| Admissions | Wards | Create |
| Admissions | Wards | Edit |
| Admissions | Wards | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-BED-001 | Documented source requirement; approval unverified. Release 1 shall provide a structured facility hierarchy (Building > Floor > Ward > Room > Bed) with real-time bed status to support admission, transfer and discharge decisions, as well as bed and ward occupancy reporting. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶692 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:63` — createWard | Partial |
| FR-BED-002 | Documented source requirement; approval unverified. Configurable status values: Available, Reserved, Occupied, Cleaning, Maintenance. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶707 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:71` — updateBedStatus | Partial |
| FR-BED-003 | Documented source requirement; approval unverified. Update bed status to Cleaning on discharge/transfer, then Available once housekeeping confirms readiness. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶720 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:153` — releaseAdmissionBed | Partial |
| FR-BED-004 | Documented source requirement; approval unverified. System shall allow authorized release of the reservation back to Available. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶737 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:111` — closeHold | Partial |
| FR-BED-005 | Documented source requirement; approval unverified. Create and maintain bed records by branch, ward/room, bed type and active status. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶296 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:69` — createBed | Partial |
| FR-BED-006 | Documented source requirement; approval unverified. Show only beds that are available for allotment based on branch, bed type and current status. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶300 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:67` — listBeds | Partial |
| FR-BED-007 | Documented source requirement; approval unverified. Allow temporary bed hold if configured, with expiry/approval rules. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶302 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:91` — createHold | Partial |
| FR-BED-008 | Documented source requirement; approval unverified. Assign available bed to patient admission/conversion context. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶304 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:122` — allotAdmission | Partial |
| FR-BED-009 | Documented source requirement; approval unverified. Move patient from one bed to another with reason and audit trail if permitted. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶306 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:182` — completeTransfer | Partial |
| FR-BED-010 | Documented source requirement; approval unverified. Revalidate before final allotment and show slot/bed no longer available if taken. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶519 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:122` — allotAdmission | Partial |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Configure branch, ward and bed records.
2. Filter availability by branch, ward, category and current status.
3. Place an authorized, time-limited hold where policy permits.
4. Revalidate ownership and availability before admission allotment.
5. Request and complete a bed transfer with source and destination context.
6. Release the bed under the approved discharge or cancellation policy.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| BRANCH_ACCESS_DENIED — Branch access denied | 403 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:34` |
| BED_LIFECYCLE_CONFLICT — The requested bed lifecycle record conflicts with an existing active record | 409 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:38` |
| WARD_NOT_FOUND — Ward not found | 404 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:62` |
| WARD_UPDATE_CONFLICT — Ward not found or contains active bed ownership | 409 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:64` |
| WARD_HAS_ACTIVE_BEDS — A ward with reserved or occupied beds cannot be deactivated | 409 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:65` |
| BED_NOT_FOUND — Bed not found | 404 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:68` |
| WARD_INACTIVE — Beds cannot be added to an inactive ward | 409 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:69` |
| BED_CREATE_FAILED — Bed could not be created | 500 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:69` |
| BED_OWNERSHIP_CONFLICT — Bed is not editable while held or occupied | 409 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:70` |
| MANUAL_BED_OWNERSHIP_FORBIDDEN — Occupied and reserved states are managed only by allotment and hold workflows | 409 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:71` |
| BED_STATUS_REASON_REQUIRED — A reason is required to block a bed or place it under maintenance | 400 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:71` |
| ADMISSION_POLICY_NOT_CONFIGURED — Configure an active admission policy for this branch | 409 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:78` |
| ADMISSION_POLICY_SAVE_FAILED — Admission policy could not be saved | 500 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:87` |
| IDEMPOTENCY_CONFLICT — The idempotency key was already used for a different hold request | 409 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:94` |
| PATIENT_NOT_FOUND — Active patient not found | 404 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:99` |
| BED_NOT_AVAILABLE — Bed is no longer available; refresh the bed board | 409 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:102` |
| BED_HOLD_CREATE_FAILED — Bed hold could not be created | 500 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:107` |
| BED_HOLD_CONFLICT — Active bed hold not found or bed ownership changed | 409 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:116` |
| ADMISSION_NOT_FOUND — Active admission not found | 404 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:169` |
| CROSS_BRANCH_TRANSFER_PERMISSION_REQUIRED — Cross-branch transfer permission is required | 403 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:170` |
| TRANSFER_ALREADY_PENDING — This admission already has a pending transfer | 409 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:171` |
| SOURCE_BED_OWNERSHIP_CONFLICT — Current admission bed ownership is inconsistent | 409 | `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:172` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/admissions-configuration/admissions-configuration.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/BedAvailabilityPage.tsx` | useBedAvailabilityFeature, useState, useMemo |
| `apps/web/src/pages/BedManagementPage.tsx` | useAppLocation, useMemo, useState, useBedManagementFeature, useEffect |
| `apps/web/src/hooks/admissions/useBedManagementFeature.ts` | useBedManagementFeature, useAuth, useBranchesList, useState, useEffect, usePatientsList, useAdmissionsConfiguration, useBedTransferOptions |
| `apps/web/src/hooks/branches/useBranchWardBedConfigurationFeature.ts` | useBranchWardBedConfigurationFeature, useAuth, useAdmissionsConfiguration |
| `apps/web/src/hooks/reception/useBedAvailabilityFeature.ts` | useBedAvailabilityFeature, useBranchesList, useState, useEffect, useAvailableBeds, useBedAvailabilitySummary |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/admissions/wards | admissionsConfiguration.listWards | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:21` |
| GET /api/admissions/wards/:id | admissionsConfiguration.getWard | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:22` |
| POST /api/admissions/wards | admissionsConfiguration.createWard | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:23` |
| PATCH /api/admissions/wards/:id | admissionsConfiguration.updateWard | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:24` |
| PATCH /api/admissions/wards/:id/status | admissionsConfiguration.updateWardStatus | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:25` |
| GET /api/admissions/beds/summary | admissionsConfiguration.summary | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:26` |
| GET /api/admissions/beds | admissionsConfiguration.listBeds | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:27` |
| GET /api/admissions/beds/:id | admissionsConfiguration.getBed | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:28` |
| POST /api/admissions/beds | admissionsConfiguration.createBed | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:29` |
| PATCH /api/admissions/beds/:id | admissionsConfiguration.updateBed | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:30` |
| PATCH /api/admissions/beds/:id/status | admissionsConfiguration.updateBedStatus | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:31` |
| GET /api/admissions/policy | admissionsConfiguration.getPolicy | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:32` |
| PUT /api/admissions/policy | admissionsConfiguration.savePolicy | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:33` |
| POST /api/admissions/beds/:id/holds | admissionsConfiguration.createHold | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:34` |
| POST /api/admissions/bed-holds/:id/release | admissionsConfiguration.closeHold | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:35` |
| POST /api/admissions/bed-holds/:id/cancel | admissionsConfiguration.closeHold | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:36` |
| POST /api/admissions/inpatients/:id/transfers | admissionsConfiguration.createTransfer | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:37` |
| POST /api/admissions/inpatients/:id/cross-branch-transfers | admissionsConfiguration.createTransfer | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:38` |
| POST /api/admissions/bed-transfers/:id/complete | admissionsConfiguration.completeTransfer | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:39` |
| POST /api/admissions/bed-transfers/:id/complete-cross-branch | admissionsConfiguration.completeTransfer | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:40` |
| POST /api/admissions/bed-transfers/:id/cancel | admissionsConfiguration.cancelTransfer | Inline/custom validation; inspect source | `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts:41` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### Ward

`apps/api/src/modules/admissions-configuration/admissions-configuration.types.ts:7`

| Field | Observed type |
| --- | --- |
| id | string |
| branch_id | string |
| name | string |
| ward_type | string |
| floor | string |
| description | string \| null |
| status | WardStatus |
| created_at | Date |
| updated_at | Date |

### Bed

`apps/api/src/modules/admissions-configuration/admissions-configuration.types.ts:8`

| Field | Observed type |
| --- | --- |
| id | string |
| branch_id | string |
| ward_id | string |
| ward_name | string |
| bed_number | string |
| bed_category | string |
| room_number | string \| null |
| status | BedStatus |
| block_reason_code | string \| null |
| current_hold_id | string \| null |
| current_admission_id | string \| null |
| hold_number | string \| null |
| hold_expires_at | Date \| null |
| admission_number | string \| null |
| patient_id | string \| null |
| patient_number | string \| null |
| patient_name | string \| null |
| version | number |
| created_at | Date |
| updated_at | Date |

### BedSummary

`apps/api/src/modules/admissions-configuration/admissions-configuration.types.ts:33`

| Field | Observed type |
| --- | --- |
| total | number |
| available | number |
| occupied | number |
| reserved | number |
| blocked | number |
| under_maintenance | number |
| inactive | number |

### AdmissionPolicy

`apps/api/src/modules/admissions-configuration/admissions-configuration.types.ts:34`

| Field | Observed type |
| --- | --- |
| id | string |
| branch_id | string |
| bed_hold_duration_minutes | number |
| admission_consent_required | boolean |
| admission_advance_deposit_required | boolean |
| admission_minimum_deposit_amount | number |
| status | 'ACTIVE' \| 'INACTIVE' |
| version | number |
| created_at | Date |
| updated_at | Date |

### BedHold

`apps/api/src/modules/admissions-configuration/admissions-configuration.types.ts:53`

| Field | Observed type |
| --- | --- |
| id | string |
| hold_number | string |
| idempotency_key | string |
| patient_id | string |
| branch_id | string |
| ward_id | string |
| bed_id | string |
| admission_id | string \| null |
| bed_number | string |
| ward_name | string |
| room_number | string \| null |
| status | BedHoldStatus |
| held_at | Date |
| expires_at | Date |
| reason | string |
| terminal_reason | string \| null |
| version | number |
| created_at | Date |
| updated_at | Date |

### BedTransfer

`apps/api/src/modules/admissions-configuration/admissions-configuration.types.ts:82`

| Field | Observed type |
| --- | --- |
| id | string |
| admission_id | string |
| patient_id | string |
| source_branch_id | string |
| source_ward_id | string |
| source_bed_id | string |
| destination_branch_id | string |
| destination_ward_id | string |
| destination_bed_id | string |
| source_bed_number | string |
| destination_bed_number | string |
| reason | string |
| status | BedTransferStatus |
| requested_at | Date |
| completed_at | Date \| null |
| cancelled_at | Date \| null |
| created_at | Date |
| updated_at | Date |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| WardStatus | 'ACTIVE' \| 'INACTIVE' | `apps/api/src/modules/admissions-configuration/admissions-configuration.types.ts:1` |
| BedStatus | 'AVAILABLE' \| 'OCCUPIED' \| 'RESERVED' \| 'BLOCKED' \| 'UNDER_MAINTENANCE' \| 'INACTIVE' | `apps/api/src/modules/admissions-configuration/admissions-configuration.types.ts:2` |
| BedHoldStatus | 'ACTIVE' \| 'CONSUMED' \| 'RELEASED' \| 'EXPIRED' \| 'CANCELLED' | `apps/api/src/modules/admissions-configuration/admissions-configuration.types.ts:3` |
| BedTransferStatus | 'PENDING' \| 'COMPLETED' \| 'CANCELLED' | `apps/api/src/modules/admissions-configuration/admissions-configuration.types.ts:4` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

IPD; Patient Management; Consent Management; Advance Payments; Reporting.

Observed backend import domains: `auth`, `branches`, `inpatient-admissions`, `patients`, `roles`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:50` — await executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:83` — await executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:97` — await executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:114` — await executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:168` — await executeTransaction(this.repository, async (session) => {
- `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts:185` — await executeTransaction(this.repository, async (session) => {

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-BED-001 | FR-BED-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Release 1 shall provide a structured facility hierarchy (Building > Floor > Ward > Room > Bed) with real-time bed status to support admission, transfer and discharge decisions, as well as bed and ward occupancy reporting. |
| AC-BED-002 | FR-BED-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Configurable status values: Available, Reserved, Occupied, Cleaning, Maintenance. |
| AC-BED-003 | FR-BED-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Update bed status to Cleaning on discharge/transfer, then Available once housekeeping confirms readiness. |
| AC-BED-004 | FR-BED-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall allow authorized release of the reservation back to Available. |
| AC-BED-005 | FR-BED-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Create and maintain bed records by branch, ward/room, bed type and active status. |
| AC-BED-006 | FR-BED-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Show only beds that are available for allotment based on branch, bed type and current status. |
| AC-BED-007 | FR-BED-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Allow temporary bed hold if configured, with expiry/approval rules. |
| AC-BED-008 | FR-BED-008 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Assign available bed to patient admission/conversion context. |
| AC-BED-009 | FR-BED-009 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Move patient from one bed to another with reason and audit trail if permitted. |
| AC-BED-010 | FR-BED-010 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Revalidate before final allotment and show slot/bed no longer available if taken. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-BED-01: R1 defines Building > Floor > Ward > Room > Bed; current types expose ward floor and bed room fields rather than evidence of every separate master.
- GAP-BED-02: R1 Cleaning and R2 Held/Released differ from current RESERVED, BLOCKED and UNDER_MAINTENANCE vocabulary; approve housekeeping and release mappings.
- GAP-BED-03: Hold expiry, cross-branch transfer and gender/ward policy need operational sign-off.
- GAP-BED-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |

Current implementation files inspected for this module:

- `apps/api/src/modules/admissions-configuration/admissions-configuration.model.ts`
- `apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts`
- `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts`
- `apps/api/src/modules/admissions-configuration/admissions-configuration.schemas.ts`
- `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts`
- `apps/api/src/modules/admissions-configuration/admissions-configuration.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
