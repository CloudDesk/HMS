# Pharmacy Inventory Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Pharmacy Inventory |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Maintain medicine quantities, batches, expiry and stock movement history by branch.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Maintain medicine quantities, batches, expiry and stock movement history by branch. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Pharmacy User for operational batches; pharmacy supervisor for adjustment and threshold policy.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Pharmacy | Medicine Inventory | AdjustStock |
| Pharmacy | Medicine Inventory | ConfigureLowStock |
| Pharmacy | Medicine Inventory | EditBatch |
| Pharmacy | Medicine Inventory | RecordMovement |
| Pharmacy | Medicine Inventory | RegisterBatch |
| Pharmacy | Medicine Inventory | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-STOCK-001 | Documented source requirement; approval unverified. Client-approved opening balances loaded per item, batch and branch before go-live. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1066 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:185` — registerBatch | Partial |
| FR-STOCK-002 | Documented source requirement; approval unverified. Batch number and expiry date captured on receipt; expired batches blocked from dispensing/issue. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1068 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:185` — registerBatch | Partial |
| FR-STOCK-003 | Documented source requirement; approval unverified. Issue to pharmacy, ward or department with automatic deduction on dispensing/use. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1070 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:308` — recordMovement | Partial |
| FR-STOCK-004 | Documented source requirement; approval unverified. Configurable minimum stock level per item with low-stock visibility/alerts. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1072 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:399` — updateThreshold | Partial |
| FR-STOCK-005 | Documented source requirement; approval unverified. Authorized stock adjustment with reason (damage, loss, correction) and audit trail. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1074 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:308` — recordMovement | Partial |
| FR-STOCK-006 | Documented source requirement; approval unverified. The system shall check pharmacy inventory before final bill/dispense confirmation. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶400 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:153` — listBatches | Partial |
| FR-STOCK-007 | Documented source requirement; approval unverified. If Pharmacy increases the quantity, the system must validate available stock before allowing billing/dispensing. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶410 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:308` — recordMovement | Partial |
| FR-STOCK-008 | Documented source requirement; approval unverified. Cancelled or unconfirmed e-prescriptions shall not deduct stock. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶413 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:308` — recordMovement | Partial |
| FR-STOCK-009 | Implementation observation — business validation required. Reconcile expiry and surface stock-state changes through the current service. | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:83` | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:83` — reconcileExpiry | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Select an active medicine and authorized branch.
2. Register a batch with quantity and expiry.
3. Review current available quantity and batch status.
4. Record permitted movements or dispensing deductions.
5. Reconcile expired batches and stock-state indicators.
6. Set approved low-stock thresholds.
7. Preserve movement history and reasons for corrections.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| VALIDATION_ERROR — Date is invalid | 400 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:25` |
| BRANCH_ACCESS_DENIED — Active assigned branch is required | 403 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:38` |
| MEDICINE_NOT_FOUND — Medicine not found | 404 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:44` |
| MEDICINE_INACTIVE — Active medicine is required for stock operations | 409 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:51` |
| INVENTORY_NOT_FOUND — Medicine has no inventory record in this branch | 404 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:149` |
| BATCH_ALREADY_EXPIRED — An expired batch cannot be registered | 400 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:195` |
| INVENTORY_UPDATE_FAILED — Inventory snapshot could not be updated | 500 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:205` |
| BATCH_REGISTRATION_FAILED — Batch registration did not complete | 500 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:249` |
| DUPLICATE_BATCH_NUMBER — Batch number already exists for this medicine and branch | 409 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:267` |
| BATCH_NOT_FOUND — Medicine batch not found | 404 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:286` |
| EXPIRED_BATCH_IMMUTABLE — Expired batch metadata cannot be changed | 409 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:288` |
| BATCH_EXPIRED — Expired batch cannot be used for stock movement | 409 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:329` |
| INSUFFICIENT_BATCH_QUANTITY — Insufficient batch quantity or batch is unavailable | 409 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:345` |
| STOCK_MOVEMENT_FAILED — Stock movement did not complete | 500 | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:388` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/PharmacyInventoryDashboardPage.test.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/pages/PharmacyInventoryDashboardPage.tsx` | useState, usePharmacyInventoryFeature, useMemo |
| `apps/web/src/pages/PharmacyMedicineInventoryPage.tsx` | useCurrencyFormatter, useAppLocation, useState, useMemo, usePharmacyInventoryFeature, useCallback, useEffect |
| `apps/web/src/hooks/pharmacy/usePharmacyInventoryFeature.ts` | usePharmacyInventoryFeature, useAuth, useCallback, useBranchesList, useMemo, usePharmacyInventoryList, usePharmacyInventorySummary, useMedicinesList |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/pharmacy/medicine-inventory | pharmacyInventory.list | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.routes.ts:24` |
| GET /api/pharmacy/medicine-inventory/summary | pharmacyInventory.summary | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.routes.ts:32` |
| GET /api/pharmacy/medicine-inventory/movements | pharmacyInventory.listMovements | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.routes.ts:39` |
| POST /api/pharmacy/medicine-inventory/movements | pharmacyInventory.recordMovement | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.routes.ts:46` |
| POST /api/pharmacy/medicine-inventory/adjustments | pharmacyInventory.recordMovement | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.routes.ts:57` |
| GET /api/pharmacy/medicine-inventory/batches | pharmacyInventory.listAllBatches | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.routes.ts:73` |
| PATCH /api/pharmacy/medicine-inventory/batches/:batchId | pharmacyInventory.updateBatch | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.routes.ts:83` |
| GET /api/pharmacy/medicine-inventory/:medicineId | pharmacyInventory.getDetail | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.routes.ts:97` |
| GET /api/pharmacy/medicine-inventory/:medicineId/batches | pharmacyInventory.listBatches | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.routes.ts:110` |
| POST /api/pharmacy/medicine-inventory/:medicineId/batches | pharmacyInventory.registerBatch | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.routes.ts:122` |
| PATCH /api/pharmacy/medicine-inventory/:medicineId/low-stock-threshold | pharmacyInventory.updateThreshold | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.routes.ts:135` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### RegisterMedicineBatchDTO

`apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.types.ts:37`

| Field | Observed type |
| --- | --- |
| branch_id | string |
| batch_number | string |
| expiry_date | string |
| unit_price | number |
| opening_quantity | number |
| barcode? | string \| null |
| reason? | string \| null |

### UpdateMedicineBatchDTO

`apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.types.ts:47`

| Field | Observed type |
| --- | --- |
| branch_id | string |
| expiry_date? | string |
| unit_price? | number |
| barcode? | string \| null |
| reason | string |

### RecordMedicineStockMovementDTO

`apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.types.ts:55`

| Field | Observed type |
| --- | --- |
| branch_id | string |
| batch_id | string |
| movement_type | Exclude<MedicineStockMovementType, 'OPENING_STOCK'> |
| quantity | number |
| reason | string |
| reference? | string \| null |
| idempotency_key | string |

### UpdateLowStockThresholdDTO

`apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.types.ts:65`

| Field | Observed type |
| --- | --- |
| branch_id | string |
| low_stock_threshold | number |
| reason | string |

### PharmacyInventoryListQuery

`apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.types.ts:6`

| Field | Observed type |
| --- | --- |
| branch_id | string |
| search? | string |
| stock_state? | MedicineStockState |
| expiry_state? | MedicineExpiryState |
| page? | number |
| limit? | number |
| sortBy? | 'medicine_name' \| 'available_quantity' \| 'next_expiry_date' \| 'updated_at' |
| sortOrder? | 'asc' \| 'desc' |

### PharmacyBatchListQuery

`apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.types.ts:17`

| Field | Observed type |
| --- | --- |
| branch_id | string |
| status? | MedicineBatchStatus |
| page? | number |
| limit? | number |
| sortBy? | 'batch_number' \| 'expiry_date' \| 'quantity_on_hand' \| 'created_at' |
| sortOrder? | 'asc' \| 'desc' |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| MedicineStockState | 'AVAILABLE' \| 'LOW_STOCK' \| 'OUT_OF_STOCK' | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.types.ts:1` |
| MedicineBatchStatus | 'ACTIVE' \| 'DEPLETED' \| 'EXPIRED' | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.types.ts:2` |
| MedicineExpiryState | 'VALID' \| 'EXPIRING_SOON' \| 'EXPIRED' | `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.types.ts:3` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Medicine Catalog; Pharmacy Dispensing; Branch Management; Reporting.

Observed backend import domains: `auth`, `branches`, `medicines`, `roles`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:90` — await executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:199` — await executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:284` — await executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:319` — await executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts:406` — await executeTransaction(() => mongoose.startSession(), async (session) => {

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-STOCK-001 | FR-STOCK-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Client-approved opening balances loaded per item, batch and branch before go-live. |
| AC-STOCK-002 | FR-STOCK-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Batch number and expiry date captured on receipt; expired batches blocked from dispensing/issue. |
| AC-STOCK-003 | FR-STOCK-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Issue to pharmacy, ward or department with automatic deduction on dispensing/use. |
| AC-STOCK-004 | FR-STOCK-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Configurable minimum stock level per item with low-stock visibility/alerts. |
| AC-STOCK-005 | FR-STOCK-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Authorized stock adjustment with reason (damage, loss, correction) and audit trail. |
| AC-STOCK-006 | FR-STOCK-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: The system shall check pharmacy inventory before final bill/dispense confirmation. |
| AC-STOCK-007 | FR-STOCK-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: If Pharmacy increases the quantity, the system must validate available stock before allowing billing/dispensing. |
| AC-STOCK-008 | FR-STOCK-008 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Cancelled or unconfirmed e-prescriptions shall not deduct stock. |
| AC-STOCK-009 | FR-STOCK-009 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Reconcile expiry and surface stock-state changes through the current service. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-STOCK-01: Confirm opening-balance approval, FEFO policy, adjustment authority and stock valuation.
- GAP-STOCK-02: Medicine stock is not evidence of a general consumables inventory.
- GAP-STOCK-03: Explicit expiry and quantity guards require concurrency and rollback acceptance before operational approval.
- GAP-STOCK-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts` | 9812927e8c1d34332de9a15ce38c3f79c8f32ba8eb74cb9eb34f403e42b49078 | Current implementation or project rule |

Current implementation files inspected for this module:

- `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.model.ts`
- `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.repository.ts`
- `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.routes.ts`
- `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.schemas.ts`
- `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.service.ts`
- `apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
