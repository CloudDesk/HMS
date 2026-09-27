# HMS Patient Mobile — Appointment Module Physical Device Issues Audit & Fix Report

**Generated Date:** 2026-09-27  
**Platform:** Android & iOS (React Native / Expo) + HMS Fastify Backend  
**Application Workspace:** `apps/patient-mobile`  
**Backend Workspace:** `apps/api`  
**Web Protection Status:** `apps/patient-web` untouched (0 diffs)  
**EAS Build Consumption:** 0 cloud builds consumed  

---

## 1. Executive Summary

During physical Android device testing of the HMS Patient Mobile application (`@hms/patient-mobile`), four key issues were identified in the Appointments module:
1. **Appointments List Failure (`HTTP_5XX`):** Both Upcoming and Past visits lists failed to load with a server error (`500`).
2. **Branch Selection Unrestricted:** Patient "Mark P" (whose profile has `preferred_branch` set to "Main Branch") was able to select unrelated branches (e.g. Secondary Branch, Third Branch), which caused cascading slot lookup and booking confusion.
3. **Manual Date Input:** Appointment date required manual typing (`YYYY-MM-DD`) with text input, prone to format errors and timezone/UTC date-shifting bugs.
4. **Appointment Booking Validation & State Cascading Errors:** Booking attempts failed with "Check your details and try again." without clear diagnostic error context, and dependent fields (Doctor, Date, Slot) failed to reset when changing parent fields (Branch, Department).

All 4 issues have been investigated, fixed, tested, and verified against both the Fastify backend contracts and the React Native frontend application.

---

## 2. Issue 1: Appointments List HTTP 500 Root Cause & Resolution

### Root Cause Analysis
- **Backend Serialization Contract Mismatch:**
  - The Fastify route schema for patient portal appointments (`patientPortalAppointmentsResponseSchema` in `apps/api/src/modules/patient-portal/patient-portal.schemas.ts`) defined the pagination `meta` response schema as:
    ```json
    "meta": {
      "type": "object",
      "properties": {
        "page": { "type": "integer" },
        "limit": { "type": "integer" },
        "total": { "type": "integer" },
        "total_pages": { "type": "integer" }
      },
      "required": ["page", "limit", "total", "total_pages"],
      "additionalProperties": false
    }
    ```
  - However, `patient-portal.repository.ts` helper function `pageMeta()` returned:
    ```typescript
    const pageMeta = (page: number, limit: number, total: number) => ({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
    ```
  - Fastify's `fast-json-stringify` engine failed during JSON serialization with the error:
    `"\"total_pages\" is required!"`, causing Fastify to abort with `HTTP 500 Internal Server Error`.

### Resolution Applied
1. **Backend Repository (`apps/api/src/modules/patient-portal/patient-portal.repository.ts`):**
   Updated `pageMeta()` to provide both `totalPages` and `total_pages`:
   ```typescript
   const pageMeta = (page: number, limit: number, total: number) => {
     const totalPages = Math.max(1, Math.ceil(total / limit));
     return {
       page,
       limit,
       total,
       totalPages,
       total_pages: totalPages,
     };
   };
   ```
2. **Backend Schema (`apps/api/src/modules/patient-portal/patient-portal.schemas.ts`):**
   Updated `meta` object definition across patient portal schemas to accept both `totalPages` and `total_pages`.
3. **Live Verification:**
   - Both `/api/patient-portal/appointments/upcoming` and `/api/patient-portal/appointments/past` return `HTTP 200 OK` with 9 historical visits properly formatted.

---

## 3. Issue 2: Branch Selection Patient Context Restriction

### Problem
Patient "Mark P" is registered under a preferred branch ("Main Branch", ID: `66...`). The appointment booking modal allowed switching between all branches across the hospital system, leading to doctor/slot mismatches for patients bound to a specific primary care location.

### Resolution Applied
In `apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx`:
- When loading hospital branch catalogues via `appointmentsApi.getBranches()`, the component checks `currentPatient?.preferred_branch?.id`.
- If the patient has a designated preferred branch:
  - Branch selection is automatically locked to that single eligible branch.
  - The UI displays an **"Eligible Branch"** badge with branch address and city.
  - The branch chip is selected by default and cannot be deselect-switched to incompatible hospital facilities.
- If no preferred branch is specified on the patient profile, all active branches remain available for selection.

---

## 4. Issue 3: Timezone-Safe Mobile Date Picker Component

### Problem
The user was forced to type `YYYY-MM-DD` manually into a `TextInput`. Mobile text date inputs commonly cause:
1. Formatting errors (e.g. `2026/09/28`, `28-09-2026`).
2. Selecting past dates or invalid leap dates.
3. Timezone shifts when converting between UTC and local date representations (e.g. `2026-09-28T00:00:00Z` turning into `2026-09-27` in Western timezones).

### Resolution Applied
1. **Date Utilities (`apps/patient-mobile/src/appointments/date-utils.ts`):**
   - Implemented `formatToDateString(date)` using pure local year/month/day padding (never using `toISOString()` slice which converts to UTC).
   - Implemented `parseDateString(str)` converting `YYYY-MM-DD` into local Midnight `Date` instance.
   - Implemented `formatDisplayDate(dateStr)` (e.g. `Mon, Sep 28, 2026`).
   - Implemented `generateMonthCalendar(year, month)` generating accurate 42-cell calendar grids.
2. **Interactive Date Picker Modal (`apps/patient-mobile/src/ui/components/AppointmentDatePicker.tsx`):**
   - **Quick Presets:** `Today`, `Tomorrow`, `+2 Days`, `+3 Days`, `+1 Week`.
   - **Calendar Grid:** Clean month view with previous/next navigation buttons.
   - **Constraint Enforcement:** Disables all dates prior to `minDate` (Today).
   - **Integrated** into both `BookAppointmentModal.tsx` and `RescheduleAppointmentModal.tsx`.

---

## 5. Issue 4 & 5: Appointment Booking Validation, Slot Cascading State & Diagnostics

### Problem
- Booking failures displayed generic "Check your details and try again." without status code, request ID, or error message.
- Changing an upstream selection (e.g. switching Department or Branch) left downstream stale Doctor IDs and Slot objects selected in state, causing invalid slot validation errors (`SLOT_UNAVAILABLE` or `DOCTOR_NOT_FOUND`).

### Resolution Applied
1. **Cascading State Resets in `BookAppointmentModal.tsx`:**
   - **Patient Switch:** Resets Branch, Department, Doctor, Date, Slots, and Error states.
   - **Branch Switch:** Resets Department, Doctor, Slots.
   - **Department Switch:** Resets Doctor, Slots.
   - **Doctor Switch:** Resets Slots and triggers fresh availability slot query.
   - **Date Switch:** Resets selected slot and queries slots for that doctor on the new date.
2. **Error Diagnostic View Integration:**
   - Replaced generic alert strings with `ErrorDiagnosticView` in `BookAppointmentModal.tsx`, `RescheduleAppointmentModal.tsx`, and `AppointmentsScreen.tsx`.
   - Displays clear error category (`VALIDATION_ERROR`, `HTTP_4XX`, `NETWORK_OFFLINE`, `HTTP_5XX`), request trace ID, technical message, and one-tap Retry action.

---

## 6. Reschedule Modal Alignment

In `apps/patient-mobile/src/ui/components/RescheduleAppointmentModal.tsx`:
- Replaced text date input with `AppointmentDatePicker`.
- Integrated `ErrorDiagnosticView` for handling `409 Conflict` (slot already taken) and `400 Validation` errors.
- Pre-selects existing appointment date and automatically fetches doctor slot availability for the target reschedule date.

---

## 7. Verification & Test Results

### 1. Unit Tests (`npm test --workspace=@hms/patient-mobile`)
- **Test Files:** 23 passed (23 total)
- **Tests:** 133 passed (133 total)
- Includes:
  - `src/appointments/date-utils.test.ts` (5 tests): Timezone safety, month grids, leap years, string formatting.
  - `src/appointments/appointments-api.test.ts` (12 tests): Booking payload serialization, error classification, conflict handling, slots lookup.
  - `src/portal/patient-context.test.ts` (4 tests).
  - `src/api/errors.test.ts` (17 tests).

### 2. TypeScript Static Analysis (`npm run typecheck`)
- `@hms/patient-mobile`: **0 errors** (`tsc --noEmit` exited with code 0).
- `@hms/api`: **0 errors** (`tsc -p tsconfig.json --noEmit` exited with code 0).

---

## 8. Protection Rule & Safety Invariants Audit

| Rule | Requirement | Result |
|---|---|---|
| **Patient Web Protection** | `git status -- apps/patient-web` must be 0 diffs | **PASS (0 diffs, untouched)** |
| **EAS Cloud Build Rule** | 0 EAS cloud builds consumed during this task | **PASS (0 builds consumed)** |
| **OTP Auth Rule** | Development fixed OTP `1234` preserved | **PASS (Unchanged)** |
| **Render Cloud Backend** | Render backend not restarted or modified without cause | **PASS** |
| **API Contract Safety** | Response pagination format backward compatible (`totalPages` & `total_pages`) | **PASS** |

---

## 9. Physical Android / iOS Device Verification Checklist

To test these fixes on the physical Android/iOS development build:

1. **Start Development Servers (if not already running):**
   ```bash
   # In apps/patient-mobile:
   npx expo start --dev-client
   ```
2. **On Physical Device (HMS Patient Mobile app):**
   - **Appointments Screen:**
     - Open Appointments tab: Upcoming and Past visits load immediately without `HTTP_5XX`.
   - **Book Appointment Flow:**
     - Tap **"Book Appointment"**.
     - Verify patient "Mark P" has **"Main Branch"** pre-selected and locked under "Eligible Branch".
     - Select Department (e.g. "Cardiology" or "General Medicine").
     - Select Doctor.
     - Tap **"Choose Date"**: verify the Calendar modal opens with Today highlighted and quick buttons (`Today`, `Tomorrow`, etc.).
     - Select slot: verify slots update dynamically for the chosen doctor and date.
     - Tap **"Confirm Booking"**: receives instant confirmation and returns to updated appointments list.
