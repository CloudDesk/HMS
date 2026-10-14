# HMS End-to-End Flow & Dynamic/Configurability Analysis

**Analyzed:** 2026-10-06
**What this is, and how it differs from the 28 module reviews:** every other document in `code-review/` assesses one module (or a tightly-coupled pair/group) in isolation — its own code quality, indexes, error handling, concurrency safety. This document instead traces real, complete business journeys **across module boundaries** — does a patient's visit actually reach billing? Does a cancelled booking's deposit actually get resolved? Does a doctor get checked for conflicts across *every* module that can occupy their time, not just one? — and separately assesses which parts of the system are genuinely dynamic/configurable versus hardcoded in ways that limit deploying this product to a new market or hospital group.
**Method:** every finding below was verified by direct source inspection (grep + read) across module boundaries, not inferred from reading one module's review in isolation. Where a flow was confirmed *complete and correct*, that's stated as plainly as where it wasn't.

---

## 1. Executive summary

The individual modules are, for the most part, well-built — that's the conclusion of the 28-module review series. This document's finding is different and important on its own terms: **several real patient/business journeys have a missing link at the exact seam between two otherwise-solid modules**, and several configuration values that should be deployment-specific are hardcoded for one specific market. Five new, confirmed flow-level gaps are documented here that don't appear in any single module's review because no single module's review would show them — they only become visible by following the flow across the boundary.

| Severity | Finding |
|---|---|
| 🟠 High | OPD visits have **no billing-closure enforcement and no automatic invoice creation** — unlike Emergency and Inpatient, which both require financial closure before discharge. OPD is the highest-volume clinical flow in the system. |
| 🟠 High | Doctor double-booking is only checked **one direction**: `surgery` checks against `appointments`, but `appointments` never checks against `surgery`. A doctor can be booked for an OPD appointment and a procedure at the same time. |
| 🟠 High | Four patient-facing notification types (lab results, imaging reports, pending invoices, consent requirements) are **never created at the moment the triggering event happens** — only discovered later via the already-flagged, slow lazy-reconciliation sweep in `notifications`. There is no proactive/push path for any of them. |
| 🟡 Medium | **No refund flow exists anywhere in the system.** `billing.cancel()` explicitly refuses to cancel a paid invoice ("refunds are out of scope"), and cancelling an admission request or procedure booking never touches the associated deposit. A cancelled booking with money already collected has no system-supported resolution. |
| 🟡 Medium | **No patient-record merge/deduplication capability.** Duplicate detection exists at registration time (blocks an *obvious* duplicate), but once two records for the same real person exist, there is no way to merge their history, appointments, visits, or billing under one canonical record. |

---

## 2. Flow-by-flow analysis

For each major journey: what's implemented, whether it's complete end-to-end, and confidence level (✅ confirmed complete and correct by direct inspection, ⚠️ confirmed gap, 🔍 not independently re-verified in this pass — relying on the underlying module reviews).

### 2.1 Patient registration → OPD visit → consultation → billing

**Walk-in path:** `patients.create()` → `appointments.create()` (or walk-in `opd-visit.create()` directly) → OPD queue → vitals → consultation → diagnosis/prescription/orders → `opd-visit.updateStatus('COMPLETED')`.

- ✅ Registration, duplicate detection, appointment booking/check-in, the consultation sub-flow (vitals → consultation → prescription → lab/imaging orders → referral/follow-up) are all confirmed complete and internally consistent — this is the best-reviewed part of the system (the `opd` module review).
- ⚠️ **Billing is not part of this flow at the API level.** `opd-visit.service.ts` has zero references to `billing` anywhere — no automatic invoice creation when a visit completes, and no check that *any* invoice exists or is settled before the visit can be marked `COMPLETED`. Compare directly:
  - `emergency.service.ts`'s `disposition()` **requires** `billing.isEncounterFinanciallyClosed()` to pass before a `DISCHARGE` decision is allowed.
  - `inpatient-admission.service.ts`'s `finalizeDischarge()` **requires** the same financial-clearance check (plus a clinical-readiness checklist) before discharge.
  - `opd-visit.service.ts`'s `updateStatus()` to `COMPLETED` requires only that the *clinical* consultation is complete — nothing about money.
- **Why this matters:** either OPD consultation billing is handled entirely as a disconnected, manual staff action with zero system enforcement (plausible, but then there's no guarantee it ever happens, and no visibility into which completed visits were never billed), or it's simply missing. Either way, this is a real inconsistency between the three main encounter types in how seriously each one treats "did this encounter get billed/paid" — and OPD, the highest-volume one, is the one with no enforcement at all.

### 2.2 Appointment booking ↔ Surgery/procedure booking (doctor time conflicts)

- ✅ `surgery.service.ts`'s `validateSchedule` correctly checks a doctor's *OPD appointments* before confirming a procedure booking (`hasAppointmentOverlap`, confirmed in the `surgery` review) — a surgery can't be booked over an existing OPD slot.
- ⚠️ **The reverse check does not exist.** `appointments.service.ts`/`appointment.repository.ts` contain zero references to `surgery`, `ProcedureBooking`, or any procedure-related model. `validateDoctorConflict` (the function responsible for catching exactly this kind of conflict) only ever queries the `appointments` collection against itself.
- **Concrete failure mode:** a doctor has a confirmed procedure booking for Thursday 2:00-3:30pm. A receptionist books that same doctor for a 2:30pm OPD appointment. Nothing in the `appointments` module's conflict-checking will catch this — the booking succeeds, and the doctor is now double-booked between an OT procedure and a walk-in consultation.
- This is a one-way gap between two modules that are each individually well-built — exactly the kind of thing that's invisible reviewing either module alone, which is why it wasn't caught as a finding in either the `appointments` or `surgery` module reviews (the `surgery` review flagged this direction as an *open question*; this analysis confirms it as a gap).

### 2.3 Clinical result → patient notification

- 🔍 **Staff-facing notifications are correctly event-driven.** Confirmed call sites for `notifications.createNotification`/`services.notifications.*` exist in `opd-visit.service.ts` (call-next-patient), `opd-referral.service.ts`, and `dental-lab-order.service.ts` — all staff-facing operational alerts, created at the moment the triggering event happens.
- ⚠️ **Patient-facing clinical notifications are not.** The `NotificationType` enum defines `LAB_RESULT`, `IMAGING_REPORT`, `INVOICE_PENDING`, and `CONSENT_REQUIRED` — clearly intended as patient-facing, event-driven notification types. A repo-wide search for every caller of the notification-creation path found **zero** references to it from `laboratory.service.ts`, `imaging.service.ts`, `billing.service.ts`, or `consents.service.ts`. These four notification types exist only as *candidates* for `notifications`' lazy `syncPatientNotifications` reconciliation sweep (already flagged in the `notifications` module review as a severe performance problem) to eventually discover and backfill, the next time the patient happens to open their notifications tab.
- **Compounding effect:** this means the "tell the patient their lab result is ready" flow is not just slow (per the `notifications` review's §3.1) — it's **not real-time at all**. A patient whose lab result was verified an hour ago gets no signal of that until they manually open the app and the expensive sync runs. There's no SMS/push channel for this either (only an in-app notification record). For a result a doctor might consider urgent to communicate promptly, this is a meaningful gap in the actual patient-communication flow, not just a performance number.
- **Recommended fix:** add a direct `notifications.createNotification()` call at the point of verification/creation in `laboratory.verifyResult`, `imaging.verifyReport`, `billing.create`/`collectPayment` (for pending-balance cases), and `consents` attachment — turning this from a lazily-discovered fact into a proactively-pushed one, and making the already-recommended fix to the lazy sync (batch it, move it off the read path) a pure safety net/backfill mechanism rather than the only path that exists.

### 2.4 Admission/procedure request cancellation → deposit resolution

- ✅ Bed holds are correctly released on cancellation (`inpatient-admissions.cancelRequest()` calls `beds.cancelAdmissionRequestHold`; `surgery.cancelBooking()` calls `beds.releaseHoldSafe`) — the *physical resource* side of cancellation is handled correctly.
- ⚠️ **The financial side is not.** Neither `cancelRequest()` nor `surgery.cancelBooking()` makes any call into `advancePayment` or `billing` to flag, reverse, or even annotate an existing deposit invoice tied to the now-cancelled request/booking. Combined with `billing.cancel()`'s explicit, hard rule — *"Invoices with collected payments cannot be cancelled because refunds are out of scope"* (confirmed verbatim in the `billing` module review) — the result is: **a patient who paid a deposit for an admission or procedure that then gets cancelled has their money sitting against a cancelled context, with no system flag that it needs attention, no refund mechanism, and no accounting-side visibility that this specific invoice is now orphaned.**
- This is a real gap in a production hospital billing system, not an edge case — admission requests and procedure bookings get cancelled regularly (patient changes their mind, clinical reassessment, scheduling conflicts), and deposits are explicitly a required prerequisite for many of them per policy.
- **Recommended fix (product decision, not just code):** at minimum, cancelling a request/booking with an associated paid deposit should create a flagged "refund pending" record or notification to billing/finance staff, even if actually processing the refund stays a manual, outside-the-system step (e.g., a bank transfer initiated separately). Silently doing nothing is the one option that's clearly wrong.

### 2.5 Duplicate patient records → merge/remediation

- ✅ Duplicate detection at registration time is real and functioning (`patients.create()`'s `findDuplicateCandidates`, confirmed in the `patients` module review) — it catches the common case of registering the same person twice with matching name+DOB or phone.
- ⚠️ **No merge capability exists anywhere in the `patients` module** (confirmed by direct search — no "merge" functionality in any form). If two records for the same real patient end up existing anyway — a near-miss that didn't trigger the duplicate check (a typo'd name, a different phone number, registration via two different channels with slightly different details), which *will* happen over the lifetime of real operation — there is no supported path to consolidate their appointments, visits, prescriptions, documents, and billing history under one canonical patient record. Each duplicate silently has its own independent clinical history.
- **Why this matters for a hospital system specifically:** a fragmented clinical history (allergies, prior diagnoses, medication history split across two "different" patients) is a genuine patient-safety concern, not just a data-hygiene one.

### 2.6 Other flows confirmed complete and correct (worth stating plainly, not just the gaps)

- **Emergency → inpatient admission conversion**: fully traced, correctly idempotent, correctly guards against double-conversion from both sides (confirmed in `inpatient-admissions` and `emergency` reviews).
- **OPD visit → referral → booking in another department**: confirmed structurally sound in the `opd` review; not re-traced in this pass beyond what that review already covered.
- **Pharmacy prescription → dispensing → stock deduction → billing invoice**: fully traced and confirmed correct, including the three-layer concurrency protection (`pharmacy` module review) — this is one of the few flows in the system where billing integration *is* automatic and enforced, making OPD's lack of the same (§2.1) a more visible inconsistency by comparison.
- **Role/permission management**: genuinely dynamic — new roles, permissions, and role-permission assignments are fully data-driven and admin-manageable at runtime with no code changes required (confirmed across the `auth-rbac` review). This is a real strength worth stating explicitly in a document that's otherwise mostly about gaps.
- **Department-level module visibility** (`hiddenModules` on `Department`, confirmed in the `departments` review) is a genuine piece of per-deployment configurability already built into the system.

---

## 3. Dynamic & configurable — what's actually dynamic, what's hardcoded but *should* be, and what's hardcoded and *correctly so*

This section directly addresses the "is this handled dynamically/configurably" question, separating three categories that are easy to conflate:

### 3.1 Genuinely dynamic today (credit where due)
- Roles, permissions, and role-permission assignments (§2.6).
- Department-level module visibility per branch.
- Branch-scoped data access throughout (every module's `resolveBranchScope` pattern).
- Settings sections (general/hospital/localization/user-preferences) are stored data, editable at runtime without a deploy — the *mechanism* for configurability is sound; only the *default values* are wrong (next section).

### 3.2 Hardcoded today, and genuinely should be configurable (confirmed, already tracked)
These are the already-documented cross-cutting findings from the module review series — not re-derived here, just consolidated under this lens:
- **Default hospital identity, country, timezone, and currency** are hardcoded to a Kenyan hospital template and — critically — get *persisted* into the real database on first use and *reintroduced* by the settings panel's own "Reset to Defaults" feature (`settings` module review, §3.1-3.2).
- **Phone number validation** on patient registration is hardcoded to African number formats, rejecting standard international-format Indian numbers (`patients` module review, §3.1).
- **Two hardcoded `KES` currency labels** in live financial error messages, independent of configured currency (`billing`/`inpatient-admissions` reviews).
- **Inconsistent timezone-fallback literals** across modules (`'Africa/Nairobi'` in `doctors`/`opd`'s dental-stage vs. `'UTC'` in `surgery`) — not wrong in the same way, but inconsistent, and a sign there's no single source of truth for "what do we do when settings aren't configured yet."

### 3.3 Hardcoded today, and *correctly so* — not a finding, stated to avoid over-correcting
- **Clinical status-transition tables** (OPD visit states, Emergency encounter states, Surgery booking states, Lab/Imaging order states) are hardcoded in each module's service layer, not configurable per branch or per hospital customer. This is the right call — these state machines encode clinical/operational safety invariants ("you can't enter a result before an order is in progress"), not business preferences, and making them admin-configurable would be a correctness risk, not a flexibility win. Worth stating explicitly so a future "make everything configurable" effort doesn't target the wrong things.
- **The permission catalog's module/screen/action shape** is fixed in code (the *assignments* are dynamic, per §3.1, but the *catalog structure itself* — what modules and screens exist — tracks the actual feature set of the product). This is normal and correct for this kind of system.

---

## 4. Scalability across flows (not just within one module)

The module-by-module reviews already measured per-endpoint round-trip counts; this section is about what happens when you add them up across a *complete* patient journey, which is the number a real user actually experiences.

**Example: a single emergency-to-admission patient journey**, summing the round-trip counts already measured in the individual module reviews:
- Emergency registration + triage + consultation + orders: ~20-25 round trips across several calls
- Disposition (ADMIT decision) + admission request creation: ~10-12 round trips
- Admission request validation + confirmation (consent + deposit + bed allotment): **~20+ round trips in the confirmation step alone** (confirmed in the `inpatient-admissions` review as the single most expensive operation found in the entire series)
- Inpatient care (rounds, vitals, orders) over the admission's duration: ongoing, per-action cost already documented per module
- Discharge (clinical checklist + financial clearance + bed release): ~8-10 round trips

None of this is wrong in isolation — every module review found these round trips individually justified by genuine multi-document consistency needs. But **the Render-region-vs-MongoDB-region infrastructure question (already flagged in `_infrastructure/render-region-vs-mongo-region.md`) multiplies every single one of these**, across every flow in this document, not just one endpoint. If the API is not colocated with its Mumbai-region database, a single emergency-to-admission journey's cumulative round-trip cost (conservatively 60-80+ round trips across the full flow) turns a sub-two-second total experience into one measured in tens of seconds. This is the one finding in this entire review series that, if confirmed, would matter more than every other flow-level and module-level finding combined, purely because of how many round trips it multiplies.

---

## 5. Consolidated checklist (new findings from this analysis only — module-level checklists remain in their own reviews)

- [ ] Decide and implement a consistent billing-closure policy across OPD/Emergency/Inpatient — either OPD gets the same financial-closure gate the other two have, or a deliberate, documented reason exists for why OPD is different (§2.1).
- [ ] Add a doctor-conflict check against `ProcedureBookingModel` inside `appointments.validateDoctorConflict`, closing the one-way gap confirmed in §2.2 (this is now a confirmed gap, not an open question — update the `appointments` and `surgery` reviews' checklists accordingly).
- [ ] Add direct, event-driven notification creation at the point of lab/imaging verification, invoice creation, and consent attachment, rather than relying solely on the lazy reconciliation sweep (§2.3) — this is now confirmed as a flow-completeness gap, not just a performance one; update the `notifications` review's checklist accordingly.
- [ ] Define a product policy for deposits tied to cancelled admission requests/procedure bookings — at minimum, flag them for manual finance review rather than leaving them silently unresolved (§2.4).
- [ ] Design and implement a patient-record merge capability, even as an admin-only, carefully-audited tool rather than a self-service one (§2.5).
- [ ] Confirm the Render-region question from `_infrastructure/render-region-vs-mongo-region.md` — its impact is magnified, not just repeated, when considered across full multi-step flows rather than single endpoints (§4).

---

## 6. How this document relates to the rest of the review series

This document doesn't replace or override any individual module review — it sits alongside them, looking at the seams between modules rather than the modules themselves. Every finding here was verified by direct code inspection across module boundaries; none are speculative. The master index at [`code-review/README.md`](README.md) links here as the entry point for anyone who wants the "does the whole system actually work end to end" view rather than the module-by-module one.
