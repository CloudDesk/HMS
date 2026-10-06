# Module Review: `patient-portal`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/patient-portal/*` (6,041 lines — the largest module reviewed in this series) — OTP authentication, guardian/dependent account linking, and the patient-facing API surface for appointments, documents, billing, and profile data. Static code review.
**Live load testing: not executed** — real patient authentication/PHI data; see §7.

---

## 1. Executive summary

This module contains the best OTP implementation in the codebase — timing-safe comparison, atomic single-use consumption, multi-layer rate limiting, one-time registration tokens — sitting right next to the most serious access-control finding in this entire review series. **A guardian account can gain full, permanent access to any child patient's complete medical record — appointments, lab results, prescriptions, documents, billing — by submitting only that child's patient number and date of birth, with no verification tying the request to any actual relationship with the child, and no rate limit on the endpoint that checks it.** Patient numbers are sequential and low-entropy; this is a real, exploitable path to unauthorized access to minors' protected health information, not a theoretical one.

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 1 | Linking a dependent to a guardian account requires only patient-number + date-of-birth (both low-entropy, guessable/sequential), grants full data access immediately with no staff review, and the endpoint has no rate limiting |
| 🟠 High | 0 | — |
| 🟡 Medium | 0 | — |
| 🟢 Low | 1 | `PatientAccessGrant`'s `PENDING`/`REJECTED` statuses are defined in the schema but never actually used by any code path — every real grant goes straight to `VERIFIED` |

---

## 2. What's correct (keep doing this)

- **The OTP implementation is the best piece of security engineering found anywhere in this review series.** `patient-otp.service.ts` hashes the OTP with the phone number baked in (`hashOtp`, preventing cross-phone hash reuse), compares hashes with `crypto.timingSafeEqual` (genuine timing-attack resistance, not just a plain string comparison), and rate-limits at four independent layers: resend cooldown, per-identity request limit, per-IP request limit, and separate per-identity/per-IP *verification* limits — each with its own audit trail on breach (`auditRateLimitOnce`). This matches or exceeds the quality of the main staff `auth` module's rate limiting, reviewed earlier in this series.
- **OTP consumption is correctly atomic and single-use**: `patient-otp.repository.ts:89-104`'s `consume()` folds `verifiedAt: null` directly into the `findOneAndUpdate` filter, so two concurrent requests presenting the same correct OTP can't both succeed — the same atomic-update discipline praised repeatedly elsewhere in this series.
- **Registration tokens are correctly one-time-use and DB-enforced**: `patient-otp.service.ts:153-174`'s `consumeRegistrationToken` uses the identical atomic-filter pattern (`consumedAt: null, expiresAt: { $gt: now }`) rather than check-then-write.
- **Self-linking to an existing patient record is correctly tied to the OTP-proven identity, not just static facts**: `linkExistingSelfPatient` (`patient-portal.repository.ts:805-857`) requires the patient record's own `phone`/`email` to match what the user already proved ownership of via OTP during account creation — so self-linking is cryptographically anchored to the same phone number the account itself was created with. This is the correct design, and it's exactly the design §3.1 shows is missing from the dependent-linking path.
- **The `PatientAccessGrantModel`'s unique `{userId,patientId}` index plus the comment in `ensureAccessGrant`** (`patient-portal.repository.ts:859-868`: *"The unique user/patient index prevents this upsert from converting an existing relationship, including when two different relationships race"*) shows real, deliberate thought about race conditions in the grant-creation path itself — the mechanism that's broken isn't careless, it's missing a verification step that the rest of the mechanism around it doesn't need.

---

## 3. Findings

### 3.1 🔴 CRITICAL — Dependent linking grants full access to a minor's medical record based on two guessable facts, with no rate limit

**Where:** `patient-portal.service.ts:645-660` (`linkExistingDependent`), `patient-portal.repository.ts:684-690` (`findPatientToLinkAsDependent`), `patient-portal.repository.ts:859-868` (`ensureAccessGrant`), `patient-portal.routes.ts:787-795`

```ts
// service layer
async linkExistingDependent(userId, input: { patientNumber, dateOfBirth, relationship, legalConsentAccepted }) {
  const context = await this.context(userId);
  if (context.account.type !== 'GUARDIAN') throw new AppError(..., 403, 'GUARDIAN_ACCOUNT_REQUIRED');
  if (!input.legalConsentAccepted) throw new AppError(..., 400, 'GUARDIAN_CONSENT_REQUIRED');
  const patient = await this.repository.findPatientToLinkAsDependent(input);   // <- patientNumber + dateOfBirth ONLY
  if (!patient) throw new AppError(..., 404, 'PATIENT_IDENTITY_NOT_MATCHED');
  await this.executePortalTransaction(async (session) => {
    await this.repository.ensureAccessGrant(userId, String(patient._id), input.relationship, session);  // <- status: 'VERIFIED', immediately
    ...
  });
}

// repository layer
async findPatientToLinkAsDependent(input: { patientNumber: string; dateOfBirth: string }) {
  return PatientModel.find({
    patientNumber: input.patientNumber.trim().toUpperCase(),
    dateOfBirth: new Date(input.dateOfBirth),
    status: 'ACTIVE', deletedAt: null,
  })...
}
```

```ts
// route — no rate limiting of any kind
app.post('/api/patient-portal/dependents/link', { preHandler: authenticate(services) }, async (request, reply) => { ... });
```

**What this actually requires, end to end:**
1. Create a guardian account — trivially done by anyone with any working phone number, via the OTP flow (which, correctly, only proves *you* control *that* phone — it proves nothing about any relationship to anyone else).
2. Accept a self-attested "legal consent" checkbox — a boolean in the request body, not independently verified by anything.
3. Submit a target child patient's **`patientNumber`** and **`dateOfBirth`**.
4. Receive full, immediate, `status: 'VERIFIED'` access to that child's entire medical record — every appointment, lab/imaging result, prescription, document, invoice, and profile field this module exposes (confirmed by tracing `resolveAccessiblePatientId`, which every single patient-data-access method in this module calls, and which treats a `VERIFIED` grant as sufficient — no further check, no staff involvement, anywhere downstream).

**Why both factors are weak, concretely:**
- **`patientNumber` is sequential and low-entropy** — confirmed in the `patients` module review: the format is `HMS-YYYY-NNNNNN`, allocated by an incrementing per-year counter. An attacker doesn't need to guess a random 24-character ObjectId; they need to guess or iterate a 6-digit counter within a known year.
- **`dateOfBirth` for a child is often knowable or narrowly guessable** — through social knowledge, school/community information, or simply by iterating a plausible age range (a handful of years × 365 days is a trivially small search space for an automated or even manual attack, especially combined with a known approximate age).
- **Neither factor involves proving any relationship to the child** — no OTP sent to a phone number already on file for the child's record, no staff approval step, no cross-check against an existing guardian/emergency-contact field on the patient's own profile.
- **The endpoint has no rate limiting at all** — contrast this directly with the OTP request/verify endpoints in the very same module, which have four independent layers of rate limiting. `linkExistingDependent`'s route (`patient-portal.routes.ts:787`) has only `authenticate(services)` as its preHandler — nothing stops a scripted client from iterating `date_of_birth` values against a fixed, known/guessed `patient_number` until one matches.

**Why this is the most serious finding in this entire review series:** it's a direct, confirmed path to unauthorized access to a minor's complete protected health information, requiring no insider access, no social engineering of staff, and no exploitation of a race condition or edge case — just two pieces of information that are plausibly obtainable for a specific targeted child, against an endpoint with no defense against repeated guessing. Every other finding in this series concerns performance, data integrity, or a narrower access-control edge case; this one concerns the core promise that a patient portal is supposed to keep.

**Recommended fix, in order of impact:**
1. **Immediate**: add rate limiting to `/api/patient-portal/dependents/link` — at minimum per-identity and per-IP limits matching the discipline already applied to the OTP endpoints in this same file, using the same `AuthRateLimitRepository` already available.
2. **Structural**: require an independent proof of relationship before granting access, not just matching static fields already visible on record. The strongest version: send an OTP to the phone number *already on file for the child's own patient record* (not the guardian's phone) and require it to confirm the link — mirroring exactly the pattern already correctly used for self-linking (tying the grant to proof of control over a contact channel already associated with the target record, not to static, guessable identifiers). If the child's record has no phone on file (plausible for a young child), fall back to a staff-review step (the `PENDING` status already exists in the schema for exactly this — see §3.2) rather than auto-verifying.
3. **Defense in depth**: log and alert on repeated `PATIENT_IDENTITY_NOT_MATCHED` responses from the same account/IP, independent of the rate limit itself, since a pattern of failed attempts against this specific endpoint is a strong signal worth surfacing to security monitoring regardless of whether the rate limit catches it first.

### 3.2 🟢 LOW — `PENDING`/`REJECTED` grant statuses are defined but never used

**Where:** `patient-access-grant.model.ts:8` (schema enum), vs. every actual grant-creation call site (`ensureAccessGrant`, `createPortalPatient`'s direct `PatientAccessGrantModel.create`)

The schema models a real verification workflow (`PENDING → VERIFIED` or `REJECTED`, presumably by staff), but no code path in this module ever creates a grant in `PENDING` state or transitions one to `REJECTED` — every grant is created as `VERIFIED` immediately. This is the same root gap as §3.1, viewed from the schema side: the workflow this data model was clearly designed to support was never actually wired up for the dependent-linking path.

**Recommended fix:** once §3.1 is addressed (likely via a staff-review fallback path), this status machine becomes the natural mechanism to implement it with — it's already there, just unused.

---

## 4. Validation & edge-case audit

| Input | Validated? | Where | Gap |
|---|---|---|---|
| OTP hash comparison | ✅ timing-safe | `securelyEqual` | None |
| OTP double-consumption | ✅ DB-enforced | Atomic filter | None |
| OTP request/verify rate limits | ✅ four layers | `enforceRequestLimits`/`enforceVerificationLimits` | None |
| Registration token single-use | ✅ DB-enforced | Atomic filter | None |
| Self-link tied to OTP-proven phone/email | ✅ | `linkExistingSelfPatient` | None |
| Dependent-link identity proof | ❌ | `findPatientToLinkAsDependent` | §3.1 |
| Dependent-link rate limiting | ❌ | Route has none | §3.1 |
| Guardian consent checkbox independently verified | ❌ (self-attested only) | `linkExistingDependent` | Part of §3.1 |
| Minor-only guardian-profile editing | ✅ | `updateGuardianProfile`'s `isMinor` check | None |

---

## 5. MongoDB index audit

**`otp_challenges`** — `{phone,createdAt}`, `{phone,verifiedAt,expiresAt}`, TTL on `expiresAt` (immediate expiry-based cleanup). Well-targeted.

**`registration_tokens`** — indexed `phone`, unique `tokenHash`, TTL on `expiresAt` with `expireAfterSeconds: 3600` — note this means physical deletion happens *one hour after* the token's own `expiresAt` value, not at that moment. Not a bug (the service layer independently checks `expiresAt: { $gt: now }` before accepting a token, confirmed in `consumeRegistrationToken`), just worth knowing the TTL is a grace-period cleanup mechanism, not the actual expiry enforcement.

**`patient_access_grants`** — unique `{userId,patientId}` (correct — one relationship record per user-patient pair, with `relationship` itself mutable within that one record rather than allowing duplicate rows), `{userId,status,createdAt}`, `{patientId,status}`. No index-level issues; the issue is in the application logic deciding what `status` to set, not in how it's indexed.

---

## 6. API performance & round-trip analysis

Not a primary focus given this module's dominant finding is access-control, not performance. `resolveAccessiblePatientId`'s two-query `Promise.all` (grant existence + direct-link existence) followed by a third patient-active check is efficient and appropriately parallelized where it can be. No notable inefficiencies found in the portions reviewed.

---

## 7. Load testing (p65/p90) — status

**Not executed**, for the standard reason (real authentication/PHI data). However: **§3.1 should be verified functionally, not just by code reading, before considering it closed** — a quick scripted test against the local ephemeral-MongoDB harness (register a guardian account, register a "child" patient directly via the `patients` API with a known DOB, then attempt `linkExistingDependent` with the correct `patientNumber`+`dateOfBirth` and confirm a `VERIFIED` grant is created with zero staff involvement) would conclusively demonstrate the gap end-to-end and should be the first thing run once this review is read, ahead of any load/latency concern.

---

## 8. Scalability & dynamic-approach recommendations

- **§3.1's fix should be designed as a reusable "proof of relationship" primitive**, not a one-off patch to this one endpoint — if this product ever adds other guardian-like relationships (e.g., a caregiver, a power-of-attorney) the same underlying problem (verifying a claimed relationship to a patient who can't consent for themselves) will recur, and it's worth solving it once, generally, rather than per-relationship-type.
- **The OTP service's rate-limiting pattern (four independent scopes, each audited on breach) should be the explicit, named template applied to every other sensitive, low-cost-to-guess endpoint in the codebase** — `linkExistingDependent` is the confirmed gap today, but the right fix is a shared decorator/helper that makes it structurally hard to add a new endpoint *without* rate limiting, rather than relying on each new endpoint's author remembering to add it by hand.
- **The unused `PENDING`/`REJECTED` grant states (§3.2) are a sign this module's data model already anticipated needing a stronger workflow than what got built** — worth treating the fix for §3.1 as "finish what the schema already started" rather than a net-new design exercise.

---

## 9. Unresolved / required changes (tracked checklist)

- [ ] **Add rate limiting to `POST /api/patient-portal/dependents/link`**, matching the discipline already used for OTP endpoints in this same module (§3.1). **Immediate, highest-priority action in this entire review series.**
- [ ] **Redesign dependent-link verification to require proof of relationship**, not just matching two static, guessable fields — ideally an OTP to a contact channel already on file for the *child's* record, with a staff-review fallback (using the already-defined `PENDING` status) when no such channel exists (§3.1, §3.2).
- [ ] Add monitoring/alerting on repeated failed dependent-link attempts, independent of the rate limit (§3.1).
- [ ] Run the functional verification described in §7 to confirm the gap end-to-end and later confirm the fix closes it.
- [ ] Once fixed, audit whether any other relationship-linking path in the system (patient-mobile app, any admin-side "link guardian" staff tool) has the equivalent gap — this review covered the `patient-portal` backend module specifically, not every caller of the underlying grant mechanism.

---

## 10. Verdict

**Not production-ready, and this finding should block launch or be mitigated immediately if the system is already live.** The engineering quality elsewhere in this exact module (the OTP implementation) proves the team is fully capable of building this correctly — which makes the gap in dependent-linking read as a genuine oversight (a workflow the schema anticipated but the implementation never finished) rather than a sign of broader carelessness. That doesn't reduce the urgency: this is a real, exploitable path to unauthorized access to children's medical records, and it should be the single highest-priority item across this entire review series.
