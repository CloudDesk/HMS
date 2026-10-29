# M-PESA billing-posting safety — 29 October 2026

Authorized scope: transaction-time settlement validation, safe posting retries and
active-lock release after commit, with regression tests. Follow PROJECT_RULES,
AGENTS and the existing release plan; reuse approved billing/payment contracts.
The preceding verification safety edits and unrelated work remain intact.

Reuse MpesaPostingService, versioned attempt repository, BillingRepository,
existing partial unique payment indexes, advance-payment sync, receipt service,
staff permission/branch scope, transactions and audit. Frontend API/hook contracts
and HMS Local billing patterns were inspected in the preceding audit; no UI or
prototype change is required. Existing ledger remains the only payment ledger.

Gaps: settlement checks occur before the transaction, exception/failure updates
can overwrite newer state, POSTED retains active=true, and duplicate posting can
return a missing/inconsistent linked payment. These paths will be validated from
the transaction's current attempt/invoice snapshot. Reject stale evidence or
retargeted context, require trusted query plus callback receipt context, recheck
staff branch access, and validate existing ledger linkage before idempotent return.

Move invoice exception decisions/audits into the same versioned transaction.
Retain exception locks. Only committed POSTED transitions release active=false;
rollback must retain the lock. Failure annotation must use the exact attempted
version and preserve concurrent verification/manual-review/posted state.

Intended files: posting service, its integration tests, this note and a verification
report. No model/index, API/permission registry, scheduler, frontend, credentials,
deployment or live-record changes. Test with an isolated replica set and injected
provider responses. Verify a second partial payment, duplicates/races, stale
verification/receipt/context, rollback/retry and advance-payment atomicity.

Next phases (reconciliation and frontend fixes) remain outside this authorization.

Execution: implemented in the posting service and integration tests. Full suite:
178 passing cases; final posting rerun: 52 passing cases (31 new). A validated
idempotent retry also repairs a legacy POSTED active lock without moving funds.
See HMS_MPESA_POSTING_SAFETY_REPORT.md for final checks and outstanding dependencies.
