# HMS cluster migration: preparation and verification

Scope: move `HMS_GENERAL` to a separate Atlas cluster without changing its collection design or the other databases on the existing cluster. This is infrastructure maintenance, not a new Scope 2 feature phase. No live URI, database contents, indexes, Atlas users or network rules have been changed by this preparation.

The user's resume instructions supersede any implied authorization in the procedure below: treat the entire existing cluster as read-only; never alter its databases, users, permissions or network settings. Do not pause applications/writers, change any hosted environment, restart deployments or perform cutover without separate explicit approval. Source and destination Atlas organization/project/cluster identities must be established before data access. Reject migration when both resolved cluster identities are identical, even if their database names or connection aliases differ. The URI host guard alone is not proof of distinct Atlas cluster identity.

## Connection gaps addressed

- The ophthalmology-record seed script contained an embedded connection fallback. It now requires the same environment configuration and shared connection client as the API.
- The ophthalmology-user seed script selected environment variables in the opposite order to the API. Both seed scripts now use the existing shared client.
- If both `MONGODB_URI` and `MONGODB_DATABASE_URL` are supplied with different non-empty values, configuration fails rather than silently selecting a destination. Either variable remains supported on its own.
- The sequence migration script now uses the existing shared client too.
- Optional expected-host/database checks reject the wrong URI before connecting and check the actual database name before returning from the connection helper. Automatic collection/index creation remains disabled.
- A separate verification command connects without importing the application, models or seed functions. Starting the ordinary API is not a read-only verification: its startup runs seeds and refreshes a dashboard snapshot.

No frontend, workflow, permission, consent, payment or collection contracts are changed. Shared files affected are the environment configuration, database client and API package scripts. Existing seed data/business logic is unchanged.

## Destination configuration

Provision the destination in a separate HMS Atlas project with its own credentials and network access. Do not change the old cluster's shared users or access rules as part of destination setup. Confirm the Atlas integration is connected before provisioning. A free cluster is the intended starting option; paid provisioning needs an explicit choice.

Use exactly one URI variable for each process. Keep source and destination credentials in separate secret files or deployment secret settings, never in this document or command arguments. For example, a local ignored `apps/api/.env.hms-target` would contain:

```dotenv
APP_ENV=dev
MONGODB_URI=<destination URI with /HMS_GENERAL in its path>
MONGODB_EXPECTED_HOST=<exact destination SRV hostname, without credentials or scheme>
MONGODB_EXPECTED_DATABASE=HMS_GENERAL
```

Use a dedicated, securely populated file; do not overwrite `.env.dev` during preparation. Check inherited shell variables too: a stale second URI now causes a deliberate conflict error. Production configurations still require the existing JWT and other settings. Never paste real credentials into documentation or commit them.

For an SRV URL, the expected host is the original `cluster-name.example.mongodb.net` hostname. For a standard replica-set URL, it is the exact host/port seed list in the same order, excluding credentials. Host matching ignores case; database names are case-sensitive. `authSource` is not the application database.

From `apps/api`, verify the destination without writes:

```powershell
node --env-file=.env.hms-target --import tsx src/scripts/verify-database-target.ts
```

Or, when the environment has already been securely configured:

```powershell
npm run db:verify-target --workspace=@hms/api
```

Both expected-target variables are mandatory for this verification command. They are optional for existing deployments to avoid forcing unrelated environments to change. Set them on the migrated HMS deployment before startup.

## Copy and cutover procedure

1. Identify all API instances, serverless functions, developer processes, jobs and external callbacks that write `HMS_GENERAL`. Confirm where `mpesa_callback_events` is written; its owner was not found in this branch. A database URL change cannot reroute an external writer automatically.
2. Obtain read-only source access restricted to `HMS_GENERAL`; use separate destination credentials. Existing repository credentials have not been established as read-only, so they are not sufficient evidence for a protected migration copy.
3. Check destination version/features, available storage and network access. Confirm MongoDB Database Tools are available before selecting the final dump/restore invocation. No migration tools were found on PATH during preparation.
4. Establish a supported consistency strategy. If a final copy requires quiescing writes, obtain explicit maintenance-window approval before pausing any writer; until then do not pause, disable or restart any deployment. Other applications/databases on the old cluster remain running. Copying incurs source read load; it cannot guarantee zero performance impact.
5. Dump only `HMS_GENERAL`, preserving BSON and collection/index metadata, into a protected external archive. Restore only that namespace into the verified destination. Do not use destructive restore/drop options against the source, and do not run a broad cluster-wide copy. Preserve `_id`, timestamps, sequence values and references.
6. Compare collection names, exact document counts, index definitions/options, relevant collection options and key references. Verify restored transaction behavior. TTL-managed collections can change counts over time; reconcile expiry differences rather than treating all count changes as corruption. Source models and live indexes differ, so source metadata must not be replaced blindly by model definitions.
7. Verify file/document storage access separately. MongoDB contains metadata, while file binaries remain in the existing configured filesystem/GCS storage. Copying the database does not copy those files.
8. Only after a successful copy and separate explicit cutover approval, change the exactly identified, approved HMS deployment's URI and expected-target settings. Retain other environment settings, including JWT secrets, unless deliberately changing them. Restart only the explicitly approved HMS writers against the destination and confirm none still write to the old source. Never change existing Production/SIT/UAT configurations. The repo has both a normal server and a Netlify API entry point, so inspect actual deployments rather than assuming one process.
9. Run login, patient lookup, read/write persistence, appointment/OPD, pharmacy, laboratory/imaging, billing, admissions, insurance and ophthalmology smoke tests as applicable, including logout/login persistence. Verify permissions, transactions and patient document access.
10. Keep the old HMS database intact for rollback until validation is complete. After destination writes begin, reverting the URI alone can lose those writes; a rollback requires pausing writers and reconciling changes. Source deletion or retirement is a separate action and is not authorized by this preparation.

Do not run any seed or migration script against an unverified destination. Removing the hardcoded credential from the source file does not remove it from Git history or rotate it. Credential remediation needs coordination with services that may share the old credential; it is not safe to revoke a shared account blindly.

## Pending external prerequisites

- Install/connect MongoDB Atlas so the destination project/cluster can be provisioned and inspected.
- Confirm destination hostname, database user and access restrictions.
- Establish read-only source migration credentials and identify all HMS writers, including callbacks.
- Arrange the cutover window and verify the deployment environment to switch.

No database migration, live application restart, or cutover has been performed yet.

## Verification results

The focused configuration/connection suite passed 23 tests in five files, and changed-file ESLint passed. API typecheck and build passed in the preceding preparation run; a resumed API typecheck is recorded in the separate preflight status report. Web typecheck passed in that preparation run. Full API lint reported 51 errors in unrelated, unchanged files; full web lint reported 17 unrelated errors. These do not constitute a clean repository-wide release gate. No new full-suite rerun or hosted/browser acceptance was performed during the resumed local-only preflight.

The wrong-host command-level check rejected configuration before connecting, and verification without required target guards failed as expected. The first wrong-host subprocess attempt timed out during concurrent checks; its retry passed. No source writes were attempted. Destination connectivity, integrity validation and live migration acceptance remain pending until Atlas access and environment identities are verified.

See `HMS_MONGODB_PREFLIGHT_STATUS.md` for the resumed branch, redacted local environment mapping, script inventory, validation evidence and outstanding blockers.
