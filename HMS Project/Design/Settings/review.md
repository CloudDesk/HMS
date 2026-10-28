# Module Review: `settings`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/settings/*` (`settings.model.ts`, `settings.repository.ts`, `settings.service.ts`, `settings.routes.ts`, `settings.schemas.ts`, `settings.types.ts`, `settings.defaults.ts`, `settings.logo-storage.ts`). Static code review.
**This review is the root-cause source for the cross-cutting finding first surfaced in the `doctors` review** ([`code-review/_infrastructure/market-localization-mismatch.md`](../_infrastructure/market-localization-mismatch.md)). That document is now updated to point here as the authoritative, fully-traced writeup rather than duplicating the detail in both places.
**Live load testing: not executed** — low query volume, low concurrency module; see §7.

---

## 1. Executive summary

This module is where the Kenya/India mismatch actually lives, and tracing it fully here changes its shape from "a few hardcoded fallback strings" to something more serious: **the Kenya configuration isn't just a fallback value used when something goes wrong — it's the value that gets permanently written into the real database on first use, and the value an admin gets back if they ever use the settings panel's own "reset to defaults" feature.** Beyond the localization issue, the module itself is reasonably well-built — properly RBAC-gated, audit-logged on every mutation, and with correct compensating cleanup for logo file uploads.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 2 | A fresh deployment's first settings read **persists** "Nairobi General Hospital / Kenya / KES" into the real database, not just an in-memory default; the settings panel's "reset to defaults" feature reintroduces the same Kenya data as an intentional, reachable admin action |
| 🟠 High | 1 | Localization fields (`country`/`timezone`/`currency`) have zero cross-field consistency validation — the system will happily save `country: India` with `timezone: Africa/Nairobi` and `currency: KES` with no warning |
| 🟡 Medium | 1 | Several runtime settings getters silently swallow every error and fall back to defaults or `null`, with no logging — a generic resilience/observability gap, separate from (but what makes reachable) the content problem above |
| 🟢 Low | 1 | Audit-log actor search silently truncates at 100 matching users with no indication results may be incomplete |

---

## 2. What's correct (keep doing this)

- **Every settings mutation is audit-logged**, consistently, including logo upload/delete and section resets (`settings.service.ts` — `settings.general.updated`, `settings.hospital.updated`, `settings.localization.updated`, `settings.hospital.logo_updated`, `settings.{section}.reset`, etc.) — a complete, specific audit trail for exactly the kind of configuration changes that matter most to have a paper trail for.
- **All mutating endpoints require `Administration/Settings/Edit`**, and view/export endpoints require their own specific permissions (`settings.routes.ts`) — correctly scoped RBAC, consistent with the rest of the system.
- **Logo upload has real validation and correct compensating cleanup**: empty-file and 2MB size checks before upload (`settings.service.ts:159-165`), and on a DB-write failure after a successful blob upload, the orphaned blob is explicitly deleted (`:184-187`) — the same good upload-then-persist-then-cleanup-on-failure pattern already praised in the `patients` module review, applied correctly here too.
- **`get()`'s upsert-on-read avoids an entire class of "settings document doesn't exist" crash** by using an idempotent `findOneAndUpdate` with `$setOnInsert` (`settings.repository.ts:105-113`) rather than requiring a separate provisioning step — this is a reasonable design choice in isolation; the problem isn't the mechanism, it's *what* gets inserted (§3.1).
- **Audit log actor resolution uses the same batched-lookup pattern** already established as a house convention elsewhere in this series (`settings.repository.ts:184-190`: one `$in` query for all actor names on a page, not one per row).

---

## 3. Findings

### 3.1 🔴 CRITICAL — A fresh deployment's first settings read permanently persists Kenya configuration into the real database

**Where:** `settings.repository.ts:105-113`

```ts
async get(): Promise<SystemSettings> {
  const settings = await SystemSettingsModel.findOneAndUpdate(
    { key: 'system' },
    { $setOnInsert: { key: 'system', ...defaultSystemSettings } },
    { upsert: true, returnDocument: 'after', lean: true },
  );
  return toSettings(settings as unknown as SettingsRecord);
}
```

`defaultSystemSettings` (`settings.defaults.ts:48-53`) bundles `defaultHospitalSettings` and `defaultLocalizationSettings`, which are:

```ts
export const defaultHospitalSettings: HospitalSettings = {
  hospitalName: 'Nairobi General Hospital',
  phone: '+254700100200',                          // Kenya country code
  email: 'info@nairobigeneral.co.ke',               // Kenya domain
  address: 'Kenyatta Avenue, Nairobi, Kenya',
  ...
};
export const defaultLocalizationSettings: LocalizationSettings = {
  country: 'Kenya', timezone: 'Africa/Nairobi', currency: 'KES', currencySymbol: 'KES', ...
};
```

`get()` is called constantly — every settings read, every `updateSection` call (which calls `get()` first, `:120`), and every one of the `getRuntime*` helpers used by `auth`, `doctors`, `opd`'s dental-stage sub-module, and `users`. **The very first time `get()` is ever called against a fresh database — which happens automatically on normal system use, not as a separate provisioning step — this `$setOnInsert` actually writes "Nairobi General Hospital," Kenya, KES into the real, persisted settings document.** This is categorically different from the fallback-string instances already documented in the cross-cutting finding (`doctor.service.ts:369`'s `'Africa/Nairobi'` literal, `billing.service.ts:468`'s hardcoded `KES`) — those only matter if something goes wrong or hasn't been configured yet; this one writes wrong data into the database as a completely normal, successful, error-free operation.

**Why it matters:** anyone standing up a fresh instance of this system for a real India-based hospital customer needs to know, unprompted, to immediately visit Settings → Hospital and Settings → Localization and manually overwrite every field before anyone else interacts with the system — otherwise the live, persisted configuration silently identifies the deployment as a Kenyan hospital until someone notices and fixes it.

**Recommended fix:** this is the one finding in the cross-cutting issue that can't be fixed by just swapping literal strings — it needs a product decision (see the cross-cutting doc's §"Recommended remediation" point 2): either default to genuinely neutral/placeholder values that make it obvious configuration is required (e.g., `hospitalName: '(Not configured)'`), or — the more robust fix — make first-run configuration mandatory (block normal operation, or at least surface a prominent warning banner) rather than silently seeding *any* single hardcoded country's identity.

### 3.2 🔴 CRITICAL — The settings panel's "reset to defaults" feature reintroduces Kenya data as a normal, intended action

**Where:** `settings.repository.ts:135-144` (`resetSection`), invoked via `settings.service.ts:114-125` (`reset`), exposed at `POST /api/settings/:section/reset` (gated by `Administration/Settings/Edit`)

```ts
async resetSection(section: SettingsSection, actorUserId: string): Promise<SystemSettings> {
  const defaults = { general: defaultGeneralSettings, hospital: defaultHospitalSettings, localization: defaultLocalizationSettings, userPreferences: defaultUserPreferenceSettings };
  return this.updateSection(section, defaults[section], actorUserId);
}
```

This is worse than §3.1 in one specific way: it's not a one-time, first-boot event — it's a feature an administrator can trigger at any time, presumably via a "Reset to Defaults" button in the Settings UI (this reviewed the backend only; the frontend affordance wasn't independently verified, but the endpoint exists and is a normal, permission-gated, intentionally-exposed API). An administrator resetting the **Hospital** or **Localization** section for any legitimate reason (undoing an unrelated typo, say) on an already-correctly-configured India deployment would have their hospital's real name, address, phone, country, timezone, and currency silently overwritten with the Kenya template, with no distinguishing warning at the API layer beyond whatever the frontend might (or might not) show before confirming.

**Why it matters:** this turns the configuration-mismatch problem from "something to fix once during initial deployment" into "a standing operational hazard for the lifetime of the system," since the reset action is always available and always produces the same wrong result.

**Recommended fix:** same root fix as §3.1 (don't hardcode a single country's identity as "the" defaults) — once that's fixed, this finding resolves automatically since `resetSection` just reuses the same `defaultHospitalSettings`/`defaultLocalizationSettings` constants.

### 3.3 🟠 HIGH — No cross-field consistency validation on localization settings

**Where:** `settings.schemas.ts:50-56`, `settings.model.ts:48-58`, `settings.service.ts:93-102` (`updateLocalization`)

`country`, `timezone`, `currency`, and `currencySymbol` are validated entirely independently — each against its own fixed enum, with no relationship enforced between them. The schema and the Mongoose model both allow saving `country: 'India'` together with `timezone: 'Africa/Nairobi'` and `currency: 'KES'` without any error. `updateLocalization` in the service layer does no additional cross-field checking either — it only trims `currencySymbol`.

**Why it matters:** these four fields are logically coupled in any real deployment — a hospital's country strongly implies a sensible timezone and currency — but the system treats them as four independent dropdown selections. This matters most as the *fix* for §3.1/§3.2: an administrator attempting to manually correct the Kenya defaults might update `country` to `India` and `currency` to `INR`, but forget `timezone` (or vice versa), and the system would silently accept the inconsistent result with no warning that something doesn't match.

**Recommended fix:** add a service-layer consistency check in `updateLocalization` (and ideally `resetSection`, once its defaults are fixed) that rejects combinations where `country`/`timezone`/`currency` don't correspond to each other — a simple lookup table mapping each `country` enum value to its expected `timezone`/`currency` would suffice given the enum is already small and closed.

### 3.4 🟡 MEDIUM — Multiple runtime settings getters silently swallow every error

**Where:** `settings.service.ts:31-53` (`getRuntimeHospitalSettings`, `getRuntimeUserPreferences`, `getRuntimeFirstDayOfWeek`)

```ts
async getRuntimeUserPreferences() {
  try {
    return (await this.repository.get()).userPreferences;
  } catch {
    return null;
  }
}
```

All three of these bare `catch { return ... }` blocks discard the actual error entirely — no logging, no metric, nothing. This is the same category of issue already flagged in the `branches`/`opd` reviews (errors silently swallowed rather than surfaced), but it's worth calling out specifically here because of what it feeds: `getRuntimeUserPreferences()` backs the configurable account-lockout threshold used by `auth.service.ts`'s login flow (reviewed in the `auth-rbac` review) — if this silently returns `null` due to a transient DB issue rather than a genuinely missing config, login's lockout behavior silently reverts to the env-var default instead of the admin-configured value, with no indication anywhere that this happened.

**Why this is Medium, not tied to the Kenya content issue specifically:** unlike §3.1/§3.2, a `null`/default fallback here degrades to a generically reasonable value (the env-var default), not wrong country-specific data — so the risk is about silent resilience/observability, not incorrect content. Still worth fixing on its own merits.

**Recommended fix:** log the caught error (at minimum `request.log.warn` with the error attached) before returning the fallback value, so a persistent settings-read failure is visible in logs rather than indistinguishable from "nobody configured this yet."

### 3.5 🟢 LOW — Audit-log actor search silently truncates at 100 matches

**Where:** `settings.repository.ts:155-160`

```ts
const matchingUsers = await UserModel.find({ $or: [...searchRegex...] }).select('_id').limit(100).lean();
```

If a search term matches more than 100 users (plausible for a common name fragment in a large staff directory), only the first 100 (in whatever the default `find()` order happens to be — no explicit sort) are used to filter audit log results by actor, with no indication to the caller that matches might be incomplete. Low real-world impact given typical staff directory sizes and that this is an admin-facing search feature, not a hot path — flagged for completeness.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Hospital logo file size/emptiness | ✅ | `uploadHospitalLogo` | None |
| Section-specific field enums (date format, currency, etc.) | ✅ | Fastify schema + Mongoose enum (defense in depth) | None |
| Cross-field localization consistency | ❌ | — | §3.3 |
| Settings document existence on first read | ✅ handled, but with wrong content | `get()`'s upsert | §3.1 |
| Orphaned logo blob on failed settings write | ✅ | `uploadHospitalLogo`'s catch-and-cleanup | None |
| RBAC on all mutating endpoints | ✅ | `requirePermission` on every PATCH/POST/DELETE route | None |

---

## 5. MongoDB index audit

**`system_settings`** — single document collection (`key: 'system'`, unique), no list/query performance concerns — this is a singleton configuration document, not a growing collection, so there's nothing to index-tune here. No findings.

**`audit_logs`** (queried by this module, owned by `auth`) — indexes already reviewed in the `auth-rbac` review (`{createdAt:-1}`, `{eventType,createdAt:-1}`, `{metadataJson.roleId,createdAt:-1}`); the query shape used here (`eventType` prefix pattern + optional `actorUserId $in`) is reasonably well-served by the existing `{eventType,createdAt}` index for the action-filtered case, less so for the free-text `search` case (which also hits the regex-bypasses-index pattern noted repeatedly in this series, here on `eventType` — low severity given this is a low-volume admin search, not a hot path).

---

## 6. API performance & round-trip analysis

This module has no performance-critical paths — it's a low-frequency, admin-facing configuration surface, not a hot clinical/transactional path. `get()`'s one round trip per call (no caching) is called frequently *by other modules* (auth, doctors, opd, users) rather than by this module's own endpoints being hit often — meaning the real performance question here isn't "is `settings`'s own API fast enough" but "how many times does the rest of the system call `settings.get()` redundantly," which is really a question for the shared auth/permission caching discussion already raised in the `branches` and `auth-rbac` reviews (a settings cache would compose naturally with any permission/session caching layer built for that finding).

---

## 7. Load testing (p65/p90) — status

**Not executed, and not a priority for this module.** Settings reads/writes are low-volume, low-concurrency, admin-only operations — the module's actual system-wide performance relevance is indirect (how often other modules call `settings.get()` without caching), which is better addressed as part of the cross-module caching work already flagged in the `branches`/`auth-rbac` reviews than as a `settings`-specific load test.

---

## 8. Scalability & dynamic-approach recommendations

- **This is the module where "dynamic" literally means something different from every other module in this series**: elsewhere, "dynamic and scalable" has meant handling more data/more concurrency gracefully. Here, it means the system's *own identity* (hospital name, country, currency, timezone) needs to be genuinely configurable per-deployment rather than hardcoded to one country's defaults — which is precisely what §3.1/§3.2 get wrong. Fixing this module is the literal, direct answer to "make this system dynamic across markets," not just a performance concern.
- **Add the country→timezone→currency consistency table (§3.3) as a small, explicit, data-driven mapping**, not inline conditional logic — this keeps it trivial to extend if the system is ever deployed to a new market, which is exactly the kind of forward-looking design this system's own history (originally Kenya, later adapted for India by appending enum values) suggests is a real, recurring need, not a one-time fix.
- **Consider whether `settings.get()` should be cached at all** — it's read extremely frequently by other modules relative to how rarely it changes (an admin edits settings occasionally; dozens of other requests read them constantly). A short-TTL cache here, invalidated on write, would reduce load across every module that depends on settings, composing naturally with the broader auth/permission caching work already recommended elsewhere in this series.
- **Treat this module as the place to resolve the open product question from the cross-cutting finding**: is this product deliberately multi-market (Kenya/Uganda/Tanzania/Nigeria *and* India), or is India the only real target with the East African options being leftover scaffolding? That answer determines whether §3.3's consistency table should cover all six markets or whether the enums themselves should be trimmed first. Either way, deciding this explicitly — rather than leaving it as an accident of incremental enum additions — is the actual scalability decision this module needs.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] **Replace the hardcoded Kenya defaults in `settings.defaults.ts`** with either neutral placeholder values or a mandatory first-run configuration flow (§3.1, §3.2) — this is the root-cause fix for the entire cross-cutting localization finding, superseding the narrower per-literal fixes already tracked in the `doctors`/`billing` reviews.
- [ ] Add cross-field consistency validation for `country`/`timezone`/`currency` in `updateLocalization` (§3.3).
- [ ] Add logging to the three silently-swallowing `getRuntime*` catch blocks (§3.4).
- [ ] Either paginate/warn on the audit-log actor search truncation, or accept it as a known, low-impact limitation (§3.5).
- [ ] Get the product decision referenced in §8 (deliberately multi-market vs. India-only) and resolve the enum scope accordingly.
- [ ] Once the defaults are fixed here, close out the corresponding tracked items in the `doctors` and `billing` reviews' checklists — they're downstream consequences of this module's root cause.

---

## 10. Verdict

**This is where the cross-cutting finding actually lives, and fixing it here is the fix** — everything flagged in `doctors` and `billing` is a symptom; `settings.defaults.ts` and `resetSection` are the cause. The module's own engineering (RBAC, audit logging, upload safety) is solid, which is exactly why this is worth framing clearly: this isn't a case of sloppy code, it's a specific, identifiable product decision (what should a fresh deployment default to) that was made once, for one market, and never revisited as the product's target market changed. That's a straightforward, bounded fix once someone decides what the right defaults — or the right absence of defaults — should be.
