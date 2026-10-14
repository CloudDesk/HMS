# Module Review: `emergency`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/emergency/*` (`emergency.model.ts`, `emergency.repository.ts` [853 lines], `emergency.service.ts` [1,112 lines], `emergency.routes.ts`, `emergency.schemas.ts`, `emergency.types.ts`). Static code review.
**Live load testing: not executed** — real ED encounter data; see §7.

---

## 1. Executive summary

This module uses a deliberately different data-modeling choice than `opd` — one single document per encounter (triage, consultation, referral, orders, disposition, and a full `queueHistory`/`priorityHistory` audit trail, all embedded) rather than splitting each concern into its own collection. That choice pays off: the core state-transition mechanism (`transition()`, status-array-matched atomic updates) is simple, correct, and reused consistently across triage, calling the next patient, and disposition. The one real finding is a data-correctness bug, not a structural one: discharge disposition hardcodes a "no charges" billing status regardless of whether the patient actually had — and paid — real charges.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 0 | — |
| 🟠 High | 0 | — |
| 🟡 Medium | 1 | `disposition()` records `billingStatus: 'NO_CHARGES_RECORDED'` on every discharge, even when the encounter had real, fully-paid charges |
| 🟢 Low | 1 | `authorizeDepartment`'s guard fails open (silently skips the check) rather than failing closed if `departmentScope` isn't a function |

---

## 2. What's correct (keep doing this)

- **The single-document-per-encounter model is a good fit for this domain**, and the `transition()` helper (`emergency.repository.ts:595-630`) built on top of it is clean and correctly atomic: it folds the legality check directly into the `findOneAndUpdate` filter (`status: { $in: from }`) rather than checking-then-writing, so a status transition that's no longer valid by the time the write executes simply fails to match and returns `null`, which the service layer consistently turns into `409 EMERGENCY_STATE_CONFLICT`. The same one method is reused across triage, calling the next patient, and disposition, rather than each operation reinventing its own concurrency handling — a real consistency win.
- **`queueHistory` and `priorityHistory` are appended atomically in the same update as the status change** (`$push` alongside `$set`/`$inc` in `transition()`), so the audit trail for an encounter's lifecycle can never drift out of sync with the status changes it's describing — there's no separate write that could fail independently and leave the history incomplete.
- **Discharge is correctly gated on financial closure** (`emergency.service.ts:944-953`: `billing.isEncounterFinanciallyClosed(id, session)`), mirroring the same "can't close out clinically before closing out financially" pattern already praised in the `opd` review's visit-completion logic — the two modules agree on this invariant, which is exactly what you want from two clinical workflows that share a billing boundary.
- **Provisional (unidentified/unregistered) patient handling is applied consistently** across both `order()` (`:762-786`) and `disposition()` (`:982-1001`) — an ED encounter that arrived without a confirmed patient identity gets a real patient record created from the provisional identity data at the point it's actually needed (placing an order, or admitting), rather than forcing identification immediately at registration, which is clinically correct for an emergency department (you shouldn't block emergency care on paperwork).
- **No soft-delete field, by deliberate design** — like `pharmacy-dispensing`, this module models lifecycle entirely through `status` (terminal states: `DISCHARGED`/`TRANSFERRED`/`CONVERTED_TO_IP`/`LEFT`/`NO_SHOW`/`CANCELLED`), which sidesteps the missing-`deletedAt`-index pattern that recurred across several other modules in this series — there's nothing to miss because the field was never needed.
- **Index design matches the actual query shapes used** (`emergency.model.ts:275-289`): `{branchId,status,arrivalAt}` and `{branchId,status,'triage.effectiveLevel',arrivalAt}` line up with `list()`'s real filter combinations (`emergency.repository.ts:459-465`), and the referral-specific indexes (`{branchId,'referral.status','referral.submittedAt'}`, `{'referral.targetDoctorId','referral.status','referral.submittedAt'}`) show the same query-shape awareness already praised in the `doctors` and `departments` reviews.

---

## 3. Findings

### 3.1 🟡 MEDIUM — Discharge records an incorrect billing status regardless of actual charges

**Where:** `emergency.service.ts:944-968` (`disposition`)

```ts
if (data.decision === 'DISCHARGE') {
  const isFinanciallyClosed = await this.billing.isEncounterFinanciallyClosed(id, session);
  if (!isFinanciallyClosed) throw new AppError(..., 409, 'EMERGENCY_BILLING_CLOSURE_REQUIRED');
}
const result = await this.repository.transition(..., {
  disposition: {
    ...
    billingStatus: data.decision === 'DISCHARGE' ? 'NO_CHARGES_RECORDED' : null,
    ...
  },
}, ...);
```

`isEncounterFinanciallyClosed` (reviewed in the `billing` module: `billing.service.ts:232-235`) returns `true` whenever there are **no unresolved invoices** for the encounter — which includes the case where invoices existed and were **fully paid**, not only the case where no charges were ever raised at all. The discharge logic correctly *requires* this financial-closure check to pass, but then **unconditionally** records `billingStatus: 'NO_CHARGES_RECORDED'` for every successful discharge, regardless of which of those two very different scenarios actually happened.

**Why it matters:** this is stored, persisted data on the encounter's permanent disposition record — not a transient UI label. Any report, audit, or downstream query that reads `disposition.billingStatus` to answer "how many ED visits resulted in no charges" would get a wildly wrong answer, since it would count every single discharge (including ones with real, paid invoices) as a zero-charge visit. The discharge gate itself is correct — no patient is wrongly let go with unpaid bills — this is purely a mislabeled historical-data problem, but it's one that would silently corrupt any analytics built on top of this field.

**Recommended fix:** derive the actual billing outcome instead of hardcoding it — e.g., `billingStatus: hasAnyInvoiceForEncounter ? 'CHARGES_SETTLED' : 'NO_CHARGES_RECORDED'`, using a repository call that distinguishes "no invoices ever existed" from "invoices existed and are resolved." `billing`'s `hasUnresolvedInvoicesForEncounter` (the method `isEncounterFinanciallyClosed` already calls) is the natural building block — a sibling method that also reports whether any invoice exists at all would let this be fixed precisely.

### 3.2 🟢 LOW — Department-scope authorization fails open if `departmentScope` isn't a function

**Where:** `emergency.service.ts:49-55`

```ts
private async authorizeDepartment(actor: string, departmentId: string) {
  if (typeof this.repository.departmentScope !== 'function') return;   // <- silently skips the check
  const scope = await this.repository.departmentScope(actor);
  if (scope && !scope.includes(departmentId)) throw new AppError(..., 403, 'DEPARTMENT_ACCESS_DENIED');
}
```

The runtime `typeof ... !== 'function'` guard is unusual for a concrete class method that's always defined on `EmergencyRepository` — in normal production operation, this branch should never actually trigger. But as written, if it ever did (a refactor that removed the method, a different repository implementation substituted in some other context), the function would **silently return without checking anything** rather than failing closed (denying access). This is a fail-open pattern for an authorization check, which is the wrong default even if the realistic odds of it mattering today are low.

**Recommended fix:** low priority given it's very unlikely to be reachable as currently structured, but if this guard is kept at all (e.g., for test-double flexibility), it should throw or deny rather than silently pass when the expected method is missing — an authorization check should never have a silent "skip" path.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Triage only allowed from the right prior statuses | ✅ | `triage()`'s `isInitialTriage`/`isWaitingForConsultation` check | None |
| Concurrent status transition | ✅ DB-enforced | `transition()`'s status-matched atomic filter | None |
| Disposition requires doctor evaluation first | ✅ | `disposition()`'s `current.consultation`/`assignedDoctorId` check | None |
| Discharge requires financial closure | ✅ | `isEncounterFinanciallyClosed` gate | None (the gate itself is correct; §3.1 is about the *label*, not the gate) |
| Orders blocked on a terminal encounter | ✅ | `order()`'s `terminal.includes(current.status)` check | None |
| Orders require doctor + consultation first | ✅ | `order()`'s check | None |
| Provisional patient promoted correctly when needed | ✅ | Consistent across `order()`/`disposition()` | None |
| Branch access on every mutating call | ✅ | `authorize()` | None |
| Department access | ⚠️ fail-open on a specific edge case | `authorizeDepartment()` | §3.2 |

---

## 5. MongoDB index audit

**`emergency_encounters`** — 8 indexes, all confirmed against real query code: `{branchId,createdAt}`, `{branchId,status,arrivalAt}`, `{branchId,status,'triage.effectiveLevel',arrivalAt}` (the live ED queue/triage-board view), `{departmentId,status,arrivalAt}`, sparse `{patientId,createdAt}`, `{patientName,encounterNumber}`, and the two referral-specific indexes already praised in §2. A correctly-designed partial unique index on `inpatientAdmissionId` mirrors the same pattern already seen correctly applied in `opd_visits` for the identical relationship (one encounter converts to at most one admission). No gaps found.

One structural note, not a finding requiring action: `queueHistory`, `priorityHistory`, and `orders` are unbounded arrays embedded directly in the encounter document. For a single ED encounter's realistic lifecycle (hours, not years, with a bounded number of status changes and orders), this is very unlikely to approach MongoDB's 16MB document size limit — flagged only for completeness, not as a real risk at any plausible real-world scale.

---

## 6. API performance & round-trip analysis

| Operation | Sequential round trips (excluding shared auth chain) | Notes |
|---|---|---|
| `POST /emergency/:id/triage` | ~5-6 inside one transaction (record fetch, 1-2 status transitions, timeline event, 2 audit writes) | Reasonable for what it accomplishes (triage completion *and* auto-advancing to consultation in one call when applicable) |
| `POST /emergency/:id/disposition` | ~6-9 inside one transaction (record fetch, billing-closure check, transition, optional provisional-patient creation, optional admission-request creation, timeline, audit) | The variable cost (admission-request path) reflects genuine conditional complexity, not inefficiency |
| `POST /emergency/:id/orders` | ~5-7 depending on order type and whether a provisional patient needs promoting | Comparable in shape to `opd`'s clinical-order submission flow |

Nothing here stands out as an avoidable inefficiency — round-trip counts track the genuine multi-step nature of each clinical operation, consistent with how the appropriately-transactional flows in `opd`, `appointments`, and `billing` were assessed earlier in this series.

---

## 7. Load testing (p65/p90) — status

**Not executed.** Emergency encounters are real clinical encounter data (often for unidentified/provisional patients, which makes them no less sensitive) — the same reasoning already applied to `opd`/`patients`/`appointments` extends here. The local ephemeral-MongoDB harness remains the right tool for functionally verifying the `transition()` concurrency guarantee under concurrent load (e.g., two staff members trying to call the same patient, or triage the same encounter, simultaneously) without touching real data, if wanted as a follow-up.

---

## 8. Scalability & dynamic-approach recommendations

- **Fix `disposition()`'s billing-status labeling (§3.1) before building any reporting/analytics on top of ED disposition data** — this is the kind of silent data-quality bug that's cheap to fix now and expensive to discover later, once historical records already contain the wrong label and any fix has to decide whether to backfill.
- **The `transition()` pattern here is worth comparing directly against `opd`'s equivalent (`updateStatus`) and `appointments`'/`doctors`' leave-overlap checks** — this module and `pharmacy-dispensing` are the two in this series with the cleanest concurrency-safety story, and both achieve it the same way: fold the legality check directly into the atomic update's filter rather than checking-then-writing. Worth formalizing as the one pattern new write-heavy endpoints should default to, rather than each module rediscovering it independently.
- **The single-document-per-encounter design is a deliberate tradeoff worth being explicit about as the system scales**: it avoids joins for the common "show me this encounter" read, at the cost of the whole document growing with every status change, order, and history entry. This is the right call for ED encounters specifically (bounded lifecycle, bounded history) — if a similar modeling choice is ever considered for a longer-lived entity (e.g., something that accumulates history over years rather than hours), the tradeoff would look very different and deserves a fresh decision, not a copy-paste of this pattern.
- **Fail-closed, not fail-open, should be the explicit default for every authorization helper** (§3.2) — low risk today, but worth a quick sweep for the same `typeof x !== 'function'`-guards-a-security-check shape elsewhere in the codebase, since this is the kind of defensive code that can silently erode a security boundary if a refactor elsewhere changes the assumption it was written against.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Fix `disposition()`'s hardcoded `billingStatus: 'NO_CHARGES_RECORDED'` to reflect whether the encounter actually had (and settled) real charges, not just that it's financially closed (§3.1).
- [ ] Decide whether `authorizeDepartment`'s fail-open guard is intentional (e.g., for test flexibility) and if so, document why; otherwise make it fail closed (§3.2).
- [ ] Follow up with a synthetic concurrent-load test of `transition()` against the local ephemeral-MongoDB harness, mirroring the approach recommended for `pharmacy-dispensing` (§7).

---

## 10. Verdict

**Close to production-ready.** No critical or high-severity findings — the one real issue is a data-correctness bug in a denormalized label field, not a functional break or a security gap, and it has a precise, low-risk fix. This module's core concurrency mechanism (`transition()`) is one of the cleanest in the entire review series and is worth using as the reference pattern when revisiting the unresolved race conditions still open in `appointments` and `opd`.
