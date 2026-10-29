# M-PESA verification safety — 29 October 2026

Branch: DEV-GENERAL. Scope: verification corrections only.
Plan: HMS_MPESA_VERIFICATION_SAFETY_GAP_NOTE.md.

## Implemented

- Status-query ResultCode accepts bounded nonnegative integer numbers or canonical
  decimal strings. Null, booleans, blanks, objects/arrays, fractions, exponents,
  negative and oversized codes remain UNKNOWN. Descriptions are bounded.
- Query HTTP rejections return UNKNOWN / PROVIDER_QUERY_REJECTED. They cannot be
  interpreted as settlement failure or release an unresolved invoice's active lock.
  Submission rejection behavior remains unchanged.
- Every terminal outcome requires exact saved checkout and merchant request IDs,
  including cancellation, timeout and failure. Missing/mismatched IDs require review.
- Merchant environment, branch allowlist and shortcode/transaction snapshots are
  checked before verification network calls. A changed context returns the existing
  MPESA_MERCHANT_CONFLICT response.
- Previously established success/failure evidence survives later query uncertainty.
  Retain its outcome, verification provenance, trusted result/timestamp, recovery
  state and active flag. Verification attempt counters and audits still advance.
- Contradictory terminal results or late contradictory correlated callback evidence
  require review; existing conflicts cannot be cleared by repeating a successful
  query. Preserve the earlier trusted result for investigation.
- Rechecking POSTED success against a now-paid invoice does not falsely downgrade
  verification. Ledger state is never reversed by verification.
- The existing reconciliation verification path shares the safeguards, including
  an authentication-failure response arriving after concurrent staff verification.

## Reuse, files and boundaries

Reused existing client injection, repositories, optimistic version updates,
MongoDB transactions, audit infrastructure, staff permission/branch gates,
callback records and replica-set tests. No database schema/index or API payload
changes. No new dependencies or shared registries changed.

Changed files:
- apps/api/src/modules/mpesa/mpesa-daraja.client.ts
- apps/api/src/modules/mpesa/mpesa-attempt.service.ts
- apps/api/src/modules/mpesa/mpesa-daraja.client.test.ts
- apps/api/src/modules/mpesa/mpesa-reconciliation.integration.test.ts
- This report and the phase gap note.

No frontend or HMS Local UI changes were needed. Existing Firebase cache,
render.yaml and sandbox fixture document changes were preserved. No credentials,
live database records, deployment or Safaricom calls were changed/performed.

## Verification

Tests use injected HTTP responses and ephemeral MongoMemoryReplSet instances.
Integration cases exercise real transactions and the existing route/permission
infrastructure, with unchanged invoice balances/payment counts. They cover exact
IDs across every terminal outcome, query errors, malformed parsing through the
service, lock retention, duplicate evidence, conflicting outcomes, overlapping
queries, delayed authentication failures, existing conflicts, paid/posted
snapshots, merchant configuration changes and existing audit rollback cases.

Final M-PESA/config suite: 147 tests passed across 7 files (54 new cases).
Command: npm run test --workspace=@hms/api -- src/config/mpesa-outbound.test.ts src/modules/mpesa --silent.
API and web typechecks and builds passed. Focused ESLint and diff whitespace
checks passed. The standalone web typecheck rerun passed after the parallel-build
artifact write conflict described below.

Full lint baseline remains outside this phase:
- API: 42 errors in insurance.repository.ts (unused import, line 13),
  insurance.service.ts (18 explicit-any errors) and insurance.test.ts (23
  explicit-any errors). Same baseline described in HMS_MPESA_ATTEMPTS_VERIFICATION.md.
- Web: 6 errors: PatientAvatar.test.tsx:8 and AuthenticatedMediaImage.tsx:32
  explicit-any; unused patientInitials in PatientCardModal.tsx:3,
  PatientProfileHeader.tsx:3 and PatientProfilePage.tsx:27; unused useMpesaAttempt
  import in hooks/billing/useMpesa.test.tsx:26.
- None of those files changed in this phase. Focused ESLint over all four changed
  TypeScript files passes.
- The first parallel web typecheck/build encountered a tsconfig.tsbuildinfo write
  conflict. Web typecheck was rerun alone after the build; no generated file was
  edited manually.

## Remaining dependencies

This phase does not repair historical attempts that may have been verified using
the old rules; those require evidence review. Manual conflict resolution remains
an operational dependency. The remaining audit findings—transaction-time posting
checks, partial-payment lock release, reconciliation scope/scheduling/backoff and
frontend response/recovery contracts—remain for separately approved phases.

No next phase has started. Live sandbox acceptance and production readiness are
not claimed from isolated automated tests.
