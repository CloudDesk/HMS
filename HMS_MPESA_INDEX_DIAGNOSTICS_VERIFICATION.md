# M-PESA index diagnostic refinement — 29 October 2026

## Findings / implemented

The user's native metadata contains both required unique indexes. A read-only
repository check also passed against the locally configured HMS_GENERAL on Node
22.19.0 and Node 26.12.1, using Mongoose 9.9.2. Automatic model/index creation was
disabled and createIndexes was replaced by a throwing guard for both checks.
The Node 26 test used the compiled repository, not a rewritten readiness check.
No live index/data writes were performed. This proves neither a Node
incompatibility nor that Render uses the identical URI, credentials or options.

The deployed INDEX_INITIALIZATION / UNCLASSIFIED log remains insufficient. The
previous classifier discarded unknown MongoDB codes and most fixed error types.
The correction now:

- Separates INDEX_INSPECTION from INDEX_BUILD at the repository boundary.
- Recognizes fixed Mongoose, driver, TypeError and ReferenceError categories.
- Retains bounded integer codes (0–100000) on actual MongoServerError instances,
  including public codes not in the original category map. Arbitrary generic
  error numeric properties are still omitted unless explicitly recognized.
- Adds diagnosticVersion: 2 to typed creation-error log entries so deployment of
  this diagnostic can be confirmed without inferring it from a generic stage.
- Keeps raw errors, messages, stacks, causes, connection strings, request bodies,
  headers, document/key contents and payment details out of logs/responses.

Existing AppError, sanitized route logger, repository constraints, transaction
helper, permissions, branch scope and isolated test fixtures are reused. Public
codes/envelopes and index/financial behavior are preserved. The real Render cause
is still unresolved; no repair is claimed from a locally passing check.

## Files / shared integration

- apps/api/src/modules/mpesa/mpesa-attempt-error.ts and its unit tests.
- apps/api/src/modules/mpesa/mpesa-attempt.repository.ts.
- apps/api/src/modules/mpesa/mpesa-attempt.routes.ts (server-only log marker).
- apps/api/src/modules/mpesa/mpesa-attempt.integration.test.ts.
- HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md and this refinement's gap/report.

No UI/HMS Local, lifecycle, credential, model/index-definition, database technology,
financial posting or clinical/FSD changes. Working tree was initially clean.

## Verification

Focused diagnostic/attempt tests: 70 passed across two files, including 18 new
cases. Command: npm run test --workspace=@hms/api --
src/modules/mpesa/mpesa-attempt-error.test.ts
src/modules/mpesa/mpesa-attempt.integration.test.ts --silent.

New cases cover fixed error classes, unknown public driver codes (197/303/8000),
invalid/data-like codes, generic numeric properties, JavaScript inspection errors,
and actual repository-to-HTTP server-only diagnostic/redaction. Existing tests
cover inspection/build failures, rollback, real index constraints, permissions,
branch scope, idempotency and preservation of transient transaction retries.
Tests use ephemeral MongoMemoryReplSet databases and mocked provider requests.

Focused ESLint and API/web typecheck/build pass. Web typecheck completed before
its build. Full project lint retains 48 baseline errors in
unchanged files: 42 in API insurance.repository.ts/service.ts/test.ts and six in
web PatientAvatar.test.tsx:8, AuthenticatedMediaImage.tsx:32,
PatientCardModal.tsx:3, PatientProfileHeader.tsx:3, PatientProfilePage.tsx:27 and
useMpesa.test.tsx:26. Earlier verification reports list the exact API baseline
locations. All five changed TypeScript files pass focused ESLint, and git diff
--check passes. No browser/manual payment acceptance, deployment or live
index repair was performed; the next feature phase has not started.

## Required next evidence

Render's effective database variable must match the local connection privately.
MONGODB_URI takes precedence over MONGODB_DATABASE_URL when both are defined.
Database name alone does not establish identical cluster, credentials or options.

Deploy this diagnostic revision, retry the identical create request with the same
UUID once, and capture the new diagnosticVersion:2 entry. INDEX_INSPECTION points
to metadata reads/classification; INDEX_BUILD points to additive index creation.
Use the resulting category and public code to diagnose the actual deployed fault.
Do not drop indexes or infer a permission repair from the current evidence.
