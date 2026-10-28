# Minor Guardian Login Error Investigation

Investigation date: 2 October 2026. Repository revision: `c1bebf5f218bf24989c9166e0006a466da8fad16`.

Scope: read-only code/log investigation and this report only. The Patient Mobile / Patient Web protection rules were read before tracing authentication. No authentication, validation, configuration, test, or database changes were made. No builds, Expo exports, or EAS operations were performed.

## 1. Executive Summary

The error originates in a shared backend classification of an **unlinked patient found by phone**, before login creates a session. Both clients call `PatientPortalService.getUnlinkedPatientLoginStatus`, which delegates to `PatientPortalRepository.getUnlinkedPatientLoginStatus`.

The classification requires no non-deleted user matching the supplied phone, exactly one active non-deleted patient matching it, no active non-deleted user directly owning that patient through `user.patientId`, and a patient DOB whose eighteenth anniversary is still in the future. Web and mobile translate that result into HTTP 409 / `MINOR_GUARDIAN_ACCOUNT_REQUIRED`.

Two important code findings:

- Login uses **18**, whereas the registration service's minor helper uses **15**. This is a confirmed contract inconsistency, not proof that either threshold is the approved business rule or that it caused this incident.
- The login classifier does **not** read guardian profiles or access grants. Its error does not establish that a guardian relationship is absent; a guardian may already exist under another phone.

The screenshot confirms the observed response, but the affected account's DOB, linkage and actual deployment revision remain unverified. No matching local incident logs were found. Do not remove the validation. First correlate the deployed request and inspect the minimal account fields, then resolve the age policy before selecting a correction.

## 2. Confirmed Error Origin

### Throw sites

| Source | Function / route | Behavior |
|---|---|---|
| `apps/api/src/modules/auth/native-session.service.ts:29` | `NativeSessionService.login` | Lines 36–39 obtain status and throw 409; `MINOR_REQUIRES_GUARDIAN` maps to `MINOR_GUARDIAN_ACCOUNT_REQUIRED`. Message: “Complete account setup in Patient Web or contact reception”. |
| `apps/api/src/modules/patient-portal/patient-portal.routes.ts:469` | `POST /api/patient-portal/login/otp` | Lines 481–486 translate the same status to 409 with the explicit minor/guardian message. |
| `apps/api/src/modules/patient-portal/patient-portal.service.ts:538` | `getUnlinkedPatientLoginStatus` | Delegates directly to the repository. |
| `apps/api/src/modules/patient-portal/patient-portal.repository.ts:509` | `getUnlinkedPatientLoginStatus` | Contains the actual database predicates and age calculation. |

### Exact classifier sequence

1. Build `phoneFilter = buildPhoneMongoFilter(phone)`.
2. `UserModel.exists({ deletedAt: null, ...phoneFilter })`: if true, return `null`. This first query does **not** require an active account, a portal role, or a patient link.
3. Query `PatientModel` with `{ deletedAt: null, status: 'ACTIVE', ...phoneFilter }`, selecting `dateOfBirth` (and implicit `_id`), limiting to two.
4. Zero patients returns `NEW_PATIENT_REQUIRES_REGISTRATION`; more than one returns `MULTIPLE_PATIENT_MATCHES`.
5. For the single patient, check `UserModel.exists({ patientId: patient._id, status: 'active', deletedAt: null })`. If true, return `null`.
6. Construct a date from `patient.dateOfBirth`, call `setFullYear(getFullYear() + 18)`, and compare it to `new Date()`. A future anniversary returns `MINOR_REQUIRES_GUARDIAN`; otherwise return `ACCOUNT_NOT_LINKED`.

Fields read by this classifier: user `phone`, `deletedAt`, `patientId`, `status`; patient `phone`, `deletedAt`, `status`, `_id`, `dateOfBirth`. There is no stored minor flag, guardian relationship lookup, guardian-consent lookup, or account-setup-completed flag in this decision. It combines DOB-derived age, patient status, phone matching, and direct user linkage.

`apps/api/src/utils/phone.ts` uses phone variants and a suffix regex, including last-ten-digit and Indian-prefix variants. Diagnosis must reproduce this filter, not assume exact string equality. Birthday calculations use JavaScript local-calendar date methods, not a separately configured age policy.

## 3. Backend Execution Path

The native route is registered in `apps/api/src/modules/auth/native-auth.routes.ts:16` under `/api/patient-portal/mobile/auth/login/otp`. The screenshot omits the API base prefix, consistent with the client's relative endpoint.

Native login validates its schema and fixed-verification configuration, calls `assertOtpValidForPendingFlow`, checks the native verification requirement, then classifies the account. The reported 409 is thrown **before** `verifyAndConsumeOtp`, `AuthService.loginPatientAfterOtpVerification`, native token creation, or profile loading.

Web follows the same preliminary OTP validation and classification. The pending-flow helper delegates to `PatientOtpService.assertValidForPendingFlow` (`patient-otp.service.ts:124`), which enforces verification limits and validates the challenge without consuming it. Therefore “before session creation” does not mean no authentication-related state can change: rate-limit accounting and invalid-attempt handling are separate concerns.

After successful classification, OTP consumption provides server-side proof to `AuthService.loginPatientAfterOtpVerification` (`auth.service.ts:196`). That method resolves the user, rejects inactive/locked or non-portal identities, and issues tokens. None of these later failures is the reported minor code.

`apps/api/src/middleware/error-handler.ts` serializes `AppError` as its HTTP status and `{ error: { code, message, requestId } }`. It logs exception details only for 5xx errors. This 409 throw does not itself emit an account-identifying audit event; later auth-success/denial audit paths are not reached.

## 4. Patient Web vs MyCare Mobile Authentication Comparison

| Step | Patient Web | MyCare Mobile |
|---|---|---|
| OTP request | `auth-api.ts` → `/patient-portal/otp/request` | `auth/auth-api.ts` → same endpoint |
| OTP submission | `PatientLoginPage` → `AuthContext.loginWithOtp` → `/patient-portal/login/otp` | `SessionManager.verifyOtp` → `AuthApi.login` → `/patient-portal/mobile/auth/login/otp` |
| Shared validation | Portal pending OTP helper and unlinked-patient classifier | Same helpers, with native fixed-verification checks |
| Minor response | 409 with explicit guardian-account explanation | 409 with account-setup/reception message |
| Recovery behavior | `PatientLoginPage.tsx:82` catches this code, obtains a registration proof via `/otp/verify` when needed, and navigates to `/signup?mode=guardian&verified=1` | `session-manager.ts:139` restores the OTP screen with friendly message and diagnostic details |
| Unlinked adult | Web can call `activateExistingPatientByPhone` before signing in | Any non-null classification blocks native login; native login deliberately does not activate accounts |
| Successful session | Browser access token plus HttpOnly refresh cookie | Native session/token response, session metadata and mobile-audience access token |

The same error in both clients is supported by their shared classifier. Their recovery UX differs: current Web code is intended to continue guardian activation, so a persistent Web error screen needs separate evidence (deployment version, registration-proof response, activation response).

Mobile has a legacy fallback to the Web endpoint on HTTP **404 only** (`auth-api.ts:152`). A 409 does not trigger that fallback. It cannot explain or repair this incident.

Mobile `api/transport.ts` preserves the server code/request ID and `api/errors.ts` generates the `MOB-` diagnostic ID locally. HTTP 409 is classified as non-retryable by default. “Retryable: No” means automatic retry is not advised; it does not mean legitimate account setup can never resolve the condition.

## 5. Affected Account Findings

Verified only from the supplied screenshot/request: diagnostic `MOB-79715B`, server request `req-a3`, timestamp `2026-10-01T12:12:06.642Z`, native OTP endpoint, HTTP 409 and the exact minor-account code. The phone is intentionally not reproduced here.

Available repository `.log` files, including hidden runtime logs, were searched for the diagnostic ID, request ID and supplied timestamp; none matched. A client-generated diagnostic ID is not inherently a server log correlation key. `req-a3` must be correlated with deployment/process and time, rather than treated as a globally unique patient identifier.

No production log connection or verified incident database was established. Local environment filenames do not establish that a database is the incident environment. No database was queried or modified, and no patient identity, DOB, account status, grants, or setup history is claimed as verified. No secrets or authentication values are included in this report.

For a read-only follow-up, correlate the deployment revision and request first. Reproduce the repository phone filter with bounded results; inspect only matching user IDs/status/deletion/patient linkage and role eligibility, matching patient IDs/DOB/status/deletion, then grants for those IDs (`userId`, `patientId`, `relationship`, `status`, `revokedAt`) and necessary guardian-profile/consent-presence metadata. Avoid medical records and identity-document values. Report age band and linkage findings rather than raw personal data.

## 6. Registration and Guardian Rule Analysis

| Flow | Implemented rule |
|---|---|
| New self-registration with `selfProfile` | `PatientPortalService.register`, line 440 onward, rejects under 15 through `isMinor` (line 94); existing-contact activation checks precede that guard. |
| Explicit existing-patient activation | `activateExistingPatient`, line 519 onward, verifies MRN/phone/DOB/active patient, then rejects under 15. |
| Unlinked phone login | Repository line 509 onward uses under 18. |
| Automatic adult activation by phone | `getUniqueUnlinkedAdultPatientByPhone`, line 538 onward, requires 18+, unique patient, and no existing direct owner or verified access grant. |
| Guardian activation from matching phone | `getUnlinkedMinorByPhone`, line 570 onward, requires a unique active patient under 18 and no user at that phone. |
| Web new-dependent form | `PatientSignupPage.tsx:100` uses under 15 for the ordinary new-dependent mode; forced guardian activation follows a different branch. |
| Two-step profile completion | `completePatientProfile`, line 600 onward, uses the under-15 helper and requires guardian emergency-contact name for minors; it is not identical to rejecting minor self-registration. |

New guardian registration requires consent, creates a GUARDIAN account and guardian profile, and optionally creates a dependent plus a VERIFIED relationship grant in the portal transaction. Existing-minor activation (`activateGuardianForMinor`, line 571) creates the guardian user, then transactionally upserts its profile, ensures the grant, and audits the link. User creation precedes that latter transaction: partial setup after failure deserves a separate test, but a surviving user matching the phone would bypass this classifier and would not by itself explain the exact 409.

`linkExistingDependent`, line 655 onward, requires a guardian context, legal consent and a matching active patient's MRN/DOB; it creates the grant and audit in a transaction. `ensureAccessGrant` (`repository.ts:864`) upserts VERIFIED access and clears revocation. Guardian relationships are separate from `user.patientId`; the login classifier checks the latter and never checks the former.

A hospital-registered patient can legitimately hit this gate when there is a patient record but no matching portal account. A patient aged 15–17 can be eligible for the explicit activation path but classified as requiring a guardian by phone login. A patient already accessible to a guardian using another phone can still trigger the same code from the child's record phone. These are code-supported possibilities, not account findings.

The guardian safeguard is deliberate (explicit code and an integration test). The 15/18 inconsistency is a potential implementation defect requiring an approved policy decision. No conclusion is drawn that blocking minors is itself wrong.

## 7. Root Cause

**Confirmed code-level cause:** the shared repository returns `MINOR_REQUIRES_GUARDIAN` under the predicates in section 2; each endpoint maps that to the observed code. It is an account-resolution gate, not a token-storage or later profile-loading failure.

**Incident-specific cause remains unproven.** Assuming the deployed code matches this revision, ranked hypotheses are:

1. **Expected incomplete portal activation for an under-18 hospital patient.** Directly matches the implemented gate. Missing: incident patient DOB and account-linkage records.
2. **15–17 age-policy inconsistency.** The two thresholds are confirmed; it could send an otherwise self-activation-eligible patient into guardian setup. Missing: actual age and approved threshold.
3. **Existing guardian uses another number, or patient contact/DOB/linkage data are inconsistent.** The classifier ignores grants and uses broad phone matching. Missing: verified guardian identity, grants, actual phone-match set and DOB provenance.
4. **Deployment differs from the inspected checkout or Web recovery fails independently.** Missing: deployed revision and Web network trace. This can explain a Web experience that does not follow the current guardian continuation path.

Multiple matching active patients and an inactive user matching the phone lead to other branches, so they must not be reported as proven causes of this exact code.

## 8. Impact

The gate affects Web and native OTP login for uniquely matched active patients under 18 without a phone-matching user or active direct owner. It includes newly hospital-registered minors and potentially the 15–17 cohort. A matching existing user skips this age classification; subsequent account eligibility and patient-resource authorization still apply. This is not a blanket prohibition on all guardian or minor-related accounts.

Mobile users cannot complete activation through this login endpoint. Web offers a guardian continuation. A repeated OTP login without changing the relevant setup will normally reach the same gate. The number of affected users cannot be estimated without production evidence.

## 9. Existing Test Coverage and Gaps

Tests were inspected, **not executed**. Integration suites create/delete fixture database records; this investigation kept the user's no-database-modification scope strict. No test or production file was changed. No typecheck/lint/build or live-login acceptance is claimed for this report-only task.

| Test source | Observed coverage |
|---|---|
| `apps/api/src/modules/patient-portal/patient-atomic-signup.test.ts` | Under-15 self-registration rejection without creating user/patient; duplicate rollback; two-step registration compatibility. |
| `apps/api/src/modules/patient-portal/patient-refresh-session.test.ts:248` | Web minor 409, challenge remains unconsumed, guardian activation and refresh-cookie session. Also existing-patient activation and normal Web session lifecycle. |
| `apps/api/src/modules/auth/native-auth.integration.test.ts` | Native session creation, invalid/expired/reused OTP, account eligibility, existing GUARDIAN role, rate limits, and Web cookie compatibility. Guardian identity test succeeds with zero grants; it is not proof of dependent access. |
| `apps/patient-web/src/pages/PatientLoginPage.test.tsx` | OTP request timing, retry/resend, delivery errors; no dedicated guardian continuation test found here. |
| `apps/patient-web/src/auth/auth-api.test.ts`, `auth-refresh.test.tsx` | OTP client and browser-session contracts. |
| `apps/patient-mobile/src/auth/auth-api.test.ts`, `session-manager.test.ts` | Native endpoint contract, 404 fallback, session and registration behavior. |
| `apps/patient-mobile/src/api/transport.test.ts`, `errors.test.ts` | Error parsing, request IDs, generated diagnostic IDs, retryability and redacted diagnostics. |

No explicit native `MINOR_GUARDIAN_ACCOUNT_REQUIRED` assertion or comprehensive shared-classifier matrix was found in the searched test sources. Gaps include 15/18 birthday boundaries, all 15–17 paths, guardian on another number, verified/pending/revoked grants, phone variants/collisions, incorrect DOB, and failure between guardian user creation and link transaction. Dedicated Web guardian-proof/activation failure and mobile exact-409/no-session tests are needed. Existing coverage was located by source inspection; it is not a claim that these tests currently pass.

## 10. Recommended Fix Options

No option is implemented.

1. **Complete approved existing activation for a genuinely unlinked minor.** Verify identity and use guardian activation/reception workflows. Lowest code impact; risks are duplicate guardian accounts or incorrect linkage if existing grants are not checked first. Do not create another account simply from the error text.
2. **Align the age policy after owner approval.** Reconcile login, explicit activation, registration, profile completion and guardian UI at the chosen threshold. Benefit: consistent treatment of 15–17-year-olds. Risk: changing who may obtain direct access; requires regression tests and an explicit decision on existing accounts. Do not simply change 18 to 15 because login is blocked.
3. **Improve account-resolution guidance while preserving authorization.** Distinguish supported setup scenarios internally and direct the person to the verified guardian identity or reception. Do not authenticate a different guardian merely because their grant references a patient with this phone. Avoid disclosing other account details through a public error.
4. **Strengthen guardian-activation atomicity/recovery separately if confirmed.** Include user creation in supported transaction semantics or provide an approved recovery path. Prevents partial setup, but is broader than the proven login gate and must preserve Web contracts.
5. **Improve mobile recovery messaging and targeted regression coverage.** Make the existing Web/reception next step actionable after approval. This improves usability but does not correct DOB, grants, or an age-policy mismatch.

Recommended sequence: verify incident records and deployed revision, agree the age contract, then choose the smallest justified data-workflow or code correction. Keep the minor validation enabled throughout.

## 11. Files That Would Need Changes

Conditional on the approved option; none changed in this investigation:

- Age-policy alignment: `apps/api/src/modules/patient-portal/patient-portal.repository.ts`, `patient-portal.service.ts`; corresponding Patient Web signup/profile validation files only where the approved rule requires it.
- Classification/recovery response changes: `apps/api/src/modules/patient-portal/patient-portal.routes.ts`, `apps/api/src/modules/auth/native-session.service.ts`; preserve existing Web contracts.
- Guardian transaction recovery: portal service/repository and existing user account service/repository after reviewing supported transaction contracts.
- Approved UX recovery: `apps/patient-web/src/pages/PatientLoginPage.tsx`, `PatientSignupPage.tsx`; `apps/patient-mobile/src/auth/session-manager.ts` and the existing OTP/error screen components as needed.
- Tests: existing API signup/refresh/native integration suites, Web login tests, mobile auth/session/error suites listed above.

An operational activation option may require no source change. No schema migration or dependency upgrade is established as necessary.

## 12. Verification Plan

1. Obtain a read-only incident correlation with timestamp, process/deployment and deployed revision. Inspect the minimal fields in section 5; retain redacted evidence.
2. Confirm the intended threshold and guardian-access contract with the owner. Evaluate age at the incident time, not merely today's age.
3. In a separately approved isolated test environment, test age just below/on/above 15 and 18; no/one/multiple patients; active/inactive/deleted users; direct owners; guardians with same/different phone; grant status and revocation; phone formatting and DOB errors.
4. Verify the exact 409/error message mapping on both endpoints, no session issuance on failure, and OTP-consumption behavior. Test Web guardian continuation, proof failures, successful activation and subsequent native login.
5. Test activation rollback and retry without duplicate accounts/grants. Verify independent resource authorization for guardians and no clinical-data disclosure in errors.
6. For any future implementation, run project-required API/Web checks plus Patient Web and mobile focused regressions and live workflows in the approved test environment. Preserve browser HttpOnly refresh behavior and native session semantics.

Only this investigation report was added. The issue is not claimed fixed, and no implementation phase or next phase has started.
