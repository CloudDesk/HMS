# M-PESA reconciliation safety verification — 29 October 2026

## Implemented functionality

Reconciliation claims intersect the merchant branch allowlist with current staff
branch scope. Scope is rechecked before provider queries and inside the result
transaction. The existing CollectPayment permission remains required by the HTTP
endpoint. Background sweeps use the merchant allowlist without impersonating staff.

Due times now apply to UNKNOWN and PENDING attempts with either UNVERIFIED or
UNRESOLVED verification. Claims atomically reserve a retry and increment version;
crashes consume a reservation instead of allowing unlimited queries. The retry
budget remains five. Delays after reservations 1–5 are 30/60/120/240/300 seconds;
an uncertain fifth result goes directly to manual review. An expired fifth lease
is moved to review without a sixth provider request. Uncertain attempts retain
their invoice lock. Fresh SUBMITTING attempts have a two-minute grace period,
beyond the normal OAuth/STK transport deadlines, before recovery can claim them.

Each sweep has a unique owner. Result updates require the same unexpired
60-second lease, timestamp, version and saved attempt context, including payer,
amount and merchant/request identifiers. Late results cannot overwrite newer
verification or another worker's claim. Lease release matches the exact owner
and timestamp; failed processing backs off instead of immediately reclaiming.
Claims and completed evidence are audited transactionally. Worker attribution is
explicit, and manual-review audit statuses reflect the saved result.

Durable unmatched callbacks are replayed before querying. Missing checkout IDs,
merchant drift, conflicts and exhausted retries require review. Recovery never
reconstructs provider IDs, resends STK Push or invokes financial posting.

An optional standalone-server worker runs bounded batches without local overlap,
stops claiming between attempts on shutdown and drains in-flight work before
database closure. Multiple server processes coordinate through MongoDB leases.
Errors are logged with a fixed code rather than raw provider data.

## Existing functionality reused

Existing MongoDB connection, Mongoose transactions, attempt repository and version
checks, verification policy, callback replay, BillingRepository branch scope,
CollectPayment route guard, audit infrastructure and server lifecycle. No new
collection, database technology, financial subsystem or lifecycle enum.

## Files/modules changed

- apps/api/src/modules/mpesa/mpesa-attempt.repository.ts
- apps/api/src/modules/mpesa/mpesa-attempt.service.ts
- apps/api/src/modules/mpesa/mpesa-attempt.model.ts (nullable lease/due types)
- apps/api/src/modules/mpesa/mpesa-reconciliation.policy.ts
- apps/api/src/modules/mpesa/mpesa-reconciliation.worker.ts
- apps/api/src/modules/mpesa/mpesa-reconciliation.worker.test.ts
- apps/api/src/modules/mpesa/mpesa-reconciliation.integration.test.ts
- Shared integration: apps/api/src/config/mpesa.ts, config/env.ts and server.ts.
- HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md, this report and the gap note.

Prior verification/posting edits and unrelated Firebase, Render and test-record
changes were preserved. No frontend or HMS Local prototype modifications were
needed; existing UI patterns remain unchanged.

## Configuration

The scheduler is disabled by default. Optional server settings:

```dotenv
MPESA_RECONCILIATION_ENABLED=true
MPESA_RECONCILIATION_INTERVAL_MS=30000
MPESA_RECONCILIATION_BATCH_SIZE=10
```

Enabling it requires MPESA_STK_ENABLED=true and the existing validated merchant
configuration. Interval accepts 1000–300000 ms; batch size accepts 1–50. The timer
starts after the standalone API listens, with its first sweep after the interval.
It runs while that process is alive; serverless handlers do not start this timer.
No environment file, deployed setting or service was changed during this phase.

## Automated checks and manual acceptance

- Full M-PESA/config suite: 213 tests passed across 8 files, including 35 new
  regressions (29 integration and 6 worker/config tests).
- Command: npm run test --workspace=@hms/api -- src/modules/mpesa
  src/config/mpesa.test.ts src/config/mpesa-outbound.test.ts --silent.
- Tests use ephemeral MongoMemoryReplSet databases and injected provider results.
- New cases cover HTTP permission/branch isolation, scope revocation during OAuth
  and query, due times across uncertain states, retries and crash exhaustion,
  concurrent claims, takeover and stale release, expired claims, query failures,
  claim/completion audit rollback, merchant drift, callback replay, worker audit
  attribution, immutable payer changes, cancellation, bounded limits, fresh
  submission protection, terminal/conflict exclusion, timer overlap/shutdown and
  default-off configuration. Each integration regression asserts no payment
  creation or invoice balance/status change, and no STK resubmission.
- API/web typecheck and build, focused ESLint and whitespace check: see final
  execution outcome below.
- Full project lint retains 48 pre-existing errors in unchanged files: API 42
  (insurance.repository.ts:13, 18 explicit-any errors in insurance.service.ts,
  23 in insurance.test.ts); web 6 (PatientAvatar.test.tsx:8,
  AuthenticatedMediaImage.tsx:32, unused imports in PatientCardModal.tsx:3,
  PatientProfileHeader.tsx:3, PatientProfilePage.tsx:27 and useMpesa.test.tsx:26).
  These match the prior posting report; phase-owned files pass focused ESLint.
- HTTP behavior was exercised through Fastify injection. No live manual/browser,
  sandbox-provider or production payment acceptance was performed. No live
  database writes, credentials, provider calls or deployment were needed.

## Remaining dependency / next phase

Frontend recovery/exception contracts, operator resolution of disputed funds,
refunds/reversals, historical repairs and live sandbox/production acceptance
remain outside this correction. No bulk migration was run. Runtime scheduling
still requires deliberate configuration on an always-running server.

The next phase has not started. Changes are local and have not been deployed.

## Final execution outcome

After the final manual-review audit consistency adjustment, all 64 reconciliation
integration tests passed again. Final API typecheck/build and focused ESLint also
passed. Web typecheck completed before its build; both passed. All phase-owned
files passed focused ESLint and git diff --check. Full project lint retains only
the 48 unchanged-file baseline errors described above. Live acceptance remains
outstanding; this report does not certify production readiness.
