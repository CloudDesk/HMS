# M-PESA billing-posting safety — 29 October 2026

Branch: DEV-GENERAL. Authorized scope: billing-posting safety and tests only.
Plan: HMS_MPESA_POSTING_SAFETY_GAP_NOTE.md.

## Implemented functionality

- Revalidate staff branch access and the current invoice/attempt relationship
  inside the posting transaction and on every MongoDB retry.
- Require current VERIFIED/query-success evidence, a valid verification timestamp
  and QUERY/RECONCILIATION provenance, successful correlated callback receipt,
  provider IDs, positive whole KES amount and eligible active/submission/posting
  states. Manual-review/conflict states block new financial posting.
- Reject changed attempt version, receipt, amount or provider/invoice context
  since preflight rather than settling using stale evidence.
- Determine cancelled/already-paid/over-balance exceptions transactionally.
  Persist review state and audit together before returning the existing error
  codes; retain the active lock. A stale exception cannot overwrite POSTED state.
- Commit payment, invoice balance/status, admission/procedure advance sync,
  POSTED linkage, active=false and audit in one transaction. A successful partial
  payment permits another separately created/verified attempt for the balance.
- Validate persisted payment/attempt/provider/invoice linkage before idempotent
  success. Missing/inconsistent linkage requires review and cannot create another
  payment. Legacy POSTED attempts that still have active=true can release that
  lock on a validated idempotent retry, with a one-time audit and no ledger change.
- A rolled-back posting retains its lock. Failure annotation is version-checked,
  sanitized and audited transactionally; it cannot overwrite newer POSTED or
  review/verification state. Retrying after recovery posts at most once.

## Existing functionality reused

Existing Mongoose connection and transaction helper (real session required),
MpesaAttemptRepository version updates, BillingRepository and unique payment
indexes, invoice application, AdvancePaymentService, billing receipts, staff
permission gates, branch scope and audit. No duplicate financial subsystem.

## Files/modules changed

- apps/api/src/modules/mpesa/mpesa-posting.service.ts
- apps/api/src/modules/mpesa/mpesa-posting.integration.test.ts
- This report and HMS_MPESA_POSTING_SAFETY_GAP_NOTE.md.

No shared registry, permission, API schema, model/index, frontend or HMS Local
prototype changes. Previous verification-safety edits and unrelated Firebase,
Render and test-record documentation changes were preserved. No UI patterns
needed modification for this backend-only phase.

## Verification

- Full M-PESA/config suite: 178 tests passed across 7 files, including 31 new
  posting regressions. Command: npm run test --workspace=@hms/api --
  src/config/mpesa-outbound.test.ts src/modules/mpesa --silent.
- Final posting integration rerun after audit adjustments: all 52 tests passed.
- Tests use an ephemeral MongoMemoryReplSet and injected provider results.
- Cases cover evidence changes between preflight and transaction, an actual
  MongoDB snapshot conflict/retry, staff scope revocation, invalid/missing/changed
  receipt and provider details, cancellation exceptions, two verified partial
  payments totaling the invoice, competing new attempts, duplicate/concurrent
  posting, legacy lock recovery, missing/corrupt ledger linkage, procedure advance
  rollback/retry, audit outage, and preserving newer POSTED/manual-review state.
- Existing HTTP permission, admission advance, invoice balance, receipt and
  restart/idempotency tests continue to pass. No live manual/provider payment or
  browser testing was performed; no UI changed. No live database writes,
  credentials, STK requests or deployments were part of this phase.
- Focused ESLint for both changed TypeScript files and diff whitespace checks pass.
- API typecheck/build and web typecheck/build: PASS. Web typecheck completed
  before starting its build, avoiding shared build-info artifact contention.

Full project lint still has 48 pre-existing errors, in files unchanged here:
- API: 42 errors in insurance.repository.ts:13 (unused import),
  insurance.service.ts (18 explicit-any errors) and insurance.test.ts (23).
  Exact locations are listed in HMS_MPESA_ATTEMPTS_VERIFICATION.md.
- Web: 6 errors: PatientAvatar.test.tsx:8 and AuthenticatedMediaImage.tsx:32
  explicit-any; unused patientInitials in PatientCardModal.tsx:3,
  PatientProfileHeader.tsx:3, PatientProfilePage.tsx:27; unused useMpesaAttempt in
  hooks/billing/useMpesa.test.tsx:26. Same baseline as the verification-safety phase.

## Remaining dependency / next phase

Reconciliation branch scoping, scheduling/backoff and frontend exception/recovery
contract fixes remain separate, unstarted phases. These posting fixes do not
resolve disputed funds, implement refunds/reversals, repair missing ledger records
or retroactively validate old evidence. No bulk historical migration was run.
Production readiness and live sandbox acceptance remain separate verification.

The next phase has not started. Changes are local and have not been deployed.
