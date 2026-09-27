# PATIENT MOBILE APPLICATION — PHASE 1 NATIVE AUTHENTICATION BACKEND REPORT

25 September 2026. Original commit: `e9c93b2d408fde68cd34730b5ad71e8ed1c57f39`.

## A. Implementation summary

Implemented additive native existing-account OTP login, transactional refresh rotation and current-session logout. Reused the existing HMS backend, MongoDB connection, RefreshToken collection, JWT implementation, OTP challenge machinery, patient identity checks, public auth-user response and audit/rate-limit infrastructure.

Native sessions have independent revocation and an absolute lifetime across rotations. Native authentication checks session validity on existing authenticated resource routes. Existing browser cookie credentials cannot be exchanged through native refresh, and native refresh credentials cannot be exchanged through browser refresh.

No Patient Web/UI/domain/grant/profile changes, new connection/collection/migration, package installation, mobile project, SMS integration, push/device infrastructure or deployment. The earlier request to run all three applications is also satisfied: API health, staff web and patient web returned HTTP 200 in live smoke checks.

## B. Authentication contract

Full request/response/error/lifetime/retry documentation: [AUTHENTICATION_CONTRACT.md](AUTHENTICATION_CONTRACT.md).

```text
Existing POST /api/patient-portal/otp/request
  -> enter 1234
  -> POST /api/patient-portal/mobile/auth/login/otp
  -> access JWT + opaque refresh credential + session metadata
  -> existing authenticated patient APIs
  -> POST /api/patient-portal/mobile/auth/refresh
  -> POST /api/patient-portal/mobile/auth/logout
```

Login additionally requires random installation UUID and platform (`android|ios`); appVersion is optional. These identify session metadata, never authorization. Native endpoints return no cookie and use no-store responses.

Phase 0 adjustment, justified before implementation in [GAP_NOTE.md](GAP_NOTE.md): retain a stable anchor in the initial RefreshToken row rather than introducing AuthSession. Every family row has the same absolute expiry, so TTL cannot remove the anchor while the family remains usable. No separate family ID or user epoch is needed for current-session logout. Logout-all, session listing and remote revocation are explicitly deferred under the prompt's minimum-capability option; no endpoints/UI for them were created.

## C. Patient Web compatibility

Web routes, request/response schemas, cookie adapter, frontend API client, memory token storage and refresh behavior are unchanged. Browser responses still omit refreshToken/refreshExpiresIn and continue setting/replacing/clearing the existing HttpOnly cookie.

The shared AuthService issuance callback defaults to its original implementation; only native login supplies another issuer. Legacy access JWTs retain the same claims and path. Additional native aud/sid fields use the existing signer/secret, not a second JWT system.

Native fields are optional with no defaults on browser refresh rows. The legacy top-level revocation fields were deliberately not added to the schema: doing so would unintentionally alter the existing profile phone-update path. Existing AuthRepository strict:false revocation remains in place and is respected for native sessions too.

The limiter's insertion-race retry is opt-in only for native refresh/logout. Existing OTP/web callers continue using their original duplicate-key handling. Compatibility tests exercise web OTP request/login, public response shape, authenticated context, cookie refresh and logout alongside native sessions. No existing test assertion was changed.

## D. OTP

```text
OTP = 1234
SMS integration = NONE
External provider = NONE
```

These statements describe the Phase 1 fixed-code flow. Existing fixed mode already bypasses the sender, so OTP service/repository/environment configuration were not changed. Tests spy on the existing sender and assert zero invocation during fixed-code requests and the complete web flow. Existing unrelated sender abstraction remains intact. Expiry, cooldown, identity/IP limits, maximum failures and single-use challenge consumption remain enforced. Native login fails closed if fixed-1234 configuration is absent; retain the existing fixed settings when running this environment.

## E. Security

- Refresh credentials contain 48 random bytes; only their SHA-256 hashes are persisted. Access uses the existing JWT secret and algorithm, with native audience and stable session ID.
- Rotation conditionally consumes one token, updates its session anchor, inserts one successor and writes audit in a snapshot/majority MongoDB transaction. Strict helper never retries without a session. Actual standalone MongoDB test proves 503 with no token left behind.
- Old-token replay commits family revocation before returning an error. Concurrent rotation can produce at most one replacement; a competing replay invalidates that family. Lost-response retry therefore requires fresh login. No plaintext recovery cache.
- Current logout accepts independent refresh proof even when access expired. Proof determines account/session; mismatched valid credentials are rejected. Refresh-proof logout is repeatable and cannot revoke other mobile/web sessions. Concurrent logout/refresh leaves no usable replacement.
- Session expiry/revocation and current active patient/guardian eligibility are checked on native access and refresh. Ineligible detection revokes the native session; subsequent reactivation does not restore it.
- Existing grant authorization remains authoritative. Patient selection, platform and installation ID are never authority. Native bearer query-string transport is rejected; header transport is required.
- Credentials are absent from native audit metadata and response allowlists exclude internal fields. Native refresh/logout rate-limit keys are HMAC-derived; the new optional insertion-race retry cannot increment an exhausted bucket.

## F. Verification

All database-mutating integration tests ran against isolated MongoMemoryServer/replica-set instances. The configured development database was inspected only for transaction topology during preparation: writable replica set, logical sessions supported. Production transaction permissions/deployment were not tested or changed.

| Test/check | Result |
|---|---|
| Pre-edit targeted baseline without fixed env settings | 90 passed / 5 failed; two 503 failures from default non-fixed OTP mode plus three catalogue failures |
| Pre-edit targeted baseline with existing fixed-1234 settings | 92 passed / 3 catalogue failures; 20 files |
| Full API + Patient Web run | 632 passed / 15 failed; 97 files (92 passed / 5 failed); 586.85 seconds |
| Original-commit reproduction of all four failing dental suites | Same 12 failing test names; 107 passed / 12 failed, 119 tests; verified failure-name sets identical |
| Final focused native/auth/OTP/portal/Patient Web auth rerun | PASS: 92 tests, 12 files, 54.84 seconds |
| New native replica-set and strict standalone tests | PASS: 30 tests, included in focused result |
| Final full Patient Web rerun | 44 passed / same 3 baseline catalogue failures; 14 files (13 passed / 1 failed) |
| API typecheck / build | PASS after limiter adjustment |
| Staff Web typecheck / build | PASS |
| Patient Web typecheck / lint / build | PASS |
| API full lint | FAIL: three existing errors in two untouched dental test files |
| Staff Web full lint | FAIL: one existing error in untouched dental-pdf.ts |
| All Phase 1 added/modified source files, ESLint | PASS after limiter adjustment |
| Live HTTP smoke | API `/api/health` 200; staff web :5173 200; patient web :5174 200; empty native refresh 400 with no-store and no cookie |
| Git whitespace/scope checks | No whitespace errors; Patient Web, clinical/profile/grant/config/package files unchanged; no apps/patient-mobile |

The broad run preceded the final native-only limiter adjustment. A focused rerun exposed a real intermittent Phase 1 issue (fresh rate-limit bucket collision returned 429 before replay handling); it was fixed with the opt-in conditional retry, not by weakening the concurrency assertion. The final scoped tests and full Patient Web tests were rerun after that fix. The newly added rate-window tests now freeze Date only (network timers remain real) to prevent crossing a legitimate ten-minute bucket reset during the assertion sequence; limits/assertions are unchanged. The full backend suite was not repeated after this localized fix; all affected auth/OTP/portal and web authentication suites were.

Commands (PowerShell test processes use existing fixed-code settings, without editing env files):

```powershell
$env:PATIENT_PORTAL_DEMO_OTP_ENABLED='true'
$env:PATIENT_PORTAL_DEMO_OTP='1234'
$env:LOG_LEVEL='silent'
npx vitest run apps/api apps/patient-web --maxWorkers=3
npx vitest run apps/api/src/modules/auth apps/api/src/modules/patient-portal apps/patient-web/src/auth apps/patient-web/src/api/patient-portal.test.ts --maxWorkers=2
npx vitest run apps/patient-web --maxWorkers=3
npm run typecheck --workspace=@hms/api
npm run lint --workspace=@hms/api
npm run build --workspace=@hms/api
npm run typecheck --workspace=@hms/web
npm run lint --workspace=@hms/web
npm run build --workspace=@hms/web
npm run typecheck --workspace=@hms/patient-web
npm run lint --workspace=@hms/patient-web
npm run build --workspace=@hms/patient-web
```

Baseline comparison used an isolated git archive of the original commit under the OS temporary directory, reusing installed dependencies without modifying the working tree. Logs are under `C:/Users/lenovo/AppData/Local/Temp/`: `hms-phase1-fixed-baseline.log`, `hms-phase1-full-tests.log`, `hms-phase1-dental-baseline.log`, `hms-phase1-auth-final.log`, `hms-phase1-patient-final.log`, `hms-phase1-api-typecheck-final.log`, `hms-phase1-api-build-final.log`, `hms-phase1-owned-lint-final.log`, and the api/web/patient lint/build logs. Runtime acceptance is automated HTTP injection against real test MongoDB plus live HTTP smoke; no manual browser login or native-device test is claimed.

### Precisely identified baseline failures

| File | Count / finding |
|---|---|
| `apps/patient-web/src/pages/PatientWebsitePage.test.tsx` | Three duplicate catalogue-request assertions at 138, 176, 228; reproduced before source changes |
| `apps/api/test/dental-prosthetic-lab-order.test.ts` | Five lab/stage readiness and progression assertions (tests 15, 16, 17, 23, 24); all reproduced on original commit |
| `apps/api/test/dental-e2e-quotation-workflow.test.ts` | Four scheduling/conflict/progression/episode-completion assertions (steps 6, 7, 8, 12); all reproduced on original commit |
| `apps/api/test/dental-stage-appointment-scheduling.test.ts` | One appointment-scheduling assertion, test 4; reproduced on original commit |
| `apps/api/test/opd-dental-examination.test.ts` | Two assertions: independent treatment-plan update/delete and invoiced-item source identity; both reproduced on original commit |
| `apps/api/test/dental-quotation-patient-portal-sync.test.ts:49` | API lint: unused planItemScalingId |
| `apps/api/test/dental-treatment-staging-validation.test.ts:333` and `:334` | API lint: two explicit-any errors |
| `apps/web/src/utils/dental-pdf.ts:150` | Staff lint: useless assignment to schedLabText |

Failing lint files and Patient Web source/test files match the original tracked contents; no cleanup or assertion changes were made outside scope. Frontend builds emitted existing chunk-size warnings; Patient Web also warned about static/dynamic jsPDF imports.

## G. Every source/document file changed by Phase 1

### Files added

- `apps/api/src/modules/auth/native-auth.routes.ts` — three native endpoints, Zod parsing, cache/body limits.
- `apps/api/src/modules/auth/native-auth.schemas.ts` — native request and allowlisted response contracts.
- `apps/api/src/modules/auth/native-session.repository.ts` — existing-connection strict transactions, token/session persistence and audit.
- `apps/api/src/modules/auth/native-session.service.ts` — native lifecycle, credential proofs, replay policy and native rate limits.
- `apps/api/src/modules/auth/native-auth.integration.test.ts` — replica-set authentication, concurrency, OTP, isolation, web and legacy-grant characterization tests.
- `apps/api/src/modules/auth/native-session-transaction.test.ts` — real standalone failure-without-fallback test.
- `PATIENT_MOBILE_PHASE_1/GAP_NOTE.md` — pre-edit scope/compatibility decisions and limiter finding.
- `PATIENT_MOBILE_PHASE_1/AUTHENTICATION_CONTRACT.md` — implemented endpoint/session contract and deferred scope.
- `PATIENT_MOBILE_PHASE_1/REPORT.md` — this verification report.

### Existing files modified

| File | Reason | Patient Web consumer / compatibility | Verification |
|---|---|---|---|
| `apps/api/src/modules/auth/refresh-token.model.ts` | Optional namespaced native metadata | Yes; legacy rows/defaults/top-level strictness/indexes unchanged | Legacy schema assertion, cookie regression and native persistence/replay tests |
| `apps/api/src/modules/auth/auth.types.ts` | Optional native marker on internal refresh record | Yes; no response-contract change | Typecheck and transport-isolation tests |
| `apps/api/src/modules/auth/auth.repository.ts` | Map native marker so web service rejects native refresh credentials | Yes; existing query/write behavior preserved | Cookie refresh and cross-transport tests |
| `apps/api/src/modules/auth/auth.service.ts` | Optional native issuer; native session validation; credential isolation | Yes; default issuer and legacy JWT path unchanged | Web OTP/login/refresh/logout/context, existing OTP/auth tests and native tests |
| `apps/api/src/modules/auth/auth-rate-limit.repository.ts` | Optional native first-insert race retry | Yes; option defaults off and existing callers unchanged | Deterministic contention/exhaustion/default-legacy assertions, real refresh concurrency, existing OTP/rate-limit tests |
| `apps/api/src/shared/security/jwt.ts` | Optional native aud/sid typing for existing signer | Yes; legacy generated payload unchanged | Legacy claim assertions and web/native authenticated routes |
| `apps/api/src/middleware/authenticate.ts` | Tell auth service whether token came from query | Yes; legacy query behavior preserved; native query rejected | Header/query native tests and existing web authenticated context |
| `apps/api/src/modules/index.ts` | Register additive routes | Yes; existing registrations retained | Full-app HTTP integration and live native-route smoke |

**Files deleted: NONE.** Build outputs under ignored dist directories and compiler caches were generated by the required checks, not edited manually. Pre-existing untracked Phase 0/readiness documents and user-supplied protection rules were preserved. No commit, push or deployment performed.

## H. Verified remaining risks / dependencies

1. Existing overall tests/lints remain red as listed above; Phase 1 tests are reported separately. These unrelated domains were not repaired under native-auth scope.
2. Verified legacy SELF fallback can authorize User.patientId despite an explicit revoked SELF grant. A characterization test preserves current behavior and rejects a different ungranted patient. Grant precedence requires separate approval; it was not changed.
3. Reinspection clarifies the Phase 0 age statement: the portal service helper uses 15, while repository account-activation checks use 18. Native existing-account login delegates the existing status method; no threshold was changed and no new activation flow was implemented.
4. Existing generic profile phone update and legacy revocation-schema inconsistency remain out of scope. Fixed 1234 is environment verification, not phone-possession proof.
5. Existing browser refresh rotation remains non-atomic; the new strict rotation applies only to native credentials. Legacy query-token transport also remains; native clients must use headers and never put credentials in URLs.
6. Strict replay policy requires reauthentication after ambiguous refresh delivery. OTP consumption before session issuance likewise requires a new challenge after issuance failure. These are documented failure/retry semantics, not transparent-recovery promises.
7. Remote device revocation/logout-all/session-list APIs are deferred. Current-session logout and absolute expiry are implemented; no mobile UI or native secure-storage behavior has been tested.

## I. Phase 1 status

**PARTIALLY COMPLETED.** Backend implementation and scoped verification are complete (92 focused tests pass). Repository-wide acceptance remains non-green due to the reproduced baseline failures and existing lint errors. No approval to proceed is inferred from implementation or successful scoped checks.

**STOP: Phase 2 has not started.** No mobile project, Expo/React Native setup, UI, history APIs, push/device/notification infrastructure, payments, phone/grant changes, Firebase or deployment work was performed.
