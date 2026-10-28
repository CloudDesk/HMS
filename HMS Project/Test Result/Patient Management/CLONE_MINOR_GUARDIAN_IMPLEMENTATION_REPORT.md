# Age-Independent Patient Authentication — Dev-F-Release-5-Clone Implementation Report

## 1. Confirmed Reference and Target Branches

- **Reference Branch (read-only):** `Dev-F-Release-5` (commit `05ef6259cb7679cbf3d269bf10588dc9c08ccd6b`, "Minor Age Validation Fixes").
- **Target Branch (implementation):** `Dev-F-Release-5-Clone` (HEAD `0dfa301afa72c9edba8c8f560b382383654ae355`).
- Both branches exist locally and remotely. No branch switching, merge, rebase, or cherry-picking was performed.
- Target branch-specific commits (`6034962` for web test tsconfig and `0dfa301` for mobile `eas.json`) and independent backend/database environments are strictly preserved.

---

## 2. Branch Differences and Gap Analysis

Before this implementation, the target branch `Dev-F-Release-5-Clone` enforced age-based restrictions across login, self-registration, activation, and profile completion:

| Domain / Layer | Target Branch Baseline Gap | Target Branch Implementation |
|---|---|---|
| **Repository** (`patient-portal.repository.ts`) | Evaluated patient DOB and classified patients under 18 as `MINOR_REQUIRES_GUARDIAN`; restricted auto-activation to adults (`getUniqueUnlinkedAdultPatientByPhone`). | Removed age calculations; returns `ACCOUNT_NOT_LINKED` for eligible unlinked patients of any age; renamed method to `getUniqueUnlinkedPatientByPhone` and removed the `< 18` exclusion. Preserved single-match check and ownership/grant conflict guards. |
| **Service** (`patient-portal.service.ts`) | Blocked self-signup (`input.selfProfile`) for under 15 (`MINOR_GUARDIAN_REQUIRED`); blocked explicit activation for minors; required guardian details on self-profile completion (`GUARDIAN_DETAILS_REQUIRED`) and created non-SELF grants for minors. | Removed minor rejection from self-signup; removed minor rejection from explicit activation; removed guardian contact requirements for self-profile completion; unconditionally creates `SELF` access grants for own-account profile completion. |
| **Web Routes** (`patient-portal.routes.ts`) | Rejected login with `409 MINOR_GUARDIAN_ACCOUNT_REQUIRED` when `status === 'MINOR_REQUIRES_GUARDIAN'`. | Removed the obsolete `MINOR_REQUIRES_GUARDIAN` branch entirely. Preserved OTP verification/consumption and auto-activation. |
| **Native Session Service** (`native-session.service.ts`) | Rejected all unlinked patients with `409` (including mapping `MINOR_REQUIRES_GUARDIAN` to `MINOR_GUARDIAN_ACCOUNT_REQUIRED`); did not activate accounts on native OTP login. | If `status === 'ACCOUNT_NOT_LINKED'`, calls `portal.activateExistingPatientByPhone(input.phone, metadata)` after OTP validation and consumption, prior to issuing native session tokens. |
| **Patient Web UI** (`PortalPatientForm.tsx`, `PatientLoginPage.tsx`) | `PatientLoginPage` routed minor 409 to guardian mode; `PortalPatientForm` enforced parent/guardian full name for patients under 15 even in `SELF` mode. | `PatientLoginPage` removes `MINOR_GUARDIAN_ACCOUNT_REQUIRED` catch handling and updates explanatory help text. `PortalPatientForm` only requires guardian name when `mode === 'DEPENDENT'` and under 15; in `SELF` mode, guardian/emergency info is optional regardless of age. |
| **Patient Mobile UI** (`errors.ts`, `RegisterScreen.tsx`) | Error map mapped `MINOR_GUARDIAN_REQUIRED`; DOB field had hint "Patients under 15 must register through a parent or guardian." | Removed obsolete error mapping and updated the hint text to "Enter the patient’s date of birth." Native session transport remains intact. |
| **Tests** (`native-auth.integration.test.ts`, `patient-atomic-signup.test.ts`, `patient-refresh-session.test.ts`, `PortalPatientForm.test.tsx`) | Tests expected minor rejection (`MINOR_GUARDIAN_REQUIRED` / `MINOR_GUARDIAN_ACCOUNT_REQUIRED`). | Updated tests to expect successful age-independent account activation, valid `SELF` access grants, and MRN allocation across DOBs (e.g. 2020-01-01, 2010-01-01, 1990-01-01); added negative security checks for invalid/expired OTP, ownership conflicts, and duplicate matches. |

---

## 3. Files Changed and Purpose

1. **`apps/api/src/modules/patient-portal/patient-portal.repository.ts`**:
   - `getUnlinkedPatientLoginStatus`: Returns `ACCOUNT_NOT_LINKED` regardless of age for eligible unlinked patients without portal owners; removes `MINOR_REQUIRES_GUARDIAN`.
   - `getUniqueUnlinkedPatientByPhone`: Replaces `getUniqueUnlinkedAdultPatientByPhone`; removes the 18-year age restriction while preserving active status check, unique single patient match, and checks against existing `UserModel` and `PatientAccessGrantModel` verified ownership.

2. **`apps/api/src/modules/patient-portal/patient-portal.service.ts`**:
   - `signup`: Removed `isMinor` check on `input.selfProfile.dateOfBirth`.
   - `activateExistingPatient`: Removed `isMinor` check on `patient.dateOfBirth`.
   - `activateExistingPatientByPhone`: Updated to call `this.repository.getUniqueUnlinkedPatientByPhone(phone)`.
   - `completePatientProfile`: Removed requirement for guardian details when under 15; sets grant relationship strictly to `SELF`.

3. **`apps/api/src/modules/patient-portal/patient-portal.routes.ts`**:
   - `POST /api/patient-portal/login/otp`: Removed `status === 'MINOR_REQUIRES_GUARDIAN'` check throwing `MINOR_GUARDIAN_ACCOUNT_REQUIRED`.

4. **`apps/api/src/modules/auth/native-session.service.ts`**:
   - `loginWithOtp`: When `status === 'ACCOUNT_NOT_LINKED'`, invokes `portal.activateExistingPatientByPhone(input.phone, metadata)` after verifying and consuming OTP, aligning native mobile login behavior with Patient Web.

5. **`apps/patient-web/src/pages/PatientLoginPage.tsx`**:
   - Removed `requestError.code === 'MINOR_GUARDIAN_ACCOUNT_REQUIRED'` handling and forced guardian routing; updated help text from "one adult record matches" to "one patient record matches".

6. **`apps/patient-web/src/components/patient-portal/PortalPatientForm.tsx`**:
   - Constrained the mandatory parent/guardian name validation to `mode === 'DEPENDENT'` and under 15. In `SELF` mode, emergency contact details are optional and marked as optional in the UI.

7. **`apps/patient-mobile/src/api/errors.ts`**:
   - Removed obsolete `MINOR_GUARDIAN_REQUIRED` default error message.

8. **`apps/patient-mobile/src/ui/screens/RegisterScreen.tsx`**:
   - Updated DOB field hint from guardian restriction to "Enter the patient’s date of birth."

9. **`apps/api/src/modules/auth/native-auth.integration.test.ts`**:
   - Added comprehensive parameterized test matrix for Web and Native OTP login across minor and adult DOBs (`2020-01-01`, `2010-01-01`, `1990-01-01`), validating automatic account creation, `SELF` grant issuance, token/session issuance, and cookie isolation.
   - Added negative security tests: missing OTP field, unrequested OTP, invalid OTP, expired/consumed challenges, existing direct owner preservation (active and inactive), duplicate patient matches, inactive/locked accounts, and existing guardian grant conflict protections.

10. **`apps/api/src/modules/patient-portal/patient-atomic-signup.test.ts`**:
    - Replaced the minor signup rejection test with a test asserting that minor self-registration successfully creates user, patient, MRN, and `SELF` access grant.
    - Added test for Patient Web two-step registration completing a minor profile with a `SELF` access grant without requiring guardian details.

11. **`apps/api/src/modules/patient-portal/patient-refresh-session.test.ts`**:
    - Parameterized existing-patient activation test for both adult (`1990-01-01`) and minor (`2020-01-01`) records, verifying identity mismatch 404, valid activation 201 + cookie refresh 200, and duplicate activation 409.
    - Removed obsolete minor rejection assertion in guardian activation test.

12. **`apps/patient-web/src/components/patient-portal/PortalPatientForm.test.tsx`**:
    - Added unit test asserting that completing a minor `SELF` profile succeeds without guardian details.

---

## 4. Implemented Behavior and Retained Safeguards

### Age-Independent Authentication & Activation
- Unlinked patients under 18 can now log in via Web and Native mobile using OTP verification, automatically activating their account with a verified `SELF` access grant.
- Patients under 18 can self-register or activate an existing record without being blocked or redirected to guardian-only workflows.
- Web and native mobile login share consistent activation eligibility through `activateExistingPatientByPhone`.

### Retained Security Safeguards
- **OTP Verification & Consumption:** OTP is always verified and consumed before account activation or session issuance. Expired, consumed, missing, or invalid OTPs are rejected.
- **Single Record Requirement:** Phone matching requires exactly one unique active patient match (`getUniqueUnlinkedPatientByPhone`). Multiple matches return `409 MULTIPLE_PATIENT_MATCHES` without creating accounts or sessions.
- **Ownership Conflict Protection:** If a patient is already linked to an existing user or has a `VERIFIED` access grant under another identity, automatic activation is denied (`409 PATIENT_AUTOMATIC_LINK_NOT_AVAILABLE`). Existing guardian records and ownership links are never overridden or hijacked.
- **Account State Controls:** Inactive and locked accounts remain rejected from obtaining sessions.
- **Session Transport Separation:** Native sessions continue to use JWT tokens (`accessToken`, `refreshToken`, session ID) without browser cookies; Patient Web continues to use HttpOnly refresh cookies without exposing refresh tokens in response bodies.
- **Voluntary Guardian Workflows:** Voluntary guardian activation (`/guardian-activation`) and dependent registration workflows remain intact. Guardian relationship types (`PARENT`, `LEGAL_GUARDIAN`) are preserved for dependent management.

---

## 5. Test Results and Baseline Comparisons

### API Tests (`vitest run`)
- **`patient-atomic-signup.test.ts`**: **8 passed** (100%).
- **`patient-refresh-session.test.ts`**: **10 passed** (100%).
- **`native-auth.integration.test.ts`**: **52 passed, 3 failed**.
  - All 26 new age-independent authentication and negative security tests passed across both Web and Native clients.
  - The 3 failures are pre-existing baseline failures identical to `Dev-F-Release-5` HEAD:
    1. Browser refresh through `/api/auth/refresh` expecting 200 (received 401).
    2. Staff password login with patient account expecting 200 (received 403).
    3. Wrong refresh-cookie prefix extraction in native interchange test expecting 401 (received 400).

### Patient Mobile Tests (`vitest run --config vitest.config.ts`)
- **307 passed** across all 39 test files (100% pass).

### Patient Web Tests (`vitest run`)
- **Focused Auth & Form Tests** (`PatientLoginPage.test.tsx`, `PortalPatientForm.test.tsx`, `auth-api.test.ts`, `auth-refresh.test.tsx`, `token-storage.test.ts`): **15 passed** (100%).
- **Full Patient Web Suite**: **49 passed, 3 failed**.
  - All 3 failures are in `PatientWebsitePage.test.tsx` asserting catalogue query call counts (1 vs 2 calls to `publicDepartments`), identical to the baseline on `Dev-F-Release-5`.

### Git Diff Check
- `git diff --check`: Clean (0 whitespace/formatting errors).

---

## 6. Build and Typecheck Results

| Workspace | Typecheck | Build | Notes |
|---|---|---|---|
| `@hms/api` | **Passed** (`tsc -p tsconfig.json --noEmit`) | **Passed** (`tsc -p tsconfig.json`) | 0 errors. Pre-existing lint findings in `patient-portal.routes.ts` (1 unused var) and `patient-portal.service.ts` (4 `any` params) remain unchanged from HEAD. |
| `@hms/patient-web` | **Passed** (`tsc -b --noEmit`) | **Passed** (`tsc -b && vite build --mode prod`) | 0 errors. Emits standard Vite chunk-size warning (>500 kB). |
| `@hms/patient-mobile` | **Passed** (`tsc --noEmit`) | N/A (mobile app) | 0 errors. |
| `@hms/web` (Staff Web) | **Passed** (`tsc -p tsconfig.json && npm run typecheck:tests`) | **Passed** (`vite build --mode prod`) | 0 errors. Emits standard Vite chunk-size warning. |

---

## 7. Remaining Risks and Unresolved Issues

- **Multiple Matching Phone Records:** If a phone number belongs to multiple family members, automatic activation returns `MULTIPLE_PATIENT_MATCHES`. Those patients must continue to be verified and linked manually by hospital staff.
- **Baseline Test Failures:** The 3 failures in `native-auth.integration.test.ts` and 3 in `PatientWebsitePage.test.tsx` represent pre-existing baseline behaviors on both `Dev-F-Release-5` and `Dev-F-Release-5-Clone`. They were deliberately preserved without weakening assertions.
- **Concurrent Activation Race:** If an unlinked patient submits multiple simultaneous activation requests before the initial user creation commits, the second request may race until the unique constraint trips.

---

## 8. Deployment Steps

1. **Target Backend (`@hms/api`):**
   - Deploy backend build artifacts (`dist/`).
   - Run existing database migrations if pending. No new database schema migration or data backfill is required.
   - Restart API service instances.
2. **Patient Web (`@hms/patient-web`):**
   - Deploy build output (`dist/`) to the web hosting provider / CDN.
3. **Database & Existing Data:**
   - No deletion or conversion of existing guardian records is required. Existing accounts remain functional.

---

## 9. Android Build Requirement

- **New Android binary build (APK/AAB) is NOT strictly required** for existing users to log in:
  - The login activation logic is executed on the backend API.
  - The mobile app communicates via the existing `/api/patient-portal/mobile/auth/login/otp` endpoint and uses the same token contracts.
- **Client Update Advisory:**
  - An updated client build (via OTA update or app release) should be scheduled to display the updated DOB field hint and reflect the removal of the minor restriction notice in the registration screen.
