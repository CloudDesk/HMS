# Physical Device Issues Fix Report — MyCare Patient Mobile

**Date:** 28 September 2026  
**Environment:** Physical Android Device Testing against Render Backend (`https://hms-api-atok.onrender.com/api`)  
**Branch:** `Dev-F-Release-5-Patient-Portal-Mobile`  
**Status:** All 4 Issues Fully Resolved & Verified

---

## Executive Summary

Following testing of the MyCare Preview APK on physical Android devices, 4 specific issues were identified and addressed:
1. **Issue 1 (Appointment Booking HTTP 400 VALIDATION_ERROR):** Resolved across mobile contracts, booking modal, portal routes/service, and appointment service backend.
2. **Issue 2 (Date of Birth displaying raw timestamp):** Resolved by implementing `formatDateOfBirth` (`DD-MM-YYYY`) and applying it to ProfileScreen.
3. **Issue 3 (Home Screen identity redundancy):** Resolved by hiding single-patient context rows and cleaning up the top header to a prominent time greeting (`Good morning,`).
4. **Issue 4 (App startup delay ~40s):** Resolved by optimizing storage reading with defensive try/catch blocks, zero-delay unauthenticated fallback, 15s refresh timeout, and clean session invalidation on 401/403/404 errors.

---

## Detailed Issue Analysis & Resolutions

### Issue 1: Appointment Booking HTTP 400 VALIDATION_ERROR

- **Observed Behavior:** Booking an appointment returned HTTP 400 `VALIDATION_ERROR` (`req-19`, `MOB-0FF98C`).
- **Root Cause:**
  - `appointment.service.ts` in `createInternal` unconditionally rejected requests missing `utc_datetime`.
  - `patient-portal.routes.ts` stripped `utc_datetime` from `bookAppointmentSchema`, and `patient-portal.service.ts` forwarded the body without calculating UTC timestamp.
- **Resolution Implemented:**
  1. [`apps/api/src/modules/appointments/appointment.service.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/appointments/appointment.service.ts): Enhanced `createInternal` to compute `appointmentUtc` from `appointment_date` + `start_time` when `utc_datetime` is not provided.
  2. [`apps/api/src/modules/patient-portal/patient-portal.routes.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.routes.ts): Added optional `utc_datetime` to `bookAppointmentSchema`.
  3. [`apps/api/src/modules/patient-portal/patient-portal.service.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.service.ts): Included `utc_datetime` in `bookAppointment` input type signature.
  4. [`apps/patient-mobile/src/appointments/contracts.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/appointments/contracts.ts): Added `utc_datetime` to `bookAppointmentInputSchema`.
  5. [`apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx): Calculated and passed `utc_datetime` in ISO format as defense-in-depth.

---

### Issue 2: Date of Birth Display Timestamp

- **Observed Behavior:** Profile screen displayed `1990-01-01T00:00:00.000Z` instead of a date format.
- **Root Cause:** Raw string from `patient.date_of_birth` was rendered directly without formatting.
- **Resolution Implemented:**
  1. [`apps/patient-mobile/src/portal/formatters.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/portal/formatters.ts): Implemented `formatDateOfBirth(isoDate: string | null | undefined): string` returning `DD-MM-YYYY` (e.g. `01-01-1990`).
  2. [`apps/patient-mobile/src/ui/screens/ProfileScreen.tsx`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/screens/ProfileScreen.tsx): Formatted `patient.date_of_birth` using `formatDateOfBirth`.
  3. [`apps/patient-mobile/src/portal/formatters.test.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/portal/formatters.test.ts): Added unit tests verifying ISO string conversions, invalid dates, and fallbacks.

---

### Issue 3: Home Screen Identity Redundancy

- **Observed Behavior:** Home screen displayed patient name in 3 places stacked together (`Good morning, Mark` + `• Mark P (Self)` + Patient Card `Mark P`).
- **Root Cause:** Single-patient accounts rendered redundant context switcher chips and duplicated the first name above the primary patient card.
- **Resolution Implemented:**
  1. [`apps/patient-mobile/src/ui/components/PatientContextSelector.tsx`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/components/PatientContextSelector.tsx): Render selector chip row only when multiple patient profiles (`context.patients.length > 1`) exist. For single-patient accounts, returns `null`.
  2. [`apps/patient-mobile/src/ui/screens/HomeScreen.tsx`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/screens/HomeScreen.tsx): Simplified greeting header to prominent `Good morning,` / `Good afternoon,` / `Good evening,` without repeating the first name, allowing the PatientCard below to serve as the unified identity card.

---

### Issue 4: Auth Startup Delay (~40s)

- **Observed Behavior:** App startup took up to 40 seconds attempting session restoration before displaying the login screen.
- **Root Cause:**
  - `native-storage.ts` unhandled file marker operations could cause file access delays or exceptions.
  - Refresh requests against remote backends during cold starts waited up to 45 seconds (`MobileTransport.timeoutMs = 45_000`).
  - Refresh failure on non-existent or invalidated sessions threw non-auth errors that entered uncertain recovery state.
- **Resolution Implemented:**
  1. [`apps/patient-mobile/src/storage/native-storage.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/storage/native-storage.ts): Wrapped `readMarker` and `writeMarker` in defensive try/catch blocks.
  2. [`apps/patient-mobile/src/api/transport.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/api/transport.ts): Added per-request `timeoutMs` override capability in `request()` options.
  3. [`apps/patient-mobile/src/auth/auth-api.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/auth/auth-api.ts): Configured 15-second timeout for session refresh calls.
  4. [`apps/patient-mobile/src/auth/session-manager.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/auth/session-manager.ts):
     - If `!saved`, immediately transitions to `unauthenticated` with zero network overhead.
     - If `initialize()` catches any storage read issues, immediately sets `unauthenticated` so user reaches login without stalling.
     - In `rotate()`, any 401, 403, 404, or auth error immediately triggers `invalidate()` to clear storage and present the login screen.

---

## Verification Results

| Suite / Check | Command | Result |
| :--- | :--- | :--- |
| **Mobile Tests** | `npm test --workspace=@hms/patient-mobile` | **23 passed**, 136 tests passed (100%) |
| **Mobile Typecheck** | `npm run typecheck --workspace=@hms/patient-mobile` | **0 errors** |
| **Mobile Lint** | `npm run lint --workspace=@hms/patient-mobile` | **0 errors, 0 warnings** |
| **API Typecheck** | `npm run typecheck --workspace=@hms/api` | **0 errors** |
| **API Lint (Modified)** | `npx eslint <modified API files>` | **0 errors** |
| **Protected Patient Web** | `git diff --stat apps/patient-web` | **0 diffs (100% untouched)** |
| **EAS Build Isolation** | `npx eas build` | **0 builds consumed** |

---

## File Modification Summary

- **Patient Mobile:**
  - [`apps/patient-mobile/src/api/transport.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/api/transport.ts)
  - [`apps/patient-mobile/src/appointments/contracts.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/appointments/contracts.ts)
  - [`apps/patient-mobile/src/auth/auth-api.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/auth/auth-api.ts)
  - [`apps/patient-mobile/src/auth/auth-api.test.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/auth/auth-api.test.ts)
  - [`apps/patient-mobile/src/auth/session-manager.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/auth/session-manager.ts)
  - [`apps/patient-mobile/src/portal/formatters.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/portal/formatters.ts)
  - [`apps/patient-mobile/src/portal/formatters.test.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/portal/formatters.test.ts)
  - [`apps/patient-mobile/src/storage/native-storage.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/storage/native-storage.ts)
  - [`apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx)
  - [`apps/patient-mobile/src/ui/components/PatientContextSelector.tsx`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/components/PatientContextSelector.tsx)
  - [`apps/patient-mobile/src/ui/screens/HomeScreen.tsx`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/screens/HomeScreen.tsx)
  - [`apps/patient-mobile/src/ui/screens/ProfileScreen.tsx`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/screens/ProfileScreen.tsx)
- **API (Backend Fixes):**
  - [`apps/api/src/modules/appointments/appointment.service.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/appointments/appointment.service.ts)
  - [`apps/api/src/modules/patient-portal/patient-portal.routes.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.routes.ts)
  - [`apps/api/src/modules/patient-portal/patient-portal.service.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.service.ts)
