# Module Review: `notifications`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/notifications/*` (1,103 lines, including a dedicated 406-line `notification.authorization.test.ts`). Static code review.
**Live load testing: not executed** — see §7; this module's finding is severe enough that functional/timing verification is strongly recommended as an immediate follow-up, not deferred indefinitely.

---

## 1. Executive summary

Authorization in this module is correctly, carefully scoped — and it shows: the dedicated 406-line authorization test file and the historical `H-002` gap-note/verification pair found in this repository's root indicate this module already had a real access-control bug found and fixed. Reading the current code confirms the fix: a user can only see or mark-as-read a notification addressed directly to them or to one of their active roles within their own branch scope, correctly enforced atomically. The new finding in this pass is a severe performance bug, not a security one: every time a patient opens their notifications list, the server runs up to four separate reconciliation sweeps, each checking and conditionally creating a notification **one item at a time** — up to roughly 160 sequential database round trips on a single, routinely-hit patient-facing endpoint.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 0 | — |
| 🟠 HIGH | 1 | `syncPatientNotifications` runs up to ~160 sequential, non-batched DB round trips (4 collections × up to 20 items × exists-then-maybe-create) on every call to the patient notification list |
| 🟢 Low | 1 | No unique index prevents a duplicate notification from being created if `syncPatientNotifications` runs twice concurrently for the same user |

---

## 2. What's correct (keep doing this)

- **Notification visibility is correctly, atomically scoped.** `recipientFilter` (`notification.repository.ts:32-64`) builds a filter requiring either a direct `recipientUserId` match or a role+branch match restricted to the caller's own active roles and branches — and `markAsReadForUser` folds this directly into the `findOneAndUpdate` filter (`:343-349`), so a user cannot mark another user's or another branch's notification as read even by guessing an ID. This reads as the correctly-hardened version of whatever `H-002`'s historical gap-note described — the fix is real and the logic is sound.
- **`createGlobalNotification` validates branch scope, active-branch existence, active-role existence, and recipient-user branch membership before creating a staff-broadcast notification** (`notification.service.ts:13-55`) — thorough, defensive validation for an endpoint that lets one user cause a notification to appear in potentially many other users' inboxes.
- **ObjectId-shape validation happens before any query**, consistently, for every identifier accepted from a caller (`validateIdentifiers`/`validateListIdentifiers`) — avoiding the wasted-round-trip-then-CastError pattern flagged as a minor issue in several earlier reviews.

---

## 3. Findings

### 3.1 🟠 HIGH — Patient notification sync does up to ~160 sequential round trips per call, on every notification-list request

**Where:** `notification.repository.ts:132-256` (`syncPatientNotifications`), called unconditionally from `notification.service.ts:76` (`listForUser`) on **every single call**

```ts
async listForUser(userId: string, query: ...) {
  await this.repository.syncPatientNotifications(userId);   // <- runs this every time, no cache, no cheap short-circuit
  return this.repository.listForUser(userId, query);
}
```

`syncPatientNotifications` runs four independent reconciliation passes — verified lab results, verified imaging reports, pending invoices, unsigned consent documents — each fetching up to 20 candidate records, and for **every single candidate record**, doing this sequentially:

```ts
for (const lab of labResults) {                               // up to 20 iterations, × 4 collections = up to 80
  const exists = await NotificationModel.exists({...});       // round trip #1
  if (!exists) {
    await NotificationModel.create([{...}]);                  // round trip #2
  }
}
```

In the worst case (a guardian account with several dependents, each with recent lab results, imaging reports, pending invoices, and unsigned consents — not an exotic scenario for a family actively using the portal), this is **up to 4 × 20 × 2 = 160 sequential database round trips**, run synchronously, before the actual notification list is even fetched. This is the same "reconciliation coupled to a request path" architectural pattern already flagged in `opd`, `appointments`/`patient-portal`, and `admissions-configuration` — but this instance is categorically worse than all three: those run one bulk `updateMany` (or a small, naturally-bounded per-patient loop); this one runs individual one-at-a-time round trips, multiplied across four collections, with no batching at all.

**Why this matters more here than the other three instances:** this isn't an occasional internal reconciliation — it's the patient portal's **notifications tab**, one of the most routinely re-opened screens in any patient-facing app. At the real, measured round-trip cost against this system's production MongoDB (~25-30ms, per this review series' infrastructure finding), 160 sequential round trips is **4-5 seconds of added latency** on a screen a patient might check reflexively multiple times a day. This is likely the single worst per-endpoint latency problem found anywhere in this entire review series.

**Recommended fix:**
1. **Batch the existence checks**: instead of one `exists()` per candidate, do a single query — `NotificationModel.find({ recipientUserId, type: 'LAB_RESULT', relatedEntityId: { $in: labResultIds } }).select('relatedEntityId')` — and diff the result against the candidate list in memory to find which ones are missing, for each of the four collections. This turns 2×N round trips into 1 read + 1 batched `insertMany` per collection — 8 round trips total instead of up to 160.
2. **Move the sync off the read path entirely**, as the structural fix shared with the other three instances of this pattern — ideally a background job (triggered on lab/imaging verification, invoice creation, or consent attachment, rather than reconciled lazily on every list view) would eliminate this cost from the read path altogether rather than just making it cheaper.
3. Short-term, lowest-risk mitigation if a full redesign isn't immediate: cache "last synced at" per user with a short TTL (e.g., skip the sync entirely if it ran in the last 60 seconds for this user) to bound how often the expensive path is actually hit, while the real batching fix is implemented.

### 3.2 🟢 LOW — No unique index prevents duplicate notifications under concurrent sync

**Where:** Same method as §3.1

Since the exists-check and the create are two separate, non-atomic operations, two concurrent calls to `syncPatientNotifications` for the same user (e.g., two browser tabs both loading the notifications list at nearly the same time) could both see `exists()` return false for the same lab result and both create a duplicate notification. Low severity — a cosmetic duplicate, not a data-integrity or security issue — but worth closing alongside the §3.1 fix.

**Recommended fix:** add a unique index on `{recipientUserId, relatedEntityId, type}` (sparse, since most notifications don't have a `relatedEntityId`), and let a duplicate-key error on the `create()` be treated as "already exists, fine" rather than relying purely on the preceding `exists()` check.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Notification visibility scoped to recipient | ✅ | `recipientFilter` | None |
| Mark-as-read scoped to recipient | ✅ DB-enforced | `markAsReadForUser` | None |
| Global notification recipient branch/role/user validity | ✅ | `createGlobalNotification` | None |
| ObjectId shape on all accepted identifiers | ✅ | `validateIdentifiers`/`validateListIdentifiers` | None |
| Duplicate notification under concurrent sync | ❌ | `syncPatientNotifications` | §3.2 |

---

## 5. MongoDB index audit

**`notifications`** — `{recipientRole,isRead}`, `{recipientRole,recipientBranchId,isRead}`, `{recipientUserId,isRead,createdAt}`, `{recipientUserId,patientId,isRead,createdAt}`, `{createdAt}`. Well-matched to `recipientFilter`'s query shape. Missing: the unique index recommended in §3.2.

The four source collections queried by `syncPatientNotifications` (`laboratory_results`, `imaging_reports`, `billing_invoices`, `patient_documents`) are all adequately indexed for their `patientId`-scoped lookups per their own module reviews — the performance problem in §3.1 is entirely about round-trip multiplication, not missing indexes on the source queries themselves.

---

## 6. API performance & round-trip analysis

| Operation | Sequential round trips | Notes |
|---|---|---|
| `GET /patient-portal/notifications` (or equivalent `listForUser` caller) | **Up to ~160** (§3.1) + the actual list query | By far the worst per-call round-trip count found in this entire review series |
| `POST /notifications` (`createGlobalNotification`) | ~5-6 | Reasonable given the validation it performs |
| `PATCH /notifications/:id/read` | 1 | Optimal |

---

## 7. Load testing (p65/p90) — status

**Not executed as a formal load test, but this finding does not need one to be taken seriously** — the round-trip count is derived directly from reading the loop structure, and this review series' own infrastructure finding already measured the real per-round-trip cost against production MongoDB (~25-30ms). Multiplying those two together (160 × ~25-30ms ≈ 4-5 seconds) is a confident estimate, not a guess requiring live confirmation first. That said, a quick timing run against the local ephemeral-MongoDB harness (seed a user with several dependents each having pending lab results/invoices/consents, call `listForUser`, time it) would be a cheap, fast way to get an exact number and confirm the fix's improvement afterward.

---

## 8. Scalability & dynamic-approach recommendations

- **This is the single highest-leverage performance fix identified in this entire review series for a patient-facing screen.** Unlike most other findings (which add tens of milliseconds), this one is plausibly adding multiple *seconds* to a screen patients check routinely — fixing it (via the batching approach in §3.1) is a bounded, well-understood piece of work with a very large payoff relative to effort.
- **This is also the most severe instance yet of the "reconciliation coupled to a request path" pattern already flagged in three other modules** — worth escalating the priority of that shared architectural fix (moving all four instances to background jobs) given how much worse this one is in practice than the other three.
- **The batched-existence-check technique recommended in §3.1 (fetch candidates, fetch existing-notification IDs in one query, diff in memory, batch-insert the rest) is a generally useful pattern for "sync N external facts into local notification records" problems** — worth keeping in mind if this system ever adds a fifth or sixth notification-triggering source, so it's built correctly from the start rather than extending the current per-item loop.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] **Rewrite `syncPatientNotifications` to use batched existence checks and bulk inserts instead of a per-item exists-then-create loop** (§3.1). **Highest-priority performance fix in this review series.**
- [ ] Move patient-notification sync off the request path entirely, as shared work with the other three "reconciliation on read path" findings (§3.1, §8).
- [ ] Add a unique index on `{recipientUserId, relatedEntityId, type}` to prevent duplicate notifications under concurrent sync (§3.2).
- [ ] Run a quick before/after timing measurement using the local ephemeral-MongoDB harness to confirm the fix's actual improvement (§7).

---

## 10. Verdict

**Not production-ready as currently implemented, but for a performance reason rather than a correctness or security one** — the authorization model in this module is genuinely solid (and demonstrably already hardened once before). The notification-sync performance issue is severe enough, on a frequently-hit patient-facing screen, that it should be treated with the same urgency as a correctness bug even though it technically "works" — a multi-second delay on checking notifications is a real product problem, not just a nice-to-have optimization.
