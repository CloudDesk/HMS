# H13 — soft-delete query indexes

Date: 2026-10-13. Status: **implementation locally verified; deployment and representative runtime verification pending. H13 is not complete.**

## Evidence and scope

Read `PROJECT_RULES.md`, review README cross-cutting index finding, patients review sections 3.2/5, and billing review sections 3.4/5. This is bounded review remediation, not a new Scope 2 feature phase. No lifecycle, UI, repository, permission, or business-rule changes.

Inspected `patient.model.ts`, `patient.repository.ts` list/getById/update/findDuplicateCandidates/findLatestPatientNumber; `billing.model.ts`, `billing.repository.ts` list/getById/context/visit lookups, payment/item queries and summary; database connection setup and existing billing context-index tests.

Confirmed: patient schema had no branch/deletedAt/creation-date index; invoice schema had no deletedAt key. The review's implication that all such queries necessarily scan the collection is incorrect: `_id`, unique patientNumber/invoiceNumber and patient/visit/context indexes can already narrow candidates. Adding deletedAt first everywhere is not justified.

Read-only `listIndexes()` against the configured development connection succeeded using configured DNS servers, with `autoIndex:false` and `autoCreate:false`. No patient documents were read and no deployed indexes/data were modified. Patients had `_id`, unique patientNumber, firstName+lastName, phone, email, status, and two additional identifier indexes (identifiers.value+identifiers.issuingAuthority; identifiers.identifierType+identifiers.status). Invoices had `_id`, unique invoiceNumber, patientId+createdAt, visitId, sourceType+encounterId, admissionId, procedureId, status+createdAt, branchId+invoiceDate+status, and unique partial contextType+contextId. None duplicates the additions or uses their names. Metadata is a point-in-time observation, not assurance for every deployment target.

## Query mapping and changes

| Schema / index name | Ordered keys | Actual query and rationale |
|---|---|---|
| Patient / patients_branch_live_created | registrationBranchId:1, deletedAt:1, createdAt:-1 | `list`: deletedAt:null, registrationBranchId:$in, default createdAt descending. Branch equality first, deletion equality next, then sort. Status/gender/search are optional residual filters. Branch/deletion prefix also applies to duplicate candidate filtering. |
| Patient / patients_live_created | deletedAt:1, createdAt:-1 | Unrestricted `list` has no branch equality. The branch-leading index cannot provide this ordered access path. |
| Invoice / invoices_branch_live_created | branchId:1, deletedAt:1, createdAt:-1, _id:-1 | `list` begins aggregate with match on deletion/branch and sort by createdAt plus _id. Existing branch+invoiceDate+status does not supply that sort. |

Patient lists also allow name/number/updatedAt sorts; invoice lists allow invoice date/number/status/amount sorts, patient/context/admission/status/date filters. These additions do not promise to optimize every combination. Invoice date ranges and summaries retain the existing branch+invoiceDate+status index. Patient-scoped invoices retain patientId+createdAt; no near-duplicate patient/status invoice index was added without stronger workload evidence. Item invoiceId+deletedAt and payment invoiceId/branch+paymentDate indexes remain unchanged. OPD/appointment findings were not remediated here.

All three additions are ordinary non-unique, non-sparse, non-partial indexes. Queries still use `deletedAt:null`, matching both null and missing fields. No query was changed to fit an index. A partial filter was not needed; full indexes avoid introducing a separate eligibility contract. No existing indexes were removed. Each new index adds disk/cache and write-maintenance cost; the two patient indexes serve distinct scoped/unscoped sorts. Large branch `$in` lists, deep pagination, regex searches, low-selectivity filters and alternative sorts need separate representative measurements.

## Verification

`npx vitest run test/soft-delete-indexes.test.ts src/modules/billing/billing-context-index.test.ts --config vitest.config.ts` from apps/api: **7 tests passed**. H13 tests use existing mongodb-memory-server tooling, a disposable local MongoDB and 3,000 synthetic records per collection across two branches. They verify schema definitions, null/missing visibility, deleted exclusion, empty/other branch scoping, patient scoping, status/gender/search/date filters, matching result IDs before/after indexing, and actual unhinted planner selection. Existing billing context uniqueness tests also pass.

`npm run typecheck --workspace=@hms/api`: **passed**. API typecheck excludes test files as configured. `git diff --check`: **passed** (existing CRLF conversion notices only).

Targeted ESLint on both changed schemas and the H13 test: **passed**.

Unhinted `explain('executionStats')`, default sorts, first page limit 20:

| Query | Before plan | Before docs / keys examined | After plan | After docs / keys examined |
|---|---|---|---|---|
| Branch patient list | COLLSCAN + SORT | 3000 / 0 | patients_branch_live_created IXSCAN + FETCH + LIMIT | 20 / 20 |
| Unrestricted patient list | COLLSCAN + SORT | 3000 / 0 | patients_live_created IXSCAN + FETCH + LIMIT | 20 / 20 |
| Branch invoice list | branchId_1_invoiceDate_-1_status_1 IXSCAN + FETCH + SORT | 1500 / 1500 | invoices_branch_live_created IXSCAN + FETCH + LIMIT | 20 / 20 |

Tests print complete winning plans and examined counts for reproduction. Baseline indexes are the pre-H13 schema declarations, created only in the disposable database; live-only identifier indexes are not reproduced. The second patient comparison occurs after creating the branch patient index. Synthetic creation dates are distinct. Invoice explain covers the initial match/sort/limit access path, not the subsequent lookup stages or total-count query; repository tests exercise the actual full list. These results show reduced examined work for these synthetic shapes, **not measured production latency or representative production performance**. No production explain/build was run.

## Deployment still required

Before release, an operator must inspect `getIndexes()` on the actual target, confirm names/key/options do not conflict, confirm index-create privileges, storage headroom and build window, and build only missing indexes. No data backfill or uniqueness cleanup is required by these non-unique scalar indexes. Resource limits, privileges, unexpected data shapes or conflicting existing definitions can still prevent a build.

Explicit additive commands for the approved target (not executed against a deployed database during H13):

```javascript
db.patients.createIndex({registrationBranchId:1, deletedAt:1, createdAt:-1}, {name:'patients_branch_live_created'});
db.patients.createIndex({deletedAt:1, createdAt:-1}, {name:'patients_live_created'});
db.billing_invoices.createIndex({branchId:1, deletedAt:1, createdAt:-1, _id:-1}, {name:'invoices_branch_live_created'});
```

Existing connection code does not explicitly disable Mongoose autoIndex; model initialization may build declared indexes depending on runtime settings. Coordinate the rollout before restarting with these declarations; do not assume declaration means successful deployment. Do not run syncIndexes/dropIndexes: deployed patients contain indexes absent from this schema. Verify the three exact definitions with listIndexes after build, then compare unhinted executionStats on representative branch sizes, optional filters, counts, full invoice aggregation and pagination. Observe build/write overhead. H13 remains open until that deployment and runtime evidence is recorded.

## Preservation

Only two previously clean schema files and the new H13 test/report were changed. SHA-256 comparison of every pre-existing modified/untracked file against the starting snapshot found zero changes, preserving C1–C4/H2–H12. Branch remained Dev-F-Release-5-Clone. No commit, push, branch switch, reset, stash, revert, clean, production write or unrelated remediation was performed. No next phase started.
