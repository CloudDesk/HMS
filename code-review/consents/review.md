# Module Review: `consents`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/consents/*` (707 lines) — consent template definition, versioning, and publishing; consulted by `patients`, `opd`'s dental-quotation flow, `inpatient-admissions`, and `surgery` for mandatory-consent gating. Static code review.
**Live load testing: not executed** — low-volume admin module; see §7.

---

## 1. Executive summary

A small, generally well-designed module — immutable published templates, explicit version-bumping, and a clean `assertMandatoryConsent` gate reused correctly by every clinical module that needs to block an action on missing consent. The one real finding is a non-transactional, three-step `publish()` operation that can produce two simultaneously "ACTIVE" versions of the same consent template code under concurrent publishing — a genuine data-integrity gap, though a low-frequency one given how rarely consent templates are actually published.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 0 | — |
| 🟡 Medium | 1 | `publish()`'s three-step retire-then-activate sequence isn't transactional and has no unique constraint backing "at most one active version per code," so concurrent publishes can leave two versions simultaneously active |
| 🟢 Low | 1 | `list()` has no pagination — acceptable today given template volumes, worth watching |

---

## 2. What's correct (keep doing this)

- **Published templates are correctly immutable**: `update()` blocks changing `form_definition` on an already-`ACTIVE` template that's being saved as `ACTIVE` again (`consent.service.ts:101-107`), and `saveFormDefinition()` separately blocks any form-definition edit once a template is `ACTIVE` (`:126-132`) — the only way to change a published template's structure is the explicit `createNextVersion` flow, which is the right way to preserve a stable, already-in-use consent form's history.
- **The code itself is immutable across updates** (`:96-98`) — prevents accidentally repurposing one template's identity into an unrelated one.
- **`assertMandatoryConsent` is a clean, reusable gate** (`consent.service.ts:58-70`) that every clinical module needing a consent check (confirmed via this review series: `inpatient-admissions`, `surgery`) can call without duplicating the "which templates are mandatory and unsatisfied" logic themselves.
- **Branch-scoped access control is applied consistently** across every method via the shared `authorize()` helper, matching the pattern used correctly throughout this review series.

---

## 3. Findings

### 3.1 🟡 MEDIUM — `publish()` is a non-transactional, three-step sequence with no uniqueness guarantee on "one active version per code"

**Where:** `consent.repository.ts:116-140`

```ts
async publish(id: string, branchId: string, actor: string) {
  const existing = await ConsentTemplateModel.findOne({ _id: oid(id), branchId: oid(branchId) }).lean();
  if (!existing) return null;

  // Step 1: retire any other active version of this code
  await ConsentTemplateModel.updateMany(
    { branchId: oid(branchId), code: existing.code, _id: { $ne: existing._id }, status: 'ACTIVE' },
    { $set: { status: 'INACTIVE', updatedBy: oid(actor) } },
  );

  // Step 2: activate this version
  const published = await ConsentTemplateModel.findOneAndUpdate(
    { _id: existing._id },
    { $set: { status: 'ACTIVE', publishedAt: new Date(), publishedBy: oid(actor), updatedBy: oid(actor) } },
    { returnDocument: 'after', lean: true },
  ).lean();
  return published ? toDto(published) : null;
}
```

This is three separate, un-transacted operations (no `session`, no `executeTransaction` wrapper — the only module reviewed so far with a multi-step write this consequential that doesn't use either). There's also no unique index enforcing "at most one `ACTIVE` status per `{branchId, code}`" — the existing unique index is `{branchId,code,version}`, which only prevents duplicate version numbers, not duplicate *active* statuses across different versions.

**Why it matters:** two admins concurrently publishing two different draft versions of the same consent template code (an unusual but entirely possible sequence — e.g., two people independently finishing up a template edit around the same time) can both read the current active version as not-yet-retired, both retire it, and both activate their own version — leaving two different versions simultaneously `ACTIVE` for the same code. Everything downstream that reads "the active version of this template" (`requirements()`, `assertMandatoryConsent`, consumed by `inpatient-admissions`/`surgery`) would then face an ambiguous state with no defined tie-breaking rule.

**Why Medium, not High:** publishing a consent template is a rare, deliberate admin action — nowhere near the request volume of the hot paths where similar races were flagged elsewhere in this series (`advance-payment`, `appointments`). The blast radius if it does happen is real (ambiguous "the" active consent template) but the odds of two people publishing the same code within the same race window are low in realistic usage.

**Recommended fix:** wrap the retire-then-activate sequence in `executeTransaction` (the pattern used correctly everywhere else in this codebase for multi-step writes), and add a partial unique index — `{ branchId: 1, code: 1 }` with `partialFilterExpression: { status: 'ACTIVE' }` — mirroring the exact pattern already used correctly in `admissions-configuration`'s `AdmissionPolicyModel` (`{branchId,status:'ACTIVE'}` unique partial) for the identical "exactly one active X per scope" invariant.

### 3.2 🟢 LOW — `list()` has no pagination

**Where:** `consent.repository.ts:46-54`

Returns every matching template with no `page`/`limit`. Not a problem at realistic consent-template volumes (a hospital likely has dozens, not thousands, of templates across all categories and versions) — flagged only so this doesn't get copy-pasted as a pattern into a module with a larger, growing collection.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| Code immutable on update | ✅ | `update()` | None |
| Form structure immutable once published | ✅ | `update()` + `saveFormDefinition()` | None |
| Publish requires at least one form section | ✅ | `publish()` (service layer) | None |
| Duplicate `{branchId,code,version}` | ✅ DB-enforced | Unique index | None |
| Exactly one active version per code | ❌ | `publish()` | §3.1 |
| Branch access on every operation | ✅ | `authorize()` | None |

---

## 5. MongoDB index audit

**`consent_templates`** — unique `{branchId,code,version}` (correct for its stated purpose), `{branchId,contextType,status}` (supports the `requirements()`/`list()` query shape well). Missing: a partial unique index on `{branchId,code,status:'ACTIVE'}` to close §3.1.

---

## 6. API performance & round-trip analysis

Low-volume admin module; no round-trip concerns found. `publish()`'s three sequential (and currently un-transacted) steps are the only multi-step write in this module, already covered in §3.1.

---

## 7. Load testing (p65/p90) — status

**Not executed.** Low-volume, low-concurrency admin module — not a priority target. If a fix for §3.1 is implemented, a quick concurrent-publish test against the local ephemeral-MongoDB harness would be a cheap way to confirm the new unique index actually prevents the double-active-version scenario.

---

## 8. Scalability & dynamic-approach recommendations

- **Apply the `executeTransaction` + partial-unique-index pattern to `publish()`** — this module is a good, small, low-risk place to practice the exact fix already proven correct in `admissions-configuration`/`inpatient-admissions`, before those same engineers need it somewhere higher-stakes.
- **Revisit pagination on `list()` only if/when this module's data volume changes** (e.g., if consent templates become per-department or per-service rather than per-branch, multiplying the realistic count) — not worth adding preemptively today.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] Wrap `publish()`'s retire-then-activate sequence in a transaction, and add a partial unique index enforcing one active version per `{branchId,code}` (§3.1).
- [ ] Add pagination to `list()` if/when consent-template volume is expected to grow materially (§3.2) — not urgent.

---

## 10. Verdict

**Close to production-ready.** One real, low-frequency data-integrity gap with a well-proven fix already demonstrated elsewhere in this codebase — otherwise a clean, small module with correct immutability and versioning semantics.
