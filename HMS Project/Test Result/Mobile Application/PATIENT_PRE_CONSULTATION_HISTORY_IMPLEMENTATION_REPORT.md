# Patient Pre-Consultation History — End-to-End Implementation Report

**Date:** September 28, 2026  
**Product:** MyCare (Patient Mobile Application) & HMS Clinical Portal  
**Document:** `PATIENT_PRE_CONSULTATION_HISTORY_IMPLEMENTATION_REPORT.md`  

---

## 1. Architecture Decision

### Problem Context
Previously, in `BookAppointmentModal.tsx`, patients could enter 5 clinical history fields, but only Chief Complaint was mapped to the appointment's `reason` field. The remaining four fields (*History of Present Illness*, *Past Medical History*, *Family History*, *Allergies / Sensitivities*) remained UI-only in client memory and were discarded upon submission.

### Architectural Solution
To maintain clinical safety and integrity:
1. **Separation of Concerns**: Patient-reported information is stored in a dedicated MongoDB collection `patient_pre_consultations` via [`PatientPreConsultationModel`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/appointments/patient-pre-consultation.model.ts).
2. **Atomic Submission**: The optional `clinical_history` object is submitted alongside the appointment creation in `POST /api/patient-portal/appointments` and persisted within the database transaction session, ensuring atomic linkage to `appointmentId` with zero risk of partial or orphaned records.
3. **Clinical Distinction**: Patient-reported information is **not** written into the doctor's [`OpdConsultationModel`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/opd/opd-consultation.model.ts). When the patient checks in and the doctor opens the OPD Visit in `apps/web`, the patient-reported information is displayed in a dedicated, read-only **"Patient-Reported Information (Pre-Consultation)"** card above the doctor's clinical documentation area. The doctor records their own diagnostic findings independently.

---

## 2. Data Model

### Mongoose Collection: `patient_pre_consultations`
```typescript
export type PatientPreConsultationFields = {
  appointmentId: Types.ObjectId;      // ref: 'Appointment' (Unique Index)
  patientId: Types.ObjectId;          // ref: 'Patient' (Indexed)
  doctorId?: Types.ObjectId | null;   // ref: 'Doctor'
  chiefComplaint?: string | null;     // Max 500 chars, trimmed
  historyPresentIllness?: string | null; // Max 500 chars, trimmed
  pastMedicalHistory?: string | null; // Max 500 chars, trimmed
  familyHistory?: string | null;      // Max 500 chars, trimmed
  allergies?: string | null;          // Max 500 chars, trimmed
  submittedAt: Date;                  // Default Date.now
  createdBy?: Types.ObjectId;         // ref: 'User'
  updatedBy?: Types.ObjectId;         // ref: 'User'
  deletedBy?: Types.ObjectId;         // ref: 'User'
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
```

### Indexes
- `{ appointmentId: 1 }` (Unique)
- `{ patientId: 1, submittedAt: -1 }`

---

## 3. API Contracts & Authorization

### 3.1. Appointment Booking with Pre-Consultation
- **Route:** `POST /api/patient-portal/appointments`
- **Authentication:** Bearer token (`authenticate(services)`)
- **Authorization:** `resolveAccessiblePatientId(userId, patient_id)` ensures the authenticated user is either the patient or an authorized guardian.
- **Request Body Schema (`Zod`):**
  ```typescript
  {
    patient_id: string;
    doctor_id: string;
    appointment_date: string; // YYYY-MM-DD
    start_time: string;       // HH:MM
    duration_minutes: number;
    visit_type: 'NEW_CONSULTATION' | 'FOLLOW_UP' | 'PROCEDURE';
    reason: string;           // Min 3, max 500 chars
    utc_datetime?: string;
    clinical_history?: {
      chief_complaint?: string;
      history_present_illness?: string;
      past_medical_history?: string;
      family_history?: string;
      allergies?: string;
    };
  }
  ```
- **Response:** `201 Created` with `{ data: { id, appointment_number, status } }`

### 3.2. Patient Portal Pre-Consultation Query
- **Route:** `GET /api/patient-portal/appointments/:appointmentId/pre-consultation`
- **Authentication:** `authenticate(services)`
- **Authorization:** Verifies patient ownership / guardian access before returning the pre-consultation record.

### 3.3. Doctor / OPD Visit Pre-Consultation Query
- **Route:** `GET /api/opd/visits/:visitId/pre-consultation`
- **Authentication:** `requirePermission(services, 'OPD', 'OPD Consultation', 'View')`
- **Resolution:** Resolves the visit's linked `appointment_id` to retrieve the patient-reported record.

---

## 4. Mobile Client Implementation

In [`BookAppointmentModal.tsx`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx):
- The 5 fields remain **100% optional** and are collapsed by default under `[ Optional ] + Add Details ▼`.
- When non-empty values are entered, `BookAppointmentModal` constructs `clinical_history` and submits it in the atomic booking request:
  ```typescript
  const clinicalHistoryPayload = hasClinicalData
    ? {
        chief_complaint: clinicalHistory.chiefComplaint.trim() || undefined,
        history_present_illness: clinicalHistory.historyPresentIllness.trim() || undefined,
        past_medical_history: clinicalHistory.pastMedicalHistory.trim() || undefined,
        family_history: clinicalHistory.familyHistory.trim() || undefined,
        allergies: clinicalHistory.allergies.trim() || undefined,
      }
    : undefined;
  ```
- If only Chief Complaint is entered, `effectiveReason = reason.trim() || clinicalHistory.chiefComplaint.trim()` satisfies the required reason while also persisting in the full pre-consultation record.

---

## 5. Doctor / OPD View & Separation from OpdConsultationModel

In [`OpdConsultationSection.tsx`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/components/opd/OpdConsultationSection.tsx) & [`OpdVisitPage.tsx`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/web/src/pages/OpdVisitPage.tsx):
- **Read-Only Separation:** Patient-reported information is rendered in a distinct card labeled **"Patient-Reported Information — Pre-Consultation (Mobile)"** with a clear `Read Only` tag and submission timestamp.
- **Doctor Form Independence:** Below the patient-reported card, the doctor's **"Doctor's Clinical Consultation"** form remains completely separate. The doctor documents clinical findings into [`OpdConsultationModel`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/opd/opd-consultation.model.ts) without patient values overwriting clinical notes.
- **Empty State:** If the patient provided no pre-consultation history, a subtle empty indicator is displayed: *"No patient-reported pre-consultation history provided."*

---

## 6. Security, Privacy & Context Isolation

1. **Strict Privacy:** Patient pre-consultation history fields are never logged to `console.log`, analytics, or included in client error diagnostics.
2. **Context Isolation:** When switching patient context in MyCare (e.g. from Self to Dependent), `handlePatientChange` immediately purges all in-memory clinical history state and collapses the form.
3. **Backend Access Gate:** The backend enforces patient isolation via `resolveAccessiblePatientId`. Unauthorized users cannot access or tamper with other patients' pre-consultation records.

---

## 7. Verification & Automated Test Results

### 1. Backend Tests (`apps/api`)
```
 ✓ src/modules/appointments/patient-pre-consultation.test.ts (7 tests passed)
   - retrieves pre-consultation record by appointment id
   - provides getPreConsultationByAppointmentId with id validation
   - rejects invalid appointment id for pre-consultation query
   - fetches patient pre-consultation history linked to the OPD visit appointment
   - returns null if the OPD visit was a walk-in without a prior scheduled appointment
   - allows patient to fetch pre-consultation for their own appointment
   - rejects cross-patient unauthorized access to another patient pre-consultation
```

### 2. Patient Mobile Tests (`apps/patient-mobile`)
```
 ✓ src/appointments/clinical-history-booking.test.ts (9 tests passed)
   - defines emptyClinicalHistory with all 5 OPD consultation fields initialized to empty strings
   - allows populated clinical history state across all 5 fields
   - calculates effective reason preferring reason input or falling back to chief complaint
   - preserves clean state reset when modal closes or patient changes
   - validates booking payload with NO clinical history
   - validates booking payload with ONLY Chief Complaint
   - validates booking payload with ONLY History of Present Illness
   - validates booking payload with ALL 5 clinical history fields
   - enforces 500-character limit on clinical history fields

 Total Mobile Test Suite: 24 test files passed (150 tests passed)
```

### 3. Web Component Tests (`apps/web`)
```
 ✓ src/components/opd/OpdConsultationSection.test.tsx
   - renders Clinical History section with all fields
   - does NOT render Examination & Assessment section or textareas
   - renders bottom actions and triggers handlers
   - renders Patient-Reported Information when preConsultation data exists
   - renders empty state when preConsultation is null
```

### 4. Typecheck & Lint
- `npm run typecheck --workspace=@hms/api` $\rightarrow$ **0 errors**
- `npm run typecheck --workspace=@hms/web` $\rightarrow$ **0 errors**
- `npm run typecheck --workspace=@hms/patient-mobile` $\rightarrow$ **0 errors**
- `npm run lint --workspace=@hms/patient-mobile` $\rightarrow$ **0 warnings / 0 errors**

---

## 8. Modified & Created Files

### Backend (`apps/api`)
- `apps/api/src/modules/appointments/patient-pre-consultation.model.ts` (New Mongoose model)
- `apps/api/src/modules/appointments/appointment.types.ts` (Added DTO & entity types)
- `apps/api/src/modules/appointments/appointment.repository.ts` (Added persistence & query methods)
- `apps/api/src/modules/appointments/appointment.service.ts` (Transactional saving of pre-consultation)
- `apps/api/src/modules/patient-portal/patient-portal.routes.ts` (Updated schema & added pre-consultation route)
- `apps/api/src/modules/patient-portal/patient-portal.service.ts` (Passed clinical history & authorized getter)
- `apps/api/src/modules/opd/opd-consultation.service.ts` (Added `getPreConsultation` for doctor view)
- `apps/api/src/modules/opd/opd-consultation.routes.ts` (Added `GET /api/opd/visits/:visitId/pre-consultation`)
- `apps/api/src/modules/appointments/patient-pre-consultation.test.ts` (Unit test suite)

### Web Clinical Frontend (`apps/web`)
- `apps/web/src/api/opd.ts` (Added `PatientPreConsultationResponse` and `getPreConsultation`)
- `apps/web/src/components/opd/OpdConsultationSection.tsx` (Rendered read-only Patient-Reported card)
- `apps/web/src/pages/OpdVisitPage.tsx` (Fetched pre-consultation and passed to section)
- `apps/web/src/components/opd/OpdConsultationSection.test.tsx` (Added unit tests)

### Patient Mobile (`apps/patient-mobile`)
- `apps/patient-mobile/src/appointments/contracts.ts` (Added `clinical_history` to `bookAppointmentInputSchema`)
- `apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx` (Transmitted 5-field pre-consultation payload)
- `apps/patient-mobile/src/appointments/clinical-history-booking.test.ts` (Comprehensive validation tests)

---

## 9. Compliance Confirmation

- **Patient Web Protection Check:** `git diff --stat apps/patient-web` $\rightarrow$ **0 lines changed (100% untouched)**.
- **EAS Builds:** **EAS build NOT executed** (0 cloud builds consumed).
- **Separation Verified:** Patient-reported data is isolated from `OpdConsultationModel` and presented read-only to clinicians.
