# Minor/Guardian Validation Removal Report

Date: 2 October 2026. Base revision: `c1bebf5f218bf24989c9166e0006a466da8fad16`.

Implemented the approved age-independent patient authentication requirement. The protection rules and investigation report were reviewed. This report supersedes the investigation's recommendation to retain the restriction pending a product decision: the subsequent user request explicitly supplied that decision.

## 1. Files changed

| File | Change |
|---|---|
| `apps/api/src/modules/patient-portal/patient-portal.repository.ts` | Remove age from login classification and automatic self-activation eligibility; rename helper to `getUniqueUnlinkedPatientByPhone`. |
| `apps/api/src/modules/patient-portal/patient-portal.service.ts` | Remove age rejection from self-signup, explicit existing-patient activation and self-profile completion; always create SELF linkage for one's own profile. |
| `apps/api/src/modules/patient-portal/patient-portal.routes.ts` | Remove the Web minor-login error branch. |
| `apps/api/src/modules/auth/native-session.service.ts` | Reuse existing verified-OTP activation for a unique unlinked patient before native session issuance; remove minor error mapping. |
| `apps/patient-web/src/pages/PatientLoginPage.tsx` | Remove forced guardian signup routing and age-specific automatic-linking copy. |
| `apps/patient-web/src/components/patient-portal/PortalPatientForm.tsx` | Allow SELF profile completion without guardian contact details; retain dependent-mode validation and optional self contact fields. |
| `apps/patient-mobile/src/ui/screens/RegisterScreen.tsx` | Remove the obsolete age-restriction hint. |
| `apps/patient-mobile/src/api/errors.ts` | Remove obsolete minor self-registration error wording. |
| `apps/api/src/modules/auth/native-auth.integration.test.ts` | Add 16 Web/native login and integrity regression cases. |
| `apps/api/src/modules/patient-portal/patient-atomic-signup.test.ts` | Verify minor self-signup and two-step profile completion create correct SELF linkage. |
| `apps/api/src/modules/patient-portal/patient-refresh-session.test.ts` | Cover adult/minor identity activation, mismatch and duplicates; retain voluntary guardian activation coverage. |
| `apps/patient-web/src/components/patient-portal/PortalPatientForm.test.tsx` | Add minor SELF form submission regression. |

No changes to native route/schema transport, database schemas, permissions, registries, dependencies, configuration, or prototype files. The earlier investigation report remains unchanged as historical evidence.

### Gap and reuse note

Reused existing OTP verification/consumption, patient matching, account creation, access-grant creation, portal transactions, browser refresh cookies and native token issuance. No new domain or infrastructure was needed. The age checks were distributed across the repository, service and Web profile form; mobile previously rejected all unlinked accounts. The change extends the existing Web activation workflow to native login after OTP consumption. The matching patient-registration prototype and existing form were inspected; no layout system was changed. This is an authentication correction, not a new Scope 2 clinical phase.

## 2. Validation removed and retained

Removed under-18 classification from shared login and automatic self-activation, under-15 self-registration/explicit activation rejection, and age-conditioned guardian requirements in self-profile completion. The self-profile grant is now SELF regardless of DOB. No production source still emits `MINOR_GUARDIAN_ACCOUNT_REQUIRED`.

Retained OTP request/challenge validity, expiry, consumption and rate limits; account status/lock and portal-role checks; active/non-deleted patient matching; multiple-match conflicts; existing direct ownership and verified-grant checks on automatic activation; uniqueness checks during account creation; authenticated patient authorization; branch validation; guardian consent and dependent relationship workflows. DOB remains an identity field for explicit activation.

Age checks defining optional guardian features (guardian activation lookup, guardian-profile editing, child/dependent presentation) remain. They do not prevent creating or logging in to one's own patient account. Existing guardian records are not migrated, deleted, or converted.

## 3. Login before and after

| Case | Before | After |
|---|---|---|
| Unique unlinked patient under 18, valid OTP, no ownership conflict | Web/native minor-account 409 | Web/native activate a PATIENT account with SELF grant and log in. |
| Unique unlinked adult, valid OTP | Web activates; native returns setup-required | Both reuse the same activation eligibility and service. |
| Already eligible patient or guardian account | Existing login flow | Same account-status, OTP and token checks. |
| Missing/invalid OTP | Rejected | Rejected before account activation. |
| Inactive/locked account | Rejected | Rejected; no session issued. |
| Multiple active patient matches | Conflict | `MULTIPLE_PATIENT_MATCHES`; no account/session creation. |
| Patient already has a verified guardian grant under another identity | Automatic self-activation unavailable | Still unavailable; no takeover or reassignment. |

Native session tokens remain native; Web continues to use its HttpOnly patient refresh cookie. No browser-cookie workaround or authorization bypass was added.

## 4. Registration and activation

Self-signup with a profile accepts young patients while preserving the existing atomic user/patient/MRN/grant workflow and duplicate-patient rollback. Two-step Web registration still creates an account first; completing a young patient's own profile now sets `user.patientId` and a VERIFIED SELF grant, without requiring guardian contact fields.

Explicit existing-patient activation still requires its existing verified OTP or registration proof and MRN/mobile/DOB match. Adult and minor activation tests verify mismatched identity is rejected and repeated account creation conflicts. Automatic activation still rejects existing ownership/grant conflicts. Voluntary guardian activation and dependent authorization remain separate.

The existing automatic activation service creates the user before its link transaction. This pre-existing transaction boundary was not redesigned here; native now reuses that workflow. A wider concurrency/partial-activation recovery redesign is outside this change and is not claimed solved.

## 5. Security safeguards

Both login endpoints validate OTP before classification, then consume it before activation/session creation. No patient account is created merely by looking up a phone. Matching and ownership predicates remain the existing ones; phone normalization was not broadened. Inactive/locked checks and role eligibility remain in the authentication service. Access-grant authorization and existing scoping code were not changed.

Existing registration/link audit events and session audits are reused. No production database connection was used for this task. Integration tests use disposable MongoDB memory servers/replica sets. No authentication secrets or real patient records are included in this report.

## 6. Tests and actual results

| Check | Result |
|---|---|
| API new `age-independent` Web/native matrix | **16 passed**, 29 unrelated tests filtered out. |
| API signup + refresh/activation suites, after fixture correction | **18 passed**. Covers MRN allocation, rollback, SELF grants, adult/minor activation, mismatch, duplicate accounts, guardian activation and browser refresh. |
| Full native integration suite with new cases | **42 passed, 3 failed**. Same three failures reproduced on untouched HEAD: **26 passed, 3 failed** without new tests. |
| Full mobile suite, single worker | **307 passed**, 39 files. |
| Focused Patient Web auth/login/profile suites | **15 passed**, 5 files. Final self-profile form refinement rerun: **1 passed**. |
| Full Patient Web suite | **47 passed, 4 failed** in unchanged `PatientWebsitePage.test.tsx` catalogue request-count assertions. Untouched HEAD reproduced 3 of those failures; the search-count case passed in that baseline run and appears timing-sensitive. Full Web regression is therefore not green. |
| API typecheck and build | Passed. Typecheck rerun after test changes passed. |
| Mobile typecheck | Passed. |
| Patient Web typecheck and build | Passed; typecheck rerun after final form change passed. Build emits chunk-size/dynamic-import warnings. |
| Staff Web typecheck and build | Passed; build emits chunk-size warnings. |
| `git diff --check` | Passed after removing trailing whitespace. |

Initial parallel test attempts encountered worker-start and MongoDB setup timeouts. Reruns used `--maxWorkers=1`; API used `--hookTimeout=120000`. One new negative activation fixture originally used a malformed MRN and correctly received schema 400; it was corrected to a valid-format nonexistent MRN to test identity-match 404. Production validation was not weakened.

### Baseline failures and lint

The three existing native failures concern a browser refresh through `/api/auth/refresh`, staff password login with a patient account (403), and extraction of the wrong refresh-cookie prefix before a native interchange assertion (400 versus expected 401). All reproduce against untouched HEAD. They were not rewritten to hide failures.

Workspace lint results: API **18 errors**, Patient Web **4**, mobile **2**, staff Web **70**. No newly introduced lint findings were found when linting all changed TS/TSX files plus the new form test. The five findings in touched API files were independently verified on HEAD: unused `SelfProfileBody` at routes line 96; four existing `any` constructor parameters at service HEAD lines 144–147 (current 143–146). All other touched files pass lint.

Other API findings are in `patient-booking-endpoint.test.ts` (unused user ID), `patients/patient.service.ts` (seven explicit-any uses and one unused catch binding), and three existing test files: `dental-quotation-patient-portal-sync`, `dental-treatment-staging-validation`, `patient-portal-consent-security`. Patient Web findings are four unused bindings in `PortalConsentFormModal.tsx`; mobile findings are unused bindings in `useAuthenticatedImage.ts` and its test. Staff Web findings occur in unchanged consent, dental, patient, dashboard, doctor and appointment files. None of these unrelated files was modified.

Local evidence logs: `minor-removal-api-tests.log`, `minor-removal-login-tests.log`, `minor-removal-activation-tests.log`, `minor-removal-mobile-tests.log`, `minor-removal-patient-web-tests.log`, `minor-removal-baseline-api.log`, `minor-removal-baseline-web.log`, and `minor-removal-patient-web-build.log`. These are local validation artifacts, not deployment output.

## 7. Patient Web regression status

Relevant login, profile, activation and refresh coverage passes. Full regression and workspace lint remain blocked by the failures above; this report does not label the entire release green. The Web layout is preserved, with only obsolete restriction wording/routing and self-profile validation changed. No manual live-browser acceptance was performed.

## 8. Android build requirement

The login fix is backend behavior: the already-installed MyCare app can benefit once the API is deployed. No native dependency/configuration changed, so no new Android build is necessary to enable login. The updated registration hint/error wording is client JavaScript and needs the project's normal client release process to reach installed users; this task did not establish an OTA channel. No Expo export or EAS build was run.

## 9. Deployment and remaining verification

Nothing was deployed. Deploy the API change first, then publish Patient Web through the normal release process. No database migration or guardian-record deletion is required. Existing ownership conflicts must use existing verified support/linking workflows; do not overwrite guardian access to force login.

Before release acceptance, resolve or disposition the documented baseline failures and perform live staging checks with test accounts: young/adult login on Web and physical Android, refresh/logout/re-login, own-profile persistence, voluntary guardian/dependent access, duplicate matches, invalid OTP, inactive/locked users, and cross-patient access denial. Recheck the original account only through authorized verified support access. No claim is made that its production login now succeeds.

No next clinical phase was started.
