# C1 dependent-linking follow-up — 12 October 2026

## Scope and disposition

Inspected the current checkout on `Dev-F-Release-5-Clone`, including the existing uncommitted C1 containment. This is a source-code and synthetic-test audit, not an inspection of production grant records. No real patient data was queried, no grants were migrated or revoked, and no production affected-record count is asserted. Original C1 implementation files and the existing review were preserved.

Disposition: keep new dependent links pending and inaccessible. Legacy verified dependent grants need controlled review; their existing status is not evidence of independently verified authority. Do not bulk revoke them or silently certify them as legitimate. A safe existing approval path for these requests was not found. Approval remains blocked on the capabilities specified below.

## Legacy grant provenance

`patient-access-grant.model.ts` stores user/patient references, relationship, status, `createdAt`, `updatedAt`, `verifiedBy`, `verifiedAt`, and `revokedAt`. It does not store a verification method, an approval-evidence reference, a challenge reference, or immutable transition history. Its default status is still VERIFIED; the C1 request method explicitly inserts PENDING.

`ensureAccessGrant` writes VERIFIED and a verification time without a verification method. Its historical MRN/DOB caller and the current OTP-backed guardian activation caller use the same `patient_portal.guardian.linked` event, actor, patient reference, and relationship. That event alone cannot distinguish the vulnerable flow from activation. Updates can replace verification timestamps, so those timestamps alone are not reliable creation-path evidence.

`createPortalPatient` explicitly creates VERIFIED grants and records `patient_portal.patient.created` plus a registration timeline event. Its `verifiedBy` is the registering user, not necessarily staff. Non-null `verifiedBy` therefore does not establish staff approval. OTP challenge consumption proves control of a phone, but challenges are not durably bound to a dependent grant and are TTL-cleaned. Their absence is not proof of abuse or lack of verification.

### Required controlled review (not executed)

1. The security/data owner must establish the vulnerable deployment interval and containment deployment time from release evidence, not the local patch timestamp.
2. In a restricted environment, enumerate VERIFIED PARENT/LEGAL_GUARDIAN grants using bounded pagination, preserving their current fields and relevant audit/registration evidence. Include grants with later updates, missing history, and inconsistent revocation fields. Keep identifiers and clinical data out of exported reports and routine logs; report aggregate counts and restricted case references.
3. Correlate creation events, registration records, account-activation evidence, and independently documented relationship authorization. A `guardian.linked` event, matching dates, or VERIFIED status alone leaves a case **unresolved**. Registration events are provenance evidence, not a blanket guarantee of legal authority.
4. Staff with owner-approved authority must review unresolved cases individually using approved identity/relationship evidence. Record reviewer, evidence reference, decision, time, and before/after state. Do not use possession of MRN/DOB or self-attested consent as approval.
5. Any later remediation needs a separately reviewed dry-run manifest, backup/recovery plan, per-record conditional transitions, audit preservation, and validation across portal, notifications, direct patient mappings, and active sessions. Investigate historical disclosures where unauthorized access is established. No bulk migration is authorized or included here.

## Approval/verification capability gap

No dependent approval route, approved staff permission, branch-scoped review queue, or evidence-validation contract was found. Existing patient-document consent verification is a different authorization and must not be repurposed to grant medical-record access.

The application has OTP infrastructure and an existing guardian activation flow that checks a submitted phone against a patient record. That activation flow creates a new account and is not an approval path for a pending request on an existing account. Patient contact fields lack a verified-contact marker and verification provenance; possession of an account phone does not establish authority over another patient. A generic OTP cannot be treated as a grant-bound approval challenge. No new provider, SMS call, arbitrary requester-supplied destination, or automatic approval was added.

Next action: the product/security owner must approve either (a) the staff permission, patient/branch scope and required relationship evidence, or (b) a trustworthy recorded patient contact and a challenge bound to the requesting account, patient, grant, purpose and expiry. Implementation must atomically transition only PENDING/non-revoked grants, record actor/time/method/outcome, preserve revocations, make retries idempotent, and audit the transition transactionally. Revalidate patient/account eligibility and scope at approval time. Then test unauthorized staff, cross-scope access, concurrency, rollback and replay. Until this exists, requests remain pending; contacting staff does not imply the software currently provides an approval button.

There are consequently no authorized-approval or approval-idempotency tests: no such operation was implemented. Tests verify that injected approval fields and non-guardian staff cannot turn the public link route into an approval path. A test-only database transition is a fixture, not an implemented approval workflow.

## Rate limits and response behavior

- The service consumes independent account and client-IP buckets before patient lookup: 5 and 20 attempts respectively per fixed 900-second window. Keys are HMACs using the configured access-token secret. All instances must share the same database and secret; key rotation changes bucket identities.
- `AuthRateLimitRepository` derives a deterministic unique `_id` per scope/key/window and conditionally increments with `count < limit`. Duplicate-key exhaustion fails closed. First-insert races may conservatively reject an otherwise allowable request; they cannot exceed the cap. MongoDB errors propagate and prevent patient lookup or grant creation. Account/IP consumption is not a joint transaction: one bucket may consume an attempt even if the other rejects.
- TTL expiry is bucket start plus two windows; MongoDB cleanup is asynchronous. Enforcement derives the current bucket independently of cleanup. Adjacent fixed windows permit a boundary burst. Tests exercise multiple repository instances against one MongoDB instance and rollover without waiting for TTL; they are not a distributed deployment load test.
- `request.ip` follows configured trusted-proxy handling. Unrestricted proxy trust is disallowed by configuration parsing; production proxy topology still needs operational verification. Malformed bodies are rejected before the service and do not consume these limits, but cannot reach patient matching. Deployment-wide malformed-request throttling is outside C1.
- Matching, wrong-DOB and absent-MRN requests return the same HTTP 202 data and no patient identifier. Matching requests do extra transaction/upsert/audit work; this creates a plausible timing signal. No controlled exploit or statistically valid timing study was performed. Timing resistance is not claimed. No arbitrary sleep was introduced. Error/availability differences during matching-only database work are also a residual enumeration signal.

## Authorization and revocation findings

The portal context queries VERIFIED grants with `revokedAt: null`. Protected overview, document, download, invoice and profile-photo services recheck repository authorization on each request. The link request does not write the account's direct `patientId`. Synthetic tests show PENDING, REJECTED and REVOKED grants disappear from context and fail protected requests using the same bearer token; switching the requested patient does not establish access. Repeated linking cannot promote a pending grant or revive a revoked grant. Existing verified relationships continue to function, but this compatibility behavior is not a certification of legacy provenance.

Limits of that conclusion requiring separate, scoped remediation:

- `resolveAccessiblePatientId` and context also honor an account's direct patient mapping. A direct mapping is an independent self-access path, not a dependent grant. Inconsistent legacy mappings must be reviewed; grant revocation alone does not remove direct access.
- Dental quotation/stage access and notification synchronization query status VERIFIED without consistently requiring `revokedAt: null`. Status REVOKED/PENDING is excluded, but inconsistent VERIFIED-plus-revokedAt records are not consistently excluded. Remediation must enforce both fields across these consumers.
- Existing notification records are listed by recipient without rechecking the current patient grant. Historical notifications may remain visible after revocation. An owner-approved change must scope patient-linked notification reads to current access without removing unrelated notifications.
- The photo route sends `private, max-age=3600`; previously fetched content can remain browser-cached. Revocation cannot retract content already delivered. Cache policy and client query-cache clearing need separate validation; no browser automation was performed.
- Grant insertion and audit use the existing transaction helper. It falls back to nontransactional execution on standalone MongoDB. Replica-set deployment is needed for atomic grant/audit persistence; standalone audit failure can leave a PENDING grant, but cannot grant medical access.

These findings prevent a blanket claim that revocation eliminates every previously delivered or independently authorized view. Cross-domain implementation was not changed in this bounded follow-up.

## Validation and changed files

Only the existing C1 test file and this new audit document were changed by the follow-up. Production containment files were inspected and left intact. The test suite now has 13 cases covering the original six scenarios plus status-based protected endpoint denial with unchanged tokens, caller-supplied approval/provenance handling, staff denial, shared atomic limits/window rollover, and fail-closed limiter errors. Test request logging is silenced; all test records are synthetic.

- `npx vitest run src/modules/patient-portal/patient-dependent-link-security.test.ts --config vitest.config.ts` (from `apps/api`): **13 passed**. Existing duplicate MobileDevice pushToken-index warning observed.
- `npm run typecheck --workspace=@hms/api`: **passed**.
- `git diff --check`: **passed**; the tracked diff still consists only of the original C1 containment files.
- Patient-web was not changed during this follow-up; its typecheck was not rerun.
- No full test suite, dependency installation, browser automation, production data audit, migration, commit, push, reset, revert, rebase, or branch switch was performed.
