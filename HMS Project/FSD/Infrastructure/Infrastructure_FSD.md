# Infrastructure Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Infrastructure |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Document the existing runtime, persistence and operational constraints supporting HMS workflows.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Document the existing runtime, persistence and operational constraints supporting HMS workflows. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Technical operations; authorized administrators; application services.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

No module-specific staff permission tuple was established in the inspected current routes. See API boundaries and the unresolved role/authorization decisions; do not invent a default grant.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-INFRA-001 | Documented project rule; not evidence of functional approval. Keep database access in repositories and business behavior in the existing service architecture. | `PROJECT_RULES.md:85` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-INFRA-002 | Documented project rule; not evidence of functional approval. Use transactions for multi-document atomic operations. | `PROJECT_RULES.md:110` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-INFRA-003 | Documented project rule; not evidence of functional approval. Protect sensitive data in logs; no passwords, tokens or clinical notes may be exposed. | `PROJECT_RULES.md:429` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-INFRA-004 | Documented project rule; not evidence of functional approval. Use the existing production document storage policy and protect private file access. | `PROJECT_RULES.md:396` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Start the existing Node and Fastify application.
2. Initialize the shared service and database dependencies.
3. Register request context, error handling and module routes.
4. Process mutations through repositories and the existing transaction mechanism.
5. Refresh operational background data using the existing scheduler.
6. Shut down and recover according to an operational runbook requiring approval.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

No complete module-specific business validation contract was established from simple service errors. The source gaps remain explicit; shared request validation is not a substitute for an approved rule.

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

No dedicated current-branch page was mapped. Source workflow descriptions remain design evidence only; no new screen, button or form field is invented.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

No dedicated current-branch endpoint family is established here. Shared implementation files and source-design contracts are listed in section 18; future API naming and payloads require approval.

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

Health and Readiness; all modules; document storage; background dashboard processing.

Observed backend import domains: `errors`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-INFRA-001 | FR-INFRA-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Keep database access in repositories and business behavior in the existing service architecture. |
| AC-INFRA-002 | FR-INFRA-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Use transactions for multi-document atomic operations. |
| AC-INFRA-003 | FR-INFRA-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Protect sensitive data in logs; no passwords, tokens or clinical notes may be exposed. |
| AC-INFRA-004 | FR-INFRA-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Use the existing production document storage policy and protect private file access. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-INFRA-01: Hosting comparison documents are assessments, not approval to migrate or alter the locked architecture.
- GAP-INFRA-02: Confirm backup restoration, disaster recovery, deployment topology and service-level targets.
- GAP-INFRA-03: No environment values, provider credentials or connection strings are reproduced.
- GAP-INFRA-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Infrastructure/BACKEND_HOSTING_PORTABILITY_AUDIT.md` | cb3cd256ad6d5870e76a87d4cc6aea0349ef00fe39059db7aa76fafa3b348c91 | Historical design evidence |
| `HMS Project/Design/Infrastructure/CLOUDFLARE_WORKERS_COMPATIBILITY.md` | cf5788b915a5880b99ad21269c01f5c8c9aa6dbc1123431d9eb9de755df6a155 | Historical design evidence |
| `HMS Project/Design/Infrastructure/CLOUD_RUN_COMPATIBILITY_AUDIT.md` | 8eb3aaa0bb65af26e172422bebdba170c357e49622f644e2700f550868e69745 | Historical design evidence |
| `HMS Project/Design/Infrastructure/CLOUD_RUN_COST_ANALYSIS.md` | d31437cb562782628ab6f98bc217d4f2e6f6a321e238e37e19b7be8fb8d96b52 | Historical design evidence |
| `HMS Project/Design/Infrastructure/CLOUD_RUN_LATENCY_BENCHMARK.md` | 10c64da4171cd736f015678f804f3aa08783a9e6071d08c2cac63d9c19a3bbec | Historical design evidence |
| `HMS Project/Design/Infrastructure/CLOUD_RUN_POC_FINAL_REPORT.md` | 059d45e48b26cdca37ee38ccfba2dec88f599560b7019dffa07f63686b954ae1 | Historical design evidence |
| `HMS Project/Design/Infrastructure/HMS_GENERAL-consolidation-assessment.md` | 76847f7a0bccba906539fecde58365f63474f25fa4aa0d14c44d72b172f79828 | Historical design evidence |
| `HMS Project/Design/Infrastructure/HMS_GENERAL_BACKUP_REPORT.md` | bc5b6ecdca97396175552738f10ffbea9df74a9540705ea3874ae5601b70db35 | Historical design evidence |
| `HMS Project/Design/Infrastructure/HMS_GENERAL_PHASE2_RESTORE_REPORT.md` | 907246deb45dd06c4b3c78e00ff835c4b0ed986470bc1580828562a2e92bc64a | Historical design evidence |
| `HMS Project/Design/Infrastructure/HMS_MONGODB_COLLECTION_REVIEW.md` | a7f7e66fd6b6a66abda9d992382724bbf03f52efe1e15541e7fd14d2bfe10af6 | Historical design evidence |
| `HMS Project/Design/Infrastructure/HOSTING_MIGRATION_IMPACT.md` | 8413f85a7383928905d82f6732db4f145dd9f0ff0304b48c0ac8af6eb3d7f21f | Historical design evidence |
| `HMS Project/Design/Infrastructure/LATENCY_PHASE_1_PROFILING_REPORT.md` | a1bd088bc0a7d0e65342dbb1f456f7bbc0884cca6b836bed01a3450d112833a4 | Historical design evidence |
| `HMS Project/Design/Infrastructure/RENDER_ALWAYS_ON_AUDIT.md` | 15913c65f0e27a8aa71e987d035294ae0fb43f172d247745b96f2e749e51c51f | Historical design evidence |
| `HMS Project/Design/Infrastructure/RENDER_API_PERFORMANCE_PROFILE.md` | 631ad487d7e28bd2d242571e01de5666e4ae5079329b9c0f99d738bf270ec305 | Historical design evidence |
| `HMS Project/Design/Infrastructure/RENDER_COLD_START_MITIGATION.md` | 9ffe172386754849f962141218cb5bdc3f07afb138ca46e17796eefee7eb6a1b | Historical design evidence |
| `HMS Project/Design/Infrastructure/RENDER_DEPENDENCY_MAP.md` | 4568ce722b6a6d259780b508b87ed0a4856486782b4a27f91efdae4f3f0057c1 | Historical design evidence |
| `HMS Project/Design/Infrastructure/RENDER_POST_OPTIMIZATION_BENCHMARK.md` | 232587964d2cd1a9ec9281b584c3ae3ce02439b4528367580fd76bde0a35ab37 | Historical design evidence |
| `HMS Project/Design/Infrastructure/branch-usage.md` | 7da4ad6c69c562c68c44482dc3337e7d0eaccf8c304e3d9e48a24939d36e0db9 | Historical design evidence |
| `HMS Project/Design/Infrastructure/collection-inventory.md` | 0b28d17f3065c7b70e0cc7cf20bf81df0a3e1f802d1f019f6bdbe369773b6c96 | Historical design evidence |
| `HMS Project/Design/Infrastructure/market-localization-mismatch.md` | d8e9b6266952422bdbde5ca941ba75ef3d4f0868b7255c37e271ed747e4b0aee | Historical design evidence |
| `HMS Project/Design/Infrastructure/render-region-vs-mongo-region.md` | 842ed27eda90311a43972f6fa096f1d0444817d3066bf81e21e891c078f2f982 | Historical design evidence |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/app.ts`
- `apps/api/src/server.ts`
- `apps/api/src/shared/database/transaction.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
