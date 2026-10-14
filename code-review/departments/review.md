# Module Review: `departments`

**Reviewed:** 2026-10-05
**Scope:** `apps/api/src/modules/departments/*` (`department.model.ts`, `department.repository.ts`, `department.service.ts`, `department.routes.ts`, `department.schemas.ts`, `department.types.ts`).
**Review type:** Static code review + architectural/query analysis. **No code was modified.** Live load testing was not executed in this pass — see [`code-review/branches/review.md`](../branches/review.md) §7 for why (no reachable DB in this sandbox) and the plan to close it; that plan now applies across modules (see §7 below, updated).
**Baseline:** this module shares its shape and cross-cutting dependencies (auth/permission middleware, error handler, CSV export pattern) with `branches` (reviewed previously). Findings already fully documented there are referenced rather than re-derived at length, to keep this review focused on what's actually different about `departments`.

---

## 1. Executive summary

`departments` is structurally the same module as `branches` (same CRUD shape, same middleware chain, same export pattern) plus one real axis of extra complexity: a department can belong to **multiple** branches (`branchIds: ObjectId[]`), and the code shows visible scar tissue from a past migration off a **single**-branch model (`branchId`). That scar tissue produces one genuine correctness bug in list filtering (§3.1) in addition to inheriting every cross-cutting issue already logged against `branches`.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 0 | — |
| 🟠 High | 1 new + 2 inherited | Branch-filtered department listing silently returns unrelated, branch-less departments (new); 4-round-trip uncached auth/permission chain + code-uniqueness TOCTOU race (inherited from `branches`, identical here) |
| 🟡 Medium | 2 new + 2 inherited | Dead legacy-field branching left in repository/types; incomplete dependency check doesn't cover the ~10+ other collections referencing `departmentId`; case-insensitive regex index bypass + generic error-message leakage (inherited) |
| 🟢 Low | 1 new + 2 inherited | No ObjectId-shape validation on `branch_ids` array items before they hit the DB; deep-`skip()` CSV export + non-unique request ID (inherited) |

Good news relative to `branches`: the one bug that was critical there — a dependency check querying the wrong field name — **is correctly implemented here**. `dependencies()` targets `ServiceModel.departmentId` and `UserModel.departmentIds`, both verified against the actual schemas and both correct.

---

## 2. What's correct (keep doing this)

- **`dependencies()` field names are correct** (verified against `service.model.ts:14` and `user.model.ts:12`) — this is the exact bug class found in `branches`, and it's done right here. Worth understanding *why* it's right here and wrong there before fixing `branches`, in case there's a reason (there doesn't appear to be — it looks like `branches` was just a typo).
- **Branch-reference validation is parallelized correctly**: `create()`/`update()` validate every submitted `branch_id` via `Promise.all(data.branch_ids.map(id => this.requireActiveBranch(id)))` rather than a sequential loop — correct pattern for independent per-item validation, avoids an N+1-style serial wait.
- **The default list sort (`created_at desc`) matches an existing compound index** (`{ deletedAt: 1, status: 1, createdAt: -1 }`, `department.model.ts:54`) better than `branches`' default sort did against its equivalent index — this module's indexing was evidently designed with the common query shape in mind.
- **A genuinely well-targeted compound index exists** for the realistic "clinical departments in branch X" staff query: `{ deletedAt: 1, status: 1, isClinical: 1, branchIds: 1, name: 1 }` (`department.model.ts:55`). This is good index design — it's a compound index clearly built for the application's actual access pattern, not just a generic per-field index. More modules should look like this.
- **`hiddenModules` is schema-whitelisted** against a fixed `departmentModuleKeys` enum both in the Mongoose schema and the Fastify body schema — no arbitrary string injection into a field that presumably drives UI/feature gating elsewhere.
- **`branch_ids: { minItems: 1 }`** is enforced at the schema layer, so a department can never be created with zero branches through the API (contrast with `branches`, which has no equivalent upstream guarantee for its own required fields beyond `code`/`name`).
- Same positives as `branches` carry over unchanged and correctly: `.lean()` everywhere, regex-escaping of user search input, `additionalProperties: false` + `minProperties: 1` on schemas, soft-delete pattern, parallel `Promise.all` reads in `list()`/`summary()`/`dependencies()`, single up-front audit write for CSV export.

---

## 3. Findings

### 3.1 🟠 HIGH (new) — Branch-filtered listing silently includes departments with no branch at all

**Where:** `department.repository.ts:54-65`

```ts
if (query.branch_id) {
  const bId = new Types.ObjectId(query.branch_id);
  andClauses.push({
    $or: [
      { branchIds: bId },
      { branchId: bId },
      { branchIds: { $exists: false } },
      { branchIds: { $size: 0 } },
    ],
  });
}
```

When a caller filters `GET /api/departments?branch_id=X`, the intended semantics are presumably "departments assigned to branch X." The actual filter is "departments assigned to branch X, **OR departments assigned to no branch at all**" (the last two `$or` clauses). Any department with an empty or missing `branchIds` array will show up in the result set for **every** branch_id filter, regardless of which branch was requested — a department with zero branches assigned is indistinguishable, from this query's perspective, from one that matches the requested branch.

The `{ branchId: bId }` clause (singular) is additionally dead code: the schema has no `branchId` field (confirmed — only `branchIds` exists on `department.model.ts`), so that clause can never match anything. It's leftover from whatever predated the `branchIds` array migration (there's a `database/migrate-clinical-depts.ts` script in the repo, consistent with a past single-branch→multi-branch migration).

**Why it matters:** this is a real, user-visible correctness bug, not just dead weight. Any UI that filters a department picker by branch (department assignment forms, user creation's branch/department selection, reporting scoped to a branch) will show departments that don't belong to that branch if any department exists with an empty `branchIds`. Whether that's currently *reachable* depends on whether any such departments exist in production data — but nothing in the schema or service layer prevents an empty-`branchIds` department from existing via any path other than the API's `minItems: 1` schema guard (direct DB writes, migrations, or future code bypassing the schema would all produce one).

**Recommended fix:** drop the last three `$or` clauses entirely — `{ branchIds: bId }` alone is both correct and sufficient. If the empty/missing-`branchIds` fallback was intentionally added to surface not-yet-migrated legacy data during the `branchId`→`branchIds` migration, that migration should be confirmed complete (check `migrate-clinical-depts.ts`'s status/idempotency) and this fallback removed — it should not be permanent query logic.

---

### 3.2 🟡 MEDIUM (new) — Dead single-branch (`branchId`) fallback left in repository type and mapper

**Where:** `department.repository.ts:14-31`

```ts
type DepartmentRecord = {
  ...
  branchIds?: Types.ObjectId[];
  branchId?: Types.ObjectId;   // <- not a real schema field
  ...
};
const branchIds = (record: DepartmentRecord) => record.branchIds ?? (record.branchId ? [record.branchId] : []);
```

Same root cause as §3.1: a `branchId` singular field is typed and defensively handled as if it might exist on a document, but the live Mongoose schema has never had this field (per `department.model.ts`, only `branchIds` is, and presumably always was, defined — at least in the current schema version). This doesn't cause incorrect behavior on its own (the fallback is only exercised if `branchIds` is falsy, in which case it correctly falls through to `[]` anyway since `branchId` can never be populated), but it's confusing dead code that will cost a future reader real time figuring out whether it's safe to delete, and it's the same root confusion that produced the actual bug in §3.1.

**Recommended fix:** remove the `branchId` field from `DepartmentRecord` and simplify `branchIds()` to `record.branchIds ?? []`, once §3.1's fix confirms nothing downstream still needs the legacy shape.

---

### 3.3 🟡 MEDIUM — Dependency check covers 2 of many collections referencing `departmentId`

**Where:** `department.repository.ts:167-173` (`dependencies()`), consumed by `department.service.ts:75-88` (`delete()`)

Same category of gap as `branches` §3.6, and worth flagging with the same weight here: `dependencies()` only checks `services` and `users`. A repo-wide grep shows `departmentId` (or `departmentIds`) referenced directly by at least: `doctors`, `appointments`, `opd` visits (and its dental sub-collections), `consents`, `emergency`, `pharmacy-inventory`, `laboratory`/`imaging` orders. None of these are checked before a department is soft-deleted. Unlike `branches` (where the `users` check alone covers most realistic accidental-delete scenarios, since branches without any staff are rare), a **department** can very plausibly have zero currently-assigned users or service-catalogue entries while still having historical clinical records (OPD visits, appointments, orders) tied to it — department reorganizations (renaming/merging/retiring a department) are a more realistic scenario here than for branches.

**Why it matters:** higher real-world likelihood of triggering than the equivalent `branches` gap, given departments are reorganized more often than branches are decommissioned.

**Recommended fix:** same as `branches` §3.6 — not fully solvable inside this module alone, needs a product decision on delete policy (block on *any* historical reference vs. accept orphaned historical references by design) applied consistently across both `branches` and `departments`.

---

### 3.4 🟢 LOW (new) — `branch_ids` array items aren't validated as ObjectId-shaped before reaching the DB

**Where:** `department.schemas.ts:42-46`, `department.service.ts:110-118` (`requireActiveBranch`)

The Fastify schema validates `branch_ids` as `{ type: 'array', items: { type: 'string', minLength: 1 } }` — any non-empty string passes, including non-ObjectId strings. A malformed entry reaches `requireActiveBranch()` → `branchRepository.getById(id)` → `BranchModel.findOne({ _id: id, ... })`, where Mongoose throws a `CastError` on the invalid id, correctly caught by the central error handler and mapped to 400 `INVALID_ID`. End-to-end behavior is correct; it's just one avoidable round trip per malformed array entry before the error surfaces. Same minor pattern as `branches`' `:id` path param (see `branches` review §4).

**Recommended fix:** add a `pattern: '^[0-9a-fA-F]{24}$'` to the schema's array item definition — rejects malformed IDs at the HTTP boundary with zero DB cost.

---

### 3.5 Inherited findings (full detail in `branches` review — apply identically here)

These are not re-derived in full since the root cause and fix are identical to the `branches` module; see the linked section for evidence and recommended fixes.

- 🟠 **4 sequential, uncached DB round trips for auth+permission on every request** — [`branches` review §3.2](../branches/review.md#32--high--every-authenticated-request-costs-4-sequential-uncached-db-round-trips-before-any-business-logic-runs). Applies to every `departments` endpoint identically; it's shared middleware, not module-specific code.
- 🟡 **Case-insensitive anchored regex bypasses the `code` unique index** in `getByCode()` (`department.repository.ts:104`) — same pattern, same fix (collation-based index), as [`branches` §3.3](../branches/review.md#33--medium--case-insensitive-anchored-regex-lookups-bypass-indexes).
- 🟠 **TOCTOU race + case-sensitivity mismatch on `code` uniqueness** — `department.service.ts:29-33` and `:48-53` have the identical pre-check-then-insert race as [`branches` §3.4](../branches/review.md#34--high--toctou-race-on-branch-code-uniqueness).
- 🟡 **Generic/leaky error fallback** — `department.repository.ts:151`'s bare `throw new Error('Department not found')` has the exact same problem as `branches` §3.5 (falls through to a 500 with a raw message instead of a 404 `AppError`). Same fix: change to `AppError('Department not found', 404, 'NOT_FOUND')`.
- 🟢 **CSV export uses `skip()`-based deep pagination** (`department.service.ts:90-108`) — same pattern as [`branches` §3.7](../branches/review.md#37--low--csv-export-uses-skip-based-deep-pagination).
- 🟢 **No structured business-event logging** beyond the audit DB write, and **non-unique `x-request-id`** across process instances — same as `branches` §3.7a/§3.7b, shared middleware.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| `code`/`name` required, non-empty | ✅ | Fastify schema | None |
| `branch_ids` required, min 1 item | ✅ | Fastify schema `minItems: 1` | None (better than `branches`, which has no multi-FK required field to compare against) |
| `branch_ids` items are valid ObjectIds | ❌ | — | §3.4 |
| Each `branch_id` references an *active* branch | ✅ | `requireActiveBranch()`, parallelized | None — correctly implemented and a good practice (prevents attaching a department to a disabled/retired branch) |
| `hiddenModules` whitelist | ✅ | schema `enum` + Mongoose schema `enum` (defense in depth, validated twice) | None |
| `code` uniqueness | ⚠️ partial | pre-check + DB unique index | §3.5 (TOCTOU, inherited) |
| Unexpected body fields | ✅ | `additionalProperties: false` | None |
| Delete with live dependents | ⚠️ partial | `dependencies()` — correct fields, incomplete coverage | §3.3 |
| Branch-scoped listing correctness | ❌ | `list()` | §3.1 |

---

## 5. MongoDB index audit

**Collection: `departments`**

| Index | Used by | Assessment |
|---|---|---|
| `{ code: 1 }` (unique, implicit) | `getByCode()` | Not effectively used — same case-insensitive regex issue as `branches` |
| `{ name: 1 }` | — | Not targeted by any current query in this module (same as `branches`' unused `{name:1}`) — confirm nothing else needs it before dropping |
| `{ branchIds: 1 }` | `list()`'s `branch_id` filter (partially — see §3.1 for why the filter logic itself is wrong even though the index is right) | Correctly shaped for the (intended) query |
| `{ deletedAt: 1, status: 1, createdAt: -1 }` | `list()` default filter + sort | **Well-matched** — this is the positive case `branches`' equivalent index missed (sort order matches the actual default query) |
| `{ deletedAt: 1, status: 1, isClinical: 1, branchIds: 1, name: 1 }` | `list()` when `isClinical`+`branch_id` filters are both present | Well-designed for the realistic "clinical departments in branch X" query shape |

**Collections queried by this module but owned elsewhere:**
- `services` — `{ departmentId: 1 }` and two further compound indexes exist and are correctly targeted by `dependencies()`.
- `users` — `{ departmentIds: 1, deletedAt: 1 }` exists and is correctly targeted.

**Summary:** meaningfully better index design than `branches` for the common query shapes — the main index-related issue here is identical to `branches`' (`code` lookup bypassing its own unique index via case-insensitive regex), not anything new.

---

## 6. API performance & round-trip analysis

Same shape of analysis as `branches` (see that review §6 for the Mumbai-region interpretation, which applies identically here):

| Endpoint | Auth+Perm RTs | Handler RTs | Total sequential RTs | Notes |
|---|---|---|---|---|
| `GET /api/departments` | 4 | 0 (2 parallel) | **5** | |
| `GET /api/departments/summary` | 4 | 0 (5 parallel) | **5** | |
| `GET /api/departments/:id` | 4 | 1 | **5** | |
| `GET /api/departments/export` | 4 | 1 (audit) + N (paged) | **5 + N** | |
| `POST /api/departments` | 4 | 2 (`getByCode`) + up to K parallel (`requireActiveBranch` × branch_ids.length, 1 RT regardless of K since parallelized) + 2 (`create`, `audit`) | **~5** (K doesn't add sequential depth) | Correctly parallelized — branch validation cost doesn't scale with round-trip count, only with the slowest single branch lookup |
| `PATCH /api/departments/:id` | 4 | up to 5 (`getById` → optional `getByCode` → optional branch validation → `update` → `audit`) | **up to 9** | Slightly worse worst case than `branches`' PATCH (8) because of the extra optional branch-revalidation step |
| `DELETE /api/departments/:id` | 4 | 4 (`getById` → `dependencies` [2 parallel] → `softDelete` → `audit`) | **7** | |

---

## 7. Load testing (p65 / p90)

**Status: not executed in this pass**, for the same reason documented in the `branches` review (§7 there) — no reachable MongoDB in this sandbox. That gap is now being closed at the module-group level rather than per-module: the in-progress Authentication & RBAC review (next) sets up a real, ephemeral test environment using the project's own `mongodb-memory-server` dev dependency and the `seedDatabase()` bootstrap, driven through Fastify's in-process request injection. Once that harness exists, re-running it against `branches` and `departments` endpoints (in addition to its primary auth/RBAC focus) is a small incremental addition and will be done as part of that work, with the same caveat that apply there: an in-memory local Mongo instance gives trustworthy *functional* and *relative round-trip* results, but not real Mumbai-region network latency — actual p65/p90 numbers still require a reachable staging deployment colocated with the production region.

---

## 8. Scalability & dynamic-approach recommendations

- **The `$or` branch-filter bug (§3.1) is also a scalability concern, not just a correctness one**: as departments with empty `branchIds` accumulate (if that's ever a reachable state at scale), every branch-filtered listing gets progressively noisier with irrelevant results. Fixing the query logic now keeps it correct regardless of how much data accumulates, rather than relying on empty-`branchIds` departments staying rare by luck.
- **The well-designed compound index for the "clinical departments in branch X" query shape (§5) should be the template** other modules reach for when they have a similarly multi-dimensional filter (status + a boolean flag + a scoping ID) — it's already proven out here.
- **Resolve the delete-policy question (§3.3) once, as a shared decision with `branches`**, rather than letting each module invent its own answer — a consistent, registry-driven "what references this" check (as recommended in the `branches` retrofit above) would serve both modules identically and scale cleanly as more modules add department references.
- **All of the inherited cross-cutting items (auth/permission caching, collation indexes, the `toAppError` fallback) scale in benefit exactly as described in the `branches` review** — they're not restated here, but the same leverage argument applies: fix once, centrally, benefit every module that shares the code.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Fix the branch-filtered `list()` query to drop the three incorrect `$or` fallback clauses, keeping only `{ branchIds: bId }` (§3.1) — correctness bug, should be prioritized similarly to the `branches` dependency-check bug.
- [ ] Remove the dead `branchId` (singular) type field and fallback logic from `DepartmentRecord`/`branchIds()` once §3.1 is confirmed safe to simplify (§3.2).
- [ ] Decide and document delete policy for departments with historical (non-service/user) references, consistently with the same decision needed for `branches` (§3.3).
- [ ] Add ObjectId `pattern` validation to `branch_ids` array items at the schema layer (§3.4).
- [ ] All inherited items from `branches` §9 apply here too and should be fixed once, centrally, where the shared code lives (middleware, `toAppError`, collation index helper) rather than duplicated per-module.
- [ ] Re-run load/latency testing against this module once the shared test harness (being built for Authentication & RBAC) exists (§7).

---

## 10. Verdict

**Not yet production-ready**, same overall bar as `branches` — no critical bugs this time, but one high-severity correctness bug (§3.1) that's more likely to be user-visible than anything found in `branches`, plus the full set of inherited cross-cutting issues. The index design here is noticeably better than `branches`', suggesting whoever built the department list/filter query logic put more thought into query shape than into the edge cases of the legacy-field migration it was layered on top of.
