# Module Review: `laboratory` & `imaging`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/laboratory/*` (439 lines) and `apps/api/src/modules/imaging/*` (606 lines) — the result/report-entry modules for lab and imaging clinical orders (the orders themselves are placed and owned by `opd-clinical-order`, already reviewed as part of `opd`). Reviewed together given their near-identical shape. Static code review.
**Live load testing: not executed** — real clinical result data; see §7.

---

## 1. Executive summary

Both modules are clean, well-structured mirrors of each other — explicit status-transition tables, transactional multi-step operations, and correctly atomic verify-once guards. The one new structural finding (an orphaned-upload edge case in imaging attachments) is minor. The significant finding here isn't new code — it's that this review traced the **already-documented, already-critical access-control bug from the `opd` review directly to three real, directly-callable `imaging` endpoints**, and confirmed the exact conditions under which it's exploitable are narrower — but still real — than a first read might suggest.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 0 (1 already tracked, reach now fully mapped) | `opd`'s `authorizeDentalImagingReport` bypass (already documented) is the actual authorization gate for 3 of `imaging`'s own endpoints — view report, upload attachment, download attachment |
| 🟡 Medium | 0 | — |
| 🟢 Low | 2 | `imaging`'s attachment upload can leave an orphaned blob in storage if uploaded before any report exists and never followed up; `laboratory_results`/`imaging_reports` have no index covering `deletedAt` |

---

## 2. What's correct (keep doing this)

- **Both modules use the same explicit status-transition table pattern** already praised in `opd`/`emergency`/`doctors` (`transitions: Partial<Record<...>>` maps), applied consistently to the lab/imaging order lifecycle (`SUBMITTED → RECEIVED → (SAMPLE_COLLECTED →) IN_PROGRESS → RESULT_ENTERED/REPORT_ENTERED → VERIFIED → COMPLETED`).
- **Verification is correctly atomic and can't be double-applied**: both `verifyResult` (`laboratory.repository.ts:91-98`) and `verifyReport` (`imaging.repository.ts:135-142`) fold `verifiedAt: null` directly into the `findOneAndUpdate` filter, so a result/report can't be verified twice even under concurrent requests — consistent with the atomic-update discipline already praised repeatedly in this series.
- **Laboratory results are cross-validated against the actual order**: `validateAndNormalizeResults` (`laboratory.service.ts:138-149`) rejects a result submission that doesn't contain exactly one entry per ordered service, and re-confirms the referenced services still exist and are active before saving — preventing both incomplete results and results referencing a service that was deleted after the order was placed.
- **Completed orders are correctly read-only on both sides** (`assertMutable` in both services), preventing any further edits once an order has reached its terminal state.
- **The dual-permission-path pattern in both route files** (standalone `Imaging/Orders/View` **or** `OPD/OPD Clinical Orders/View` *plus* a dental-context check) is a deliberate, reasonable design — it lets a doctor who only holds general OPD permissions (not a standalone Imaging/Laboratory department permission) still view results tied to their own patients' dental care, rather than requiring every doctor to be separately provisioned with lab/imaging department access. The *intent* here is sound; §3.1 is about the implementation of the check it delegates to, not this pattern itself.

---

## 3. Findings

### 3.1 🔴 CRITICAL (already tracked in the `opd` review; reach now fully confirmed) — The dental-imaging authorization bypass gates three real `imaging` endpoints

**Where:** `imaging.routes.ts:35-46, 47-66, 67-85`, all three calling `services.opdClinicalOrders.authorizeDentalImagingReport(id, request.user!.id)`; `laboratory.routes.ts:35-46` calling the (correctly-implemented) `authorizeDentalLaboratoryResult` equivalent.

The `opd` module review documented a confirmed bug in `authorizeDentalImagingReport` (`opd-clinical-order.service.ts:145-166`): a `try/catch` around the real department/doctor-scope check silently swallows *any* error — including a legitimate `403` denial — and falls through to a check that only inspects the order's own `dental_context.treatment_episode_id`, with no verification of the calling user at all. That review flagged it as the top-priority fix in this entire series. This review traced exactly where that method is actually invoked, and the answer is: **three of `imaging`'s own endpoints**, not a rarely-exercised internal helper:

- `GET /api/imaging/orders/:id/report` — view an imaging report
- `POST /api/imaging/orders/:id/attachments` — upload an attachment to an order
- `GET /api/imaging/orders/:id/attachments/:attachmentId/download` — download an attachment

All three follow the same shape: if the caller lacks the standalone `Imaging/Orders/*` permission but holds the general `OPD/OPD Clinical Orders/*` permission, the route calls `authorizeDentalImagingReport` as the gate that's supposed to confirm the order is actually a dental-context order the caller has legitimate standing to see — and that gate is the one with the swallowed-exception bug.

**Reachability, precisely scoped** (refining, not contradicting, the `opd` review's finding): tracing the actual seeded role permissions (`database/seed.ts`, reviewed in the `auth-rbac` review), the `DOCTOR` role has `OPD/OPD Clinical Orders/View` and `/Edit` but **no** standalone `Imaging/Orders/*` permissions at all. That means **any doctor hitting these three routes for *any* imaging order — not just a dental one — goes through this exact fallback path as a matter of normal, everyday operation**, not a rare edge case. For a **non-dental** order, the bug's fallback (`order.dental_context?.treatment_episode_id`) is simply absent/falsy, so the function correctly falls through to its final `404`, denying access as intended — the bug doesn't put non-dental orders at risk. For a **dental** order with a `visit_id` set, the bug *is* live: a doctor outside the legitimate department/doctor scope for that specific visit, who should be correctly denied by the real check, instead gets the exception swallowed and is authorized via the unscoped episode check.

**Net effect of tracing this**: the bug's exploitable surface is real and continuously exercised (every doctor's every imaging-report view goes through the vulnerable code path), but the actual unauthorized-access outcome only occurs for dental-context orders specifically — slightly narrower than "any imaging report," but broader in terms of how often the vulnerable code actually runs. Both facts matter for prioritizing the fix, which is why they're both recorded here rather than assuming either extreme.

**No new fix needed beyond what's already tracked** — this entry exists to correct the record on *scope*, not to open a new finding. The fix in the `opd` review (restructure `authorizeDentalImagingReport` so the episode fallback is only attempted when `order.visit_id` is absent, never as a catch-all for a failed visit-scoped check) resolves all three routes identified here simultaneously, since they all call the same underlying method.

### 3.2 🟢 LOW — Imaging attachment uploads before a report exists can leave an orphaned blob

**Where:** `imaging.service.ts:121-147` (`uploadAttachment`)

```ts
const { storageKey } = await this.storageService.uploadPatientDocument({...});
const attachmentDTO = { file_name: ..., storage_key: storageKey, ... };
const existingReport = await this.repository.getReport(orderId);
if (existingReport) {
  await this.repository.addAttachmentToReport(orderId, attachmentDTO, actorUserId);
}
return attachmentDTO;
```

If no report exists yet for the order (a plausible sequence — a tech might attach the captured image before writing up findings), the file is uploaded to blob storage and the metadata is returned to the caller, but **nothing is persisted to the database** — there's no report document yet to attach it to, and no staging/pending-attachment collection either. The uploaded blob's survival from this point depends entirely on the client resubmitting the same attachment metadata when the report is eventually created (if `SaveImagingReportDTO.attachments` supports that) — if the user instead navigates away, the upload silently becomes an orphaned file with no database record pointing to it and no cleanup mechanism.

**Why this is Low, not higher:** it's a storage-cost/hygiene issue, not a data-integrity or security problem — no patient ever sees a broken reference, and no clinical data is lost (the metadata needed to find the orphan, if it were ever audited, is at least known at upload time even if not persisted). Compare to the `patients` module's document-upload flow, which explicitly handles the equivalent failure mode with compensating cleanup — this module doesn't have the equivalent safety net for its own different failure mode (here it's "nothing ever gets linked," not "the link failed after upload").

**Recommended fix:** either require a report to exist before accepting an attachment upload (simplest — reorder the workflow so findings are entered first), or persist a pending-attachment record immediately on upload regardless of whether a report exists yet, so nothing is ever held only in blob storage with zero database trace.

### 3.3 🟢 LOW — `laboratory_results`/`imaging_reports` have no index covering `deletedAt`

**Where:** `laboratory-result.model.ts:64-67`, `imaging-report.model.ts:84-88`

Same recurring pattern noted across this series, here on two collections that are naturally bounded by order volume (one result/report per order, and the lookup is always by the unique `orderId` anyway) — so the real-world impact is close to negligible; flagged only for completeness and consistency with the rest of this series' index audits, not as a prioritized item.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Result items match ordered services exactly | ✅ | `validateAndNormalizeResults` | None |
| Referenced service still active | ✅ | Same | None |
| Result/report entry only allowed in the right order status | ✅ | Both services' explicit status checks | None |
| Double-verification | ✅ DB-enforced | Atomic `verifiedAt: null` filter | None |
| Edits to a completed order | ✅ blocked | `assertMutable` | None |
| Edits to an already-verified result/report | ✅ blocked | Status check (`RESULT_ENTERED`/`REPORT_ENTERED` required) | None |
| Dental-context access scoping for non-standalone-permission users | ⚠️ broken for dental orders specifically | `authorizeDentalImagingReport` | §3.1 (tracked in `opd`) |
| Attachment upload before a report exists | ⚠️ no cleanup path | `uploadAttachment` | §3.2 |

---

## 5. MongoDB index audit

**`laboratory_results`** — unique `{orderId}`, `{patientId,createdAt}`, `{visitId,createdAt}`, `{createdAt}`. Missing `deletedAt` coverage (§3.3), low real-world impact given collection shape.

**`imaging_reports`** — unique `{orderId}`, `{patientId,createdAt}`, `{visitId,createdAt}`, `{createdAt}`, sparse `{'dentalContext.treatmentEpisodeId'}`. Same minor gap as laboratory.

No other index findings — both collections' real query patterns (lookup by `orderId`, list by patient/visit) are well served.

---

## 6. API performance & round-trip analysis

| Operation | Sequential round trips | Notes |
|---|---|---|
| `POST /laboratory/orders/:id/results` (enter result) | ~6 inside one transaction (order fetch, service-catalogue validation, duplicate-result check, create, status transition, audit) | Reasonable |
| `PATCH /laboratory/orders/:id/status` → `VERIFIED` | ~5 (order fetch, result fetch, atomic verify, status transition, audit) | Reasonable |
| `GET /imaging/orders/:id/report` (dental fallback path) | +1-2 extra round trips when the dental-context fallback is exercised (`getOperationalById` again inside `authorizeDentalImagingReport`'s `getVisit` call) | Minor; not the primary concern with this path (§3.1 is) |

Nothing here stands out as an avoidable inefficiency beyond what's already noted.

---

## 7. Load testing (p65/p90) — status

**Not executed.** Real clinical result/report data. No module-specific concurrency concerns were found worth a targeted synthetic test here (unlike `advance-payment` or `pharmacy-dispensing`) — the one significant finding in this pair (§3.1) is an authorization-logic bug, not a race condition, and is better verified with a targeted functional test (log in as a doctor without standalone Imaging permission, attempt to view a dental vs. non-dental imaging report, confirm the current buggy behavior and the fix) than a load test.

---

## 8. Scalability & dynamic-approach recommendations

- **Fixing `authorizeDentalImagingReport` (§3.1) is now confirmed to be worth prioritizing not just for correctness but for *exposure frequency*** — since every doctor's every imaging-report view already runs through the vulnerable code path as normal operation (not an edge case), the fix benefits from being deployed sooner rather than later purely on frequency-of-exposure grounds, independent of the per-instance severity.
- **The dual-permission-path pattern itself (standalone department permission OR general OPD permission + context check) is worth formalizing as a named, reusable pattern** if it's going to keep showing up — right now it's hand-rolled identically in both `imaging.routes.ts` and `laboratory.routes.ts` (and conceptually in other dental-adjacent access checks). A small shared helper (`requirePermissionOrContextualAccess(...)`) would reduce the chance of exactly this kind of copy-pasted bug recurring a third time in a different module.
- **The orphaned-attachment edge case (§3.2) is worth fixing before imaging volume grows** — it's cheap to close now (reorder the workflow or persist a pending record) and only becomes a real storage-cost concern at scale, not before.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] No new fix required for §3.1 beyond what's already tracked in the `opd` review's checklist — this entry is a scope confirmation, cross-referenced here because the actual vulnerable surface lives in `imaging`'s own routes.
- [ ] Fix the orphaned-attachment-on-upload edge case in `imaging.uploadAttachment` (§3.2).
- [ ] Fold `deletedAt` into the existing indexes on both collections, low priority (§3.3).
- [ ] Consider extracting the dual-permission-path check (standalone permission OR general-permission-plus-context-check) into a shared, named helper to reduce the risk of this exact bug class recurring (§8).

---

## 10. Verdict

**Not production-ready, for the same reason the `opd` review already flagged** — this review doesn't add a new critical finding, it confirms and sharpens the existing one by showing it's not a theoretical risk sitting in a rarely-called helper, but the literal authorization gate for three real endpoints that get exercised by every doctor's normal use of the imaging module. Everything else in both modules is solid, consistent, well-structured work — this module pair would otherwise be a clean pass.
