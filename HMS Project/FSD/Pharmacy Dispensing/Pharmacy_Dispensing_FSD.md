# Pharmacy Dispensing Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Pharmacy Dispensing |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Turn a submitted prescription into a validated dispense and linked bill while conserving stock.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Turn a submitted prescription into a validated dispense and linked bill while conserving stock. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Pharmacy User; pharmacy supervisor for reversals; billing collector only when separately authorized.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Pharmacy | Dispensing | Cancel |
| Pharmacy | Dispensing | Dispense |
| Pharmacy | Dispensing | Edit |
| Pharmacy | Dispensing | Reverse |
| Pharmacy | Dispensing | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-DISP-001 | Documented source requirement; approval unverified. System shall check new prescriptions against active medications and flag known interactions with severity level before dispensing. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶756 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:154` — confirm | Partial |
| FR-DISP-002 | Documented source requirement; approval unverified. System shall cross-check prescribed medicine against the patient's recorded allergies and block/warn accordingly. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶758 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:154` — confirm | Partial |
| FR-DISP-003 | Documented source requirement; approval unverified. System shall warn when a medicine of the same class/active ingredient is already active for the patient. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶760 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:154` — confirm | Partial |
| FR-DISP-004 | Documented source requirement; approval unverified. Return of dispensed medicine with reason, quantity, batch reference and stock reversal, subject to approval. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶762 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:226` — reverse | Partial |
| FR-DISP-005 | Documented source requirement; approval unverified. Deduct stock and update dispensing history against the patient record. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶778 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:154` — confirm | Partial |
| FR-DISP-006 | Documented source requirement; approval unverified. Pharmacy shall be able to create the pharmacy bill directly from the e-prescription. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶399 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:154` — confirm | Partial |
| FR-DISP-007 | Documented source requirement; approval unverified. The system shall check pharmacy inventory before final bill/dispense confirmation. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶400 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:154` — confirm | Partial |
| FR-DISP-008 | Documented source requirement; approval unverified. Pharmacy shall be able to edit quantity before final billing/dispensing. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶405 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:108` — save | Partial |
| FR-DISP-009 | Documented source requirement; approval unverified. If Pharmacy increases the quantity, the system must validate available stock before allowing billing/dispensing. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶410 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:154` — confirm | Partial |
| FR-DISP-010 | Documented source requirement; approval unverified. If Pharmacy reduces the quantity, stock shall be deducted only for the reduced final dispensed quantity. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶411 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:154` — confirm | Partial |
| FR-DISP-011 | Documented source requirement; approval unverified. Cancelled or unconfirmed e-prescriptions shall not deduct stock. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶413 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:212` — cancel | Partial |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Open a submitted prescription in the dispensing queue.
2. Review each medication and resolve its inventory batch.
3. Check safety alerts and available nonexpired stock under the approved policy.
4. Adjust permitted quantity and price fields before confirmation.
5. Confirm dispensing and billing with the final quantities.
6. Deduct stock once and update prescription history.
7. Cancel or reverse only through the supported state and financial controls.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| DISPENSING_NOT_FOUND — Dispensing record not found | 404 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:60` |
| PRESCRIPTION_ALREADY_DISPENSED — This prescription has already been dispensed. | 409 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:63` |
| DISPENSING_CANCELLED — Dispensing for this prescription has been cancelled. | 409 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:70` |
| DISPENSING_REVERSED — Dispensing for this prescription has already been reversed. | 409 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:77` |
| PRESCRIPTION_NOT_FOUND — Prescription not found | 404 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:90` |
| BRANCH_ACCESS_DENIED — Branch access denied | 403 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:93` |
| DISPENSING_ITEMS_INVALID — All prescribed medicines must be mapped before saving | 422 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:121` |
| BATCH_NOT_AVAILABLE — Selected medicine batch is invalid | 422 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:130` |
| STALE_VERSION — Dispensing changed; refresh and retry | 409 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:136` |
| PRESCRIPTION_NOT_ACTIONABLE — Prescription is not actionable | 409 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:158` |
| PROCEDURE_CONTEXT_NOT_ACTIVE — Procedure booking is no longer active for dispensing | 409 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:159` |
| PROCEDURE_BILLING_CONTEXT_INVALID — Procedure billing encounter context is invalid | 409 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:160` |
| DISPENSING_ITEMS_UNRESOLVED — All prescribed medicines must be resolved before confirmation | 422 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:166` |
| INVENTORY_REFRESH_FAILED — Inventory snapshot could not be refreshed | 500 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:183` |
| INVALID_STATE_TRANSITION — Prescription changed; retry | 409 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:194` |
| DISPENSING_CONFIRMATION_IDEMPOTENCY_CONFLICT — This dispensing confirmation request has already been processed. | 409 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:202` |
| DISPENSING_REVERSAL_NOT_ALLOWED — Dispensing is not reversible | 409 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:230` |
| PAID_DISPENSING_REVERSAL_REQUIRES_REFUND — Paid dispensing requires a refund workflow | 409 | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:233` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/PharmacyQueueDashboardPage.test.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/pages/PharmacyQueueDashboardPage.tsx` | useState, usePharmacyDispensingFeature, useMemo |
| `apps/web/src/pages/PrescriptionQueuePage.test.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/pages/PrescriptionQueuePage.tsx` | useCurrencyFormatter, useAppLocation, useState, usePharmacyDispensingFeature, useEffect |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/pharmacy/dispensings | pharmacyDispensing.list | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.routes.ts:23` |
| GET /api/pharmacy/dispensings/:id | pharmacyDispensing.get | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.routes.ts:26` |
| PUT /api/pharmacy/dispensings/:id | pharmacyDispensing.save | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.routes.ts:29` |
| POST /api/pharmacy/dispensings/:id/confirm | pharmacyDispensing.confirm | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.routes.ts:32` |
| POST /api/pharmacy/dispensings/:id/cancel | pharmacyDispensing.cancel | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.routes.ts:36` |
| POST /api/pharmacy/dispensings/:id/reverse | pharmacyDispensing.reverse | Inline/custom validation; inspect source | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.routes.ts:40` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### PharmacyDispensingItem

`apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.types.ts:5`

| Field | Observed type |
| --- | --- |
| id | string |
| prescription_item_id | string |
| prescribed_medicine_name | string |
| medicine_id | string \| null |
| batch_id | string \| null |
| medicine_name | string |
| batch_number | string |
| requested_quantity | number \| null |
| confirmed_quantity | number \| null |
| available_quantity | number |
| unit_price | number |
| line_total | number |
| pharmacist_instructions | string \| null |

### PharmacyDispensing

`apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.types.ts:21`

| Field | Observed type |
| --- | --- |
| id | string |
| prescription_id | string |
| patient_id | string |
| source_type | PharmacyDispensingSourceType |
| encounter_id | string \| null |
| admission_id | string \| null |
| procedure_id | string \| null |
| patient_number | string |
| patient_name | string |
| doctor_name | string |
| visit_id | string \| null |
| branch_id | string |
| status | PharmacyDispensingStatus |
| version | number |
| items | PharmacyDispensingItem[] |
| invoice_id | string \| null |
| invoice_number | string \| null |
| submitted_at | Date \| null |
| confirmed_at | Date \| null |
| cancelled_at | Date \| null |
| reversed_at | Date \| null |
| reversal_reason | string \| null |
| created_at | Date |
| updated_at | Date |

### SavePharmacyDispensingDTO

`apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.types.ts:56`

| Field | Observed type |
| --- | --- |
| version | number |
| prescription_item_id | string |
| medicine_id | string |
| batch_id | string |
| confirmed_quantity | number |
| pharmacist_instructions? | string \| null |

### IdempotentActionDTO

`apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.types.ts:67`

| Field | Observed type |
| --- | --- |
| idempotency_key | string |

### ReasonActionDTO

`apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.types.ts:68`

| Field | Observed type |
| --- | --- |
| reason | string |
| idempotency_key? | string |

### PharmacyDispensingListQuery

`apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.types.ts:48`

| Field | Observed type |
| --- | --- |
| branch_id | string |
| status? | PharmacyDispensingStatus \| 'PENDING' |
| search? | string |
| page? | number |
| limit? | number |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| PharmacyDispensingStatus | 'DRAFT' \| 'CONFIRMED' \| 'CANCELLED' \| 'REVERSED' | `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.types.ts:1` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Prescriptions; Pharmacy Inventory; Medicine Catalog; Billing; Patient Management; clinical encounter modules.

Observed backend import domains: `auth`, `billing`, `opd`, `pharmacy-inventory`, `surgery`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:114` — return executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:156` — return await executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:213` — return executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:227` — return executeTransaction(() => mongoose.startSession(), async (session) => {

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-DISP-001 | FR-DISP-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall check new prescriptions against active medications and flag known interactions with severity level before dispensing. |
| AC-DISP-002 | FR-DISP-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall cross-check prescribed medicine against the patient's recorded allergies and block/warn accordingly. |
| AC-DISP-003 | FR-DISP-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall warn when a medicine of the same class/active ingredient is already active for the patient. |
| AC-DISP-004 | FR-DISP-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Return of dispensed medicine with reason, quantity, batch reference and stock reversal, subject to approval. |
| AC-DISP-005 | FR-DISP-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Deduct stock and update dispensing history against the patient record. |
| AC-DISP-006 | FR-DISP-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Pharmacy shall be able to create the pharmacy bill directly from the e-prescription. |
| AC-DISP-007 | FR-DISP-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: The system shall check pharmacy inventory before final bill/dispense confirmation. |
| AC-DISP-008 | FR-DISP-008 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Pharmacy shall be able to edit quantity before final billing/dispensing. |
| AC-DISP-009 | FR-DISP-009 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: If Pharmacy increases the quantity, the system must validate available stock before allowing billing/dispensing. |
| AC-DISP-010 | FR-DISP-010 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: If Pharmacy reduces the quantity, stock shall be deducted only for the reduced final dispensed quantity. |
| AC-DISP-011 | FR-DISP-011 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Cancelled or unconfirmed e-prescriptions shall not deduct stock. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-DISP-01: R1 requires automated interaction, allergy and duplicate checks; dispensing and stock validation alone do not prove these safety engines.
- GAP-DISP-02: R1 medicine returns require approval and stock reversal; current paid-dispensing reversal rejects a refund prerequisite.
- GAP-DISP-03: Confirm permitted price edits, medicine substitution, partial dispensing and supervisor authority.
- GAP-DISP-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Pharmacy Dispensing/HMS_PHARMACY_DISPENSING_SOURCE_PRICE_GAP_NOTE.md` | a51f3d917fb918417dd9d95444e8071fb9eda0fc4e5767b74a0f6b13cf0bfe50 | Historical design evidence |
| `HMS Project/Design/Pharmacy Dispensing/review.md` | 93967696e64d3fc7c47533fe6fca5c7a3c9543e037cb73be4326a964d2175f3a | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.model.ts`
- `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.repository.ts`
- `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.routes.ts`
- `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.schemas.ts`
- `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts`
- `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
