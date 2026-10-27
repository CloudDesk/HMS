# M-PESA attempts, submission and correlation — execution plan

26 October 2026. Authorized scope: the four ordered implementation steps in the
user request. Preserve existing uncommitted Step 5 code and all unrelated work.

Sources reconciled: PROJECT_RULES and AGENTS, existing Scope 2 release plan and
previously reviewed Developer 1 prompt; the release FSD remains absent. This
payment integration uses existing invoice/permission contracts and the explicit
user-approved scope; no clinical or deposit rules are introduced. Official
Daraja Express and Authorization documentation checked for current payloads.

## Reuse and gaps

- BillingRepository resolves active-user/branch scope and reads invoice state.
- Billing/Invoices CollectPayment and View permissions already exist.
- Callback events currently persist as UNMATCHED/UNVERIFIED without posting.
- No provider attempt model exists. One new collection is necessary; the Atlas
  collection-capacity issue must be resolved before deployment.
- Reuse existing Mongoose connection, transaction helper (require a real session,
  never its standalone fallback), existing audit collection, Zod, Fastify, Vitest.
- Existing frontend hook/service chain and Local billing patterns reviewed in
  Step 5. No UI changes requested here; staff APIs will support a later UI.

## Ordered implementation

1. Persist attempts tied to existing invoices, scoped reads, request fingerprint
   plus idempotency key, one unresolved attempt per invoice/environment.
2. Explicit version-checked submission claim, server-only OAuth/STK client,
   persisted provider IDs, uncertain submission never automatically retried.
3. Exact environment/checkout matching plus merchant/amount/payer consistency;
   event+attempt+audit transaction; retain conflicts and unmatched events.
4. Explicit transition map and tests for concurrency, stale actions, failures,
   rollback, early/duplicate callbacks, permissions and no financial posting.

Attempt creation and submission revalidate invoice eligibility. A small billing
repository helper acquires a conditional invoice write inside these transactions
to serialize against simultaneous invoice mutations; no financial values change.
External requests always occur outside transactions. Later cash payments or
invoice changes cannot reverse an already-sent request; recheck before correlation
and retain conflicts for future reconciliation.

Only server-configured branches may use the configured merchant. Defaults disable
outbound requests. KES amounts are positive whole shillings (reject fractions,
never round invoice amounts). No user-provided merchant, branch or callback URL.

Submission lifecycle: CREATED -> SUBMITTING -> PENDING | UNKNOWN | REJECTED.
SUBMITTING is claimed before OAuth; a crash keeps it locked and requires review.
No automatic resend or unlock on timeout/unverified callbacks. Only a definite
pre-send failure/provider rejection releases the active-attempt constraint.
Reported outcome is separate: PENDING -> SUCCESS | FAILED | CANCELLED | TIMEOUT;
different later outcomes/receipts are CONFLICT events, not overwrites. Verification
remains UNVERIFIED and posting DISABLED, including apparent successes.

Early callbacks remain durable; replay after IDs are attached, plus an authorized
bounded correlation endpoint for recovery. No manual checkout-ID reassignment,
status-query verification, financial posting, refunds or new UI in this scope.

Shared files: billing repository helper, module/service registries and env config.
New files: attempt model/repository/service/routes/schema, Daraja client, tests,
configuration helper and verification/runbook. No actual credentials configured.

## Execution result

Steps 1–4 implemented in order. See `HMS_MPESA_ATTEMPTS_VERIFICATION.md` for
automated results, existing lint failures and pending live sandbox acceptance,
and `HMS_MPESA_ATTEMPTS_RUNBOOK.md` for the staff API test sequence. Financial
posting remains disabled. The next verification/posting phase has not started.
