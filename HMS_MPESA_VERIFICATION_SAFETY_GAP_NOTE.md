# M-PESA verification safety — 29 October 2026

Authorized phase: verification safety fixes and tests only, on DEV-GENERAL.
Read PROJECT_RULES, AGENTS and the release execution plan; previously reviewed
release ownership documents remain unchanged. This narrowly scoped correction
uses the existing M-PESA contract and introduces no clinical/FSD decisions.

Reuse the Daraja client, attempt repository, versioned transaction updates,
staff permissions/branch scoping, callback evidence, audit and isolated replica-set
tests. Frontend API/hooks and billing prototypes were reviewed during the audit;
no UI changes are needed for these backend verification corrections.

Gaps to fix in order:
1. Reject null/boolean/empty/malformed result codes; accept bounded integers or
   their canonical decimal strings. HTTP query errors never prove payment failure.
2. Require exact checkout and merchant IDs for every terminal query outcome.
3. Preserve established terminal evidence through uncertain or duplicate queries;
   contradictory terminal results and existing conflicts require manual review.
4. Reject verification with changed merchant/environment context before querying.
5. Cover actual client parsing through verification, stale/concurrent observations,
   audit rollback, retained invoice lock and absence of financial mutation.

Intended files: Daraja client and its tests; attempt service; reconciliation
integration tests; this plan and a verification report. No schema/index, posting,
reconciliation scheduling/branch claiming, frontend, credentials, deployment or
live payment changes. Remaining audit findings are deferred to separate phases.

Policy: only a valid terminal result with matching IDs can establish or contradict
trusted outcome evidence. Query rejection/timeouts/pending responses cannot unlock
an unresolved payment or erase trusted evidence. Conflict review cannot be cleared
by simply repeating verification. Receipt/amount verification and financial
posting retain their existing contracts; these fixes do not establish production
readiness or provide a manual conflict-resolution workflow.

Execution: implementation and 54 regression cases added. Final isolated suite
passes 147 tests across 7 files. Verification evidence and remaining dependencies
are in HMS_MPESA_VERIFICATION_SAFETY_REPORT.md. Next phase has not started.
