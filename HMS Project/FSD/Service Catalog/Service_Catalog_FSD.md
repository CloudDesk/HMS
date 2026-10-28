# Service Catalog Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Service Catalog |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Maintain active clinical services, pricing and procedure configuration used by ordering and billing.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Maintain active clinical services, pricing and procedure configuration used by ordering and billing. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Authorized catalog administrator; clinical and billing users with read access.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Administration | Services | Create |
| Administration | Services | Delete |
| Administration | Services | Edit |
| Administration | Services | Export |
| Administration | Services | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-SVC-001 | Documented source requirement; approval unverified. Service catalogue, price, payment mode, discount permission, invoice status and receipt format. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶241 | `apps/api/src/modules/services/service.service.ts:29` — create | Partial |
| FR-SVC-002 | Documented source requirement; approval unverified. Authorized user shall update price; historical invoices shall retain original billed amount. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶248 | `apps/api/src/modules/services/service.service.ts:47` — update | Partial |
| FR-SVC-003 | Documented source requirement; approval unverified. System shall prevent new usage while preserving history. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶254 | `apps/api/src/modules/services/service.service.ts:84` — delete | Partial |
| FR-SVC-004 | Documented source requirement; approval unverified. Surgery / Procedure Department Master | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶183 | `apps/api/src/modules/services/service.service.ts:29` — create | Partial |
| FR-SVC-005 | Implementation observation — business validation required. Validate that the service department is active. | `apps/api/src/modules/services/service.service.ts:124` | `apps/api/src/modules/services/service.service.ts:124` — requireActiveDepartment | Implemented |
| FR-SVC-006 | Implementation observation — business validation required. Validate procedure-only configuration in create and update operations. | `apps/api/src/modules/services/service.service.ts:29` | `apps/api/src/modules/services/service.service.ts:29` — create | Implemented |
| FR-SVC-007 | Implementation observation — business validation required. Expose the supported service export operation. | `apps/api/src/modules/services/service.service.ts:94` | `apps/api/src/modules/services/service.service.ts:94` — export | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Choose an active department.
2. Create the service with its supported classification and price.
3. Configure procedure-specific fields only where applicable.
4. Validate references and configuration.
5. Update or deactivate the service.
6. Reuse the service ID in orders and preserve billed historical amounts.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| NOT_FOUND — Service not found | 404 | `apps/api/src/modules/services/service.service.ts:20` |
| INVALID_DEPARTMENT — Department not found | 400 | `apps/api/src/modules/services/service.service.ts:127` |
| INACTIVE_DEPARTMENT — Inactive department cannot be assigned | 400 | `apps/api/src/modules/services/service.service.ts:130` |
| INVALID_PROCEDURE_CONFIGURATION — Procedure duration and booking capacity are required | 400 | `apps/api/src/modules/services/service.service.ts:137` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/services/service.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/ServiceCataloguePage.tsx` | useMemo, useCurrencyFormatter, useServiceCatalogueFeature, useAppLocation, useState, useEffect |
| `apps/web/src/hooks/services/useServiceCatalogueFeature.ts` | useServiceCatalogueFeature, useAuth, useCallback, useState, useServicesList, useServiceSummary, useBranchesList, useDepartmentsList |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/services | serviceCatalogue.list | listServicesQuerySchema | `apps/api/src/modules/services/service.routes.ts:24` |
| GET /api/services/summary | serviceCatalogue.summary | Inline/custom validation; inspect source | `apps/api/src/modules/services/service.routes.ts:35` |
| GET /api/services/export | serviceCatalogue.export | listServicesQuerySchema | `apps/api/src/modules/services/service.routes.ts:41` |
| GET /api/services/:id | serviceCatalogue.getById | serviceIdParamsSchema | `apps/api/src/modules/services/service.routes.ts:54` |
| POST /api/services | serviceCatalogue.create | createServiceBodySchema | `apps/api/src/modules/services/service.routes.ts:65` |
| PATCH /api/services/:id | serviceCatalogue.update | serviceIdParamsSchema, updateServiceBodySchema | `apps/api/src/modules/services/service.routes.ts:79` |
| PATCH /api/services/:id/status | serviceCatalogue.updateStatus | serviceIdParamsSchema, updateServiceStatusBodySchema | `apps/api/src/modules/services/service.routes.ts:91` |
| DELETE /api/services/:id | serviceCatalogue.delete | serviceIdParamsSchema | `apps/api/src/modules/services/service.routes.ts:100` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### Service

`apps/api/src/modules/services/service.types.ts:4`

| Field | Observed type |
| --- | --- |
| id | string |
| code | string |
| name | string |
| service_type | ServiceType |
| category | string \| null |
| sample_type? | string \| null |
| description | string \| null |
| department_id | string |
| standard_price | number |
| default_duration_minutes | number \| null |
| booking_capacity | number \| null |
| requires_bed | boolean |
| requires_consent | boolean |
| requires_advance_deposit | boolean |
| minimum_advance_deposit_amount | number \| null |
| status | ServiceStatus |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### CreateServiceDTO

`apps/api/src/modules/services/service.types.ts:38`

| Field | Observed type |
| --- | --- |
| code | string |
| name | string |
| service_type? | ServiceType |
| department_id | string |
| standard_price | number |
| default_duration_minutes? | number \| null |
| booking_capacity? | number \| null |
| requires_bed? | boolean |
| requires_consent? | boolean |
| requires_advance_deposit? | boolean |
| minimum_advance_deposit_amount? | number \| null |
| category? | string \| null |
| sample_type? | string \| null |
| description? | string \| null |
| status? | ServiceStatus |

### ServiceListQuery

`apps/api/src/modules/services/service.types.ts:27`

| Field | Observed type |
| --- | --- |
| search? | string |
| status? | ServiceStatus |
| department_id? | string |
| service_type? | ServiceType |
| page? | number |
| limit? | number |
| sortBy? | 'name' \| 'code' \| 'service_type' \| 'status' \| 'created_at' \| 'updated_at' \| 'standard_price' |
| sortOrder? | 'asc' \| 'desc' |

### ServiceRequestMetadata

`apps/api/src/modules/services/service.types.ts:58`

| Field | Observed type |
| --- | --- |
| ipAddress? | string |
| userAgent? | string |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| ServiceStatus | 'ACTIVE' \| 'INACTIVE' | `apps/api/src/modules/services/service.types.ts:1` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Department Management; Billing; OPD Consultation; Laboratory; Imaging; Surgery.

Observed backend import domains: `auth`, `departments`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-SVC-001 | FR-SVC-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Service catalogue, price, payment mode, discount permission, invoice status and receipt format. |
| AC-SVC-002 | FR-SVC-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Authorized user shall update price; historical invoices shall retain original billed amount. |
| AC-SVC-003 | FR-SVC-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall prevent new usage while preserving history. |
| AC-SVC-004 | FR-SVC-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Surgery / Procedure Department Master |
| AC-SVC-005 | FR-SVC-005 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Validate that the service department is active. |
| AC-SVC-006 | FR-SVC-006 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Validate procedure-only configuration in create and update operations. |
| AC-SVC-007 | FR-SVC-007 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Expose the supported service export operation. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-SVC-01: Approve price-effective dating, tax rules, service classification and procedure-capacity policy.
- GAP-SVC-02: Historical invoice-price preservation is a requirement and needs end-to-end confirmation.
- GAP-SVC-03: Catalog configuration must not invent a new clinical workflow or permission.
- GAP-SVC-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Service Catalog/review.md` | 98febbbdef723f437887fd7556fdb11d388adf3a7e44412c3dce33f297d9de85 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/services/service.service.ts` | a23ff4f74fa4dc79d33566ff849ddf15d8eaf8c35a45b01944de9bb65166faf9 | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/services/service.model.ts`
- `apps/api/src/modules/services/service.repository.ts`
- `apps/api/src/modules/services/service.routes.ts`
- `apps/api/src/modules/services/service.schemas.ts`
- `apps/api/src/modules/services/service.service.ts`
- `apps/api/src/modules/services/service.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
