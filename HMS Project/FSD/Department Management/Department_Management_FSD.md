# Department Management Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Department Management |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Maintain branch-linked departments and control whether their services are available for operational use.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Maintain branch-linked departments and control whether their services are available for operational use. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Authorized system or branch administrator.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Administration | Departments | Create |
| Administration | Departments | Delete |
| Administration | Departments | Edit |
| Administration | Departments | Export |
| Administration | Departments | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-DEPT-001 | Documented source requirement; approval unverified. Organization profile, branches, departments, rooms/consultation areas, service locations and country/currency settings. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶225 | `apps/api/src/modules/departments/department.service.ts:29` — create | Partial |
| FR-DEPT-002 | Documented source requirement; approval unverified. Release 1 shall include the master data required to operate OPD, Emergency and IPD services from day one. Master data must be configurable by authorized users only and shall support multi-country/multi-currency hospital groups. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶221 | `apps/api/src/modules/departments/department.service.ts:29` — create | Partial |
| FR-DEPT-003 | Documented source requirement; approval unverified. System shall prevent new usage while preserving history. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶254 | `apps/api/src/modules/departments/department.service.ts:66` — delete | Partial |
| FR-DEPT-004 | Implementation observation — business validation required. Validate the selected branch before creating or updating a department. | `apps/api/src/modules/departments/department.service.ts:101` | `apps/api/src/modules/departments/department.service.ts:101` — requireActiveBranch | Implemented |
| FR-DEPT-005 | Implementation observation — business validation required. Prevent removal of a department with dependent records. | `apps/api/src/modules/departments/department.service.ts:66` | `apps/api/src/modules/departments/department.service.ts:66` — delete | Implemented |
| FR-DEPT-006 | Implementation observation — business validation required. Export department records through the existing service. | `apps/api/src/modules/departments/department.service.ts:81` | `apps/api/src/modules/departments/department.service.ts:81` — export | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Choose the authorized branch.
2. List or create a department.
3. Validate that the branch is active.
4. Update department attributes and status.
5. Use department context in doctor, service and clinical routing.
6. Reject removal when dependent records remain.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| NOT_FOUND — Department not found | 404 | `apps/api/src/modules/departments/department.service.ts:20` |
| DEPARTMENT_HAS_DEPENDENCIES — Department cannot be deleted while services or users are assigned | 409 | `apps/api/src/modules/departments/department.service.ts:70` |
| INVALID_BRANCH — Branch not found | 400 | `apps/api/src/modules/departments/department.service.ts:104` |
| INACTIVE_BRANCH — Inactive branch cannot be assigned | 400 | `apps/api/src/modules/departments/department.service.ts:107` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/departments/department.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/DepartmentManagementPage.tsx` | useMemo, useDepartmentManagementFeature, useAppLocation, useState, useEffect |
| `apps/web/src/hooks/departments/useDepartmentManagementFeature.ts` | useDepartmentManagementFeature, useAuth, useCallback, useState, useDepartmentsList, useDepartmentSummary, useBranchesList, useCreateDepartment |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/departments | departments.list | listDepartmentsQuerySchema | `apps/api/src/modules/departments/department.routes.ts:24` |
| GET /api/departments/summary | departments.summary | Inline/custom validation; inspect source | `apps/api/src/modules/departments/department.routes.ts:35` |
| GET /api/departments/export | departments.export | listDepartmentsQuerySchema | `apps/api/src/modules/departments/department.routes.ts:41` |
| GET /api/departments/:id | departments.getById | departmentIdParamsSchema | `apps/api/src/modules/departments/department.routes.ts:54` |
| POST /api/departments | departments.create | createDepartmentBodySchema | `apps/api/src/modules/departments/department.routes.ts:65` |
| PATCH /api/departments/:id | departments.update | departmentIdParamsSchema, updateDepartmentBodySchema | `apps/api/src/modules/departments/department.routes.ts:79` |
| PATCH /api/departments/:id/status | departments.updateStatus | departmentIdParamsSchema, updateDepartmentStatusBodySchema | `apps/api/src/modules/departments/department.routes.ts:91` |
| DELETE /api/departments/:id | departments.delete | departmentIdParamsSchema | `apps/api/src/modules/departments/department.routes.ts:100` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### Department

`apps/api/src/modules/departments/department.types.ts:3`

| Field | Observed type |
| --- | --- |
| id | string |
| code | string |
| name | string |
| description | string \| null |
| branch_ids | string[] |
| status | DepartmentStatus |
| isClinical | boolean |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### CreateDepartmentDTO

`apps/api/src/modules/departments/department.types.ts:28`

| Field | Observed type |
| --- | --- |
| code | string |
| name | string |
| branch_ids | string[] |
| description? | string \| null |
| status? | DepartmentStatus |
| isClinical? | boolean |

### DepartmentListQuery

`apps/api/src/modules/departments/department.types.ts:17`

| Field | Observed type |
| --- | --- |
| search? | string |
| status? | DepartmentStatus |
| isClinical? | boolean |
| branch_id? | string |
| page? | number |
| limit? | number |
| sortBy? | 'name' \| 'code' \| 'status' \| 'created_at' \| 'updated_at' |
| sortOrder? | 'asc' \| 'desc' |

### DepartmentRequestMetadata

`apps/api/src/modules/departments/department.types.ts:39`

| Field | Observed type |
| --- | --- |
| ipAddress? | string |
| userAgent? | string |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| DepartmentStatus | 'ACTIVE' \| 'INACTIVE' | `apps/api/src/modules/departments/department.types.ts:1` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Branch Management; Doctor Management; Service Catalog; RBAC.

Observed backend import domains: `auth`, `branches`, `services`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-DEPT-001 | FR-DEPT-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Organization profile, branches, departments, rooms/consultation areas, service locations and country/currency settings. |
| AC-DEPT-002 | FR-DEPT-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Release 1 shall include the master data required to operate OPD, Emergency and IPD services from day one. Master data must be configurable by authorized users only and shall support multi-country/multi-currency hospital groups. |
| AC-DEPT-003 | FR-DEPT-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall prevent new usage while preserving history. |
| AC-DEPT-004 | FR-DEPT-004 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Validate the selected branch before creating or updating a department. |
| AC-DEPT-005 | FR-DEPT-005 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Prevent removal of a department with dependent records. |
| AC-DEPT-006 | FR-DEPT-006 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Export department records through the existing service. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-DEPT-01: The shared master-data scope does not define every department flag or specialty visibility rule.
- GAP-DEPT-02: Approve clinical versus nonclinical classification and department-module visibility.
- GAP-DEPT-03: Source design notes from other revisions must not override current contracts without review.
- GAP-DEPT-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Department Management/HMS_DEPARTMENT_MODULE_VISIBILITY_GAP_NOTE.md` | 7783d02f429fffee5ec9f50f67ad64226526abca44648b5d751c7289fc3deafe | Historical design evidence |
| `HMS Project/Design/Department Management/review.md` | 218d2d7f69572b6c70b5a2eae63d074c7113b67a09899f8fe07d83a2059cf6eb | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/departments/department.service.ts` | 6bfdd8031bcdcd911bfba15b943987bd4bee0ea7a1e6c697d3699d1e5aa8e299 | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/departments/department.model.ts`
- `apps/api/src/modules/departments/department.repository.ts`
- `apps/api/src/modules/departments/department.routes.ts`
- `apps/api/src/modules/departments/department.schemas.ts`
- `apps/api/src/modules/departments/department.service.ts`
- `apps/api/src/modules/departments/department.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
