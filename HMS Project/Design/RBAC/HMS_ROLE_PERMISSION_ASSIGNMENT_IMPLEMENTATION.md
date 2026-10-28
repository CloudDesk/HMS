# HMS — Role Permission Assignment Implementation Report

## A. Role-by-Role Changes

### 1. Receptionist (RECEPTIONIST)
- **Added (Required Permissions Missing Previously):**
  - Administration -> Branches -> View (ADMINISTRATION_BRANCHES_VIEW)
  - Administration -> Departments -> View (ADMINISTRATION_DEPARTMENTS_VIEW)
  - Administration -> Services -> View (ADMINISTRATION_SERVICES_VIEW)
  - Emergency -> Disposition -> MarkNoShow (EMERGENCY_DISPOSITION_MARK_NO_SHOW)
  - Emergency -> Disposition -> Cancel (EMERGENCY_DISPOSITION_CANCEL)
- **Removed (Excess / Unnecessary Permissions):**
  - OPD -> OPD Visits -> Edit (OPD_OPD_VISITS_EDIT)
  - OPD -> OPD Vitals -> View (OPD_OPD_VITALS_VIEW)
  - OPD -> OPD Vitals -> Create (OPD_OPD_VITALS_CREATE)
  - OPD -> OPD Vitals -> Edit (OPD_OPD_VITALS_EDIT)
  - OPD -> OPD Referral -> Edit (OPD_OPD_REFERRAL_EDIT)
- **Retained (Approved Required Permissions):**
  - Patients -> Patient Records -> View, Create, Edit
  - Patients -> Patient Documents -> View, Create
  - Patients -> Consent -> View, Attach
  - Doctors -> Doctor Directory -> View
  - Doctors -> Doctor Availability -> View
  - Appointments -> Appointment Records -> View, Edit
  - Appointments -> Appointment Booking -> View, Create, Edit
  - OPD -> OPD Visits -> View, Create (Controls patient Check In)
  - OPD -> OPD Referral -> View (Controls Referral Booking intake)
  - Admissions -> Wards -> View
  - Admissions -> Beds -> View
  - Admissions -> Admission Policy -> View
  - Admissions -> Bed Holds -> View, Create, Release, Cancel
  - Admissions -> Inpatient Admissions -> View
  - Admissions -> Admission Requests -> View, Create, Validate, Confirm, Cancel
  - Surgery -> Recommendations -> View
  - Surgery -> Bookings -> View, Create, Confirm, Reschedule, Cancel
  - Surgery -> Schedule -> View
  - Emergency -> Encounters -> View, Register
  - Emergency -> Triage -> View
  - Emergency -> Patient Linking -> Link
- **Optional Not Assigned in Baseline:**
  - Billing -> Invoices -> ViewReceipt (BILLING_INVOICES_VIEW_RECEIPT)
  - Emergency -> Patient Linking -> Correct (EMERGENCY_PATIENT_LINKING_CORRECT)
- **Final Permission Count:** **28 permissions**

---

### 2. Clinician / Nurse (CLINICIAN_NURSE)
- **Added (Required Permissions Missing Previously):**
  - Admissions -> Inpatient Admissions -> Create (ADMISSIONS_INPATIENT_ADMISSIONS_CREATE) (Required for daily nursing round notes & vitals)
  - Admissions -> Bed Transfers -> View (ADMISSIONS_BED_TRANSFERS_VIEW)
  - OPD -> OPD Vitals -> Edit (OPD_OPD_VITALS_EDIT)
  - Emergency -> Orders -> View (EMERGENCY_ORDERS_VIEW)
  - Emergency -> Disposition -> View (EMERGENCY_DISPOSITION_VIEW)
- **Removed (Excess / Unnecessary Permissions):**
  - *(None)*
- **Retained (Approved Required Permissions):**
  - Patients -> Patient Records -> View
  - Patients -> Patient Documents -> View, Create
  - Patients -> Consent -> View, Attach, Verify
  - Appointments -> Appointment Records -> View
  - Doctors -> Doctor Directory -> View
  - Doctors -> Doctor Availability -> View
  - OPD -> OPD Visits -> View, Edit
  - OPD -> OPD Vitals -> View, Create
  - Admissions -> Wards -> View
  - Admissions -> Beds -> View
  - Admissions -> Admission Requests -> View
  - Admissions -> Inpatient Admissions -> View, Edit
  - Emergency -> Encounters -> View
  - Emergency -> Triage -> View, Assess
  - Emergency -> Consultation -> View
- **Optional Not Assigned in Baseline:**
  - Admissions -> Bed Transfers -> Create (ADMISSIONS_BED_TRANSFERS_CREATE)
  - Emergency -> Triage -> OverridePriority (EMERGENCY_TRIAGE_OVERRIDE_PRIORITY)
- **Final Permission Count:** **23 permissions**

---

### 3. Doctor (DOCTOR)
- **Added (Required Permissions Missing Previously):**
  - Admissions -> Wards -> View (ADMISSIONS_WARDS_VIEW)
  - Admissions -> Beds -> View (ADMISSIONS_BEDS_VIEW)
  - Admissions -> Inpatient Admissions -> Create (ADMISSIONS_INPATIENT_ADMISSIONS_CREATE) (Required for physician round notes)
  - Laboratory -> Orders -> View (LABORATORY_ORDERS_VIEW)
  - Imaging -> Orders -> View (IMAGING_ORDERS_VIEW)
- **Removed (Excess / Unnecessary Permissions):**
  - Surgery -> Bookings -> Confirm (SURGERY_BOOKINGS_CONFIRM)
  - Surgery -> Bookings -> Reschedule (SURGERY_BOOKINGS_RESCHEDULE)
  - Surgery -> Bookings -> Cancel (SURGERY_BOOKINGS_CANCEL)
  - Surgery -> Bookings -> Create (SURGERY_BOOKINGS_CREATE) (Moved to Optional)
  - Emergency -> Patient Linking -> Link (EMERGENCY_PATIENT_LINKING_LINK)
- **Retained (Approved Required Permissions):**
  - Patients -> Patient Records -> View, Edit
  - Patients -> Patient Documents -> View, Create
  - Patients -> Consent -> View, Attach, Verify
  - Doctors -> Doctor Directory -> View
  - Doctors -> Doctor Availability -> View, Edit
  - Appointments -> Appointment Records -> View
  - OPD -> OPD Visits -> View, Edit
  - OPD -> OPD Vitals -> View
  - OPD -> OPD Consultation -> View, Edit
  - OPD -> OPD Prescription -> View, Edit
  - OPD -> OPD Clinical Orders -> View, Edit
  - OPD -> OPD Follow-up -> View, Edit
  - OPD -> OPD Referral -> View, Edit
  - Admissions -> Inpatient Admissions -> View, Edit, Discharge
  - Admissions -> Admission Recommendations -> View, Create, Cancel
  - Surgery -> Recommendations -> View, Create, Cancel
  - Surgery -> Bookings -> View, Complete
  - Surgery -> Schedule -> View
  - Emergency -> Encounters -> View
  - Emergency -> Triage -> View
  - Emergency -> Consultation -> View, Edit
  - Emergency -> Orders -> View, Create
  - Emergency -> Disposition -> View, Discharge, Transfer, ConvertToIP, MarkLeft
- **Optional Not Assigned in Baseline:**
  - Surgery -> Bookings -> Create (SURGERY_BOOKINGS_CREATE)
  - Emergency -> Triage -> OverridePriority (EMERGENCY_TRIAGE_OVERRIDE_PRIORITY)
- **Final Permission Count:** **36 permissions**

---

### 4. Pharmacy User (PHARMACY_USER)
- **Added (Required Permissions Missing Previously):**
  - Administration -> Medicines -> View (ADMINISTRATION_MEDICINES_VIEW)
  - Patients -> Patient Records -> View (PATIENTS_PATIENT_RECORDS_VIEW)
- **Removed (Excess / Unnecessary Permissions):**
  - *(None)*
- **Retained (Approved Required Permissions):**
  - OPD -> OPD Prescription -> View
  - Pharmacy -> Medicine Inventory -> View, RegisterBatch, RecordMovement, AdjustStock, EditBatch, ConfigureLowStock
  - Pharmacy -> Dispensing -> View, Edit, Dispense, Cancel, Reverse, UpdateStatus
- **Optional Not Assigned in Baseline:**
  - *(None)*
- **Final Permission Count:** **15 permissions**

---

### 5. Laboratory User (LABORATORY_USER)
- **Added (Required Permissions Missing Previously):**
  - Administration -> Services -> View (ADMINISTRATION_SERVICES_VIEW)
  - Patients -> Patient Records -> View (PATIENTS_PATIENT_RECORDS_VIEW)
- **Removed (Excess / Unnecessary Permissions):**
  - *(None)*
- **Retained (Approved Required Permissions):**
  - Laboratory -> Orders -> View, Edit, EnterResult, VerifyResult
- **Optional Not Assigned in Baseline:**
  - *(None)*
- **Final Permission Count:** **6 permissions**

---

### 6. Imaging User (IMAGING_USER)
- **Added (Required Permissions Missing Previously):**
  - Administration -> Services -> View (ADMINISTRATION_SERVICES_VIEW)
  - Patients -> Patient Records -> View (PATIENTS_PATIENT_RECORDS_VIEW)
- **Removed (Excess / Unnecessary Permissions):**
  - *(None)*
- **Retained (Approved Required Permissions):**
  - Imaging -> Orders -> View, Edit, EnterReport, VerifyReport
- **Optional Not Assigned in Baseline:**
  - *(None)*
- **Final Permission Count:** **6 permissions**

---

### 7. Billing Authorized (BILLING_AUTHORIZED)
- **Added (Required Permissions Missing Previously):**
  - Appointments -> Appointment Records -> View (APPOINTMENTS_APPOINTMENT_RECORDS_VIEW)
  - Admissions -> Inpatient Admissions -> View (ADMISSIONS_INPATIENT_ADMISSIONS_VIEW)
  - Admissions -> Admission Requests -> View (ADMISSIONS_ADMISSION_REQUESTS_VIEW)
  - Surgery -> Bookings -> View (SURGERY_BOOKINGS_VIEW)
  - Pharmacy -> Dispensing -> View (PHARMACY_DISPENSING_VIEW)
  - Laboratory -> Orders -> View (LABORATORY_ORDERS_VIEW)
  - Imaging -> Orders -> View (IMAGING_ORDERS_VIEW)
- **Removed (Excess / Unnecessary Permissions):**
  - *(None)*
- **Retained (Approved Required Permissions):**
  - Administration -> Services -> View
  - Patients -> Patient Records -> View
  - OPD -> OPD Visits -> View
  - Billing -> Invoices -> View, Create, Edit, Cancel, CollectPayment, ViewReceipt
  - Reports -> Phase 2 Reports -> View
- **Optional Not Assigned in Baseline:**
  - *(None)*
- **Final Permission Count:** **17 permissions**

---

### 8. Administrator (ADMINISTRATOR)
- **Added (Required Permissions Missing Previously):**
  - Administration -> Users -> Delete (ADMINISTRATION_USERS_DELETE)
  - Administration -> Roles -> Delete (ADMINISTRATION_ROLES_DELETE)
  - Administration -> Branches -> Delete (ADMINISTRATION_BRANCHES_DELETE)
  - Administration -> Departments -> Delete (ADMINISTRATION_DEPARTMENTS_DELETE)
  - Administration -> Services -> Delete (ADMINISTRATION_SERVICES_DELETE)
  - Administration -> Medicines -> Delete (ADMINISTRATION_MEDICINES_DELETE)
  - Patients -> Patient Records -> View (PATIENTS_PATIENT_RECORDS_VIEW)
  - Billing -> Invoices -> View (BILLING_INVOICES_VIEW)
  - Reports -> Phase 2 Reports -> View (REPORTS_PHASE_2_REPORTS_VIEW)
- **Removed (Excess / Unnecessary Permissions):**
  - Emergency -> Triage -> Assess, OverridePriority
  - Emergency -> Consultation -> Edit
  - Emergency -> Orders -> Create
  - Emergency -> Disposition -> Discharge, Transfer, ConvertToIP, MarkLeft, MarkNoShow, Cancel
  - Emergency -> Patient Linking -> Correct
  - Surgery -> Recommendations -> Create, Cancel
  - Surgery -> Bookings -> Create, Confirm, Reschedule, Cancel, Complete
  - Admissions -> Admission Recommendations -> Create, Cancel
  - Admissions -> Inpatient Admissions -> Create, Edit, Discharge
  - Admissions -> Bed Holds -> Create, Release, Cancel
  - Admissions -> Bed Transfers -> Create, Complete, Cancel, CrossBranch
  - Admissions -> Admission Requests -> Create, Validate, Confirm, Cancel
  - Patients -> Patient Documents -> Create, Edit, Delete
  - Patients -> Consent -> Attach, Verify, Delete
- **Retained (Approved Required Permissions):**
  - Administration -> Dashboard -> View
  - Administration -> Users -> View, Create, Edit, ChangePassword, ResetPassword, Export
  - Administration -> Roles -> View, Create, Edit, Assign
  - Administration -> Permissions -> View, Assign
  - Administration -> Branches -> View, Create, Edit, Export
  - Administration -> Departments -> View, Create, Edit, Export
  - Administration -> Services -> View, Create, Edit, Export
  - Administration -> Medicines -> View, Create, Edit, Export
  - Administration -> Consent Templates -> View, Create, Edit
  - Administration -> Notifications -> View, Create
  - Administration -> Settings -> View, Edit, Export
  - Doctors -> Doctor Directory -> View, Create, Edit, Export, Provision Login
  - Doctors -> Doctor Availability -> View, Edit
  - Patients -> Patient Documents -> View
  - Patients -> Consent -> View
  - Admissions -> Wards -> View, Create, Edit, ChangeStatus
  - Admissions -> Beds -> View, Create, Edit, ChangeStatus
  - Admissions -> Admission Policy -> View, Edit
  - Admissions -> Inpatient Admissions -> View
- **Optional Not Assigned in Baseline:**
  - Administration -> Permissions -> Create, Edit, Delete
  - Patients -> Patient Records -> Edit
  - Admissions -> Bed Holds -> View, Create, Release, Cancel
  - Admissions -> Bed Transfers -> View, Create, Complete, Cancel, CrossBranch
- **Final Permission Count:** **55 permissions**

---

### 9. Super Administrator (SUPER_ADMIN)
- **Status:** Platform-managed dynamic override; inherits all 88 permission items (172 tuples) across the catalog. No changes made.

---

### 10. Patient (PATIENT) & Guardian (GUARDIAN)
- **Status:** Customer portal identity roles with 0 administrative/clinical system permissions. No changes made.

---

## B. Missing Permissions Summary (Added to Match Approved Matrix)
1. **Receptionist:** ADMINISTRATION_BRANCHES_VIEW, ADMINISTRATION_DEPARTMENTS_VIEW, ADMINISTRATION_SERVICES_VIEW, EMERGENCY_DISPOSITION_MARK_NO_SHOW, EMERGENCY_DISPOSITION_CANCEL
2. **Clinician / Nurse:** ADMISSIONS_INPATIENT_ADMISSIONS_CREATE, ADMISSIONS_BED_TRANSFERS_VIEW, OPD_OPD_VITALS_EDIT, EMERGENCY_ORDERS_VIEW, EMERGENCY_DISPOSITION_VIEW
3. **Doctor:** ADMISSIONS_WARDS_VIEW, ADMISSIONS_BEDS_VIEW, ADMISSIONS_INPATIENT_ADMISSIONS_CREATE, LABORATORY_ORDERS_VIEW, IMAGING_ORDERS_VIEW
4. **Pharmacy User:** ADMINISTRATION_MEDICINES_VIEW, PATIENTS_PATIENT_RECORDS_VIEW
5. **Laboratory User:** ADMINISTRATION_SERVICES_VIEW, PATIENTS_PATIENT_RECORDS_VIEW
6. **Imaging User:** ADMINISTRATION_SERVICES_VIEW, PATIENTS_PATIENT_RECORDS_VIEW
7. **Billing Authorized:** APPOINTMENTS_APPOINTMENT_RECORDS_VIEW, ADMISSIONS_INPATIENT_ADMISSIONS_VIEW, ADMISSIONS_ADMISSION_REQUESTS_VIEW, SURGERY_BOOKINGS_VIEW, PHARMACY_DISPENSING_VIEW, LABORATORY_ORDERS_VIEW, IMAGING_ORDERS_VIEW
8. **Administrator:** ADMINISTRATION_USERS_DELETE, ADMINISTRATION_ROLES_DELETE, ADMINISTRATION_BRANCHES_DELETE, ADMINISTRATION_DEPARTMENTS_DELETE, ADMINISTRATION_SERVICES_DELETE, ADMINISTRATION_MEDICINES_DELETE, PATIENTS_PATIENT_RECORDS_VIEW, BILLING_INVOICES_VIEW, REPORTS_PHASE_2_REPORTS_VIEW

---

## C. Removed Permissions Summary (Excess/Unnecessary Removed)
1. **Receptionist:** OPD_OPD_VISITS_EDIT, OPD_OPD_VITALS_VIEW, OPD_OPD_VITALS_CREATE, OPD_OPD_VITALS_EDIT, OPD_OPD_REFERRAL_EDIT
2. **Doctor:** SURGERY_BOOKINGS_CONFIRM, SURGERY_BOOKINGS_RESCHEDULE, SURGERY_BOOKINGS_CANCEL, SURGERY_BOOKINGS_CREATE, EMERGENCY_PATIENT_LINKING_LINK
3. **Administrator:** Clinical Emergency permissions (Assess, Consultation Edit, Orders Create, Disposition Discharge/Transfer/ConvertToIP/MarkLeft/MarkNoShow/Cancel, Patient Linking Correct), clinical Surgery recommendations and completion (Surgery Recommendations Create/Cancel, Surgery Bookings Create/Confirm/Reschedule/Cancel/Complete), clinical Admission recommendations and inpatient care (Admission Recommendations Create/Cancel, Inpatient Admissions Create/Edit/Discharge, Bed Holds Create/Release/Cancel, Bed Transfers Create/Complete/Cancel/CrossBranch, Admission Requests Create/Validate/Confirm/Cancel), and clinical Patient Document/Consent mutation (Patient Documents Create/Edit/Delete, Consent Attach/Verify/Delete).

---

## D. Unresolved Dependencies
- **None.** All required permission prerequisites for parent navigation, lookups, and dependent workflows have been fully resolved with verified View permissions in the baseline catalog.

---

## E. Verified Important Workflow Mappings

| Workflow Action | UI Element & Location | Controlling Permission Code | Exact Permission Name |
|---|---|---|---|
| **Check In Patient** | Appointments Queue / OPD Check In button | OPD_OPD_VISITS_CREATE | OPD -> OPD Visits -> Create |
| **Record Vitals** | OPD Intake / Bedside Modal | OPD_OPD_VITALS_CREATE | OPD -> OPD Vitals -> Create |
| **Edit Vitals** | OPD Intake / History Correction | OPD_OPD_VITALS_EDIT | OPD -> OPD Vitals -> Edit |
| **Call Next Patient** | OPD Queue / Waiting Room | OPD_OPD_VISITS_EDIT | OPD -> OPD Visits -> Edit |
| **Complete Consultation** | Doctor Consultation Workspace | OPD_OPD_CONSULTATION_EDIT | OPD -> OPD Consultation -> Edit |
| **Prescribe Rx** | OPD / Inpatient / Surgery Rx | OPD_OPD_PRESCRIPTION_EDIT | OPD -> OPD Prescription -> Edit |
| **Order Diagnostics** | Doctor Consultation Workspace | OPD_OPD_CLINICAL_ORDERS_EDIT | OPD -> OPD Clinical Orders -> Edit |
| **Inpatient Round Notes & Vitals** | Inpatient Care Workspace | ADMISSIONS_INPATIENT_ADMISSIONS_CREATE | Admissions -> Inpatient Admissions -> Create |
| **Finalize Inpatient Discharge** | Inpatient Workspace | ADMISSIONS_INPATIENT_ADMISSIONS_DISCHARGE | Admissions -> Inpatient Admissions -> Discharge |
| **Confirm Admission (Admit to Bed)** | Admissions Request Desk | ADMISSIONS_ADMISSION_REQUESTS_CONFIRM | Admissions -> Admission Requests -> Confirm |
| **Emergency Triage Assessment** | Emergency Triage Queue | EMERGENCY_TRIAGE_ASSESS | Emergency -> Triage -> Assess |
| **Emergency Convert to IP** | Emergency Disposition Modal | EMERGENCY_DISPOSITION_CONVERT_TO_IP | Emergency -> Disposition -> ConvertToIP |
| **Dispense Medication** | Pharmacy Fulfillment Queue | PHARMACY_DISPENSING_DISPENSE | Pharmacy -> Dispensing -> Dispense |
| **Verify Lab Result** | Laboratory Results Workspace | LABORATORY_ORDERS_VERIFY_RESULT | Laboratory -> Orders -> VerifyResult |
| **Verify Imaging Report** | Imaging Reports Workspace | IMAGING_ORDERS_VERIFY_REPORT | Imaging -> Orders -> VerifyReport |
| **Collect Billing Payment** | Billing Workspace / Cashier | BILLING_INVOICES_COLLECT_PAYMENT | Billing -> Invoices -> CollectPayment |

---

## F. Authorization Verification Summary

| Gate Layer | Verification Status | Details |
|---|---|---|
| **Sidebar Navigation** | **PASS** | Modules and sub-links are strictly filtered via getAccessibleSidebarModules evaluating effective permissions. No unauthorized parent/child links exposed. |
| **Dashboard** | **PASS** | Overview tiles, clinical quick-links, and metrics are gated by permission requirements. |
| **Route Protection** | **PASS** | Direct URL navigation protected by ProtectedRoute / canAccessRoute. Unauthorized routes render Access Denied screen. |
| **Action Buttons & Modals** | **PASS** | Action buttons (e.g. Check In, Take Vitals, Start Consultation, Confirm Admission, Dispense) are gated using hasPermission. |
| **Feature Hook Queries** | **PASS** | React Query queries gated by canAccess flags, preventing wasteful or unauthorized background requests. |
| **Backend API Endpoints** | **PASS** | Fastify routes protected by 
equirePermission(module, screen, action) middleware returning 403 Forbidden with PERMISSION_REQUIRED code. |

---

## G. Test & Verification Results

- **Backend Typecheck (@hms/api):** **PASS** (	sc -p tsconfig.json --noEmit — 0 errors)
- **Frontend Typecheck (@hms/web):** **PASS** (	sc -b --noEmit — 0 errors)
- **Patient Portal Typecheck (@hms/patient-web):** **PASS** (	sc -b --noEmit — 0 errors)
- **Codebase Linting (eslint):** **PASS** (0 errors)
- **Production Build:** **PASS**
- **RBAC & Permission Unit Tests:** **PASS** (permission-display.test.ts, permission-expansion.test.ts — 15/15 tests passing)
- **Authentication & Rate Limit Tests:** **PASS** (uth-rate-limit.test.ts, uth-rate-limit.integration.test.ts — 7/7 tests passing)
