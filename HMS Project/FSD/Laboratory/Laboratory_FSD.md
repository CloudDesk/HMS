# Laboratory Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Laboratory |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Process test requests from sample collection through result entry, verification and report availability.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Process test requests from sample collection through result entry, verification and report availability. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Laboratory User for intake and result entry; distinct authorized verifier as required by R1; ordering clinician.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Laboratory | Orders | EnterResult |
| Laboratory | Orders | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-LAB-001 | Documented source requirement; approval unverified. System shall generate a unique barcode/label per sample at collection, linked to the test order and patient. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶815 | `apps/api/src/modules/laboratory/laboratory.service.ts:54` — updateStatus | Partial |
| FR-LAB-002 | Documented source requirement; approval unverified. System shall flag results outside configured critical reference ranges and prompt immediate notification to the ordering clinician. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶817 | `apps/api/src/modules/laboratory/laboratory.service.ts:138` — validateAndNormalizeResults | Partial |
| FR-LAB-003 | Documented source requirement; approval unverified. Results shall require verification by an authorized lab user before publish, separate from the entering technician. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶819 | `apps/api/src/modules/laboratory/laboratory.service.ts:54` — updateStatus | Partial |
| FR-LAB-004 | Documented source requirement; approval unverified. Verify results before publish; corrections require a controlled re-verification. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶835 | `apps/api/src/modules/laboratory/laboratory.service.ts:107` — updateResult | Partial |
| FR-LAB-005 | Documented source requirement; approval unverified. System shall capture rejection reason and require recollection with a new barcode. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶843 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-LAB-006 | Documented source requirement; approval unverified. System shall track chain of custody via barcode scan events. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶849 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-LAB-007 | Documented source requirement; approval unverified. Results require verification by an authorized user distinct from data entry before publish. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶858 | `apps/api/src/modules/laboratory/laboratory.service.ts:54` — updateStatus | Partial |
| FR-LAB-008 | Documented source requirement; approval unverified. Report shall attach to patient record and relevant encounter. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶386 | `apps/api/src/modules/laboratory/laboratory.service.ts:86` — enterResult | Partial |
| FR-LAB-009 | Documented source requirement; approval unverified. Request should be queue-based unless a separate appointment workflow is later approved. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶392 | `apps/api/src/modules/laboratory/laboratory.service.ts:28` — list | Partial |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Receive a laboratory request linked to patient and source encounter.
2. Collect the sample and record its identity.
3. Progress the order to processing.
4. Enter results for the ordered services.
5. Validate result items and reference information.
6. Verify before completion or publication.
7. Retain report context and escalate critical results under an approved notification rule.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| LABORATORY_RESULT_NOT_FOUND — Laboratory result not found | 404 | `apps/api/src/modules/laboratory/laboratory.service.ts:40` |
| LABORATORY_ORDER_NOT_FOUND — Laboratory order not found | 404 | `apps/api/src/modules/laboratory/laboratory.service.ts:63` |
| RESULT_REQUIRED — Enter laboratory results before verification | 409 | `apps/api/src/modules/laboratory/laboratory.service.ts:70` |
| RESULT_ALREADY_VERIFIED — Laboratory result was already verified | 409 | `apps/api/src/modules/laboratory/laboratory.service.ts:72` |
| ORDER_STATUS_CONFLICT — Laboratory order changed; refresh and retry | 409 | `apps/api/src/modules/laboratory/laboratory.service.ts:75` |
| RESULT_ENTRY_NOT_ALLOWED — Results can only be entered for an in-progress order | 409 | `apps/api/src/modules/laboratory/laboratory.service.ts:92` |
| LABORATORY_RESULT_EXISTS — Laboratory result already exists | 409 | `apps/api/src/modules/laboratory/laboratory.service.ts:94` |
| RESULT_UPDATE_NOT_ALLOWED — Only unverified results can be updated | 409 | `apps/api/src/modules/laboratory/laboratory.service.ts:113` |
| VALIDATION_ERROR — Laboratory order id is invalid | 400 | `apps/api/src/modules/laboratory/laboratory.service.ts:127` |
| ORDER_COMPLETED — Completed laboratory orders are read-only | 409 | `apps/api/src/modules/laboratory/laboratory.service.ts:135` |
| RESULT_ITEMS_MISMATCH — Results must contain each ordered laboratory service exactly once | 400 | `apps/api/src/modules/laboratory/laboratory.service.ts:141` |
| ORDER_SERVICE_DELETED — A referenced laboratory service was deleted | 409 | `apps/api/src/modules/laboratory/laboratory.service.ts:144` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/laboratory/laboratory.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/LaboratoryDashboardPage.test.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/pages/LaboratoryDashboardPage.tsx` | useLaboratoryQueueFeature |
| `apps/web/src/pages/LaboratoryQueuePage.tsx` | useLaboratoryQueueFeature |
| `apps/web/src/pages/LaboratoryResultEntryPage.tsx` | useLaboratoryResultFeature, useState, useFieldArray, useEffect |
| `apps/web/src/pages/LaboratoryWorkspacePage.tsx` | useLaboratoryWorkspaceFeature |
| `apps/web/src/hooks/laboratory/useLaboratoryQueueFeature.ts` | useLaboratoryQueueFeature, useAuth, useAppLocation, useState, useMemo, useBranchesList, useCallback, useLaboratoryOrders |
| `apps/web/src/hooks/laboratory/useLaboratoryResultFeature.ts` | useLaboratoryResultFeature, useAuth, useAppLocation, useLaboratoryOrderDetails, useLaboratoryResult, useEnterLaboratoryResult, useUpdateLaboratoryResult |
| `apps/web/src/hooks/laboratory/useLaboratoryWorkspaceFeature.ts` | useLaboratoryWorkspaceFeature, useAuth, useAppLocation, useLaboratoryOrderDetails, useUpdateLaboratoryStatus |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/laboratory/orders | laboratory.list | Inline/custom validation; inspect source | `apps/api/src/modules/laboratory/laboratory.routes.ts:18` |
| GET /api/laboratory/orders/:id | laboratory.getById | Inline/custom validation; inspect source | `apps/api/src/modules/laboratory/laboratory.routes.ts:20` |
| PATCH /api/laboratory/orders/:id/status | laboratory.updateStatus | Inline/custom validation; inspect source | `apps/api/src/modules/laboratory/laboratory.routes.ts:22` |
| POST /api/laboratory/orders/:id/results | laboratory.enterResult | Inline/custom validation; inspect source | `apps/api/src/modules/laboratory/laboratory.routes.ts:27` |
| PATCH /api/laboratory/orders/:id/results | laboratory.updateResult | Inline/custom validation; inspect source | `apps/api/src/modules/laboratory/laboratory.routes.ts:31` |
| GET /api/laboratory/orders/:id/results | laboratory.getResult | Inline/custom validation; inspect source | `apps/api/src/modules/laboratory/laboratory.routes.ts:35` |
| GET /api/laboratory/summary | laboratory.summary | Inline/custom validation; inspect source | `apps/api/src/modules/laboratory/laboratory.routes.ts:37` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### LaboratoryResultItemDTO

`apps/api/src/modules/laboratory/laboratory.types.ts:5`

| Field | Observed type |
| --- | --- |
| service_id | string |
| service_name | string |
| value | string |
| unit? | string \| null |
| reference_range? | string \| null |
| comments? | string \| null |

### SaveLaboratoryResultDTO

`apps/api/src/modules/laboratory/laboratory.types.ts:14`

| Field | Observed type |
| --- | --- |
| result_items | LaboratoryResultItemDTO[] |
| remarks? | string \| null |

### UpdateLaboratoryStatusDTO

`apps/api/src/modules/laboratory/laboratory.types.ts:19`

| Field | Observed type |
| --- | --- |
| status | 'RECEIVED' \| 'SAMPLE_COLLECTED' \| 'IN_PROGRESS' \| 'VERIFIED' \| 'COMPLETED' |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| transitions (observed transition map) | SUBMITTED: 'RECEIVED', RECEIVED: 'SAMPLE_COLLECTED', SAMPLE_COLLECTED: 'IN_PROGRESS', RESULT_ENTERED: 'VERIFIED', VERIFIED: 'COMPLETED', | `apps/api/src/modules/laboratory/laboratory.service.ts:10` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

OPD Consultation; Emergency; IPD; Surgery; EMR; Notifications; Billing.

Observed backend import domains: `opd`, `services`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/laboratory/laboratory.service.ts:61` — return executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/laboratory/laboratory.service.ts:88` — return executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/laboratory/laboratory.service.ts:109` — return executeTransaction(() => mongoose.startSession(), async (session) => {

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-LAB-001 | FR-LAB-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall generate a unique barcode/label per sample at collection, linked to the test order and patient. |
| AC-LAB-002 | FR-LAB-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall flag results outside configured critical reference ranges and prompt immediate notification to the ordering clinician. |
| AC-LAB-003 | FR-LAB-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Results shall require verification by an authorized lab user before publish, separate from the entering technician. |
| AC-LAB-004 | FR-LAB-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Verify results before publish; corrections require a controlled re-verification. |
| AC-LAB-005 | FR-LAB-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall capture rejection reason and require recollection with a new barcode. |
| AC-LAB-006 | FR-LAB-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall track chain of custody via barcode scan events. |
| AC-LAB-007 | FR-LAB-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Results require verification by an authorized user distinct from data entry before publish. |
| AC-LAB-008 | FR-LAB-008 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Report shall attach to patient record and relevant encounter. |
| AC-LAB-009 | FR-LAB-009 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Request should be queue-based unless a separate appointment workflow is later approved. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-LAB-01: Sample barcode generation and scan chain-of-custody are required by R1 but not proven by a SAMPLE_COLLECTED enum.
- GAP-LAB-02: R1 requires a verifier distinct from the entering technician; status permissions alone do not establish two-person enforcement.
- GAP-LAB-03: Confirm critical thresholds, immediate notification, correction versions and re-verification policy.
- GAP-LAB-04: Static mismatch: laboratory.repository.ts verifyResult filters order ID, deletedAt and verifiedAt but not enteredBy versus verifier; the inspected service also lacks a distinct-actor check. R1 paragraph 858 and the governance matrix require separate entry and verification actors.
- GAP-LAB-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Laboratory/review.md` | a6f5aba5d73a65b3507b54fc2aa46a96642060ae3284e49718eedd3c4166f1d5 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/laboratory/laboratory-result.model.ts`
- `apps/api/src/modules/laboratory/laboratory.repository.ts`
- `apps/api/src/modules/laboratory/laboratory.routes.ts`
- `apps/api/src/modules/laboratory/laboratory.schemas.ts`
- `apps/api/src/modules/laboratory/laboratory.service.ts`
- `apps/api/src/modules/laboratory/laboratory.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
