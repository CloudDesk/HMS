# HMS MongoDB migration preflight status

Resumed on 27 October 2026. This is a local-only preflight, not a migration completion report.

## Current branch and preservation

**VERIFIED:** checked-out branch `DEV-OPHTHALMOLOGY-F-V2`, HEAD `4dfa3f1e60aa5eaba1bc927d130903006ae0fa8c`. Continue on this branch. No checkout, push, merge, cherry-pick, fetch or synchronization was performed during the resumed preflight.

The nine files named in the pasted request already existed with the preparation changes, either modified or untracked:

- `apps/api/package.json`
- `apps/api/src/config/env.ts`
- `apps/api/src/database/client.ts`
- `apps/api/src/database/seed-ophthalmology-users.ts`
- `apps/api/src/scripts/migrate-sequences.ts`
- `apps/api/src/scripts/verify-database-target.ts`
- `apps/api/src/config/env-database.test.ts`
- `apps/api/src/database/client.test.ts`
- `HMS_MONGODB_CLUSTER_MIGRATION.md`

Additionally, `apps/api/src/database/seed_ophthalmology_records.ts` already contained the hardcoded-fallback removal. It was omitted from the pasted nine-file list but is part of the reviewed preparation. The unrelated `apps/web/src/pages/OphthalmologyWorkspacePage.tsx` change is preserved. `apps/web/tsconfig.tsbuildinfo` is a generated file changed during the preceding web typecheck; it has not been manually edited or reverted.

**COMPLETED in this resumed preflight:** review of the existing changes, source scans, local environment mapping, focused test rerun and changed-file lint. No further application code was changed after receiving the resume instructions. Documentation was updated in `HMS_MONGODB_CLUSTER_MIGRATION.md`; this status report and `artifacts/mongodb-migration-preflight/local-environment-map.json` were created.

## Existing cluster protection

**VERIFIED for actions taken:** no remote database connection, read/write query, restore, seed, index operation, user/role/network change, deployment restart or environment switch was performed during this resumed preflight. All analysis below reads local files only. Tests use pure configuration functions and mocked connections, not operational databases. The old cluster is treated as read-only.

**PENDING:** a source-side before/after data comparison has not been performed. Existing applications can continue writing independently; therefore we do not claim the live source is globally static or that external writers made no changes.

## Redacted environment mapping

The source host is represented by a SHA-256-derived fingerprint rather than a URI or credential. A fingerprint identifies the local configured hostname for comparison; it does not establish its Atlas organization, project or canonical cluster identity.

| Evidence | Local mapping | What is not established |
|---|---|---|
| `apps/api/.env.dev` | `APP_ENV=dev`; only `MONGODB_DATABASE_URL`; database `HMS_GENERAL`; host fingerprint `c18763fa51b87535`; no expected-target guards configured yet | Whether any hosted environment uses this same source; source credential privilege |
| `apps/api/.env.test` | Only `MONGODB_URI`; database `dummy`; different host fingerprint; no credentials in URI | Not a hosted deployment mapping |
| `apps/api/vitest.config.ts` | Explicit local test URI; focused connection tests mock Mongoose | Does not prove operational environment isolation |
| `apps/api/.env.prod` | Not present locally | Production database/cluster identity |
| `render.yaml` | API service name `hms-api`; `APP_ENV=prod`; `MONGODB_URI` comes from an external secret (`sync: false`); normal server entry point | Actual deployed service, branch, URI, shared-secret scope, source database and owners |
| `apps/web/.env.prod` | API endpoint `https://hms-india-0y8r.onrender.com/api`; no MongoDB settings | The endpoint's actual database, environment classification or deployed code |
| `.firebaserc` / `firebase.json` | Hosting project label `hms-sit-3bc2e`, serving the web build | The label alone does not establish SIT data isolation or prove that deployment is current |
| `netlify.toml` / `netlify/functions/api.mts` | Patient web routes `/api` to the Netlify function; function uses shared DB client | Netlify site ID, branch, environment contexts and actual database secret |
| `apps/patient-web/.env.prod` | Not present in active app folder | Patient portal hosted configuration |
| `.github/workflows/ci.yml` | Test command receives an explicit local MongoDB URI | No hosted deployment database mapping |

**BLOCKED / not verified:** the exact deployment that uses `HMS_GENERAL`; whether Production, SIT or UAT also uses it; source Atlas project ID and cluster name; destination identity. No deployment is currently approved or eligible for a connection change based on this evidence. Local environment files were not changed.

## Connection code review

**VERIFIED:** no embedded MongoDB URI literal/fallback remains in relevant non-test runtime and migration source, including the ophthalmology seed scripts. Either supported URI variable works by itself; differing simultaneous values fail with a credential-free error.

**VERIFIED:** expected host/database checks reject mismatched configuration; a mismatched actual connected database is closed before the helper returns; changing the configured URI while reusing an established connection is rejected. Guards are optional for existing deployments, mandatory in the dedicated target verifier. They have not been enabled on live environments.

**VERIFIED:** `verify-database-target.ts` does not import the application, models or seed functions and never calls `listen()`. It creates a logger-bearing Fastify instance, validates guards, connects and closes. Automatic Mongoose index/collection creation remains disabled. Running this verifier against a source is not needed until source identity and access are approved.

**LIMITATION:** these are application destination checks, not an Atlas source/destination identity comparison or a read-only permission boundary. Different DNS aliases or connection strings can still identify the same cluster. No copy tool has been authorized to run or implemented with assumed identities.

## Write-capable entry points: do not run against source

The local source scan identified the following administrative writers and supporting paths:

- `apps/api/src/server.ts`: calls `seedDatabase()` at startup and dashboard refresh at startup/every five minutes; normal API routes can also write.
- `netlify/functions/api.mts`: starts the full API routes after connecting; does not invoke the normal server's seed directly, but route requests can write.
- `apps/api/src/database/seed.ts`: permission/role/user/configuration reconciliation and other startup writes.
- `apps/api/src/database/seed-ophthalmology-users.ts`: synthetic actor/account/role/patient seeding.
- `apps/api/src/database/seed_ophthalmology_records.ts`: service/medicine/inventory test-record seeding.
- `apps/api/src/database/migrate-clinical-depts.ts`: department updates.
- `apps/api/src/scripts/migrate-billing-context-index.ts`: document and index changes.
- `apps/api/src/scripts/migrate-clinical-context-visit-indexes.ts`: document and index changes.
- `apps/api/src/scripts/migrate-pharmacy-dispensing-idempotency.ts`: document and index changes.
- `apps/api/src/scripts/migrate-procedure-recommendation-index.ts`: index changes.
- `apps/api/src/scripts/migrate-role-index.ts`: document and index changes.
- `apps/api/src/scripts/migrate-sequences.ts`: counter updates.
- `apps/api/src/shared/sequence/sequence.service.ts`: counter allocation used by application workflows.
- Scratch tools: `create_kamesh_user.ts`, `create_optometrist_user.ts`, `kamesh_mongoose.ts`, `reset_kamesh_password.ts`, `undelete_kamesh.ts`, `update_kamesh_branch.ts`, and `drop-index.ts` under `apps/api/scratch`.

The scratch index-drop tool still calls Mongoose directly using environment configuration. It was not changed or executed; exclude all scratch tools from migration. Test setup helpers can clear collections and must remain restricted to isolated tests. This is a static local inventory, not proof that every deployed process, external callback or operator script has been found. The writer of `mpesa_callback_events` remains unidentified.

## Atlas access and provisioning

**BLOCKED:** MongoDB Atlas integration discovery was checked again and reports `installed: false`. No connected Atlas management tools are available. Existing database credentials do not establish authorized Atlas management access. No Atlas CLI or MongoDB dump/restore tools were found on PATH in the preceding preparation.

**NOT STARTED:** destination project/cluster creation, database user/network setup, source/destination feature/storage checks. No organization, project, region, cluster name or IP allow-list has been selected or invented. Existing cluster access lists/users remain untouched.

**Exact next step:** install and connect MongoDB Atlas, then inspect organization/project/cluster metadata read-only and identify the approved source and a separate destination project. Obtain read-only hosted-configuration evidence to resolve the deployment mapping before data access. Do not paste credentials or full connection strings into chat.

## Migration and integrity verification

**NOT STARTED:** copying `HMS_GENERAL`, backup/restore, index creation, collection creation, application write tests or cutover.

**PENDING:** verified read-only source credential; distinct canonical cluster identities; destination credentials isolated from the existing environments; destination storage/version/features; source validators/collations/special collection metadata/GridFS; exact collection/document/index inventory; backup readiness; representative document integrity and referential checks.

The earlier inventory reported 91 collections, 53 empty, but it is historical and not an approved consistency point. It does not substitute for a fresh source/destination validation. No counts or metadata were refreshed remotely in this resume.

Source activity and a supported consistency mechanism are unknown. If a maintenance window is needed, obtain explicit approval before pausing anything. A successful copy is not cutover approval. Before any eventual cutover request, provide exact deployment and redacted identities, verified copy results, recovery readiness, maintenance requirements and rollback strategy. After destination writes begin, simply restoring an old URI is not a lossless rollback.

## Tests and checks

- **PASSED, resumed run:** 23 tests in five files: `env-database.test.ts`, `client.test.ts`, `env-jwt.test.ts`, `env-cors.test.ts`, `env-trust-proxy.test.ts`. Result collected; no live database used.
- **PASSED, resumed run:** changed-file ESLint across all eight changed/new TypeScript files. Result collected.
- **PASSED, resumed run:** `npm run typecheck --workspace=@hms/api`; exit code 0, result collected.
- **PASSED, preceding preparation, results collected:** API typecheck, API build and web typecheck; credential-safe command-level wrong-host rejection and missing-guard rejection. The first command-level wrong-host attempt timed out under concurrent load; its retry passed.
- **FAILED, preceding preparation:** full API lint, 51 errors in unchanged insurance repository/service/tests, patient service and patient-document storage service; full web lint, 17 unrelated errors. No failing files were modified to suppress those errors. Full lint was not rerun on resume because focused files passed and failures were already identified.
- **NOT RUN on resume:** full builds, full application test suite, live browser acceptance or remote write tests. These are not needed to reconfirm the unchanged preparation code and cannot substitute for destination acceptance after provisioning.

This local preflight is not a clean repository-wide release gate. No feature phase or deployment has been declared complete.
