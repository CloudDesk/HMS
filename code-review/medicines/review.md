# Module Review: `medicines`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/medicines/*` (551 lines) — medicine master-data CRUD, referenced by `pharmacy-inventory`/`pharmacy-dispensing`. Static code review.
**Live load testing: not executed** — low-volume master-data module; see §7.

---

## 1. Executive summary

A clean, unremarkable master-data module that gets the details other similar modules in this series got wrong. No new findings of real significance — this review mostly confirms correct, cross-module-aware referential-integrity checks and correct indexing, and cross-references two already-documented, low-severity patterns rather than re-deriving them.

| Severity | Count | Theme |
|---|---|---|
| 🟢 Low | 1 (inherited pattern, not re-derived) | Case-insensitive regex code lookup bypasses the `code` unique index — same pattern as `branches`/`departments`/`roles`, same low real-world severity given data volume |

---

## 2. What's correct (keep doing this)

- **`medicine.model.ts`'s index correctly includes `deletedAt`** (`{deletedAt,status,createdAt}`), matching `list()`'s actual filter exactly — getting right what `patients`/`opd_visits`/`appointments`/`billing_invoices` all got wrong, consistent with the better-indexed modules in this series (`doctors`, `admissions-configuration`).
- **Deactivation is correctly blocked while pharmacy stock remains on hand** (`medicine.service.ts:76-84`: cross-checks `pharmacyInventoryRepository.hasPositiveStock`) — a real, cross-module-aware business rule, not just a local check.
- **Deletion is correctly blocked once any inventory history exists** (`:112-120`: `hasInventoryReferences`) — this is the correctly-implemented version of the dependency check that `branches`' equivalent got wrong (wrong field name) and `opd`'s "one active visit" check never got at all. This module does it right: a real cross-module check before allowing a destructive action.
- **Audit logging is applied consistently** across create/update/status-change/delete/export, matching the house convention.

---

## 3. Findings

### 3.1 🟢 LOW (inherited pattern) — Case-insensitive regex code lookup bypasses the unique index

**Where:** `medicine.repository.ts:107-112` (`getByCode`)

Same pattern already documented in detail in the `branches`, `departments`, and `roles` reviews: a case-insensitive anchored regex query against a field with a plain (non-collation) unique index, used for the create/update duplicate-code pre-check. Same low real-world severity given realistic medicine-catalogue sizes, same TOCTOU characteristics, same recommended fix (collation-based index). Not re-derived here in full — see the `branches` review §3.3/§3.4 for the complete writeup and fix.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Duplicate code on create/update | ⚠️ app-level, same TOCTOU as elsewhere | `getByCode` pre-check | §3.1 (inherited) |
| Deactivation with stock on hand | ✅ | `update()` | None |
| Deletion with inventory history | ✅ | `delete()` | None |

---

## 5. MongoDB index audit

**`medicines`** — `{name}`, `{genericName}`, `{dosageForm}`, `{deletedAt,status,createdAt}`. The three single-field indexes have the same limited value against regex-based search already noted for similar fields elsewhere (`branches`' `name`/`phone`/`email`), but the `deletedAt`-inclusive compound index is correct and well-matched to the real query shape.

---

## 6-7. API performance / Load testing

No notable round-trip or performance concerns found. Not executed for the same low-volume, low-priority reasoning as `consents`/`health`.

---

## 8. Scalability & dynamic-approach recommendations

- **No module-specific recommendation beyond the already-tracked, cross-module collation-index fix (§3.1)** — this module doesn't need anything bespoke; it needs the same shared fix every other affected module needs.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Apply the collation-index fix to `medicines.code` once it's implemented as the shared fix for `branches`/`departments`/`roles` (§3.1) — no separate design work needed here.

---

## 10. Verdict

**Production-ready.** The cleanest kind of module to review in this series: it follows the house conventions correctly, including the ones several earlier-reviewed modules got wrong.
