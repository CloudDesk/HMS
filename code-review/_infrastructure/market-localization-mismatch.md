# Cross-cutting finding: the system's default configuration is for a Kenyan hospital, not an Indian one

**Found:** 2026-10-06, while reviewing the `doctors` module's available-slots timezone handling.
**Status: confirmed across multiple modules via direct source reading and a repo-wide grep sweep, and traced to its root cause in a dedicated `settings` module review.** This is not a single typo — it's a consistent pattern strongly suggesting the system (or its original template/boilerplate) was built for an East African hospital group and later adapted for an Indian deployment by appending India-specific enum options, without removing or fixing the underlying defaults and fallback logic.

**→ For the full, authoritative root-cause writeup (including two findings worse than anything below — the defaults get *persisted* into the database on first use, and the settings panel's own "reset to defaults" feature reintroduces them as a normal, reachable admin action), see [`code-review/settings/review.md`](../settings/review.md).** This document remains the index of every symptom found across modules; `settings/review.md` is where the actual fix belongs.

---

## How this was found

While reading `doctor.service.ts`'s `availableSlots()` method (used to compute a doctor's bookable appointment slots — directly feeds the `appointments` module reviewed just before this one):

```ts
// apps/api/src/modules/doctors/doctor.service.ts:369
const tz = (await this.settingsRepository?.get())?.localization?.timezone || 'Africa/Nairobi';
```

If hospital settings haven't been explicitly configured, or the settings read fails/returns nothing, the system falls back to **Africa/Nairobi (Kenya, UTC+3)** — not any India timezone — to decide what "today," "the current time," and "which slots have already passed" mean. Given every other piece of infrastructure evidence in this review series points to an India deployment (MongoDB Atlas hosted in Mumbai, `en-IN` locale formatting used elsewhere in the codebase — see the `patients` module review), this is a real, confirmed mismatch, not a deliberate multi-region feature.

Pulling on this thread turned up the same pattern repeated across the codebase:

| File | What's wrong |
|---|---|
| `apps/api/src/modules/doctors/doctor.service.ts:369` | Timezone fallback: `'Africa/Nairobi'` |
| `apps/api/src/modules/opd/dental-stage.service.ts:804` | Same fallback: `'Africa/Nairobi'` |
| `apps/api/src/modules/opd/dental-stage.service.ts:891` | Same fallback again, a second time in the same file |
| `apps/api/src/modules/settings/settings.defaults.ts:22,25,31,32` | **The system's actual default hospital configuration**: `hospitalName: 'Nairobi General Hospital'`, `address: 'Kenyatta Avenue, Nairobi, Kenya'`, `country: 'Kenya'`, `timezone: 'Africa/Nairobi'` |
| `apps/api/src/modules/settings/settings.defaults.ts:33-34` | Default `currency: 'KES'`, `currencySymbol: 'KES'` (Kenyan Shilling) — this is the default **billing currency** for a system whose `billing` module computes real invoice amounts |
| `apps/api/src/modules/settings/settings.model.ts:50-51`, `settings.types.ts:24-26`, `settings.schemas.ts:52-53` | The `country`/`timezone`/`currency` enums are East-African-market lists (`Kenya\|Uganda\|Tanzania\|Nigeria`, `Africa/Nairobi\|Africa/Lagos\|Africa/Cairo\|Africa/Kampala\|Africa/Dar_es_Salaam`, `KES\|UGX\|TZS\|NGN`) with `India`/`Asia/Kolkata`/`INR` added as one additional option each, rather than India being the system's actual primary/designed-for market |
| `apps/api/src/modules/patient-portal/patient-portal-transaction.test.ts:40` | Test fixture data uses `city: 'Nairobi'` |
| `apps/api/src/modules/billing/billing.service.ts:468` | **Confirmed, not just a default-config risk**: the "payment exceeds balance" error message hardcodes the currency label — `` `Payment amount cannot exceed the outstanding balance of KES ${formattedBalance}.` `` — regardless of the hospital's actually configured currency. This doesn't read `currencySymbol` from settings at all; it's a literal string. This is wrong on every single occurrence (not just on a fallback/misconfiguration path) — any staff member attempting to collect a payment over the remaining balance sees "KES" even on an INR-configured hospital. |
| `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts:172` | **A second confirmed instance of the identical bug**, found while reviewing `finalizeDischarge`'s financial-clearance check: `` `Financial clearance failed. Patient has an outstanding balance of KES ${totalOutstanding.toLocaleString()} that must be settled before discharge.` `` — same pattern, same fix. A repo-wide grep for this exact string shape (`` `KES ${...}` `` / `` `KES \${...}` ``) across `apps/api/src` turns up exactly these two occurrences — confirmed complete for the backend. |

This is also the same underlying pattern as the `isValidAfricanPhone` bug already documented in the `patients` module review (phone validation rejecting valid Indian international-format numbers while being named and regex'd for African country codes) — that finding and this one are two independent confirmations of the same root cause, not two unrelated bugs.

**Scope note:** a broader repo-wide grep for Kenya/Nairobi/Africa-timezone/East-African-currency strings also surfaced ~40 more files across the frontend apps (`apps/web`, `apps/patient-web`, `apps/patient-mobile`) — mostly settings forms, currency/timezone dropdown option lists, and PDF/invoice formatters. Those were **not individually verified** in this pass; they may simply be mirroring the backend's enum (legitimate, if the enum itself gets fixed) rather than containing their own independent bugs. Called out as a follow-up scope item, not claimed as additional confirmed findings.

---

## Why this matters

This isn't cosmetic. Three concrete, traceable failure modes:

1. **Appointment slot availability can be computed in the wrong timezone.** `doctor.service.ts:369`'s fallback directly determines what counts as "today" and "already past" when computing bookable slots (`availableSlots()`, reviewed in the `doctors` module review). Nairobi (UTC+3) vs. India (UTC+5:30) is a 2.5-hour offset — enough to misclassify slots near midnight as past/future incorrectly, or to compute the wrong day-of-week for recurring availability lookups, if this fallback is ever actually hit.
2. **A fresh deployment's default identity is a different hospital, in a different country, on a different continent.** Until an administrator explicitly reconfigures `settings`, the system identifies itself as "Nairobi General Hospital," Kenya, Africa/Nairobi time, billing in Kenyan Shillings. For a system whose actual MongoDB Atlas region, locale formatting, and (per the `patients` review) phone validation all assume India, this is a real gap between what the system defaults to and what it needs to be configured as on day one.
3. **Billing currency defaults to KES.** If any invoice/billing code path ever reads the currency default before an administrator has explicitly set it (not independently verified in this pass, but `billing.service.ts` appeared in the repo-wide sweep and is worth checking directly as a priority follow-up), real financial amounts could be mislabeled in the wrong currency.

## Why this is a cross-cutting finding, not a per-module one

The same `'Africa/Nairobi'` fallback string appears independently in three different files across two different modules (`doctors`, `opd`'s dental-stage sub-module), and the `settings` module's entire default configuration is Kenya-shaped. Fixing this inside any single module's review would miss the others — this needs to be tracked and fixed as one piece of work across `settings`, `doctors`, `opd`, and (pending verification) `billing`, not three or four separate module-level patches.

## Recommended remediation

1. **Immediate, low-risk fix**: change the three hardcoded `'Africa/Nairobi'` fallbacks (`doctor.service.ts:369`, `dental-stage.service.ts:804,891`) to `'Asia/Kolkata'`, or better, derive the fallback from a single shared constant rather than a literal repeated independently in three places.
2. **Fix the actual defaults**, not just the fallbacks: `settings.defaults.ts`'s `hospitalName`/`address`/`country`/`timezone`/`currency` should default to something India-appropriate (or, better, force explicit configuration on first boot rather than silently defaulting to a different country's identity at all — arguably the more robust fix, since *any* hardcoded single-country default is fragile the moment this system is sold to a second customer). **This is more urgent than it looks**: per the `settings` module review, these defaults aren't just an in-memory fallback — `SettingsRepository.get()`'s upsert-on-read means the first ever call to this method on a fresh database **writes** this Kenya configuration into the live settings document, and the settings panel's own "reset to defaults" action reintroduces it at any time thereafter as a normal, intended feature. Fixing this one module closes both of those paths at once.
3. **Decide the enum's real scope.** Either this product genuinely intends to support multiple African markets plus India (in which case the enums are fine as-is and only the *defaults* need fixing), or India is the only real target and the Kenya/Uganda/Tanzania/Nigeria options are themselves leftover scaffolding worth removing for clarity. This is a product decision, not a code-quality one — flagging it as a question rather than assuming the answer.
4. ~~**Verify `billing.service.ts`'s currency handling** as a priority follow-up~~ — **done**: confirmed, and a second identical instance was found in `inpatient-admissions` while reviewing that module. Both are wrong on every invocation, not just on a fallback path, and should be fixed first given they're user-facing in live financial flows. Fix: read `currencySymbol` from settings in both error messages instead of the literal `'KES'`. Worth a final repo-wide grep for the same `` `KES ${...}` `` string-interpolation shape before considering this fully closed, now that it's shown up twice in unrelated modules.
5. **Once the backend defaults are fixed**, do a pass over the ~40 frontend files the grep sweep surfaced to confirm they're genuinely just mirroring the (to-be-fixed) backend enum and don't have their own independent hardcoded Kenya-specific defaults.
