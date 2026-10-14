# Module Review: `pharmacy-inventory` & `pharmacy-dispensing`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/pharmacy-inventory/*` (1,592 lines) and `apps/api/src/modules/pharmacy-dispensing/*` (881 lines). Reviewed together — `pharmacy-dispensing` calls directly into `pharmacy-inventory`'s repository for every stock mutation, and the two modules together implement one real-world workflow (dispense a prescription → deduct stock → bill the patient).
**Live load testing: not executed** — real inventory/transaction data; see §7.

---

## 1. Executive summary

This is the most carefully engineered pair of modules in this entire review series. The stock-deduction path has three independent layers of protection against overselling (an application-level sufficiency check, an atomic conditional update, and optimistic-concurrency version checking on the dispensing record itself), idempotency keys correctly guard **both** confirm and reversal against duplicate processing on retry, and the reversal flow correctly refuses to unwind a dispensing once its invoice has been paid. No correctness bugs were found. The one real finding is a performance one: a full aggregation query runs once per prescription item inside an already-long transaction, which is unnecessary work that also extends how long locks are held on hot inventory documents.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 0 | — |
| 🟠 High | 0 | — |
| 🟡 Medium | 1 | Inventory snapshot is fully re-aggregated once per line item inside the dispensing-confirmation transaction, rather than once per affected medicine |
| 🟢 Low | 1 | No index exists to support the FEFO (first-expiring-first-out) batch selection query shape as efficiently as it could be |

---

## 2. What's correct (keep doing this)

- **Three independent layers of protection against overselling stock**, all present in `confirm()` (`pharmacy-dispensing.service.ts:154-210`):
  1. An application-level sufficiency check (`batch.quantityOnHand < item.confirmedQuantity` → `409 INSUFFICIENT_STOCK`) that gives a clear, specific error before attempting the write.
  2. A **real atomic conditional update** backing that check — `updateBatchQuantity` (`pharmacy-inventory.repository.ts:468-478`) folds `quantityOnHand: { $gte: Math.abs(delta) }` directly into the `findOneAndUpdate` filter for any deduction, using an aggregation-pipeline `$set` to compute the new quantity and status in one atomic step. If a concurrent request already consumed the stock between the check and this update, the filter simply won't match, and the code correctly treats that as `409 INSUFFICIENT_STOCK` again (`:181`) rather than silently proceeding.
  3. **Optimistic concurrency on the dispensing record's own `version` field**, checked both before the stock loop starts (`:163`) and again when persisting the confirmation (`:191-192`), so a dispensing record that changed underneath a concurrent confirmation attempt is caught even if every individual stock update happened to succeed.

  This is genuinely best-in-class defense-in-depth for the single highest-stakes concurrency problem a pharmacy system has — two staff members trying to dispense the last unit of a medicine at the same moment cannot both succeed, and the system gives a clear, specific error rather than either double-deducting or silently corrupting the count.
- **Idempotency is correctly enforced for both confirm and reversal, not just one.** Both `confirmIdempotencyKey` and `reverseIdempotencyKey` have their own partial unique index (`pharmacy-dispensing.model.ts:91-106`), and the service layer specifically catches the resulting duplicate-key error and converts it to a clear `409 DISPENSING_CONFIRMATION_IDEMPOTENCY_CONFLICT` / reversal-equivalent rather than a generic 500 — meaning a client retry after a timeout (a very real scenario for a request this complex) can't accidentally double-dispense or double-reverse.
- **Reversal correctly refuses to unwind a dispensing once money has been collected** (`pharmacy-dispensing.service.ts:233`: `invoice.paid_amount > 0` → `409 PAID_DISPENSING_REVERSAL_REQUIRES_REFUND`), consistent with the same business rule already found correctly enforced in the `billing` module's own `cancel()` — these two modules agree with each other on this invariant, which is exactly what you want from two modules that share a financial boundary.
- **The stock movement ledger captures full before/after state for both the batch and the aggregate inventory snapshot on every single mutation** (`pharmacy-inventory.model.ts:38-53`: `batchQuantityBefore/After`, `availableQuantityBefore/After`) — this means inventory discrepancies can be fully reconstructed and audited after the fact, not just "what happened" but "what the numbers were immediately before and after," which is exactly the kind of audit trail a regulated inventory (pharmaceuticals) needs.
- **Good domain-modeling judgment: no soft-delete on inventory/batch records.** Unlike `patients`, `opd_visits`, `appointments`, and `billing_invoices` (all flagged in this series for missing-`deletedAt`-index issues), `pharmacy_medicine_inventory` and `pharmacy_medicine_batches` don't use soft-delete at all — a depleted or expired batch transitions its `status` field instead of being marked deleted, which is the more correct model for inventory (a depleted batch is still a real historical fact, not deleted data) and sidesteps that entire class of finding for this module by design, not by accident.

---

## 3. Findings

### 3.1 🟡 MEDIUM — Inventory snapshot is re-aggregated once per line item, inside the transaction, rather than once per affected medicine

**Where:** `pharmacy-dispensing.service.ts:182` (inside the per-item loop in `confirm()`), calling `pharmacy-inventory.repository.ts:590-...` (`refreshInventorySnapshot`)

```ts
for (const item of dispensing.items) {
  ...
  const changed = await inventory.updateBatchQuantity(item.batchId.toString(), ..., session);
  ...
  const refreshed = await inventory.refreshInventorySnapshot(item.medicineId.toString(), visit.branchId.toString(), actor, session);  // <- full aggregate, every item
  ...
  await inventory.createMovement({...}, actor, session);
}
```

`refreshInventorySnapshot` runs a real aggregation query — `$match` on medicine+branch, then `$group` summing quantities across every batch for that medicine to recompute the denormalized `availableQuantity`/`activeBatchCount`/`expiredBatchCount`/`nextExpiryDate` snapshot fields. This runs once **per dispensing line item**, unconditionally, inside the transaction. Two things make this more costly than it needs to be:

1. If a single prescription has multiple line items for the **same medicine** (a plausible scenario — e.g., two different strengths/batches of the same drug prescribed together, or simply the item-resolution step having split one prescribed quantity across two batches), the same medicine's snapshot gets recomputed from scratch multiple times in the same transaction, each recomputation immediately obsoleted by the next.
2. Even for the common case (one item per medicine), this is one extra full collection-scoped aggregation query per item, sequentially, inside an already multi-step transaction (per item: `getAvailableBatch`, `updateBatchQuantity`, `refreshInventorySnapshot`, `createMovement` — roughly 4 round trips per item before even reaching the shared invoice-creation step).

**Why it matters:** MongoDB transactions hold resources and increase the chance of write conflicts with other concurrent transactions touching the same documents for as long as they stay open — a prescription with several medicines turns into a transaction with 4×N+constant sequential round trips, each one adding both latency (at the real ~25-30ms/round-trip measured against this system's actual Mumbai Mongo cluster) and additional time during which a concurrent dispensing or stock adjustment for the *same* medicine could collide with this transaction's locks.

**Recommended fix:** deduplicate by `medicineId` before the loop (or collect which medicines were actually touched during the loop) and call `refreshInventorySnapshot` once per **unique** medicine affected, after all batch updates for that medicine are done, rather than unconditionally inside the per-item loop. This preserves correctness (the snapshot still reflects the final post-transaction state) while cutting redundant aggregation work and shortening how long the transaction stays open.

### 3.2 🟢 LOW — No index specifically supports FEFO (first-expiring-first-out) batch selection as efficiently as it could

**Where:** `pharmacy-inventory.repository.ts:165-171` (`findAvailableBatch`, used during prescription item resolution — not shown in the confirm excerpt above, which uses an already-chosen `batchId`)

```ts
PharmacyMedicineBatchModel.findOne({
  medicineId, branchId, status: 'ACTIVE', quantityOnHand: { $gt: 0 }, expiryDate: { $gte: startOfUtcDay() },
}).sort({ expiryDate: 1 })  // <- oldest-expiry-first selection
```

The existing index `{ branchId: 1, medicineId: 1, status: 1, expiryDate: 1 }` (`pharmacy-inventory.model.ts:93`) is close to ideal for this query shape — it covers the equality filters (`branchId`, `medicineId`, `status`) and then sorts by `expiryDate`, which MongoDB can serve directly off this index without an in-memory sort. The one gap: `quantityOnHand: { $gt: 0 }` is a range filter that isn't part of this index, so MongoDB will need to examine (and discard) any zero-quantity active batches that happen to sort earlier by expiry date before finding the first usable one. For a medicine with many historical depleted-but-still-`ACTIVE`-status batches (if that's a reachable state — worth confirming against the `status` enum's actual lifecycle, since `DEPLETED` is a separate status value that this filter already excludes via `status: 'ACTIVE'`), this could cost a few extra index entries examined per lookup — a minor, not urgent, inefficiency.

**Recommended fix:** low priority; if `ACTIVE` status is kept in sync with `quantityOnHand > 0` consistently (i.e., a batch transitions out of `ACTIVE` the moment it's depleted, which `updateBatchQuantity`'s status-computation logic at `pharmacy-inventory.repository.ts:482-488` suggests is actually the case — it sets status to `DEPLETED` the moment quantity hits zero), then this finding is likely moot in practice and `quantityOnHand: {$gt: 0}` is close to redundant with `status: 'ACTIVE'` already. Flagged for completeness rather than as something requiring action — worth a quick confirmation rather than a code change.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Sufficient stock before deduction | ✅ triple-guarded | §2's three-layer check | None |
| Concurrent confirm on the same dispensing | ✅ | Version check, twice | None |
| Duplicate confirm/reverse request (client retry) | ✅ | Idempotency keys, both directions | None |
| Reversal of a paid dispensing | ✅ blocked | `invoice.paid_amount > 0` check | None |
| All prescribed items resolved before confirmation | ✅ | Item-count and per-item resolution checks (`:164-174`) | None |
| Procedure-booking context still active at confirm time | ✅ | `hasActiveProcedureContext` check | None |
| Batch belongs to the correct medicine | ✅ | `batch.medicineId.toString() !== item.medicineId.toString()` check | None |
| Expired batch used for dispensing | ✅ blocked by default | `updateBatchQuantity`'s `status: {$ne:'EXPIRED'}` filter (reversal explicitly opts back in via `allowExpired=true`, correctly — restoring stock to an expired batch on reversal is the right behavior, since the stock really did come from that batch) | None |

---

## 5. MongoDB index audit

**`pharmacy_medicine_inventory`** — unique `{medicineId,branchId}` (correctly models "one snapshot row per medicine per branch"), `{branchId,stockState,updatedAt}` (good for a low-stock/out-of-stock dashboard view), `{branchId,nextExpiryDate}` (good for an expiring-soon view). No gaps relative to the query code reviewed.

**`pharmacy_medicine_batches`** — unique `{medicineId,branchId,batchNumber}`, `{branchId,expiryDate,quantityOnHand}`, `{branchId,medicineId,status,expiryDate}` (the FEFO-supporting index, §3.2), sparse `{branchId,barcode}`. Well-targeted overall.

**`pharmacy_medicine_stock_movements`** — `{branchId,medicineId,createdAt}`, `{branchId,batchId,createdAt}`, and a correctly-designed partial unique index on `{branchId,idempotencyKey}` backing the idempotency guarantee at the movement-ledger level too (in addition to the dispensing-record-level idempotency keys already praised in §2).

**`pharmacy_dispensings`** (the dispensing collection itself) — `{branchId,status,createdAt}`, `{patientId,createdAt}`, `{sourceType,encounterId}`, `{admissionId,createdAt}`, `{procedureId,createdAt}`, plus the two idempotency-key partial uniques. No `deletedAt` field exists on this model at all — consistent with the status-based lifecycle (`DRAFT/CONFIRMED/CANCELLED/REVERSED`) rather than soft-delete, so the missing-`deletedAt`-index pattern flagged repeatedly elsewhere in this series genuinely doesn't apply here.

---

## 6. API performance & round-trip analysis

| Operation | Sequential round trips (excluding shared auth chain) | Notes |
|---|---|---|
| `POST /dispensing/:prescriptionId/confirm` | ~5 (shared setup/validation) + ~4 per line item (§3.1) + ~3 (invoice create/update, dispensing confirm, prescription status update, audit) | The per-item multiplier is the one avoidable cost; everything else reflects genuine multi-document consistency needs for a financial+inventory operation |
| `POST /dispensing/:prescriptionId/reverse` | Same shape as confirm, symmetric | Same §3.1-style optimization would apply equally here (the reversal loop has the identical `refreshInventorySnapshot`-per-item pattern at `:242`) |

---

## 7. Load testing (p65/p90) — status

**Not executed.** This module pair's core risk (concurrent dispensing of the same scarce stock) is exactly the kind of thing that would be most convincing to demonstrate under real concurrent load — fire multiple simultaneous `confirm()` calls against overlapping batches and confirm the three-layer protection in §2 actually holds in practice, not just on paper. This is a strong candidate for the local ephemeral-MongoDB harness (built for the `auth-rbac` review) as a follow-up, specifically because the expected outcome here is "correctly rejects the loser," which is safe and informative to prove without touching real inventory data — unlike `patients`/`appointments`/`billing`, where load testing risks touching real records, a *synthetic* concurrency test of this logic carries much lower risk and higher payoff.

---

## 8. Scalability & dynamic-approach recommendations

This module pair is close to how the rest of the system should be built, so the recommendations here are refinements, not fixes:

- **Deduplicate the per-item inventory-refresh calls by medicine (§3.1)** — the single highest-leverage change in this review, because it directly shortens transaction duration under exactly the conditions (busy pharmacy, popular medicines, multi-item prescriptions) where contention is most likely to actually occur. Shorter transactions on hot documents is a direct scalability lever, not just a latency one — it reduces the window during which two concurrent dispensing operations touching the same medicine's inventory snapshot can conflict and force a retry.
- **The idempotency-key design here (partial unique index + specific error mapping) is the pattern that should be the default for every write-heavy, retry-prone endpoint in the system** — not just pharmacy. Any endpoint that performs a financially or physically irreversible side effect (stock deduction, payment collection, notification dispatch) and might reasonably be retried by a client after a timeout should carry the same idempotency-key discipline demonstrated here. This is a good candidate for a short internal engineering guideline rather than a per-module fix, given how well it's already proven out in this specific module.
- **The three-layer overselling protection (§2) is the reference pattern this review series has been asking for elsewhere** — the `appointments` module's unresolved overlap-conflict race (flagged High in that review) and the `opd` module's unenforced "one active visit per patient" rule (also flagged High) are both exactly the kind of problem this module already solves correctly. Pointing whoever picks up those two findings at this module's `updateBatchQuantity`/`confirm()` pair as a worked example would likely save real design time.
- **No change needed to the inventory/batch soft-delete (or lack thereof)** — this module's choice to model lifecycle via `status` rather than `deletedAt` is already the more scalable, more correct choice for this kind of data, and is the reason this module alone in the series sidesteps the missing-index pattern that recurred everywhere else. Worth treating as a deliberate precedent when any future module needs to decide between soft-delete and status-based lifecycle modeling.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Deduplicate `refreshInventorySnapshot` calls by `medicineId` within `confirm()` and `reverse()`, calling it once per unique affected medicine rather than once per line item (§3.1).
- [ ] Confirm whether `quantityOnHand: {$gt: 0}` combined with `status: 'ACTIVE'` is ever actually divergent in practice (i.e., can an `ACTIVE` batch have zero quantity) — if not, §3.2 is moot and needs no index change; if so, consider folding quantity into the existing FEFO-supporting index.
- [ ] Use this module's idempotency-key pattern and three-layer concurrency-safety pattern as the explicit reference implementation when addressing the `appointments` and `opd` modules' unresolved race-condition findings from earlier in this review series.
- [ ] Follow up with a synthetic concurrent-load test of `confirm()` against the local ephemeral-MongoDB harness once that's set up for this purpose (§7) — low-risk, high-value given what's actually being proven.

---

## 10. Verdict

**Production-ready, modulo the one performance refinement in §3.1.** No correctness, data-integrity, or security findings in either module — this is the only module pair in the entire review series so far with a clean bill of health on every axis except raw round-trip efficiency. This should be treated as the house reference implementation for concurrency-safe, idempotent, financially-consequential write operations elsewhere in the codebase.
