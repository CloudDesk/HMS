# C. Authentication Contract — Proposal, Not Implemented

## C1. Fixed-code requirement and minimum change

Use the existing `PatientOtpService`, `OtpChallengeModel`, rate-limit repository and patient login eligibility rules. Local `.env.dev` already sets `PATIENT_PORTAL_DEMO_OTP_ENABLED=true` and `PATIENT_PORTAL_DEMO_OTP=1234`; the request service selects that code and does not call its sender. Existing `.env.example` disables the mode, so deployment configuration must be verified against the agreed environment rather than assumed from the example.

**Minimum OTP change: none to the generator or request transport in the currently configured environment.** Phase 1 should test the fixed-mode branch and native adapter. Reuse the existing two settings; add no delivery provider, SMS credential, SMS variable or SMS task. Do not hardcode a second mobile verification implementation. The user types `1234`; the backend checks it against a requested, unexpired, unconsumed challenge. Do not accept an arbitrary `1234` without a challenge.

Default limits remain 300-second challenge expiry, 60-second request cooldown and 3 failed attempts, with the existing configurable identity/IP rate limits. Re-request invalidates the earlier challenge. Web/mobile requests share the current normalized phone identity and limits; requesting a new challenge on one client can invalidate the other client's pending challenge. TTL cleanup is not the expiry validator.

The fixed value does not prove possession of the entered phone. This contract is for the specified environment, not a production SMS or identity-assurance claim. No SMS configuration is a blocker.

## C2. Compatibility and naming

Web continues using existing `/api/patient-portal/login/otp`, signup/activation endpoints and `/api/auth/refresh|logout` cookies and JSON shapes. Never return a refresh token from existing web routes. Native routes do not set/read browser cookies; they use explicit token bodies and `credentials: omit` at the client. They are not authenticated merely by `platform` or a client-type header.

Proposed native prefix: **`/api/patient-portal/mobile/auth`**, abbreviated `M` below. Existing shared prefix `/api/patient-portal` is `P`. All new paths below are proposals. Success uses HMS `{data:...}` and errors `{error:{code,message,details?}}`; auth responses use `Cache-Control: no-store`. Timestamps are ISO-8601 UTC and token lifetimes are integer seconds.

Native tokens must identify `client_type=patient_mobile`, `aud=hms-patient-mobile`, and server-issued `sid`, alongside existing `sub`, `username`, `iat`, `exp`. Existing JWT helper needs explicit typed claim validation; never silently treat a malformed native token as a legacy web token. Native credentials are accepted only in Authorization headers on resource APIs, never URL query parameters. Cookie refresh must reject native refresh records and native refresh must reject legacy web records.

Backend session/role/grant checks remain authoritative on existing resource APIs. Add native `sid` validation to shared authentication when a native token is presented; preserve existing web behavior for legacy claims. This is an adapter and an auth-domain extension, not a second patient identity system.

## C3. Endpoint contracts

### 1. Mobile OTP request — reuse existing endpoint

`POST P/otp/request`, public, body `{"phone":"<patient-phone>"}`.

200 response: `{"data":{"success":true,"resendAvailableAt":"<UTC timestamp>"}}`. Interpret success as “verification step available,” not “SMS sent.” Do not add a duplicate native request endpoint. Existing phone trim/validation/normalization is preserved; any country-code format redesign is outside Phase 1.

Errors: 400 `VALIDATION_ERROR`; 429 `AUTH_RATE_LIMITED`; operational 5xx. Preserve current invalid/consumed challenge and request limit behavior. No external delivery occurs in fixed mode. Challenge expires by current configured TTL. No automatic POST retry: display network error; user may request again after the authoritative cooldown. Do not request a fresh challenge on every screen render.

### 2. Mobile OTP verify/login — new adapter

`POST M/login/otp`, public with challenge proof:

```json
{
  "phone": "<patient-phone>",
  "otp": "1234",
  "installationId": "<random UUID generated for this app install>",
  "platform": "android",
  "appVersion": "<version/build>"
}
```

`platform` is `android|ios`. Installation ID is random app metadata, not a hardware ID or authentication proof. App version is bounded metadata, not a permission claim. No userId, patientId, permission, scope or session owner is accepted from this body.

200 payload:

```json
{
  "data": {
    "user": "<existing public AuthUser shape>",
    "tokens": {
      "accessToken": "<signed native access JWT>",
      "refreshToken": "<opaque random credential>",
      "tokenType": "Bearer",
      "expiresIn": 900,
      "refreshExpiresIn": 604800
    },
    "session": {
      "id": "<server session ID>",
      "platform": "android",
      "createdAt": "<UTC>",
      "lastUsedAt": "<UTC>",
      "expiresAt": "<UTC>"
    }
  }
}
```

The string placeholders represent typed objects/values, not literal production responses. Reuse the existing public user schema rather than publishing staff/internal fields. Default access TTL 900 seconds, capped by remaining session life. Proposed native absolute session life is the existing refresh TTL (default 7 days), without sliding extension. `refreshExpiresIn` is remaining lifetime, not always seven days.

Flow: same OTP pending-flow/eligibility checks as web -> same branded verification/atomic challenge consumption -> eligible patient/guardian account -> native session issuance -> `GET P/context` -> accessible patient/home. Do not call the web login route and discard its newly minted cookie/session. Extract/reuse shared service orchestration without changing web response behavior. Where challenge consumption/session writes cross documents, commit together with strict transaction semantics.

Errors: 400 `VALIDATION_ERROR`; 401 `INVALID_OTP`; 429 `MAX_ATTEMPTS_EXCEEDED`/`AUTH_RATE_LIMITED`; 403 `PATIENT_PORTAL_ACCOUNT_REQUIRED` or `SESSION_NOT_ALLOWED`; existing 409 `MINOR_GUARDIAN_ACCOUNT_REQUIRED`, `MULTIPLE_PATIENT_MATCHES`, `NEW_PATIENT_REQUIRES_REGISTRATION`; operational 5xx. Preserve current eligible unlinked-adult service behavior; do not invent mobile matching rules.

No automatic login retry after a lost response: the challenge may have been consumed. Request a new challenge after cooldown and sign in again. A possible orphan native session expires and remains revocable in session management. New registration/guardian activation is Phase 2 in proposed MVP; display a supported next step rather than creating an account from an unknown phone.

**Do not call existing `P/otp/verify` and then `M/login/otp` with the same challenge:** existing verify consumes it and returns a registration token. That endpoint remains for registration proof; it is not a login-session endpoint. Native signup/activation adapters are a later explicit contract if those scope rows move into MVP.

### 3. Mobile refresh

`POST M/refresh`, no access bearer required; body `{"refreshToken":"<opaque>"}`. Credential ownership is resolved only from its hash. No installationId is required as proof. Return the same native session payload as login, with rotated credentials and unchanged session ID/absolute expiry.

Errors: 400 invalid body; 401 `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_EXPIRED`, `REFRESH_TOKEN_REUSED`, `SESSION_REVOKED`, `SESSION_EXPIRED`; 403 `SESSION_NOT_ALLOWED` for inactive/locked/no-longer-eligible user; 429 existing/new auth endpoint limit; 503 `SESSION_STORE_UNAVAILABLE` if safe transaction cannot run. Error codes beyond current ones are proposed stable native codes, not existing implementations.

One active refresh operation per app process/session. Stop dispatching protected calls until refresh completes. On definite network unavailability before sending, retain secure credentials and show offline; do not log out. On an ambiguous timeout/5xx after dispatch, the proposed MVP policy is reauthentication, not blind resend: server may already have consumed the token. No plaintext response replay cache or grace token family is proposed.

### 4. Mobile logout

`POST M/logout`; authenticate by **either** a valid native bearer or body `{"refreshToken":"<opaque>"}`. With bearer alone body may be `{}`. If both are supplied they must refer to the same user/session; otherwise 400 `SESSION_CREDENTIAL_MISMATCH`. Never accept a session ID without proof.

200 `{"data":{"ok":true}}`. Revoke that session and refresh family; no cookie changes. Known expired/rotated/revoked refresh proof may revoke its original session but can never issue tokens. Unknown well-formed refresh input also returns generic success to avoid an existence oracle. Missing both forms is 401; malformed body 400; rate limit 429; persistence failure 503. Repeated logout has the same final effect. Log only a bounded event, not the secret.

The client clears its private session bundle, access token, cache, account context and temporary files even when offline. An offline logout is local only: server revocation cannot be promised until a request reaches the server. Do not retain a usable refresh token merely to queue logout; remote revocation can be done from another signed-in device. No background restoration after local logout.

### 5. Mobile logout all

`POST M/logout-all`, valid native bearer, empty body `{}`. Proposed scope is **all patient-mobile sessions for this authenticated account, including current**. UI label must say “Sign out all mobile devices.” Existing web sessions are unchanged.

200 `{"data":{"ok":true,"scope":"patient-mobile"}}`. Atomically increment the user's native session epoch and mark relevant sessions revoked. Server validates epoch/session on future native access, so previously issued native access tokens also stop working. A new independent login linearized after this operation may create a new session; logout-all is not account disablement.

Errors: 401 inactive/expired/revoked caller session, 403 ineligible user, 429 limit, 503 persistence unavailable. Refresh first if access expired and safe to do so. Effect is idempotent, but retrying with the now-revoked caller bearer can return 401; client treats that as signed out, not as proof the first response was received. It does not retry with anonymous authority.

### 6. Mobile session list

`GET M/sessions?page=1&limit=20`, valid native bearer. Max limit 50; `lastUsedAt desc, id desc`; active/unexpired sessions only for this account. Optional revoked-history view is not MVP.

200 `{"data":{"data":[{"id":"...","platform":"ios","appVersion":"...","createdAt":"...","lastUsedAt":"...","expiresAt":"...","isCurrent":false}],"meta":{"page":1,"limit":20,"total":1,"totalPages":1}}}`.

Never return token hashes/raw tokens, IP location, hardware identifiers or another account's sessions. `lastUsedAt` means last successful login/refresh, not every resource request. Errors 400 query validation, 401 session invalid, 403 account ineligible, 429 limit, 5xx. Safe GET retries with bounded backoff; no persisted session list is needed.

### 7. Revoke one mobile session

`DELETE M/sessions/:sessionId`, valid native bearer; no body. Actor must own target session. 200 `{"data":{"ok":true}}`; 404 `SESSION_NOT_FOUND` for unknown or foreign target. Repeat on an owned revoked target returns success while caller remains valid. Revoking current session clears local state; a repeated call by that revoked bearer can return 401. Errors also include 400 invalid ID, 401, 403, 429, 503. Access and refresh immediately fail session validation after revocation commits. Other mobile devices and web sessions remain signed in.

## C4. Minimal persistence proposal and lifetime

Existing RefreshToken has token hash, userId, expiresAt and timestamps; auth repository stores undeclared revokedAt/replacedByTokenId. There is no stable session object today. A rotating token row should not be duplicated into a separate mobile-user database.

**Proposed decision:** one small `AuthSession` model inside the existing auth domain, plus extension of RefreshToken. It is justified by an independent revocation/lifetime anchor across rotations and session listing. Approval is required because it is new persistence; no collection or migration is created in Phase 0. Storing an evolving session anchor in a consumed refresh row would entangle token TTL with session lifecycle and make queries more fragile.

| Field | Where | Purpose |
|---|---|---|
| `id` / Session ID | AuthSession `_id` | Stable server identifier, JWT sid, revoke/list target |
| Session Family ID | Derived as session ID | Exactly one rotation family per session; **no second stored familyId** |
| `userId` | Session and existing token record | Authenticated owner |
| `installationId` | Session | Random install metadata; groups UI/debug lifecycle; no ownership proof |
| `platform` | Session | android/ios; current session model only serves native clients |
| `appVersion` | Session | Bounded release diagnostics/session display; no trust |
| `createdAt` | Session timestamp | Login time |
| `lastUsedAt` | Session | Login/successful refresh time |
| `expiresAt` | Session and every token | Absolute family expiry; no sliding extension in this proposal |
| `revokedAt` | Session | Authoritative family revocation marker |
| `authEpoch` | Session | Copy of user's `mobileAuthEpoch` at issuance |
| `mobileAuthEpoch` | User, default 0 when absent | Atomic native logout-all/revocation barrier including racing rotation/login |
| `sessionId` | RefreshToken, optional for legacy web | Family reference; missing means legacy cookie credential |
| `token` | Existing RefreshToken | Keep current SHA-256 hash storage; never raw credential |
| `revokedAt` | Declare on RefreshToken | Token no longer valid for rotation |
| `replacedByTokenId` | Declare on RefreshToken | Rotation successor; distinguish consumed token from generic revocation |

No hardware ID, biometric template, patient selection, push token, full clinical profile, geography or raw credential in session records. Push registration belongs to D, not AuthSession. No duplicate token-type field is necessary when sessionId identifies native records. Existing issued web record meaning and expiry remain unchanged.

Indexes proposed for review: existing unique token hash and expiry TTL; RefreshToken `(sessionId,createdAt)`; AuthSession `(userId,revokedAt,lastUsedAt,_id)` and expiry TTL. Installation is not unique: simultaneous logins are separate sessions, visible and revocable. TTL deletion is housekeeping only. Keep token rows until family expiry to recognize reuse during the active family lifetime; audit retention is separate. User epoch is not a timestamp or a device ID.

## C5. Atomic refresh algorithm and edge cases

1. Hash credential; find native token, owner and session. Validate body, absolute expiry, eligible account, session revocation and user epoch. All related reads/writes below occur with strict MongoDB transaction handling.
2. Conditional update token where it is still unrevoked/unexpired; mark revoked and set successor ID. If already replaced, reject and revoke session (family) under replay policy; no replacement is minted.
3. Insert exactly one new hashed refresh credential for the same session. Conditionally update active session `lastUsedAt` and validate epoch. Sign access token with sid and expiry bounded by session expiration; no external response before commit.
4. Commit all token/session/audit writes; send credentials once. Transaction retries never execute an HTTP send or external notification. No fallback to untransactional execution. If transaction support is missing, fail with 503 and keep old state.
5. Native resource authentication checks session.revokedAt/expiresAt, session.userId and epoch versus current user; patient grants are still checked for every resource.

For logout-all races, the user epoch is the linearization barrier: any session created with an earlier epoch is unusable even if its insertion races with a bulk revoke. Session revocation and refresh both write the same session document so a refresh cannot silently commit past a revoke. Never permit a later rotation to reset session.revokedAt.

| Scenario | Contract |
|---|---|
| Concurrent refresh with same token | At most one transaction rotates. Subsequent use is reuse; revoke family, require new sign-in. First response may become invalid immediately; native client single-flight prevents ordinary duplicate requests |
| Old token replay | Reject and revoke family; no token from that family remains usable. Scope does not revoke unrelated devices |
| Lost refresh response or process kill before secure save | Treat dispatch result as uncertain; reauthenticate. No replayable response blob stored server-side |
| Expired refresh/session | 401, clear credentials and return to login |
| Revoked session or logout-all epoch mismatch | 401; both old access and refresh rejected |
| Inactive/locked account | No login/refresh/resource access; revoke native session when detected; do not restore automatically on unlock |
| Multiple devices | Independent sessions/families; one session logout does not affect others |
| Reinstall | New installation ID. If secure secrets survived uninstall, clear them when installation marker is absent; no silent reuse; old server session expires/revokes separately |
| Account switch | End local old session, attempt revocation, clear caches/files/links, then new login. One active account in client; no secret bundle reuse across accounts |
| Offline | Retain session for network recovery unless user explicitly logs out; never claim offline authentication gives fresh resource permission |
| Rotation storage failure | Do not dispatch requests with a partially saved credential; revoke if possible then reauthenticate |

Strict recovery is a deliberate minimal design. Transparent lost-response recovery would require additional bound request identity and securely recoverable response/proof design; it is not silently assumed. Owner may request that alternative before implementation.

## C6. Guardian/dependent contract

`GET P/context` remains the source of account and accessible patient list. No “switch patient” mutation or new access JWT is needed. UI selects a returned patient ID, uses it in request/query keys, and the server resolves access again. The ID is a selector only.

| State | Proposed server decision | Mobile behavior |
|---|---|---|
| SELF with valid server linkage | Access under current active account/patient rules | Show self |
| PARENT/LEGAL_GUARDIAN + VERIFIED + revokedAt null | Access to that patient under existing permitted workflows | Show relationship and selected name/MRN |
| PENDING | No clinical/billing/file access | Not in accessible switcher; show pending management entry only if a future safe grant-status API is approved |
| REJECTED/REVOKED or revokedAt set | Deny | Remove local data and selection on 403/context refresh; never fall back to another patient on an action |
| Minor | Current server helper is under 15 | Follow server-required guardian flow; do not calculate a new legal threshold on device |
| No accessible patients | No fabricated patient record | Explicit access/setup/support state, not failed clinical request loops |
| Multiple dependents | Validate each independently | Persistent patient banner; mutation confirmation names intended patient |

**Legacy SELF clarification requiring approval:** context currently synthesizes SELF from `User.patientId` when no verified grant is returned, including when an explicit grant was revoked. Proposed precedence: an explicit PENDING/REJECTED/REVOKED grant denies; only absence of any explicit grant allows established legacy self linkage. Dental access checks must use the same policy rather than independently checking only `status=VERIFIED` or bypassing via user.patientId. Do not change grant semantics only in a mobile UI.

Patient switch sequence: confirm/discard any unsaved patient-specific form -> cancel old patient requests -> change selected ID -> reset patient-specific navigation/form state -> fetch new data using keys containing authenticated account and patient -> ignore late old responses. Refresh context on resume/403. Do not persist health records for old dependents. Account switch is a separate auth operation as C5 describes.

New grant creation remains Phase 2. Existing link MRN+DOB+consent yields VERIFIED today; fixed `1234` adds no proof of guardian authority. Owner must approve proof/review workflow rather than mobile inventing one. There is no proposed pending-grant management endpoint in MVP.

## C7. Login-phone change — future proposed contract

Keep out of MVP until approved. Generic profile edit must not change an authentication identifier through a bypass. In the current implementation, owner profile phone update can write User.phone and attempt refresh invalidation; contacts and login identity must be explicitly separated. Existing web UI stays untouched in Phase 0; later backend behavior changes require a compatibility decision and testing for web callers.

Proposed environment flow, **not phone-possession verification**:

1. Signed-in account opens Security -> Change login phone. Target is authenticated user, never selected dependent.
2. `POST M/phone-change/request` with native bearer and `{newPhone}`. Require recently authenticated session (proposed five-minute window, approved duration pending); otherwise require login first. Check normalization and collision without exposing another user. Reuse OTP service machinery, fixed `1234`, cooldown and rate limits, but store a purpose-bound challenge; do not send anything externally.
3. 200 `{data:{changeId,resendAvailableAt,expiresAt}}`. Bind changeId to user, session, current phone/version, new phone and purpose. Default TTL five minutes; neither code nor registration token becomes a universal change credential.
4. `POST M/phone-change/confirm` with bearer and `{changeId,otp:"1234"}`. Check purpose/owner/session/expiry/attempts, unchanged original identity and target uniqueness. Conditional consume and identity update/audit/revocation must commit atomically. A general login challenge must not authorize this operation.
5. Return `{data:{ok:true,reauthenticationRequired:true}}`; revoke all native sessions via epoch and existing account refresh records. Clear client state and login with the new phone. Current legacy web access JWT may last until expiry unless a separate all-client immediate-revocation change is approved; do not promise otherwise.

Proposed errors: 400 `VALIDATION_ERROR`; 401 `REAUTHENTICATION_REQUIRED`/`INVALID_OTP`; 403 `PHONE_CHANGE_NOT_ALLOWED`; 404 `PHONE_CHANGE_NOT_FOUND` for foreign/unknown change; 409 `PHONE_UNAVAILABLE`/`PHONE_CHANGE_STALE`; 429 current rate-limit errors; 503 transaction unavailable. Invalid/expired proof cannot update the phone. On ambiguous confirm timeout, do not issue a second identity change; require reauthentication/support reconciliation.

Minimal future storage: add purpose/owner/session/new-phone binding to existing challenge/proof persistence, not a new SMS or identity service; use a separate purpose namespace so general login does not consume the change proof. Define duplicate normalized-phone policy/index first because current records may share phones. Decide which patient contact fields, if any, follow the login change; never overwrite all dependent contacts. The fixed code cannot establish new number ownership, so this environment workflow is not a substitute for an owner-approved identity assurance policy for other environments.

## C8. Required acceptance before implementation can be accepted

Fixed request invokes no sender; expired/never-requested/wrong/consumed code denied; limits unchanged across web/mobile; web responses/cookies unchanged; native response never sets cookie; native and cookie refresh tokens not interchangeable; wrong role denied; no access token in URLs; native JWT sid/epoch checked on old resource routes; rotation race/replay/expiry/locked account; lost response policy; revoke current/foreign/other session; logout-all race; no standalone transaction fallback; no raw credentials in logs/database; same browser flow still works. Schema/interface and repository strictness tests must prove persisted revocation rather than relying on TypeScript casts.
