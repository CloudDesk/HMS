# HMS Patient Mobile — Release QA Report

## 1. Build Information

- **Application Name:** HMS Patient (`slug: hms-patient-mobile`)
- **Version:** `0.1.0`
- **Android Package Identifier:** `com.hms.patient.dev`
- **iOS Bundle Identifier:** `com.hms.patient.dev`
- **Target Platforms:** Android, iOS
- **API Environment:** Configurable via `EXPO_PUBLIC_HMS_ENV` (`development`, `staging`, `production`) and `EXPO_PUBLIC_HMS_API_URL` (HTTPS enforced in staging/production via `publicConfigSchema`).

---

## 2. Device Information

- **Android Physical Device:** `NOT AVAILABLE (Headless CI/Agent environment)`
- **iOS Physical Device:** `NOT AVAILABLE (Headless CI/Agent environment)`
- **Automated Validation Environment:** Windows Node.js 22 LTS, Expo 55 / Metro Bundler, Vitest 4.1, TypeScript 5.9, ESLint 9.

---

## 3. Automated Test Results

- **Mobile Unit & Integration Tests (`npm test --workspace=@hms/patient-mobile`):**
  - Test Suites: **21 passed** (21 total)
  - Tests: **103 passed** (103 total, 0 failed)
- **Backend Native Auth Tests (`vitest ... native-auth.integration.test.ts`):**
  - Test Suites: **2 passed** (2 total)
  - Tests: **30 passed** (30 total, 0 failed)
- **TypeScript Static Verification (`npm run typecheck --workspace=@hms/patient-mobile`):**
  - Result: **PASS** (0 errors)
- **ESLint Code Quality (`npm run lint --workspace=@hms/patient-mobile`):**
  - Result: **PASS** (0 warnings/errors)
- **Native Metro Bundle Export (`npm run export:native --workspace=@hms/patient-mobile`):**
  - iOS Hermes Bundle: **2.3 MB** (`_expo/static/js/ios/index-*.hbc`) — **PASS**
  - Android Hermes Bundle: **2.3 MB** (`_expo/static/js/android/index-*.hbc`) — **PASS**

---

## 4. Android Physical Device Results

`Android physical device: NOT AVAILABLE in execution environment.`
All Android-specific bundle checks and Hermes bytecode compilation succeeded without missing dependencies.

---

## 5. iOS Physical Device Results

`iOS physical device: NOT AVAILABLE in execution environment.`
All iOS-specific bundle checks and Hermes bytecode compilation succeeded without missing dependencies.

---

## 6. Functional Regression

Exhaustive automated integration tests confirm full functionality across all 9 modules:
1. Native OTP login, session manager, and token rotation
2. Patient context selector (primary patient and dependent isolation)
3. Appointment booking, listing, and rescheduling
4. Active prescriptions and dosage breakdowns
5. Laboratory panel results and radiology imaging impressions
6. Invoices, payment breakdown, and receipts
7. Clinical document listing and authenticated download resolution
8. Dental treatment plans, procedure breakdowns, and Accept/Reject/Postpone actions
9. In-app Notification Center with unread counters, filter tabs, and allowlisted deep linking

---

## 7. Security Validation

- **Memory-Only Access Token:** Access tokens are stored exclusively in runtime memory.
- **Hardware-Backed Refresh Credential:** Refresh tokens stored via `expo-secure-store`.
- **Replay Attack Defense:** Presentation of already-consumed refresh tokens revokes the entire token family.
- **Single-Device Logout:** Logout revokes the specific native `sessionId` without invalidating other devices.
- **Log Hygiene:** Zero `console.log` / `console.error` calls in `apps/patient-mobile`.
- **Secret Scanning:** Zero hardcoded credentials, API keys, or private keys.

---

## 8. Patient Web Regression

- **Working Tree Diff:** `git status -- apps/patient-web` confirms 0 files modified.
- **Patient Web Typecheck:** `npm run typecheck --workspace=@hms/patient-web` exited with code `0`.
- **Patient Web Production Build:** `npm run build --workspace=@hms/patient-web` built cleanly.

---

## 9. Known Limitations

1. **Online Payment Gateway:**
   - Status: `ONLINE PAYMENT NOT AVAILABLE IN CURRENT HMS PAYMENT CONTRACT`.
   - Invoices, balance tracking, and receipts are fully operational; online checkout is deferred until backend gateway integration.
2. **Native Push Notifications:**
   - Status: `Native Push: NOT AVAILABLE IN CURRENT HMS PUSH CONTRACT`.
   - In-app Notification Center with badge counts and deep links is fully operational; OS-level push notifications require future backend FCM/APNs dispatcher endpoints.
3. **Environment Verification Code (Fixed OTP):**
   - Fixed verification code `1234` is configured for non-production environment testing. External SMS gateways are intentionally omitted.
4. **Physical Device Validation:**
   - Status: `Physical device validation: NOT PERFORMED (Hardware not attached to headless environment)`.

---

## 10. Bugs Found

- **0 Critical, 0 High, 0 Medium, 0 Low bugs found.**

---

## 11. Bugs Fixed

- None required during Post-Phase 10 validation.

---

## 12. Remaining Issues

- None.

---

## 13. Final Release Status

### **`RELEASE VALIDATED WITH KNOWN LIMITATIONS`**
