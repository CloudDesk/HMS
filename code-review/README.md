# HMS Code Review — Index

**Review type across this entire series:** static code review (plus, for `auth-rbac`, live functional testing against a real but ephemeral/local database). No production code has been modified by this review series — every file in `code-review/` is documentation only.
**Coverage:** 28 of 28 backend modules reviewed (100%) as of 2026-10-06. The review series is complete.
**Also see: [`FLOW_ANALYSIS.md`](FLOW_ANALYSIS.md)** — a separate, cross-module pass tracing whether complete business journeys (not just individual modules) hold together end to end, and which configuration values are genuinely dynamic versus hardcoded for one specific market. Five new findings there don't appear in any single module review because they only exist at the seams *between* modules — e.g., OPD visits have no billing-closure enforcement unlike Emergency/Inpatient, and `appointments` never checks `surgery` bookings for doctor conflicts even though `surgery` checks the reverse.

---

## 🔴 Critical findings — read these first

Ranked by real-world severity, not by the order they were found. Each entry is a one-line summary; follow the link for the full writeup (exact code, why it's reachable, concrete fix).

1. **[`patient-portal`](patient-portal/review.md) §3.1 — A guardian account can gain full, permanent access to any child's complete medical record using only that child's patient number and date of birth** (both low-entropy/guessable), with no verification of any actual relationship and **no rate limit** on the endpoint. This is a real, exploitable path to unauthorized access to minors' protected health information. **The single highest-priority item across this entire review series.**

2. **[`opd`](opd/review.md) §3.1 — A dental-imaging authorization check silently swallows a legitimate access denial** and falls through to a check that doesn't verify the current user at all. Confirmed (in the [`laboratory-imaging`](laboratory-imaging/review.md) review) to be the actual authorization gate for three real `imaging` endpoints — view report, upload attachment, download attachment — and exercised by every doctor's normal use of those endpoints, not a rare edge case. The exploitable *outcome* is scoped to dental-context orders specifically.

3. **[`settings`](settings/review.md) §3.1–3.2 — A fresh deployment's default identity is a different hospital in a different country**, and this isn't just an in-memory fallback: `SettingsRepository.get()`'s upsert-on-read **persists** "Nairobi General Hospital / Kenya / KES" into the real database on first use, and the settings panel's own "Reset to Defaults" feature **reintroduces it at any time** as a normal, permission-gated admin action. Root cause of the cross-cutting finding tracked in [`_infrastructure/market-localization-mismatch.md`](_infrastructure/market-localization-mismatch.md).

4. **[`patients`](patients/review.md) §3.1 — New patient registration actively rejects valid phone numbers** in standard international format (e.g. `+91...`) via a validation function named `isValidAfricanPhone`, while silently accepting any unformatted digit string with no real validation. A confirmed, shipped, user-facing broken feature on the patient-registration path.

---

## 🟠 High-severity findings (non-security, but real correctness/performance gaps)

- **[`notifications`](notifications/review.md) §3.1 — Opening the patient notifications list can trigger up to ~160 sequential database round trips** (four source collections × up to 20 items × one-at-a-time exists-then-create), on a screen patients routinely re-check. At this system's measured real round-trip cost (~25-30ms), that's a plausible 4-5 *seconds* of added latency — likely the single worst per-endpoint performance problem found in this entire series.
- **[`advance-payment`](advance-payment/review.md) §3.1** — `syncRequirement` computes a financial balance/status from a stale in-application snapshot across two non-atomic writes, racing against concurrent payments. The correct, atomic version of the same computation sits four lines away in the same file (`addPayment`).
- **[`appointments`](appointments/review.md) §3.1** — Doctor/patient appointment double-booking (overlapping, not just identical, time slots) has no database-level guarantee. **A proven, working fix for this exact problem now exists in this same codebase** — see `surgery`'s locking pattern below.
- **[`surgery`](surgery/review.md) §3.1** — The module's own correct concurrency-lock pattern (see next section) isn't applied consistently: `rescheduleBooking` can race the same way `appointments` can, because it skips the lock `createBooking` uses correctly.
- **[`billing`](billing/review.md) §3.1 / [`inpatient-admissions`](inpatient-admissions/review.md) §3.1** — Two confirmed, user-facing instances of a hardcoded `KES` currency label in live financial error messages, independent of the hospital's actually configured currency. Part of the same cross-cutting localization issue as `settings` above.

---

## 🟢 Best-engineered modules — reference patterns worth copying elsewhere

- **[`inpatient-admissions` & `admissions-configuration`](inpatient-admissions/review.md)** — the strongest module pair in the series. Every bed/hold/admission state transition is a single atomic update with the full precondition set in the filter, backed by real database uniqueness for every invariant that matters. The fully-solved version of the race conditions still open in `appointments`/`opd`.
- **[`surgery`](surgery/review.md)** — contains the most sophisticated concurrency mechanism in the codebase: a deadlock-safe advisory lock (sorted lock acquisition order, relying on MongoDB write-conflict detection plus the driver's automatic transient-error retry) that correctly serializes overlapping-time-range booking conflicts. This is the concrete, proven answer to `appointments`' unresolved §3.1.
- **[`pharmacy-inventory` & `pharmacy-dispensing`](pharmacy/review.md)** — three independent layers of protection against overselling stock, idempotency keys on both confirm *and* reversal, no correctness findings at all.
- **[`doctors`](doctors/review.md)** — the only module with a fully clean index audit from the start, and a sequence-allocation pattern that's the direct fix for `patients`' equivalent inefficiency.
- **[`emergency`](emergency/review.md)** — clean atomic status-transition design; its one finding is a mislabeled audit field, not a structural issue.
- **[`auth-rbac`](auth-rbac/review.md)** (`auth`+`roles`+`permissions`+`users`) — genuinely strong privilege-escalation prevention, live-verified refresh-token rotation; the only module group in this series tested with real, running, multi-role login traffic rather than static reading alone.
- **[`administration-dashboard`](administration-dashboard/review.md)** — the reference example for fixing the "reconciliation coupled to a request path" pattern found everywhere else: a scheduled 5-minute background refresh backing a cheap read, fully decoupled from any user request. Every module below with that pattern should point here.
- **[`notifications`](notifications/review.md)** — the authorization model (who can see/mark-as-read which notification) is correctly and carefully scoped, consistent with the historical `H-002` gap having been properly fixed. Its one finding (§3.1 above) is a performance bug sitting right next to otherwise solid work.

---

## Cross-cutting findings (span multiple modules)

- **[`_infrastructure/market-localization-mismatch.md`](_infrastructure/market-localization-mismatch.md)** — the system's actual default configuration (hospital name, address, country, timezone, currency) is for a Kenyan hospital, confirmed across `settings`, `doctors`, `opd`, `billing`, and `inpatient-admissions`. Root-caused in `settings`.
- **[`_infrastructure/render-region-vs-mongo-region.md`](_infrastructure/render-region-vs-mongo-region.md)** — measured real round-trip latency to the production MongoDB cluster (~25-30ms) and found the API's Render deployment has no `region` pinned, which defaults to Oregon — a possible order-of-magnitude latency multiplier on every database round trip if that's where it's actually running. Needs a dashboard check to confirm.
- **The "reconciliation logic coupled to a request path" pattern** — found independently in `opd` (`reconcileStaleVisits`), `appointments`/`patient-portal` (`reconcilePastAppointments`), `admissions-configuration` (`expireHolds`), and — by far the most severe instance — `notifications` (`syncPatientNotifications`, up to ~160 sequential round trips per call). All four should be moved to scheduled jobs as one piece of shared work, following `administration-dashboard`'s already-correct scheduled-refresh pattern as the concrete template.
- **The missing `deletedAt`-leading index pattern** — found in `patients` (most severe, given unbounded growth), `opd_visits`, `appointments`, `billing_invoices`. Each module's review has the specific recommended compound index.

---

## Full module-by-module list

| Module | Verdict | Key finding |
|---|---|---|
| [`branches`](branches/review.md) | Not yet production-ready | Dependency-check field-name bug; shared auth/permission round-trip cost first identified here |
| [`departments`](departments/review.md) | Not yet production-ready | Branch-filter query bug (includes unrelated departments) |
| [`auth-rbac`](auth-rbac/review.md) | Strongest group reviewed | 11-round-trip login (perf, not security); live-verified otherwise solid |
| [`patients`](patients/review.md) | Not production-ready | 🔴 Phone validation bug; missing `deletedAt` index on the fastest-growing collection |
| [`opd`](opd/review.md) | Not production-ready | 🔴 Dental-imaging auth bypass; unenforced "one active visit per patient" |
| [`appointments`](appointments/review.md) | Close to production-ready | 🟠 Overlap-conflict race (fix now proven in `surgery`) |
| [`doctors`](doctors/review.md) | Strongest module on its own merits | Timezone fallback (cross-cutting); otherwise a reference implementation |
| [`billing`](billing/review.md) | Close to production-ready | Hardcoded currency label; invoice-numbering compliance question |
| [`pharmacy-inventory`/`pharmacy-dispensing`](pharmacy/review.md) | Production-ready | No correctness findings; one performance refinement |
| [`settings`](settings/review.md) | Root cause of the localization issue | 🔴 Kenya defaults persisted to DB + reintroduced by "Reset to Defaults" |
| [`emergency`](emergency/review.md) | Close to production-ready | Mislabeled billing-status field on discharge |
| [`inpatient-admissions`/`admissions-configuration`](inpatient-admissions/review.md) | Production-ready | Best-engineered pair in the series |
| [`advance-payment`](advance-payment/review.md) | Not production-ready (small, quick fix) | 🟠 Balance/status race condition |
| [`laboratory`/`imaging`](laboratory-imaging/review.md) | Not production-ready | Maps the real reach of `opd`'s §3.1 finding to 3 live endpoints |
| [`surgery`](surgery/review.md) | Very close to production-ready | 🟠 Reschedule path skips the module's own correct lock |
| [`patient-portal`](patient-portal/review.md) | **Not production-ready — blocking** | 🔴 Dependent-linking access-control gap |
| [`consents`](consents/review.md) | Close to production-ready | Non-transactional publish can leave two active template versions |
| [`health`](health/review.md) | Production-ready | Cosmetic info-disclosure only |
| [`medicines`](medicines/review.md) | Production-ready | Clean; inherits the known regex/index pattern only |
| [`services`](services/review.md) | Close to production-ready | `delete()` has no dependency check at all (unlike `medicines`' correct version) |
| [`notifications`](notifications/review.md) | Not production-ready (performance) | 🟠 ~160-round-trip notification sync on every list call |
| [`administration-dashboard`](administration-dashboard/review.md) | Production-ready | Reference example for the scheduled-refresh fix pattern |

---

## How to use this index

- If you only read one thing from this series, read **[`patient-portal` §3.1](patient-portal/review.md#31--critical--dependent-linking-grants-full-access-to-a-minors-medical-record-based-on-two-guessable-facts-with-no-rate-limit)**.
- Each module review ends with a numbered "Unresolved / required changes" checklist and a "Scalability & dynamic-approach recommendations" section — those are written to be actioned directly, not just read.
- Cross-cutting findings are tracked once, centrally, in `_infrastructure/` — module reviews that touch them link back rather than repeating the detail, so fixing the root cause closes every linked module's checklist item at once.
