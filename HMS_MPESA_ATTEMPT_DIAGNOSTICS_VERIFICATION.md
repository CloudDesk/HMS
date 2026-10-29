# M-PESA attempt creation diagnostic correction — 29 October 2026

## Finding

The supplied Postman responses show an existing PENDING Main Branch invoice with
KES 1 outstanding and no attempt at the calculated sandbox ID. The Render request
req-2j returned MPESA_ATTEMPT_UNAVAILABLE but its logs omitted the underlying
failure. This confirms the acceptance flow is blocked during creation, not a
completed STK submission. It does not prove an index, database permission or
transaction fault. Read health checks from the preceding investigation do not
establish write access or the deployed revision.

## Implemented / reused

The existing create service now tracks fixed stages for invoice lookup, model/index
initialization, transaction start, attempt lookup, invoice revalidation/lock,
attempt write/readback, audit, transaction commit, duplicate lookup and result
read. Unexpected errors are classified only after MongoDB's transaction/retry
handling has completed. Existing AppError validation, permission, configuration
and conflict responses are preserved, as is duplicate-create behavior.

The existing route logger adds a server-only diagnostic object for this typed
error. Categories and numeric database codes are allowlisted. Raw messages,
stacks, causes, document/key values, connection strings and request payloads are
never copied. The public error keeps MPESA_ATTEMPT_UNAVAILABLE with HTTP 503 and
the existing response envelope; it contains no diagnostic object.

Reuses AppError, Fastify logging, existing repository boundaries, permissions,
branch scope, transaction helper and integration fixtures. No data repair,
transaction bypass, index deletion, credential changes or payment resubmission.

## Files / shared integration

- apps/api/src/modules/mpesa/mpesa-attempt-error.ts and its unit tests.
- apps/api/src/modules/mpesa/mpesa-attempt.service.ts (creation diagnostics only).
- apps/api/src/modules/mpesa/mpesa-attempt.routes.ts (sanitized error log).
- apps/api/src/modules/mpesa/mpesa-attempt.integration.test.ts.
- HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md and diagnostic gap/verification
  notes. No other shared registry, permission, model, index or API schema changes.

Previous verification/posting/reconciliation and unrelated working-tree changes
were preserved. No UI/HMS Local changes or prototype patterns were required.

## Validation

Focused diagnostic/attempt tests: 43 passed across two files. The 26 new cases
cover allowlisted codes and names, unknown/malicious values, server-only output,
redaction of token/phone/raw errors, index/write/audit failure stages, rollback
and preservation of a labeled transient MongoDB transaction retry. Existing
permission, scope, idempotency, callback and submission tests continue to pass.

Tests use injected provider results and an isolated MongoMemoryReplSet. No live
database writes, provider requests, deployment or browser/manual payment tests
were performed in this correction. The next frontend phase has not started.

Full M-PESA/config suite: 239 tests passed across 9 files, using
`npm run test --workspace=@hms/api -- src/modules/mpesa src/config/mpesa-outbound.test.ts --silent`.
API and web typecheck/build all passed. Web typecheck completed before its build.
Focused ESLint for all five changed/new TypeScript files and git diff --check pass.
Full project lint retains the same 48 pre-existing errors in unchanged files:
42 in insurance.repository.ts/service.ts/test.ts and 6 in web patient/media and
useMpesa.test.tsx files. Exact baseline locations are recorded in the preceding
posting/reconciliation verification reports. No phase-owned lint errors remain.

## Required deployed follow-up

Deploy this diagnostic patch to the Render test backend. Retry the identical
create body using the same UUID once. If it fails, capture the new request ID and
the log's diagnostic.stage, diagnostic.category and diagnostic.databaseCode.
Do not assume the example below is the actual cause:

```json
{
  "code": "MPESA_ATTEMPT_UNAVAILABLE",
  "diagnostic": {
    "stage": "INDEX_INITIALIZATION",
    "category": "INDEX_OPTIONS_CONFLICT",
    "databaseCode": 85
  }
}
```

The specific Render fault remains unresolved until that deployed evidence is
available. Do not drop indexes or change database permissions based on a guess.
