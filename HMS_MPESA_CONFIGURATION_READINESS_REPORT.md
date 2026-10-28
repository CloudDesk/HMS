# HMS — M-Pesa Configuration Validation & Sandbox Readiness Report

**Audit Date:** 28 October 2026  
**Audited Branch:** `DEV-GENERAL`  
**Commit Revision:** `7df97a7dc8ce7f01abfbcaeec8502bb390c213b5`  
**Assessment Scope:** Configuration verification, merchant credential validation, backend architecture inspection, automated test verification, and sandbox readiness assessment.  

---

## 1. Executive Summary

A comprehensive, secret-safe audit of the M-Pesa subsystem on branch `DEV-GENERAL` was conducted. All required environment configuration variables for Daraja Lipa Na M-Pesa Online (STK Push) have been collected and configured in `apps/api/.env.dev`.

### Key Findings
1. **Configuration Validity:** All 10 required environment variables and 2 optional callback rate-limit settings are present and conform strictly to the Zod schemas in `apps/api/src/config/mpesa.ts` and `apps/api/src/config/mpesa-outbound.ts`.
2. **Safety Flag:** `MPESA_STK_ENABLED=false` is currently set. This is confirmed to be an **intentional safety disablement**, preventing unintended live or test outbound HTTP traffic during deployment, not a missing credential.
3. **Simulated Readiness:** When simulated with `MPESA_STK_ENABLED=true`, the merchant configuration parses with zero validation errors.
4. **Branch Mapping:** The configured branch ObjectId in `MPESA_BRANCH_IDS` is valid and matches the active database record for **Main Branch (`MB01`)**.
5. **No Client-Side Leakage:** Zero M-Pesa credentials, passkeys, consumer secrets, or environment variables are referenced or exposed in client applications (`apps/web`, `apps/patient-web`, `apps/patient-mobile`).
6. **Backend Foundation:** Complete Daraja HTTP client, public rate-limited callback receiver with durable deduplication, authenticated staff payment attempt lifecycle, and replica-set transactional correlation are implemented.
7. **Intentional Boundary:** Financial posting is explicitly disabled (`postingStatus: 'DISABLED'`, `financialPostingEnabled: false`). No M-Pesa event currently settles an invoice balance, creates a `billing_payments` record, or generates an HMS financial receipt.
8. **Automated Tests:** All 5 relevant test suites (52 tests) passed completely in isolated test environments with zero failures.

---

## 2. Phase 1 — Environment & Merchant Configuration Verification

### Configuration Parsers Inspected
- `apps/api/src/config/mpesa.ts` (`parseMpesaConfiguration`)
- `apps/api/src/config/mpesa-outbound.ts` (`parseMpesaOutboundConfiguration`)
- `apps/api/src/config/env.ts` (wiring to `process.env`)

### Secret-Safe Variable Audit Table

| Environment Variable | Presence | Syntax / Schema Check | Safe Observation / Classification |
| :--- | :--- | :--- | :--- |
| `MPESA_ENVIRONMENT` | **PRESENT** | Valid enum: `sandbox` \| `production` | Configured as `sandbox` (Safaricom Sandbox API) |
| `MPESA_STK_ENABLED` | **PRESENT** | Valid boolean string: `true` \| `false` | Configured as `false` (**Intentionally disabled** for safety) |
| `MPESA_CONSUMER_KEY` | **PRESENT** | `z.string().min(1)` | Populated non-empty string (48 characters) |
| `MPESA_CONSUMER_SECRET` | **PRESENT** | `z.string().min(1)` | Populated non-empty string (64 characters) |
| `MPESA_PASSKEY` | **PRESENT** | `z.string().min(1)` | Populated non-empty string (64 characters) |
| `MPESA_BUSINESS_SHORT_CODE` | **PRESENT** | `z.string().regex(/^\d{5,7}$/)` | Valid 6-digit numeric Paybill/Till shortcode |
| `MPESA_PARTY_B` | **PRESENT** | `z.string().regex(/^\d{5,7}$/)` | Valid 6-digit numeric shortcode matching Party B requirements |
| `MPESA_TRANSACTION_TYPE` | **PRESENT** | `z.enum(['CustomerPayBillOnline', 'CustomerBuyGoodsOnline'])` | Set to `CustomerPayBillOnline` |
| `MPESA_CALLBACK_URL` | **PRESENT** | Public HTTPS URL, path `/api/payments/mpesa/callback` | Valid HTTPS URL, public host, correct endpoint, no credentials/query/hash |
| `MPESA_BRANCH_IDS` | **PRESENT** | Array of 24-character hexadecimal ObjectIds | 1 branch ID; matches active database `MB01` (Main Branch) |
| `MPESA_CALLBACK_PER_IP_LIMIT` | **PRESENT** | Integer `min(1).max(10000)` | 120 requests/minute per client IP |
| `MPESA_CALLBACK_GLOBAL_LIMIT` | **PRESENT** | Integer `min(1).max(100000)` | 600 requests/minute global callback limit |

*Note: In accordance with security rules, no credentials, secrets, passkeys, or private endpoint hosts are printed.*

---

## 3. Phase 2 — Merchant Configuration & Client Exposure Analysis

1. **Target Environment:** Configured to `sandbox`, targeting `https://sandbox.safaricom.co.ke`.
2. **Shortcode & Party B Consistency:** Both `MPESA_BUSINESS_SHORT_CODE` and `MPESA_PARTY_B` are 6-digit numeric strings conforming to Safaricom Paybill specifications.
3. **Transaction Type:** `CustomerPayBillOnline` is valid for Paybill STK push flows.
4. **Credential Completeness:** All three authentication factors (`MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, and `MPESA_PASSKEY`) are populated.
5. **Callback Route Conformance:**
   - URL protocol is strictly `https:`.
   - Hostname is a non-localhost public domain.
   - Pathname matches exactly `/api/payments/mpesa/callback`.
   - Contains no user credentials, query strings, or hash fragments.
6. **Branch Authorization Allowlist:**
   - Configured branch string is a 24-character hexadecimal MongoDB ObjectId.
   - Verified against the live HMS database: matches the active **Main Branch (`MB01`)**.
   - `MpesaAttemptService.create` enforces that invoices belonging to unlisted branches are rejected with `409 MPESA_BRANCH_NOT_CONFIGURED`.
7. **Client-Side Secret Screening:**
   - Static analysis across `apps/web/src`, `apps/patient-web/src`, and `apps/patient-mobile` found **zero** occurrences of M-Pesa secrets, consumer keys, or passkeys.
   - No frontend `.env` files contain M-Pesa credentials.

---

## 4. Phase 3 — Backend Architecture & Safety Boundaries

| Architectural Component | Implementation Location | Operational Status | Safety / Integrity Mechanism |
| :--- | :--- | :--- | :--- |
| **Service Registration** | `apps/api/src/shared/services/service-registry.ts` | **CONNECTED** | `MpesaAttemptService`, `MpesaCallbackService`, `MpesaDarajaClient` registered in dependency tree. |
| **Route Registration** | `apps/api/src/modules/index.ts` | **CONNECTED** | Public callback route and authenticated staff routes mounted. |
| **OAuth Transport** | `apps/api/src/modules/mpesa/mpesa-daraja.client.ts` | **IMPLEMENTED** | Generates HTTP Basic Auth header; requests token with 15s timeout. |
| **STK Push Transport** | `apps/api/src/modules/mpesa/mpesa-daraja.client.ts` | **IMPLEMENTED** | Assembles password via base64(`ShortCode + Passkey + Timestamp`); formats timestamp in `Africa/Nairobi` timezone; 20s timeout. |
| **Callback Intake** | `apps/api/src/modules/mpesa/mpesa-callback.routes.ts` | **IMPLEMENTED** | Body limit 16KB; sanitized error handler; redacted logger omitting query/headers. |
| **Rate Limiting** | `apps/api/src/modules/mpesa/mpesa-callback.service.ts` | **IMPLEMENTED** | Atomic fixed-window counters backed by MongoDB (`AuthRateLimitRepository`). |
| **Callback Deduplication** | `apps/api/src/modules/mpesa/mpesa-callback.repository.ts` | **IMPLEMENTED** | Partial unique indexes on `merchantRequestId` and `checkoutRequestId`. |
| **Attempt Lifecycle** | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts` | **IMPLEMENTED** | States: `CREATED -> SUBMITTING -> PENDING \| UNKNOWN \| REJECTED`. |
| **Invoice Locking** | `apps/api/src/modules/billing/billing.repository.ts` | **IMPLEMENTED** | `lockForMpesaAttempt` increments invoice version conditionally inside a transaction to prevent concurrent payments. |
| **Transactional Correlation**| `apps/api/src/modules/mpesa/mpesa-attempt.service.ts` | **IMPLEMENTED** | Correlates callback events to payment attempts within MongoDB replica-set transactions. |
| **Financial Ledger Posting** | `apps/api/src/modules/mpesa/mpesa-attempt.model.ts` | **DISABLED** | Explicit boundary: `postingStatus: 'DISABLED'`, `financialPostingEnabled: false`. No invoice balance changes. |
| **Provider Verification** | `apps/api/src/modules/mpesa/mpesa-attempt.model.ts` | **UNVERIFIED** | `verificationStatus: 'UNVERIFIED'`. No automated Daraja Status Query endpoint implemented. |

---

## 5. Phase 4 — Automated Test Execution

The existing M-Pesa test suites were executed using isolated synthetic MongoDB instances and mocked Daraja HTTP transport. No live Safaricom services or production databases were contacted.

### Vitest Execution Output Summary

```text
 RUN  v4.1.11 C:/Users/lenovo/Documents/GitHub/HMS

 ✓  api  src/modules/mpesa/mpesa-callback.test.ts (15 tests)
 ✓  api  src/modules/mpesa/mpesa-daraja.client.test.ts (7 tests)
 ✓  api  src/config/mpesa-outbound.test.ts (8 tests)
 ✓  api  src/modules/mpesa/mpesa-callback.integration.test.ts (5 tests)
 ✓  api  src/modules/mpesa/mpesa-attempt.integration.test.ts (17 tests)

 Test Files  5 passed (5)
      Tests  52 passed (52)
   Duration  84.59s
```

### Verified Behaviors
- **Configuration Tests (8 tests):** Secret-safe diagnostic messages; strict validation of URL format, shortcodes, and ObjectIds; rejection of localhost URLs.
- **Client Transport Tests (7 tests):** Correct base URL selection (`sandbox` vs `production`); OAuth header generation; password digest computation; accurate classification of 5xx/408/network timeouts as `UNKNOWN (PROVIDER_UNCERTAIN)`.
- **Callback Unit Tests (15 tests):** Safe parsing of Safaricom STK callback envelopes; rejection of oversized payloads (>16KB); redaction of sensitive query/header fields in logs.
- **Callback Integration Tests (5 tests):** Real HTTP listener testing; durable persistence in MongoDB; rate limit enforcement returning `429 Too Many Requests`; deduplication of replayed callbacks.
- **Attempt Integration Tests (17 tests):** End-to-end attempt lifecycle; invoice status gating (rejecting `CANCELLED` or paid invoices); serialization of concurrent creation requests; optimistic version concurrency on submission; rollback on correlation failures.

---

## 6. Phase 5 — Remaining Integration Blockers for Production Payments

While the merchant configuration is valid, full automated financial settlement is blocked by missing downstream ledger integrations:

| Blocker Item | Missing Capability | Implementation Requirement | Target Location |
| :--- | :--- | :--- | :--- |
| **1. Authoritative Provider Query** | Daraja STK Push Status Query API (`/mpesa/stkpushquery/v1/query`) | Query Safaricom directly to verify transaction status independently of public webhook callbacks. | `apps/api/src/modules/mpesa/mpesa-daraja.client.ts` |
| **2. UNKNOWN State Reconciliation** | Background worker for timed-out submissions | Scheduled polling job to query Daraja for attempts in `UNKNOWN` or pending status older than 2 minutes. | `apps/api/src/modules/mpesa/mpesa-reconciliation.worker.ts` |
| **3. Webhook Authenticity Verification** | Callback origin validation | Because Daraja callbacks lack HMAC signatures, verification must cross-check callback metadata against the provider query API before trust. | `apps/api/src/modules/mpesa/mpesa-callback.service.ts` |
| **4. Atomic Payment Posting** | Financial ledger record creation | Transition `postingStatus` to `POSTED`; call `BillingService.collectPayment` within an atomic transaction upon verified success. | `apps/api/src/modules/mpesa/mpesa-attempt.service.ts` |
| **5. Invoice Balance Settlement** | Invoice paid/balance updates | Decrement `balance_amount` and increment `paid_amount` on `BillingInvoice`; transition status to `PAID` or `PARTIALLY_PAID`. | `apps/api/src/modules/billing/billing.service.ts` |
| **6. Receipt Generation** | M-Pesa receipt record | Issue official HMS receipt containing Safaricom receipt number (`MpesaReceiptNumber`) and transaction timestamp. | `apps/api/src/modules/billing/billing.service.ts` |
| **7. Staff Billing Frontend** | Staff UI initiation & polling | Add M-Pesa payment option, phone input modal, STK Push trigger, real-time attempt status polling dialog, and receipt download. | `apps/web/src/pages/BillingWorkspacePage.tsx` |
| **8. Operational Recovery** | Manual reconciliation dashboard | Admin/supervisor screen to inspect mismatched or unverified callback events and trigger manual correlation. | `apps/web/src/pages/BillingWorkspacePage.tsx` |

---

## 7. Sandbox Test Readiness & Operational Runbook

The configuration is ready for a **controlled sandbox test**. To execute a safe, end-to-end sandbox handshake without modifying application code:

### Operational Prerequisites
1. **Public Webhook Ingress:**
   - Ensure the public URL configured in `MPESA_CALLBACK_URL` is actively routing incoming HTTPS traffic to `/api/payments/mpesa/callback` on port 4000.
2. **Enable STK Outbound Flag:**
   - Change `MPESA_STK_ENABLED=true` in `apps/api/.env.dev` and restart the API server.
3. **Target Invoice:**
   - Identify or create a draft invoice belonging to Main Branch (`MB01`) with a non-zero balance.

### Controlled Sandbox Execution Steps
1. **Initiate Attempt:**
   - As an authorized billing user, send `POST /api/billing/invoices/:id/mpesa-attempts` with an idempotency key, amount (e.g. `10`), and a Safaricom sandbox test phone number (e.g. `254708374149`).
2. **Submit STK Push:**
   - Call `POST /api/payments/mpesa/attempts/:id/submit` with `expectedVersion: 0`.
   - Verify that Daraja responds with HTTP 200 and `ResponseCode: "0"`, updating attempt to `PENDING`.
3. **Simulate Sandbox Payment:**
   - In the Safaricom Daraja Sandbox Simulator, enter the `CheckoutRequestID` and complete the simulated customer payment.
4. **Verify Callback & Correlation:**
   - Monitor API logs for `/api/payments/mpesa/callback`.
   - Call `GET /api/payments/mpesa/attempts/:id` and verify that `reportedOutcome` transitions to `SUCCESS`.
   - Confirm that `postingStatus` remains safely `DISABLED` as expected.

---

## 8. Final Audit Verdict

```text
================================================================================
FINAL VERDICT: CONFIGURATION_READY
================================================================================
Merchant Configuration:    CONFIGURATION_READY
Credential Completeness:   PRESENT & VALIDATED (Secret-safe)
Merchant Branch Mapping:   VALIDATED (Active Main Branch MB01)
Automated Tests:           52 / 52 PASSED (Zero regressions)
Financial Ledger Posting:  IMPLEMENTATION_BLOCKED (Deliberate safety boundary)
Live Provider Handshake:   UNVERIFIED (Requires controlled sandbox run)
================================================================================
```

### Verdict Justification
- **`CONFIGURATION_READY`**: The environment variables and merchant settings are complete, syntactically valid, pass all Zod validation rules, and correctly point to an active database branch and a valid public HTTPS callback endpoint. The system is structurally ready for sandbox STK push initiation as soon as `MPESA_STK_ENABLED` is enabled.
- **Financial Posting Boundary**: Live financial updates remain **`IMPLEMENTATION_BLOCKED`** pending implementation of authoritative provider verification, payment posting to `billing_payments`, and staff frontend UI integration.
- **Sandbox Provider Handshake**: Actual Safaricom acceptance remains **`UNVERIFIED`** until an authorized sandbox payment is triggered with Safaricom test credentials.
