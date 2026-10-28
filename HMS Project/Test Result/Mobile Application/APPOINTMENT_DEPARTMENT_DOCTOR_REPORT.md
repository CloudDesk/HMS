# MYCARE — APPOINTMENT DEPARTMENT & DOCTOR CASCADING SELECTION REPORT

**Document Version:** 1.0.0  
**Date:** 2026-09-28  
**Application:** MyCare Native Patient Mobile (`apps/patient-mobile`) & API Backend (`apps/api`)  
**Components Updated:**
- `apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx`
- `apps/patient-mobile/src/appointments/cascading-selection.test.ts`
- `apps/api/src/modules/patient-portal/patient-portal.repository.ts`

---

## 1. Executive Summary & Compliance Overview

To eliminate vertical visual clutter and ensure clinical data integrity in the MyCare "Book an Appointment" modal, the Department and Doctor selection sections were re-architected from large card/chip grids into a compact, responsive, two-column dropdown row (`cascadingRow`). 

A strict cascading dependency relationship was established:
$$\text{Hospital Branch} \longrightarrow \text{Department} \longrightarrow \text{Doctor} \longrightarrow \text{Appointment Date} \longrightarrow \text{Available Time Slots}$$

Any modification to a parent selection immediately and deterministically clears all dependent children (e.g. changing Department from Cardiology to Dental immediately resets Doctor to `'Select Doctor'`, clears active doctor slots, and prevents stale doctor/slot booking).

All 26 test files (188 tests) in `@hms/patient-mobile` passed, TypeScript typecheck succeeded with 0 errors across both `@hms/patient-mobile` and `@hms/api`, ESLint succeeded with 0 errors/warnings, `apps/patient-web` diff remains exactly 0, and zero EAS build credits were consumed.

---

## 2. Compliance Checklist

| Requirement | Status | Details |
|---|---|---|
| **EAS Build Executed** | **NO** | No `eas build` commands run |
| **EAS Build Credits Consumed** | **NO** | 0 credits used |
| **Patient Web Modified** | **NO** | `git diff --stat apps/patient-web` = 0 changes |
| **Backend Modified** | **YES** | Minimal bugfix in `patient-portal.repository.ts` to prevent fallback to all doctors on filtered queries |
| **Department $\rightarrow$ Doctor Cascading** | **PASS** | Selecting a department queries and displays only doctors belonging to that department |
| **Stale Doctor Prevention** | **PASS** | Changing department immediately resets `doctorId` to `''` and displays `'Select Doctor'` or `'No doctors available'` |
| **Stale Slot Prevention** | **PASS** | Changing department or doctor immediately resets `selectedSlot` and `slotData` to `null` |

---

## 3. Current Implementation Audit & Root Cause Analysis

### A. Previous Implementation
- In `BookAppointmentModal.tsx`, all hospital departments were mapped as individual wrap-chips in a multi-row grid (`Cardiology`, `Dental`, `Dermatology`, `ENT`, `General Doctor`, `Gynecology & Obstetrics`, `Ophthalmology`, `Orthopedics`, `Pediatrics`, etc.).
- Doctors were similarly mapped as large multi-line chips.
- This consumed substantial vertical screen real estate, pushed Date Picker and Time Slots below the viewport fold, and created an overcrowded mobile interface.

### B. Root Cause of Unrestricted / Fallback Doctor Listing
- In `apps/api/src/modules/patient-portal/patient-portal.repository.ts`, `listPublicDoctors` contained an unconditional fallback:
  ```ts
  if (!doctors.length) {
    [doctors, total] = await Promise.all([
      DoctorModel.find(baseFilter)...
    ]);
  }
  ```
  When a department filter (`query.departmentId`) was passed but no doctors were found in that department, this fallback queried `baseFilter` (all active doctors across the entire hospital), returning unrelated doctors to the client.
- **Fix Applied:** Restricted fallback strictly to queries with no active filters:
  ```ts
  if (!doctors.length && !query.departmentId && !query.branchId && !query.search) {
    [doctors, total] = await Promise.all([
      DoctorModel.find(baseFilter)...
    ]);
  }
  ```
  Now, if a department has no active doctors, the backend correctly returns `data: []` (0 doctors).

---

## 4. UI Architecture & Responsive Two-Column Layout

### A. Compact Dropdown Trigger Row
The two large chip sections were replaced by a compact, side-by-side row:
```
┌────────────────────────────────────────────────────────┐
│ Department                         Doctor              │
│ ┌──────────────────────┐           ┌─────────────────┐ │
│ │ Cardiology         ▼ │           │ Dr. Daniel K. ▼ │ │
│ └──────────────────────┘           └─────────────────┘ │
└────────────────────────────────────────────────────────┘
```
- **Department Column (`cascadingColLeft`)**: Width ratio $\approx 47\%$ (`flex: 1`).
- **Doctor Column (`cascadingColRight`)**: Width ratio $\approx 53\%$ (`flex: 1.1`).
- **Trigger Box (`selectTrigger`)**: Standard 44dp accessible height, `colors.neutral.surface`, subtle border, clean text truncation (`numberOfLines={1}`, `ellipsizeMode="tail"`), and dropdown indicator (`▾`).

### B. Dedicated Accessible Selection Modals
Tapping either dropdown trigger opens a clean, full-width selection sheet modal (`isDepartmentPickerOpen` or `isDoctorPickerOpen`) that displays:
- Clear title and subtitle context (e.g. `"Cardiology Specialists"`).
- Dismiss button (`✕`) and backdrop touch-to-dismiss.
- Scrollable list with 48dp touch targets, full department/doctor names with qualifications and experience, and a checkmark indicator (`✓`) on the active selection.

---

## 5. Cascading State Machine & Lifecycle Transitions

| Trigger Event | Department State | Doctor State | Slot State | Next Action |
|---|---|---|---|---|
| **Modal Open / Patient Switch** | `''` (Placeholder) | `''` (`'Select dept first'`) | `null` | Loads branch departments; doctor disabled |
| **Branch Change** | Reset to `''` | Reset to `''` | `null` | Loads departments for new branch |
| **Select Department** | Updated (`'dept-cardio'`) | Reset to `''` | `null` | Triggers doctor fetch for `(branch, dept)` |
| **Doctor Loading** | Selected | `'Loading…'` (Disabled) | `null` | Spinner in doctor trigger |
| **Doctor Empty** | Selected | `'No doctors available'` (Disabled) | `null` | Disables doctor trigger, blocks booking |
| **Doctor Available** | Selected | `'Select Doctor'` (Enabled) | `null` | Enables doctor picker modal |
| **Select Doctor** | Selected | Updated (`'doc-kofi'`) | `null` | Triggers slot fetch for `(doctor, date)` |
| **Date Change** | Unchanged | Unchanged | Reset to `null` | Re-fetches slots for `(doctor, newDate)` |

---

## 6. Verification & Automated Test Results

### A. Vitest Test Suite (`@hms/patient-mobile`)
```
Test Files: 26 passed (26)
Tests:      188 passed (188)
Duration:   13.23s
```

All 17 required scenarios in `src/appointments/cascading-selection.test.ts` passed:
1. `Department list loads correctly for the selected branch` (PASS)
2. `Doctor selection is initially empty/unselected before department selection` (PASS)
3. `Selecting Cardiology loads ONLY Cardiology doctors` (PASS)
4. `Selecting Dental loads ONLY Dental doctors` (PASS)
5. `Doctors from unrelated departments are NOT shown` (PASS)
6. `Changing department immediately clears the previously selected doctor` (PASS)
7. `Changing department clears stale appointment slots` (PASS)
8. `Doctor selection loads the correct doctor slots` (PASS)
9. `Doctor loading state prevents interaction while loading` (PASS)
10. `Empty doctor list disables doctor selection and displays friendly notice` (PASS)
11. `Doctor loading error gracefully handles failures` (PASS)
12. `Re-selection / retry properly fetches new doctors` (PASS)
13. `Branch restriction remains intact for patient preferred branch` (PASS)
14. `Appointment booking payload contains selected department doctor and slots` (PASS)
15. `Timezone and appointment date format remain intact` (PASS)
16. `Expired slot calculation correctly rejects past slots on today` (PASS)
17. `Multi-step cascading dependency order: Branch → Dept → Doctor → Date → Slot` (PASS)

### B. TypeScript Compilation
- `npm run typecheck --workspace=@hms/patient-mobile` $\longrightarrow$ **0 errors** (`tsc --noEmit`).
- `npm run typecheck --workspace=@hms/api` $\longrightarrow$ **0 errors** (`tsc -p tsconfig.json --noEmit`).

### C. Linting
- `npm run lint --workspace=@hms/patient-mobile` $\longrightarrow$ **0 errors / 0 warnings** (`eslint .`).

---

## 7. Protected Workspaces & Scope Confirmation

- **`apps/patient-web`**: Diff is 0 bytes (`git diff --stat apps/patient-web` output is empty).
- **Authentication & OTP**: Untouched.
- **Billing & Notifications**: Untouched.
- **Profile Photo & Typography Tokens**: Untouched.
- **Timezone & Slot Availability Math**: Untouched and verified intact.
- **EAS Build**: 0 builds initiated, 0 credits used.
