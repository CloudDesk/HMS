# Phase 1 — native authentication gap and compatibility note

25 September 2026. Scope: existing-account native login, refresh and current-session logout only. Patient Web protection rules and Phase 0 reviewed. No mobile workspace, clinical changes, grant changes, phone changes, packages or deployment.

## Verified before edits

- Configured development MongoDB reports a writable replica set with logical sessions (read-only hello command through existing connection helper). Native transactions can be tested without permitting standalone fallback.
- OTP already supports fixed 1234 without calling its SMS abstraction. Keep service, repository and configuration unchanged; native login fails closed if fixed-code mode is not selected. Reuse existing OTP request endpoint.
- Web stores access in memory and refresh in HttpOnly cookie. Keep web routes, cookie adapter, frontend and response schemas unchanged.
- Existing refresh rotation is read/issue/revoke and is not atomic. Add native-specific transactional operations; do not refactor web rotation.
- RefreshToken declares neither revokedAt nor replacedByTokenId. Auth repository writes them using strict:false. Declaring these globally would also change the existing profile phone-update revocation behavior. Avoid that unintended change: native fields are optional and namespaced; legacy fields retain current persistence behavior.
- Verified SELF fallback can restore User.patientId despite a revoked explicit grant. Preserve and characterize it; separate security work item.

## Minimal contract adjustment from Phase 0

Use the existing RefreshToken collection. The first token row is also the stable session anchor; all family rows have the SAME absolute expiration, so TTL cannot delete the anchor while the family remains valid. Native session/family ID is that anchor's ID. A native token stores sessionId and optional replacedBy; only the anchor stores platform, installationId, appVersion, lastUsedAt and session revocation. Existing createdAt/expiresAt are reused. No AuthSession collection, user epoch, separate family ID or mobile identity model.

Defer logout-all, session listing and remote-session management to a separately approved backend increment: not necessary to establish login/rotation/current logout. No misleading logout-all implemented as non-atomic bulk update. Multiple independent sessions are supported. Phase 0's epoch proposal applies if logout-all is later added.

Native access uses existing JWT signer/verifier with optional aud and sid claims. Session revocation is checked on authenticated resource calls. Legacy JWTs are unchanged. Native tokens are refused in query-string transport and browser refresh endpoints. Strict replay policy revokes the whole affected family; lost refresh responses require sign-in again.

## Planned existing-file changes, consumers and compatibility

| File | Reason / consumers | Compatibility / verification |
|---|---|---|
| auth/refresh-token.model.ts | Optional native metadata on existing refresh collection; all auth consumers | No defaults on legacy rows, no declaration of legacy revocation fields; schema and cookie regression tests |
| auth/auth.types.ts, auth/auth.repository.ts | Expose native marker to reject native credentials on cookie refresh; web auth uses these | Add optional field only; existing mapping/revocation preserved; cross-transport tests |
| auth/auth.service.ts | Injectable issuance callback reuses patient eligibility/OTP flow; native access session check | Default issuance and legacy authentication unchanged; web cookie/login/refresh/logout and native tests |
| shared/security/jwt.ts | Optional native session claims on same signer | Legacy claim payload unchanged; web/native access tests |
| middleware/authenticate.ts | Reject native query-token transport | Legacy query behavior preserved; header/query tests |
| modules/index.ts | Register additive native routes | Existing registrations preserved; route regression tests |

New native repository/service/routes/schemas and focused integration tests stay within auth. Transaction callbacks never send responses or invoke external services. Native rotation and audit commit together; no plaintext refresh credentials stored. OTP consumption keeps existing single-use semantics: if subsequent session issuance fails, request a new challenge rather than resurrecting it.

## Baseline

Initial targeted command without fixed-mode environment: 20 files, 90 tests passed / 5 failed. Three pre-existing PatientWebsitePage catalogue duplicate-call failures; two auth-rate-limit integration failures because default test environment disables fixed OTP and has no sender (503). Rerun under explicit existing fixed-code settings before implementation; do not change assertions or configure delivery. Exact final counts will be recorded in REPORT.md.

## Additional compatibility check before limiter edit

Focused rerun exposed an intermittent 429 on two simultaneous native refreshes: AuthRateLimitRepository treats every duplicate-key upsert race as an exhausted bucket. Native needs to distinguish first-insert contention from exhaustion so replay policy is consistently reached under the configured limit. Add an OPTIONAL retryInsertRace option to consume; only native refresh/logout passes it. On duplicate key, retry one conditional increment without upsert. Web, OTP and other existing callers retain the default false branch and unchanged behavior. Verify the new branch with deterministic contention/exhaustion tests, real concurrent native refreshes and the existing web/OTP tests. No new store, limiter infrastructure or configuration.
