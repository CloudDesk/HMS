# M-Pesa Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | M-Pesa |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Describe the existing staff payment-attempt, submission and callback-correlation boundary without claiming verified settlement.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Describe the existing staff payment-attempt, submission and callback-correlation boundary without claiming verified settlement. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Billing user with CollectPayment permission; financial viewer with invoice access; provider callback sender under callback validation.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Billing | Invoices | CollectPayment |
| Billing | Invoices | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-MPESA-001 | Implementation observation — business validation required. Create a scoped, idempotent attempt for a payable invoice. | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:71` | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:71` — create | Implemented |
| FR-MPESA-002 | Implementation observation — business validation required. Submit once through guarded submission-state transitions. | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:122` | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:122` — submit | Implemented |
| FR-MPESA-003 | Implementation observation — business validation required. Read a masked attempt projection after invoice authorization. | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:69` | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:69` — get | Implemented |
| FR-MPESA-004 | Implementation observation — business validation required. Receive callback evidence using the callback service. | `apps/api/src/modules/mpesa/mpesa-callback.service.ts:47` | `apps/api/src/modules/mpesa/mpesa-callback.service.ts:47` — receive | Implemented |
| FR-MPESA-005 | Implementation observation — business validation required. Correlate pending callback evidence with its stored attempt. | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:209` | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:209` — correlatePending | Implemented |
| FR-MPESA-006 | Implementation observation — business validation required. Keep submission, reported outcome, verification and posting separate. | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:71` | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:71` — create | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Select a payable invoice in the permitted branch.
2. Create an attempt with a client idempotency key.
3. Authorize and revalidate invoice balance in the transaction.
4. Submit the attempt using its expected version.
5. Receive and correlate provider callback evidence.
6. Display the reported outcome, verification and posting states separately.
7. Reconcile through an approved settlement procedure; do not assume callback success posts payment.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| MPESA_ATTEMPT_CONFLICT — Payment attempt changed or cannot be submitted again | 409 | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:18` |
| MPESA_ATTEMPT_UNAVAILABLE — M-PESA attempt storage unavailable; do not resend payment | 503 | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:19` |
| MPESA_TRANSACTIONS_REQUIRED — M-PESA attempts require MongoDB transactions | 503 | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:34` |
| MPESA_NOT_CONFIGURED — M-PESA submission is not configured | 503 | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:39` |
| MPESA_INVOICE_NOT_PAYABLE — Invoice is not payable for the requested amount | 409 | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:44` |
| BILLING_INVOICE_NOT_FOUND — Invoice not found | 404 | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:50` |
| MPESA_ATTEMPT_NOT_FOUND — Payment attempt not found | 404 | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:55` |
| MPESA_BRANCH_NOT_CONFIGURED — M-PESA is not configured for this branch | 409 | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:78` |
| MPESA_IDEMPOTENCY_CONFLICT — Idempotency key was used with different input | 409 | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:84` |
| MPESA_ACTIVE_ATTEMPT_EXISTS — An unresolved attempt already exists or the key conflicts | 409 | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:104` |
| MPESA_MERCHANT_CONFLICT — Merchant configuration changed | 409 | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:129` |
| MPESA_CALLBACK_UNAVAILABLE — M-PESA callback storage temporarily unavailable | 503 | `apps/api/src/modules/mpesa/mpesa-callback.service.ts:15` |
| MPESA_CALLBACK_RATE_LIMITED — Too many callback requests; retry later | 429 | `apps/api/src/modules/mpesa/mpesa-callback.service.ts:44` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/mpesa/mpesa-attempt.schemas.ts`
- `apps/api/src/modules/mpesa/mpesa-callback.schemas.ts`

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
| POST /api/billing/invoices/:id/mpesa-attempts | mpesaAttempts.create | Inline/custom validation; inspect source | `apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:20` |
| GET /api/payments/mpesa/attempts/:id | mpesaAttempts.get | Inline/custom validation; inspect source | `apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:24` |
| POST /api/payments/mpesa/attempts/:id/submit | mpesaAttempts.submit | Inline/custom validation; inspect source | `apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:27` |
| POST /api/payments/mpesa/attempts/:id/correlate | mpesaAttempts.correlatePending | Inline/custom validation; inspect source | `apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:31` |
| POST /api/payments/mpesa/callback | mpesaCallback.checkRateLimit, mpesaCallback.receive | Inline/custom validation; inspect source | `apps/api/src/modules/mpesa/mpesa-callback.routes.ts:9` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

No dedicated current-branch entity contract was established. Source-described fields, such as those in section 6, remain requirements to reconcile. Do not invent a schema from screen labels or prototype data.

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| MpesaSubmissionState | 'CREATED' \| 'SUBMITTING' \| 'PENDING' \| 'UNKNOWN' \| 'REJECTED' | `apps/api/src/modules/mpesa/mpesa-attempt.model.ts:4` |
| transitions (observed transition map) | CREATED: ['SUBMITTING'], SUBMITTING: ['PENDING', 'UNKNOWN', 'REJECTED'], PENDING: [], UNKNOWN: [], REJECTED: [], | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:15` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Billing; Payments; RBAC; Infrastructure.

Observed backend import domains: `auth`, `billing`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/mpesa/mpesa-attempt.service.ts:33` — return executeTransaction(this.repository, async (session) => {

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-MPESA-001 | FR-MPESA-001 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Create a scoped, idempotent attempt for a payable invoice. |
| AC-MPESA-002 | FR-MPESA-002 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Submit once through guarded submission-state transitions. |
| AC-MPESA-003 | FR-MPESA-003 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Read a masked attempt projection after invoice authorization. |
| AC-MPESA-004 | FR-MPESA-004 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Receive callback evidence using the callback service. |
| AC-MPESA-005 | FR-MPESA-005 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Correlate pending callback evidence with its stored attempt. |
| AC-MPESA-006 | FR-MPESA-006 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Keep submission, reported outcome, verification and posting separate. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-MPESA-01: R1 excludes automated M-Pesa integration; later business approval is not established by the retained gap notes.
- GAP-MPESA-02: Current attempt creation sets verification UNVERIFIED and posting DISABLED; callback correlation does not demonstrate invoice settlement.
- GAP-MPESA-03: Confirm production readiness, provider verification, reconciliation, currency/branch eligibility and reversals.
- GAP-MPESA-04: Do not retry an uncertain external submission blindly.
- GAP-MPESA-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/M-Pesa/HMS_MPESA_ATTEMPTS_GAP_NOTE.md` | ea13a884016947007a1086cbbdf629f4284fc002faec192e0bf55eb4f4520575 | Historical design evidence |
| `HMS Project/Design/M-Pesa/HMS_MPESA_STEP5_GAP_NOTE.md` | 7cfce52ce2fd2e0b77eafec537878fa6a0d03e67bd5e10799cab4b4fe0a80918 | Historical design evidence |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/mpesa/mpesa-attempt.service.ts` | 2748ecbf8ba26b7f3dd175d4c16981c40e52c8701511896d4e4567a22b387222 | Current implementation or project rule |
| `apps/api/src/modules/mpesa/mpesa-callback.service.ts` | 5b4c58330f9f92c3e50f743d4262eb998a8cff9f5dd84c56c609cfef5bab6f60 | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/mpesa/mpesa-attempt.model.ts`
- `apps/api/src/modules/mpesa/mpesa-attempt.repository.ts`
- `apps/api/src/modules/mpesa/mpesa-attempt.routes.ts`
- `apps/api/src/modules/mpesa/mpesa-attempt.schemas.ts`
- `apps/api/src/modules/mpesa/mpesa-attempt.service.ts`
- `apps/api/src/modules/mpesa/mpesa-callback.model.ts`
- `apps/api/src/modules/mpesa/mpesa-callback.repository.ts`
- `apps/api/src/modules/mpesa/mpesa-callback.routes.ts`
- `apps/api/src/modules/mpesa/mpesa-callback.schemas.ts`
- `apps/api/src/modules/mpesa/mpesa-callback.service.ts`
- `apps/api/src/modules/mpesa/mpesa-daraja.client.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
