# M-PESA attempts verification — 26 October 2026

## Status

The four requested backend steps are implemented. Automated verification passes
for the phase-owned code. Live Daraja sandbox acceptance remains pending; this
is not a production go-live or confirmation of trusted payment verification.
No subsequent verification/posting phase has started.

## Functionality and reused foundations

- Invoice-linked durable attempts with branch-scoped invoice reads, server-side
  validation of status/balance, payer/environment/user context, idempotency and
  partial unique indexes preventing unresolved duplicates.
- Backend-only OAuth and STK payload construction. Explicit submission claim
  before network calls; no external network calls inside transactions. Provider
  IDs stored after acceptance. Timeout/ambiguous response becomes UNKNOWN.
- Exact environment + checkout matching, merchant/amount/supplied-phone checks,
  invoice consistency, durable unmatched/conflicting callbacks and early replay.
- Versioned compare-and-set transitions and atomic attempt/event/audit changes.
  Transactions require replica-set/mongos; standalone fallback is refused.
- Existing Billing/Invoices CollectPayment and View permissions, active-user
  branch scope, invoices, audit storage, Mongo connection, callback persistence,
  rate limiter, response/error conventions reused. No new permissions required.
- Financial posting disabled: no BillingPayment insert, paid amount increment,
  balance reduction or invoice status change. The invoice concurrency lock only
  increments its internal __v and suppresses timestamp updates.
- Safe error codes, masked phone responses, request-log redaction, no provider
  secrets or raw response/error text exposed. No frontend changes or HMS Local
  changes; UI patterns were not needed for these backend endpoints.

## Modules/files

New `apps/api/src/modules/mpesa/mpesa-attempt.{model,repository,service,routes,schemas}.ts`,
`mpesa-daraja.client.ts`, their integration/client tests, and
`apps/api/src/config/mpesa-outbound.ts`.

Existing callback model/repository/service extended for correlation.
Shared changes: `apps/api/src/config/env.ts`, billing repository concurrency helper,
module registry, service registry implementation and its type. Existing callback
registration and earlier rate-limit changes retained. Existing collection
inventory documents and unrelated work preserved. New gap note, runbook and this
verification document describe the current work.

## Automated verification

- API typecheck: PASS.
- API build: PASS.
- Web typecheck: PASS.
- Web build: PASS.
- Focused ESLint over M-PESA, config and changed shared files: PASS.
- M-PESA and auth-rate-limit suite: 47 tests passed before adding two more
  creation-concurrency/rollback cases.
- Final attempt integration suite: 17 cases; billing-context-index regression:
  4 cases. Together with the unchanged passing suites, 53 distinct tests pass.
- Tests use isolated Mongo memory servers, including a real single-node replica
  set for transactions, with injected provider responses. No Atlas test writes
  or real Safaricom requests were made.
- Coverage includes branch/permission denial, HTTP routes, invalid amounts and
  invoice statuses, idempotency input conflicts, same/different-key concurrent
  creation, competing submit requests, stale versions, OAuth failure, invoice
  change after OAuth, uncertain submission, early callbacks, duplicate delivery,
  metadata conflicts, rollback on audit failure, recovery replay, accepted-response
  persistence failure, no financial posting, and Daraja transport contract.

Full lint is blocked by pre-existing unrelated issues, with none in phase files:

- API: 42 errors. `insurance.repository.ts:13` unused import;
  `insurance.service.ts` explicit-any errors at 376, 377, 426–429, 644–647,
  684, 711, 749, 819–820, 917–919; `insurance.test.ts` explicit-any errors at
  8, 9, 59, 950, 991, 1016, 1098, 1182, 1205, 1225, 1356, 1398, 1430, 1462,
  1537, 1670, 1716, 1744, 1767, 1781, 1786, 1787, 2197.
- Web: 5 errors. `PatientAvatar.test.tsx:8` and
  `AuthenticatedMediaImage.tsx:32` explicit-any;
  `PatientCardModal.tsx:3`, `PatientProfileHeader.tsx:3`,
  `PatientProfilePage.tsx:27` unused patientInitials imports.

## Outstanding acceptance/dependencies

Run the Postman sequence in `HMS_MPESA_ATTEMPTS_RUNBOOK.md` after configuring
sandbox credentials, an authorized branch and public HTTPS callback. Confirm
database capacity for the new collection and unique indexes. Test persistence
across real API restart and logout/login. Browser/responsive tests do not apply
to this API-only scope; no live browser/payment acceptance is claimed.

UNKNOWN, stuck SUBMITTING, and reported outcomes remain locked for subsequent
trusted reconciliation. The bounded correlation endpoint only processes already
stored matching events; it cannot reconstruct missing checkout IDs or establish
trusted payment success. Implement trusted verification and approved financial
posting separately before enabling actual invoice settlement.
