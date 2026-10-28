# Advance Payments Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Advance Payments |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Track configured deposits against admission or procedure context and relate collection to billing.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Track configured deposits against admission or procedure context and relate collection to billing. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Authorized billing user; Reception coordinates prerequisites; administrators configure policy.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Billing | Invoices | Edit |
| Billing | Invoices | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-ADV-001 | Documented source requirement; approval unverified. Deposit/advance collection prior to or during treatment (notably for ED and IPD admission), tracked against the patient account and offset against the final bill. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶905 | `apps/api/src/modules/advance-payment/advance-payment.service.ts:12` — syncRequirement | Partial |
| FR-ADV-002 | Documented source requirement; approval unverified. Refund of unused advance or overpayment, with reason, approval and payment-mode-specific reversal. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶907 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-ADV-003 | Documented source requirement; approval unverified. System shall record the advance and net it off against the final inpatient bill at discharge. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶932 | `apps/api/src/modules/advance-payment/advance-payment.service.ts:16` — processPayment | Partial |
| FR-ADV-004 | Documented source requirement; approval unverified. Advance payments can be collected, tracked and offset against invoices. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶945 | `apps/api/src/modules/advance-payment/advance-payment.service.ts:16` — processPayment | Partial |
| FR-ADV-005 | Documented source requirement; approval unverified. Advance payment/deposit shall be configurable for surgery/procedure booking and bed allotment. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶418 | `apps/api/src/modules/advance-payment/advance-payment.service.ts:12` — syncRequirement | Partial |
| FR-ADV-006 | Documented source requirement; approval unverified. Support bed/deposit/advance payment as configured; detailed ward charge automation is To Be Confirmed. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶429 | `apps/api/src/modules/advance-payment/advance-payment.service.ts:12` — syncRequirement | Partial |
| FR-ADV-007 | Implementation observation — business validation required. Read the existing advance record by source type and source ID. | `apps/api/src/modules/advance-payment/advance-payment.service.ts:8` | `apps/api/src/modules/advance-payment/advance-payment.service.ts:8` — getBySource | Implemented |
| FR-ADV-008 | Implementation observation — business validation required. Synchronize a deposit requirement and increment recorded payment through the repository. | `apps/api/src/modules/advance-payment/advance-payment.service.ts:16` | `apps/api/src/modules/advance-payment/advance-payment.service.ts:16` — processPayment | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Identify the admission or procedure requiring a deposit.
2. Resolve the configured requirement and amount.
3. Authorized billing staff record the payment against the same source context.
4. Re-evaluate paid or partially paid status before confirmation.
5. Apply or reconcile the advance with the final invoice only under an agreed accounting policy.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

No complete module-specific business validation contract was established from simple service errors. The source gaps remain explicit; shared request validation is not a substitute for an approved rule.

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/advance-payment/advance-payment.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/BillingDashboardPage.tsx` | useCurrencyFormatter, useBillingDashboardFeature |
| `apps/web/src/pages/BillingHistoryPage.tsx` | useCurrencyFormatter, useBillingHistoryFeature |
| `apps/web/src/pages/BillingWorkspacePage.tsx` | useCurrencyFormatter, useAppLocation, useMemo, useState, useBillingWorkspaceFeature, useEffect, useHospitalSettings |
| `apps/web/src/pages/InpatientAdmissionPage.tsx` | useAppLocation, useMemo, useState, useInpatientAdmissionFeature, useEffect |
| `apps/web/src/pages/InpatientWorkspacePage.test.tsx` | useFeature |
| `apps/web/src/pages/InpatientWorkspacePage.tsx` | useState, useEffect, useInpatientWorkspaceFeature, useMemo |
| `apps/web/src/pages/SurgeryWorkspacePage.test.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/pages/SurgeryWorkspacePage.tsx` | useState, useSurgeryWorkspaceFeature, useMemo |
| `apps/web/src/hooks/admissions/useInpatientAdmissionFeature.test.tsx` | useInpatientAdmissionFeature |
| `apps/web/src/hooks/admissions/useInpatientWorkspaceFeature.test.tsx` | useInpatientWorkspaceFeature |
| `apps/web/src/hooks/surgery/useSurgeryWorkspaceFeature.test.tsx` | useSurgeryWorkspaceFeature |
| `apps/web/src/hooks/admissions/useInpatientAdmissionFeature.ts` | useInpatientAdmissionFeature, useAuth, useAppLocation, useMemo, useState, useInpatientAdmissions, useEffect, useOpdVisits |
| `apps/web/src/hooks/admissions/useInpatientDownstreamFeature.ts` | useInpatientDownstreamFeature, useInpatientDownstream, useServicesList |
| `apps/web/src/hooks/admissions/useInpatientWorkspaceFeature.ts` | useInpatientWorkspaceFeature, useAuth, useAppLocation, useMemo, useBranchesList, useState, useEffect, useWardsList |
| `apps/web/src/hooks/billing/useBillingDashboardFeature.ts` | useBillingDashboardFeature, useAuth, useBillingCapabilities, useAppLocation, useMemo, useBranchesList, useState, useBillingSummary |
| `apps/web/src/hooks/billing/useBillingFeature.ts` | useBillingCapabilities, useAuth |
| `apps/web/src/hooks/billing/useBillingHistoryFeature.ts` | useBillingHistoryFeature, useAuth, useBillingCapabilities, useAppLocation, useMemo, useState, useBranchesList, usePatientsList |
| `apps/web/src/hooks/billing/useBillingWorkspaceFeature.ts` | useBillingWorkspaceFeature, useAuth, useBillingCapabilities, useBranchesList, useMemo, usePatientsList, useOpdVisits, useServicesList |
| `apps/web/src/hooks/surgery/useSurgeryDownstreamFeature.ts` | useSurgeryDownstreamFeature, useAuth, useSurgeryDownstream, useServicesList |
| `apps/web/src/hooks/surgery/useSurgeryWorkspaceFeature.ts` | useSurgeryWorkspaceFeature, useAuth, useAppLocation, useState, useBranchesList, useEffect, useSurgery, useAdvancePaymentFeature |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/advance-payments | advancePayment.getBySource | getAdvancePaymentQuerySchema | `apps/api/src/modules/advance-payment/advance-payment.routes.ts:14` |
| POST /api/advance-payments/sync | advancePayment.syncRequirement | syncAdvancePaymentSchema | `apps/api/src/modules/advance-payment/advance-payment.routes.ts:32` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### AdvancePaymentFields

`apps/api/src/modules/advance-payment/advance-payment.types.ts:5`

| Field | Observed type |
| --- | --- |
| patient_id | string |
| source_type | AdvanceSourceType |
| source_id | string |
| branch_id | string |
| required_amount | number |
| paid_amount | number |
| balance_amount | number |
| requirement_status | AdvanceRequirementStatus |
| payment_status | AdvancePaymentStatus |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### SyncAdvancePaymentDTO

`apps/api/src/modules/advance-payment/advance-payment.types.ts:25`

| Field | Observed type |
| --- | --- |
| patient_id | string |
| source_type | AdvanceSourceType |
| source_id | string |
| branch_id | string |
| required_amount | number |
| requirement_status | AdvanceRequirementStatus |

### ProcessAdvancePaymentPaymentDTO

`apps/api/src/modules/advance-payment/advance-payment.types.ts:34`

| Field | Observed type |
| --- | --- |
| source_type | AdvanceSourceType |
| source_id | string |
| amount_paid | number |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| AdvanceRequirementStatus | 'NOT_REQUIRED' \| 'REQUIRED' | `apps/api/src/modules/advance-payment/advance-payment.types.ts:1` |
| AdvancePaymentStatus | 'PENDING' \| 'PARTIALLY_PAID' \| 'PAID' \| 'CANCELLED' | `apps/api/src/modules/advance-payment/advance-payment.types.ts:2` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Billing; Payments; IPD; Surgery; Bed and Ward Management.

Observed backend import domains: No dedicated import dependency list established.. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-ADV-001 | FR-ADV-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Deposit/advance collection prior to or during treatment (notably for ED and IPD admission), tracked against the patient account and offset against the final bill. |
| AC-ADV-002 | FR-ADV-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Refund of unused advance or overpayment, with reason, approval and payment-mode-specific reversal. |
| AC-ADV-003 | FR-ADV-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall record the advance and net it off against the final inpatient bill at discharge. |
| AC-ADV-004 | FR-ADV-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Advance payments can be collected, tracked and offset against invoices. |
| AC-ADV-005 | FR-ADV-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Advance payment/deposit shall be configurable for surgery/procedure booking and bed allotment. |
| AC-ADV-006 | FR-ADV-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Support bed/deposit/advance payment as configured; detailed ward charge automation is To Be Confirmed. |
| AC-ADV-007 | FR-ADV-007 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Read the existing advance record by source type and source ID. |
| AC-ADV-008 | FR-ADV-008 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Synchronize a deposit requirement and increment recorded payment through the repository. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-ADV-01: R1 requires offset and refund handling; R2 makes refund or reversal conditional on approval. The small advance service does not prove a complete ledger or refund flow.
- GAP-ADV-02: Confirm deposit amount, currency, partial-payment eligibility, receipt and reconciliation ownership.
- GAP-ADV-03: The source lookup and payment update must be reviewed for actor and branch authorization; forwarding a user ID is not proof of enforcement.
- GAP-ADV-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Advance Payments/review.md` | 94c4e8aab2e15bfe3faa0bbb812caefab658f3d3c36a098a603d27cfc799a160 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/advance-payment/advance-payment.service.ts` | be6d2c592e14aed3200f81ba3760a356b6f6a4e58e3b37ba4d20e7be3a8c352a | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/advance-payment/advance-payment.model.ts`
- `apps/api/src/modules/advance-payment/advance-payment.repository.ts`
- `apps/api/src/modules/advance-payment/advance-payment.routes.ts`
- `apps/api/src/modules/advance-payment/advance-payment.schemas.ts`
- `apps/api/src/modules/advance-payment/advance-payment.service.ts`
- `apps/api/src/modules/advance-payment/advance-payment.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
