# Health and Readiness Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Health and Readiness |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Expose the current application and database health observations for operations.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Expose the current application and database health observations for operations. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Operations or monitoring consumer; no staff role requirement is established by the inspected health routes.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

No module-specific staff permission tuple was established in the inspected current routes. See API boundaries and the unresolved role/authorization decisions; do not invent a default grant.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-HEALTH-001 | Implementation observation — business validation required. Expose the existing application health response. No service-level objective is inferred. | `apps/api/src/modules/health/health.routes.ts:9` | `apps/api/src/modules/health/health.routes.ts:9` — '/api/health' | Implemented |
| FR-HEALTH-002 | Implementation observation — business validation required. Expose the database health result using the existing database service. HTTP readiness policy remains unresolved. | `apps/api/src/modules/health/health.routes.ts:26` | `apps/api/src/modules/health/health.routes.ts:26` — '/api/health/db' | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Call the application health endpoint.
2. Read its reported service status.
3. Call the database health endpoint.
4. Read the connected or error state.
5. Interpret readiness using an approved operational policy rather than treating a response as complete clinical-system readiness.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

No complete module-specific business validation contract was established from simple service errors. The source gaps remain explicit; shared request validation is not a substitute for an approved rule.

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

No dedicated current-branch page was mapped. Source workflow descriptions remain design evidence only; no new screen, button or form field is invented.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/health | Inline handler; inspect source | Inline/custom validation; inspect source | `apps/api/src/modules/health/health.routes.ts:8` |
| GET /api/health/db | database.healthCheck | Inline/custom validation; inspect source | `apps/api/src/modules/health/health.routes.ts:25` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

No dedicated current-branch entity contract was established. Source-described fields, such as those in section 6, remain requirements to reconcile. Do not invent a schema from screen labels or prototype data.

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

No complete explicit current transition map was established. Inspect the linked service guards or obtain an approved lifecycle before specifying new status actions. A simple active flag or report state must not be expanded into an invented clinical lifecycle.

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Infrastructure; database service.

Observed backend import domains: No dedicated import dependency list established.. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-HEALTH-001 | FR-HEALTH-001 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Expose the existing application health response. No service-level objective is inferred. |
| AC-HEALTH-002 | FR-HEALTH-002 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Expose the database health result using the existing database service. HTTP readiness policy remains unresolved. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-HEALTH-01: No independent business or operational service-level specification was found.
- GAP-HEALTH-02: Confirm authentication and exposure policy for health metadata.
- GAP-HEALTH-03: The database response status does not by itself define load-balancer HTTP readiness or uptime guarantees.
- GAP-HEALTH-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Health and Readiness/review.md` | 1e9909601a6a2d16a8894bb661ec6211d3d6fbf42d39d52879518c37c04166fa | Historical design evidence |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/health/health.routes.ts` | 9cdcc050f022785b0d9239b000d3f5a127d13f69e4a48e8a423bd50892ec788c | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/health/health.routes.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
