# G. Phase 1 Implementation Plan — Native Authentication Backend Only

**Status: NOT STARTED. This is the next phase proposal only.** It requires explicit approval of D03/D04/D11 and any amendments before code changes. It does not authorize creating `apps/patient-mobile`, installing Expo/RN, modifying Patient Web UI, adding clinical history APIs, or configuring push/Firebase/deployment.

## Objective

Implement and verify C's native session transport on the existing HMS identity/auth domain, using the existing fixed `1234` challenge flow, with browser-cookie contracts preserved. Produce a tested backend foundation usable by a later native app phase.

## Entry gates

1. Owner accepts the native endpoint/schema/lifetime/logout-all scope and strict lost-response/replay recovery policy in C, or supplies an amendment.
2. Owner approves minimal persistence: AuthSession anchor, optional RefreshToken.sessionId + declared revocation fields, User.mobileAuthEpoch. No schema/migration runs in Phase 0.
3. Controlled MongoDB replica-set test environment is available; no real patient database writes during tests. Target support for strict transactions must be verified before deployment, which is not in this phase.
4. Confirm this target uses the existing fixed-mode `1234` settings. Do not add delivery variables/credentials or sender integration. A mismatch is a fixed-mode environment configuration discrepancy, not an SMS prerequisite.
5. Record current git status and scope-owned gap note. Existing unrelated failures must be documented before acceptance claims.

## Work packages within this one phase

### 1. Contract and compatibility fixtures

- Capture existing web OTP login/session JSON and Set-Cookie attributes, refresh rotation, logout, signup/activation session behavior, and shared OTP request/verify responses.
- Define typed native request/response/error schemas from C, including rate-limit/expiry semantics and public user projection.
- Add tests proving `1234` requires an active challenge, invalid/expired/consumed challenges fail, cooldown/attempt/identity/IP limits remain, and fixed-mode requests never call an external sender. Use a fail-if-called test double; never send a real message.
- Confirm native login only permits patient/guardian eligibility. Preserve established matching/activation behavior without creating a second implementation; if existing service transaction boundaries prevent safe reuse, record the minimal needed extraction before editing.

### 2. Minimal auth persistence and repository work

- Add approved session schema/repository operations in auth domain; extend existing refresh schema and user epoch typing/default handling.
- Keep token hashes only, no recoverable refresh responses. Add reviewed indexes and expiry queries; TTL is cleanup, not auth enforcement.
- Implement atomic native issue/rotate/revoke using strict transaction semantics. Do not globally rewrite the shared fallback helper or let session operations fall back to nontransactional execution.
- Ensure OTP consumption and session issuance are atomic where coupled; pass sessions through relevant repository operations rather than accessing models from route/controller.
- Handle legacy web token records without sessionId unchanged. No forced migration or revocation of unrelated staff/web sessions simply to enable mobile.

### 3. Native adapters and access validation

- Reuse `POST /api/patient-portal/otp/request`; no new duplicate mobile request endpoint.
- Add C's native login, refresh, logout, logout-all, session list and revoke-one endpoints.
- Separate web/native response adapters; native sets no cookies, web reveals no refresh credential. Reject cross-transport token use.
- Extend typed JWT issuance/verification for native client marker/audience/sid. Existing resource middleware checks session/epoch for native tokens and rejects native query-string credential transport without breaking legacy web header/cookie contracts.
- Add bounded auth errors/audits; redact token/OTP/phone/payload from logs. Use existing Pino logging/audit infrastructure.

### 4. Revocation and retry behavior

- Implement single-family replay revocation; logout-all epoch barrier; immediate native access-session denial after revoke. Other accounts/devices/web sessions remain unaffected according to C.
- Ensure existing account password-change/reset revoke-all auth paths also invalidate associated native sessions when called, while keeping web routes/responses unchanged. Inventory direct refresh-token updates (e.g. profile edits) and document unresolved bypasses as later feature gates; do not quietly broaden into profile UI/phone workflow redesign.
- Prove concurrent refresh, refresh-versus-revoke, refresh-versus-logout-all, inactive/locked account, expired credential and current-session deletion behavior.
- Implement documented ambiguous/lost-response behavior in backend responses/tests; no server response-secret cache or hidden grace policy.

### 5. Verification and phase handoff

- Run focused unit/integration/HTTP tests against isolated fixtures and replica sets.
- Run project-required typecheck/lint/build checks for API and both existing frontends.
- Run the full existing Patient Web test suite and relevant/full backend suite as required by the supplied protection rules; do not limit regression evidence to new native tests.
- Perform available live web authentication regression using controlled test accounts in the fixed-code environment, including reload, logout/login, patient/guardian context and cookie attributes. Do not claim physical mobile tests: no app exists in this phase.
- Publish Phase 1 verification with endpoint schemas, file/shared-registry changes, index/deployment notes, test evidence and any remaining failures. Stop before any next implementation phase.

## Intended files/modules, subject to fresh inspection

| Area | Intended scope |
|---|---|
| `apps/api/src/modules/auth/` | Existing service/repository/schemas/types/refresh model; proposed native adapter routes/session model/repository methods/tests |
| `apps/api/src/modules/patient-portal/` | Reuse OTP and account eligibility; minimal shared login orchestration/session passing if required; fixed-mode tests |
| `apps/api/src/modules/users/user.model.ts` and related types | Approved native epoch field only |
| `apps/api/src/shared/security/jwt.ts` | Typed native claims and runtime validation, legacy compatibility |
| `apps/api/src/middleware/authenticate.ts` | Native session/transport validation integration only |
| Shared module/service registries | Register native auth/session wiring minimally; inspect concurrent edits first |
| Existing frontend tests | Compatibility assertions as needed; no UI implementation changes |
| Phase verification documentation | Native contract evidence and scoped completion report |

No appointment, billing, lab, imaging, dental, notification model/device API, file storage migration or mobile workspace work belongs to this phase. No environment/deployment changes are implicitly authorized by tests.

## Required checks

```text
npm run typecheck --workspace=@hms/api
npm run lint --workspace=@hms/api
npm run build --workspace=@hms/api
npm run typecheck --workspace=@hms/web
npm run lint --workspace=@hms/web
npm run build --workspace=@hms/web
npm run typecheck --workspace=@hms/patient-web
npm run lint --workspace=@hms/patient-web
npm run build --workspace=@hms/patient-web
npm run test --workspace=@hms/api
npm run test --workspace=@hms/patient-web
```

Focused tests must cover OTP, existing patient-refresh-cookie contracts, new native HTTP/session contracts, database revocation persistence, transaction rollback/failure, concurrency and auth projections, in addition to the full Patient Web regression suite. Record the prior catalogue-query failures if still present. Do not change unrelated UI behavior or test assertions to hide baseline failures. Never edit generated tsbuildinfo manually.

## Acceptance criteria

| Test | Required evidence |
|---|---|
| Fixed OTP | Request + `1234` succeeds for eligible fixture account; no request/wrong/expired/consumed code fails; no sender invoked |
| Web compatibility | Same web cookie attributes, response fields, refresh/logout behavior; no refresh token leaks to browser JSON |
| Native transport | Access+opaque refresh+session returned only by native route; no cookie; cross-transport credentials rejected |
| Scope | Native route denies staff-only user; patient resource access still resolves grants |
| Rotation | Concurrent requests cannot fork valid descendants; replay policy deterministic and documented |
| Lost response | No automatic recovery claim; old token reuse handled as C; clean reauthentication works |
| Transactions | Failed insert/audit/commit leaves no partially consumed/issued session state; standalone fails closed |
| Revoke | Current/other/foreign IDs, expired-access logout proof, logout-all epoch races and session-list privacy |
| Native resource access | Revoked/expired/epoch-stale native JWT denied on existing resource routes; legacy web still works |
| Logs/storage | Hashes only in database; no token/OTP/clinical payload logs; no bearer URLs |
| Quality | Required checks pass or precise unrelated baseline failure proof is documented under project rules; phase-owned failures are not accepted |

Completion report must list implemented functionality, reused code, changed/shared files, validation/transactions/authorization/audit/error behavior, verification evidence and remaining dependency decisions. It must explicitly confirm that the next phase has not started. No prompts or plans for all later phases are generated here.
