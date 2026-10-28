# HMS — Existing M-Pesa Implementation Audit

Audit date: **28 October 2026 (Asia/Calcutta)**. Repository: `C:/Users/lenovo/Documents/GitHub/HMS`.

Branch: **`DEV-GENERAL`**. Audited HEAD: **`7df97a7dc8ce7f01abfbcaeec8502bb390c213b5`**. The working tree was clean before the audit. No branch operations, application edits, environment edits, credential changes, deployments, or application-database operations were performed. This report is the sole requested repository addition. Existing tests created and destroyed isolated synthetic MongoDB databases; they did not use the application's configured database.

Evidence labels used below:

- **Implemented:** a connected code path exists; test evidence is stated separately.
- **Partial:** a foundation exists, but the full requested workflow does not.
- **Missing:** no implementation was found in the inspected application source.
- **Unverified:** live infrastructure, provider acceptance, or deployment behavior was not exercised.
- **Unused:** no application import/reference was found; this is a static finding, not proof about external consumers.

## A. Executive Summary

**M-Pesa is an incomplete backend integration, not a completed HMS payment method.** It contains a real HTTP Daraja client, authenticated invoice-linked attempt creation/submission/read APIs, a public callback receiver, durable callback deduplication, and transactional correlation of callbacks to attempts. The production registry instantiates the real client, not a mock. Both Safaricom sandbox and production hosts are selectable in code. [apps/api/src/shared/services/service-registry.ts:118](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/shared/services/service-registry.ts:118>) [apps/api/src/modules/mpesa/mpesa-daraja.client.ts:13](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-daraja.client.ts:13>)

The crucial boundary is explicit: an attempt can record a callback-reported `SUCCESS`, but its verification status remains `UNVERIFIED` and its posting status remains `DISABLED`. Callback events similarly retain `financialPostingEnabled: false`. No M-Pesa operation creates a `billing_payments` record, settles an invoice, satisfies an advance-payment prerequisite, or generates an HMS receipt. This is a deliberate safety boundary in the existing code, not evidence of completed financial integration. [apps/api/src/modules/mpesa/mpesa-attempt.model.ts:27](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.model.ts:27>) [apps/api/src/modules/mpesa/mpesa-callback.model.ts:43](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.model.ts:43>) [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:178](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:178>)

Staff billing supports only `CASH`, `CARD`, `UPI`, and `BANK_TRANSFER`; M-Pesa has no frontend client, hook, phone form, pending screen, polling, retry UI, or receipt flow. Patient web billing is read-only. No auditable patient-mobile application source/package is present on this branch; residual build/dependency directories do not establish mobile integration. **None of the requested modules has a complete UI → API → M-Pesa → persisted financial result flow.** [apps/web/src/pages/BillingWorkspacePage.tsx:42](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/pages/BillingWorkspacePage.tsx:42>) [apps/api/src/modules/billing/billing.model.ts:149](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.model.ts:149>) [apps/patient-web/src/components/patient-portal/tabs/BillingTab.tsx:109](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/components/patient-portal/tabs/BillingTab.tsx:109>)

**Validation performed:** all **52 tests in five existing M-Pesa/configuration suites passed**, including isolated replica-set transactions and real local HTTP callback handling. Daraja transport was mocked. No real OAuth request, STK push, handset approval, public webhook delivery, or live payment was attempted. Passing these tests establishes the implemented backend safety boundaries, not production readiness.

## B. Implementation Inventory

### B1. Search scope and provenance

The audit searched the repository for M-Pesa/MPesa/Mpesa, Safaricom, Daraja, STK Push, Lipa Na M-Pesa, BusinessShortCode, PartyA/PartyB, CheckoutRequestID, MerchantRequestID, CallbackURL, TransactionStatus, PaymentProvider, PaymentGateway, PaymentWebhook, OAuth, and related configuration names. It then traced imports, service construction, routing, repository operations, billing methods, and frontend callers. Additional ignored-file searches covered application and prototype sources. Dependencies, `.git`, compiled bundles, diagnostic binaries, and historical scratch checkouts were not treated as current implementation evidence. Local environment files were checked by key/presence only; values are not reproduced.

`PROJECT_RULES.md` and `AGENTS.md` were read. This task is an audit, not implementation of a Scope 2 phase; no phase was started or marked complete. Existing audit/runbook claims were cross-checked against code rather than accepted as proof of working integration.

### B2. Direct M-Pesa implementation files

| File and source location | Layer | Purpose / important functions | Status |
|---|---|---|---|
| [apps/api/src/config/mpesa.ts:3](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/config/mpesa.ts:3>) | Config | `parseMpesaConfiguration`: environment and callback limits | Implemented, tested |
| [apps/api/src/config/mpesa-outbound.ts:30](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/config/mpesa-outbound.ts:30>) | Config | `parseMpesaOutboundConfiguration`: optional merchant configuration and sanitized startup diagnostics | Implemented, tested; local outbound configuration absent |
| [apps/api/src/config/env.ts:221](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/config/env.ts:221>) | Config | Connects both parsers to `process.env` | Implemented |
| [apps/api/src/modules/mpesa/mpesa-daraja.client.ts:13](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-daraja.client.ts:13>) | Backend/client | `MpesaDarajaClient.token`, `submit`, `base`: OAuth/STK HTTP transport | Implemented; external delivery unverified |
| [apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:8](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:8>) | Backend/routes | `registerMpesaAttemptRoutes`: four staff endpoints, permission gates, sanitized errors | Implemented, exercised in tests |
| [apps/api/src/modules/mpesa/mpesa-attempt.schemas.ts:4](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.schemas.ts:4>) | Backend/validation | `createAttemptSchema`, `attemptVersionSchema`, ID schemas, `parseAttemptInput` | Implemented, tested |
| [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:22](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:22>) | Backend/service | `create`, `get`, `submit`, `transition`, `finish`, `correlate`, `replay`, `correlatePending`, `mismatch` | Implemented attempt lifecycle; verification/posting/recovery incomplete |
| [apps/api/src/modules/mpesa/mpesa-attempt.repository.ts:5](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.repository.ts:5>) | Backend/repository | `session`, `ensureIndexes`, `get`, `byCheckout`, `create`, `transition`, `recordOutcome`, `audit` | Implemented, transaction tests |
| [apps/api/src/modules/mpesa/mpesa-attempt.model.ts:16](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.model.ts:16>) | Backend/model | `MpesaAttemptModel`, `mpesa_payment_attempts`, partial unique indexes | Implemented |
| [apps/api/src/modules/mpesa/mpesa-callback.routes.ts:6](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.routes.ts:6>) | Backend/routes | `registerMpesaCallbackRoutes`: public intake, limits, redacted logging/errors | Implemented, tested |
| [apps/api/src/modules/mpesa/mpesa-callback.schemas.ts:42](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.schemas.ts:42>) | Backend/validation | `mpesaCallbackSchema`, `parseMpesaCallback`; bounded metadata and date validation | Implemented, tested |
| [apps/api/src/modules/mpesa/mpesa-callback.service.ts:19](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.service.ts:19>) | Backend/service | `reportedOutcome`, `checkRateLimit`, `receive`: canonical identity and durable intake | Implemented; authenticity deliberately unverified |
| [apps/api/src/modules/mpesa/mpesa-callback.repository.ts:4](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.repository.ts:4>) | Backend/repository | `record`, `get`, `pending`, `mark`: durable upsert and correlation state | Implemented, tested |
| [apps/api/src/modules/mpesa/mpesa-callback.model.ts:26](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.model.ts:26>) | Backend/model | `MpesaCallbackEventModel`, `mpesa_callback_events` | Implemented |
| [apps/api/src/modules/index.ts:77](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/index.ts:77>) | Backend/wiring | Registers callback and staff routes in the application | Connected; not dead code |
| [apps/api/src/shared/services/service-registry.ts:118](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/shared/services/service-registry.ts:118>) | Backend/wiring | Builds repositories, real Daraja client and attempt service; callback injection at line 380 | Connected |
| [apps/api/src/shared/types/service-registry.ts:88](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/shared/types/service-registry.ts:88>) | Backend/types | `mpesaCallback`, `mpesaAttempts` registry contract | Connected |
| [apps/api/src/modules/billing/billing.repository.ts:193](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.repository.ts:193>) | Backend/integration | `lockForMpesaAttempt`: conditional invoice version increment inside transaction | Connected; financial totals unchanged |
| [apps/api/src/modules/mpesa/mpesa-callback.test.ts:28](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.test.ts:28>) | Tests | Callback/schema/configuration and logging safety tests | Executed, passed |
| [apps/api/src/modules/mpesa/mpesa-callback.integration.test.ts:18](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.integration.test.ts:18>) | Tests | Real isolated MongoDB, local HTTP, deduplication, persistence and rate limits | Executed, passed |
| [apps/api/src/modules/mpesa/mpesa-attempt.integration.test.ts:37](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.integration.test.ts:37>) | Tests | Replica-set attempt lifecycle, authorization, races, rollback, correlation | Executed, passed |
| [apps/api/src/modules/mpesa/mpesa-daraja.client.test.ts:11](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-daraja.client.test.ts:11>) | Tests | Mock HTTP transport, request construction, uncertainty/rejection classification | Executed, passed |
| [apps/api/src/config/mpesa-outbound.test.ts:13](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/config/mpesa-outbound.test.ts:13>) | Tests | Configuration validation and secret-safe diagnostic messages | Executed, passed |

### B3. Shared backend and frontend dependencies

| File and source location | Layer | Purpose / important functions | M-Pesa relationship |
|---|---|---|---|
| [apps/api/src/middleware/authenticate.ts:5](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/middleware/authenticate.ts:5>) | Auth | Bearer authentication via `authenticateAccessToken` | Used by staff M-Pesa routes |
| [apps/api/src/middleware/require-permission.ts:17](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/middleware/require-permission.ts:17>) | RBAC | `requirePermission`, database-backed permission check and denied-access audit | Existing Billing permissions reused |
| [apps/api/src/shared/database/transaction.ts:12](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/shared/database/transaction.ts:12>) | Database | `executeTransaction` | Reused; M-Pesa wrapper rejects its standalone fallback |
| [apps/api/src/modules/auth/auth-rate-limit.repository.ts:8](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/auth/auth-rate-limit.repository.ts:8>) | Repository | `consume`, durable atomic fixed-window counters | Used for public callback limits |
| [apps/api/src/modules/auth/auth-rate-limit.model.ts:14](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/auth/auth-rate-limit.model.ts:14>) | Model | `AuthRateLimitModel`, expiry TTL index | Shared supporting collection |
| [apps/api/src/modules/auth/auth.model.ts:38](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/auth/auth.model.ts:38>) | Audit model | `AuditLogModel` | Transactional attempt/submission/correlation audit |
| [apps/api/src/modules/billing/billing.types.ts:1](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.types.ts:1>) | Contract | Billing invoice/payment/source contracts | No M-Pesa payment method |
| [apps/api/src/modules/billing/billing.model.ts:73](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.model.ts:73>) | Model | Invoice, item, payment models | Existing financial records; no provider-attempt payment link |
| [apps/api/src/modules/billing/billing.schemas.ts:67](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.schemas.ts:67>) | Validation | `parseCollectBillingPaymentBody` | Rejects M-Pesa method |
| [apps/api/src/modules/billing/billing.routes.ts:75](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.routes.ts:75>) | Routes | Collect/list payments and get receipt | Existing manual billing, not STK |
| [apps/api/src/modules/billing/billing.service.ts:281](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.service.ts:281>) | Service | `collectPayment`, `listPayments`, `receipt` | Reusable future financial posting foundations; not called by M-Pesa |
| [apps/web/src/pages/BillingWorkspacePage.tsx:56](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/pages/BillingWorkspacePage.tsx:56>) | Frontend | `BillingWorkspacePage`, payment form and `ReceiptPaper` | Existing generic billing only |
| [apps/web/src/hooks/billing/useBillingWorkspaceFeature.ts:25](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/hooks/billing/useBillingWorkspaceFeature.ts:25>) | Feature hook | Composes invoice, payment, receipt and lookup hooks | No M-Pesa orchestration |
| [apps/web/src/hooks/billing/useBilling.ts:162](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/hooks/billing/useBilling.ts:162>) | Domain hook | `useCollectBillingPayment`, `useBillingReceipt`; targeted invalidations/toasts | No M-Pesa queries or mutations |
| [apps/web/src/services/billing.service.ts:11](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/services/billing.service.ts:11>) | Service | `billingService` | Generic billing API delegation |
| [apps/web/src/api/billing.ts:158](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/api/billing.ts:158>) | API | `billingApi`, payment/receipt endpoints | No M-Pesa endpoints or types |
| [apps/web/src/api/client.ts:28](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/api/client.ts:28>) | Transport | Builds API URL and performs authenticated requests | General transport only |
| [apps/web/src/config.ts:1](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/config.ts:1>) | Config | `VITE_API_BASE_URL` / localhost fallback | Deployment consideration, not M-Pesa config |
| [apps/web/src/hooks/billing/useBillingAutoPopulate.ts:12](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/hooks/billing/useBillingAutoPopulate.ts:12>) | Feature hook | Builds consultation/lab/imaging draft lines using domain hooks | Invoice foundation only |
| [apps/web/src/hooks/advance-payment/useAdvancePaymentFeature.ts:4](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/hooks/advance-payment/useAdvancePaymentFeature.ts:4>) | Feature hook | Read/sync advance requirements | No M-Pesa payment initiation |
| [apps/patient-web/src/pages/PatientPortalPage.tsx:14](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/pages/PatientPortalPage.tsx:14>) | Frontend | Imports active billing tab and invoice modal | Read-only patient billing |
| [apps/patient-web/src/components/patient-portal/tabs/BillingTab.tsx:14](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/components/patient-portal/tabs/BillingTab.tsx:14>) | Frontend | `BillingTab`: totals, invoices, view action | No Pay/M-Pesa action |
| [apps/patient-web/src/components/patient-portal/modals/InvoiceDetailModal.tsx:13](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/components/patient-portal/modals/InvoiceDetailModal.tsx:13>) | Frontend | `InvoiceDetailModal`: invoice/payment details and PDF | No provider transaction UI |
| [apps/patient-web/src/hooks/usePatientPortal.ts:103](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/hooks/usePatientPortal.ts:103>) | Hook | `invoiceQuery`, enabled on selected patient/invoice | Calls portal API directly; no intermediate service |
| [apps/patient-web/src/api/patient-portal.ts:141](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/api/patient-portal.ts:141>) | API | `patientPortalApi.invoice` | Patient-owned invoice read |
| [apps/api/src/modules/patient-portal/patient-portal.routes.ts:457](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.routes.ts:457>) | Backend | Patient invoice detail GET | No patient payment initiation route |
| [apps/patient-web/src/services/invoice-pdf.service.ts:111](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/services/invoice-pdf.service.ts:111>) | Presentation | Existing payment entries rendered in PDF | Does not generate an M-Pesa financial record |

Additional cross-domain files used for the integration matrix: [apps/api/src/modules/patients/patient.service.ts:55](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patients/patient.service.ts:55>), [apps/api/src/modules/appointments/appointment.service.ts:149](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/appointments/appointment.service.ts:149>), [apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:188](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:188>), [apps/api/src/modules/insurance/dha/dha-payment-allocation.service.ts:69](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-payment-allocation.service.ts:69>), [apps/api/src/modules/insurance/dha/dha-payment-reconciliation.service.ts:76](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-payment-reconciliation.service.ts:76>).

### B4. Documentation, prototypes, duplication and unused references

| File | Classification | Audit interpretation |
|---|---|---|
| [HMS_MPESA_ATTEMPTS_GAP_NOTE.md:1](<C:/Users/lenovo/Documents/GitHub/HMS/HMS_MPESA_ATTEMPTS_GAP_NOTE.md:1>) | Planning documentation | Attempt feature scope; not runtime behavior |
| [HMS_MPESA_ATTEMPTS_RUNBOOK.md:1](<C:/Users/lenovo/Documents/GitHub/HMS/HMS_MPESA_ATTEMPTS_RUNBOOK.md:1>) | Runbook | Current attempt/API test instructions; explicitly unverified and posting-disabled |
| [HMS_MPESA_ATTEMPTS_VERIFICATION.md:1](<C:/Users/lenovo/Documents/GitHub/HMS/HMS_MPESA_ATTEMPTS_VERIFICATION.md:1>) | Prior verification | Historical claims; fresh test result in section H is authoritative for this audit |
| [HMS_MPESA_STEP5_GAP_NOTE.md:1](<C:/Users/lenovo/Documents/GitHub/HMS/HMS_MPESA_STEP5_GAP_NOTE.md:1>) | Earlier callback scope | Historical callback-only phase |
| [HMS_MPESA_STEP5_RUNBOOK.md:5](<C:/Users/lenovo/Documents/GitHub/HMS/HMS_MPESA_STEP5_RUNBOOK.md:5>) | Earlier runbook | Says callback receiver does not initiate STK; do not apply that statement to the newer full implementation |
| [HMS_MPESA_STEP5_VERIFICATION.md:1](<C:/Users/lenovo/Documents/GitHub/HMS/HMS_MPESA_STEP5_VERIFICATION.md:1>) | Prior verification | Callback phase only |
| [HMS_PHASE1_PROGRESS_AUDIT.md:1](<C:/Users/lenovo/Documents/GitHub/HMS/HMS_PHASE1_PROGRESS_AUDIT.md:1>) | Historical audit | Search hit; not proof of current capabilities |
| [HMS_MONGODB_COLLECTION_INVENTORY.json:1](<C:/Users/lenovo/Documents/GitHub/HMS/HMS_MONGODB_COLLECTION_INVENTORY.json:1>) | Inventory artifact | Search hit; model code determines current declared collections |
| [scope/HMS Local/billing-module.js:68](<C:/Users/lenovo/Documents/GitHub/HMS/scope/HMS Local/billing-module.js:68>) | Prototype | Mock invoice/payment references and local state; not live billing |
| [scope/HMS Local/header-utils.js:376](<C:/Users/lenovo/Documents/GitHub/HMS/scope/HMS Local/header-utils.js:376>) | Prototype | Static M-Pesa paid notification; not a payment result |
| [scope/HMS Local/system-settings.html:423](<C:/Users/lenovo/Documents/GitHub/HMS/scope/HMS Local/system-settings.html:423>) | Prototype | M-Pesa selection and integration presentation, including lines 430 and 629; not live configuration |
| [scope/HMS Local/.hosting-public/billing-module.js:68](<C:/Users/lenovo/Documents/GitHub/HMS/scope/HMS Local/.hosting-public/billing-module.js:68>), [scope/HMS Local/.hosting-public/header-utils.js:376](<C:/Users/lenovo/Documents/GitHub/HMS/scope/HMS Local/.hosting-public/header-utils.js:376>), [scope/HMS Local/.hosting-public/system-settings.html:423](<C:/Users/lenovo/Documents/GitHub/HMS/scope/HMS Local/.hosting-public/system-settings.html:423>) | Prototype copies | Duplicate static presentation, not separate gateways |
| [scope/HMS Local/dist/client/billing-module.js:68](<C:/Users/lenovo/Documents/GitHub/HMS/scope/HMS Local/dist/client/billing-module.js:68>), [scope/HMS Local/dist/client/header-utils.js:376](<C:/Users/lenovo/Documents/GitHub/HMS/scope/HMS Local/dist/client/header-utils.js:376>), [scope/HMS Local/dist/client/system-settings.html:423](<C:/Users/lenovo/Documents/GitHub/HMS/scope/HMS Local/dist/client/system-settings.html:423>) | Generated prototype copies | Not production React/API implementation |
| [scope/HMS Local/temp_docx/word/document.xml:1](<C:/Users/lenovo/Documents/GitHub/HMS/scope/HMS Local/temp_docx/word/document.xml:1>) | Extracted requirements text | Search hit, not executable implementation |
| [apps/patient-web/src/components/patient-portal/PortalBillingTab.tsx:9](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/components/patient-portal/PortalBillingTab.tsx:9>), [apps/patient-web/src/components/patient-portal/PortalInvoiceDetailModal.tsx:12](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/components/patient-portal/PortalInvoiceDetailModal.tsx:12>) | Older frontend variants | Exports have no application references found; active page imports `tabs/BillingTab` and `modals/InvoiceDetailModal` instead |

No duplicate live M-Pesa gateway or unused M-Pesa backend service was found. Callback intake and outbound attempts are complementary parts of one registered module. The missing references are frontend callers and downstream verified financial posting/reconciliation. Prototype M-Pesa success displays must not be mistaken for simulated responses in the real backend; the backend contains no automatic mock-success fallback.

## C. Architecture

### C1. Connected and disconnected paths

The connected backend path is:

`staff Bearer/RBAC route → MpesaAttemptService → repositories/MongoDB → MpesaDarajaClient → Safaricom`.

The asynchronous return path is:

`public callback route → validation/rate limits → MpesaCallbackService → durable callback event → MpesaAttemptService.correlate → attempt reported outcome + correlation audit`.

There is **no outgoing edge from correlation to BillingService.collectPayment**. A service registry shares the existing billing repository with M-Pesa for invoice identity, scope, payable-state checks and conflict coordination. It does not share a financial posting implementation. [apps/api/src/shared/services/service-registry.ts:118](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/shared/services/service-registry.ts:118>) [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:189](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:189>)

### C2. API inventory

All paths below are registered application paths, including `/api`; they are not inferred from filenames. Staff handlers are inline route functions, not separate controller classes.

| Method | Endpoint | Handler | Authentication / permission | Purpose and status |
|---|---|---|---|---|---|
| POST | `/api/billing/invoices/:id/mpesa-attempts` | `mpesaAttempts.create` | Staff Bearer + `Billing / Invoices / CollectPayment` | Create/retrieve idempotent invoice attempt; implemented; needs configured merchant + transactions |
| GET | `/api/payments/mpesa/attempts/:id` | `mpesaAttempts.get` | Staff Bearer + `Billing / Invoices / View` | Read stored attempt status; implemented; does not query provider |
| POST | `/api/payments/mpesa/attempts/:id/submit` | `mpesaAttempts.submit` | Staff Bearer + `Billing / Invoices / CollectPayment` | Claim attempt by expected version and send STK; implemented |
| POST | `/api/payments/mpesa/attempts/:id/correlate` | `mpesaAttempts.correlatePending` | Staff Bearer + `Billing / Invoices / CollectPayment` | Replay locally stored unmatched callbacks; implemented; not reconciliation |
| POST | `/api/payments/mpesa/callback` | `mpesaCallback.receive`, rate-limit `onRequest` | Public; no signature/token/provider-auth check | Validate, store and correlate reported result; implemented; unverified evidence |
| GET | `/api/billing/invoices/:id` | `billing.getById` | Staff Bearer + `Billing / Invoices / View` | Existing scoped invoice details |
| POST | `/api/billing/invoices/:id/payments` | `billing.collectPayment` | Staff Bearer + `Billing / Invoices / CollectPayment` | Manual non-M-Pesa payment posting only |
| GET | `/api/billing/invoices/:id/payments` | `billing.listPayments` | Staff Bearer + `Billing / Invoices / View` | Existing financial payments; excludes M-Pesa attempts |
| GET | `/api/billing/payments/:id/receipt` | `billing.receipt` | Staff Bearer + `Billing / Invoices / ViewReceipt` | Existing derived HMS receipt; no M-Pesa receipt path |
| GET | `/api/patient-portal/patients/:patientId/invoices/:invoiceId` | `patientPortal.invoice` | Existing patient authentication/ownership flow | Read invoice/payment detail; no STK access |
| — | Provider status query / verify / reconcile / refund / reversal | None | None | Missing M-Pesa APIs |

Route evidence: [apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:20](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:20>), [apps/api/src/modules/mpesa/mpesa-callback.routes.ts:9](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.routes.ts:9>), [apps/api/src/modules/billing/billing.routes.ts:35](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.routes.ts:35>), [apps/api/src/modules/billing/billing.routes.ts:75](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.routes.ts:75>), [apps/api/src/modules/billing/billing.routes.ts:85](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.routes.ts:85>), [apps/api/src/modules/billing/billing.routes.ts:95](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.routes.ts:95>), [apps/api/src/modules/patient-portal/patient-portal.routes.ts:457](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.routes.ts:457>).

The four staff M-Pesa handlers return HTTP 200 with the standard `{ data: ... }` envelope, including create. The public ACK is HTTP 200 `{ data: { received: true } }` after durable storage and attempted correlation; it is not an assertion of successful payment. Actual Safaricom acceptance of that response has not been tested. Callback route has a response schema; staff M-Pesa routes rely on explicit runtime Zod parsing without declared OpenAPI request/response schemas. [apps/api/src/modules/mpesa/mpesa-callback.routes.ts:30](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.routes.ts:30>) [apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:20](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:20>)

### C3. Backend behavior and safeguards

**OAuth and STK.** A token is requested for each submission using HTTP Basic encoding of configured consumer key/secret. Token bodies are runtime-validated; no token cache or expiry persistence exists. OAuth timeout is 15 seconds. STK uses Bearer auth, a Nairobi-time timestamp, base64(shortcode + passkey + timestamp), configured transaction type/recipient, strict payer phone as PartyA/PhoneNumber, attempt-ID prefix as AccountReference and a generic description. STK timeout is 20 seconds. Both calls reject redirects. No client-side secret exposure was found. [apps/api/src/modules/mpesa/mpesa-daraja.client.ts:18](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-daraja.client.ts:18>)

**Phone/amount validation.** Creation requires a numeric integer amount from 1 through 250,000, a UUID idempotency key, and phone matching `^254[17]\d{8}$`. There is **no normalization** of `07...`, `01...`, `+254...`, spaces or punctuation: those inputs fail validation. Callback phone metadata accepts a 12-digit integer/string and is converted to text; correlation compares it exactly when present. A successful callback requires amount and receipt, but the current mismatch function does not require phone or transaction date to be present. [apps/api/src/modules/mpesa/mpesa-attempt.schemas.ts:4](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.schemas.ts:4>) [apps/api/src/modules/mpesa/mpesa-callback.schemas.ts:31](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.schemas.ts:31>) [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:167](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:167>)

**Creation and scope.** The backend resolves active user's assigned active branches (SUPER_ADMIN can be unscoped), reads the invoice through that scope, checks the merchant's branch allowlist, rechecks invoice state in a transaction and writes the attempt plus audit. Invoice status must be `PENDING` or `PARTIALLY_PAID`, with enough balance. Patient/branch IDs come from the invoice. Attempt reads recheck current invoice access and patient/branch consistency. M-Pesa has no separate hospital/tenant or department predicate; it inherits billing's branch policy. Do not claim stronger tenant isolation than the schema provides. [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:42](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:42>) [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:71](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:71>) [apps/api/src/modules/billing/billing.repository.ts:200](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.repository.ts:200>)

**Idempotency and submission.** Attempt `_id` is SHA-256(environment + lowercase invoice ID + UUID key). A separate fingerprint covers amount and phone. Same key/same input returns the existing record after authorization; changed input conflicts. Partial uniqueness permits one active attempt per invoice/environment. A version/state conditional write claims `CREATED → SUBMITTING` before external calls. Payability is checked again after OAuth, immediately before STK. External HTTP calls occur outside database transactions to avoid replaying an outbound request during transaction retries. [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:74](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:74>) [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:122](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:122>)

**State dimensions are separate.** Submission map is `CREATED → SUBMITTING → PENDING | UNKNOWN | REJECTED`, with no further submission transitions. Callback-reported outcome is `PENDING | SUCCESS | FAILED | CANCELLED | TIMEOUT`; it does not turn submission state into a settled state. Verification and posting cannot progress beyond their single permitted values. OAuth failure produces `REJECTED / AUTHENTICATION_FAILED_NOT_SENT`; failed post-OAuth invoice revalidation produces `REJECTED / INVOICE_REVALIDATION_FAILED_NOT_SENT`; explicit structured provider 4xx rejection produces `REJECTED / PROVIDER_REJECTED`. Definite rejection makes `active=false`, permitting a new attempt with a new key. Timeouts, malformed/ambiguous responses, 5xx and HTTP 408 produce `UNKNOWN / PROVIDER_UNCERTAIN`, keeping the attempt active. Failed persistence after an accepted response can leave `SUBMITTING`. No automatic resend exists. [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:15](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:15>) [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:134](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:134>) [apps/api/src/modules/mpesa/mpesa-daraja.client.ts:43](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-daraja.client.ts:43>)

**Callback intake.** A 16 KiB body limit, strict nested Zod schema, identifier restrictions, bounded fields/metadata, unique metadata names and date checks reject malformed data. MongoDB-backed per-IP/global 60-second limits run before processing. IP keys are hashed. Errors are sanitized; rate-limit/storage failures return 429/503 with `Retry-After: 60`. The receiver has no provider authenticity check, and the environment label comes from server configuration rather than signed callback evidence. [apps/api/src/modules/mpesa/mpesa-callback.routes.ts:9](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.routes.ts:9>) [apps/api/src/modules/mpesa/mpesa-callback.schemas.ts:21](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.schemas.ts:21>) [apps/api/src/modules/mpesa/mpesa-callback.service.ts:34](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.service.ts:34>)

**Deduplication.** Callback event `_id` hashes environment, provider IDs, result code/description and sorted metadata normalized to strings. `$setOnInsert` with the unique `_id` and majority+journaled write concern preserves first receipt and makes identical/reordered retries idempotent. Changed outcome, description or metadata produces a different event and is retained as separate evidence. This is event deduplication, not a unique financial receipt guarantee. No payment can be duplicated by this path because it posts none. [apps/api/src/modules/mpesa/mpesa-callback.service.ts:48](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.service.ts:48>) [apps/api/src/modules/mpesa/mpesa-callback.repository.ts:19](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.repository.ts:19>)

**Correlation.** Matching uses environment + CheckoutRequestID and checks MerchantRequestID, provided amount/phone, success amount/receipt completeness, invoice identity/payability and conflicting prior outcomes. Matching updates a still-pending reported outcome, marks the event `MATCHED` or `CONFLICT`, and writes audit in one transaction. Conflicts do not overwrite prior reported outcomes. Events arriving before provider IDs are saved stay `UNMATCHED`; `finish` replays after saving IDs, and staff can invoke `/correlate`. Replay processes at most 100 unmatched events per call. There is no scheduled replay worker or paginated operations queue. [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:167](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:167>) [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:205](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:205>) [apps/api/src/modules/mpesa/mpesa-callback.repository.ts:8](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.repository.ts:8>)

**Failures/cancellation and recovery.** Result codes are mapped by code: 0 success, 1032 cancelled, 1037 timeout, all other accepted codes failed. These are reported outcomes, not verified final financial statuses. Correlation does not clear `active`, even on reported cancellation/failure/success. `UNKNOWN`, stuck `SUBMITTING`, and matched terminal outcomes have no implemented verification/release path. GET reads the database; `/correlate` replays local events. Neither invokes Safaricom's query/status APIs. [apps/api/src/modules/mpesa/mpesa-callback.service.ts:19](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.service.ts:19>) [apps/api/src/modules/mpesa/mpesa-attempt.repository.ts:21](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.repository.ts:21>)

### C4. Frontend functionality and architecture compliance

| Requested experience | Actual frontend evidence and chain | Status |
|---|---|---|
| Select payment method | `BillingWorkspacePage` RHF/Zod form → `useBillingWorkspaceFeature` → `useCollectBillingPayment` → `billingService.collectPayment` → `billingApi.collectPayment` → POST invoice `/payments` | Implemented for four manual methods only |
| M-Pesa option/mobile-number input | Staff schema/select has no `MPESA` or phone field [apps/web/src/pages/BillingWorkspacePage.tsx:42](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/pages/BillingWorkspacePage.tsx:42>) [apps/web/src/pages/BillingWorkspacePage.tsx:218](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/pages/BillingWorkspacePage.tsx:218>) | Missing |
| Initiate STK | No frontend reference to any of the four attempt endpoints | Missing |
| Waiting/pending STK state | Existing `paymentMutation.isPending` says “Collecting...” for manual POST; no provider-wait state [apps/web/src/pages/BillingWorkspacePage.tsx:217](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/pages/BillingWorkspacePage.tsx:217>) | Missing for M-Pesa |
| Success/failure/cancel display | Generic billing toasts after manual payment; no M-Pesa outcome handling [apps/web/src/hooks/billing/useBilling.ts:162](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/hooks/billing/useBilling.ts:162>) | Missing for M-Pesa |
| Refresh/polling | Invoice error retry exists; no M-Pesa GET hook, polling timer or attempt refresh [apps/web/src/pages/BillingWorkspacePage.tsx:197](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/pages/BillingWorkspacePage.tsx:197>) | Missing for M-Pesa |
| Transaction details | Generic Payments table shows financial method/reference/date [apps/web/src/pages/BillingWorkspacePage.tsx:208](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/pages/BillingWorkspacePage.tsx:208>) | No attempt/CheckoutRequestID/verification UI |
| Receipt | `useBillingReceipt` → service → GET billing `/payments/:id/receipt`; `ReceiptPaper` renders result [apps/web/src/hooks/billing/useBilling.ts:181](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/hooks/billing/useBilling.ts:181>) [apps/web/src/pages/BillingWorkspacePage.tsx:228](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/pages/BillingWorkspacePage.tsx:228>) | Generic receipt exists; M-Pesa receipt absent |
| Retry payment | No idempotency-key/version management, safe STK retry or conflict-resolution UI | Missing |
| Patient billing | `PatientPortalPage` → `usePatientPortal.invoiceQuery` → `patientPortalApi.invoice` → GET patient invoice; `BillingTab`/`InvoiceDetailModal` display results | Read-only; no M-Pesa initiation or tracking |

The staff collection chain follows **Component → Feature Hook → Domain Hook → Service → API**. No direct network API call was found in the inspected staff billing page or patient billing components; `query.refetch()` delegates to a hook-owned query. The portal hook calls its API directly, skipping a service layer, so it does **not** implement the full prescribed layered chain. Its invoice modal imports a PDF-generation service directly; that is local presentation, not a payment API request. The advance-payment hook also calls its API directly. These are existing adjacent architecture differences, not evidence of M-Pesa integration. [apps/patient-web/src/hooks/usePatientPortal.ts:103](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/hooks/usePatientPortal.ts:103>) [apps/patient-web/src/components/patient-portal/modals/InvoiceDetailModal.tsx:5](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/components/patient-portal/modals/InvoiceDetailModal.tsx:5>) [apps/web/src/hooks/advance-payment/useAdvancePaymentFeature.ts:2](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/hooks/advance-payment/useAdvancePaymentFeature.ts:2>)

Generic billing has RHF/Zod validation, loading/empty/error states, balance checks, and Sonner success/error notifications; the app positions Sonner top-right. Its invoice/payment hooks are gated by IDs, not explicit permission flags, and feature lookups rely on mode/context rather than consistently checking every dependent permission. Backend RBAC remains authoritative. No M-Pesa-specific UI compliance can be asserted because no such UI exists. [apps/web/src/hooks/billing/useBilling.ts:63](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/hooks/billing/useBilling.ts:63>) [apps/web/src/hooks/billing/useBillingWorkspaceFeature.ts:59](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/hooks/billing/useBillingWorkspaceFeature.ts:59>) [apps/web/src/App.tsx:21](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/App.tsx:21>)

### C5. Collections, stored fields and relationships

| Requested field | Attempt / callback storage | Financial record implication |
|---|---|---|
| Payment ID | Attempt `_id` is a 64-hex deterministic hash; callback has its own hash ID | Neither is a `billing_payments._id`; no link to a posted payment |
| Invoice / patient / branch / actor | Attempt `invoiceId`, `patientId`, `branchId`, `createdBy` | Derived from invoice and authenticated actor |
| Amount / currency / method | Attempt `amount`, fixed `currency: KES`, fixed `provider: MPESA`; callback optional `amount` | No currency on generic invoice/payment model; no MPESA financial method |
| M-Pesa reference | Attempt `receiptNumber`; callback `mpesaReceiptNumber` | Stored as unverified evidence; no unique financial receipt mapping |
| CheckoutRequestID / MerchantRequestID | Both attempt and event after submission/intake | Primary correlation identifiers; no free-text billing-reference matching |
| Phone | Attempt `payerPhone`, event `phoneNumber`, both `select:false` by default | Repository explicitly selects for matching; staff view masks all but last four digits |
| Request status | Attempt `submissionState`, `submissionError`, `submittedAt`, `version`, `active` | Tracks outbound delivery, not financial completion |
| Final transaction status | `reportedOutcome`; verification remains `UNVERIFIED` | Verified final financial state missing |
| Callback payload | Validated selected fields and result description; metadata used for identity | Original raw body/unknown metadata are not fully retained |
| Failure reason | Event `resultCode`, `resultDescription`, `processingError`; attempt sanitized `submissionError` | Raw provider description is stored on event, not returned by staff attempt view |
| Timestamps | Attempt `createdAt`, `updatedAt`, optional `submittedAt`; event `receivedAt`, optional `processedAt`, provider transaction-date string | Event has no automatic created/updated timestamps |
| Refund / reversal | No M-Pesa fields or routes | Missing |

Model evidence: [apps/api/src/modules/mpesa/mpesa-attempt.model.ts:5](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.model.ts:5>), [apps/api/src/modules/mpesa/mpesa-callback.model.ts:5](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.model.ts:5>), [apps/api/src/modules/billing/billing.model.ts:49](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.model.ts:49>). DTO/privacy evidence: [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:60](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:60>). The attempt GET DTO omits even the stored receipt number and reported-event ID, so it cannot currently serve a complete transaction-detail UI.

Relationships:

- `billing_invoices` → one or more historical `mpesa_payment_attempts`; partial index permits at most one **active** attempt per invoice/environment. Attempt references are strings, not Mongoose ObjectId refs; services enforce relationships.
- `mpesa_callback_events` → optional `attemptId` after correlation; attempt → `reportedEventId` and receipt evidence. Multiple distinct/conflicting events may refer to one checkout.
- `billing_invoices` → `billing_invoice_items` and `billing_payments` are the existing financial relationships. **No M-Pesa edge reaches billing_payments.**
- An HMS receipt is constructed on demand from payment + invoice with a `PAY-` to `RCT-` number conversion and an audit event; there is no separate receipt collection in this flow. [apps/api/src/modules/billing/billing.service.ts:345](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.service.ts:345>)
- Supporting shared models are `AuditLogModel` and `AuthRateLimitModel` (Mongoose-default collection naming); no dedicated M-Pesa reconciliation/verification/refund model exists. Insurance mock reconciliation models are separate and must not be counted as M-Pesa records.

Indexes and transaction guarantees:

| Storage | Index / safeguard | Limits |
|---|---|---|
| Attempts | Unique `_id`; unique `(invoiceId, environment)` where `active=true`; unique `(environment, checkoutRequestId)` when checkout is a string; `(branchId, createdAt desc)` | No receipt uniqueness, timeout TTL or operator list API [apps/api/src/modules/mpesa/mpesa-attempt.model.ts:34](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.model.ts:34>) |
| Callback events | Unique `_id`; `(environment, checkoutRequestId, receivedAt desc)`; `(environment, processingStatus, receivedAt desc)`; sparse nonunique receipt index | Receipt is intentionally not reserved by untrusted claims; no retention TTL [apps/api/src/modules/mpesa/mpesa-callback.model.ts:47](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.model.ts:47>) |
| Invoice coordination | Conditional status/balance/paid match and `__v` increment | Short transactional conflict coordination, **not a durable outstanding-amount reservation** [apps/api/src/modules/billing/billing.repository.ts:193](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.repository.ts:193>) |
| Attempt changes | Version/state conditional updates and transactional audit | Requires replica set/mongos; refuses standalone fallback [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:32](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:32>) |
| Callback intake | Majority+journaled upsert with 5-second write concern timeout | Durable intake is separate from later correlation transaction [apps/api/src/modules/mpesa/mpesa-callback.repository.ts:19](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.repository.ts:19>) |
| Billing payments | Unique `paymentNumber`, invoice/date/branch indexes | No provider-attempt idempotency key or unique M-Pesa receipt constraint [apps/api/src/modules/billing/billing.model.ts:142](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.model.ts:142>) |
| Shared rate limits | Unique hashed bucket ID, conditional counter, expiry TTL | Rate limiting is not source authentication [apps/api/src/modules/auth/auth-rate-limit.repository.ts:8](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/auth/auth-rate-limit.repository.ts:8>) |

The general `executeTransaction` helper can fall back to nontransactional work on standalone MongoDB. M-Pesa explicitly refuses that fallback; generic billing `collectPayment` does not. Thus generic billing's payment/invoice/advance/audit atomicity is topology-dependent and should not simply be assumed sufficient for future M-Pesa settlement. [apps/api/src/shared/database/transaction.ts:12](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/shared/database/transaction.ts:12>) [apps/api/src/modules/billing/billing.service.ts:289](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.service.ts:289>)

## D. Integration Coverage Matrix

“Integrated” here requires the actual UI → API → payment → persisted financial result path requested in the audit. An invoice's ability to be addressed by the backend attempt API is only a partial capability.

| HMS module | Existing foundation and evidence | Actual M-Pesa coverage |
|---|---|---|
| Patient Registration | Patient creation persists patient identity; no payment/provider call in create [apps/api/src/modules/patients/patient.service.ts:55](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patients/patient.service.ts:55>) | **Not integrated**; no registration M-Pesa payment step |
| Appointment Booking | Appointment create exists; invoice model can reference appointment [apps/api/src/modules/appointments/appointment.service.ts:149](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/appointments/appointment.service.ts:149>) [apps/api/src/modules/billing/billing.model.ts:82](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.model.ts:82>) | **Not integrated**; no booking fee STK UI/API orchestration |
| OPD Consultation | Consultation invoice lines supported; hook can populate completed consultation charge [apps/web/src/hooks/billing/useBillingAutoPopulate.ts:37](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/hooks/billing/useBillingAutoPopulate.ts:37>) | **Backend attempt eligible if a payable invoice exists; no completed M-Pesa payment flow** |
| Laboratory | Lab order lines can feed billing drafts [apps/web/src/hooks/billing/useBillingAutoPopulate.ts:54](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/hooks/billing/useBillingAutoPopulate.ts:54>) | **Not integrated** end-to-end; generic eligible invoices only |
| Imaging | Imaging order lines can feed billing drafts [apps/web/src/hooks/billing/useBillingAutoPopulate.ts:71](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/hooks/billing/useBillingAutoPopulate.ts:71>) | **Not integrated** end-to-end; generic eligible invoices only |
| Pharmacy | Confirm dispensing creates/finalizes linked invoice [apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:188](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts:188>) | **Not integrated** end-to-end; M-Pesa attempt API can address eligible invoice but does not pay it |
| Inpatient | Admission-context invoice linkage, deposit verification and generic payment-to-advance update exist [apps/api/src/modules/billing/billing.service.ts:76](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.service.ts:76>) [apps/api/src/modules/billing/billing.service.ts:316](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.service.ts:316>) | **Not integrated**; reported M-Pesa success never satisfies deposit gate |
| Surgery | Procedure-context linkage and advance-payment processing exist [apps/api/src/modules/billing/billing.routes.ts:63](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.routes.ts:63>) [apps/api/src/modules/billing/billing.service.ts:316](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.service.ts:316>) | **Not integrated**; no booking-payment STK or verified advance posting |
| Billing | Invoice-scoped attempt endpoints exist; financial payment enum and UI exclude MPESA [apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:20](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:20>) [apps/web/src/api/billing.ts:7](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/api/billing.ts:7>) | **Partial backend only**; no M-Pesa payment/receipt in billing ledger |
| Patient Web Portal | Billing tab, invoice/payment details and PDF; patient invoice GET | **Read-only billing; no M-Pesa initiation or status tracking** |
| Patient Mobile App | `apps/patient-mobile` contains residual `.expo`, `android`, `dist`, `node_modules`; tracked inventory only shows three Android diagnostic binaries | **No auditable mobile application source on this branch**; do not infer integration from previous logs/build remnants |
| Insurance | Separate DHA mock allocation/reconciliation models preserve patient payment/invoice state [apps/api/src/modules/insurance/dha/dha-payment-allocation.service.ts:69](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-payment-allocation.service.ts:69>) [apps/api/src/modules/insurance/dha/dha-payment-reconciliation.service.ts:76](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-payment-reconciliation.service.ts:76>) | **Not integrated**; M-Pesa is invoice/patient-linked but has no insurer share/net-patient-payable calculation or settlement separation contract |
| Emergency (additional) | Billing model supports EMERGENCY source [apps/api/src/modules/billing/billing.model.ts:78](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.model.ts:78>) | Generic eligible invoice only; no M-Pesa clinical/UI integration |

M-Pesa is centralized under `modules/mpesa`, using existing billing records. It is not separately implemented by each clinical module. The attempt service validates total invoice balance only; it does not derive an insurer-versus-patient collectible portion. The existence of mock insurer settlement/reconciliation names is not evidence of M-Pesa reconciliation.

## E. Actual End-to-End Payment Flow

### E1. Numbered trace from an invoice

| Step | Status | Actual source/function and endpoint | Database effect / blocker |
|---|---|---|---|
| 1. Create and finalize invoice | Implemented general billing | `BillingService.create/update`; POST/PATCH `/api/billing/invoices[/id]` [apps/api/src/modules/billing/billing.routes.ts:41](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.routes.ts:41>) | Invoice/items persisted, finalized to PENDING; not evidence of M-Pesa |
| 2. Select M-Pesa in HMS | **Missing** | Staff select lists four other methods [apps/web/src/pages/BillingWorkspacePage.tsx:218](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/pages/BillingWorkspacePage.tsx:218>) | Flow stops for normal UI users |
| 3. API caller creates attempt | Implemented backend alternative | `create`; POST `/api/billing/invoices/:id/mpesa-attempts` [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:71](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:71>) | Validates phone/integer amount/key, scope/payability; invoice version + attempt + audit transaction; requires configuration/replica set |
| 4. Claim and request OAuth | Implemented, provider unverified | `submit`, `token`; POST `/api/payments/mpesa/attempts/:id/submit` [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:122](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:122>) | Commits SUBMITTING/audit first; token never persisted |
| 5. Submit STK | Implemented, provider unverified | `MpesaDarajaClient.submit`; outbound `/mpesa/stkpush/v1/processrequest` [apps/api/src/modules/mpesa/mpesa-daraja.client.ts:29](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-daraja.client.ts:29>) | Saves accepted provider IDs/PENDING, definite rejection, or UNKNOWN; no payment write |
| 6. Customer receives handset prompt | **Unverified external behavior** | Expected external effect of step 5; no handset implementation | Requires reachable provider, valid merchant/test credentials and handset; not exercised |
| 7. Customer approves/cancels | **Unverified external behavior** | Outside HMS source | No direct HMS state change until evidence arrives |
| 8. Provider sends callback | Intake implemented; actual provider delivery unverified | POST `/api/payments/mpesa/callback`; `receive` [apps/api/src/modules/mpesa/mpesa-callback.service.ts:47](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.service.ts:47>) | Stores canonical event with majority write concern; public HTTPS delivery dependency |
| 9. Validate and correlate callback | Partial: schema/correlation, **not authenticity verification** | `parseMpesaCallback`, `correlate` [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:178](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:178>) | Event MATCHED/CONFLICT or stays UNMATCHED; audit in correlation transaction |
| 10. Update payment result | Partial | `recordOutcome` [apps/api/src/modules/mpesa/mpesa-attempt.repository.ts:21](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.repository.ts:21>) | Only attempt reported outcome/receipt evidence; UNVERIFIED/DISABLED remain |
| 11. Update invoice balance after verified success | **Missing** | No M-Pesa call to `BillingService.collectPayment` | No billing payment, no financial balance/status update; version-only coordination is not settlement |
| 12. Generate receipt | **Missing for M-Pesa** | Generic `BillingService.receipt` requires real billing payment [apps/api/src/modules/billing/billing.service.ts:345](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.service.ts:345>) | Unverified provider receipt cannot produce HMS payment receipt |
| 13. Staff/patient view final result | Partial staff API only | GET `/api/payments/mpesa/attempts/:id`; `get/view` [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:60](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:60>) | Staff with View can read stored state; no UI or verified final status; no patient attempt API |

### E2. Sequence diagram of implemented code

The caller below is an authenticated API client; there is no connected M-Pesa HMS screen. Daraja messages represent calls the code constructs, not calls performed during this audit. Handset approval is omitted because it was not exercised or implemented in HMS.

```mermaid
sequenceDiagram
    actor Staff as Authorized staff API caller
    participant API as Staff M-Pesa routes
    participant Attempt as MpesaAttemptService
    participant DB as MongoDB repositories
    participant Client as MpesaDarajaClient
    participant Daraja as Safaricom endpoint
    participant Callback as Public callback route/service

    Staff->>API: POST invoice/:id/mpesa-attempts
    API->>API: Bearer auth, CollectPayment permission, Zod
    API->>Attempt: create(invoiceId, amount, phone, UUID, actor)
    Attempt->>DB: Resolve scope, invoice and active attempt
    Attempt->>DB: Transaction: conditional invoice version + attempt + audit
    Attempt-->>Staff: CREATED, UNVERIFIED, DISABLED, version
    Staff->>API: POST attempts/:id/submit (expectedVersion)
    API->>Attempt: submit
    Attempt->>DB: Transaction: check scope/payability, claim SUBMITTING + audit
    Attempt->>Client: token(merchant, environment)
    Client->>Daraja: GET OAuth (Basic, 15-second timeout)
    Daraja-->>Client: Token or failure
    alt OAuth token available
        Attempt->>DB: Transaction: revalidate invoice after OAuth
        alt Invoice remains payable
            Attempt->>Client: submit(merchant, attempt, token)
            Client->>Daraja: POST STK (Bearer, 20-second timeout)
            Daraja-->>Client: Accepted IDs, explicit rejection, or uncertain response
            Client-->>Attempt: PENDING, REJECTED, or UNKNOWN
        else Invoice revalidation fails
            Attempt->>Attempt: REJECTED, not sent
        end
    else OAuth failed
        Attempt->>Attempt: REJECTED, not sent
    end
    Attempt->>DB: Transaction: persist submission result + audit
    opt Provider IDs saved
        Attempt->>DB: Replay up to 100 stored unmatched events
    end
    Attempt-->>Staff: Stored attempt view

    Daraja->>Callback: POST callback payload (public route)
    Callback->>DB: Consume durable rate-limit counters
    Callback->>Callback: Validate and hash canonical event
    Callback->>DB: Majority+journaled setOnInsert
    Callback->>Attempt: correlate(eventId)
    Attempt->>DB: Find attempt by environment + checkout ID
    alt Matching attempt found
        Attempt->>DB: Transaction: check metadata/invoice, record reported outcome, mark event, audit
    else No attempt found
        Note over DB: Keep event UNMATCHED
    end
    Callback-->>Daraja: HTTP 200 data.received=true
    Note over Attempt,DB: All outcomes remain UNVERIFIED; financial posting DISABLED
    Note over DB: No billing payment, invoice settlement or receipt created
    Staff->>API: GET attempts/:id or POST attempts/:id/correlate
    API->>Attempt: Scoped read or stored-event replay
    Attempt-->>Staff: Stored attempt status, masked phone
```

A callback may arrive before the STK response is saved; that case is explicitly covered by replay and an existing test. Storage/correlation failure returns a retryable sanitized error instead of the successful ACK shown in the normal branch. No provider status query is hidden inside replay.

## F. Environment and Credentials

### F1. Configuration contract

All `MPESA_*` variables enter through the parsers wired at [apps/api/src/config/env.ts:221](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/config/env.ts:221>). Local inspection found **no MPESA_* assignments** in present `apps/api/.env.dev`, `.env.test` or `.env.example`; `.env.prod` and `.env` are absent in `apps/api`. No MPESA_* variables were present in the audit shell environment. This does not inspect or establish hosted secrets or another running server's environment. No values, credentials, full database URLs or patient data are included here.

| Variable / setting | Definition and consumer | Required/default, validation | Connection and local status |
|---|---|---|---|
| `MPESA_ENVIRONMENT` | `parseMpesaConfiguration` → callback labels, attempt identity, Daraja host | Optional; `sandbox` default; only `sandbox`/`production` | Connected; not set locally |
| `MPESA_CALLBACK_PER_IP_LIMIT` | Callback config → `checkRateLimit` | Optional; 120 per 60s; coerced integer 1–10,000 | Connected; not set locally |
| `MPESA_CALLBACK_GLOBAL_LIMIT` | Callback config → `checkRateLimit` | Optional; 600 per 60s; coerced integer 1–100,000 | Connected; not set locally |
| `MPESA_STK_ENABLED` | Outbound parser enables/disables merchant object | Omitted or `false` disables; exact `true` enables; other strings fail | Connected; absent locally means disabled |
| `MPESA_CONSUMER_KEY` | Outbound merchant → OAuth Basic auth | Required when enabled; nonempty string | Connected; not configured in inspected local sources |
| `MPESA_CONSUMER_SECRET` | Outbound merchant → OAuth Basic auth | Required when enabled; nonempty string | Connected; not configured locally |
| `MPESA_PASSKEY` | Outbound merchant → STK Password construction | Required when enabled; nonempty string | Connected; not configured locally |
| `MPESA_BUSINESS_SHORT_CODE` | Merchant snapshot → STK BusinessShortCode/password | Required when enabled; 5–7 digits | Connected; not configured locally |
| `MPESA_PARTY_B` | Merchant snapshot → recipient PartyB | Required when enabled; 5–7 digits | Connected; no separate named Till/Paybill variable; not configured locally |
| `MPESA_TRANSACTION_TYPE` | Merchant snapshot → STK TransactionType | Required when enabled; `CustomerPayBillOnline` or `CustomerBuyGoodsOnline` | Connected; not configured locally; provider-specific merchant validity unverified |
| `MPESA_CALLBACK_URL` | Merchant → outbound CallBackURL | Required when enabled; HTTPS, exact callback path, no URL credentials/query/fragment, hostname not literal localhost | Connected; not configured locally; validation does not prove public reachability |
| `MPESA_BRANCH_IDS` | Merchant allowlist → create/submit checks | Required when enabled; comma-separated 24-hex IDs, trimmed/lowercased, at least one | Connected; not configured locally |
| API base URL | `MpesaDarajaClient.base` | Hardcoded sandbox/production hosts; not an env variable | Selected by MPESA_ENVIRONMENT |
| OAuth endpoint | Client `token` | `/oauth/v1/generate?grant_type=client_credentials` | Implemented hardcoded suffix |
| STK endpoint | Client `submit` | `/mpesa/stkpush/v1/processrequest` | Implemented hardcoded suffix |
| Query Status / TransactionStatus endpoint | No client method/configuration | Missing | Not connected |
| Webhook verification secret/signature/IP allowlist | No M-Pesa verification configuration | Missing | Callback remains public and UNVERIFIED |
| `TRUST_PROXY` | General API config → Fastify request IP | Existing proxy parser; affects callback rate-limit identity | Infrastructure dependency, not proof of webhook origin |
| `MONGODB_URI` / database topology | Existing database configuration | M-Pesa attempts/correlation require transaction-capable topology | Application connectivity/topology not probed |

Source: [apps/api/src/config/mpesa.ts:3](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/config/mpesa.ts:3>), [apps/api/src/config/mpesa-outbound.ts:3](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/config/mpesa-outbound.ts:3>), [apps/api/src/config/mpesa-outbound.ts:30](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/config/mpesa-outbound.ts:30>), [apps/api/src/modules/mpesa/mpesa-daraja.client.ts:15](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-daraja.client.ts:15>), [apps/api/src/config/env.ts:235](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/config/env.ts:235>). The outbound credential validator checks nonempty strings rather than validity with Safaricom; it does not verify that the selected environment, shortcode, passkey, transaction type and PartyB belong together.

### F2. Integration mode and deployment interpretation

- **Real sandbox capable in code:** default host is `https://sandbox.safaricom.co.ke`; credentials and explicit enablement are still necessary.
- **Real production capable in code:** `MPESA_ENVIRONMENT=production` selects `https://api.safaricom.co.ke`. There is no code-enforced sandbox-only restriction when outbound is enabled. This does not make the integration production-ready.
- **Current inspected local defaults:** outbound disabled, callback environment sandbox. Callback routes remain registered regardless of outbound enablement.
- **Mocks:** injected synthetic HTTP/client behavior exists in tests; mock M-Pesa text/data exists in prototypes. Neither is a production client fallback. The production registry constructs `new MpesaDarajaClient()` using native fetch.
- **External prerequisites:** correctly configured merchant credentials/type/recipient, allowed branch IDs, valid payable invoice and user permissions, transaction-capable MongoDB, outbound HTTPS access, publicly routable callback, and verified deployment/proxy behavior. Provider acceptance and hosted secret configuration remain unknown.

Hosted URL checks: staff and patient web configs default to `http://localhost:4000/api` when `VITE_API_BASE_URL` is missing. The inspected staff `.env.prod` has a non-localhost API setting; `netlify.toml` sets `/api` and forwards `/api/*` to the API function for its patient-web build. These are source/config observations, not deployed-bundle verification. The Daraja client itself uses fixed public HTTPS hosts. Callback validation rejects literal localhost but still allows HTTPS loopback/private-IP hosts; it does not enforce the “public host” wording fully. [apps/web/src/config.ts:3](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/config.ts:3>) [apps/patient-web/src/config.ts:2](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/config.ts:2>) [netlify.toml:10](<C:/Users/lenovo/Documents/GitHub/HMS/netlify.toml:10>) [netlify.toml:26](<C:/Users/lenovo/Documents/GitHub/HMS/netlify.toml:26>) [apps/api/src/config/mpesa-outbound.ts:7](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/config/mpesa-outbound.ts:7>)

## G. Implementation Gaps and Quality Review

### G1. Prioritized findings

Severity is assessed for completing a trustworthy payment product. “Critical” below is a release-blocking missing capability, not a claim that current callbacks can fraudulently settle invoices.

| ID / severity | Finding and concrete impact | Evidence / qualification |
|---|---|---|
| G1 — **Critical** | **No verified financial completion.** Real STK can be sent when configured, but even reported success cannot create a payment, reduce invoice balance, satisfy an advance, or produce an HMS receipt. There is no verification/query/reconciliation implementation. | Single-value UNVERIFIED/DISABLED fields; correlation only records evidence [apps/api/src/modules/mpesa/mpesa-attempt.model.ts:29](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.model.ts:29>) [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:193](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:193>). Confirmed code gap. |
| G2 — **High** | **No end-user M-Pesa workflow.** Staff cannot select/initiate/track/retry M-Pesa, and patients have no initiation/status API or UI. | Form/API methods exclude MPESA [apps/web/src/pages/BillingWorkspacePage.tsx:218](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/pages/BillingWorkspacePage.tsx:218>) [apps/web/src/api/billing.ts:7](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/api/billing.ts:7>). Confirmed code gap. |
| G3 — **High** | **Unresolved attempts have no recovery lifecycle.** UNKNOWN/stuck SUBMITTING remain locked; even reported cancellation/failure leaves `active=true`. One such attempt prevents another active attempt for the invoice/environment indefinitely. | `finish` clears active only on REJECTED; `recordOutcome` does not [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:154](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:154>) [apps/api/src/modules/mpesa/mpesa-attempt.repository.ts:21](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.repository.ts:21>). Confirmed limitation; recovery must verify provider state before release. |
| G4 — **High** | **Invoice coordination does not reserve receivables through the asynchronous payment window.** Another manual payment, invoice change/cancellation, or a different-environment attempt can proceed after STK submission. A subsequent real debit can require an unimplemented exception/refund process. | Lock only increments version; manual collection/cancellation does not inspect active attempts [apps/api/src/modules/billing/billing.repository.ts:193](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.repository.ts:193>) [apps/api/src/modules/billing/billing.repository.ts:399](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.repository.ts:399>) [apps/api/src/modules/billing/billing.service.ts:281](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.service.ts:281>). Risk inferred from code; not reproduced against a provider. |
| G5 — **High** | **Callback claims are unauthenticated.** An actor with provider IDs/metadata can submit a well-formed false claim. It can influence reported outcome/correlation conflicts; there is no authenticated verification to resolve it. It cannot currently post money. | Public route + first reported outcome update [apps/api/src/modules/mpesa/mpesa-callback.routes.ts:9](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.routes.ts:9>) [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:192](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:192>). Rate limiting is not authenticity. |
| G6 — **High** | **Generic billing cannot yet safely represent provider posting.** MPESA payment method, unique verified receipt/attempt linkage, settlement idempotency, and transactional verification→posting boundary are missing. Shared transaction fallback also permits non-atomic generic billing on standalone MongoDB. | [apps/api/src/modules/billing/billing.model.ts:149](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.model.ts:149>) [apps/api/src/modules/billing/billing.service.ts:289](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.service.ts:289>) [apps/api/src/shared/database/transaction.ts:32](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/shared/database/transaction.ts:32>). No current M-Pesa posting means the financial risk is at integration time. |
| G7 — **High** | **Operational readiness unverified/configuration absent locally.** No live provider test or deployment callback check was performed; code can target production if enabled even though posting is unfinished. | [apps/api/src/modules/mpesa/mpesa-daraja.client.ts:15](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-daraja.client.ts:15>); configuration presence inspection in F. Distinguish missing local settings from unknown hosted settings. |
| G8 — **Medium** | **No operations queue/history/reconciliation UI or job.** GET requires known attempt ID; no paginated invoice-attempt list, stuck-attempt sweeper, verified resolution action or scheduled replay. Manual replay caps at 100 events. | [apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:20](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:20>) [apps/api/src/modules/mpesa/mpesa-callback.repository.ts:8](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.repository.ts:8>). Confirmed code gap. |
| G9 — **Medium** | **Amount/currency contract is incomplete across domains.** Attempts assume KES and whole shillings up to 250,000; generic billing allows cents and stores no currency. Fractional outstanding balances cannot be fully paid by this API. Insurance patient-share allocation is not consulted. | [apps/api/src/modules/mpesa/mpesa-attempt.schemas.ts:5](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.schemas.ts:5>) [apps/api/src/modules/billing/billing.schemas.ts:6](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.schemas.ts:6>) [apps/api/src/modules/billing/billing.model.ts:4](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.model.ts:4>). No automatic rounding is suggested without an approved contract. |
| G10 — **Medium** | **Privacy/retention and isolation require deployment decisions.** Phone is stored as ordinary string despite hidden default selection; provider description is stored; events have no TTL. Scope is branch-based, with no independent tenant/department key. | [apps/api/src/modules/mpesa/mpesa-callback.model.ts:32](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.model.ts:32>) [apps/api/src/modules/mpesa/mpesa-attempt.model.ts:18](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.model.ts:18>) [apps/api/src/modules/billing/billing.repository.ts:200](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.repository.ts:200>). Storage encryption/access controls and tenant deployment model were not inspected. |
| G11 — **Medium** | **Public callback URL validator is weaker than its error message.** HTTPS private/loopback hosts other than literal localhost pass; validation cannot establish public routing. Frontend default URLs can also target localhost when build configuration is missing. | [apps/api/src/config/mpesa-outbound.ts:7](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/config/mpesa-outbound.ts:7>) [apps/web/src/config.ts:3](<C:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/config.ts:3>). Configuration/reachability gap; not an arbitrary outbound-provider URL vulnerability. |
| G12 — **Low** | **Incomplete API discoverability and status DTO.** Staff routes lack declared request/response documentation schemas; GET omits stored receipt/event IDs. No canonical frontend phone formatter/help text exists. | [apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:20](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:20>) [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:60](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:60>). Runtime input validation does exist. |
| G13 — **Low** | **Documentation/prototype ambiguity and unused portal variants.** Older callback-only docs, static M-Pesa settings/success messages and unused duplicate billing components can overstate what is implemented. `.env.example` lacks M-Pesa discoverability. | Inventory B4 and configuration inspection F. No duplicate live backend gateway found. |

### G2. Requested security/reliability checklist

| Check | Audit result |
|---|---|
| Try/catch and failure handling | M-Pesa routes/services/client sanitize failures; transport uncertainty is preserved. Existing shared transaction helper has a swallowed endSession cleanup error, outside the dedicated module. |
| Friendly validation/errors | Stable 400/401/403/404/409/429/503 envelopes/codes; request validation intentionally generic. No M-Pesa UI to display them. |
| API correctness/registration | All five M-Pesa routes registered; full-app tests exercise them except manual replay route coverage is limited (see H). Real deployed ingress unverified. |
| No hosted localhost URL | Public provider hosts fixed; configured staff build setting non-localhost and Netlify `/api` setting present. Missing frontend env still falls back to localhost; hosted artifacts unverified. |
| Success/error toasts | Generic billing uses Sonner/top-right; no M-Pesa-specific toast flow. |
| Hardcoded production secrets | None found in inspected M-Pesa source. Synthetic test credentials are fixtures. Hosted secrets were not accessed; this is not a repository-wide historical secret scan. |
| Secure webhook handling | Strict input limits, durable rate limits, safe logging and non-posting boundary present; sender/payment authenticity not verified. |
| Duplicate callbacks/idempotency | Unique hash event IDs, attempt idempotency fingerprints, partial unique indexes and version claims present/tested. Financial settlement idempotency missing. |
| Atomic invoice/payment state | Attempt/invoice-version/audit and correlation writes transactional. There is no M-Pesa invoice/payment settlement transaction. Generic standalone fallback limits future reuse. |
| No fabricated success | No fake runtime financial success. `reportedOutcome=SUCCESS` is explicitly unverified; prototype text/test mocks are separate. |
| No TypeScript `any` | No explicit `any`, `as any`, `@ts-ignore` or `@ts-expect-error` found in dedicated M-Pesa/config files. This is a scoped static search, not a global type-safety certification; non-null assertions exist in staff routes. |
| Already-settled invoice | Creation/submission reject PAID/DRAFT/CANCELLED or insufficient balance; tested. Race during outstanding external STK window remains G4. |
| No premature settlement | Confirmed: callbacks never create billing payments or alter financial totals. Invoice version may increment during correlation. |
| Timeouts/pending | Bounded HTTP calls; UNKNOWN retained; no unsafe automatic resend. Resolution/expiry absent. |
| Retry/reconciliation | Safe same-key create replay and stale submit rejection exist; local callback replay exists. Provider reconciliation and stuck-attempt recovery absent. |
| Authorization/isolation | Staff Bearer + existing database Billing permissions, invoice branch access and merchant allowlist. Public callback is intentionally not staff-authenticated; tenant/department isolation beyond billing is not implemented. |
| Currency/amount | Strict positive integer limits and outstanding checks; KES is fixed on attempts. Fractional invoice/currency/insurance-share alignment unresolved. |
| Sensitive logging | Dedicated route request serializers suppress bodies/URLs/headers; errors log static code only; existing logging safety tests passed. Full phone remains stored in DB; upstream ingress/host logs not audited. |

Error codes worth preserving in future integration include `MPESA_NOT_CONFIGURED`, `MPESA_BRANCH_NOT_CONFIGURED`, `MPESA_TRANSACTIONS_REQUIRED`, `MPESA_INVOICE_NOT_PAYABLE`, `MPESA_IDEMPOTENCY_CONFLICT`, `MPESA_ACTIVE_ATTEMPT_EXISTS`, `MPESA_ATTEMPT_CONFLICT`, `MPESA_MERCHANT_CONFLICT`, `MPESA_ATTEMPT_NOT_FOUND`, `MPESA_ATTEMPT_UNAVAILABLE`, `MPESA_REQUEST_INVALID`, `MPESA_CALLBACK_INVALID`, `MPESA_CALLBACK_TOO_LARGE`, `MPESA_CALLBACK_CONTENT_TYPE`, `MPESA_CALLBACK_RATE_LIMITED`, and `MPESA_CALLBACK_UNAVAILABLE`. These should not be collapsed into a misleading “payment failed” UI for uncertain submissions. [apps/api/src/modules/mpesa/mpesa-attempt.service.ts:18](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.service.ts:18>) [apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:10](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.routes.ts:10>) [apps/api/src/modules/mpesa/mpesa-callback.routes.ts:17](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.routes.ts:17>)

## H. Test Coverage

### H1. Existing tests executed safely

Command executed from the repository root:

```text
npm run test --workspace=@hms/api -- src/modules/mpesa/mpesa-callback.test.ts src/modules/mpesa/mpesa-callback.integration.test.ts src/modules/mpesa/mpesa-attempt.integration.test.ts src/modules/mpesa/mpesa-daraja.client.test.ts src/config/mpesa-outbound.test.ts --reporter=dot
```

**Result: exit code 0; 5 test files passed; 52 tests passed; duration 35.37 seconds.** No failures or skipped tests were reported. No source/test edits were made to obtain this result.

| Exact test path | Covered behavior | Important boundary |
|---|---|---|
| [apps/api/src/modules/mpesa/mpesa-callback.test.ts:28](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.test.ts:28>) | Reported code mapping; strict payload/metadata validation; normalized identity; ACK after storage; sanitized storage/limiter failures; log redaction; malformed JSON/body limit/content type/throttling; environment/limit configuration | Repository/rate limiter mocked; validates receiver contract, not provider authenticity |
| [apps/api/src/modules/mpesa/mpesa-callback.integration.test.ts:18](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.integration.test.ts:18>) | Full app registration; existing billing remains authenticated; parallel duplicate delivery and reordered metadata; distinct conflicting events preserved; no financial mutation; persistence across app rebuild with real localhost HTTP listener; spoofed forwarding headers do not bypass default IP limit | `MongoMemoryServer` URI only; synthetic local callbacks; no external provider call |
| [apps/api/src/modules/mpesa/mpesa-attempt.integration.test.ts:37](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.integration.test.ts:37>) | Branch-scoped create/read/submit; invalid invoice states, overpayment/fraction/phone/key input; same-key and different-key concurrency; audit rollback; one outbound submission under concurrency; stale retry rejection; UNKNOWN lock; OAuth failure safe new attempt; invoice revalidation after OAuth; early/duplicate/conflicting/mismatched callbacks; correlation rollback/replay; persistence-failure SUBMITTING lock; route auth/RBAC | Isolated `MongoMemoryReplSet`; Daraja token/submit mocked; authentication/permission collaborators stubbed in route test; tests do not certify real credential verification or deployed RBAC provisioning |
| [apps/api/src/modules/mpesa/mpesa-daraja.client.test.ts:11](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-daraja.client.test.ts:11>) | OAuth/STK URL/header/body construction, timestamp/password encoding, preserved provider IDs, redirect setting, ambiguous response handling, synthetic timeout, explicit rejection, production URL selection, default-disabled/incomplete config | Injected fetch mock; does not validate real Safaricom acceptance or elapsed timeout behavior |
| [apps/api/src/config/mpesa-outbound.test.ts:13](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/config/mpesa-outbound.test.ts:13>) | Valid merchant config; invalid URL cases; sanitized missing-setting diagnostics; outbound-disabled startup | Synthetic values only; no live config probe |

The safety review confirmed database creation via `mongo.getUri()` before destructive test fixture cleanup, and teardown disconnects/stops isolated MongoDB. The attempt suite mocks token and submit before invoking the service. The callback suite's HTTP fetch targets its own ephemeral `127.0.0.1` listener. The client suite injects mocked fetch. [apps/api/src/modules/mpesa/mpesa-attempt.integration.test.ts:46](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.integration.test.ts:46>) [apps/api/src/modules/mpesa/mpesa-attempt.integration.test.ts:66](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-attempt.integration.test.ts:66>) [apps/api/src/modules/mpesa/mpesa-callback.integration.test.ts:21](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.integration.test.ts:21>) [apps/api/src/modules/mpesa/mpesa-callback.integration.test.ts:81](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/mpesa/mpesa-callback.integration.test.ts:81>)

### H2. Adjacent tests found, not executed

Existing non-M-Pesa billing coverage includes [apps/api/test/billing-integration.test.ts:1](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/test/billing-integration.test.ts:1>), [apps/api/test/collect-payment-validation.test.ts:1](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/test/collect-payment-validation.test.ts:1>), [apps/api/test/advance-payment.test.ts:1](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/test/advance-payment.test.ts:1>), [apps/api/test/ip-pharmacy-billing.test.ts:1](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/test/ip-pharmacy-billing.test.ts:1>), and [apps/api/src/modules/advance-payment/advance-payment-atomic.test.ts:1](<C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/advance-payment/advance-payment-atomic.test.ts:1>). These are not evidence of M-Pesa financial posting. Portal invoice/PDF tests exist at [apps/patient-web/src/api/patient-portal.test.ts:1](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/api/patient-portal.test.ts:1>) and [apps/patient-web/src/services/invoice-pdf.service.test.ts:1](<C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/services/invoice-pdf.service.test.ts:1>); neither establishes an STK flow.

### H3. Unverified or uncovered areas

- No existing live sandbox/production M-Pesa test was found or run. No handset/callback-host test, real provider timeout, provider query/status verification, refund or reversal was exercised.
- No frontend M-Pesa tests exist because the flow is absent. No live browser acceptance or logout/login workflow was performed. App-rebuild persistence in the callback test is narrower than logout/login acceptance.
- No verified financial posting, financial receipt uniqueness, multi-method payment race, insurer-share allocation, terminal attempt release or tenant-isolation test exists for an implemented M-Pesa settlement path.
- Existing correlation tests cover replay through service methods; the staff `/correlate` endpoint's full HTTP auth/contract path is not directly exercised by the shown route test.
- No full repository typecheck/lint/build was run. This was an analysis-only task with no application edits, not phase completion. The five focused suites are the only new automated pass claim; no stale verification document result is presented as newly run.
- No coverage-percentage instrumentation was run; test count is not a claim of exhaustive branch coverage.

## I. Production Readiness

**Classification: INCOMPLETE, backend-only real-provider-capable integration; live sandbox and production behavior UNVERIFIED. Not production-ready.**

| Area | Readiness |
|---|---|
| Durable public callback intake | Implemented and locally tested; unverified claims only |
| Authenticated invoice attempts | Implemented and locally tested with transaction-capable isolated MongoDB |
| OAuth and STK transport | Real client code present; provider responses mocked in tests |
| Sandbox-only? | No; code can choose production, but that is not certification |
| Mock-only? | No; production registry uses real fetch; mocks limited to tests/prototypes |
| Current local outbound ability | Disabled under inspected configuration; required merchant settings absent |
| Verified success and financial settlement | Missing |
| Safe reconciliation/recovery/refunds | Missing |
| Staff/patient complete UX | Missing |
| Live infrastructure, public callback, hosted secrets | Unverified |

A configured deployment can potentially initiate a real debit while HMS still leaves the invoice unpaid. Therefore sending STK successfully must not be used as the completion criterion. The explicit non-posting guard should remain until verified settlement and recovery are designed and tested.

## J. Recommended Next Steps

These are proposed implementation priorities; **none was implemented during this audit**.

1. **Approve the financial completion contract first.** Define authoritative provider verification, merchant/environment identity, currency/fraction rules, insurer-versus-patient collectible amount, terminal states, reconciliation, expiry/release and refund/reversal policy. Preserve the distinction between reported evidence, verified payment and posted ledger state.
2. **Implement verified status and recovery around the existing attempts.** Reuse IDs and audit infrastructure; add supported provider status checks, scheduled/authorized reconciliation, early/missing callback handling and explicit recovery for UNKNOWN/SUBMITTING. Resolve conflicting public claims without permitting them to settle invoices or permanently dictate verified outcomes.
3. **Integrate atomic, idempotent financial posting into existing billing.** Extend the approved billing payment contract for M-Pesa; link verified attempt/receipt to payment with database uniqueness; enforce transaction-capable deployment for payment/invoice/advance/audit updates. Invoke existing advance-processing rules for admission/procedure contexts. Avoid a parallel payment subsystem.
4. **Coordinate asynchronous payment with other invoice operations.** Define how an in-flight attempt affects manual collection, amount changes, cancellation, cross-environment attempts and late payment after invoice settlement. Add a receivable reservation or equivalent approved concurrency rule, plus an auditable exception/refund path.
5. **Add staff billing UI through the prescribed layers.** Extend API/types → service → domain hook → feature hook → page, with allowed phone normalization, retained idempotency keys/versions, clear “reported/unverified” versus “paid” states, bounded polling, conflict/retry handling, transaction details and verified receipt access. Never label STK acceptance as payment success.
6. **Add operational visibility and privacy controls.** Paginated attempt/event histories, age/status filters, restricted reconciliation actions, safe diagnostics/metrics, retention policy, and deployment-level data protection. Review tenant/branch/department requirements against the existing billing scope model before adding new assumptions.
7. **Expose patient payment only after the shared backend is complete.** Use patient ownership authorization for invoice/attempt access and compose the same central service. Restore/obtain mobile application source before planning its integration; do not treat generated remnants as editable product source.
8. **Verify the deployment and expand tests.** Safely configure documented environment names, enforce appropriate callback/public-host checks, validate hosted API routing and MongoDB topology, then perform an explicitly authorized controlled sandbox acceptance exercise. Add financial posting/replay/race/recovery/permission/insurance tests and browser persistence/receipt tests. Run the required project typecheck/lint/build checks during implementation phases.

The next implementation phase has **not** started. Application code, credentials, environment configuration, branch state and application database records were left unchanged.
