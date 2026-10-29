# M-PESA live index readiness correction — 29 October 2026

## Implemented / evidence

Render's supplied diagnostic identifies INDEX_INITIALIZATION / UNCLASSIFIED.
The invoice GET is payable and the deterministic attempt GET is not found. The
exact underlying initialization error remains unknown; this correction does not
claim the log proves a cached failure or a particular database permission fault.

The previous readiness check only awaited Model.init(). Installed Mongoose source
caches that promise, including rejection, and can skip index creation when
autoIndex is disabled. Neither outcome alone proves current live constraints.

The repository now inspects live index metadata and checks the unique indexes
declared by the attempt model: active invoice/environment uniqueness and
environment/checkout uniqueness restricted to string checkout IDs. Key order,
uniqueness and partial predicates must match. Nonunique, sparse, expiring or
nondefault-collation alternatives are not accepted. Equivalent names are allowed.

When constraints are present, request processing does not consult the cached
initialization promise or rebuild indexes. When absent (including a missing
collection), the public additive createIndexes() API creates declared indexes,
then live metadata is checked again. It never drops/replaces existing indexes.
Conflicts and permission/read/build failures block attempt creation. A build
that returns without establishing the constraints produces HTTP 503 with
MPESA_INDEXES_NOT_READY. Other errors retain sanitized creation-stage diagnostics.

## Reused / files

Existing Mongoose model index declarations and connection, repository boundaries,
AppError, creation diagnostics, real transaction/audit behavior and test fixtures.

- apps/api/src/modules/mpesa/mpesa-attempt.repository.ts
- apps/api/src/modules/mpesa/mpesa-attempt.integration.test.ts
- Shared documentation: HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md and this
  correction's gap/verification notes.

No schema/index-definition, business transition, auth, branch scope, transaction,
posting, UI or HMS Local changes. No next phase was started. The initial working
tree was clean; unrelated code was not modified.

## Automated and manual validation

Nine new integration regressions use a real isolated MongoMemoryReplSet:

- Rejected cached init with valid live indexes still permits safe creation.
- Missing unique index is rebuilt with autoIndex disabled and cached init.
- Genuinely absent collection gets indexes before transactional creation.
- Correct unique index under an equivalent name is accepted without rebuilding.
- Existing nonunique, wrong-partial and sparse indexes fail closed and remain
  unchanged, with no attempt, payment, balance or invoice-lock mutation.
- A simulated successful build that leaves constraints absent still blocks.
- Live metadata permission failure cannot fall through to an unsafe write.

Index/collection drops in these tests occur only inside the ephemeral test
database, with index restoration in finally blocks. No live database/index writes,
provider calls, credential changes, deployment or browser/manual payment tests
were performed. Live Render acceptance is still required.

Full M-PESA/config suite passed 248 tests across 9 files, including the nine new
regressions. Command: npm run test --workspace=@hms/api -- src/modules/mpesa
src/config/mpesa-outbound.test.ts --silent. API/web typecheck and build,
focused ESLint and git diff --check pass. Web typecheck completed before its build.

Full project lint retains the same 48 pre-existing errors in unchanged files:
42 in API insurance.repository.ts/service.ts/test.ts and six web errors in
PatientAvatar.test.tsx:8, AuthenticatedMediaImage.tsx:32, PatientCardModal.tsx:3,
PatientProfileHeader.tsx:3, PatientProfilePage.tsx:27 and useMpesa.test.tsx:26.
Existing verification reports record the exact API baseline locations. The two
phase-owned TypeScript files pass focused ESLint.

## Deployment follow-up

Commit/push the correction to DEV-GENERAL and deploy that revision on Render.
Retry the same create body and UUID once. A healthy existing index set should
now yield CREATED without relying on Model.init(). If it still fails, use the new
request's sanitized diagnostic; a different live database/index failure may
remain. Do not submit STK until the attempt creation succeeds and is inspected.

The next phase has not started; production readiness is not certified here.
