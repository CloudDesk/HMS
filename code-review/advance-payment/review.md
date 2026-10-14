# Module Review: `advance-payment`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/advance-payment/*` — a small module (349 lines total) tracking required/paid deposit amounts for admission requests and procedure bookings, called into directly by `inpatient-admissions` (confirmed in that review) and by `billing`'s `collectPayment` flow. Static code review.
**Live load testing: not executed** — real financial data; see §7.

---

## 1. Executive summary

This module contains two methods that compute the exact same thing — an advance payment's `balance_amount` and `payment_status` after a change — and they're implemented two completely different ways, one correct and one not. `addPayment` does it with a single atomic aggregation-pipeline update, computed entirely inside MongoDB in one round trip — the correct pattern, consistent with the best examples elsewhere in this series. `syncRequirement`, right above it in the same file, does the equivalent computation by reading a document, computing the new values in application code from that snapshot, and writing them back in a **second**, separate update — a real, confirmed read-modify-write race condition on financial data, directly reachable via its own API endpoint.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 0 | — |
| 🟠 High | 1 | `syncRequirement` computes `balance_amount`/`payment_status` from a stale in-application snapshot across two non-atomic writes, unlike `addPayment`'s correct single-pipeline approach in the same file |
| 🟡 Medium | 0 | — |
| 🟢 Low | 2 | A bare `Error` (not `AppError`) thrown for invalid payment amounts, surfacing as a 500 instead of a 400; ID fields (`patient_id`/`source_id`/`branch_id`) are stored as plain strings rather than the `Schema.Types.ObjectId` convention used everywhere else in the codebase |

---

## 2. What's correct (keep doing this)

- **`addPayment` is a genuinely correct, single-round-trip atomic update** (`advance-payment.repository.ts:91-143`): it uses an aggregation-pipeline `findOneAndUpdate` (an array as the update argument, with `updatePipeline: true`) to compute `paid_amount`, `balance_amount`, and `payment_status` together, entirely server-side, from the document's own current field values at write time — not from a value read into application code beforehand. It also correctly preserves a `CANCELLED` status (won't resurrect a cancelled tracker into `PAID`/`PARTIALLY_PAID` just because a payment arrives) via a `$cond` check inside the same pipeline. This is the right pattern, and it's sitting in the same file as the wrong one (§3.1) — worth noting as a case where the fix is already written, just not applied consistently within the module.
- **`addPayment` rejects non-positive amounts before attempting any write** (`:98-100`), consistent with the validation discipline already praised in the `billing` module's `collectPayment`.
- **One tracker per source is DB-enforced**: `{source_type,source_id}` has a unique index (`advance-payment.model.ts:22`), so `syncRequirement`'s upsert can't accidentally create two competing trackers for the same admission request or procedure booking.

---

## 3. Findings

### 3.1 🟠 HIGH — `syncRequirement` computes the new balance/status from a stale snapshot across two non-atomic writes

**Where:** `advance-payment.repository.ts:30-89`

```ts
async syncRequirement(data, userId, session?) {
  const doc = await AdvancePaymentModel.findOneAndUpdate(
    { source_type: data.source_type, source_id: data.source_id },
    { $set: { patient_id: ..., required_amount: data.required_amount, requirement_status: ..., ... }, $setOnInsert: {...} },
    { returnDocument: 'after', upsert: true, session },
  ).lean();

  // Recalculate balance and payment status IN APPLICATION CODE, from the doc just returned above
  const paid = doc.paid_amount;
  const required = doc.required_amount;
  const balance = Math.max(0, required - paid);
  let payment_status = /* computed from paid/required */;

  // SECOND, separate write — using values computed from the FIRST write's snapshot
  const updatedDoc = await AdvancePaymentModel.findOneAndUpdate(
    { _id: doc._id },
    { $set: { balance_amount: balance, payment_status } },
    { returnDocument: 'after', session },
  ).lean();

  return toRecord(updatedDoc!);
}
```

Between the first `findOneAndUpdate` (which returns `doc.paid_amount` as of that moment) and the second `findOneAndUpdate` (which writes a `balance_amount`/`payment_status` computed from that now-potentially-stale `paid_amount`), **any concurrent call to `addPayment` for the same source** can commit its own atomic update to `paid_amount` in between. When that happens, `syncRequirement`'s second write overwrites `balance_amount` and `payment_status` with values computed from the *old* `paid_amount` — silently reverting the tracker's derived fields to reflect a lower paid amount than what's actually recorded, while `paid_amount` itself remains correct. The result is a genuinely inconsistent document: `paid_amount` says one thing, `balance_amount`/`payment_status` say another.

**Why this is realistic, not theoretical:** `syncRequirement` is reachable two ways — directly via `POST /api/advance-payments/sync` (`advance-payment.routes.ts:32-45`, gated only by `Billing/Invoices/Edit`, called with **no session at all**, so not even transaction-scoped), and from `inpatient-admissions`' request lifecycle (likely whenever a request's required deposit amount is (re)validated). `addPayment` is reachable from `billing.service.ts`'s `collectPayment`, confirmed in the `billing` review as part of a transactional payment-collection flow. A receptionist collecting a deposit payment for an admission request at the same moment that request's required amount is being (re)synced — a realistic sequence during active admission processing, not a contrived edge case — can trigger exactly this race.

**Why High, not Medium:** this is financial tracking data (how much of a required deposit has actually been paid), the race is directly reachable via a real API endpoint with no session/transaction protection at all on one of its two call paths, and the fix is already demonstrated correctly in the very next method in the same file.

**Recommended fix:** replace the two-step read-modify-write with the same single aggregation-pipeline pattern `addPayment` already uses — compute `balance_amount` and `payment_status` from `$required_amount`/`$paid_amount` inside the pipeline itself, in the same `findOneAndUpdate` call that sets `required_amount`/`requirement_status`/`patient_id`/`branch_id`, rather than as a dependent second write. This collapses it to one atomic round trip and removes the race entirely — no new infrastructure needed, just reusing the technique already present in this file.

### 3.2 🟢 LOW — Invalid payment amount throws a bare `Error`, surfacing as a 500

**Where:** `advance-payment.repository.ts:98-100`

```ts
if (amount <= 0) {
  throw new Error('Payment amount must be greater than zero');
}
```

Same pattern already flagged in the `branches` and `departments` reviews: a bare `Error` (not `AppError`) thrown from the repository layer falls through to `toAppError`'s generic fallback and surfaces as a `500 INTERNAL_ERROR` with the raw message forwarded to the client, rather than a proper `400` validation error. Given `addPayment` is called from `billing.collectPayment`'s transactional flow, a caller somehow submitting a non-positive amount here (defense-in-depth, since `billing.service.ts` already validates `amount > 0` before calling this) would see a confusing 500 instead of 400.

**Recommended fix:** use `AppError('Payment amount must be greater than zero', 400, 'INVALID_PAYMENT_AMOUNT')`, consistent with the rest of the codebase's error-handling convention.

### 3.3 🟢 LOW — ID fields stored as plain strings rather than `ObjectId` references

**Where:** `advance-payment.model.ts:6-9`

```ts
patient_id: { type: String, required: true },
source_id: { type: String, required: true },
branch_id: { type: String, required: true },
```

Every other module reviewed in this series stores these kinds of relationships as `Schema.Types.ObjectId` with a `ref`, which gets Mongoose's built-in cast validation (an invalid ID shape throws a `CastError`, correctly mapped to `400 INVALID_ID` by the shared error handler per earlier reviews) essentially for free. Here, any string passes — there's no format validation at the Mongoose layer, and the Fastify schema only checks `type: 'string'` too. This isn't causing an active bug (the values are presumably always real ObjectId strings generated internally), but it's a consistency deviation worth normalizing, and it means a malformed ID here wouldn't get caught until/unless it fails to match anything at query time, rather than being rejected up front.

**Recommended fix:** low priority; align with the rest of the codebase's convention (`Schema.Types.ObjectId` with `ref: 'Patient'`/etc.) if this module is touched for other reasons.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Payment amount must be positive | ✅ (wrong error type) | `addPayment` | §3.2 |
| One tracker per source | ✅ DB-enforced | Unique index | None |
| `CANCELLED` status preserved against incoming payments | ✅ | `addPayment`'s pipeline `$cond` | None |
| `CANCELLED` status preserved against `syncRequirement` | ✅ | `syncRequirement`'s JS-side `if (payment_status !== 'CANCELLED')` guard | None (this part of the logic is correct — only the *mechanism* used to apply it is racy, per §3.1) |
| Consistency between `paid_amount` and `balance_amount`/`payment_status` under concurrency | ❌ | `syncRequirement` | §3.1 |

---

## 5. MongoDB index audit

**`advance_payments`** — unique `{source_type,source_id}` (correctly models "one tracker per source"), `{patient_id,created_at}`, `{branch_id,payment_status}`. No gaps relative to the query code reviewed — this small module's index design is clean.

---

## 6. API performance & round-trip analysis

| Operation | Sequential round trips | Notes |
|---|---|---|
| `GET /api/advance-payments` | 1 | Simple, no issues |
| `POST /api/advance-payments/sync` | 2 (and racy — §3.1) | Should be 1 once fixed |
| `addPayment` (internal, via `billing.collectPayment`) | 1 | Already optimal |

Fixing §3.1 is simultaneously a correctness fix and a performance one — it removes both the race and an unnecessary extra round trip.

---

## 7. Load testing (p65/p90) — status

**Not executed.** This module tracks real financial deposit data. Given §3.1's race is precise and well-understood (a specific read-then-write gap between two named operations), **this is an excellent candidate for a targeted, synthetic concurrency test** using the local ephemeral-MongoDB harness: fire a `syncRequirement` and an `addPayment` for the same source concurrently, before and after the fix, to directly demonstrate the bug and confirm the fix closes it — a small, high-confidence test that doesn't require touching real data at all.

---

## 8. Scalability & dynamic-approach recommendations

- **Fix §3.1 using the exact pipeline technique already sitting in `addPayment`** — this is as close to a free fix as this review series finds: no new pattern to design, no new infrastructure, just applying the method one function away to the one that needs it.
- **This module is small enough to be a good first target for a "golden pattern" pass**: now that `pharmacy-dispensing`, `emergency`, and `inpatient-admissions`/`admissions-configuration` have each demonstrated correct atomic-update patterns, a short written guideline ("compute derived financial/state fields inside the same pipeline update that changes their inputs, never across two separate writes") would prevent exactly this class of bug from recurring — `advance-payment` is a clean, small, self-contained example to use when writing that guideline.
- **Normalize the ID-field typing (§3.3) opportunistically** rather than as a dedicated task — low value on its own, but worth doing if this module is touched for the §3.1 fix anyway, since the fix will already require editing the same file.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Rewrite `syncRequirement` to compute `balance_amount`/`payment_status` inside a single aggregation-pipeline update, matching `addPayment`'s pattern, eliminating the two-step race (§3.1). **Highest priority in this module.**
- [ ] Replace the bare `Error` in `addPayment`'s amount validation with a proper `AppError` (§3.2).
- [ ] Consider normalizing `patient_id`/`source_id`/`branch_id` to `Schema.Types.ObjectId` with refs, opportunistically alongside the §3.1 fix (§3.3).
- [ ] Add a synthetic concurrent-load test demonstrating the §3.1 race and its fix, using the local ephemeral-MongoDB harness (§7).

---

## 10. Verdict

**Not production-ready as-is, but narrowly so** — this is a small module with exactly one real bug, and that bug has its own correct solution already written four lines away in the same file. This is a quick, high-confidence fix, not a design problem: apply `addPayment`'s pipeline-update technique to `syncRequirement` and this module moves to fully production-ready.
