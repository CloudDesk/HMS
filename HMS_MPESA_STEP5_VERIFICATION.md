# M-PESA Step 5 verification

Date: 26 October 2026

Status: callback intake implemented and verified against isolated real MongoDB
and local HTTP. Public Safaricom acceptance is pending. This is not a complete
M-PESA collection/verification/billing integration.

## Phase status

| Phase | Result |
|---|---|
| 1 Analyze | Complete; see gap note for architecture and existing contracts |
| 2 Callback API | Implemented and tested at POST /api/payments/mpesa/callback |
| 3 Persistence | Majority/journaled atomic upsert, indexes, immutable conflicting events |
| 4 Correlation | Safe UNMATCHED storage implemented; genuine matching deferred because no originating provider attempt exists |
| 5 Outcome handling | Reported result mapping implemented; all evidence remains unverified; no billing posting |
| 6 Security | Strict validation, 16 KiB limit, MongoDB throttling, safe logs/errors, existing authentication preserved |
| 7 Configuration | Validated sandbox/production label and limits; no OAuth prerequisite |
| 8 Automated testing | Passed focused callback, database, HTTP, authentication and billing regressions |
| 9 Local Postman | Exact instructions supplied; equivalent real HTTP test executed automatically, Postman UI not operated |
| 10 Public HTTPS | Runbook supplied; actual tunnel/provider callback not executed |

## Verification executed

- Six-file focused suite: 37 tests passed (M-PESA unit/integration, existing auth
  limiter unit/integration, collect-payment validation, advance-payment tests).
- Added explicit concurrent bucket-creation regression afterwards: auth limiter
  file rerun, 5 tests passed.
- Added log-privacy regression afterwards: M-PESA unit file rerun, 15 tests passed.
  Together the six files now contain 39 passing test cases across these runs.
- M-PESA MongoDB integration: 5 tests passed, including full buildApp route
  registration, real TCP HTTP listener, callback persistence, restart/retry,
  12 concurrent duplicate deliveries, metadata reordering, conflicting results,
  wrong amounts/free-text reference mismatch, unchanged invoice/payment records,
  hidden default phone selection, public-only route auth behavior and spoofed
  forwarding-header rate-limit protection.
- Unit cases include cancellation/timeout/failure mapping, missing IDs/result
  fields, strict types, malformed JSON, oversized bodies, unsupported content
  types, duplicate metadata, invalid dates/amounts/phones, missing optional
  metadata, deferred acknowledgment, storage failure 503, rate limiting 429,
  configuration validation and no sensitive body/query/header/error logs.
- Tests use synthetic data and an isolated mongodb-memory-server process.
  No Safaricom API calls or real payments were made. No existing development
  patient/financial database was modified by verification.

| Required command | Result |
|---|---|
| npm run typecheck --workspace=@hms/api | PASS after implementation fixes |
| npm run lint --workspace=@hms/api | FAIL: 42 pre-existing insurance errors, listed below |
| npm run build --workspace=@hms/api | PASS after implementation fixes |
| npm run typecheck --workspace=@hms/web | PASS |
| npm run lint --workspace=@hms/web | FAIL: 5 pre-existing errors, listed below |
| npm run build --workspace=@hms/web | PASS |
| Targeted ESLint over every changed/new TypeScript file | PASS |
| git diff --check | PASS |

The initial callback run exposed false throttling during simultaneous creation
of a shared rate-limit bucket. Fixed with a conditional non-upsert retry on
duplicate key; full buckets still reject requests. Existing login and OTP limit
tests passed after the fix. Initial TypeScript issues in the new Mongoose
boolean validator and Fastify logger/reply typing were fixed before final checks.

## Pre-existing lint failures

These files have no changes in this task's git diff; the working tree was clean
at the start. They are outside the authorized callback scope.

API (42):
- `modules/insurance/insurance.repository.ts:13`: unused EligibilityVerificationFields.
- `modules/insurance/insurance.service.ts`: 18 no-explicit-any errors at lines
  376, 377, 426, 427, 428, 429, 644, 645, 646, 647, 684, 711, 749, 819, 820,
  917, 918, 919.
- `modules/insurance/insurance.test.ts`: 23 no-explicit-any errors at lines
  8, 9, 59, 950, 991, 1016, 1098, 1182, 1205, 1225, 1356, 1398, 1430,
  1462, 1537, 1670, 1716, 1744, 1767, 1781, 1786, 1787, 2197.

Web (5):
- `components/patients/PatientAvatar.test.tsx:8`: no-explicit-any.
- `components/patients/PatientCardModal.tsx:3`: unused patientInitials.
- `components/patients/PatientProfileHeader.tsx:3`: unused patientInitials.
- `components/ui/AuthenticatedMediaImage.tsx:32`: no-explicit-any.
- `pages/PatientProfilePage.tsx:27`: unused patientInitials.

No claim is made that the entire repository is lint clean or that the full
unrelated test suite was run.

## Created files

- `apps/api/src/modules/mpesa/mpesa-callback.schemas.ts`
- `apps/api/src/modules/mpesa/mpesa-callback.model.ts`
- `apps/api/src/modules/mpesa/mpesa-callback.repository.ts`
- `apps/api/src/modules/mpesa/mpesa-callback.service.ts`
- `apps/api/src/modules/mpesa/mpesa-callback.routes.ts`
- `apps/api/src/modules/mpesa/mpesa-callback.test.ts`
- `apps/api/src/modules/mpesa/mpesa-callback.integration.test.ts`
- `apps/api/src/config/mpesa.ts`
- `HMS_MPESA_STEP5_GAP_NOTE.md`
- `HMS_MPESA_STEP5_RUNBOOK.md`
- `HMS_MPESA_STEP5_VERIFICATION.md`

## Modified shared files

- `apps/api/src/config/env.ts`: validated callback settings.
- `apps/api/src/modules/index.ts`: route registration.
- `apps/api/src/shared/services/service-registry.ts`: callback dependencies.
- `apps/api/src/shared/types/service-registry.ts`: service type.
- `apps/api/src/modules/auth/auth-rate-limit.repository.ts`: concurrent bucket retry.
- `apps/api/src/modules/auth/auth-rate-limit.test.ts`: concurrency regression.

## Preserved behavior and remaining dependencies

Existing billing enums, contracts, invoice/payment/advance-payment operations,
permissions, frontend and Local prototypes remain unchanged. The new service
has no Billing dependency. Database integration proves existing invoices and
payments remain unchanged even when callbacks claim success with a matching
free-text payment reference or a different amount. No UI was added, so browser
visual acceptance is not applicable to this slice.

Provider-attempt creation, trusted matching and verification, authorized
reconciliation, and transactional billing posting remain Step 6 work. Public
callback verification requires a client-controlled reachable HTTPS endpoint
and a fresh sandbox STK request. Review operational retention, encrypted DB
storage/transport, access controls and ingress limits before production use.
See the runbook for exact Postman/Compass/tunnel steps and error responses.

Step 6 has not started. No production deployment or real-money test occurred.
