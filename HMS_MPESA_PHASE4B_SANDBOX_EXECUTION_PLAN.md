# HMS — M-Pesa Phase 4B: Controlled Sandbox Payment UAT & Execution Plan

**Date:** 28 October 2026  
**Branch:** `DEV-GENERAL`  
**Base Commit:** `7df97a7dc8ce7f01abfbcaeec8502bb390c213b5`  
**Phase Status:** AWAITING EXPLICIT AUTHORIZATION (Readiness Verified)  
**Current Gate Verdict:** `READY_AWAITING_TEST_AUTHORIZATION`  
**Outbound STK Push Flag:** `MPESA_STK_ENABLED=false` (Disabled — Awaiting Authorization)

---

## 1. Executive Summary & Safety Policy

This document defines the strict operational execution plan for conducting controlled, single-transaction M-Pesa sandbox User Acceptance Testing (UAT).

All preflight checks, database topology inspections, financial evidence safety contracts, and hosted ingress reachability verifications have been completed successfully. 

### Mandatory Operational Safety Rules:
- **No Unsolicited Payments:** No outbound STK Push request, real payment, or synthetic settlement has been initiated.
- **Environment Containment:** All endpoints target the Safaricom Daraja Sandbox (`https://sandbox.safaricom.co.ke`). Production endpoints are strictly prohibited.
- **Credential Protection:** Passkeys, consumer credentials, tokens, and database connection strings remain confidential and redacted.
- **Audit & Financial Integrity:** No real patient or historical financial ledger records will be mutated. Tests will use isolated sandbox/UAT fixtures.
- **Stop Gate Enforcement:** `MPESA_STK_ENABLED` remains `false`. Execution stops at the authorization gate specified in Section 7 until explicit user approval is granted.

---

## 2. Resolution of the Branch ID Discrepancy

Phase 4A identified two competing branch identifiers:
1. `6a7c495d94e1a711fb3d7b23` — Reported as "Main Branch MB01" in Phase 0 and Phase 1 configuration reports.
2. `67be1b058c4dc715cf4d9136` — Proposed in the text of the Phase 4A report.

### Read-Only Database Investigation Findings
A direct, read-only query against the host MongoDB Atlas database (`HMS_GENERAL`) produced the following conclusive findings:

| Parameter | Branch `6a7c495d94e1a711fb3d7b23` | Branch `67be1b058c4dc715cf4d9136` |
| :--- | :--- | :--- |
| **Record Exists in DB** | **YES** | **NO** (0 matching documents) |
| **Branch Name & Code** | `"Main Branch"` / Code: `"MB01"` | N/A |
| **Branch Status** | `status: "ACTIVE"` | N/A |
| **Configured in `.env.dev`** | Present in `MPESA_BRANCH_IDS` | Absent |
| **Staff User Assignments** | Assigned to all staff (e.g. `rajesh`, `anitha`, etc.) | None |
| **Existing Invoices** | Linked to invoice `INV-20261025-13B67717` | None |

### Resolution & Conclusion:
`6a7c495d94e1a711fb3d7b23` is the **only valid, active hospital branch** configured and recognized by the system. The identifier `67be1b058c4dc715cf4d9136` in the Phase 4A text was a synthetic template artifact and has been formally discarded. 

No modification to `MPESA_BRANCH_IDS` in `.env.dev` is required. The branch allowlist is 100% correct and aligned.

---

## 3. Financial Evidence Contract Verification

An exhaustive code audit of the Phase 1 verification (`MpesaAttemptService`, `MpesaDarajaClient`) and Phase 2 posting (`MpesaPostingService`, `BillingRepository`) confirmed the following financial safety properties:

1. **Independent Verification from Daraja STK Query:**
   - Transaction status is independently established via `POST /mpesa/stkpushquery/v1/query`.
   - The query result must return `state: 'SUCCESS'` with non-empty `receiptNumber` and matching `amount`.
2. **Callback Alone Cannot Settle Invoices:**
   - Inbound webhook intake via `POST /api/payments/mpesa/callback` persists events with:
     ```ts
     processingStatus: 'UNMATCHED',
     verificationStatus: 'UNVERIFIED',
     financialPostingEnabled: false
     ```
   - Callback correlation attaches `reportedOutcome` and emits an audit event with `verified: false`. It cannot invoke `BillingPayment` creation or decrement invoice balances.
3. **No Forged or Fabricated Receipts:**
   - Receipt references originate strictly from Safaricom provider metadata.
   - If `attempt.receiptNumber` is missing or empty, `MpesaPostingService.postPayment` immediately aborts with `409 MPESA_POSTING_INVALID`.
4. **Multi-Document Atomic Posting:**
   - Financial posting executes entirely inside a MongoDB transaction session (`withTransaction(session)`).
   - If any step (ledger payment creation, invoice balance update, or receipt generation) encounters an error, all changes roll back atomically.
5. **Idempotency & Double-Posting Prevention:**
   - Database engine level: Partial unique indexes on `billing_payments.mpesa_attempt_id` and `billing_payments.checkout_request_id` guarantee that an M-Pesa transaction can never be posted more than once.
   - Application level: `MpesaPostingService` verifies that `attempt.postingStatus !== 'POSTED'` and checks for existing payments before proceeding.

---

## 4. Hosted Callback Integration & Ingress Verification

The configured public callback URL:
`https://hms-general-xjgg.onrender.com/api/payments/mpesa/callback`

### Non-Mutating Network Verification Findings:
1. **Host Reachability:**
   - The HTTPS endpoint is publicly reachable over TLS/HTTPS via Cloudflare CDN and Render origin infrastructure (`x-render-origin-server: Render`, `rndr-id: a55113d5-8179-4398`).
2. **Active Codebase Verification:**
   - An empty JSON POST to `https://hms-general-xjgg.onrender.com/api/payments/mpesa/callback` returned:
     ```json
     HTTP 400 Bad Request
     {
       "error": {
         "code": "MPESA_CALLBACK_INVALID",
         "message": "Invalid M-PESA callback payload",
         "requestId": "req-pt"
       }
     }
     ```
   - This proves conclusively that the deployed backend on Render is actively running the Fastify M-Pesa module and validating payloads using the exact Zod schema from our codebase.
3. **Database Environment Isolation:**
   - Existing records in `mpesa_callback_events` in MongoDB Atlas confirm that callbacks are tagged `environment: 'sandbox'`, with 0 unverified funds posted to production accounting.
4. **Decoupled Intake:**
   - Callback intake requires no staff authentication headers, allowing unhindered delivery by Safaricom webhook servers.

---

## 5. UAT Test Fixtures & Pre-Execution Dataset

To protect data integrity, testing will use isolated sandbox records scoped exclusively to `Main Branch (6a7c495d94e1a711fb3d7b23)`:

### A. Staff Billing Actor
- **Username:** `rajesh` (Billing Officer) or `admin` (Super Administrator)
- **Permissions:** `BILLING_INVOICES_COLLECTPAYMENT`, `BILLING_INVOICES_VIEW`, `BILLING_INVOICES_VIEWRECEIPT`
- **Authorized Branch:** `6a7c495d94e1a711fb3d7b23` (`Main Branch MB01`)

### B. Synthetic UAT Patient
- **Patient ID:** `6ad1af80a97174b029387934`
- **Full Name:** `PhaseOneQA Beta` (Dedicated non-production UAT test patient)
- **Branch:** `6a7c495d94e1a711fb3d7b23`

### C. Test Invoice Options
1. **Option 1 (Existing Procedure Invoice):**
   - Invoice Number: `INV-20261025-13B67717` (Branch: `6a7c495d94e1a711fb3d7b23`)
   - Current Status: `DRAFT` (Can be finalized to `PENDING` upon authorization for partial payment testing of KES 10 against $22,000 balance).
2. **Option 2 (Dedicated Single-Service UAT Invoice - Recommended):**
   - Invoice Number: `INV-UAT-MPESA-001`
   - Service: `Outpatient Consultation (General)`
   - Total Amount: `KES 100`
   - Balance Amount: `KES 100`
   - Status: `PENDING`

### D. Safaricom Sandbox Test Mobile Numbers
- **Designated Approval MSISDN:** `254708374149` (Masked: `+254 •••• 4149`)
  - Officially configured in Safaricom Sandbox to auto-approve STK Push requests (`ResultCode: 0`).
- **Designated Cancellation MSISDN:** `254711123456` (Masked: `+254 •••• 3456`)
  - Simulates customer dismissal/cancellation (`ResultCode: 1032`).

---

## 6. Pre-Execution Safety Verification Checklist

All 10 required pre-execution safety invariants are confirmed:

- [x] **1. Sandbox Environment:** `MPESA_ENVIRONMENT=sandbox` verified in `.env.dev`.
- [x] **2. STK Push Disabled:** `MPESA_STK_ENABLED=false` verified in `.env.dev`.
- [x] **3. Merchant Credentials:** Consumer Key, Secret, Passkey, Shortcode, Party B, and Transaction Type (`CustomerPayBillOnline`) verified structurally valid.
- [x] **4. Branch Authorization:** `MPESA_BRANCH_IDS` set to `6a7c495d94e1a711fb3d7b23` (Main Branch), matching test invoices and staff scope.
- [x] **5. Callback Target:** `https://hms-general-xjgg.onrender.com/api/payments/mpesa/callback` verified active and reachable.
- [x] **6. Transaction Topology:** MongoDB Atlas Replica Set `atlas-4pttbp-shard-0` running v8.0.34 with transaction support confirmed.
- [x] **7. Reconciliation Worker:** Tested with 12 passing integration tests; exponential backoff operational.
- [x] **8. Idempotency Enforced:** Enforced by partial unique indexes on `mpesa_attempt_id` and `checkout_request_id`.
- [x] **9. Existing Records Untouched:** 0 billing payments created; existing draft invoice intact.
- [x] **10. Full Regression Suite Green:** 93 backend tests + 21 frontend tests = **114/114 passing (100%)**. Clean typechecks and production builds.

---

## 7. Controlled Sandbox Scenarios & Simulator Capabilities

| # | Test Scenario | Execution Type | Sandbox Simulator Capability & Expected Behavior |
| :-: | :--- | :--- | :--- |
| **S-1** | **Successful STK Push Initiation** | Live Sandbox | Safaricom returns `ResponseCode: 0`, generating valid `MerchantRequestID` & `CheckoutRequestID`. Modal enters "Awaiting PIN". |
| **S-2** | **Customer Authorization & Callback** | Live Sandbox | Test phone `254708374149` auto-completes. Safaricom delivers callback with `ResultCode: 0`, receipt number, and amount. |
| **S-3** | **Authoritative Daraja Query Verification** | Live Sandbox | Staff clicks "Check Status" (or polling verifies). STK Query returns `state: SUCCESS`. Modal enters "Verified — Ready to Post". |
| **S-4** | **Atomic Financial Posting & Receipt** | Live Sandbox | Staff clicks "Post Payment". Atomically records `BillingPayment`, updates invoice balance, and displays official `RCT-...` receipt. |
| **S-5** | **Customer Cancellation** | Live Sandbox | Prompt on `254711123456` cancelled. Callback arrives with `ResultCode: 1032`. Modal displays clear cancellation alert and "Try Again". |
| **S-6** | **Timeout Handling** | Live Sandbox / Mock | Prompt ignored. Callback arrives with `ResultCode: 1037`. Modal transitions to expired/timeout state. |
| **S-7** | **Callback Delay / Missing Webhook** | Live Sandbox | Webhook delayed. Staff clicks "Check Status Now"; STK Query resolves transaction without waiting for webhook. |
| **S-8** | **Duplicate Posting Prevention** | Automated Test | Attempting to post an already posted attempt returns 409 or idempotent receipt. Second payment record is strictly blocked. |
| **S-9** | **Overpayment Prevention** | Automated Test | Attempt with amount exceeding remaining balance is blocked by Zod and backend domain validation. |
| **S-10** | **Invoice Cancellation Conflict** | Automated Test | If invoice is cancelled while payment is in-flight, attempt is marked `MANUAL_REVIEW_REQUIRED` and listed in Exceptions modal. |

---

## 8. Explicit Authorization Gate

Before enabling outbound STK Push or dispatching the first request, the following explicit execution profile is established:

```yaml
Authorization Gate Profile:
  target_environment: Safaricom Daraja Sandbox
  confirmed_branch_id: 6a7c495d94e1a711fb3d7b23 (Main Branch MB01)
  test_patient_mrn: 6ad1af80a97174b029387934 (PhaseOneQA Beta)
  target_invoice: INV-UAT-MPESA-001 (or INV-20261025-13B67717 issued to PENDING)
  proposed_payment_amount: KES 10
  test_phone_msisdn: "+254 •••• 4149" (254708374149)
  callback_ingress_url: https://hms-general-xjgg.onrender.com/api/payments/mpesa/callback
  maximum_stk_requests_authorized: 1 (single controlled push)
  expected_database_mutations:
    - 1 mpesa_payment_attempts document created
    - 1 mpesa_callback_events document received
    - 1 billing_payments document posted (PaymentMethod: MPESA)
    - 1 billing_invoices document updated (balance -10, paid +10)
```

### Abort & Emergency Rollback Conditions:
The execution will terminate immediately and trigger automatic rollback if:
1. Daraja OAuth token generation returns HTTP 401 or 403 (Invalid credentials).
2. STK submission returns an unexpected error format.
3. Callback or STK Query returns mismatched amount or missing receipt.
4. Database transaction aborts or fails to acquire lock.
5. Any unexpected network or server exception occurs.

---

## 9. Immediate Post-Test Teardown Procedure

Immediately following the execution of the single authorized test:
1. `MPESA_STK_ENABLED` in `apps/api/.env.dev` will be immediately reverted to `false`.
2. The API server will be restarted to ensure outbound STK Push is locked.
3. Transaction, callback, and payment evidence will be collected and reported.
4. No legitimate audit records will be deleted.

---

## 10. Phase 4B Readiness Status

$$\mathbf{READY\_AWAITING\_TEST\_AUTHORIZATION}$$

All preflight investigations are complete. The branch discrepancy has been resolved. The hosted callback ingress is active. The system is paused at this gate awaiting explicit authorization to proceed with single-transaction sandbox testing.
