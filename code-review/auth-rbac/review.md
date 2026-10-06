# Module Review: Authentication & RBAC (`auth`, `roles`, `permissions`, `users`)

**Reviewed:** 2026-10-05
**Scope:** `apps/api/src/modules/{auth,roles,permissions,users}/*` plus the shared middleware chain (`middleware/authenticate.ts`, `middleware/require-permission.ts`) and cross-cutting security primitives (`shared/security/{jwt,hash,password-policy}.ts`, `modules/auth/auth-rate-limit.repository.ts`, `modules/auth/auth-session-cookie.ts`).
**Review type:** Static code review **plus live functional testing** — this module group was actually exercised end-to-end, not just read. See §1 for how.

---

## 1. How this review was actually tested

Unlike the `branches` and `departments` reviews (static-only, no reachable database in that sandbox), this one includes a **real, live test run**: login as 7 different roles, a real RBAC allow/deny matrix across 5 endpoints (35 live HTTP calls), negative-auth tests, account lockout, and refresh-token rotation — all executed against an actual running instance of the application.

**How:** the project already declares `mongodb-memory-server` as a dev dependency (used by its own `apps/api/test/setup.ts`), which spins up a real, ephemeral MongoDB replica set on demand — no external database needed. I:
1. Installed it (it was declared in `package.json` but **not actually present** in `node_modules` — see §9 for why that itself is a finding).
2. Booted a 1-node in-memory MongoDB replica set.
3. Created a `Branch`/`Department` structure and ran the project's own `seedDatabase()` bootstrap (the same function that runs on every real server boot) to get a real permission catalog, real roles, a real `SUPER_ADMIN` admin account, and real operational users for 6 of the system's 7 role templates (`RECEPTIONIST`, `CLINICIAN_NURSE`, `PHARMACY_USER`, `LABORATORY_USER`, `IMAGING_USER`, `BILLING_AUTHORIZED` — `DOCTOR` is a defined role with no seeded bootstrap user; see §7).
4. Built the actual Fastify app (`buildApp()`) and drove it via Fastify's in-process `app.inject()` — this runs every line of real middleware, route, service, and repository code, including real MongoDB queries against the in-memory replica set. No mocking.
5. Ran the full scenario twice, independently, to check for flakiness. Results were consistent both times (exact figures below are from the second run; both runs are in close agreement).
6. Deleted the throwaway test script afterward — nothing was added to the permanent test suite or committed.

**What this does and doesn't prove:** this is genuine functional/behavioral verification — the RBAC matrix, error codes, and security properties below are *observed*, not inferred from reading code. It is explicitly **not** a measurement of real Mumbai-region production latency — there is no real network between the app and the database (`app.inject()` bypasses sockets entirely, and the DB itself is an in-process child process). The timing numbers in §6 are useful for *relative, structural* comparison (does an endpoint with more round trips cost more, even locally?) and for catching gross regressions, not for production capacity planning.

---

## 2. Executive summary

This is the best-built part of the codebase reviewed so far. The authorization-escalation prevention logic in `permissions` (§4) and the refresh-token rotation/reuse-detection (§5, verified live) are genuinely strong, deliberate security engineering — better than what's typical for a system this size. The core finding set:

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 0 | — |
| 🟠 High | 1 new + 1 inherited | A successful login performs 11 sequential DB round trips, including **fetching the same user document 4 separate times** (new); the shared 4-round-trip, uncached auth/permission chain documented in the `branches` review applies here too, since this *is* that code (inherited, same root cause) |
| 🟡 Medium | 3 new | Branch-scope filtering logic is split across service and repository layers in a way that currently works correctly but has no defense if a future caller skips the service layer (verified NOT currently exploitable — see §4.4); CSV user-export re-runs full authorization resolution on every page; `clearFailedLogin` performs two sequential writes that could be one |
| 🟢 Low | 2 new | Unprofessional/uncertain inline comments left in production code; project's own test suite could not run out of the box due to an undeclared-vs-uninstalled dependency gap |

**Live-verified and working correctly, no caveats:** multi-role login (7/7 roles), RBAC allow/deny enforcement (35/35 checks matched the permission catalog exactly), login error uniformity (no user-enumeration leak), account lockout (fails closed, no distinct leak), refresh token issuance, and refresh token **rotation with reuse detection** (reusing a rotated token is correctly rejected). This is a rare case of a subsystem's security properties being independently confirmed by execution rather than taken on faith from reading the code.

---

## 3. Live test results

### 3.1 Multi-role login

All 7 identities authenticated successfully on the first attempt, with the correct role and a sane permission count returned in the login response:

| Username | Expected role | Login result | Role returned matches | Permissions granted | Branches |
|---|---|---|---|---|---|
| `admin` | `SUPER_ADMIN` | 200 | ✅ | 172 (all active permissions) | none assigned (bootstrap account, by design — see the earlier discussion of how the super-admin is bootstrapped without a branch) |
| `receptionist` | `RECEPTIONIST` | 200 | ✅ | 47 | MB01 |
| `nurse` | `CLINICIAN_NURSE` | 200 | ✅ | 26 | MB01 |
| `pharmacy` | `PHARMACY_USER` | 200 | ✅ | 15 | MB01 |
| `laboratory_mb01` | `LABORATORY_USER` | 200 | ✅ | 6 | MB01 |
| `imaging_mb01` | `IMAGING_USER` | 200 | ✅ | 6 | MB01 |
| `billing_mb01` | `BILLING_AUTHORIZED` | 200 | ✅ | 17 | MB01 |

`GET /api/auth/me` as `admin` correctly returned the admin's own identity.

### 3.2 RBAC allow/deny matrix (actual HTTP status codes, 7 roles × 5 endpoints = 35 live checks)

| Identity | `GET /branches` | `POST /branches` | `GET /departments` | `GET /users` | `GET /roles` |
|---|---|---|---|---|---|
| admin (SUPER_ADMIN) | 200 | 201 | 200 | 200 | 200 |
| receptionist | 200 | 403 | 200 | 403 | 403 |
| nurse | 403 | 403 | 403 | 403 | 403 |
| pharmacy | 403 | 403 | 403 | 403 | 403 |
| laboratory_mb01 | 403 | 403 | 403 | 403 | 403 |
| imaging_mb01 | 403 | 403 | 403 | 403 | 403 |
| billing_mb01 | 403 | 403 | 403 | 403 | 403 |

**Every single result matches what the seeded permission catalog predicts**, with no exceptions: `SUPER_ADMIN` bypasses all checks (confirmed by code at `permission.repository.ts:456`'s `$or: [{ code: 'SUPER_ADMIN' }, ...]`, now also confirmed by execution); `RECEPTIONIST` has `Administration.Branches.View` and `Administration.Departments.View` but not `Create`/`Users`/`Roles`, and that's exactly what it got; all five clinical/operational roles have zero `Administration` module permissions at all, and all five were denied on all five admin-surface endpoints. This is a real, end-to-end confirmation that the permission model, the seed data, and the enforcement middleware are consistent with each other — the three things most likely to silently drift apart in a system like this.

### 3.3 Negative authentication tests

| Case | Result | Notes |
|---|---|---|
| Wrong password | `401 INVALID_CREDENTIALS`, message *"Invalid username or password"* | |
| Unknown username | `401 INVALID_CREDENTIALS`, **identical** message | ✅ No user-enumeration signal — confirmed by direct comparison of the two response bodies, not just status code |
| No `Authorization` header | `401 AUTHENTICATION_REQUIRED` | |
| Malformed/garbage Bearer token | `401 INVALID_TOKEN` | Handled cleanly — no crash, no 500 |
| Valid token, insufficient permission | `403 PERMISSION_REQUIRED` | |

### 3.4 Account lockout

5 consecutive wrong-password attempts against `nurse`, then one attempt with the **correct** password:

| Attempt | Result |
|---|---|
| 1–5 (wrong password) | `401 INVALID_CREDENTIALS` each time |
| 6 (correct password, account now locked) | **Still `401 INVALID_CREDENTIALS`** — same code, same message as a simple wrong password |

This is correct, deliberate behavior (confirmed by reading `auth.service.ts:116-123`): a locked account gives no signal that it's locked specifically, as opposed to the password simply being wrong. That's good security hygiene (an attacker can't distinguish "wrong password" from "account locked," which would otherwise leak account-lock state). The flip side, worth noting neutrally rather than as a defect: a legitimate user who gets locked out has no way to know *why* their correct password stopped working from the API response alone — that has to be surfaced through some other channel (support, an admin-side unlock view) since the API is deliberately opaque about it here.

### 3.5 Refresh token flow

- Login → cookie captured → `POST /api/auth/refresh` with that cookie → **200, new access token issued**.
- Using the **same, now-rotated** refresh cookie a second time → **401 `INVALID_REFRESH_TOKEN`**.

This confirms refresh token rotation actually invalidates the prior token (not just issues a new one alongside the old) — a real, commonly-missed security property, and it's implemented correctly here (`auth.repository.ts:203-209`'s `revokeRefreshToken`, called during refresh).

---

## 4. Code review findings

### 4.1 🟠 HIGH (new) — A successful login performs 11 sequential DB round trips, fetching the same user document 4 times

**Where:** `auth.service.ts:95-168` (`login`), tracing into `auth.repository.ts` and `auth-rate-limit.repository.ts`

Tracing every DB operation triggered by one successful `POST /api/auth/login` call, in execution order:

1. `enforcePublicAuthRateLimits` → rate-limit consume for **identity** (1 atomic upsert)
2. `enforcePublicAuthRateLimits` → rate-limit consume for **IP** (1 atomic upsert)
3. `findUserByIdentifier` — 1st user fetch
4. `clearFailedLogin` → `UserModel.updateOne` #1 (reset failed-attempt counters)
5. `clearFailedLogin` → `UserModel.updateOne` #2 (separate call, only to flip `status: 'locked'` back to `'active'`)
6. `findUserById` — **2nd** user fetch, solely to get post-update field values (`auth.service.ts:155`)
7. `issueTokenPair` → `createRefreshToken` insert
8. `audit('auth.login.succeeded', ...)` insert
9. `publicUser(freshUser)` → `getUserAccessContext` → `UserModel.findOne` — **3rd** user fetch (`auth.repository.ts:36`, this one re-selecting `roleIds`/`branchIds`/`departmentIds` that were already available from fetch #2)
10. `getUserAccessContext` → `Promise.all([roles, branches, departments])` — parallelized, 1 round
11. `getUserAccessContext` → `PermissionModel.find(...)` — sequential after #10 since it depends on the resolved role IDs

That's **11 sequential round trips for one login**, 3 of which are the *same user document* fetched independently by three different pieces of code that don't know about each other. This is the same class of problem as the duplicate user-fetch already flagged in the `branches` review (§3.2 there), but worse here because it's 3-deep instead of 2, and it's on the single most latency-sensitive endpoint in the entire application — the one every session starts with.

**Why it matters:** this directly explains the bimodal timing distribution measured live (§6) — more sequential round trips means more opportunities for one of them to land on a slow write-acknowledgment cycle. In a real Mumbai-hosted deployment with the API elsewhere, 11 round trips at even 2-3ms each is 20-30ms of pure network overhead before considering query cost; cross-region, it could be seconds.

**Recommended fix, in order of impact:**
1. Combine `clearFailedLogin`'s two `updateOne` calls into one (`$set: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), status: 'active' }` — setting `status: 'active'` unconditionally here is safe, since `clearFailedLogin` is only ever reached after a successful password check that already passed the `isLocked()` gate).
2. Have `clearFailedLogin` use `findOneAndUpdate` with `returnDocument: 'after'` and return the updated document directly, eliminating the separate `findUserById` refetch at step 6.
3. Have `getUserAccessContext` accept an already-fetched user record (it only needs `roleIds`/`branchIds`/`departmentIds`, all of which are already in hand by the time `publicUser` is called) instead of re-querying `UserModel` from scratch, eliminating fetch #3.

Doing all three would take this from 11 round trips down to roughly 7, with zero behavior change.

### 4.2 🟠 HIGH (inherited) — Shared 4-round-trip, uncached auth/permission chain

This is the exact code documented in the `branches` review ([§3.2](../branches/review.md#32--high--every-authenticated-request-costs-4-sequential-uncached-db-round-trips-before-any-business-logic-runs)) — it isn't a different instance of the same bug, it *is* the same code (`middleware/authenticate.ts` + `middleware/require-permission.ts` + `permission.repository.ts:438-460`), reviewed from its actual source this time rather than from its callers. Confirmed again here: `userHasPermission()` re-fetches the user document independently of `authenticate()`'s own fetch, and there is no caching anywhere in this module group for permission/role resolution. Every one of the 35 RBAC checks in §3.2 paid this cost. Not re-deriving the fix here — see the `branches` review for the full writeup; flagging again only to confirm via direct code reading (not inference) that the fix belongs in exactly the two files named above.

### 4.3 🟡 MEDIUM (new) — User list/export re-runs full authorization resolution per CSV export page

**Where:** `user.service.ts:500-520` (`export`), calling `this.list(...)` (the *service* method, not the repository directly) once per page

```ts
const loadPage = (page: number) => this.list({ ...normalizedQuery, page, limit: 100 }, actorUserId);
```

`this.list()` calls `this.repository.resolveBranchScope(actorUserId, normalizedQuery.branchId)` (`user.service.ts:120`) — which does a `UserModel.findOne` + a `RoleModel.exists` check for `SUPER_ADMIN`, plus (if a specific `branchId` filter is set) a `BranchModel.exists` check — **on every single page** of the export, re-deriving the exact same authorization answer every time instead of resolving it once before the loop starts.

**Why it matters:** for a large user export (hundreds/thousands of staff across many pages), this multiplies 2-3 redundant DB calls by the page count for zero behavioral benefit — the actor's authorization scope cannot change mid-export.

**Recommended fix:** resolve `branchScope` once before the `rows()` generator starts, and have the generator call `this.repository.list(normalizedQuery, branchScope)` directly for each page instead of routing every page back through the full `this.list()` service method.

### 4.4 🟡 MEDIUM (new, but verified NOT currently exploitable) — Branch-scope filtering is split across layers in a way that has no defense if bypassed

**Where:** `user.service.ts:120-122` (`list`) and `user.repository.ts:171-190` (`list`)

This finding changed shape during review and it's worth showing the correction, since it's a good illustration of why tracing a call chain fully matters before calling something a vulnerability.

**First read (incomplete, and wrong):** `user.repository.ts`'s `list()` sets `filter.branchIds = { $in: branchIds }` from its `branchIds` parameter (line 177), then unconditionally overwrites it with `filter.branchIds = query.branchId` if a `branchId` query filter was also supplied (line 182-184) — on its own, in isolation, that looks like a branch-scope bypass: a branch-restricted caller supplying their own `branchId` query parameter could seemingly clobber their own restriction.

**What actually happens, confirmed by tracing the one real caller:** `user.service.ts`'s `list()` never calls the repository with a raw, unvalidated `branchId`. It first calls `this.repository.resolveBranchScope(actorUserId, normalizedQuery.branchId)` (`user.repository.ts:73-98`), which — when a `branchId` was requested — explicitly checks that the branch exists and, **if the actor is not `SUPER_ADMIN`, that the actor is actually assigned to that branch**, throwing `403 BRANCH_ACCESS_DENIED` otherwise (`user.repository.ts:85-96`). Only the *already-authorized* branch ID is then passed down as `branchScope`, which is what the repository's `list()` actually receives as its `branchIds` parameter. The later overwrite in the repository is therefore operating on an already-validated value — not a bypass. I confirmed `UserRepository.list()` has exactly one caller in the whole codebase (`user.service.ts:122`), and that caller always goes through `resolveBranchScope` first.

**Why this is still worth flagging, even though it's not a live bug:** the repository's `list()` method has **zero authorization awareness of its own** — it will do exactly what it's told, including applying an attacker-supplied `branchId` with no validation, *if* anything ever calls it without going through `resolveBranchScope` first (a future refactor, a new internal caller, a batch job, a different service composing the repository directly). The actual security boundary here is "one specific call site always does things in the right order," not "the data layer enforces an invariant." That's fragile by construction, even though it's correct today.

**Recommended fix:** not urgent, but worth doing before this pattern gets copied elsewhere (note: the same `resolveBranchScope`-then-`list` pattern already exists independently in `roles` — `role.repository.ts:53-73` — with the same characteristic of "correct only because of calling discipline"). Either (a) have the repository's `list()` take the already-resolved `branchIds` array as its *only* branch-filtering input and drop the separate `query.branchId` handling entirely (the service layer already guarantees it's folded into `branchIds` by the time it gets there), removing the redundant/dangerous-looking line rather than just leaving it correct-by-coincidence; or (b) if `query.branchId` needs to stay as an independent repository-level filter for some other reason, have the repository intersect it with the passed-in `branchIds` scope rather than overwrite it.

### 4.5 🟢 LOW — Unprofessional/uncertain inline comments left in production code

**Where:** `user.repository.ts:202-205`

```ts
let sortKey = query.sortBy ?? 'createdAt';
if (sortKey === 'fullName') sortKey = 'fullName'; // we don't have fullName in schema exactly? wait, schema doesn't have fullName! 
// Wait, let's fix that. Schema needs fullName if we query by it.

const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
```

The schema **does** have `fullName` (`user.model.ts`, `fullName: { type: String, required: true }`), so the self-doubt in the comment is unfounded, and the no-op `if` statement it's attached to does nothing (`sortKey` is already `'fullName'` in that branch). Functionally harmless, but it's the kind of comment that costs a future reader real time (did we fix this? is there a bug here we're supposed to come back to?) for no benefit, and it reads as an unreviewed, uncommitted thought left in merged code.

**Recommended fix:** delete the no-op `if` and both comment lines.

### 4.6 Positive findings — strong authorization-escalation prevention

**Where:** `permission.service.ts:66-154`

This deserves explicit praise, not just a pass in a checklist. `assertCanAssignRoles`, `assertCanManageRoles`, and `assertCanManageUser` all implement **authority-superset checks** before allowing one user to grant, modify, or act on another:

- A non-`SUPER_ADMIN` actor can only assign a role whose permission set is fully contained within their *own* current permission set (`permission.service.ts:84-91`) — you cannot hand out permissions you don't have yourself.
- Only a `SUPER_ADMIN` may assign the `SUPER_ADMIN` role to anyone (`:76-82`).
- A non-`SUPER_ADMIN` cannot modify a user whose effective authority is equal to or greater than their own (`:144-153`), and cannot touch a user outside their own authorized branch scope at all (`:136-142`).
- `replaceRolePermissions` additionally requires the actor to already hold *every* permission they're trying to grant to a role (`:393-398`), on top of an optimistic-concurrency check (`expectedRoleUpdatedAt`, `:400-409`) that rejects the write with `409 STALE_ROLE_PERMISSIONS` if the role was modified by someone else in the meantime, rather than silently overwriting a concurrent edit.

This is privilege-escalation prevention done correctly and deliberately, in a codebase where several other modules (reviewed separately) have shown rougher edges. It's worth treating this file as the house standard for how authorization logic should be written elsewhere in the system, not just leaving it as an isolated bright spot.

---

## 5. MongoDB index audit

| Collection | Relevant indexes | Assessment |
|---|---|---|
| `users` | `{deletedAt,status,createdAt}`, `{branchIds,deletedAt}`, `{departmentIds,deletedAt}`, `{roleIds,deletedAt}`, `{employeeCode}` (unique, sparse) | Well-targeted set, covers the real filter combinations used by `list()`/`dependencies()`-style queries across multiple modules. No gaps found. |
| `roles` | `{code}` (unique, **partial**: `deletedAt: null`) | Good practice — a partial unique index that only enforces uniqueness among non-deleted roles, correctly allowing a soft-deleted role's code to be reused. This is the right way to combine soft-delete with unique constraints, and it's notably *better* than `branches`/`departments`, whose `code` unique indexes are **not** partial and would currently block reusing a code after a soft-delete (worth a follow-up to align those two modules with this pattern). |
| `permissions` | `{code}` (unique, **not** partial) | Same non-partial-unique gap as `branches`/`departments` — a soft-deleted permission's code can't be reused. Lower real-world impact (permission codes are system-managed, not user-chosen) but inconsistent with the better pattern `roles` already demonstrates in the same module group. |
| `auth-rate-limit` bucket collection | deterministic `_id` (hash of scope+key+window), `expiresAt` TTL | Well-designed — the atomic `findOneAndUpdate` with a pre-computed deterministic `_id` (`auth-rate-limit.repository.ts:10-22`) is a correct, race-free sliding-window-bucket rate limiter in a single round trip. No notes; this is good work. |
| `password-reset-tokens` | `{expiresAt}` with `expireAfterSeconds: 0` | Correct use of a MongoDB TTL index for automatic cleanup of expired tokens — no manual cleanup job needed. |

---

## 6. Local timing data (NOT representative of production network latency — see §1)

25 repeated calls each, against the in-memory replica set, in-process (`app.inject`), no network layer. Two independent runs produced consistent results; figures below are from the second run.

| Endpoint | min | p50 | p65 | p90 | max | mean |
|---|---|---|---|---|---|---|
| `POST /api/auth/login` (full login, §4.1's 11 round trips) | 3.27ms | 3.84ms | 4.64ms | **57.70ms** | 59.46ms | 12.69ms |
| `GET /api/auth/me` (auth only, no permission check) | 7.53ms | 8.34ms | 8.56ms | 8.80ms | 12.26ms | 8.47ms |
| `GET /api/branches` (auth + permission check + 2 handler queries) | 4.57ms | 4.98ms | 5.12ms | 5.80ms | 17.78ms | 5.96ms |

**The login distribution is genuinely bimodal, not noisy** — this was reproduced in both independent runs with the same shape (most calls land around 3-6ms, then a consistent jump to the high-50s/60ms range starting around the 90th percentile). Given even a single-node in-memory replica set still goes through MongoDB's real write-acknowledgment and journaling path, and login is the one endpoint in this comparison doing multiple writes per call (§4.1: up to 4 separate write operations per login, versus zero writes for `/auth/me` and `/branches` GETs), this is consistent with — though not proven to be caused by — periodic write-concern/journal-flush latency. **This should be treated as a lead for real load testing to confirm, not a conclusion** — see §7 for what's needed to verify it against a real deployment topology.

One honest methodological caveat: the three timing blocks were run sequentially in a fixed order (login, then `/me`, then `/branches`) without randomization or a warm-up phase, so a small amount of ordering bias (JIT warm-up, connection pool state) is possible in the absolute numbers, particularly for whichever ran first. The *shape* of the login distribution (tight cluster + high tail) is unaffected by ordering bias and is the more load-bearing observation here.

---

## 7. What this review did not cover (explicit gaps)

- **`DOCTOR` role was not live-tested.** It's fully defined in `seed.ts`'s `roleDefinitions`, but — unlike the other 6 operational roles — has no corresponding entry in `initialUsers`; doctor accounts are instead created through a separate provisioning flow (`UserService.provisionDoctorAccount`, which requires an active `DOCTOR` role plus a `Doctor` directory record). Exercising that flow was judged out of scope for this pass given the added setup complexity; flagged as a follow-up rather than silently skipped.
- **OTP-based patient/guardian login** (`loginPatientWithOtp`, `loginPatientAfterOtpVerification` in `auth.service.ts`) was not tested here — that's the `patient-portal` module's authentication path, a different audience (patients/guardians, not staff), and belongs with a `patient-portal` module review rather than this staff-facing Authentication & RBAC one.
- **True production latency (p65/p90 against the real Mumbai-hosted MongoDB, over a real network, under real concurrent load)** is still not measured, for the same reason stated in the `branches` review — no production/staging credentials are available in this environment. What *is* new here relative to that earlier gap: this review's harness (ephemeral `mongodb-memory-server` + `app.inject()`) is now a reusable, documented method for functional/behavioral verification of any module, and could be pointed at a real k6-driven HTTP load test instead of `inject()` if run somewhere with real network access to a staging deployment — that's the natural next step for closing the production-latency gap properly, rather than building another one-off script.

---

## 8. Scalability & dynamic-approach recommendations

- **The login round-trip count (§4.1) and the shared auth/permission caching gap (§4.2) are the two highest-leverage scalability fixes in this entire review series** — both sit on every single request through the system, not just login. Fixing the user-document triple-fetch and adding a short-TTL permission cache would improve tail latency and reduce database load proportionally across every module already reviewed and every one still to come, more than any single module-level fix could.
- **Resolving `branchScope` once per CSV export instead of once per page (§4.3) is a pattern worth generalizing**: any paginated export loop that re-derives the same per-request authorization context on every page is paying a cost that should scale with "how many times was this endpoint called," not "how many pages did this one call happen to produce." Worth a quick audit for the same shape elsewhere (the `branches`/`departments` export loops don't have this specific issue since they don't re-resolve scope per page, but it's worth confirming as more export endpoints are added).
- **Standardize on the partial-unique-index pattern `roles` already does correctly** (§5) across every soft-deletable collection with a human-chosen unique code — this directly affects how gracefully the system handles long-term churn (codes being retired and reused) as data accumulates over years of operation, which is exactly the kind of "dynamic" long-horizon concern worth deciding once rather than per-module.
- **Treat this review's test harness (ephemeral `mongodb-memory-server` + `app.inject()`) as reusable infrastructure**, not a one-off script — it's already proven valuable for functional verification without touching real data, and extending it to drive real HTTP load (k6) against a staging deployment is the natural, low-risk path to real p65/p90 numbers without the caution required around `patients`/`appointments`/`billing`'s real data.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Collapse `clearFailedLogin`'s two sequential writes into one, and have it return the updated document to eliminate the follow-up `findUserById` refetch (§4.1).
- [ ] Pass the already-resolved user record into `getUserAccessContext` instead of having it re-fetch `UserModel` independently (§4.1) — removes the 3rd redundant user fetch per login.
- [ ] Apply the shared auth/permission caching fix from the `branches` review here too, once decided — this *is* the code that fix targets (§4.2).
- [ ] Resolve `branchScope` once before the CSV export loop in `user.service.ts`, not once per page (§4.3).
- [ ] Decide whether to remove the redundant `query.branchId` overwrite in `user.repository.ts`'s `list()` now that it's confirmed safe-but-fragile, or document the calling-discipline requirement explicitly so a future caller doesn't reintroduce a real bypass (§4.4) — same pattern exists in `role.repository.ts` and should be fixed/documented consistently in both places.
- [ ] Remove the stale, no-op comment block in `user.repository.ts:202-205` (§4.5).
- [ ] Apply the same **partial** unique index pattern `roles` uses (`{code}` unique, `partialFilterExpression: { deletedAt: null }`) to `branches`, `departments`, and `permissions`, so a soft-deleted record's code can be reused — currently only `roles` does this correctly (§5).
- [ ] Confirm whether `mongodb-memory-server` being declared-but-not-installed was environment-specific to this sandbox or affects other developers' checkouts too; if the latter, the project's own `npm test` is currently broken out of the box for anyone relying on a fresh `npm install` without this being caught — worth a quick check of CI to confirm CI itself isn't silently skipping these tests for the same reason.
- [ ] Run a real k6/HTTP-based load test (not `inject()`) against a staging deployment colocated with the production Mongo region, using this review's harness as the functional-correctness baseline, to get trustworthy p65/p90 numbers and confirm or refute the bimodal login-latency lead from §6.
- [ ] Live-test the `DOCTOR` role provisioning + login flow and the patient-portal OTP login flow as follow-up passes (§7).

---

## 10. Verdict

**The strongest module group reviewed so far.** No critical findings, and the one real high-severity issue (§4.1's 11-round-trip login) is a performance problem with a clear, low-risk fix, not a correctness or security defect. The authorization-escalation prevention logic (§4.6) and the live-verified refresh-token rotation (§3.5) reflect genuinely careful security engineering that should be the reference point for the rest of this review series, not the exception. The main lesson from this pass worth carrying forward: tracing a suspicious-looking line all the way to its actual caller (§4.4) turned what looked like a critical vulnerability into a correctly-functioning-but-fragile pattern — worth remembering before flagging something as critical in the modules still to come.
