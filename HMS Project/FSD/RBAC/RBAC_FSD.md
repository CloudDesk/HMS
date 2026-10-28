# RBAC Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | RBAC |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Control permission definitions, role assignments and escalation boundaries across branch-scoped operations.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Control permission definitions, role assignments and escalation boundaries across branch-scoped operations. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Authorized access administrator; role manager within their own authority; Super Administrator under explicit governance.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Administration | Permissions | Assign |
| Administration | Permissions | Create |
| Administration | Permissions | Delete |
| Administration | Permissions | Edit |
| Administration | Permissions | View |
| Administration | Roles | Assign |
| Administration | Roles | Create |
| Administration | Roles | Delete |
| Administration | Roles | Edit |
| Administration | Roles | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-RBAC-001 | Documented source requirement; approval unverified. Access limited to permitted tabs/screens/actions per role and branch. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1140 | `apps/api/src/modules/permissions/permission.service.ts:156` — userHasPermission | Partial |
| FR-RBAC-002 | Documented source requirement; approval unverified. User, date/time and change details logged for sensitive edits, access attempts and permission changes. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1144 | `apps/api/src/modules/permissions/permission.service.ts:160` — auditDeniedAccess | Partial |
| FR-RBAC-003 | Documented source requirement; approval unverified. Role, branch and screen-level access control is enforced and tested. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1160 | `apps/api/src/modules/permissions/permission.service.ts:156` — userHasPermission | Partial |
| FR-RBAC-004 | Documented source requirement; approval unverified. Only authorized users can bill, receive payment, reverse, refund or view sensitive financial details. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶507 | `apps/api/src/modules/permissions/permission.service.ts:156` — userHasPermission | Partial |
| FR-RBAC-005 | Documented source requirement; approval unverified. Capture user, role, action, date/time, module, old/new values and reason where applicable. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶509 | `apps/api/src/modules/permissions/permission.service.ts:617` — audit | Partial |
| FR-RBAC-006 | Implementation observation — business validation required. Reject assigning privileges beyond the actor authority. | `apps/api/src/modules/permissions/permission.service.ts:66` | `apps/api/src/modules/permissions/permission.service.ts:66` — assertCanAssignRoles | Implemented |
| FR-RBAC-007 | Implementation observation — business validation required. Guard role-permission replacement against stale versions. | `apps/api/src/modules/permissions/permission.service.ts:359` | `apps/api/src/modules/permissions/permission.service.ts:359` — replaceRolePermissions | Implemented |
| FR-RBAC-008 | Implementation observation — business validation required. Restrict modifications to protected roles. | `apps/api/src/modules/permissions/permission.service.ts:94` | `apps/api/src/modules/permissions/permission.service.ts:94` — assertCanManageRoles | Implemented |
| FR-RBAC-009 | Documented governance requirement; approval unverified. • Two-Person Verification Rule (Dual Control): Standard Laboratory and Imaging technicians have entry permissions only. Final verification, release of critical diagnostic results, and diagnostic signature must be separated into a Supervisor / Verifier role. | `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` ¶203 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Identify the actor and their database-loaded authority.
2. Read role and permission records.
3. Validate any permission or role assignment against escalation rules.
4. Apply the change with the expected version where required.
5. Preserve at least the necessary protected administrator access.
6. Audit changed assignments and denied access.
7. Enforce permissions again at the backend operation boundary.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| ROLE_ASSIGNMENT_FORBIDDEN — Role assignment is not authorized | 403 | `apps/api/src/modules/permissions/permission.service.ts:73` |
| SUPER_ADMIN_ASSIGNMENT_FORBIDDEN — Only a Super Administrator may assign the Super Administrator role | 403 | `apps/api/src/modules/permissions/permission.service.ts:77` |
| ROLE_ASSIGNMENT_EXCEEDS_AUTHORITY — Cannot assign roles outside your current authority | 403 | `apps/api/src/modules/permissions/permission.service.ts:86` |
| PRIVILEGED_ROLE_MODIFICATION_FORBIDDEN — Role modification is not authorized | 403 | `apps/api/src/modules/permissions/permission.service.ts:101` |
| PERMISSION_NOT_FOUND — Permission not found | 404 | `apps/api/src/modules/permissions/permission.service.ts:300` |
| ACTIVE_PERMISSION_DELETE_RESTRICTED — Only inactive permissions can be deleted | 400 | `apps/api/src/modules/permissions/permission.service.ts:322` |
| PERMISSION_ASSIGNED_TO_ROLES — Permission cannot be deleted while assigned to roles | 400 | `apps/api/src/modules/permissions/permission.service.ts:326` |
| SUPER_ADMIN_PERMISSIONS_IMMUTABLE — Super Administrator always has every active permission | 409 | `apps/api/src/modules/permissions/permission.service.ts:368` |
| PERMISSION_ID_REQUIRED — Permission id is required | 400 | `apps/api/src/modules/permissions/permission.service.ts:380` |
| INVALID_PERMISSION_ASSIGNMENT — One or more permissions were not found | 400 | `apps/api/src/modules/permissions/permission.service.ts:386` |
| INACTIVE_PERMISSION_ASSIGNMENT — Inactive permissions cannot be assigned to roles | 400 | `apps/api/src/modules/permissions/permission.service.ts:390` |
| PERMISSION_ESCALATION_FORBIDDEN — Cannot assign permissions outside your current access | 403 | `apps/api/src/modules/permissions/permission.service.ts:396` |
| INVALID_ROLE_VERSION — Role version is invalid | 400 | `apps/api/src/modules/permissions/permission.service.ts:402` |
| STALE_ROLE_PERMISSIONS — This role changed after you opened it. Refresh and review the latest permissions before saving again. | 409 | `apps/api/src/modules/permissions/permission.service.ts:411` |
| ROLE_NOT_FOUND — Role not found | 404 | `apps/api/src/modules/permissions/permission.service.ts:440` |
| PERMISSION_MODULE_REQUIRED — Permission module is required | 400 | `apps/api/src/modules/permissions/permission.service.ts:499` |
| PERMISSION_SCREEN_REQUIRED — Permission screen is required | 400 | `apps/api/src/modules/permissions/permission.service.ts:503` |
| PERMISSION_ACTION_REQUIRED — Permission action is required | 400 | `apps/api/src/modules/permissions/permission.service.ts:507` |
| INVALID_PERMISSION_CODE — Permission code format is invalid | 400 | `apps/api/src/modules/permissions/permission.service.ts:511` |
| PERMISSION_NAME_REQUIRED — Permission name is required | 400 | `apps/api/src/modules/permissions/permission.service.ts:515` |
| INVALID_PERMISSION_TYPE — Permission type is invalid | 400 | `apps/api/src/modules/permissions/permission.service.ts:519` |
| INVALID_PERMISSION_STATUS — Permission status is invalid | 400 | `apps/api/src/modules/permissions/permission.service.ts:523` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/permissions/permission.schemas.ts`
- `apps/api/src/modules/roles/role.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/RolesPermissionsPage.tsx` | useTimezone, useAuth, useAppLocation, useRolesPermissionsFeature, useState, useEffect, useMemo, useCallback |
| `apps/web/src/hooks/admin/useRolesPermissionsFeature.ts` | useRolesPermissionsFeature, useAuth, useCallback, useState, useMemo, useRolesList, useRoleStats, useAllPermissions |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/permissions | permissions.list | listPermissionsQuerySchema | `apps/api/src/modules/permissions/permission.routes.ts:69` |
| GET /api/permissions/:id | permissions.getById | permissionIdParamsSchema | `apps/api/src/modules/permissions/permission.routes.ts:81` |
| GET /api/permissions/:id/roles | permissions.getRolesByPermission | permissionIdParamsSchema | `apps/api/src/modules/permissions/permission.routes.ts:93` |
| POST /api/permissions | permissions.create | createPermissionBodySchema | `apps/api/src/modules/permissions/permission.routes.ts:104` |
| PATCH /api/permissions/:id | permissions.update | permissionIdParamsSchema, updatePermissionBodySchema | `apps/api/src/modules/permissions/permission.routes.ts:122` |
| DELETE /api/permissions/:id | permissions.delete | permissionIdParamsSchema | `apps/api/src/modules/permissions/permission.routes.ts:142` |
| GET /api/roles/:id/permissions | permissions.getPermissionsByRole | rolePermissionParamsSchema | `apps/api/src/modules/permissions/permission.routes.ts:160` |
| PUT /api/roles/:id/permissions | permissions.replaceRolePermissions | rolePermissionParamsSchema, replaceRolePermissionsBodySchema | `apps/api/src/modules/permissions/permission.routes.ts:171` |
| GET /api/roles | roles.list | listRolesQuerySchema | `apps/api/src/modules/roles/role.routes.ts:63` |
| GET /api/roles/:id | roles.getById | roleIdParamsSchema | `apps/api/src/modules/roles/role.routes.ts:75` |
| GET /api/roles/:id/audit-logs | roles.listAuditLogs | roleIdParamsSchema, roleAuditQuerySchema | `apps/api/src/modules/roles/role.routes.ts:87` |
| POST /api/roles | roles.create | createRoleBodySchema | `apps/api/src/modules/roles/role.routes.ts:96` |
| PATCH /api/roles/:id | roles.update | roleIdParamsSchema, updateRoleBodySchema | `apps/api/src/modules/roles/role.routes.ts:114` |
| PATCH /api/roles/:id/status | roles.updateStatus | roleIdParamsSchema, updateRoleStatusBodySchema | `apps/api/src/modules/roles/role.routes.ts:134` |
| POST /api/roles/:id/users | roles.assignUser | roleIdParamsSchema, assignRoleUserBodySchema | `apps/api/src/modules/roles/role.routes.ts:154` |
| DELETE /api/roles/:id/users/:userId | roles.removeUser | roleUserParamsSchema | `apps/api/src/modules/roles/role.routes.ts:174` |
| DELETE /api/roles/:id | roles.delete | roleIdParamsSchema | `apps/api/src/modules/roles/role.routes.ts:193` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### PermissionRecord

`apps/api/src/modules/permissions/permission.types.ts:5`

| Field | Observed type |
| --- | --- |
| id | string |
| code | string |
| name | string |
| module | string |
| screen | string |
| action | string |
| description | string \| null |
| type | PermissionType |
| status | PermissionStatus |
| categoryId | string \| null |
| categoryCode | string \| null |
| categoryName | string \| null |
| groupId | string \| null |
| groupCode | string \| null |
| groupName | string \| null |
| roleCount | number |
| createdAt | Date |
| updatedAt | Date |
| deletedAt | Date \| null |
| createdBy | string \| null |
| updatedBy | string \| null |
| deletedBy | string \| null |

### RolePermissionSummary

`apps/api/src/modules/permissions/permission.types.ts:54`

| Field | Observed type |
| --- | --- |
| id | string |
| code | string |
| name | string |
| type | string |
| status | string |
| assignedAt | Date |
| assignedBy | string \| null |

### RoleRecord

`apps/api/src/modules/roles/role.types.ts:5`

| Field | Observed type |
| --- | --- |
| id | string |
| code | string |
| name | string |
| description | string \| null |
| type | RoleType |
| status | RoleStatus |
| color | string \| null |
| userCount | number |
| createdAt | Date |
| updatedAt | Date |
| deletedAt | Date \| null |
| createdBy | string \| null |
| updatedBy | string \| null |
| deletedBy | string \| null |

### RoleAssignedUser

`apps/api/src/modules/roles/role.types.ts:22`

| Field | Observed type |
| --- | --- |
| id | string |
| username | string |
| fullName | string |
| email | string \| null |
| status | string |
| assignedAt | Date |
| assignedBy | string \| null |

### RoleAuditLogItem

`apps/api/src/modules/roles/role.types.ts:57`

| Field | Observed type |
| --- | --- |
| id | string |
| actorName | string |
| eventType | string |
| createdAt | Date |

### PermissionListQuery

`apps/api/src/modules/permissions/permission.types.ts:39`

| Field | Observed type |
| --- | --- |
| search? | string |
| status? | PermissionStatus |
| type? | PermissionType |
| module? | string |
| screen? | string |
| action? | string |
| categoryId? | string |
| groupId? | string |
| page | number |
| limit | number |
| sortBy | 'module' \| 'screen' \| 'action' \| 'name' \| 'code' \| 'type' \| 'status' \| 'roleCount' \| 'createdAt' |
| sortOrder | 'asc' \| 'desc' |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| PermissionStatus | 'active' \| 'inactive' | `apps/api/src/modules/permissions/permission.types.ts:1` |
| RoleStatus | 'active' \| 'inactive' | `apps/api/src/modules/roles/role.types.ts:1` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Authentication; User Administration; Branch Management; every protected module.

Observed backend import domains: `auth`, `branches`, `permissions`, `roles`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-RBAC-001 | FR-RBAC-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Access limited to permitted tabs/screens/actions per role and branch. |
| AC-RBAC-002 | FR-RBAC-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: User, date/time and change details logged for sensitive edits, access attempts and permission changes. |
| AC-RBAC-003 | FR-RBAC-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Role, branch and screen-level access control is enforced and tested. |
| AC-RBAC-004 | FR-RBAC-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Only authorized users can bill, receive payment, reverse, refund or view sensitive financial details. |
| AC-RBAC-005 | FR-RBAC-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Capture user, role, action, date/time, module, old/new values and reason where applicable. |
| AC-RBAC-006 | FR-RBAC-006 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Reject assigning privileges beyond the actor authority. |
| AC-RBAC-007 | FR-RBAC-007 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Guard role-permission replacement against stale versions. |
| AC-RBAC-008 | FR-RBAC-008 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Restrict modifications to protected roles. |
| AC-RBAC-009 | FR-RBAC-009 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: • Two-Person Verification Rule (Dual Control): Standard Laboratory and Imaging technicians have entry permissions only. Final verification, release of critical diagnostic results, and diagnostic signature must be separated into a Supervisor / Verifier role. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-RBAC-01: The retained governance matrix proposes Admission, Surgery and Emergency roles pending sign-off; proposed roles are not approved defaults.
- GAP-RBAC-02: Governance limits on clinical and financial access must be reconciled with current seeds and actual assignments.
- GAP-RBAC-03: Confirm two-person diagnostic verification and pharmacy-supervisor controls beyond permission names.
- GAP-RBAC-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/RBAC/HMS_PERMISSION_USAGE_MAP.md` | ac438a794bf9478f936cb3ecea8fadd3beb14aa9278eab69be44b11c8905293c | Historical design evidence |
| `HMS Project/Design/RBAC/HMS_ROLE_BASED_DASHBOARD_GAP_NOTE.md` | 88ce42d0b3ffde7dbaf8ad02e2e1fce702c83feff54a9feb405cc2d137ccf66a | Historical design evidence |
| `HMS Project/Design/RBAC/HMS_ROLE_PERMISSION_ARCHITECTURE_ANALYSIS.md` | 1f16038d04fab87aaaa5b9a65462c71ada90b36496aa921a1be5ea0849239469 | Historical design evidence |
| `HMS Project/Design/RBAC/HMS_ROLE_PERMISSION_ASSIGNMENT.md` | af3a1c4558b31c9173977bcd4eeefdbffbbc1b4b3e4385ab0e7903663edb9bbe | Historical design evidence |
| `HMS Project/Design/RBAC/HMS_ROLE_PERMISSION_ASSIGNMENT_IMPLEMENTATION.md` | c3350209085e97e2008ace18ead4b7dcda09cbe7754a0caea0ae2fe9b763ac89 | Historical design evidence |
| `HMS Project/Design/RBAC/HMS_ROLE_PERMISSION_ASSIGNMENT_MATRIX.md` | d0dbc0c923c122637443f2b0e92dadb8706e09baf2a8e9766c7048afe4e305f6 | Historical design evidence |
| `HMS Project/Design/RBAC/HMS_ROLE_PERMISSION_RECTIFICATION_AUDIT_MATRIX.md` | eb717ed2acaa7c19885fe0ca1d7a416f465db4057c4a8485dc30d78a402d5471 | Historical design evidence |
| `HMS Project/Design/RBAC/HMS_ROLE_PERMISSION_RECTIFICATION_GAP_NOTE.md` | ada8c816d76be8b21c92a600cc8b8f0bd606a6f14de77a1c98512ccdd98d9809 | Historical design evidence |
| `HMS Project/Design/RBAC/M-012_PERMISSION_EXPANSION_GAP_NOTE.md` | 7ae58d4d0e8749c2d281d1bb295fa9f5a7efabd5e69d9d3a79b7fdae3b0cf014 | Historical design evidence |
| `HMS Project/Design/RBAC/review.md` | a6a257e84ed95839d0fb1d16de488b2da99a869fd5883769f1ac5e3325e49cec | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/permissions/permission.service.ts` | 7b75c35571cdb6719b5e5de632ad553f070d83fc0ee7c7c3121bf57b95030937 | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/permissions/permission-display.ts`
- `apps/api/src/modules/permissions/permission.model.ts`
- `apps/api/src/modules/permissions/permission.repository.ts`
- `apps/api/src/modules/permissions/permission.routes.ts`
- `apps/api/src/modules/permissions/permission.schemas.ts`
- `apps/api/src/modules/permissions/permission.service.ts`
- `apps/api/src/modules/permissions/permission.types.ts`
- `apps/api/src/modules/roles/role.model.ts`
- `apps/api/src/modules/roles/role.repository.ts`
- `apps/api/src/modules/roles/role.routes.ts`
- `apps/api/src/modules/roles/role.schemas.ts`
- `apps/api/src/modules/roles/role.service.ts`
- `apps/api/src/modules/roles/role.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
