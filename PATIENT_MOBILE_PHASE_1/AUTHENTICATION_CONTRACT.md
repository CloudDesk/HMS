# Phase 1 — implemented native authentication contract

All paths use the existing HMS API. JSON success envelope is `{data: ...}`; errors retain `{error: {code, message, ...}}`. Native credential endpoints return `Cache-Control: no-store`, never set/clear cookies, accept at most 4096 body bytes and validate input with Zod. TLS is required outside local development. Native clients must omit browser cookies.

## Flow

Phone -> existing OTP request -> enter **1234** -> native login -> memory access token + securely stored refresh token -> existing authenticated patient APIs. Selected patient remains an authorization selector, never proof: existing server grant/ownership checks still run.

### Request OTP (existing, unchanged)

`POST /api/patient-portal/otp/request`, public, `{phone}`.

Returns `{data:{success:true,resendAvailableAt:ISODate}}`. No SMS in the existing fixed-code mode. Existing TTL (default 300 seconds), cooldown (60 seconds), request and verification identity/IP limits, maximum attempts (3) and conditional single-use consumption remain authoritative. Existing local configuration selects enabled fixed mode and `1234`; no environment file or sender implementation was changed. A deployment must retain these existing settings. Native login fails with 503 `FIXED_OTP_REQUIRED` if the configured mode is not fixed `1234`.

### Login

`POST /api/patient-portal/mobile/auth/login/otp`, public:

```json
{
  "phone": "<patient-phone>",
  "otp": "1234",
  "installationId": "<random UUID for this installation>",
  "platform": "android",
  "appVersion": "1.0.0"
}
```

Platform is `android|ios`; appVersion is optional, 1–40 characters. Installation ID is required metadata, not an authentication factor. Existing accounts only. The adapter reuses existing pending-flow validation, account status lookup, conditional OTP consumption and AuthService patient identity/eligibility checks. It injects native credential issuance instead of first creating a browser refresh token. No native signup, automatic activation or guardian linking is performed.

200 response:

```json
{
  "data": {
    "user": "<existing public auth-user object, including current access context>",
    "tokens": {
      "accessToken": "<existing-format HS256 JWT with native aud and sid>",
      "refreshToken": "<64-character opaque base64url credential>",
      "tokenType": "Bearer",
      "expiresIn": 900,
      "refreshExpiresIn": 604799
    },
    "session": {
      "id": "<server session ID>",
      "platform": "android",
      "appVersion": "1.0.0",
      "createdAt": "<ISO date>",
      "lastUsedAt": "<ISO date>",
      "expiresAt": "<ISO date>"
    }
  }
}
```

Numbers illustrate the default TTL; remaining whole seconds are calculated at issuance. Existing configured access TTL defaults to 900 seconds and refresh TTL to 604800 seconds. Every rotation retains the original absolute session expiry; access lifetime is capped by remaining session lifetime. The serializer uses the existing public user schema and explicit token/session allowlists.

Errors: 400 `VALIDATION_ERROR`; 401 `INVALID_OTP` or existing `INVALID_CREDENTIALS`; 429 `MAX_ATTEMPTS_EXCEEDED`/`AUTH_RATE_LIMITED`; 409 existing status (`NEW_PATIENT_REQUIRES_REGISTRATION`, `ACCOUNT_NOT_LINKED`, `MULTIPLE_PATIENT_MATCHES`, `MINOR_GUARDIAN_ACCOUNT_REQUIRED`); 403 `SESSION_NOT_ALLOWED` when transaction-time identity eligibility fails; 503 fixed-mode/storage failure. No credentials on failure. Login lost-response recovery requires a new OTP challenge, subject to cooldown. Existing OTP consumption is not undone if later issuance fails.

### Refresh

`POST /api/patient-portal/mobile/auth/refresh`, public credential proof, `{refreshToken}`. No access JWT required; cookies ignored. 200 has the same shape as login, same session ID/absolute expiry, a new access/refresh pair, and updated lastUsedAt.

Opaque refresh credentials are generated from 48 random bytes and only SHA-256 hashes are persisted. Within a strict MongoDB transaction the service validates token, session and current identity, conditionally consumes the old token, touches the session anchor, inserts one successor and records audit. Responses are returned after commit. No call to the shared standalone-fallback helper.

Every family token row has the same absolute expiry. The original token row is the stable session anchor even after rotation; replacing it does not revoke its session. Old hashes and replacement links remain until expiry for replay recognition. Reuse commits family revocation and audit, then returns 401 `REFRESH_TOKEN_REUSED`. Other families remain valid. Concurrent use yields at most one rotation; the competing request can immediately revoke the winner's family. Client single-flight refresh is therefore required. An ambiguous timeout/lost response must lead to reauthentication, not blind refresh retries. No stored plaintext response cache or grace period.

Errors: 400 validation; 401 `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_EXPIRED`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `REFRESH_TOKEN_REUSED`; 403 `SESSION_NOT_ALLOWED`; 429 `AUTH_RATE_LIMITED`; 503 `SESSION_STORE_UNAVAILABLE`. Unknown/legacy cookie refresh credentials cannot rotate through this endpoint. Native refresh credentials cannot rotate through the existing cookie endpoint.

Refresh/logout limits: 30 requests per credential-derived HMAC key per 60 seconds; 120 per IP per 60 seconds, through existing AuthRateLimitRepository. Raw credentials are not used as stored keys.

### Logout current native session

`POST /api/patient-portal/mobile/auth/logout` with `{refreshToken}`, **or** `{}` plus `Authorization: Bearer <valid native access token>`.

200 `{data:{ok:true}}`. A known refresh credential proves only its own user/session; current, rotated, expired (if not yet removed by TTL) or already revoked credentials can revoke that family. No caller-supplied patient/user/session ID is accepted. Unknown well-formed refresh proof returns generic success and changes nothing; malformed proof is 400. Missing all proof is 401. Native logout never touches web cookies or unrelated sessions.

If both proofs are supplied, a successfully verified, unexpired native JWT must match the refresh credential's account/session or return 400 `SESSION_CREDENTIAL_MISMATCH`. An expired access JWT is ignored when independent refresh proof is supplied. A malformed/invalid-signature/non-native bearer is rejected. Repeated refresh-proof logout is idempotent, including when the same now-revoked native access token accompanies it. Access-only logout requires an active native session, so repeating that form returns 401 after revocation.

Revocation and its audit event commit together. Session refresh and revocation contend on the same anchor, preventing a concurrent refresh from creating a usable family after logout commits. Access tokens are also rejected after server session validation sees revocation. Already executing resource requests are not retroactively cancelled.

## Persistence and JWT compatibility

No new collection, User field, index, migration or connection. Existing unique token-hash index and primary-key index cover all new queries; expiry TTL remains unchanged. Native token metadata is optional without defaults for web rows:

- `native.sessionId`: stable anchor/family ID, not a second family identifier.
- `native.replacedBy`: consumed token's successor ID.
- Anchor-only `native.session`: installationId, platform, optional appVersion, lastUsedAt, optional revokedAt.
- Existing userId, token hash, createdAt and expiresAt are reused.

The legacy schema still does not declare top-level revokedAt/replacedByTokenId. Existing auth repository strict:false writes continue to work and are honored by native authentication too; existing profile-update schema strictness remains unchanged. Declaring those legacy fields would have changed existing profile behavior, so it was intentionally avoided.

Native JWTs reuse the existing secret, HS256 signer/verifier and ordinary sub/username/iat/exp, adding only `aud: hms-patient-mobile` and `sid`. Middleware checks session ownership/revocation/expiry and current active patient/guardian eligibility for native tokens. Legacy JWTs without these fields follow the unchanged path. Native query-string bearer transport is rejected; clients must send the Authorization header. The existing legacy query-token behavior remains outside this phase.

## Deferred and client obligations

Logout-all/session list/remote revoke are deferred under Phase 1's minimum-capability option. They are not implemented endpoints. No user epoch is added until an atomic logout-all design is implemented. Session anchors expire automatically; current logout remains available on each device.

Future native client: access token in memory, refresh token in OS secure storage, serialize refresh requests, atomically replace secure credentials before resuming requests, clear credentials/caches/patient context on logout or account switch, and never put credentials into URLs. Offline logout clears local state but cannot promise server revocation. Reinstall gets a new random installation ID; it must not silently reuse surviving secure-store credentials. None of this creates mobile code in Phase 1.

PatientAccessGrant, dependent linking, existing minor thresholds, patient selection authorization and login-phone modification are unchanged. No business-domain logic is moved to the native transport.
