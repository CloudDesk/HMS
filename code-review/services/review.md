# Module Review: `services`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/services/*` (808 lines) — the service catalogue (consultations, lab tests, imaging services, procedures), referenced directly by `billing`, `opd-clinical-order`, `surgery`, `laboratory`, and `imaging`. Static code review.
**Live load testing: not executed** — low-volume master-data module; see §7.

---

## 1. Executive summary

A generally well-built master-data module — good upfront validation of procedure-specific configuration (duration, capacity, deposit requirements, enforced before a procedure service can even be saved), consistent with what `surgery`'s booking logic later assumes is already true. The one real finding is a complete absence of a dependency check before deleting a service, unlike the correctly-implemented equivalent in `medicines` reviewed just before this module.

| Severity | Count | Theme |
|---|---|---|
| 🟡 Medium | 1 | `delete()` has no dependency check at all — a service referenced by active bookings, invoices, or clinical orders can be soft-deleted with no warning |
| 🟢 Low | 1 (inherited pattern) | Case-insensitive regex code lookup bypasses the unique index — same pattern as `branches`/`departments`/`roles`/`medicines` |

---

## 2. What's correct (keep doing this)

- **Procedure-specific configuration is validated at creation/update time, not left to fail later downstream**: `validateProcedureConfiguration` (`service.service.ts:134-142`) requires `default_duration_minutes` and `booking_capacity` for any `PROCEDURE`-type service, and requires `minimum_advance_deposit_amount` whenever `requires_advance_deposit` is set. This is exactly the data `surgery`'s `createBooking`/`confirmBooking` (reviewed earlier) assumes is present (`refs.service.defaultDurationMinutes`, `refs.service.bookingCapacity`) — catching a missing/incomplete procedure configuration here, at data-entry time, instead of surfacing as a confusing `PROCEDURE_SERVICE_CONFIGURATION_INVALID` error deep inside a booking transaction later.
- **The model's indexes correctly include `deletedAt`**, and in three different compound shapes matching three different real query patterns (`{deletedAt,status,createdAt}`, `{deletedAt,status,departmentId,name}`, `{deletedAt,serviceType,status,departmentId,createdAt}`) — this is some of the most query-shape-aware indexing in the entire review series, alongside `departments` and `doctors`.
- **Department assignment is validated against an active department** before create/update (`requireActiveDepartment`), consistent with the equivalent checks already praised in `departments`/`doctors`.

---

## 3. Findings

### 3.1 🟡 MEDIUM — `delete()` has no dependency check at all

**Where:** `service.service.ts:84-92`

```ts
async delete(id: string, userId: string, metadata: ServiceRequestMetadata) {
  const service = await this.getById(id);
  await this.repository.softDelete(service.id, userId);   // <- no check of any kind beforehand
  await this.repository.audit('service.deleted', userId, metadata, {...});
}
```

Compare this to `medicines.delete()` (reviewed just before this module), which correctly blocks deletion if any pharmacy inventory history references the medicine — `services.delete()` has no equivalent check at all, not even an incomplete one (unlike `branches`, whose dependency check exists but has a bug). A service can be actively referenced by `billing_invoice_items.serviceId`, `surgery`'s procedure recommendations/bookings, and in-flight clinical orders (`opd-clinical-order`, `laboratory`, `imaging`) — none of that is checked before soft-deleting it.

**Why this matters, concretely:** historical records referencing the service mostly won't break outright, since several of them (billing line items, in particular) snapshot the service name alongside the ID rather than resolving it live. But **in-flight workflows that resolve the service live** are a real risk — `surgery`'s `bookingReferences`/`validateSchedule` (reviewed earlier) fetch the service fresh on every booking creation, confirmation, and reschedule; if a service is soft-deleted while a `PENDING_CONFIRMATION` procedure booking still references it, that booking's confirmation step could start failing with a confusing "service configuration invalid"-style error rather than a clear "this service was removed" message, or could simply be unconfirmable with no clean path forward.

**Why Medium, not High:** deleting a service is a rare, deliberate admin action against a small, slow-changing catalogue — not a hot path, and most historical data survives the deletion fine. But it's a real, easy-to-trigger gap with no check at all standing between an admin and breaking an in-flight clinical/financial workflow.

**Recommended fix:** add the equivalent of `medicines`' dependency check — at minimum, block deletion if any non-terminal `ProcedureRecommendation`/`ProcedureBooking` references the service (the two collections with the most acute "live resolution" risk per the analysis above); ideally also check for any unresolved clinical orders referencing it, following the same pattern already correctly implemented in `medicines.delete()`.

### 3.2 🟢 LOW (inherited pattern) — Case-insensitive regex code lookup bypasses the unique index

Same pattern documented in detail in the `branches`/`departments`/`roles`/`medicines` reviews — `getByCode`'s case-insensitive anchored regex against a plain unique index. Not re-derived here; same low severity given catalogue size, same shared fix recommendation.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Procedure services have duration + capacity | ✅ | `validateProcedureConfiguration` | None |
| Advance-deposit services have a minimum amount | ✅ | Same | None |
| Department assignment is active | ✅ | `requireActiveDepartment` | None |
| Duplicate code on create/update | ⚠️ app-level, same TOCTOU as elsewhere | `getByCode` pre-check | §3.2 (inherited) |
| Deletion with live references | ❌ | `delete()` | §3.1 |

---

## 5. MongoDB index audit

**`services`** — `{name}`, `{departmentId}`, and three well-matched `deletedAt`-inclusive compound indexes (§2). No gaps found relative to the query code reviewed.

---

## 6-7. API performance / Load testing

No notable round-trip concerns. Not load-tested for the same low-volume, low-priority reasoning as the other small master-data modules in this batch (`consents`, `medicines`, `health`).

---

## 8. Scalability & dynamic-approach recommendations

- **Add the dependency check in §3.1 using `medicines.delete()` as the direct template** — this module already has the right neighbor to copy from in the same codebase, no new design needed.
- **No other scalability-specific recommendation** — this module's indexing is already a good example for others to follow, not the other way around.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Add a dependency check to `delete()` covering at minimum `ProcedureRecommendation`/`ProcedureBooking` references, following `medicines.delete()`'s pattern (§3.1).
- [ ] Apply the shared collation-index fix to `services.code` once implemented elsewhere (§3.2) — no separate work needed here.

---

## 10. Verdict

**Close to production-ready.** Strong indexing and good upfront data-consistency validation; the one real gap (unchecked delete) is a clear, bounded fix with an exact template already sitting in the same codebase.
