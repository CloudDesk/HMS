# M-PESA reconciliation safety — 29 October 2026

Authorized phase: branch-scoped reconciliation, due-time/retry enforcement,
fenced worker leases, bounded scheduled processing and tests. Preserve the prior
verification/posting work and unrelated working-tree edits. PROJECT_RULES, AGENTS,
the release plan and existing payment contracts govern this correction; no new
clinical/FSD contract or financial subsystem is needed.

Reuse existing MongoDB connection, attempt repository/verification transactions,
audit, staff CollectPayment permission and branch scope. Existing frontend hooks
and API contracts were inspected; this backend phase requires no UI or HMS Local
changes. The standalone server's existing timer/shutdown lifecycle provides the
scheduling integration point; no external queue/cache/cron infrastructure.

Gaps and intended implementation:
- Claim only authorized merchant branches intersected with current staff scope.
  Recheck scope before provider requests and before applying results.
- Apply nextReconciliationAt to every eligible state, including UNKNOWN and
  UNRESOLVED/PENDING. Reserve each retry atomically when claiming, so crashes
  consume the bounded budget. Expired exhausted claims go to review without queries.
- Use unique invocation ownership, lease timestamps and versioned/fenced updates.
  Expired/superseded results cannot clear another worker's lease or overwrite
  staff verification/posting. Keep invoice locks for uncertain outcomes.
- Wait two minutes before treating SUBMITTING as stuck, beyond normal OAuth/STK
  request deadlines; never resend an STK request or reconstruct provider IDs.
- Add an opt-in server timer, bounded batch size, no overlapping local sweeps,
  abort between attempts and drain current work before database shutdown.

Intended files: attempt repository/service/model nullable types, reconciliation
policy/worker and tests, M-PESA config/env, minimal server lifecycle wiring,
integration regressions and phase report. Existing indexes support eligibility;
no new collection, financial posting path, credentials or deployment changes.

Default scheduler remains off. Opt-in requires existing enabled merchant config.
All tests use synthetic data and isolated MongoDB or injected services. Next
frontend phase remains unstarted.

Execution outcome: implemented the scoped recovery, retry reservations/backoff,
lease fencing, safe callback replay and opt-in worker described above. The full
M-PESA/config suite passed 213 tests, including 35 new regressions. After the final
audit-status adjustment all 64 reconciliation integration tests passed again.
API/web typecheck and build and focused ESLint passed. Full project lint retains
48 pre-existing errors in unchanged files. See
`HMS_MPESA_RECONCILIATION_SAFETY_REPORT.md` for files, configuration, evidence and
live acceptance limitations. No deployment or next-phase implementation occurred.
