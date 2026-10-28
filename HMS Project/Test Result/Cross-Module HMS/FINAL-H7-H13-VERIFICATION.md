# Final H7/H13 verification and regression audit

Date: 2026-10-13. Branch: `Dev-F-Release-5-Clone`. Verdict: **not ready for blanket remediation closure**. This was a bounded verification pass, not a deployment or feature implementation. No application code was changed.

## A. H7 deployment status

| Evidence label | Result |
|---|---|
| Verified from configuration | `render.yaml` specifies `hms-api`, `region: singapore`, free plan, `/api/health`, and externally supplied MongoDB URI. |
| Verified from live database metadata | Read-only `hello` on the connection configured by `apps/api/.env.dev` returned replica-set topology and tags `provider: AWS`, `region: AP_SOUTH_1` (Mumbai). This identifies this connection, not necessarily Render's configured database. |
| Previously reported | Infrastructure review recorded 30 ping samples (p50 25.30 ms) and 20 branch-read samples (p50 26.38 ms). Those measurements were not taken inside Render and do not establish Render-to-Mongo latency. |
| Not verified / blocked | Actual Render region, deployed revision/configuration, its database target, API p50/p95, Render-origin indexed-query p50/p95, and separate cold/warm latency. No Render connector or API credential was available in the inspected tool/environment inventory; no authenticated dashboard or Render execution session was established. |

No local-to-database measurement is substituted for Render-origin latency. No API benchmark, cold-start probe, production load test, deployment or configuration change was performed. Owner needs to supply an authorized Render service metadata/dashboard session and runtime probe access. Record service region/revision, sanitized DB region tags, then sample at least 30 warm requests and indexed reads with fixed query shapes, returning only aggregate timings/counts; report cold-start/first-request separately. Record failures and sample size with p50/p95. Do not include clinical data or connection strings.

The old infrastructure recommendation to change YAML and redeploy is insufficient: [Render documents that an existing service cannot change regions](https://render.com/docs/regions); a new service and migration are required. A new service can have a different service URL/outbound IP and separately configured environment/secrets. Review custom-domain cutover, web/patient/mobile API bases, CORS/cookie settings, Atlas allowlists, environment groups, authentication secrets and deploy hooks before an authorized migration. Private networking is region-specific. None of that migration occurred here.

## B. H13 index status

Confirmed declarations and repository filters directly:

| Index | Ordered keys | Purpose |
|---|---|---|
| patients_branch_live_created | registrationBranchId:1, deletedAt:1, createdAt:-1 | Scoped patient list; branch `$in`, deletedAt null; default createdAt sort. |
| patients_live_created | deletedAt:1, createdAt:-1 | Unrestricted patient default list. |
| invoices_branch_live_created | branchId:1, deletedAt:1, createdAt:-1, _id:-1 | Invoice list initial match and exact default sort, including tie-breaker. |

**Live database inspection:** all three indexes are absent from the configured development database. Existing indexes match the earlier H13 metadata inventory, including extra patient identifier indexes; no equivalent ordered key/options combination or conflicting proposed name was found. Both patient and invoice collections reported estimated count zero; bounded active-record probes also found no usable branch sample. Therefore no representative live explain was possible. Production presence is unknown. No indexes were created on this connection, and no records were written.

**Measured in a test environment:** reran the H13 disposable-MongoDB test, 3,000 synthetic rows per collection, unhinted executionStats, page size 20. No query/index changes were made in this audit.

| Shape | Before winning path | Before examined docs/keys | After winning path | After examined docs/keys | Returned |
|---|---|---|---|---|---|
| Branch patient | COLLSCAN + SORT | 3000/0 | patients_branch_live_created IXSCAN + FETCH + LIMIT | 20/20 | 20 both |
| Unrestricted patient | COLLSCAN + SORT | 3000/0 | patients_live_created IXSCAN + FETCH + LIMIT | 20/20 | 20 both |
| Branch invoice | branchId_1_invoiceDate_-1_status_1 IXSCAN + FETCH + SORT | 1500/1500 | invoices_branch_live_created IXSCAN + FETCH + LIMIT | 20/20 | 20 both |

Matches the earlier synthetic result under the same fixture shape. This is not a before/after comparison with the empty remote database, a latency benchmark, or evidence of production usage. Invoice explain measures the initial list access path; downstream lookups/counts and realistic branch sizes, optional filters, deep pages and alternate sorts remain unmeasured. Tests independently exercise live repository filtering for null/missing deletedAt, soft-deleted exclusion, branch and patient scope, optional filters and identical pre/post-index IDs.

### Safe deployment/post-deployment checklist

1. Obtain explicit authorization for the named target, additive index creation and rollout window; current permission is read-only verification. Confirm target identity and workload representativeness.
2. Capture target listIndexes; compare key order/options/names. Preserve all existing indexes. Inspect capacity, build privileges, replication lag, disk/cache headroom and expected write-maintenance cost.
3. Review the three exact additive createIndex commands in [H13](H13-soft-delete-indexes.md). They match the schemas, are non-unique/non-partial/non-sparse, and require no data backfill. No duplicate cleanup is needed for these indexes.
4. Coordinate model initialization: `database/client.ts` does not set autoIndex/autoCreate, and schemas do not disable index creation. A restart with these declarations may build them depending on runtime configuration. Do not use application restart as an unreviewed migration; do not run syncIndexes/dropIndexes.
5. Build only missing indexes during the approved window; monitor build completion, disk, CPU, replication and write latency. Verify exact definitions afterward.
6. Run unhinted executionStats on representative patient and invoice queries (including full invoice aggregation and counts); retain only sanitized stages/index names/examined/returned counts and latency distributions. Recheck null/missing behavior, deleted exclusion and authorized scopes through APIs.
7. Rollback requires separate approval: retaining these additive indexes is initially data-safe but has overhead; if removal is needed, remove only the three precisely named H13 additions, never existing indexes. Coordinate declarations/autoIndex so a restart does not recreate removed indexes. No rollback commands were executed.

## C. Remediation matrix

The source reviews are organized by module, not a complete C/H identifier ledger. C1–C4 follow README ordering; H5/H6/H10/H11/H12/H13 are explicitly identifiable in tests/reports. H2/H3/H4/H8/H9 below use the apparent task-to-module mapping; that numbering is provisional, and the module/finding description is authoritative. No H1 scope was supplied.

“Verified resolved” below means the stated bounded code finding is supported by code and completed synthetic tests, not that its patch is deployed or that the entire module is certified.

| ID / finding | Status | Current code and completed evidence | Remaining work / limits |
|---|---|---|---|
| C1 dependent linking | Partially resolved | Portal request inserts pending grants; independent account/IP limits and fail-closed authorization; 13-case dependent security suite passed; C1 follow-up inspected. | Approved staff/challenge verification workflow absent; legacy grants require controlled provenance review. Notification/dental consumers still have revocation gaps; no production grant remediation performed. |
| C2 dental imaging authorization | Verified resolved | `authorizeDentalImagingReport` does not fall through after visit denial; episode/patient/branch/doctor checks and route action checks; dental-imaging-foundation suite passed. | Deployed revision not checked; no production access tests. |
| C3 unsafe hospital/localization defaults | Verified resolved | settings get initializes from explicit configuration; identity/localization reset rejected; initialization suite passed. | Deployment initialization values and historical stored settings not audited or changed. Other localization findings are not automatically closed. |
| C4 phone validation | Verified resolved (backend scope) | Shared validation used by patient service; patient-phone-validation suite passed; frontend diff preserves registration integration. | Frontend tests/browser behavior not independently rerun; existing patient values not migrated. |
| H2 advance-payment sync race | Verified resolved | Single conditional update pipeline derives balance/status from stored paid amount; atomic validation and advance-payment suites passed, including concurrent sync/payment. | Deployed revision unverified. |
| H3 appointment overlap concurrency | Partially resolved | Doctor lock is inside create/update/reschedule transaction before overlap checks; appointment/surgery conflict suite passed. | Only doctor is locked: simultaneous same-patient appointments with different doctors lack a shared patient lock; original review covered doctor AND patient overlap. No new race reproduction performed. Standalone fallback cannot guarantee transaction isolation. |
| H4 surgery reschedule race | Verified resolved (replica-set scope) | Reschedule now acquires existing doctor/service locks; surgery-concurrency suite passed including concurrent reschedules/rollback. | Requires replica-set transaction support and deployed verification; standalone is not equivalent. |
| H5 lazy notification synchronization cost | Partially resolved | Batched queries/inserts replace per-item writes; notification-sync-performance suite passed. | Reconciliation remains coupled to reads, not a scheduled process; no representative latency test. Mixed bulk errors and access issues below remain. |
| H6 OPD financial closure | Verified resolved (tested closure scope) | OPD completion consults billing closure; opd-billing-closure suite passed. | Does not certify that every billable path automatically creates an invoice; deployed end-to-end journey unverified. |
| H7 region alignment | Implemented, runtime verification pending | Singapore YAML; live configured DB reports AWS AP_SOUTH_1. | Actual Render region/revision/database target and Render-origin latency blocked. |
| H8 appointment → surgery conflict | Verified resolved (tested overlap scope) | Appointment repository/service checks active procedure overlap and shares doctor document locking; appointment-surgery-conflict suite passed. | Simultaneous cross-module race not proven by sequential overlap tests; replica-set and deployed verification required. |
| H9 Service Catalogue deletion | Verified resolved (existing-dependency scope) | Single/bulk delete check active procedure recommendations/bookings, clinical orders and dental plans; deletion dependency suite passed. | Concurrent new reference insertion versus deletion not established by these tests; no blanket referential-integrity claim. |
| H10 department branch isolation | Verified resolved (list-filter scope) | Filter no longer includes all missing/empty branch arrays; department-branch-isolation suite passed. | Not a full authorization audit of every department endpoint. |
| H11 proactive notifications | Partially resolved | Lab/imaging notification calls follow transaction completion; invoice hooks and consent hooks exist; proactive suite passed. | Recipient revocation, mixed errors, retry/delivery durability, invoice trigger coverage and tests need work; details below. |
| H12 consent publish safety | Partially resolved | Service transaction; partial unique `{branchId:1,code:1}` with `{status:'ACTIVE'}`; conflict mapping; consent-publishing suite passed. | Index absent from configured DB; production presence unknown. Standalone fallback non-atomic. Duplicate reconciliation helper requires controlled review, not automatic use. |
| H13 soft-delete indexes | Implemented, runtime verification pending | Exact schema/query alignment; current unhinted synthetic plans select all three additions. | Absent in configured empty DB; authorized deployment and representative runtime checks pending. |
| FLOW §2.4 cancelled deposits | Blocked by product decision | Admission cancellation and surgery cancellation do not resolve deposits; billing still excludes refunds. | Decide refund/credit/forfeit/manual finance review, authority, audit and reconciliation policy. |
| FLOW §2.5 patient merge | Blocked by product decision | No patient merge route/canonical-record workflow found. | Decide identity evidence, survivor rules, references/financial history, approval, audit, reversibility and portal access. |

### H11 detailed limitations

- `NotificationRepository.createPatientNotifications` selects grants with status VERIFIED but no `revokedAt:null`. Grant-derived users are not filtered for active/non-deleted account status as direct-patient users are. Historical recipient-only notification reads do not prove continuing patient authorization. Current tests do not close the inconsistent VERIFIED-plus-revokedAt case identified by C1.
- Both bulk insert catch blocks accept a top-level 11000 **or any** duplicate write error; mixed duplicate/non-duplicate failures can be swallowed. Successful inserts in a partial bulk result can return no notifications, so pushes are skipped.
- `notifyPatient` catches all errors and returns `[]`; push calls are fire-and-forget. Billing triggers are also fire-and-forget after commit. There is no durable event/retry record; lazy synchronization is best-effort recovery, not guaranteed proactive delivery. Replaying after persistence does not resend a failed push because existing rows suppress insertion.
- Inspected billing hooks execute after awaited transaction completion and getById, not inside the transaction. However, `createDentalTreatmentItemInvoice` returns without the pending-invoice helper, and the proactive suite's “invoice creation” test directly invokes notifyPatient rather than BillingService.create. It therefore does not validate actual invoice event timing, rollback, or all invoice creation paths.
- Consent notification calls follow document persistence/timeline/audit. These steps are not one transaction; an intermediate timeline/audit failure can leave a saved document without the proactive notification. No durable post-commit dispatch exists. Tests for normal consent creation do not establish rollback-safe dispatch.

### H12 detailed limitations

The unique partial index correctly scopes one ACTIVE version per branch/code, independent of version and context. `executeTransaction` retries through the driver on supported topology but explicitly reruns the operation without a session for standalone/unsupported transaction errors. On standalone, retiring the old version and failing to activate the new one can leave no ACTIVE version. Uniqueness does not provide atomic replacement or audit atomicity; service audit is after the publish transaction.

`ensureActiveUniquenessIndex()` calls `reconcileDuplicateActiveVersions()` before createIndexes. The helper silently selects highest version/updatedAt and deactivates the rest, without an approved business decision or per-change audit; its discovery reads are not consistently session-bound. Only tests call it in the inspected tree. **Do not invoke it in production as a safe migration.** Obtain a restricted, read-only duplicate-scope inventory and owner-approved reconciliation plan first. No duplicates were reconciled here.

Other original review checklists remain **not independently verified** in this bounded pass: auth round-trip optimization, branch dependency-field finding, invoice numbering/money representation decisions, other soft-delete indexes, regex/sequence costs, reconciliation scheduling and remaining localization/timezone fallbacks. Existing review checkboxes were not silently closed.

## D. Remaining product decisions

Cancelled admission/procedure deposits still need an approved financial resolution and staff visibility workflow. Patient merge still needs identity, clinical/financial reference and authorization rules. C1 additionally needs an approved dependent-relationship verification method and controlled legacy-grant review. No product decision or data reconciliation was invented.

## E. Verification results

- `npm run typecheck --workspace=@hms/api`: passed. Configured typecheck excludes tests.
- Targeted Vitest run with `--config vitest.config.ts --maxWorkers=2`: **14 files, 194 tests passed**, 81.63 seconds. Files: dependent-link-security; patient-phone-validation; settings-initialization; advance-payment-atomic; dental-imaging-foundation; appointment-surgery-conflict; surgery-concurrency; notification-sync-performance; opd-billing-closure; proactive-patient-notifications; consent-publishing-safety; service-deletion-dependencies; department-branch-isolation; soft-delete-indexes.
- Separate `test/advance-payment.test.ts`: **6 passed**, including concurrent sync/payment. Total: **200 passing tests** in 15 files. All database mutations were restricted to disposable test databases through the existing test harness.
- Existing duplicate MobileDevice pushToken schema-index warning observed. Passing tests do not resolve the coverage limitations above.
- `git diff --check`: passed (existing LF/CRLF conversion warnings only). SHA-256 baseline comparison: zero pre-existing modified/untracked files altered.
- Not run: full suite, web/patient-web tests, browser acceptance, builds/full lint, production load tests, Render-origin timings or production migrations.

## F. Final recommendation

Keep H7/H13 open. Do not close C1/H3/H5/H11/H12 as fully resolved. Prioritize access/revocation and notification delivery/error handling, deployment-safe consent uniqueness and replica-set guarantees, then representative index/region verification. Obtain financial/merge decisions separately. No new remediation was started during this audit.

## G. Guardrails

Current branch remains Dev-F-Release-5-Clone. This audit adds only this report. Existing modified and untracked files were snapshotted with SHA-256 before work and rechecked at completion. No commit, push, branch switch, reset, stash, revert, clean, production write, index build or deployment was performed. Remote Mongo access used autoIndex:false/autoCreate:false and read-only metadata/count/bounded projection operations; no patient information or credentials were emitted.
