# Branch Management Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Branch Management |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Maintain branch identities and organizational context used by scoped hospital operations.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Maintain branch identities and organizational context used by scoped hospital operations. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

System Administrator; Branch Administrator within granted scope.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Administration | Branches | Create |
| Administration | Branches | Delete |
| Administration | Branches | Edit |
| Administration | Branches | Export |
| Administration | Branches | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-BRANCH-001 | Documented source requirement; approval unverified. Organization profile, branches, departments, rooms/consultation areas, service locations and country/currency settings. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶225 | `apps/api/src/modules/branches/branch.service.ts:35` — create | Partial |
| FR-BRANCH-002 | Documented source requirement; approval unverified. Release 1 shall include the master data required to operate OPD, Emergency and IPD services from day one. Master data must be configurable by authorized users only and shall support multi-country/multi-currency hospital groups. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶221 | `apps/api/src/modules/branches/branch.service.ts:35` — create | Partial |
| FR-BRANCH-003 | Documented source requirement; approval unverified. System shall prevent new usage while preserving history. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶254 | `apps/api/src/modules/branches/branch.service.ts:91` — delete | Partial |
| FR-BRANCH-004 | Implementation observation — business validation required. Create and update branch records with contact validation. | `apps/api/src/modules/branches/branch.service.ts:35` | `apps/api/src/modules/branches/branch.service.ts:35` — create | Implemented |
| FR-BRANCH-005 | Implementation observation — business validation required. Manage branch identifiers and their active status. | `apps/api/src/modules/branches/branch.service.ts:75` | `apps/api/src/modules/branches/branch.service.ts:75` — addIdentifier | Implemented |
| FR-BRANCH-006 | Implementation observation — business validation required. Reject deleting a branch with dependencies. | `apps/api/src/modules/branches/branch.service.ts:91` | `apps/api/src/modules/branches/branch.service.ts:91` — delete | Implemented |
| FR-BRANCH-007 | Implementation observation — business validation required. Export the branch collection through the existing service. | `apps/api/src/modules/branches/branch.service.ts:106` | `apps/api/src/modules/branches/branch.service.ts:106` — export | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Open the authorized branch list.
2. Create or select a branch.
3. Validate identifying and contact details.
4. Maintain branch identifiers through the supported operations.
5. Update branch information.
6. Reject removal when dependent records require the branch to be retained.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| NOT_FOUND — Branch not found | 404 | `apps/api/src/modules/branches/branch.service.ts:26` |
| BRANCH_HAS_DEPENDENCIES — Branch cannot be deleted while departments or users are assigned | 409 | `apps/api/src/modules/branches/branch.service.ts:95` |
| INVALID_BRANCH_EMAIL — Branch email is invalid | 400 | `apps/api/src/modules/branches/branch.service.ts:125` |
| INVALID_BRANCH_PHONE — Branch phone is invalid | 400 | `apps/api/src/modules/branches/branch.service.ts:128` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/branches/branch.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/BranchManagementPage.tsx` | useBranchManagementFeature, useAppLocation, useState, useEffect |
| `apps/web/src/hooks/branches/useBranchManagementFeature.ts` | useBranchManagementFeature, useAuth, useCallback, useState, useBranchesList, useBranchSummary, useCreateBranch, useUpdateBranch |
| `apps/web/src/hooks/branches/useBranchWardBedConfigurationFeature.ts` | useBranchWardBedConfigurationFeature, useAuth, useAdmissionsConfiguration |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/branches | branches.list | listBranchesQuerySchema | `apps/api/src/modules/branches/branch.routes.ts:33` |
| GET /api/branches/summary | branches.summary | Inline/custom validation; inspect source | `apps/api/src/modules/branches/branch.routes.ts:44` |
| GET /api/branches/export | branches.export | listBranchesQuerySchema | `apps/api/src/modules/branches/branch.routes.ts:50` |
| GET /api/branches/:id | branches.getById | branchIdParamsSchema | `apps/api/src/modules/branches/branch.routes.ts:65` |
| POST /api/branches | branches.create | createBranchBodySchema | `apps/api/src/modules/branches/branch.routes.ts:76` |
| PATCH /api/branches/:id | branches.update | branchIdParamsSchema, updateBranchBodySchema | `apps/api/src/modules/branches/branch.routes.ts:90` |
| PATCH /api/branches/:id/status | branches.updateStatus | branchIdParamsSchema, updateBranchStatusBodySchema | `apps/api/src/modules/branches/branch.routes.ts:102` |
| DELETE /api/branches/:id | branches.delete | branchIdParamsSchema | `apps/api/src/modules/branches/branch.routes.ts:111` |
| GET /api/branches/:id/identifiers | branches.getIdentifiers | branchIdParamsSchema | `apps/api/src/modules/branches/branch.routes.ts:125` |
| POST /api/branches/:id/identifiers | branches.addIdentifier | branchIdParamsSchema, addBranchIdentifierBodySchema | `apps/api/src/modules/branches/branch.routes.ts:136` |
| PUT /api/branches/:id/identifiers/:identifierId/status | branches.updateIdentifierStatus | branchIdentifierIdParamsSchema, updateBranchIdentifierStatusBodySchema | `apps/api/src/modules/branches/branch.routes.ts:156` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### Branch

`apps/api/src/modules/branches/branch.types.ts:3`

| Field | Observed type |
| --- | --- |
| id | string |
| code | string |
| name | string |
| short_name | string \| null |
| email | string \| null |
| phone | string \| null |
| address | string \| null |
| city | string \| null |
| state | string \| null |
| country | string \| null |
| postal_code | string \| null |
| status | BranchStatus |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### BranchIdentifier

`apps/api/src/modules/branches/branch.types.ts:54`

| Field | Observed type |
| --- | --- |
| id | string |
| identifier_type | string |
| value | string |
| issuing_authority | string |
| status | BranchIdentifierStatus |
| effective_from | string \| null |
| effective_to | string \| null |
| verified_at | string \| null |
| verified_by | string \| null |

### ShaFacilityIdentifierReadiness

`apps/api/src/modules/branches/branch.types.ts:85`

| Field | Observed type |
| --- | --- |
| status | ShaFacilityIdentifierReadinessStatus |
| identifierSystemConfigured | boolean |
| identifierAvailable | boolean |
| identifierSystem | string \| null |
| identifierType | string \| null |

### CreateBranchDTO

`apps/api/src/modules/branches/branch.types.ts:31`

| Field | Observed type |
| --- | --- |
| code | string |
| name | string |
| short_name? | string \| null |
| email? | string \| null |
| phone? | string \| null |
| address? | string \| null |
| city? | string \| null |
| state? | string \| null |
| country? | string \| null |
| postal_code? | string \| null |
| status? | BranchStatus |

### AddBranchIdentifierDTO

`apps/api/src/modules/branches/branch.types.ts:66`

| Field | Observed type |
| --- | --- |
| identifier_type | string |
| value | string |
| issuing_authority | string |
| status? | BranchIdentifierStatus |
| effective_from? | string \| null |
| effective_to? | string \| null |

### UpdateBranchIdentifierDTO

`apps/api/src/modules/branches/branch.types.ts:75`

| Field | Observed type |
| --- | --- |
| status | BranchIdentifierStatus |
| effective_to? | string \| null |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| BranchStatus | 'ACTIVE' \| 'INACTIVE' | `apps/api/src/modules/branches/branch.types.ts:1` |
| BranchIdentifierStatus | 'ACTIVE' \| 'INACTIVE' \| 'REVOKED' | `apps/api/src/modules/branches/branch.types.ts:52` |
| ShaFacilityIdentifierReadinessStatus | \| 'SHA_FACILITY_IDENTIFIER_SYSTEM_UNCONFIGURED' \| 'SHA_FACILITY_IDENTIFIER_AVAILABLE' \| 'SHA_FACILITY_IDENTIFIER_NOT_AVAILABLE' | `apps/api/src/modules/branches/branch.types.ts:80` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Department Management; User Administration; RBAC; Settings; Patient Management.

Observed backend import domains: `auth`, `departments`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-BRANCH-001 | FR-BRANCH-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Organization profile, branches, departments, rooms/consultation areas, service locations and country/currency settings. |
| AC-BRANCH-002 | FR-BRANCH-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Release 1 shall include the master data required to operate OPD, Emergency and IPD services from day one. Master data must be configurable by authorized users only and shall support multi-country/multi-currency hospital groups. |
| AC-BRANCH-003 | FR-BRANCH-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall prevent new usage while preserving history. |
| AC-BRANCH-004 | FR-BRANCH-004 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Create and update branch records with contact validation. |
| AC-BRANCH-005 | FR-BRANCH-005 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Manage branch identifiers and their active status. |
| AC-BRANCH-006 | FR-BRANCH-006 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Reject deleting a branch with dependencies. |
| AC-BRANCH-007 | FR-BRANCH-007 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Export the branch collection through the existing service. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-BRANCH-01: Shared scope gives organization and location requirements but not a complete branch field or deactivation policy.
- GAP-BRANCH-02: Confirm cross-branch visibility and identifier uniqueness policy.
- GAP-BRANCH-03: Export capability is observed in code and requires business approval of allowed fields.
- GAP-BRANCH-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Branch Management/review.md` | b67269e4180c05392348a6c179930c23510fc16cbe437e633115b51fcbb526f3 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/branches/branch.service.ts` | 720e1ce76e4d7b8ea6834cde53b2083eb8e2f828bc45d98937bb58923ae8d174 | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/branches/branch-identifier.utils.ts`
- `apps/api/src/modules/branches/branch.model.ts`
- `apps/api/src/modules/branches/branch.repository.ts`
- `apps/api/src/modules/branches/branch.routes.ts`
- `apps/api/src/modules/branches/branch.schemas.ts`
- `apps/api/src/modules/branches/branch.service.ts`
- `apps/api/src/modules/branches/branch.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
