# MyCare — Physical Device Bug Fix & Verification Report

## Executive Summary
This report summarizes the root causes, code changes, and verification for the 5 physical-device issues reported on MyCare (Patient Mobile):
1. **Issue 1:** Intermittent "Too many attempts" error on login.
2. **Issue 2:** Consent records missing from MyCare (showing 0) despite existing on Web.
3. **Issue 3:** Appointment booking modal scrolling / footer cut off behind Android navigation bar.
4. **Issue 4:** Appointment Department showing Dental only (locked/fixed).
5. **Issue 5:** Remove Visit Type from user-facing appointment booking.

---

## Issue Details & Resolutions

| # | Issue Description | Root Cause | Fix Summary | Classification |
|---|-------------------|------------|-------------|----------------|
| **1** | Intermittent "Too many attempts" on login | `SessionManager` retained stale `errorDetails`/`message` on logout, back navigation, and input changes; active cooldown raised unhandled error instead of message | Added explicit `clearError()` lifecycle, reset error states in transitions, and provided friendly remaining cooldown timer in `session-manager.ts` and `LoginScreen.tsx` | Mobile State Lifecycle / UI |
| **2** | Consents missing in MyCare (0 reported) | `listDocumentsForPortal` in `patient.service.ts` filtered records using `documentStorage.exists()`, dropping template records/disk-ephemeral items; mobile contract mapping omitted `VERIFIED` status | Restored MongoDB direct query in `listDocumentsForPortal` and expanded `isSigned` check in `contracts.ts` | Backend Filter Defect + Mobile Contract |
| **3** | Appointment modal scroll & footer overlap | Blocking outer `TouchableWithoutFeedback` trapped scroll gestures; fixed bottom padding ignored Android software navigation bar insets | Replaced with backdrop touchable and added dynamic `useSafeAreaInsets().bottom` padding to card & sticky footer in `BookAppointmentModal.tsx` | Mobile Layout & Gesture |
| **4** | Appointment Department: Dental only | All branch departments were shown in interactive picker | Filtered catalogue to Dental only, auto-selected Dental, and replaced picker with locked `🦷 Dental` badge | Mobile Feature Requirement |
| **5** | Remove Visit Type from appointment UI | User-facing Visit Type chips (New Consultation, Follow Up, Procedure) were visible | Removed Visit Type chips from UI; defaulted `visit_type: 'NEW_CONSULTATION'` in mobile payload and schema | Mobile UI Simplification |

---

## Critical Protection Invariants

- **Patient Web Untouched:**
  `git diff --stat -- apps/patient-web` -> `0 files changed, 0 insertions, 0 deletions`.
- **EAS Builds & Infrastructure:**
  Zero EAS builds executed, zero credits consumed.
- **Backend Security & Rate Limits:**
  OTP rate limits and cooldown verification remain strictly enforced on the server.

---

## Verification & Test Results

1. **Patient Mobile Typecheck:** `npm run typecheck --workspace=@hms/patient-mobile` -> **PASS (0 errors)**
2. **Patient Mobile Linter:** `npm run lint --workspace=@hms/patient-mobile` -> **PASS (0 warnings, 0 errors)**
3. **Patient Mobile Unit Tests:** `npm test --workspace=@hms/patient-mobile` -> **29/29 files passed, 221/221 tests passed**
4. **API Typecheck:** `npm run typecheck --workspace=@hms/api` -> **PASS (0 errors)**
5. **Patient Web Integrity:** `git diff --stat -- apps/patient-web` -> **0 lines changed (PASS)**

---

## Physical Device Verification Steps

1. **Login & Cooldown Test:**
   - Open MyCare on physical Android device.
   - Enter mobile number and request OTP.
   - Tap "Change Number" / Back to Phone.
   - Verify previous error or message is cleared immediately.
   - Enter a new number or request OTP before 60s cooldown; verify friendly countdown message displays without crashing or showing raw error codes.

2. **Consent Management Test:**
   - Log in with a patient account with existing consents.
   - Navigate to **Profile -> Consents / Consent Forms**.
   - Verify all 6 consents (1 pending, 5 signed/verified) are listed with correct titles and signature badges.

3. **Appointment Booking UI Test:**
   - Tap **Book Appointment**.
   - Verify modal opens smoothly.
   - Department field displays **🦷 Dental** (locked, not clickable).
   - Doctor list populates with Dental specialists.
   - Visit Type selector is completely removed from the screen.
   - Scroll through date picker, time slots, reason notes, and clinical history.
   - Verify "Confirm Booking" footer remains fully visible and elevated above the Android system navigation bar.
