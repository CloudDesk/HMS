# Medicine Catalog Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Medicine Catalog |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Maintain medicine master records used by prescribing and pharmacy inventory.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Maintain medicine master records used by prescribing and pharmacy inventory. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Authorized master-data administrator; Pharmacy User only where the assigned permissions allow master creation.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Administration | Medicines | Create |
| Administration | Medicines | Delete |
| Administration | Medicines | Edit |
| Administration | Medicines | Export |
| Administration | Medicines | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-MED-001 | Documented source requirement; approval unverified. Medicine master, unit of measure, batch, expiry, reorder threshold and drug interaction reference list. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶237 | `apps/api/src/modules/medicines/medicine.service.ts:60` — create | Partial |
| FR-MED-002 | Documented source requirement; approval unverified. System shall prevent new usage while preserving history. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶254 | `apps/api/src/modules/medicines/medicine.service.ts:112` — delete | Partial |
| FR-MED-003 | Implementation observation — business validation required. Create and update medicine master definitions. | `apps/api/src/modules/medicines/medicine.service.ts:60` | `apps/api/src/modules/medicines/medicine.service.ts:60` — create | Implemented |
| FR-MED-004 | Implementation observation — business validation required. Reject deletion when current stock or inventory history depends on a medicine. | `apps/api/src/modules/medicines/medicine.service.ts:112` | `apps/api/src/modules/medicines/medicine.service.ts:112` — delete | Implemented |
| FR-MED-005 | Implementation observation — business validation required. Provide the existing catalog export operation. | `apps/api/src/modules/medicines/medicine.service.ts:128` | `apps/api/src/modules/medicines/medicine.service.ts:128` — export | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. List or search medicine master entries.
2. Create or update the authorized medicine definition.
3. Use the master ID in prescribing and stock operations.
4. Change status or remove only where dependencies permit.
5. Retain inventory history even when the medicine is no longer used.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| MEDICINE_NOT_FOUND — Medicine not found | 404 | `apps/api/src/modules/medicines/medicine.service.ts:52` |
| MEDICINE_HAS_STOCK — Medicine cannot be deactivated while pharmacy stock remains on hand | 409 | `apps/api/src/modules/medicines/medicine.service.ts:78` |
| MEDICINE_HAS_INVENTORY_HISTORY — Medicine cannot be deleted after pharmacy inventory activity exists | 409 | `apps/api/src/modules/medicines/medicine.service.ts:115` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/medicines/medicine.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/MedicineMasterPage.tsx` | useMedicineMasterFeature, useEffect |
| `apps/web/src/hooks/pharmacy/useMedicineMasterFeature.ts` | useMedicineMasterFeature, useAuth, useAppLocation, useMemo, useCallback, useMedicinesList, useMedicinesSummary, useExportMedicines |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/medicines | medicines.list | Inline/custom validation; inspect source | `apps/api/src/modules/medicines/medicine.routes.ts:19` |
| GET /api/medicines/summary | medicines.summary | Inline/custom validation; inspect source | `apps/api/src/modules/medicines/medicine.routes.ts:23` |
| GET /api/medicines/export | medicines.export | Inline/custom validation; inspect source | `apps/api/src/modules/medicines/medicine.routes.ts:27` |
| GET /api/medicines/:id | medicines.getById | Inline/custom validation; inspect source | `apps/api/src/modules/medicines/medicine.routes.ts:40` |
| POST /api/medicines | medicines.create | Inline/custom validation; inspect source | `apps/api/src/modules/medicines/medicine.routes.ts:47` |
| PATCH /api/medicines/:id | medicines.update | Inline/custom validation; inspect source | `apps/api/src/modules/medicines/medicine.routes.ts:58` |
| PATCH /api/medicines/:id/status | medicines.updateStatus | Inline/custom validation; inspect source | `apps/api/src/modules/medicines/medicine.routes.ts:70` |
| DELETE /api/medicines/:id | medicines.delete | Inline/custom validation; inspect source | `apps/api/src/modules/medicines/medicine.routes.ts:78` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### Medicine

`apps/api/src/modules/medicines/medicine.types.ts:3`

| Field | Observed type |
| --- | --- |
| id | string |
| code | string |
| name | string |
| generic_name | string \| null |
| strength | string \| null |
| dosage_form | string \| null |
| unit | string \| null |
| description | string \| null |
| status | MedicineStatus |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### CreateMedicineDTO

`apps/api/src/modules/medicines/medicine.types.ts:29`

| Field | Observed type |
| --- | --- |
| code | string |
| name | string |
| generic_name? | string \| null |
| strength? | string \| null |
| dosage_form? | string \| null |
| unit? | string \| null |
| description? | string \| null |
| status? | MedicineStatus |

### MedicineListQuery

`apps/api/src/modules/medicines/medicine.types.ts:19`

| Field | Observed type |
| --- | --- |
| search? | string |
| status? | MedicineStatus |
| dosage_form? | string |
| page? | number |
| limit? | number |
| sortBy? | 'name' \| 'code' \| 'generic_name' \| 'status' \| 'created_at' \| 'updated_at' |
| sortOrder? | 'asc' \| 'desc' |

### MedicineRequestMetadata

`apps/api/src/modules/medicines/medicine.types.ts:42`

| Field | Observed type |
| --- | --- |
| ipAddress? | string |
| userAgent? | string |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| MedicineStatus | 'ACTIVE' \| 'INACTIVE' | `apps/api/src/modules/medicines/medicine.types.ts:1` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Prescriptions; Pharmacy Inventory; Pharmacy Dispensing; RBAC.

Observed backend import domains: `auth`, `pharmacy-inventory`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-MED-001 | FR-MED-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Medicine master, unit of measure, batch, expiry, reorder threshold and drug interaction reference list. |
| AC-MED-002 | FR-MED-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall prevent new usage while preserving history. |
| AC-MED-003 | FR-MED-003 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Create and update medicine master definitions. |
| AC-MED-004 | FR-MED-004 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Reject deletion when current stock or inventory history depends on a medicine. |
| AC-MED-005 | FR-MED-005 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Provide the existing catalog export operation. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-MED-01: R1 lists interaction references and units but master existence does not prove an active clinical interaction engine.
- GAP-MED-02: Confirm medicine coding, ingredient/class equivalence and deactivation rules.
- GAP-MED-03: Do not infer permitted substitution from interchangeable catalog labels.
- GAP-MED-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Medicine Catalog/review.md` | 1a8e713411d5a4825af92783c87ab6a07c0c68fe72a828d37aaac3f24d5b4b61 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/medicines/medicine.service.ts` | 5e3ad6f8547f9446cce8ce733ed4b9cf67a09c1f1c103596c76c7a33487ba65d | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/medicines/medicine.model.ts`
- `apps/api/src/modules/medicines/medicine.repository.ts`
- `apps/api/src/modules/medicines/medicine.routes.ts`
- `apps/api/src/modules/medicines/medicine.schemas.ts`
- `apps/api/src/modules/medicines/medicine.service.ts`
- `apps/api/src/modules/medicines/medicine.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
