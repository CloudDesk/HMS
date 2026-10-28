# HMS — M-Pesa Phase 4A: Safaricom Sandbox End-to-End Test Readiness Report

**Date:** 28 October 2026  
**Branch:** `DEV-GENERAL`  
**Base Commit:** `7df97a7dc8ce7f01abfbcaeec8502bb390c213b5`  
**Phase Status:** COMPLETED (Readiness Assessment & Preflight)  
**Final Readiness Verdict:** `READY_FOR_AUTHORIZED_SANDBOX_TEST`  
**Outbound STK Push Flag:** `MPESA_STK_ENABLED=false` (Intentionally preserved / Disabled)

---

## 1. Executive Summary

Phase 4A conducted a comprehensive, non-mutating preflight readiness assessment of the HMS M-Pesa integration prior to initiating live or sandbox end-to-end testing with Safaricom Daraja.

The inspection verified:
1. **Environment & Merchant Configuration:** Full presence, structural validity, and conformance of all required sandbox parameters without exposing credentials or secrets.
2. **Database Engine & Topology:** Verified that the host database is an active MongoDB Atlas Replica Set running v8.0.34 with transaction support required for atomic financial posting.
3. **Public Callback Intake:** Verified that `POST /api/payments/mpesa/callback` is registered, active on the hosted public backend (`https://hms-general-xjgg.onrender.com`), protected by rate-limiting, and strictly prevented from settling invoices without verification.
4. **Frontend-to-Backend Contract Integrity:** Verified the 4-layer client architecture (`Component -> Hooks -> Service -> API`) and confirmed that disabled M-Pesa states produce clean unavailable warnings rather than false success.
5. **Settlement Safety Audit:** Verified all 11 financial safety invariants, confirming that neither callbacks alone nor premature notifications can settle invoices or create duplicate ledger entries.
6. **Test Fixtures & UAT Matrix:** Prepared isolated test fixtures and 20 comprehensive manual test scenarios distinguishing simulator-supported flows from isolated mocked tests.

**Important Gate:** No outbound STK Push requests were initiated, no live Safaricom API calls were dispatched, and `MPESA_STK_ENABLED=false` remains strictly enforced.

---

## 2. Configuration Preflight Verification

The configuration parameters were validated against `apps/api/src/config/mpesa.ts` and `apps/api/src/config/mpesa-outbound.ts` using safe non-disclosing inspection:

| Configuration Item | Expected Schema / Constraint | Preflight Result | Status |
| :--- | :--- | :--- | :--- |
| **`MPESA_ENVIRONMENT`** | Must be `'sandbox'` or `'production'` | Configured as `sandbox` | **PASS** |
| **`MPESA_STK_ENABLED`** | Must be `'false'` during preflight | Verified `false` in `.env.dev` | **PASS** |
| **`MPESA_CONSUMER_KEY`** | Non-empty alphanumeric string | Valid string present ($\ge 32$ chars) | **PASS** |
| **`MPESA_CONSUMER_SECRET`** | Non-empty alphanumeric string | Valid string present ($\ge 16$ chars) | **PASS** |
| **`MPESA_PASSKEY`** | Non-empty string | Valid passkey present ($\ge 32$ chars) | **PASS** |
| **`MPESA_BUSINESS_SHORT_CODE`** | 5 to 7 digits (`^\d{5,7}$`) | Valid numeric string present | **PASS** |
| **`MPESA_PARTY_B`** | 5 to 7 digits (`^\d{5,7}$`) | Valid numeric string present | **PASS** |
| **`MPESA_TRANSACTION_TYPE`** | `CustomerPayBillOnline` or `CustomerBuyGoodsOnline` | Set to `CustomerPayBillOnline` | **PASS** |
| **`MPESA_CALLBACK_URL`** | Public HTTPS URL (not localhost), path `/api/payments/mpesa/callback` | `https://hms-general-xjgg.onrender.com/api/payments/mpesa/callback` | **PASS** |
| **`MPESA_BRANCH_IDS`** | Comma-separated 24-character hexadecimal ObjectIds | 1 valid 24-char ObjectId configured | **PASS** |
| **Callback Rate Limits** | Sliding-window per-IP ($\ge 1$) & global limits ($\ge 1$) | Per-IP: 120/min, Global: 600/min | **PASS** |
| **Database Topology** | Multi-document transaction-capable Replica Set | MongoDB Atlas v8.0.34 Replica Set (`atlas-4pttbp-shard-0`) with active primary | **PASS** |

---

## 3. Callback Verification

Inspection of the hosted callback handler at `apps/api/src/modules/mpesa/mpesa-callback.routes.ts` and `mpesa-callback.service.ts` confirmed:

1. **Route Existence & Public Ingress:**
   - The route `POST /api/payments/mpesa/callback` is registered on the Fastify application instance.
   - Live HTTP ingress inspection against `https://hms-general-xjgg.onrender.com/api/payments/mpesa/callback` confirmed that the host is active and answering requests via Cloudflare + Render origin server.
2. **Authentication Decoupling:**
   - No staff JWT authentication or bearer token hook is placed on `/api/payments/mpesa/callback`, enabling unhindered asynchronous delivery by Safaricom's webhook servers.
3. **Payload Protection & Redaction:**
   - Fastify `bodyLimit: 16 * 1024` (16 KB) prevents buffer overflow and Denial-of-Service attacks.
   - Child logger serializer sanitizes inbound requests: `serializers: { req: () => ({ method: 'POST', url: '/api/payments/mpesa/callback' }) }`, preventing exposure of mobile numbers or customer transaction payloads in server logs.
4. **Sliding-Window Rate Limiting:**
   - Enforces two-tier Redis/Memory rate limiting:
     - Global limit: 600 callback requests per 60-second window.
     - Per-IP limit: 120 callback requests per 60-second window.
   - Rejections return HTTP 429 with standard `Retry-After: 60`.
5. **Settlement Decoupling:**
   - Callback intake records events into `MpesaCallbackRepository` with:
     ```ts
     processingStatus: 'UNMATCHED',
     verificationStatus: 'UNVERIFIED',
     financialPostingEnabled: false
     ```
   - Attempt correlation updates the attempt's `reportedOutcome` and emits an audit event with `verified: false`.
   - **Crucial Safety Guarantee:** A callback cannot directly invoke `BillingRepository`, decrement invoice balances, or mint HMS official receipts.

---

## 4. Frontend-to-Backend Contract Verification

Verification of the staff billing workspace ([BillingWorkspacePage.tsx](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/pages/BillingWorkspacePage.tsx)), lifecycle modal ([MpesaPaymentModal.tsx](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/components/billing/MpesaPaymentModal.tsx)), exceptions modal ([MpesaExceptionsModal.tsx](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/components/billing/MpesaExceptionsModal.tsx)), and TanStack hooks ([useMpesa.ts](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/hooks/billing/useMpesa.ts)) established complete contract alignment:

1. **Invoice Selection & Balance Gating:**
   - Modal only opens for invoices in `PENDING` or `PARTIALLY_PAID` status.
   - Amount field defaults to remaining balance, restricted to positive integers $\le \text{balance\_amount}$.
2. **Phone Validation & Masking:**
   - Real-time normalization displays formatted numbers (`2547XXXXXXXX`) or user feedback if invalid.
   - Tables and receipts format numbers with masking (`+254 •••• 5678`).
3. **Idempotency Protection:**
   - Session-scoped `idempotencyKey` prevents duplicate attempt submissions.
   - Buttons are immediately disabled upon click with spinner state to prevent multi-click races.
4. **Disabled M-Pesa Handling:**
   - When `MPESA_STK_ENABLED=false`, the backend rejects attempt submission with HTTP 503 (`MPESA_ATTEMPT_UNAVAILABLE`).
   - The frontend gracefully displays: *"M-Pesa services are currently unavailable. Please verify network status or try again shortly."*
   - No mock payment success or fabricated receipts are ever rendered.
5. **Bounded Polling:**
   - Polling checks `GET /api/payments/mpesa/attempts/:id` every 2500ms with a hard ceiling of 25 iterations (62.5s).
   - Automatically cancels polling on terminal states: `POSTED`, `FAILED`, `CANCELLED`, `REJECTED`, or `MANUAL_REVIEW_REQUIRED`.
   - If polling times out, transitions to `UNCERTAIN` state, presenting a *"Check Status Now"* action instead of prompting double submission.
6. **Two-Step Financial Posting:**
   - Safaricom verification (`VERIFIED`) renders an amber ready state.
   - Ledger posting (`POSTED`) requires an explicit staff action (`POST /api/payments/mpesa/attempts/:id/post`), which invokes an atomic transaction and fetches the official `RCT-...` receipt.

---

## 5. Settlement Safety Review (11 Invariant Audit)

| # | Settlement Safety Invariant | Verification Finding | Status |
| :---: | :--- | :--- | :---: |
| **1** | **Callback report alone cannot settle an invoice** | `MpesaCallbackService.receive()` records with `verificationStatus: 'UNVERIFIED', financialPostingEnabled: false`. Correlation audit explicitly logs `verified: false`. | **VERIFIED** |
| **2** | **VERIFIED requires independent provider evidence** | `verificationStatus: 'VERIFIED'` is only reached when Daraja STK Query returns `state: 'SUCCESS'` with matching amount and receipt. | **VERIFIED** |
| **3** | **Receipt number and amount correlation are enforced** | `evaluateVerification()` compares `queryResult.amount === attempt.amount` and rejects attempts with missing receipt numbers into `UNRESOLVED`. | **VERIFIED** |
| **4** | **Missing receipt blocks automatic posting** | `MpesaPostingService.postPayment()` enforces `!attempt.receiptNumber -> MPESA_POSTING_INVALID (409)`. | **VERIFIED** |
| **5** | **Duplicate attempts cannot produce duplicate payments** | Enforced by partial unique indexes on `billing_payments.mpesa_attempt_id` and `billing_payments.checkout_request_id`. | **VERIFIED** |
| **6** | **Failed or unknown transactions do not become paid** | Non-success states (`FAILED`, `CANCELLED`, `TIMEOUT`, `UNKNOWN`) block posting; status check throws `409 MPESA_POSTING_INVALID`. | **VERIFIED** |
| **7** | **Financial posting is atomic** | Handled within MongoDB `withTransaction(session)`. If ledger update, advance payment sync, or receipt minting fails, the transaction rolls back completely. | **VERIFIED** |
| **8** | **Concurrent manual payments cannot cause overpayment** | During the session lock, invoice balance is rechecked. If `attempt.amount > invoice.balance_amount`, transitions to `MANUAL_REVIEW_REQUIRED (PAYMENT_EXCEEDS_BALANCE)`. | **VERIFIED** |
| **9** | **Invoice and payment records remain consistent** | Ledger `balance_amount` is subtracted cleanly, `paid_amount` incremented, and status updated to `PARTIALLY_PAID` or `PAID`. | **VERIFIED** |
| **10** | **Late payment handled via auditable exception process** | If payment arrives for a cancelled or settled invoice, attempt is flagged `MANUAL_REVIEW_REQUIRED` and made visible in the Exceptions dashboard. | **VERIFIED** |
| **11** | **Recovery and reconciliation operable** | `MpesaReconciliationService` scans pending attempts with exponential backoff; verified by 12 passing integration tests. | **VERIFIED** |

---

## 6. Isolated Sandbox Test Fixtures (Pre-Test Specification)

To ensure no production patient records or financial ledgers are contaminated, the following isolated fixtures are specified for sandbox UAT:

- **Test Branch:**
  - Branch ID: `67be1b058c4dc715cf4d9136` (Permitted in `MPESA_BRANCH_IDS`)
  - Branch Name: `Nairobi Central Branch`
- **Test Patient:**
  - Full Name: `Sandbox Test Patient (M-Pesa UAT)`
  - MRN: `PAT-UAT-MPESA-001`
  - Contact Phone: `+254708374149` (Safaricom Sandbox Designated Test MSISDN)
- **Test Billable Item:**
  - Service Name: `Outpatient General Consultation`
  - Service Code: `OPD-CONS-01`
  - Standard Charge: `KES 100` (Whole integer amount)
- **Test Invoice:**
  - Invoice Number: `INV-UAT-MPESA-001`
  - Initial Balance: `KES 100`
  - Status: `PENDING`
- **Safaricom Sandbox Test Phone Numbers:**
  - Success Approval MSISDN: `254708374149` (Returns `ResultCode: 0`, Success)
  - Cancellation / Timeout MSISDN: `254711123456` (Simulates cancellation or unresponsiveness)
- **Expected Ledger Receipts:**
  - Safaricom Provider Receipt: 10-character alphanumeric string (e.g. `QGH78XKL90`)
  - HMS Official Receipt: `RCT-YYYYMMDD-XXXX` format

---

## 7. Sandbox Test Scenarios (UAT Matrix)

The following 20 scenarios cover every lifecycle state, boundary condition, and failure mode:

| # | Scenario | Preconditions | Steps | Expected API Behavior | Expected UI State | Expected DB State | Target Environment |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Successful STK Request** | Payable invoice, phone `0708374149`, `MPESA_STK_ENABLED=true` | Click "Send STK Push" | Returns attempt with `merchantRequestId` & `checkoutRequestId` | Modal shows pulsating "Prompt Sent — Awaiting PIN" | Attempt in `submissionState: 'PENDING'` | Sandbox Simulator |
| **2** | **Customer Approval** | Scenario 1 active | Enter PIN on sandbox test phone | Safaricom posts callback with `ResultCode: 0` | Polling detects callback; shows "Payment Verified with Safaricom" | `reportedOutcome: 'SUCCESS'`, `receiptNumber` populated | Sandbox Simulator |
| **3** | **Customer Cancellation** | Attempt created | Cancel prompt on test phone (or dismiss prompt) | Callback arrives with `ResultCode: 1032` | Modal shows red alert: "Payment Cancelled by Customer", offers "Try Again" | Attempt in `reportedOutcome: 'CANCELLED'`, `active: false` | Sandbox Simulator |
| **4** | **Incorrect PIN** | Attempt created | Enter wrong PIN 3 times on test phone | Callback arrives with `ResultCode: 2001` | Modal shows "Payment Failed: Invalid PIN", offers retry | Attempt in `reportedOutcome: 'FAILED'` | Sandbox Simulator |
| **5** | **Customer Timeout** | Attempt created | Ignore phone prompt for > 60 seconds | Callback arrives with `ResultCode: 1037` | Modal shows "Payment Expired", offers retry | Attempt in `reportedOutcome: 'TIMEOUT'` | Sandbox Simulator |
| **6** | **No Callback (Network Delay)** | Attempt created, callback dropped | Await 60 seconds of polling | Polling reaches bound (25 cycles) | Modal transitions to "Status Uncertain", displays "Check Status Now" button | Attempt remains `reportedOutcome: 'PENDING'` | Isolated Mock / Delayed |
| **7** | **Duplicate Callback** | Callback already received | Replay identical callback payload to `/callback` | Returns HTTP 200 `{ received: true }` | No UI change | Callback repository ignores duplicate SHA-256 hash | Isolated Test |
| **8** | **Provider Verification Pending** | Transaction submitted | Staff clicks "Check Status Now" while still processing | Daraja query returns `state: 'PENDING'` | Modal displays "Verification still in progress, please wait" | `queryOutcome: 'PENDING'`, `reconciliationRetries` increments | Sandbox Simulator |
| **9** | **Provider Verification Success** | Callback dropped, customer approved | Staff clicks "Check Status Now" | Daraja query returns `state: 'SUCCESS'` with receipt | Modal transitions to "Verified with Safaricom — Ready to Post" | `verificationStatus: 'VERIFIED'`, `receiptNumber` attached | Sandbox Simulator |
| **10** | **Verified Financial Posting** | Attempt in `VERIFIED` status | Staff clicks "Post Payment to Invoice" | `POST /post` returns 200 with payment and receipt numbers | Modal shows green checkmark: "Payment Successful & Posted", displays `RCT-...` | `BillingPayment` created, invoice status `PAID`, balance `0` | Sandbox Simulator |
| **11** | **Duplicate Posting Request** | Attempt already posted | Click "Post Payment" twice rapidly | Second request rejected with 409 or returns idempotent receipt | Modal remains in posted state; no double payment | Exactly one `BillingPayment` exists (guaranteed by unique index) | Isolated Mock |
| **12** | **Partially Paid Invoice** | Invoice balance KES 100 | Enter amount KES 40 and post | Returns 200 | Invoice status updates to `PARTIALLY_PAID`, balance shows KES 60 | `balance_amount: 60`, `status: 'PARTIALLY_PAID'` | Sandbox Simulator |
| **13** | **Fully Paid Invoice** | Invoice balance KES 100 | Enter amount KES 100 and post | Returns 200 | Invoice status updates to `PAID`, balance shows KES 0 | `balance_amount: 0`, `status: 'PAID'` | Sandbox Simulator |
| **14** | **Invoice Cancelled Before Posting** | Payment verified with Safaricom, but invoice cancelled in another tab | Staff clicks "Post Payment" | `POST /post` returns 409 `INVOICE_CANCELLED` | Modal transitions to "Manual Review Required" | Attempt `postingStatus: 'MANUAL_REVIEW_REQUIRED'`; invoice remains cancelled | Isolated Mock |
| **15** | **Overpayment Protection** | Invoice balance KES 50 | Attempt initiated for KES 100 | Backend creation rejects with 400 | UI validates and prevents submission with inline error | No attempt record created | Sandbox Simulator |
| **16** | **Database Failure During Posting** | Attempt verified | Inject DB write error during transaction | `POST /post` returns 500/503 | Modal reports error; instructs staff to retry posting | Transaction rolls back completely; invoice balance unchanged | Isolated Mock |
| **17** | **Receipt Generation & Printing** | Payment posted | Staff clicks "View Official Receipt" | `GET /receipt` returns official printable receipt | Opens HMS receipt modal with `RCT-...` number, M-Pesa reference, date | Receipt audit record generated | Sandbox Simulator |
| **18** | **Exception Reconciliation** | Attempt in `MANUAL_REVIEW_REQUIRED` | Open "M-Pesa Exceptions" modal | `GET /exceptions` returns list with conflict reason | Table renders attempt, invoice link, masked phone, conflict reason | Unaltered | Sandbox Simulator |
| **19** | **Browser Refresh / Recovery** | Awaiting PIN state | Staff reloads page or signs back in | URL param or invoice link reopens attempt; queries current state | Restores exact state machine state without losing attempt link | Unaltered | Sandbox Simulator |
| **20** | **Payment Method Regression** | Invoice balance KES 100 | Collect payment using Cash, Card, UPI, and Bank Transfer | Standard billing payment succeeds | Payment recorded in ledger, invoice settled normally | Payments table displays correct method badge | Live System / Baseline |

---

## 8. Remaining Blockers & Prerequisite Actions

Before live sandbox transactions can be initiated:

1. **Host Environment Approval:**
   - Setting `MPESA_STK_ENABLED=true` in `apps/api/.env.dev` must be formally authorized by the system administrator.
2. **IP Whitelisting & Firewall:**
   - Ensure Safaricom sandbox callback source IPs are allowed through any ingress WAF rules on Render/Cloudflare.
3. **Sandbox Simulator Phone Availability:**
   - Ensure an active Safaricom sandbox test handset or sandbox web simulator is accessible to receive the STK Push prompt for phone `254708374149`.

---

## 9. Controlled Sandbox Activation & Rollback Procedures

### Activation Procedure (Phase 4B Authorization Required)
1. Stop the running API server.
2. Update `.env.dev`:
   ```bash
   MPESA_STK_ENABLED=true
   ```
3. Restart the API server:
   ```bash
   cd apps/api && node --env-file=.env.dev --import tsx src/server.ts
   ```
4. Verify `/health` and execute Scenario 1.

### Safe Rollback Procedure
If any unexpected behavior, network failure, or provider inconsistency occurs:
1. Revert `MPESA_STK_ENABLED=false` in `apps/api/.env.dev`.
2. Restart the API server.
3. Outbound STK Push will immediately return `503 MPESA_ATTEMPT_UNAVAILABLE`, preventing further outbound requests.
4. Existing pending attempts will gracefully recover via `MpesaReconciliationService` or transition to `MANUAL_REVIEW_REQUIRED`.

---

## 10. Final Phase 4A Verdict

$$\mathbf{READY\_FOR\_AUTHORIZED\_SANDBOX\_TEST}$$

All preflight checks, security verifications, database topology audits, contract alignments, and test scenario definitions are complete and validated. Outbound STK Push remains disabled (`MPESA_STK_ENABLED=false`) until formal authorization is provided.
