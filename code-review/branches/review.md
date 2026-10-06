# Module Review: `branches` (root foundation module)

**Reviewed:** 2026-10-05
**Scope:** `apps/api/src/modules/branches/*` (`branch.model.ts`, `branch.repository.ts`, `branch.service.ts`, `branch.routes.ts`, `branch.schemas.ts`, `branch.types.ts`), plus the cross-cutting request path every branch endpoint goes through (`middleware/authenticate.ts`, `middleware/require-permission.ts`, `modules/permissions/permission.repository.ts`, `middleware/error-handler.ts`, `utils/errors.ts`, `database/client.ts`).
**Review type:** Static code review + architectural/query analysis. **No code was modified.** Live load testing was **not** executed — see "Load Testing" section for why, and what's needed to run it for real.

---

## 1. Executive summary

The `branches` module itself is small (576 LOC across 6 files) and reasonably clean — it's the best-structured module to start with precisely because it's simple. It is **not production-ready as-is**, for one confirmed data-integrity bug and one confirmed, systemic performance problem that originates outside this module but hits every single branches request (and every other protected request in the API):

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 1 | Branch delete can silently orphan departments (wrong field name in dependency check) |
| 🟠 High | 2 | Every authenticated request pays 4 sequential, uncached DB round trips for auth+permission alone; TOCTOU race on branch `code` uniqueness |
| 🟡 Medium | 4 | Case-insensitive regex lookups bypass indexes; generic error messages can leak internals; no cascade/dependency check beyond 2 of ~15 referencing collections; streaming export uses deep `skip()` pagination |
| 🟢 Low | 3 | No structured business-event logging; non-unique `x-request-id` across process restarts/instances; DELETE returns 200 instead of 204 (style only) |

Nothing here is catastrophic at current scale (a hospital likely has single-digit to low-hundreds of branches), but several of these are **copy-pasted patterns that recur across larger, higher-traffic modules** (confirmed via grep — the case-insensitive regex lookup pattern and the `$ne`-on-array pattern both appear in `permissions`, `users`, `surgery`, and others). Fixing them here and turning the fix into the template for other modules is the highest-leverage move.

---

## 2. What's correct (keep doing this)

- **Consistent `.lean()` usage** in all repository reads — avoids unnecessary Mongoose document hydration overhead. Good baseline hygiene.
- **Regex input is escaped** (`escapeRegex()`) before being interpolated into `RegExp(...)` for both `search` and `code` lookups — prevents regex-injection/ReDoS from user-supplied strings. This is done correctly and consistently.
- **Fastify JSON-schema validation with `additionalProperties: false`** on every body schema — blocks mass-assignment of unexpected fields at the HTTP boundary before it ever reaches application code.
- **`minProperties: 1`** on the update schema prevents accidental no-op PATCH calls with an empty body.
- **Soft-delete pattern** (`deletedAt`/`deletedBy`) instead of hard delete — correct for an auditable healthcare system, and consistently applied across list/get/update filters (`deletedAt: null`).
- **Dependency check exists before delete at all** — the intent (don't delete a branch with live children) is right, even though the implementation is incomplete (see §3.1).
- **Parallelized independent reads** via `Promise.all` in `list()`, `summary()`, and `dependencies()` — correct use of concurrency for independent queries.
- **CSV export streams rows via an async generator** rather than loading the full result set into memory — correct approach for large exports, and the audit log write happens once up front, not per row/page.
- **`AppError` with explicit `statusCode`/`code`** is used consistently in the service layer (404 `NOT_FOUND`, 409 `CONFLICT`, 400 `INVALID_BRANCH_EMAIL`/`INVALID_BRANCH_PHONE`) — this is the correct shape for a typed error used by a central error handler.
- **Centralized error handler maps Mongo-specific failures** (`ValidationError`, duplicate key `11000`, `CastError`) to appropriate HTTP status codes rather than leaking raw Mongoose errors as generic 500s. The duplicate-key mapper in particular is thoughtfully built with per-field, per-collection messages for many other modules (though not branches specifically — see §3.5).

---

## 3. Findings

### 3.1 🔴 CRITICAL — Branch delete dependency check queries the wrong field; departments are never detected

**Where:** `branch.repository.ts:154-160`

```ts
async dependencies(id: string) {
  const [departments, users] = await Promise.all([
    DepartmentModel.countDocuments({ branchId: id, deletedAt: null }),   // <-- wrong field
    UserModel.countDocuments({ branchIds: id, deletedAt: null }),        // <-- correct field
  ]);
  return { departments, users };
}
```

`Department`'s actual schema field is `branchIds` (a plural array — a department can belong to multiple branches: `apps/api/src/modules/departments/department.model.ts:10,29`). The query above filters on `branchId` (singular), a field that **does not exist on any `Department` document**. Mongoose does not validate query filters against the schema (only document writes are validated under default `strict` mode), so this silently matches zero documents, every time, regardless of how many departments actually reference the branch.

**Why it matters:** `branch.service.ts:63-76`'s `delete()` relies entirely on this count to block deletion:

```ts
const dependencies = await this.repository.dependencies(id);
if (dependencies.departments || dependencies.users) {
  throw new AppError('Branch cannot be deleted while departments or users are assigned', 409, ...);
}
```

Because `dependencies.departments` is always `0`, **any branch with zero assigned users (but one or more departments) can be soft-deleted**, leaving every one of those departments holding a `branchIds` entry pointing at a now-deleted branch. Every downstream consumer that resolves a department's branch (branch management UI, user creation's `DEPARTMENT_BRANCH_MISMATCH` check, reporting) is now working against a dangling reference. This is a real, triggerable data-integrity bug, not a hypothetical.

**Recommended fix:** change the filter to `{ branchIds: id, deletedAt: null }` (Mongo automatically matches scalar-vs-array-element equality, so this requires no other change) and add a regression test asserting a branch with an assigned department cannot be deleted.

---

### 3.2 🟠 HIGH — Every authenticated request costs 4 sequential, uncached DB round trips before any business logic runs

**Where:** `middleware/authenticate.ts` → `modules/auth/auth.service.ts:309-324` → `middleware/require-permission.ts` → `modules/permissions/permission.repository.ts:438-460`

Every single branches route (`list`, `getById`, `summary`, `export`, `create`, `update`, `updateStatus`, `delete`) is wrapped in `requirePermission(...)`, which chains `authenticate` + a permission check. Tracing the actual calls made per request:

1. `authenticate()` → `auth.service.authenticateAccessToken()` → `UserModel.findOne({ _id, deletedAt: null })` (round trip #1)
2. `requirePermission` → `permission.repository.userHasPermission()`:
   - `PermissionModel.findOne({ module: /^Administration$/i, screen: /^Branches$/i, action: /^View$/i, ... })` (round trip #2 — see §3.3 on why this is also an index-bypassing query)
   - `UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })` (round trip #3 — **this is the exact same user document already fetched in step 1**, refetched because `userHasPermission` doesn't receive or reuse the user object `authenticate` already loaded)
   - `RoleModel.findOne({ _id: { $in: user.roleIds }, ... })` (round trip #4)

That's **4 sequential, blocking DB round trips just to decide "is this user allowed to call this endpoint," before the route handler's own queries even start.** There is no caching layer anywhere in the codebase (confirmed — no Redis, no in-memory TTL cache for permissions/roles; grepped `shared/` and `config/` for `redis`/`cache`, found nothing except an unrelated file-storage cache). Permissions and roles change rarely relative to how often they're checked — this is close to a textbook case for a short-TTL in-memory cache (even 30-60s) or at minimum collapsing steps 1 and 3 into one fetch.

**Why it matters for this review's stated goal (lowest practical latency against Mumbai-region Mongo):** round-trip *count*, not just query cost, dominates tail latency. Four sequential round trips is 4x the minimum network RTT paid before useful work starts, on literally every protected call in the entire API, not just branches. Even with excellent per-query performance (small collections, good indexes), this structurally caps how low p90/p99 can go, and it will only get worse as `permissions`/`roles`/`users` collections grow.

**Recommended fix (in priority order):**
1. Have `authenticate()` attach the already-fetched user document to `request.user` in a form `userHasPermission` can reuse, eliminating the duplicate fetch (removes 1 of 4 round trips immediately, no new infrastructure needed).
2. Add a short-TTL in-process cache (even a 30-60s LRU/TTL map keyed by `userId` → resolved roles/permission-set) for the permission-resolution path. Invalidate on role/permission mutation (the `roles`/`permissions` modules already know when they change something).
3. Longer-term: resolve a user's full permission set once at login/token-refresh time and embed a compact permission digest in the JWT or a server-side session cache, so `requirePermission` becomes a cheap in-memory check for the common case.

This finding is **not scoped to `branches`** — it's a shared middleware problem — but it was found while reviewing `branches` because `branches` has no business logic of its own heavy enough to mask it, which made it clearly visible. Flagging it here since it's the single biggest lever on this module's (and every module's) real-world latency.

---

### 3.3 🟡 MEDIUM — Case-insensitive anchored regex lookups bypass indexes

**Where:** `branch.repository.ts:117` (`getByCode`), `branch.repository.ts:77-78` (`list` search), `permission.repository.ts:439-442` (`userHasPermission`, see §3.2)

```ts
async getByCode(code: string): Promise<Branch | undefined> {
  const branch = await BranchModel.findOne({ code: new RegExp(`^${escapeRegex(code)}$`, 'i'), deletedAt: null }).lean();
  ...
}
```

`code` has a `unique: true` index (`branch.model.ts:28`), but the query uses a case-insensitive anchored regex. MongoDB can use an index for an anchored, case-*sensitive* prefix regex, but the `i` flag forces it to evaluate every index entry rather than seek — functionally equivalent to a full scan for lookup purposes, even though it technically "touches" the index. This method is called on **every** `create()` (uniqueness pre-check) and every `update()` where `code` changes — i.e., on the module's two mutation paths.

The unanchored `$or` regex search in `list()` (`{ name: searchRegex }, { code: searchRegex }` with no `^`/`$`) cannot use an index at all under any circumstance.

**Why it matters:** At current branch-collection sizes (tens of documents) this costs microseconds and is not a real-world problem today. It's flagged because (a) it's trivially fixable, and (b) the same exact pattern — case-insensitive regex equality where a normalized exact-match field would do — is copy-pasted into `permissions`, `departments`, `services`, `medicines`, and others per grep, some of which will not stay small.

**Recommended fix:** store a normalized lowercase shadow field (`codeLower`) with its own index and query that with exact equality, or configure a case-insensitive collation on the collection/index (`{ locale: 'en', strength: 2 }`) and let `findOne({ code })` use it directly without a regex at all. The latter is less invasive — no schema/data migration for existing fields, just an index option change — and should be the standard going forward for every "case-insensitive unique code" field in the codebase.

---

### 3.4 🟠 HIGH — TOCTOU race on branch `code` uniqueness

**Where:** `branch.service.ts:28-38` (`create`), `branch.service.ts:40-57` (`update`)

```ts
const existing = await this.repository.getByCode(data.code);
if (existing) { throw new AppError(... 409 ...); }
const branch = await this.repository.create(data, userId);
```

The uniqueness check and the insert are two separate, non-atomic operations. Two concurrent `POST /api/branches` requests with the same `code` can both pass the `getByCode` check (neither sees the other's uncommitted insert) and both proceed to `create()`. The underlying Mongo unique index on `code` (case-*sensitive*) will reject the second insert with a duplicate-key error — which `utils/errors.ts` does correctly catch and convert to a 409 — so the failure mode is "the second request gets a generic `UNIQUE_VIOLATION` 409" rather than silent data corruption. This is a legitimate defense-in-depth posture the DB-level index already provides.

The sharper edge case: because the **app-level check is case-insensitive but the DB-level unique index is case-sensitive**, two concurrent requests for `"MB01"` and `"mb01"` can both pass the app check and **both succeed at the DB level**, producing two branches whose codes differ only by case — which the application's own business logic (and other modules' lookups, e.g. `seed.ts`'s exact-match `BranchModel.find({ code: { $in: branchCodes } })`) assumes cannot happen.

**Why it matters:** low-probability in practice (branch creation is an infrequent admin action, not a hot path), but it's a genuine correctness gap, not just a performance one — the invariant the code *believes* it enforces ("codes are unique, case-insensitively") is not actually guaranteed.

**Recommended fix:** the collation-based index from §3.3 solves both problems at once — a case-insensitive collation on the unique index makes the DB itself the single source of truth for case-insensitive uniqueness, closing the race entirely and letting the existing duplicate-key error handler do its job without needing the app-level pre-check at all (keep the pre-check only for a friendlier error message on the common, non-racing path).

---

### 3.5 🟡 MEDIUM — Generic/leaky error message fallback

**Where:** `utils/errors.ts`, final fallback branch:

```ts
if (error instanceof Error) {
  ...
  return new AppError(error.message);   // defaults to statusCode 500, code 'INTERNAL_ERROR'
}
```

For any error that isn't an `AppError`, a Mongo duplicate-key error, a Mongoose `ValidationError`, or a `CastError`, the raw `error.message` from the underlying exception is sent directly to the API client as the 500 response's `message` field. This can leak internal detail (driver/library error text, occasionally partial connection info or file paths depending on what threw) to an external caller. It's also inconsistent with the otherwise-careful, specific error mapping the rest of the file demonstrates.

Also specific to this module: `branch.repository.ts:137-139`'s `update()` throws a bare `throw new Error('Branch not found')` instead of `AppError('Branch not found', 404, 'NOT_FOUND')`. That plain `Error` falls through to this same generic-message path, so a `PATCH` on an ID that was deleted *between* the service's `getById` existence check and the repository's `findOneAndUpdate` call (another small TOCTOU window) returns a **500** with code `INTERNAL_ERROR`, not the 404 the rest of the module consistently returns for "not found."

**Recommended fix:** change the fallback in `toAppError` to a fixed, generic message ("Unexpected server error") for unrecognized errors — the full detail is already logged server-side via `errorLogDetails()` for any 5xx, so nothing is lost for debugging, only removed from the client-facing payload. Separately, fix `branch.repository.ts:138` to throw `AppError(..., 404, 'NOT_FOUND')` for consistency with `branch.service.ts:19`.

---

### 3.6 🟡 MEDIUM — Dependency check covers 2 of roughly 15 collections that reference a branch

**Where:** `branch.repository.ts:154-160` (`dependencies()`), consumed by `branch.service.ts:63-76` (`delete()`)

Beyond the bug in §3.1, the check as designed only ever looks at `Department` and `User`. A repo-wide grep for `branchId`/`branchIds` as a schema field turns up roughly 15+ other collections that hold a direct branch reference and would be orphaned by a branch delete: `appointments`, `billing_invoices`, `opd_visits` (and ~9 OPD sub-collections including dental), `pharmacy_inventory`/batches/movements, `pharmacy_dispensing`, `surgery` recommendations/bookings, `consents`, `admissions-configuration`/beds. None of these are checked before a branch is soft-deleted.

**Why it matters:** in practice, the earlier `delete()` dependency check on `users` is what currently prevents most real-world accidental deletes (a branch with any staff on it can't be removed), so the blast radius of this gap is probably smaller than it looks. But it is still possible to soft-delete a branch that has, say, historical OPD visits or invoices but zero currently-assigned users/departments (e.g., a branch being wound down whose staff were reassigned first) — and every one of those clinical/financial records would silently point at a dead branch with no error, no warning, and no referential-integrity guard anywhere in the stack (Mongo has no foreign-key enforcement, so this is 100% on the application layer).

**Recommended fix:** this isn't something to fully solve inside `branches` alone (it would need each owning module to expose a lightweight "has records for branch X" check, aggregated here), but at minimum: (a) fix the `departments` bug in §3.1 now, and (b) treat this as a tracked follow-up to decide the product's actual policy — block delete on *any* historical reference (safest, but may make branches effectively undeletable once used), or allow delete and explicitly document that downstream branch references become historical/orphaned by design (acceptable if UI already treats a missing branch gracefully — unverified in this review).

---

### 3.7 🟢 LOW — CSV export uses `skip()`-based deep pagination

**Where:** `branch.service.ts:78-93` (`export`)

```ts
async function* rows() {
  let page = 1;
  while (true) {
    const result = await repository.list({ ...query, page, limit: 100 });
    ...
    page += 1;
  }
}
```

Each page calls `repository.list()`, which does `.skip(offset).limit(100)`. `skip()` cost grows linearly with offset — MongoDB still has to walk and discard every preceding document. For branches (small collection) this is a non-issue. Flagged because this export pattern is almost certainly the template copy-pasted for other modules' exports, some of which (patients, appointments, invoices) could have tens of thousands of rows, where `skip()`-based paging becomes measurably slow on later pages.

**Recommended fix (for the pattern generally, not urgent here):** keyset/cursor pagination (`_id > lastSeenId` instead of `skip(offset)`) for any export path expected to handle large collections.

### 3.7a 🟢 LOW — No structured business-event logging

Create/update/delete only produce a DB-written `AuditLogModel` entry (awaited, synchronously, in the request path — adding one more blocking round trip per mutation) and whatever Fastify's default access log captures. There's no `request.log.info(...)`-style structured log line for "branch X created by user Y" that would show up in log-aggregation tooling (Datadog/CloudWatch/etc.) without querying the audit collection directly. Low severity since the audit trail does exist and is queryable — this is an observability nicety, not a gap in the record itself.

### 3.7b 🟢 LOW — Request ID is not stable across processes

`middleware/request-context.ts` echoes Fastify's built-in `request.id` (default: a non-cryptographic incrementing counter, reset on every process restart) as `x-request-id`. In a horizontally-scaled, multi-instance deployment, two different instances will both produce `request.id = "1"` for their respective first requests. This makes request IDs useless for correlating a single request across logs if load-balanced across instances, and is worth a 10-minute fix (`genReqId` using a UUID or instance-prefixed counter) given how cheap request tracing is to get right versus how painful it is to debug production incidents without it.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| `email` format | ✅ | `branch.service.ts:96-98`, regex | None |
| `phone` format | ✅ | `branch.service.ts:99-101`, regex | None |
| `code`/`name` required, non-empty | ✅ | Fastify schema (`minLength: 1`) | None |
| `code` uniqueness | ⚠️ partial | `getByCode` pre-check + DB unique index | Race condition (§3.4); case-sensitivity mismatch between app check and DB index |
| `status` enum | ✅ | Fastify schema `enum` | None |
| Unexpected body fields | ✅ | `additionalProperties: false` | None |
| Pagination `limit` bounds | ✅ | schema `minimum: 1, maximum: 100` | None |
| `sortBy` whitelist | ✅ | schema `enum` + explicit map (`sortColumnByApiField`) prevents sort-field injection into Mongo | None |
| Delete with live dependents | ⚠️ broken | `dependencies()` | §3.1 (departments never detected), §3.6 (incomplete coverage) |
| Concurrent code creation | ❌ | — | §3.4 |
| ID format (`:id` params) | ⚠️ | schema only checks `minLength: 1`, not ObjectId shape | A non-ObjectId `:id` reaches Mongoose and throws a `CastError`, which **is** correctly caught and mapped to 400 `INVALID_ID` by the central handler — so this is actually handled correctly end-to-end, just one layer later than ideal (a schema-level `pattern` for a 24-hex-char ObjectId would reject it before touching the DB at all, saving one wasted round trip per malformed request) |

---

## 5. MongoDB index audit

**Collection: `branches`**

| Index | Used by | Assessment |
|---|---|---|
| `{ code: 1 }` (unique, implicit from schema) | `getByCode()` | Exists but **not effectively used** due to case-insensitive regex query (§3.3) |
| `{ name: 1 }` | — | Not used by any query in this module. `list()`'s default sort is `{ code: 1, name: 1 }`; `getByCode` doesn't sort. This index appears unused by current code — worth confirming nothing else (e.g. a future name-lookup) needs it before dropping it to save write overhead. |
| `{ deletedAt: 1, status: 1, createdAt: -1 }` | `list()` (filter + optional status + default... not quite) | Partially matches `list()`'s filter (`deletedAt`, optional `status`) but the index's trailing sort key is `createdAt: -1`, while `list()`'s default sort is `{ code: 1, name: 1 }` — **the compound index's sort order doesn't match the common-case query's sort order**, so Mongo can use the index for the filter portion but still needs an in-memory sort for the default `code`-sorted listing. For a small collection this is irrelevant (sorts in memory trivially); flagged as a latent mismatch worth fixing if `sortBy=created_at` becomes the common case, or conversely worth adding `{ deletedAt: 1, status: 1, code: 1 }` if `code` sort stays default. |

**Collections queried by this module but owned elsewhere:**
- `departments` — `{ branchIds: 1 }` index exists and is correctly shaped; just not the field this module's query actually targets (§3.1).
- `users` — `{ branchIds: 1, deletedAt: 1 }` index exists and **is** correctly targeted by `dependencies()`'s user count and `summary()`'s `branchIds: { $ne: [] }` count. However, **`$ne` on an indexed array field is a known MongoDB anti-pattern** — it can't use the index as a selective range scan (it must evaluate "every entry that doesn't equal this value," which for an empty-array comparison degenerates toward a full scan of the index). At current user-collection sizes this is cheap; it will not stay cheap as staff headcount grows into the thousands. Recommended: maintain a derived boolean (`hasBranchAssignment: true/false`) updated alongside `branchIds`, and index/query that instead — or simply query `countDocuments({ 'branchIds.0': { $exists: true }, deletedAt: null })`, which MongoDB can serve efficiently off the existing `branchIds` index.

**Summary:** no missing indexes causing a true collection scan on a large collection today (branches collection is small by nature), but three separate patterns (`$ne` on array, case-insensitive regex instead of collation, index/sort-order mismatch) are present and all three recur elsewhere in the codebase on collections that will not stay small.

---

## 6. API performance & round-trip analysis

Per-endpoint count of **sequential** (non-parallelizable) DB round trips, auth/permission layer + handler combined, assuming the happy path:

| Endpoint | Auth+Perm round trips | Handler round trips | Total sequential RTs | Notes |
|---|---|---|---|---|
| `GET /api/branches` | 4 | 0 (2 parallel) | **5** | list+count run via `Promise.all` — correctly parallelized |
| `GET /api/branches/summary` | 4 | 0 (5 parallel) | **5** | 5 aggregate counts via `Promise.all` — correctly parallelized |
| `GET /api/branches/:id` | 4 | 1 | **5** | |
| `GET /api/branches/export` | 4 | 1 (audit) + N (paged list, sequential by design — streaming) | **5 + N** | N = `ceil(total/100)`, acceptable for a stream |
| `POST /api/branches` | 4 | 3 (`getByCode` → `create` → `audit`, all sequential) | **7** | |
| `PATCH /api/branches/:id` | 4 | up to 4 (`getById` → optional `getByCode` → `update` → `audit`) | **up to 8** | Worst case when `code` is changed |
| `PATCH /api/branches/:id/status` | 4 | same as PATCH (delegates to `update`) | **up to 8** | |
| `DELETE /api/branches/:id` | 4 | 4 (`getById` → `dependencies` [2 parallel] → `softDelete` → `audit`) | **7** | |

**Interpretation given the Mumbai-region requirement:** if the API process itself is also hosted in/near the same Mumbai region as the MongoDB cluster (ideal, and the standard recommendation for this requirement), per-round-trip latency should be in the ~1-3ms range, making even the worst case here (~8 RTs ≈ 8-25ms of pure network overhead) a non-issue in absolute terms — the bigger cost at that point is in-process work and query execution time, not round trips. **If the API is instead hosted in a different region** (common on PaaS platforms like Render/Netlify's default regions, which are often US- or Singapore-based unless explicitly pinned), each round trip could cost 150-250ms+, and the mutation endpoints' 7-8 sequential round trips alone would add **1-2 seconds** of pure network latency before any actual work is considered — independent of query efficiency. **This should be verified as the first action item**: confirm the API's hosting region/deployment target is colocated with the Mumbai Mongo cluster. This is outside this module's code but is the single highest-leverage infrastructure fact for meeting the stated latency goal, and I could not verify it from the repository alone (deployment config in `render.yaml` should be checked against the actual MongoDB Atlas/cluster region).

---

## 7. Load testing (p65 / p90)

**Status: not executed. This is a required, unresolved item — not skipped by choice.**

This sandboxed review environment has no `apps/api/.env.dev` or `.env.dev.local` file and therefore no `DATABASE_URL`/`MONGODB_URI` credentials — there is no reachable MongoDB instance (Mumbai-hosted or otherwise) to connect to, seed, or run the server against. Per this session's operating constraints, I also would not connect to any real staging/production database without it being explicitly provided and the user confirming it's appropriate to point load-test traffic at it. No server was started and no requests were fired.

**What's needed to actually produce p65/p90 numbers:**
1. A reachable MongoDB connection string (ideally pointed at a staging replica in the same Mumbai region as production, never production itself) and a seeded `branches` collection with a realistic row count.
2. A valid auth token for a user with `Administration/Branches/*` permissions (the `database/seed.ts` bootstrap `admin` user, per our earlier discussion, works for this).
3. A k6 script targeting the branches endpoints specifically — the existing `benchmark/baseline.js` only covers `emergency`, `surgery`, and `admissions` endpoints; it does not exercise `branches` at all. A `branches`-specific script (list/get/summary/create/update under concurrent virtual users, with p65/p90/p99 thresholds) should be added alongside it, e.g. `benchmark/branches.js`, following the same structure.
4. Run it against both (a) the API colocated with Mongo and (b) if relevant, the actual deployed topology, to separate "query efficiency" latency from "network distance" latency per §6.

**What I can state without live measurement, from static analysis (§6):** given this module's query patterns (small collection, parallelized independent reads, `.lean()` everywhere, no N+1 loops), the *application-level* query cost for `branches` endpoints should be low — likely single-digit milliseconds of actual Mongo execution time per request at realistic data volumes. The dominant latency cost for this module, if any shows up in testing, will almost certainly trace back to §3.2 (4 uncached round trips for auth/permission on every call) and/or network distance (§6), not to the branches queries themselves. **I'd recommend load-testing the auth/permission middleware in isolation** (hit any trivial authenticated endpoint under load) before load-testing `branches` specifically — it will likely explain most of whatever tail latency is observed across the whole API, not just this module.

---

## 8. Scalability & dynamic-approach recommendations

- **Treat the auth/permission round-trip problem (§3.2) as the highest-leverage scalability fix in this review**, not just a correctness nicety — it costs every single authenticated request in the entire API, not just `branches`, so fixing it once (a short-TTL cache or embedding a permission digest in the session) scales its benefit across every module reviewed in this series and every one still to come.
- **Replace case-insensitive regex uniqueness checks (§3.3/§3.4) with a collation-based index** before this collection grows — the fix is cheap now and becomes progressively more valuable as `branches` (and the same pattern elsewhere) accumulates rows, since a collation index keeps lookup cost flat while a regex scan's cost grows with collection size.
- **Move the branch-deletion dependency check (§3.1, §3.6) toward a policy that scales past a single collection check** — right now it only ever checks `departments` and `users`; as more modules reference `branchId`, the right long-term shape is a small, registry-driven "does anything reference this branch" check that other modules can plug into, rather than `branches` needing to know about every other collection by name.
- **Avoid `skip()`-based pagination for any export path expected to grow** (§3.7) — fine today at `branches`' small scale, but this exact pattern is copy-pasted as the template for other modules' CSV exports; worth fixing the template once rather than each copy as it individually becomes slow.
- **Confirm the API's deployment region relative to the Mumbai Mongo cluster (§6)** before investing further in query-level optimization here — if there's a region mismatch, no amount of index tuning on this module will matter as much as fixing that one piece of infrastructure (see `code-review/_infrastructure/render-region-vs-mongo-region.md`).

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] **Fix `dependencies()` querying `branchId` instead of `branchIds` on `Department`** (§3.1) — data integrity, should be treated as a priority fix even though this review makes no code changes itself.
- [ ] Decide and implement a caching strategy for `authenticate`/`userHasPermission` (§3.2) — cross-module, needs a decision on approach (in-process TTL cache vs. session cache vs. JWT-embedded permission digest) before implementation.
- [ ] Replace case-insensitive regex lookups with a collation-based index (or normalized shadow field) for `code` uniqueness (§3.3, §3.4) — closes both the index-bypass and the uniqueness race in one change.
- [ ] Tighten `toAppError`'s fallback to a fixed generic message instead of forwarding raw `error.message` (§3.5).
- [ ] Fix `branch.repository.ts:138`'s bare `Error('Branch not found')` to use `AppError(..., 404, 'NOT_FOUND')` (§3.5).
- [ ] Decide and document the intended policy for branch deletion with historical (non-user/department) references, then implement accordingly (§3.6).
- [ ] Replace `$ne: []` array check in `summary()` with an existence-based query against the existing index (§5).
- [ ] Confirm API deployment region vs. MongoDB Atlas cluster region — needed to interpret all latency numbers correctly (§6).
- [ ] Build and run a `branches`-specific k6 script to get real p65/p90/p99 numbers once a reachable non-production DB is available (§7).
- [ ] Low-priority cleanup: unused `{ name: 1 }` index, non-UUID `request.id`, no structured business-event log lines, CSV export's `skip()` pagination pattern (flagged for awareness as it propagates to larger modules), ObjectId-shape validation at the schema layer for `:id` params.

---

## 10. Verdict

**Not yet production-ready**, but close for a module this size — one confirmed data-integrity bug (§3.1) and one confirmed systemic latency problem that isn't this module's fault but is fully visible through it (§3.2) are the two items that actually matter. Everything else is a legitimate but lower-urgency cleanup item, several of which are worth fixing here first specifically *because* this is the template module other reviews in this series will be compared against.
