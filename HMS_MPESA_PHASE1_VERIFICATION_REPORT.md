# HMS — M-Pesa Phase 1: Daraja Verification, Reconciliation & Recovery Report

## Executive Summary

Phase 1 of the M-Pesa integration has been successfully implemented on branch `DEV-GENERAL` (commit `7df97a7dc8ce7f01abfbcaeec8502bb390c213b5`). This phase extends the existing durable M-Pesa backend with authoritative transaction status verification via Safaricom Daraja STK Push Query (`/mpesa/stkpushquery/v1/query`), multi-worker-safe lease-based reconciliation, automatic recovery with exponential backoff, and strict conflict detection.

All 52 pre-existing M-Pesa tests continue to pass without regression. With the addition of 20 new tests (8 Daraja query client unit tests and 12 comprehensive integration tests), the test suite now comprises **72 passing tests across 6 suites**.

**Strict Financial Safety Invariant:** Financial posting remains completely disabled (`postingStatus: 'DISABLED'`). No billing payment ledger records (`BillingPayment`) were created, and invoice amounts (`paidAmount`, `balanceAmount`) remain unmutated throughout all verification and reconciliation operations.

---

## 1. Branch & Environment Baseline

- **Active Branch:** `DEV-GENERAL`
- **Base Commit:** `7df97a7dc8ce7f01abfbcaeec8502bb390c213b5`
- **Environment:** `sandbox` (`MPESA_ENVIRONMENT=sandbox`, `MPESA_STK_ENABLED=false`)
- **Isolation:** Tests run exclusively against ephemeral `MongoMemoryReplSet` replica-set instances and mocked Safaricom HTTP transports; zero live Safaricom API calls or production database modifications occurred.

---

## 2. Architecture & Implementation Summary

### 2.1 Daraja STK Push Query (`MpesaDarajaClient.query`)
Implemented official Safaricom Daraja STK Push Query contract:
- **Endpoint:** `POST /mpesa/stkpushquery/v1/query`
- **Request Payload:** Strictly validated `BusinessShortCode`, `Password` (`base64(BusinessShortCode + passkey + timestamp)`), `Timestamp` (Nairobi timezone `yyyyMMddHHmmss`), and `CheckoutRequestID`.
- **Response Parsing & Error Classification:**
  - `ResultCode === 0`: `SUCCESS` (Transaction completed successfully)
  - `ResultCode === 1032`: `CANCELLED` (User cancelled transaction on mobile handset)
  - `ResultCode === 1037`: `TIMEOUT` (User phone unreachable or prompt timed out)
  - Other non-zero `ResultCode`: `FAILED` (e.g. insufficient funds, expired PIN)
  - Provider in-process message (`errorCode: '500.001.1001'` or "being processed"): `PENDING`
  - HTTP `5xx`, `408`, or network timeouts: `UNKNOWN` (`PROVIDER_UNCERTAIN`, never assuming failure or success)
  - Missing `checkoutRequestId`: safely rejected upfront with `MISSING_CHECKOUT_REQUEST_ID` without making a network call.

### 2.2 Attempt Model & Index Extensions (`mpesa-attempt.model.ts`)
The `MpesaAttempt` data model was extended to maintain distinct, un-conflated dimensions:
1. `reportedOutcome`: Callback-reported outcome (`PENDING` | `SUCCESS` | `FAILED` | `CANCELLED` | `TIMEOUT`).
2. `queryOutcome`: Daraja query result (`NONE` | `PENDING` | `SUCCESS` | `FAILED` | `CANCELLED` | `TIMEOUT` | `UNKNOWN`).
3. `verificationStatus`: Evaluated evidence state (`UNVERIFIED` | `VERIFIED` | `FAILED` | `CONFLICT` | `UNRESOLVED`).
4. `postingStatus`: Financial ledger posting status (strictly `DISABLED`).

**New Evidence & Reconciliation Tracking Fields:**
- `verificationSource`: `'QUERY' | 'CALLBACK' | 'MANUAL_REVIEW' | 'RECONCILIATION'`
- `verificationAttempts`: Counter tracking verification queries.
- `lastVerifiedAt`: Timestamp of last verification attempt.
- `lastQueryResult`: Subdocument `{ state, resultCode, resultDesc, queriedAt }`.
- `conflictingEvidence`: Detailed reason string if discrepancy is identified.
- `recoveryStatus`: `'NONE' | 'IN_RECOVERY' | 'RESOLVED' | 'MANUAL_REVIEW_REQUIRED' | 'ABANDONED'`.
- `nextReconciliationAt`: Scheduled timestamp for eligible backoff retries.
- `reconciliationClaimedAt` / `reconciliationClaimedBy`: Atomic lease acquisition fields.
- `reconciliationRetries`: Bounded counter (maximum 5 retries).

**Compound & Partial Indexes Added:**
- `{ active: 1, nextReconciliationAt: 1, recoveryStatus: 1 }`: Optimized for background reconciliation queue sweeps.
- `{ branchId: 1, verificationStatus: 1, createdAt: -1 }`: Optimized for branch-scoped staff queries.
- Preserved existing partial unique indexes: `{ invoiceId: 1, environment: 1 }` (where `active: true`) and `{ environment: 1, checkoutRequestId: 1 }`.

### 2.3 Single-Worker Atomic Lease & Reconciliation Engine (`mpesa-attempt.repository.ts`)
- **Atomic Lease:** Implemented `claimForReconciliation(environment, workerId, leaseDurationMs = 60_000)` using MongoDB `findOneAndUpdate` with lease expiration safeguards (`reconciliationClaimedAt < now - 60s`), guaranteeing that across multiple workers or clusters, exactly one worker can claim and process an attempt at a time.
- **Candidate Selection:**
  - Attempts in `SUBMITTING` state stuck for > 30 seconds.
  - Attempts in `UNKNOWN` state.
  - Attempts in `PENDING` state with `verificationStatus: 'UNVERIFIED'` whose `nextReconciliationAt <= now` (or null).
  - Excludes attempts in terminal states: `MANUAL_REVIEW_REQUIRED`, `RESOLVED`, or `ABANDONED`.
  - Excludes attempts that have exhausted 5 retries.
- **Exponential Backoff:** If a queried attempt remains in `PENDING` or `UNKNOWN`, scheduled retry delay uses bounded exponential backoff: `min(300s, 15s * 2^retries)`. Upon reaching 5 retries, the attempt transitions automatically to `recoveryStatus: 'MANUAL_REVIEW_REQUIRED'` and `verificationStatus: 'UNRESOLVED'`.

### 2.4 Conservative Verification & Conflict Policy (`mpesa-attempt.service.ts`)
- **Authoritative Success:** An attempt transitions to `VERIFIED` if and only if Daraja query confirms `ResultCode === 0`, all request identifiers match, invoice state remains payable (`PENDING` or `PARTIALLY_PAID`) in the correct branch and patient, and no conflicting evidence exists.
- **Conflict Handling:**
  - If callback reported `FAILED` but query reports `SUCCESS`: marked `CONFLICT`, `recoveryStatus: 'MANUAL_REVIEW_REQUIRED'`, `conflictingEvidence: 'CALLBACK_FAILED_BUT_QUERY_SUCCESS'`.
  - If callback reported `SUCCESS` but query reports `FAILED`: marked `CONFLICT`, `recoveryStatus: 'MANUAL_REVIEW_REQUIRED'`, `conflictingEvidence: 'CALLBACK_SUCCESS_BUT_QUERY_FAILED'`.
  - Stored `active: true` is retained for `CONFLICT` and `VERIFIED` records; for confirmed `FAILED` or `CANCELLED` records, `active: false` is released atomically so patients and staff can retry payment.
- **Missing Checkout ID:** Attempts stuck without a `checkoutRequestId` cannot be sent to Daraja and are flagged for manual review with audit trail `mpesa.reconciliation.manual_review_needed`.

### 2.5 Authorized Staff HTTP API Endpoints (`mpesa-attempt.routes.ts`)
All endpoints are authenticated, rate-limited, branch-scoped, and audit-logged:
1. `POST /api/payments/mpesa/attempts/:id/verify`:
   - Permission: `Billing.Invoices.CollectPayment`
   - Scopes attempt and invoice to the user's permitted branch; queries Daraja status, updates evidence in an atomic MongoDB transaction, and returns the verified attempt view.
2. `GET /api/payments/mpesa/attempts`:
   - Permission: `Billing.Invoices.View`
   - Scopes queries to user's assigned branches; supports pagination (`page`, `limit`), filtering by `invoiceId`, `submissionState`, `verificationStatus`, and `unresolvedOnly`. Payer phone is masked (`********XXXX`).
3. `POST /api/payments/mpesa/reconcile`:
   - Permission: `Billing.Invoices.CollectPayment`
   - Triggers on-demand reconciliation of eligible attempts up to requested `limit` (default 10, max 50); returns `{ processed, resolved, unresolved, conflicts }`.

---

## 3. Files Modified & Added

| File | Status | Description |
|---|---|---|
| `apps/api/src/modules/mpesa/mpesa-daraja.client.ts` | Modified | Added STK Push Query (`/mpesa/stkpushquery/v1/query`), timeout handling, error mapping, and result types. |
| `apps/api/src/modules/mpesa/mpesa-attempt.model.ts` | Modified | Added verification/reconciliation fields, enums, subdocuments, and compound/partial indexes. |
| `apps/api/src/modules/mpesa/mpesa-attempt.repository.ts` | Modified | Added `updateVerification()`, atomic lease `claimForReconciliation()`, and branch-scoped `list()`. |
| `apps/api/src/modules/mpesa/mpesa-attempt.schemas.ts` | Modified | Added Zod validation schemas for `listAttemptsQuerySchema` and `reconcileOptionsSchema`. |
| `apps/api/src/modules/mpesa/mpesa-attempt.service.ts` | Modified | Added `verify()`, `evaluateVerification()`, `reconcileSingle()`, `reconcileEligible()`, `list()`, and extended `view()`. |
| `apps/api/src/modules/mpesa/mpesa-attempt.routes.ts` | Modified | Registered `POST /:id/verify`, `GET /`, and `POST /reconcile` with permissions and rate-limits. |
| `apps/api/src/modules/mpesa/mpesa-daraja.client.test.ts` | Modified | Added 8 comprehensive unit tests for `MpesaDarajaClient.query()`. |
| `apps/api/src/modules/mpesa/mpesa-reconciliation.integration.test.ts` | Created | Added 12 end-to-end integration tests covering concurrency, reconciliation, conflicts, rollbacks, and RBAC. |

---

## 4. Test Verification Results

### 4.1 Test Suites Executed

```bash
npx vitest run apps/api/src/config/mpesa-outbound.test.ts \
               apps/api/src/modules/mpesa/mpesa-daraja.client.test.ts \
               apps/api/src/modules/mpesa/mpesa-callback.test.ts \
               apps/api/src/modules/mpesa/mpesa-callback.integration.test.ts \
               apps/api/src/modules/mpesa/mpesa-attempt.integration.test.ts \
               apps/api/src/modules/mpesa/mpesa-reconciliation.integration.test.ts
```

**Results:**
- `mpesa-outbound.test.ts`: 8 tests passed
- `mpesa-daraja.client.test.ts`: 15 tests passed (7 baseline + 8 new query tests)
- `mpesa-callback.test.ts`: 15 tests passed
- `mpesa-callback.integration.test.ts`: 5 tests passed
- `mpesa-attempt.integration.test.ts`: 17 tests passed
- `mpesa-reconciliation.integration.test.ts`: 12 tests passed (all new)
- **Total:** **72 passed (100%) across 6 test files in 53.07s**

### 4.2 Typecheck & Linter Status

- `npm run typecheck --workspace=@hms/api`: **PASSED (0 errors, code 0)**
- `npx eslint apps/api/src/modules/mpesa apps/api/src/config/mpesa.ts apps/api/src/config/mpesa-outbound.ts`: **PASSED (0 errors, 0 warnings, code 0)**

---

## 5. Security & Isolation Confirmations

1. **Financial Posting Disabled:** Confirmed that `postingStatus` is strictly `'DISABLED'` across all records. No ledger records or balance updates occur in Phase 1.
2. **Credential Safety:** Passkeys, consumer secrets, and bearer tokens are never persisted in attempt records, never returned in API responses, and never logged.
3. **Payer Privacy:** Payer phone numbers are masked in all staff read operations (`payerPhoneMasked: '********0001'`).
4. **Branch Isolation:** Cross-branch attempts and queries are rejected with `404` or scoped out of result sets according to user permissions.
5. **No Outbound STK Pushes:** Outbound STK pushes remain disabled (`MPESA_STK_ENABLED=false`).
6. **No Production Calls:** All tests utilized mocked transport and isolated in-memory replica sets.

---

## 6. Readiness for Phase 2

Phase 1 verification, recovery, and reconciliation capabilities are verified and complete. The backend is now fully prepared for Phase 2 (Financial Ledger Posting & Settlement), which will introduce:
- Atomic billing ledger posting (`BillingPayment` record creation) upon validated `VERIFIED` status.
- Invoice balance and status updates (`PAID` / `PARTIALLY_PAID`) within a MongoDB transaction.
- Official receipt generation and printing integration.
- Controlled sandbox verification with Safaricom sandbox test numbers.
