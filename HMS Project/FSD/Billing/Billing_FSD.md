# Billing Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Billing |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Create patient-context invoices, calculate amounts and track settlement without losing the underlying clinical service references.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Create patient-context invoices, calculate amounts and track settlement without losing the underlying clinical service references. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Authorized billing user; billing supervisor for approved reversals or adjustments; financial viewers by permission.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Billing | Invoices | Cancel |
| Billing | Invoices | CollectPayment |
| Billing | Invoices | Create |
| Billing | Invoices | Edit |
| Billing | Invoices | View |
| Billing | Invoices | ViewReceipt |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-BILL-001 | Documented source requirement; approval unverified. Release 1 shall provide invoicing, payment collection and receipting across OPD, Emergency and IPD, enhanced with advance payment handling, refund processing and controlled payment adjustments to support real-world African hospital billing scenarios including deposit-based admission and part-payment plans. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶900 | `apps/api/src/modules/billing/billing.service.ts:174` — create | Partial |
| FR-BILL-002 | Documented source requirement; approval unverified. Controlled adjustment/write-off/credit note against an invoice, with reason, approval and audit trail. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶909 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-BILL-003 | Documented source requirement; approval unverified. Discount permission by role with reason and approval threshold. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶911 | `apps/api/src/modules/billing/billing.service.ts:448` — calculateTotals | Unverified |
| FR-BILL-004 | Documented source requirement; approval unverified. System shall track outstanding balance against the invoice. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶938 | `apps/api/src/modules/billing/billing.service.ts:281` — collectPayment | Partial |
| FR-BILL-005 | Documented source requirement; approval unverified. Outstanding balances and discounts are tracked accurately across OPD, Emergency and IPD. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶951 | `apps/api/src/modules/billing/billing.service.ts:65` — summary | Partial |
| FR-BILL-006 | Documented source requirement; approval unverified. Billing must remain permission-driven and not tied to a fixed role. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶416 | `apps/api/src/modules/billing/billing.service.ts:281` — collectPayment | Partial |
| FR-BILL-007 | Documented source requirement; approval unverified. Invoices and receipts shall be linked to patient and relevant encounter/admission/surgery/emergency context. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶420 | `apps/api/src/modules/billing/billing.service.ts:367` — validateInvoiceContext | Partial |
| FR-BILL-008 | Documented source requirement; approval unverified. Refund/reversal/adjustment shall be included only if approved and permission-controlled. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶421 | `apps/api/src/modules/billing/billing.service.ts:259` — cancel | Partial |
| FR-BILL-009 | Documented source requirement; approval unverified. Support bed/deposit/advance payment as configured; detailed ward charge automation is To Be Confirmed. | `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` ¶429 | `apps/api/src/modules/billing/billing.service.ts:106` — linkAdmissionContext | Partial |
| FR-BILL-010 | Implementation observation — business validation required. Validate invoice patient, visit, branch and appointment references before creation. | `apps/api/src/modules/billing/billing.service.ts:367` | `apps/api/src/modules/billing/billing.service.ts:367` — validateInvoiceContext | Implemented |
| FR-BILL-011 | Implementation observation — business validation required. Reject cancellation once payment has been recorded. | `apps/api/src/modules/billing/billing.service.ts:259` | `apps/api/src/modules/billing/billing.service.ts:259` — cancel | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Select the patient and originating visit, admission or procedure.
2. Resolve eligible billable services and their recorded prices.
3. Calculate subtotal, discounts, tax and total.
4. Save the invoice with consistent source references.
5. Collect permitted payments and display outstanding balance.
6. Retrieve a receipt; route paid cancellation or refund requests to an approved policy decision.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| BILLING_INVOICE_NOT_FOUND — Invoice not found | 404 | `apps/api/src/modules/billing/billing.service.ts:61` |
| ADVANCE_DEPOSIT_REQUIRED — The selected deposit invoice is not linked to this admission request | 409 | `apps/api/src/modules/billing/billing.service.ts:80` |
| BRANCH_ACCESS_DENIED — Branch access denied | 403 | `apps/api/src/modules/billing/billing.service.ts:99` |
| BILLING_CONTEXT_CONFLICT — Invoice could not be linked to this procedure booking | 409 | `apps/api/src/modules/billing/billing.service.ts:101` |
| INVOICE_TOTAL_REQUIRED — A pending invoice must have a positive total | 409 | `apps/api/src/modules/billing/billing.service.ts:233` |
| BILLING_INVOICE_UPDATE_CONFLICT — Invoice changed or is no longer editable | 409 | `apps/api/src/modules/billing/billing.service.ts:243` |
| INVOICE_CANCELLED — Invoice is already cancelled | 409 | `apps/api/src/modules/billing/billing.service.ts:262` |
| PAID_INVOICE_CANNOT_CANCEL — Invoices with collected payments cannot be cancelled because refunds are out of scope | 409 | `apps/api/src/modules/billing/billing.service.ts:264` |
| INVOICE_CANCEL_CONFLICT — Invoice is no longer cancellable | 409 | `apps/api/src/modules/billing/billing.service.ts:268` |
| INVOICE_NOT_PENDING — Finalize the invoice before collecting payment | 409 | `apps/api/src/modules/billing/billing.service.ts:292` |
| INVOICE_PAID — Invoice is already paid | 409 | `apps/api/src/modules/billing/billing.service.ts:294` |
| INVALID_PAYMENT_AMOUNT — Payment amount must be greater than zero | 400 | `apps/api/src/modules/billing/billing.service.ts:297` |
| PAYMENT_CONFLICT — Invoice balance changed; refresh and retry | 409 | `apps/api/src/modules/billing/billing.service.ts:314` |
| BILLING_PAYMENT_NOT_FOUND — Payment not found | 404 | `apps/api/src/modules/billing/billing.service.ts:335` |
| INVALID_PATIENT — Active patient is required | 400 | `apps/api/src/modules/billing/billing.service.ts:373` |
| INVALID_VISIT — OPD visit not found | 400 | `apps/api/src/modules/billing/billing.service.ts:374` |
| VISIT_PATIENT_MISMATCH — Visit does not belong to the selected patient | 409 | `apps/api/src/modules/billing/billing.service.ts:375` |
| VISIT_BRANCH_MISMATCH — Visit does not belong to the selected branch | 409 | `apps/api/src/modules/billing/billing.service.ts:376` |
| VISIT_APPOINTMENT_MISMATCH — Appointment does not belong to the selected visit | 409 | `apps/api/src/modules/billing/billing.service.ts:379` |
| INVALID_APPOINTMENT_CONTEXT — Appointment context is invalid | 409 | `apps/api/src/modules/billing/billing.service.ts:384` |
| INVALID_BILLING_SERVICE — Every invoice item must reference an active Service Catalogue entry | 409 | `apps/api/src/modules/billing/billing.service.ts:398` |
| PHARMACY_MANAGED_BY_DISPENSING — Pharmacy items cannot be added manually to an invoice. They are managed by the dispensing workflow. | 409 | `apps/api/src/modules/billing/billing.service.ts:404` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/billing/billing.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/BillingDashboardPage.tsx` | useCurrencyFormatter, useBillingDashboardFeature |
| `apps/web/src/pages/BillingHistoryPage.tsx` | useCurrencyFormatter, useBillingHistoryFeature |
| `apps/web/src/pages/BillingWorkspacePage.tsx` | useCurrencyFormatter, useAppLocation, useMemo, useState, useBillingWorkspaceFeature, useEffect, useHospitalSettings |
| `apps/web/src/hooks/billing/useBillingDashboardFeature.ts` | useBillingDashboardFeature, useAuth, useBillingCapabilities, useAppLocation, useMemo, useBranchesList, useState, useBillingSummary |
| `apps/web/src/hooks/billing/useBillingFeature.ts` | useBillingCapabilities, useAuth |
| `apps/web/src/hooks/billing/useBillingHistoryFeature.ts` | useBillingHistoryFeature, useAuth, useBillingCapabilities, useAppLocation, useMemo, useState, useBranchesList, usePatientsList |
| `apps/web/src/hooks/billing/useBillingWorkspaceFeature.ts` | useBillingWorkspaceFeature, useAuth, useBillingCapabilities, useBranchesList, useMemo, usePatientsList, useOpdVisits, useServicesList |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/billing/invoices | billing.list | Inline/custom validation; inspect source | `apps/api/src/modules/billing/billing.routes.ts:23` |
| GET /api/billing/summary | billing.summary | Inline/custom validation; inspect source | `apps/api/src/modules/billing/billing.routes.ts:29` |
| GET /api/billing/invoices/:id | billing.getById | Inline/custom validation; inspect source | `apps/api/src/modules/billing/billing.routes.ts:35` |
| POST /api/billing/invoices | billing.create | Inline/custom validation; inspect source | `apps/api/src/modules/billing/billing.routes.ts:41` |
| PATCH /api/billing/invoices/:id | billing.update | Inline/custom validation; inspect source | `apps/api/src/modules/billing/billing.routes.ts:51` |
| PATCH /api/billing/invoices/:id/admission-context | billing.linkAdmissionContext | Inline/custom validation; inspect source | `apps/api/src/modules/billing/billing.routes.ts:62` |
| PATCH /api/billing/invoices/:id/procedure-context | billing.linkProcedureContext | Inline/custom validation; inspect source | `apps/api/src/modules/billing/billing.routes.ts:63` |
| POST /api/billing/invoices/:id/cancel | billing.cancel | Inline/custom validation; inspect source | `apps/api/src/modules/billing/billing.routes.ts:65` |
| POST /api/billing/invoices/:id/payments | billing.collectPayment | Inline/custom validation; inspect source | `apps/api/src/modules/billing/billing.routes.ts:75` |
| GET /api/billing/invoices/:id/payments | billing.listPayments | Inline/custom validation; inspect source | `apps/api/src/modules/billing/billing.routes.ts:86` |
| GET /api/billing/payments/:id/receipt | billing.receipt | Inline/custom validation; inspect source | `apps/api/src/modules/billing/billing.routes.ts:95` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### BillingInvoiceItem

`apps/api/src/modules/billing/billing.types.ts:7`

| Field | Observed type |
| --- | --- |
| id | string |
| invoice_id | string |
| service_id | string |
| service_name | string |
| service_type | BillingServiceType |
| originating_order_id | string \| null |
| quantity | number |
| unit_price | number |
| line_total | number |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### BillingInvoice

`apps/api/src/modules/billing/billing.types.ts:23`

| Field | Observed type |
| --- | --- |
| id | string |
| invoice_number | string |
| patient_id | string |
| patient_number | string \| null |
| patient_name | string \| null |
| visit_id | string |
| visit_number | string \| null |
| source_type | BillingSourceType |
| encounter_id | string |
| admission_id | string \| null |
| procedure_id | string \| null |
| appointment_id | string \| null |
| appointment_number | string \| null |
| branch_id | string |
| context_type | 'ADMISSION_REQUEST' \| 'PROCEDURE_BOOKING' \| null |
| context_id | string \| null |
| branch_name | string \| null |
| invoice_date | Date |
| status | BillingInvoiceStatus |
| subtotal | number |
| discount_amount | number |
| tax_amount | number |
| total_amount | number |
| paid_amount | number |
| balance_amount | number |
| items | BillingInvoiceItem[] |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### BillingPayment

`apps/api/src/modules/billing/billing.types.ts:56`

| Field | Observed type |
| --- | --- |
| id | string |
| invoice_id | string |
| patient_id | string |
| branch_id | string |
| payment_number | string |
| amount | number |
| payment_method | BillingPaymentMethod |
| payment_date | Date |
| reference_number | string \| null |
| created_by | string \| null |
| updated_by | string \| null |
| created_at | Date |
| updated_at | Date |

### BillingReceipt

`apps/api/src/modules/billing/billing.types.ts:72`

| Field | Observed type |
| --- | --- |
| receipt_number | string |
| generated_at | Date |
| payment | BillingPayment |
| invoice | BillingInvoice |

### DepositVerification

`apps/api/src/modules/billing/billing.types.ts:138`

| Field | Observed type |
| --- | --- |
| required_amount | number |
| paid_amount | number |
| remaining_amount | number |
| satisfied | boolean |
| invoice_id | string \| null |
| payment_ids | string[] |
| verified_at | Date |

### ResolvedBillingItem

`apps/api/src/modules/billing/billing.types.ts:148`

| Field | Observed type |
| --- | --- |
| serviceId | string |
| serviceName | string |
| serviceType | BillingServiceType |
| originatingOrderId? | string \| null |
| quantity | number |
| unitPrice | number |
| lineTotal | number |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| BillingInvoiceStatus | 'DRAFT' \| 'PENDING' \| 'PARTIALLY_PAID' \| 'PAID' \| 'CANCELLED' | `apps/api/src/modules/billing/billing.types.ts:1` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Payments; Advance Payments; Service Catalog; Patient Management; OPD Consultation; IPD; Surgery; Pharmacy Dispensing.

Observed backend import domains: `advance-payment`, `appointments`, `auth`, `branches`, `opd`, `patients`, `roles`, `services`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/billing/billing.service.ts:178` — const createdId = await executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/billing/billing.service.ts:236` — await executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/billing/billing.service.ts:266` — await executeTransaction(() => mongoose.startSession(), async (session) => {
- `apps/api/src/modules/billing/billing.service.ts:289` — const paymentId = await executeTransaction(() => mongoose.startSession(), async (session) => {

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-BILL-001 | FR-BILL-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Release 1 shall provide invoicing, payment collection and receipting across OPD, Emergency and IPD, enhanced with advance payment handling, refund processing and controlled payment adjustments to support real-world African hospital billing scenarios including deposit-based admission and part-payment plans. |
| AC-BILL-002 | FR-BILL-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Controlled adjustment/write-off/credit note against an invoice, with reason, approval and audit trail. |
| AC-BILL-003 | FR-BILL-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Discount permission by role with reason and approval threshold. |
| AC-BILL-004 | FR-BILL-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: System shall track outstanding balance against the invoice. |
| AC-BILL-005 | FR-BILL-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Outstanding balances and discounts are tracked accurately across OPD, Emergency and IPD. |
| AC-BILL-006 | FR-BILL-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Billing must remain permission-driven and not tied to a fixed role. |
| AC-BILL-007 | FR-BILL-007 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Invoices and receipts shall be linked to patient and relevant encounter/admission/surgery/emergency context. |
| AC-BILL-008 | FR-BILL-008 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Refund/reversal/adjustment shall be included only if approved and permission-controlled. |
| AC-BILL-009 | FR-BILL-009 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Support bed/deposit/advance payment as configured; detailed ward charge automation is To Be Confirmed. |
| AC-BILL-010 | FR-BILL-010 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Validate invoice patient, visit, branch and appointment references before creation. |
| AC-BILL-011 | FR-BILL-011 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Reject cancellation once payment has been recorded. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-BILL-01: R1 requires refunds, credit notes and discount approval; R2 conditions reversals on approval and the current cancellation path rejects paid invoices.
- GAP-BILL-02: Confirm currency, rounding, invoice numbering and tax treatment with the business owner; historical review commentary is not legal approval.
- GAP-BILL-03: A complete IP running-bill and automatic ward-charge policy is not established by visit-oriented invoice functions.
- GAP-BILL-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Billing/review.md` | 933fb5929c18650f5d14ffdc36b2fb9e8902b9408bc5d6758e438d9a7fb94437 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release2_FSD.docx` | d6eaf733609f949db252f3549be9910efe6d4efa603725966776e29b79d7bc2e | Original preserved specification |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/billing/billing.service.ts` | 665db1cea3211070af9b56a21efb94e2946c79d436f2a8b76725d3650f8c543d | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/billing/billing-number.ts`
- `apps/api/src/modules/billing/billing.model.ts`
- `apps/api/src/modules/billing/billing.repository.ts`
- `apps/api/src/modules/billing/billing.routes.ts`
- `apps/api/src/modules/billing/billing.schemas.ts`
- `apps/api/src/modules/billing/billing.service.ts`
- `apps/api/src/modules/billing/billing.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
