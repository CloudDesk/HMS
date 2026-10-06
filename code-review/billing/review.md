# Module Review: `billing`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/billing/*` (`billing.model.ts`, `billing.repository.ts` [627 lines], `billing.service.ts` [762 lines], `billing.schemas.ts`, `billing.types.ts`, `billing-number.ts`). Static code review.
**Live load testing: not executed** — real financial transaction data; see §7.
**This review was prioritized specifically to close a follow-up flagged in the cross-cutting `doctors` review finding** ([`code-review/_infrastructure/market-localization-mismatch.md`](../_infrastructure/market-localization-mismatch.md)) — confirming whether the Kenya/India currency mismatch was reachable in a live billing flow. **It is**; see §3.1.

---

## 1. Executive summary

The financial-correctness core of this module is genuinely solid: payment application uses real optimistic concurrency at the database level (not just application-level checks), invoice total/discount/paid-amount consistency is actively guarded against going negative or inconsistent, and cancellation is correctly blocked once money has changed hands. The confirmed finding here is the one flagged as a priority follow-up from the `doctors` review: a hardcoded, wrong-currency label in a live, user-facing payment error message.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 0 (1 confirmed, tracked cross-cuttingly) | Hardcoded `KES` currency label in the "payment exceeds balance" error — confirmed reachable on every occurrence, not a fallback-only risk |
| 🟠 High | 1 | Invoice/payment numbers are random hex strings, not sequential counters — worth checking against Indian tax-invoice sequential-numbering requirements given this system's confirmed India deployment |
| 🟡 Medium | 1 | Money is stored and computed as floating-point `Number`, not integer minor-units or `Decimal128` — mitigated by consistent rounding, but not eliminated as a risk |
| 🟢 Low | 1 | `billing_invoices` has no index covering `deletedAt` — same recurring pattern as `patients`/`opd_visits`/`appointments`, not re-derived in depth |

---

## 2. What's correct (keep doing this)

- **Payment application is real, database-level optimistic concurrency — not just an application-level check.** `applyPayment` (`billing.repository.ts:498-518`) folds the safety condition directly into the `findOneAndUpdate` filter itself: `status: { $in: ['PENDING','PARTIALLY_PAID'] }, balanceAmount: { $gte: amount }`. Two concurrent payment submissions against the same invoice can't both succeed and silently double-count — the second one's filter simply won't match the (now-stale, from its perspective) balance, and the service layer correctly turns that into `409 PAYMENT_CONFLICT`. This is exactly the pattern recommended as a fix for weaker, app-level-only checks found elsewhere in this review series (`appointments`' overlap conflicts, `opd`'s active-visit check) — billing got this right from the start, for the one place in the whole system where getting it wrong means double-spending the same balance.
- **Invoice math is actively guarded against becoming inconsistent.** `calculateTotals` (`billing.service.ts:732-741`) rejects a discount larger than the subtotal (`400 INVALID_DISCOUNT`) and rejects any update that would drop the total below what's already been paid (`409 TOTAL_BELOW_PAID_AMOUNT`) — so an invoice can never be edited into a state where `paidAmount > totalAmount`. This is exactly the kind of invariant that matters most in a billing system and is easy to get subtly wrong when items/discounts can be edited after partial payment.
- **Cancellation is correctly blocked once money has moved**: `cancel()` (`billing.service.ts:421-427`) explicitly refuses to cancel an invoice that's `PAID` or has any `paid_amount > 0`, with a clear stated reason ("refunds are out of scope") rather than silently allowing a cancellation that would leave collected payments orphaned from any invoice.
- **Real DB-level uniqueness for the two relationships that most need it**: a partial unique index prevents more than one invoice per admission-request/procedure-booking context (`billing.model.ts:111-118`), and another prevents more than one `PROCEDURE`-type line item per originating clinical order (`:141-152`). Both of these guard against exactly the kind of duplicate-billing bug that would be hardest to notice and most embarrassing to explain to a patient.
- **`resolveItems`/`calculateTotals` consistently apply `roundMoney`** at every arithmetic step (subtotal, discount, tax, total, balance) rather than letting floating-point values accumulate unrounded across multiple operations — a reasonable mitigation even though it doesn't fully resolve the underlying representation choice (§3.3).

---

## 3. Findings

### 3.1 🔴 CRITICAL (confirmed; tracked cross-cuttingly) — Hardcoded `KES` currency label in a live payment error message

**Where:** `billing.service.ts:462-472`

```ts
if (amount > currentBalance) {
  const formattedBalance = currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  throw new AppError(
    `Payment amount cannot exceed the outstanding balance of KES ${formattedBalance}.`,
    400,
    'PAYMENT_EXCEEDS_BALANCE',
    { balance_amount: currentBalance },
  );
}
```

This is the confirmation of the follow-up flagged in the `doctors` module's cross-cutting finding. Unlike the timezone fallback (`'Africa/Nairobi'`, only reached if settings are missing/misconfigured) or the default seed configuration (only matters before an admin reconfigures it), **this one is wrong on every single occurrence, unconditionally** — it never reads `currencySymbol` from settings at all; `KES` is a literal string. Any front-desk or billing staff member who attempts to collect a payment larger than the remaining balance sees this exact message, regardless of what currency the hospital is actually configured for. For the confirmed-India deployment this system runs on, that's a receptionist seeing "KES" on a hospital that bills in rupees, every time this validation triggers.

Full cross-cutting context and the other related findings (settings defaults, timezone fallbacks) are documented in [`code-review/_infrastructure/market-localization-mismatch.md`](../_infrastructure/market-localization-mismatch.md), which has been updated with this confirmation.

**Recommended fix:** read `currencySymbol` from the settings repository (already injected into other billing-adjacent services in this codebase) and interpolate it instead of the literal `'KES'`. Grepping the rest of this module found no other hardcoded currency strings — this is an isolated, one-line fix once the settings lookup is wired in.

### 3.2 🟠 HIGH — Invoice and payment numbers are random, not sequential — worth checking against tax-invoice requirements

**Where:** `billing-number.ts`

```ts
export const createBillingNumber = (prefix: 'INV' | 'PAY') =>
  `${prefix}-${dateCode()}-${randomBytes(4).toString('hex').toUpperCase()}`;
```

Every other sequence-numbered entity in this codebase (patients, OPD visits, appointments, doctors) uses an atomic, monotonically-increasing counter, producing gapless, sequential, human-auditable numbers (`HMS-2026-000123`, `OPD-2026-00045`, etc. — confirmed across multiple module reviews in this series). Invoices and payments are the one exception: `createBillingNumber` produces a date-prefixed **random hex string** instead (`INV-20261006-A3F91C2E`). Functionally this avoids any sequence-counter contention entirely, and collisions are vanishingly unlikely (32 bits of randomness per day) — but it means invoice numbers are not sequential or gapless.

**Why this is flagged as High rather than a style note:** this system has a confirmed India deployment. Under India's GST invoicing rules (CGST Rules, Rule 46), a tax invoice is generally required to carry a **consecutive serial number** for the relevant financial year. Whether this specific requirement actually applies depends on whether this hospital's billed services are GST-taxable supplies in the first place — many core healthcare services in India are GST-exempt, but ancillary/non-core services (certain diagnostics, non-medical charges) often are not, and the correct treatment depends on specifics outside this review's scope to determine. **I'm not asserting this is a compliance violation** — I don't have enough context to say definitively whether these invoice numbers are used as GST tax invoice numbers in practice, or whether a separate, compliant numbering scheme is applied elsewhere (e.g., at a point-of-sale/accounting integration layer downstream of this system). This is flagged as a **question worth getting a definitive answer to**, given the stakes of getting it wrong (tax compliance) and how straightforward the underlying code fix would be if the answer is "yes, this needs to be sequential."

**Recommended fix (if the answer confirms sequential numbering is required):** apply the exact same atomic-sequence pattern already used correctly elsewhere in this codebase — in fact, the `doctors` module's `ensureDoctorNumberSequence`/`nextDoctorNumber` pair (reviewed just before this module) is a ready-to-copy reference implementation, including its smart one-time-reconciliation design.

### 3.3 🟡 MEDIUM — Money is represented as floating-point `Number`, not integer minor-units or `Decimal128`

**Where:** `billing.model.ts` — `subtotal`, `discountAmount`, `taxAmount`, `totalAmount`, `paidAmount`, `balanceAmount`, `unitPrice`, `lineTotal`, `amount` are all plain Mongoose `Number` fields; `billing.service.ts:31`'s `roundMoney` (`Math.round((value + Number.EPSILON) * 100) / 100`) is the only mitigation against floating-point drift.

This is a known, well-documented class of risk for any system doing real financial arithmetic in IEEE-754 double-precision floats: values like `0.1 + 0.2` don't round-trip exactly, and while rounding to 2 decimal places after each operation (as this code consistently does) substantially reduces the practical frequency of visible symptoms, it doesn't eliminate the underlying risk — particularly for calculations that compound over several steps (an invoice edited multiple times, across multiple partial payments, each one re-deriving `balanceAmount` from a previous floating-point result).

**Why Medium, not High:** the consistent application of `roundMoney` at every single computation step (confirmed in `calculateTotals` and `applyPayment`) is a real, meaningful mitigation, and MongoDB's own storage of `Number` as IEEE-754 doubles means this isn't fixable by changing *only* the application code without also considering the storage format. This is a legitimate concern to flag, not an active bug caught in this review.

**Recommended fix (longer-term, not urgent):** consider migrating monetary fields to MongoDB's native `Decimal128` type, or to integer minor-units (paise, i.e. store `123456` instead of `1234.56`) with conversion only at the display/API boundary — either approach eliminates the entire class of floating-point drift risk rather than mitigating its symptoms.

### 3.4 🟢 LOW — `billing_invoices` has no index covering `deletedAt`

**Where:** `billing.model.ts:104-118`

Same recurring pattern as `patients`, `opd_visits`, and `appointments` in this review series (confirmed base filter at `billing.repository.ts:233`: `{ deletedAt: null, ... }`), moderated the same way those were — most real queries also filter on `patientId`, `branchId`, or `status`, each of which has a leading compound index, so this is a real gap but not an urgent one. Not re-derived in depth here; same recommended fix (fold `deletedAt` into the existing compound indexes).

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Discount cannot exceed subtotal | ✅ | `calculateTotals` | None |
| Total cannot drop below already-paid amount | ✅ | `calculateTotals` | None |
| Payment amount must be positive | ✅ | `collectPayment` | None |
| Payment amount cannot exceed outstanding balance | ✅ (message wording wrong) | `collectPayment` | §3.1 |
| Cannot pay a draft/cancelled/already-paid invoice | ✅ | `collectPayment` | None |
| Cannot cancel an invoice with payments | ✅ | `cancel` | None |
| Cannot modify a paid/cancelled invoice | ✅ | `assertFinanciallyMutable` | None |
| Pharmacy-sourced invoices protected from manual edits | ✅ | `assertNotDispensingManaged` | None |
| Duplicate invoice per admission/procedure context | ✅ DB-enforced | Partial unique index | None |
| Concurrent payment application | ✅ DB-enforced | `applyPayment`'s atomic filter | None |

---

## 5. MongoDB index audit

**`billing_invoices`** — 8 indexes: patient/visit/sourceType+encounter/admission/procedure lookups, status+date, branch+date+status, and the two correctly-designed partial unique constraints already praised in §2. Missing `deletedAt` coverage (§3.4), consistent with the pattern already established elsewhere in this series.

**`billing_invoice_items`** — `{invoiceId,deletedAt}` (correctly includes `deletedAt` here, unlike the parent invoice collection), `{serviceId,createdAt}`, and a well-targeted partial unique constraint for `PROCEDURE`-type items tied to an originating order. No gaps.

**`billing_payments`** — `{invoiceId}`, `{paymentDate}`, `{branchId,paymentDate}`. Reasonable for the query shapes reviewed; not independently stress-tested against every possible filter combination given time spent elsewhere in this review.

---

## 6. API performance & round-trip analysis

| Operation | Sequential round trips (excluding shared auth chain) | Notes |
|---|---|---|
| `POST /api/billing/invoices` (create) | ~5 inside one transaction (context validation, item resolution, invoice+items create, audit) | Appropriately transactional |
| `POST /api/billing/invoices/:id/payments` (collect payment) | ~6-7 inside one transaction (invoice fetch, payment create, atomic balance update, conditional advance-payment sync, audit) | Appropriately transactional; the advance-payment sync for admission/procedure-context invoices is a reasonable additional step given the cross-module consistency it maintains |

Nothing here stands out as an avoidable inefficiency — the round-trip counts reflect genuine multi-document consistency needs for financial operations, consistent with how `opd`'s and `appointments`' appropriately-transactional flows were assessed in this series.

---

## 7. Load testing (p65/p90) — status

**Not executed.** Billing records are real financial transaction data tied to real patients — the same reasoning already applied to `patients`/`appointments`/`opd` extends here with, if anything, higher stakes given the financial nature of the data. The local ephemeral-MongoDB harness remains the right tool for functionally verifying `applyPayment`'s concurrency guarantee under real concurrent load (fire multiple simultaneous payment attempts against the same invoice and confirm only one succeeds) without touching real financial data, if that's wanted as a follow-up.

---

## 8. Scalability & dynamic-approach recommendations

- **Read `currencySymbol` dynamically from settings everywhere money is displayed in a message, not just in the one confirmed spot (§3.1)** — the fix for this specific line is trivial, but the right long-term shape is that no billing-adjacent code path ever hardcodes a currency label; it should always flow from the one configured value, so the system behaves correctly regardless of which market it's deployed to without needing another targeted grep-and-fix pass later.
- **If the invoice-numbering question (§3.2) comes back requiring sequential numbers, apply `doctors`' sequence-allocation pattern exactly** — it's already proven to scale correctly (cheap existence check, one-time reconciliation, atomic per-request increment) and would need no new design work, just reuse.
- **The optimistic-concurrency pattern in `applyPayment` (§2) is the reference implementation this whole review series has been asking other modules to adopt** — `appointments`' overlap-conflict race and `opd`'s active-visit race are both the same underlying problem this module already solves correctly for money. Worth treating as the one pattern to standardize on, system-wide, for "two concurrent actors can't both consume the same finite thing."
- **The `Decimal128`/integer-minor-units question (§3.3) is worth deciding proactively rather than reactively** — it's far cheaper to make this change before real financial history accumulates in the current floating-point representation than after, given any migration would need to carefully reconcile historical values.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Fix the hardcoded `KES` label in `collectPayment`'s balance-exceeded error to read the configured `currencySymbol` instead (§3.1). **Highest priority in this module** — confirmed wrong on every occurrence, user-facing, in a live financial flow.
- [ ] Get a definitive answer on whether invoice numbers need to be sequential for tax-compliance purposes in this system's actual India deployment, and if so, apply the `doctors` module's sequence-allocation pattern to `createBillingNumber` (§3.2).
- [ ] Consider migrating monetary fields to `Decimal128` or integer minor-units as a longer-term hardening measure (§3.3) — not urgent, but worth tracking given this is the one module in the entire system where a subtle numerical bug has direct financial consequences.
- [ ] Fold `deletedAt` into `billing_invoices`' existing compound indexes (§3.4).
- [ ] Follow up on the broader cross-cutting localization sweep once this confirmation is in — the pattern here (settings not being read where they should be) may recur in other financially-adjacent code not covered by this pass (e.g., `advance-payment`, which `collectPayment` integrates with directly).

---

## 10. Verdict

**Closer to production-ready than most modules in this series for the things that matter most to a billing system** — the concurrency safety around payment application and the invariant guards on invoice totals are genuinely well-built, and there's no data-integrity bug found here. The one confirmed issue (§3.1) is real and user-facing, but it's a one-line fix once the settings lookup is wired in, not a structural problem. The invoice-numbering question (§3.2) is the one item in this review that could turn out to be more serious than it looks, purely because it touches tax compliance rather than application correctness — worth resolving with a definitive answer rather than treating as optional.
