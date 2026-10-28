# Optional Clinical History Data Flow Audit & Architecture Verification

**Date:** September 28, 2026  
**Product:** MyCare (Patient Mobile Application)  
**Document:** `OPTIONAL_CLINICAL_HISTORY_DATA_FLOW_AUDIT.md`  

---

## 1. Executive Summary & Trace Overview

This audit traces the exact end-to-end data flow when a patient enters clinical history fields in the MyCare Mobile app (`BookAppointmentModal.tsx`) and taps **Confirm Booking**.

### End-to-End Flow Path
`BookAppointmentModal.tsx` (Mobile UI)  
$\longrightarrow$ `AppointmentsApi.bookAppointment()` (`apps/patient-mobile/src/appointments/appointments-api.ts`)  
$\longrightarrow$ `POST /api/patient-portal/appointments` (`apps/api/src/modules/patient-portal/patient-portal.routes.ts`)  
$\longrightarrow$ `PatientPortalService.bookAppointment()` (`apps/api/src/modules/patient-portal/patient-portal.service.ts`)  
$\longrightarrow$ `AppointmentService.createForPortal()` (`apps/api/src/modules/appointments/appointment.service.ts`)  
$\longrightarrow$ MongoDB `appointments` collection (`AppointmentModel` in `apps/api/src/modules/appointments/appointment.model.ts`)  

---

## 2. Field-by-Field Submission, Persistence & Availability Matrix

| # | Mobile Field | Request Field Name | Backend Field Name | Actually Submitted? | Actually Persisted? | Where Persisted? | Later Available to Doctor/OPD Visit? |
|---|--------------|-------------------|-------------------|--------------------|--------------------|-----------------|--------------------------------------|
| **1** | **Chief Complaint** | `reason` *(via `effectiveReason` fallback)* | `reason` | **Yes** *(as `reason`)* | **Yes** | MongoDB `appointments.reason` | **Yes** (Visible on Doctor appointment schedule & check-in) |
| **2** | **History of Present Illness** | *None* | *None* | **No** (UI-only) | **No** | *Not persisted* | **No** (Not available to doctor) |
| **3** | **Past Medical History** | *None* | *None* | **No** (UI-only) | **No** | *Not persisted* | **No** (Not available to doctor) |
| **4** | **Family History** | *None* | *None* | **No** (UI-only) | **No** | *Not persisted* | **No** (Not available to doctor) |
| **5** | **Allergies / Sensitivities** | *None* | *None* | **No** (UI-only) | **No** | *Not persisted* | **No** (Not available to doctor) |

---

## 3. Detailed Data Flow Analysis

### 3.1. Mobile Client (`BookAppointmentModal.tsx`)
When the user submits the form:
```typescript
const effectiveReason = reason.trim() || clinicalHistory.chiefComplaint.trim();

const result = await appointmentsApi.bookAppointment({
  patient_id: patientId,
  doctor_id: doctorId,
  appointment_date: appointmentDate,
  start_time: selectedSlot.start_time,
  duration_minutes: duration > 0 ? duration : 15,
  visit_type: visitType,
  reason: effectiveReason,
  utc_datetime: utcDate.toISOString(),
});
```
- **Chief Complaint**: If `reason` is blank, `chiefComplaint` directly populates `reason`. If `reason` is filled, `reason` takes precedence.
- **Other 4 Fields** (`historyPresentIllness`, `pastMedicalHistory`, `familyHistory`, `allergies`): Currently retained in React component state only. They are **not** attached to the HTTP request payload.

### 3.2. API Client & Backend Contract
- **Client Transport Payload**: Strictly conforms to `bookAppointmentInputSchema`.
- **Backend Route Validation** (`POST /api/patient-portal/appointments`):
  ```typescript
  const bookAppointmentSchema = z.object({
    patient_id: z.string().min(1),
    doctor_id: z.string().min(1),
    appointment_date: z.string().date(),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    duration_minutes: z.number().int().min(5).max(240),
    visit_type: z.enum(['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE']),
    reason: z.string().trim().min(3).max(500),
    utc_datetime: z.string().optional(),
  });
  ```
  Any extraneous keys would not be processed.

### 3.3. Persistence Model (`AppointmentModel`)
- The appointment document stores:
  - `appointmentNumber`, `patientId`, `patientNumber`, `patientName`, `doctorId`, `doctorName`, `doctorSpecialization`, `branchId`, `departmentId`, `appointmentDate`, `startTime`, `endTime`, `durationMinutes`, `visitType`, `priority`, `status`, **`reason`**, `notes`.
- **`reason`** is persisted and indexed.

### 3.4. Clinical Domain Context (`OpdConsultation`)
- In HMS clinical operations, the full 5-field clinical history schema:
  - `chiefComplaint`
  - `historyPresentIllness`
  - `pastHistory`
  - `familyHistory`
  - `allergies`
  resides in the `OpdConsultation` model (`apps/api/src/modules/opd/opd-consultation.model.ts`), which is created/updated by the treating clinician during the actual OPD visit encounter.

---

## 4. Current Limitations & Architectural Summary

> [!NOTE]
> **Explicit Limitation Confirmation**:
> The 4 clinical fields (**History of Present Illness**, **Past Medical History**, **Family History**, **Allergies / Sensitivities**) are currently **UI-only on the mobile frontend**.
> Only **Chief Complaint** / **Reason for Visit** is transmitted over the network and persisted into MongoDB `appointments.reason`.

---

## 5. Verification Check

| Verification Item | Status | Details |
|-------------------|--------|---------|
| **Patient Web Diff** | **0 lines** | `git diff --stat apps/patient-web` returns 0 changes. |
| **Backend Diff** | **3 files modified** | `appointment.service.ts`, `patient-portal.routes.ts`, `patient-portal.service.ts` (for `utc_datetime` normalization). |
| **Mobile Tests** | **Passed** | 24 test files / 145 tests passed (`vitest`). |
| **Typecheck** | **Passed** | `tsc --noEmit` exited with code 0. |
| **Lint** | **Passed** | `eslint .` exited with code 0. |
| **EAS Builds** | **0 triggered** | No EAS cloud builds consumed. |
