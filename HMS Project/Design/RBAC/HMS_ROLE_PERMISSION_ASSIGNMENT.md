# HMS — Role-Based Permission Assignment Analysis

This document provides a comprehensive, ground-truth analysis of the Role-Based Access Control (RBAC) architecture, permissions catalog, module security structures, and action-to-permission mappings within the Hospital Management System (HMS).

> **Source of Truth Note:**
> All role definitions, permission names, module hierarchies, screens, actions, and UI/API access controls analyzed in this document are derived directly from the current HMS implementation (`apps/api/src/database/seed.ts`, `apps/api/src/modules/permissions/*`, `apps/api/src/modules/**/*.routes.ts`, and `apps/web/src/auth/access-control.ts`). No code, roles, or permissions have been modified or invented.

---

## 1. Existing Roles in HMS

The HMS application defines the following system roles seeded in `RoleModel` (`apps/api/src/database/seed.ts`):

| # | Role Code | Role Name | Role Type | Description / Baseline Scope |
|---|---|---|---|---|
| 1 | `SUPER_ADMIN` | **Super Administrator** | System | Restricted platform/bootstrap break-glass access. Dynamically inherits all active system permissions across all modules. |
| 2 | `ADMINISTRATOR` | **Administrator** | System | System management, organizational masters (branches, departments, services, medicines), user provisioning, role assignments, consent templates, and clinical configuration. |
| 3 | `RECEPTIONIST` | **Receptionist** | System | Front-desk operations: patient registration, scheduling/appointments, queue check-in, admission requests, bed holds, referral bookings, and emergency walk-in intake. |
| 4 | `CLINICIAN_NURSE` | **Clinician / Nurse** | System | Clinical triage and nursing care: patient intake, vitals recording (OPD & IP), queue status transitions, inpatient nursing round notes, and emergency triage assessment. |
| 5 | `DOCTOR` | **Doctor** | System | Physician clinical operations: OPD consultations, clinical orders (Lab/Imaging), e-prescriptions, medical referrals, admission/surgery recommendations, emergency evaluations, inpatient discharge summaries, and availability/leave management. |
| 6 | `PHARMACY_USER` | **Pharmacy User** | System | Pharmacy dispensary and inventory: prescription order fulfillment, batch allocation, dispensing confirmations, returns/reversals, stock receipts/movements, and batch adjustments. |
| 7 | `LABORATORY_USER` | **Laboratory User** | System | Diagnostic pathology/laboratory workflow: work queue processing, specimen tracking, test result entry, and laboratory result verification. |
| 8 | `IMAGING_USER` | **Imaging User** | System | Diagnostic radiology/imaging workflow: imaging study work queue, scan reporting, attachment review, and imaging report verification. |
| 9 | `BILLING_AUTHORIZED` | **Billing Authorized** | System | Financial operations: invoice generation, itemized billing, fee adjustments, payment collections, receipts, admission/surgery deposit tracking, and financial reports. |
| 10 | `PATIENT` | **Patient** | System | Patient portal identity (0 administrative/clinical permissions; authenticated access via self-service patient portal APIs). |
| 11 | `GUARDIAN` | **Parent / Guardian** | System | Guardian portal identity (0 administrative/clinical permissions; authenticated access via dependent patient portal APIs). |

---

## 2. Role Responsibilities & Functional Scope

### Receptionist
- **Patient Registration & Demographics:** Search, register new patients, update demographic and insurance details.
- **Document Management:** Scan/upload identity proofs, insurance documents, and general admission consent forms.
- **Doctor Directory & Schedules:** Look up physician specialties, schedules, and active consultation slot availability.
- **Appointment Lifecycle:** Book new appointments, reschedule appointments, cancel appointments, and book doctor-referred appointments.
- **OPD Front-Desk Check-In:** Check in appointed and walk-in patients upon arrival, generating live OPD visits for clinical waiting queues.
- **Admissions Desk:** Look up ward/bed availability, create bed holds, submit IP admission requests, and confirm validated admissions.
- **Emergency Front-Desk:** Register emergency walk-in arrivals and link unidentified trauma patients to verified medical records.

### Clinician / Nurse
- **OPD Clinical Intake:** Retrieve waiting patients from the queue, measure and record baseline vital signs (BP, Pulse, Temperature, SpO2, Respiratory Rate, Height, Weight, BMI, Pain Score).
- **Patient EMR Review:** Review patient history, allergies, uploaded clinical documents, and verified consent forms.
- **Inpatient Care Delivery:** Record regular nursing round notes, monitor inpatient vitals, track ward/bed assignments, and review inpatient care orders.
- **Emergency Triage:** Perform rapid initial triage assessment, assign triage priority levels (Immediate, Emergency, Urgent, Semi-Urgent, Non-Urgent), and record primary emergency complaints.

### Doctor (Physician / Surgeon / Specialist)
- **Consultation Workspace:** Call patients into the consultation room, record clinical history, symptoms, examination findings, provisional/final diagnoses (with ICD-10 coding), and treatment plans.
- **Clinical Orders & Diagnostics:** Order laboratory investigations and radiological imaging studies directly from consultation and inpatient workspaces.
- **Medication Management:** Formulate electronic prescriptions with dosage, frequency, duration, and dispensing instructions.
- **Care Continuity:** Schedule follow-up visits, generate specialist referrals, and create admission or surgery recommendations.
- **Inpatient Care & Discharge:** Conduct inpatient rounds, review diagnostics, issue inpatient medication orders, author discharge summaries, and finalize medical discharges.
- **Emergency Doctor Evaluation:** Perform rapid physician assessments, issue emergency orders, and execute medical dispositions (Discharge, Transfer, Convert to Inpatient, Mark Left).
- **Schedule Management:** Maintain working availability, specify slot templates, and file leave requests or schedule exceptions.

### Pharmacy User (Pharmacist / Pharmacy Technician)
- **Prescription Queue Management:** Access pending electronic prescriptions from OPD, Emergency, and Inpatient units.
- **Dispensing Execution:** Review ordered medications, allocate specific batches based on FEFO (First-Expired, First-Out), verify quantities, and confirm dispensing.
- **Returns & Reversals:** Process medication returns, issue controlled dispensing cancellations, and reverse transactions when required.
- **Pharmacy Stock & Batch Control:** View stock balances, register newly received medicine batches (batch number, expiry, MRP, cost), record receipts/issues (stock movements), perform audited stock adjustments for damage/loss, and configure low-stock reorder thresholds.

### Laboratory User (Lab Technician / Pathologist)
- **Lab Order Queue:** Receive diagnostic laboratory orders ordered by physicians across OPD, IP, and Emergency.
- **Test Processing:** Update test processing statuses (`IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
- **Result Entry:** Record quantitative and qualitative test values, reference intervals, unit measurements, and abnormal flags.
- **Result Verification:** Review test findings and authorize/verify laboratory reports for clinical release into the patient's EMR.

### Imaging User (Radiographer / Radiologist)
- **Imaging Work Queue:** Receive and triage radiological study orders (X-Ray, Ultrasound, CT, MRI).
- **Study Processing:** Update scan execution statuses (`IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
- **Report Entry & Attachments:** Document radiological observations, findings, impressions, and attach DICOM/image scans.
- **Report Verification:** Review diagnostic impressions and authorize/verify finalized imaging reports for physician consultation.

### Billing Authorized (Billing Officer / Cashier)
- **Invoice Generation:** Generate consolidated invoices for OPD consultations, diagnostic tests, procedures, pharmacy supplies, and inpatient stays.
- **Billing Context & Adjustments:** Link invoices to active admission or procedure encounters, apply approved service fee adjustments, and apply authorized discounts.
- **Payment Collection & Receipts:** Record payments across multiple tender types (Cash, Card, UPI, Bank Transfer, Insurance), track payment splits, and issue formal receipts.
- **Advance Deposits:** Collect and monitor advance payment deposits for inpatient admissions and surgical procedures.
- **Billing Audits & Inquiries:** Review invoice histories, cancel erroneously generated bills with audit reasons, and inspect daily financial summaries.

### Administrator
- **Identity & Access Management:** Provision user accounts, assign roles, manage branch/department assignments, and reset user passwords.
- **Role & Permission Management:** Create custom roles, manage permission allocations, and audit security events.
- **Hospital Masters & Configuration:** Maintain hospital branches, clinical/administrative departments, service catalog/pricing, and central medicine master.
- **Compliance & Templates:** Manage formal patient consent templates and system notification rules.
- **Operational Governance:** Review system dashboard metrics, admission policies, ward/bed master setup, and executive reports.

---

## 3. Important UI Action → Permission Mappings

The HMS enforces security at both API endpoints and React UI buttons using specific permissions from the HMS catalog. Below is the mapping of functional UI actions to their controlling permissions:

| Functional UI Action | Screen / Feature Area | Controlling Permission Code | Exact Permission Name |
|---|---|---|---|
| **Check In Patient** | Appointments Queue / OPD Waiting Queue | `OPD_OPD_VISITS_CREATE` | OPD → OPD Visits → Create |
| **Call Next Patient** | OPD Queue / Emergency Queue | `OPD_OPD_VISITS_EDIT` / `EMERGENCY_CONSULTATION_EDIT` | OPD → OPD Visits → Edit / Emergency → Consultation → Edit |
| **Book Appointment** | Book Appointment / Referrals | `APPOINTMENTS_APPOINTMENT_BOOKING_CREATE` | Appointments → Appointment Booking → Create |
| **Reschedule Appointment** | Appointment Records / Calendar | `APPOINTMENTS_APPOINTMENT_BOOKING_EDIT` | Appointments → Appointment Booking → Edit |
| **Cancel Appointment** | Appointment Records / Queue | `APPOINTMENTS_APPOINTMENT_RECORDS_EDIT` | Appointments → Appointment Records → Edit |
| **Book Referral** | Referral Booking Workspace | `OPD_OPD_REFERRAL_VIEW` + `APPOINTMENTS_APPOINTMENT_BOOKING_CREATE` | OPD → OPD Referral → View & Appointments → Appointment Booking → Create |
| **Record Vitals (OPD)** | OPD Intake / Vitals Modal | `OPD_OPD_VITALS_CREATE` | OPD → OPD Vitals → Create |
| **Edit Vitals (OPD)** | OPD Vitals History | `OPD_OPD_VITALS_EDIT` | OPD → OPD Vitals → Edit |
| **Save Consultation Draft** | Doctor Consultation Workspace | `OPD_OPD_CONSULTATION_EDIT` | OPD → OPD Consultation → Edit |
| **Complete Consultation** | Doctor Consultation Workspace | `OPD_OPD_CONSULTATION_EDIT` | OPD → OPD Consultation → Edit |
| **Submit E-Prescription** | OPD / Inpatient / Surgery Prescriptions | `OPD_OPD_PRESCRIPTION_EDIT` | OPD → OPD Prescription → Edit |
| **Submit Clinical Orders (Lab/Imaging)** | OPD / Inpatient / Surgery Orders | `OPD_OPD_CLINICAL_ORDERS_EDIT` | OPD → OPD Clinical Orders → Edit |
| **Schedule Follow-up** | Consultation Workspace | `OPD_OPD_FOLLOW_UP_EDIT` | OPD → OPD Follow-up → Edit |
| **Create / Submit Referral** | Consultation Workspace | `OPD_OPD_REFERRAL_EDIT` | OPD → OPD Referral → Edit |
| **Create Admission Recommendation** | Doctor Consultation / Inpatient | `ADMISSIONS_ADMISSION_RECOMMENDATIONS_CREATE` | Admissions → Admission Recommendations → Create |
| **Cancel Admission Recommendation** | Doctor Workspace | `ADMISSIONS_ADMISSION_RECOMMENDATIONS_CANCEL` | Admissions → Admission Recommendations → Cancel |
| **Create Admission Request** | Admissions Desk / Reception | `ADMISSIONS_ADMISSION_REQUESTS_CREATE` | Admissions → Admission Requests → Create |
| **Validate Admission Request** | Admissions Desk | `ADMISSIONS_ADMISSION_REQUESTS_VALIDATE` | Admissions → Admission Requests → Validate |
| **Confirm Admission (Admit to Bed)** | Admissions Desk | `ADMISSIONS_ADMISSION_REQUESTS_CONFIRM` | Admissions → Admission Requests → Confirm |
| **Cancel Admission Request** | Admissions Desk | `ADMISSIONS_ADMISSION_REQUESTS_CANCEL` | Admissions → Admission Requests → Cancel |
| **Hold Bed** | Bed Management / Bed Availability | `ADMISSIONS_BED_HOLDS_CREATE` | Admissions → Bed Holds → Create |
| **Release Bed Hold** | Bed Management | `ADMISSIONS_BED_HOLDS_RELEASE` | Admissions → Bed Holds → Release |
| **Cancel Bed Hold** | Bed Management | `ADMISSIONS_BED_HOLDS_CANCEL` | Admissions → Bed Holds → Cancel |
| **Initiate Bed Transfer** | Inpatient Workspace | `ADMISSIONS_BED_TRANSFERS_CREATE` | Admissions → Bed Transfers → Create |
| **Initiate Cross-Branch Transfer** | Inpatient Workspace | `ADMISSIONS_BED_TRANSFERS_CREATE` + `ADMISSIONS_BED_TRANSFERS_CROSS_BRANCH` | Admissions → Bed Transfers → Create & CrossBranch |
| **Complete Bed Transfer** | Bed Management | `ADMISSIONS_BED_TRANSFERS_COMPLETE` | Admissions → Bed Transfers → Complete |
| **Cancel Bed Transfer** | Bed Management | `ADMISSIONS_BED_TRANSFERS_CANCEL` | Admissions → Bed Transfers → Cancel |
| **Record Inpatient Round Note** | Inpatient Workspace | `ADMISSIONS_INPATIENT_ADMISSIONS_CREATE` | Admissions → Inpatient Admissions → Create |
| **Record Inpatient Vitals** | Inpatient Workspace | `ADMISSIONS_INPATIENT_ADMISSIONS_CREATE` | Admissions → Inpatient Admissions → Create |
| **Save Discharge Summary** | Inpatient Workspace | `ADMISSIONS_INPATIENT_ADMISSIONS_EDIT` | Admissions → Inpatient Admissions → Edit |
| **Finalize Inpatient Discharge** | Inpatient Workspace | `ADMISSIONS_INPATIENT_ADMISSIONS_DISCHARGE` | Admissions → Inpatient Admissions → Discharge |
| **Recommend Surgery / Procedure** | Doctor Consultation / Inpatient | `SURGERY_RECOMMENDATIONS_CREATE` | Surgery → Recommendations → Create |
| **Cancel Surgery Recommendation** | Doctor Workspace | `SURGERY_RECOMMENDATIONS_CANCEL` | Surgery → Recommendations → Cancel |
| **Book Surgery Slot** | Surgery Procedure Workspace | `SURGERY_BOOKINGS_CREATE` | Surgery → Bookings → Create |
| **Confirm Surgery Booking** | Surgery Procedure Workspace | `SURGERY_BOOKINGS_CONFIRM` | Surgery → Bookings → Confirm |
| **Reschedule Surgery Booking** | Surgery Procedure Workspace | `SURGERY_BOOKINGS_RESCHEDULE` | Surgery → Bookings → Reschedule |
| **Cancel Surgery Booking** | Surgery Procedure Workspace | `SURGERY_BOOKINGS_CANCEL` | Surgery → Bookings → Cancel |
| **Complete Surgery Booking** | Surgery Procedure Workspace | `SURGERY_BOOKINGS_COMPLETE` | Surgery → Bookings → Complete |
| **Register Emergency Patient** | Emergency Dashboard / Intake | `EMERGENCY_ENCOUNTERS_REGISTER` | Emergency → Encounters → Register |
| **Perform Triage Assessment** | Emergency Queue / Triage | `EMERGENCY_TRIAGE_ASSESS` | Emergency → Triage → Assess |
| **Override Triage Priority** | Emergency Triage Workspace | `EMERGENCY_TRIAGE_OVERRIDE_PRIORITY` | Emergency → Triage → OverridePriority |
| **Save Emergency Consultation** | Emergency Workspace | `EMERGENCY_CONSULTATION_EDIT` | Emergency → Consultation → Edit |
| **Create Emergency Orders** | Emergency Workspace | `EMERGENCY_ORDERS_CREATE` | Emergency → Orders → Create |
| **Emergency Discharge** | Emergency Workspace | `EMERGENCY_DISPOSITION_DISCHARGE` | Emergency → Disposition → Discharge |
| **Emergency Transfer** | Emergency Workspace | `EMERGENCY_DISPOSITION_TRANSFER` | Emergency → Disposition → Transfer |
| **Emergency Convert to Inpatient** | Emergency Workspace | `EMERGENCY_DISPOSITION_CONVERT_TO_IP` | Emergency → Disposition → ConvertToIP |
| **Emergency Mark as Left** | Emergency Workspace | `EMERGENCY_DISPOSITION_MARK_LEFT` | Emergency → Disposition → MarkLeft |
| **Emergency Mark No-Show** | Emergency Workspace | `EMERGENCY_DISPOSITION_MARK_NO_SHOW` | Emergency → Disposition → MarkNoShow |
| **Emergency Cancel Encounter** | Emergency Workspace | `EMERGENCY_DISPOSITION_CANCEL` | Emergency → Disposition → Cancel |
| **Link Unknown Emergency Patient** | Emergency Patient Identification | `EMERGENCY_PATIENT_LINKING_LINK` | Emergency → Patient Linking → Link |
| **Correct Emergency Patient Link** | Emergency Patient Identification | `EMERGENCY_PATIENT_LINKING_CORRECT` | Emergency → Patient Linking → Correct |
| **Enter Lab Result** | Laboratory Results Workspace | `LABORATORY_ORDERS_ENTER_RESULT` | Laboratory → Orders → EnterResult |
| **Verify Lab Result** | Laboratory Results Workspace | `LABORATORY_ORDERS_VERIFY_RESULT` | Laboratory → Orders → VerifyResult |
| **Update Lab Order Status** | Laboratory Work Queue | `LABORATORY_ORDERS_EDIT` | Laboratory → Orders → Edit |
| **Enter Imaging Report** | Imaging Reports Workspace | `IMAGING_ORDERS_ENTER_REPORT` | Imaging → Orders → EnterReport |
| **Verify Imaging Report** | Imaging Reports Workspace | `IMAGING_ORDERS_VERIFY_REPORT` | Imaging → Orders → VerifyReport |
| **Update Imaging Order Status** | Imaging Work Queue | `IMAGING_ORDERS_EDIT` | Imaging → Orders → Edit |
| **Allocate Batches / Edit Dispense** | Pharmacy Dispensing Workspace | `PHARMACY_DISPENSING_EDIT` | Pharmacy → Dispensing → Edit |
| **Confirm Dispensing (Dispense)** | Pharmacy Dispensing Workspace | `PHARMACY_DISPENSING_DISPENSE` | Pharmacy → Dispensing → Dispense |
| **Cancel Dispensing** | Pharmacy Dispensing Workspace | `PHARMACY_DISPENSING_CANCEL` | Pharmacy → Dispensing → Cancel |
| **Reverse Dispensing** | Pharmacy Dispensing Workspace | `PHARMACY_DISPENSING_REVERSE` | Pharmacy → Dispensing → Reverse |
| **Register Medicine Batch** | Pharmacy Inventory | `PHARMACY_MEDICINE_INVENTORY_REGISTER_BATCH` | Pharmacy → Medicine Inventory → RegisterBatch |
| **Record Stock Movement** | Pharmacy Inventory | `PHARMACY_MEDICINE_INVENTORY_RECORD_MOVEMENT` | Pharmacy → Medicine Inventory → RecordMovement |
| **Adjust Stock** | Pharmacy Inventory | `PHARMACY_MEDICINE_INVENTORY_ADJUST_STOCK` | Pharmacy → Medicine Inventory → AdjustStock |
| **Edit Medicine Batch** | Pharmacy Inventory | `PHARMACY_MEDICINE_INVENTORY_EDIT_BATCH` | Pharmacy → Medicine Inventory → EditBatch |
| **Configure Low Stock Level** | Pharmacy Inventory | `PHARMACY_MEDICINE_INVENTORY_CONFIGURE_LOW_STOCK` | Pharmacy → Medicine Inventory → ConfigureLowStock |
| **Create Invoice** | Billing Workspace | `BILLING_INVOICES_CREATE` | Billing → Invoices → Create |
| **Edit Invoice / Context Link** | Billing Workspace | `BILLING_INVOICES_EDIT` | Billing → Invoices → Edit |
| **Cancel Invoice** | Billing History / Workspace | `BILLING_INVOICES_CANCEL` | Billing → Invoices → Cancel |
| **Collect Payment** | Billing Workspace / Payment Modal | `BILLING_INVOICES_COLLECT_PAYMENT` | Billing → Invoices → CollectPayment |
| **View / Print Receipt** | Billing Workspace / Payment Receipt | `BILLING_INVOICES_VIEW_RECEIPT` | Billing → Invoices → ViewReceipt |
| **Upload Patient Document** | Patient Documents Workspace | `PATIENTS_PATIENT_DOCUMENTS_CREATE` | Patients → Patient Documents → Create |
| **Attach Signed Consent** | Patient Consent Workspace | `PATIENTS_PATIENT_DOCUMENTS_CREATE` + `PATIENTS_CONSENT_ATTACH` | Patients → Patient Documents → Create & Consent → Attach |
| **Verify Patient Consent** | Patient Consent Workspace | `PATIENTS_CONSENT_VERIFY` | Patients → Consent → Verify |
| **Delete Patient Document / Consent**| Patient Workspace | `PATIENTS_PATIENT_DOCUMENTS_DELETE` (+ `PATIENTS_CONSENT_DELETE`) | Patients → Patient Documents → Delete & Consent → Delete |
| **Provision Doctor Login Account** | Doctor Directory / Management | `DOCTORS_DOCTOR_DIRECTORY_PROVISION_LOGIN` | Doctors → Doctor Directory → Provision Login |
| **Assign Users to Role** | Roles & Permissions Workspace | `ADMINISTRATION_ROLES_ASSIGN` | Administration → Roles → Assign |
| **Assign Permissions to Role** | Roles & Permissions Workspace | `ADMINISTRATION_PERMISSIONS_ASSIGN` | Administration → Permissions → Assign |

---

## 4. Role-by-Role Permission Analysis

### 4.1. RECEPTIONIST

#### A. Required Permissions
| Module | Screen | Action | Exact Permission Code | Why Required |
|---|---|---|---|---|
| Patients | Patient Records | View | `PATIENTS_PATIENT_RECORDS_VIEW` | Search and view registered patient profiles. |
| Patients | Patient Records | Create | `PATIENTS_PATIENT_RECORDS_CREATE` | Register new walk-in or booked patients. |
| Patients | Patient Records | Edit | `PATIENTS_PATIENT_RECORDS_EDIT` | Update patient demographic, contact, and insurance info. |
| Patients | Patient Documents | View | `PATIENTS_PATIENT_DOCUMENTS_VIEW` | View uploaded identity and insurance documents. |
| Patients | Patient Documents | Create | `PATIENTS_PATIENT_DOCUMENTS_CREATE` | Upload ID cards, insurance cards, and scanned paperwork. |
| Patients | Consent | View | `PATIENTS_CONSENT_VIEW` | Check consent form status during registration/admission. |
| Patients | Consent | Attach | `PATIENTS_CONSENT_ATTACH` | Attach signed general admission consent forms at front desk. |
| Doctors | Doctor Directory | View | `DOCTORS_DOCTOR_DIRECTORY_VIEW` | View available doctors, specialties, and OPD departments. |
| Doctors | Doctor Availability | View | `DOCTORS_DOCTOR_AVAILABILITY_VIEW` | Check doctor consultation timings, rosters, and leave status. |
| Appointments | Appointment Records | View | `APPOINTMENTS_APPOINTMENT_RECORDS_VIEW` | View appointments list, calendar, and daily schedule. |
| Appointments | Appointment Records | Edit | `APPOINTMENTS_APPOINTMENT_RECORDS_EDIT` | Cancel appointments upon patient request. |
| Appointments | Appointment Booking | View | `APPOINTMENTS_APPOINTMENT_BOOKING_VIEW` | Access appointment booking interface. |
| Appointments | Appointment Booking | Create | `APPOINTMENTS_APPOINTMENT_BOOKING_CREATE` | Book outpatient appointments and referral consultations. |
| Appointments | Appointment Booking | Edit | `APPOINTMENTS_APPOINTMENT_BOOKING_EDIT` | Reschedule appointment date, time, and doctor. |
| OPD | OPD Visits | View | `OPD_OPD_VISITS_VIEW` | View OPD waiting queue and arrival status. |
| OPD | OPD Visits | Create | `OPD_OPD_VISITS_CREATE` | **Check In** arrived patients to initiate the OPD visit. |
| OPD | OPD Referral | View | `OPD_OPD_REFERRAL_VIEW` | View doctor referral orders to book referred appointments. |
| Admissions | Wards | View | `ADMISSIONS_WARDS_VIEW` | View ward definitions and categories for bed search. |
| Admissions | Beds | View | `ADMISSIONS_BEDS_VIEW` | View bed status and bed availability board. |
| Admissions | Admission Policy | View | `ADMISSIONS_ADMISSION_POLICY_VIEW` | View admission deposit requirements and booking rules. |
| Admissions | Bed Holds | View | `ADMISSIONS_BED_HOLDS_VIEW` | View existing bed reservations and holds. |
| Admissions | Bed Holds | Create | `ADMISSIONS_BED_HOLDS_CREATE` | Place a temporary hold on a bed for incoming admission. |
| Admissions | Bed Holds | Release | `ADMISSIONS_BED_HOLDS_RELEASE` | Release expired or unneeded bed holds. |
| Admissions | Bed Holds | Cancel | `ADMISSIONS_BED_HOLDS_CANCEL` | Cancel bed holds if patient does not proceed. |
| Admissions | Admission Requests | View | `ADMISSIONS_ADMISSION_REQUESTS_VIEW` | View incoming admission requests and recommendation queue. |
| Admissions | Admission Requests | Create | `ADMISSIONS_ADMISSION_REQUESTS_CREATE` | Create admission request from external/direct referral. |
| Admissions | Admission Requests | Validate | `ADMISSIONS_ADMISSION_REQUESTS_VALIDATE` | Validate patient documentation, deposit, and bed allotment. |
| Admissions | Admission Requests | Confirm | `ADMISSIONS_ADMISSION_REQUESTS_CONFIRM` | **Confirm admission** and assign bed to admit patient. |
| Admissions | Admission Requests | Cancel | `ADMISSIONS_ADMISSION_REQUESTS_CANCEL` | Cancel unfulfilled or rejected admission requests. |
| Admissions | Inpatient Admissions | View | `ADMISSIONS_INPATIENT_ADMISSIONS_VIEW` | View current inpatient census for visitor/patient inquiries. |
| Surgery | Recommendations | View | `SURGERY_RECOMMENDATIONS_VIEW` | View doctor procedure recommendations for scheduling. |
| Surgery | Bookings | View | `SURGERY_BOOKINGS_VIEW` | View procedure schedule and booking details. |
| Surgery | Bookings | Create | `SURGERY_BOOKINGS_CREATE` | Book scheduled procedure / OT slots. |
| Surgery | Bookings | Confirm | `SURGERY_BOOKINGS_CONFIRM` | Confirm procedure bookings after pre-op verification. |
| Surgery | Bookings | Reschedule | `SURGERY_BOOKINGS_RESCHEDULE` | Reschedule procedure timings with surgeon approval. |
| Surgery | Bookings | Cancel | `SURGERY_BOOKINGS_CANCEL` | Cancel procedure bookings upon patient cancellation. |
| Surgery | Schedule | View | `SURGERY_SCHEDULE_VIEW` | View OT and minor procedure theater schedules. |
| Emergency | Encounters | View | `EMERGENCY_ENCOUNTERS_VIEW` | View emergency arrivals and active emergency queue. |
| Emergency | Encounters | Register | `EMERGENCY_ENCOUNTERS_REGISTER` | Register walk-in / ambulance emergency arrivals. |
| Emergency | Triage | View | `EMERGENCY_TRIAGE_VIEW` | View triage status of registered emergency cases. |
| Emergency | Patient Linking | Link | `EMERGENCY_PATIENT_LINKING_LINK` | Link temporary/unknown emergency patient to master record. |

#### B. Missing Permissions for Receptionist
| Module | Screen | Action | Exact Permission Code | Why Missing & Needed |
|---|---|---|---|---|
| Administration | Branches | View | `ADMINISTRATION_BRANCHES_VIEW` | Required to populate branch selector dropdowns across appointment and admission forms. |
| Administration | Departments | View | `ADMINISTRATION_DEPARTMENTS_VIEW` | Required to populate department filters and specialty selectors in appointment booking. |
| Administration | Services | View | `ADMINISTRATION_SERVICES_VIEW` | Required to look up consultation and procedure service types during booking. |

#### C. Unnecessary / Excess Permissions Currently Seeded
| Module | Screen | Action | Exact Permission Code | Why Unnecessary |
|---|---|---|---|---|
| OPD | OPD Vitals | Create | `OPD_OPD_VITALS_CREATE` | Recording patient vitals (BP, pulse, temp) is a nursing/clinical function, not front-desk receptionist work. |
| OPD | OPD Vitals | Edit | `OPD_OPD_VITALS_EDIT` | Editing clinical vitals belongs strictly to nursing staff. |
| OPD | OPD Vitals | View | `OPD_OPD_VITALS_VIEW` | Clinical vital signs are not necessary for front-desk scheduling/check-in operations. |
| OPD | OPD Visits | Edit | `OPD_OPD_VISITS_EDIT` | Modifying clinical visit details (e.g. calling to doctor or completing visit) belongs to nurses/doctors. |
| OPD | OPD Referral | Edit | `OPD_OPD_REFERRAL_EDIT` | Creating/authoring medical referrals is a physician clinical action. Receptionist only needs `OPD Referral -> View`. |

#### D. Optional Permissions
| Module | Screen | Action | Exact Permission Code | Context / Hospital Policy Decision |
|---|---|---|---|---|
| Billing | Invoices | ViewReceipt | `BILLING_INVOICES_VIEW_RECEIPT` | Optional if reception desk prints duplicate payment receipts for patients at front desk. |
| Emergency | Patient Linking | Correct | `EMERGENCY_PATIENT_LINKING_CORRECT` | Optional if senior reception supervisor is authorized to rectify mistaken emergency patient identity links. |

---

### 4.2. CLINICIAN / NURSE

#### A. Required Permissions
| Module | Screen | Action | Exact Permission Code | Why Required |
|---|---|---|---|---|
| Patients | Patient Records | View | `PATIENTS_PATIENT_RECORDS_VIEW` | View patient demographics, age, gender, and clinical history. |
| Patients | Patient Documents | View | `PATIENTS_PATIENT_DOCUMENTS_VIEW` | View previous discharge summaries, lab reports, and clinical uploads. |
| Patients | Patient Documents | Create | `PATIENTS_PATIENT_DOCUMENTS_CREATE` | Upload nursing assessments and bedside flowcharts. |
| Patients | Consent | View | `PATIENTS_CONSENT_VIEW` | Verify whether required procedure/admission consents are in place. |
| Patients | Consent | Attach | `PATIENTS_CONSENT_ATTACH` | Attach signed bedside nursing/procedure consent forms. |
| Patients | Consent | Verify | `PATIENTS_CONSENT_VERIFY` | Clinically review and verify patient/guardian consent signatures. |
| Appointments | Appointment Records | View | `APPOINTMENTS_APPOINTMENT_RECORDS_VIEW` | View scheduled appointment queue for daily nursing assignments. |
| Doctors | Doctor Directory | View | `DOCTORS_DOCTOR_DIRECTORY_VIEW` | Look up attending physicians and specialists. |
| Doctors | Doctor Availability | View | `DOCTORS_DOCTOR_AVAILABILITY_VIEW` | Check on-duty doctors for clinical escalation. |
| OPD | OPD Visits | View | `OPD_OPD_VISITS_VIEW` | Monitor OPD waiting queue for triage and vitals intake. |
| OPD | OPD Visits | Edit | `OPD_OPD_VISITS_EDIT` | Update visit queue status (e.g., mark patient in vitals room). |
| OPD | OPD Vitals | View | `OPD_OPD_VITALS_VIEW` | Review historical and current OPD vital signs. |
| OPD | OPD Vitals | Create | `OPD_OPD_VITALS_CREATE` | **Record patient vital signs** (BP, pulse, temp, SpO2, weight). |
| OPD | OPD Vitals | Edit | `OPD_OPD_VITALS_EDIT` | Correct mistakenly recorded vitals entries. |
| Admissions | Wards | View | `ADMISSIONS_WARDS_VIEW` | View assigned ward bed map and room categories. |
| Admissions | Beds | View | `ADMISSIONS_BEDS_VIEW` | View bed occupancy, cleaning, and maintenance statuses. |
| Admissions | Admission Requests | View | `ADMISSIONS_ADMISSION_REQUESTS_VIEW` | View incoming admissions to prepare ward beds. |
| Admissions | Inpatient Admissions | View | `ADMISSIONS_INPATIENT_ADMISSIONS_VIEW` | View admitted inpatients, active stays, and care plans. |
| Admissions | Inpatient Admissions | Create | `ADMISSIONS_INPATIENT_ADMISSIONS_CREATE` | **Record daily nursing round notes & bedside vitals** (`POST /api/admissions/inpatients/:id/round-notes` and `/vitals`). |
| Admissions | Inpatient Admissions | Edit | `ADMISSIONS_INPATIENT_ADMISSIONS_EDIT` | Update inpatient nursing care logs and clinical observations. |
| Emergency | Encounters | View | `EMERGENCY_ENCOUNTERS_VIEW` | View emergency queue for incoming trauma/medical triage. |
| Emergency | Triage | View | `EMERGENCY_TRIAGE_VIEW` | View previous triage assessments and emergency vitals. |
| Emergency | Triage | Assess | `EMERGENCY_TRIAGE_ASSESS` | **Perform triage assessment** and assign emergency priority. |
| Emergency | Consultation | View | `EMERGENCY_CONSULTATION_VIEW` | View doctor emergency consultation notes for nursing orders. |
| Emergency | Orders | View | `EMERGENCY_ORDERS_VIEW` | View emergency doctor medication and nursing orders to execute. |
| Emergency | Disposition | View | `EMERGENCY_DISPOSITION_VIEW` | View disposition plan (admit to IP, transfer, or discharge). |

#### B. Missing Permissions for Clinician / Nurse
| Module | Screen | Action | Exact Permission Code | Why Missing & Needed |
|---|---|---|---|---|
| Admissions | Inpatient Admissions | Create | `ADMISSIONS_INPATIENT_ADMISSIONS_CREATE` | **Critical:** Backend guards `POST /api/admissions/inpatients/:id/round-notes` and `POST /api/admissions/inpatients/:id/vitals` with this permission. Currently missing in nurse seed, preventing nurses from recording round notes and vitals! |
| OPD | OPD Vitals | Edit | `OPD_OPD_VITALS_EDIT` | Needed to correct immediate entry errors during outpatient vitals intake. |
| Emergency | Orders | View | `EMERGENCY_ORDERS_VIEW` | Needed to view medication orders and diagnostic orders to administer bedside emergency care. |
| Emergency | Disposition | View | `EMERGENCY_DISPOSITION_VIEW` | Needed to check whether an emergency patient is cleared for ward transfer or discharge. |

#### C. Unnecessary / Excess Permissions Currently Seeded
- None. The current baseline is well targeted to nursing workflows, with only missing operational permissions identified above.

#### D. Optional Permissions
| Module | Screen | Action | Exact Permission Code | Context / Hospital Policy Decision |
|---|---|---|---|---|
| Admissions | Bed Transfers | Create | `ADMISSIONS_BED_TRANSFERS_CREATE` | Optional if ward charge nurses are authorized to initiate internal bed/ward transfers. |
| Emergency | Triage | OverridePriority | `EMERGENCY_TRIAGE_OVERRIDE_PRIORITY` | Optional for Senior Triage Nurses / Nursing Supervisors to reclassify patient triage category. |

---

### 4.3. DOCTOR

#### A. Required Permissions
| Module | Screen | Action | Exact Permission Code | Why Required |
|---|---|---|---|---|
| Patients | Patient Records | View | `PATIENTS_PATIENT_RECORDS_VIEW` | Review complete medical history, demographics, and alerts. |
| Patients | Patient Records | Edit | `PATIENTS_PATIENT_RECORDS_EDIT` | Update patient chronic conditions, medical alerts, and blood group. |
| Patients | Patient Documents | View | `PATIENTS_PATIENT_DOCUMENTS_VIEW` | Review past diagnostic reports, external records, and clinical scans. |
| Patients | Patient Documents | Create | `PATIENTS_PATIENT_DOCUMENTS_CREATE` | Upload clinical sketches, external investigation reports, and notes. |
| Patients | Consent | View | `PATIENTS_CONSENT_VIEW` | Review informed consent status before procedures or surgeries. |
| Patients | Consent | Attach | `PATIENTS_CONSENT_ATTACH` | Attach specialized clinical informed consent documentation. |
| Patients | Consent | Verify | `PATIENTS_CONSENT_VERIFY` | Legally verify and sign off on informed consent forms. |
| Doctors | Doctor Directory | View | `DOCTORS_DOCTOR_DIRECTORY_VIEW` | Look up colleague directories for inter-department referrals. |
| Doctors | Doctor Availability | View | `DOCTORS_DOCTOR_AVAILABILITY_VIEW` | View own consultation schedules and colleague availability. |
| Doctors | Doctor Availability | Edit | `DOCTORS_DOCTOR_AVAILABILITY_EDIT` | Manage own consultation hours, apply for leaves, and set exceptions. |
| Appointments | Appointment Records | View | `APPOINTMENTS_APPOINTMENT_RECORDS_VIEW` | View booked outpatient consultation appointments. |
| OPD | OPD Visits | View | `OPD_OPD_VISITS_VIEW` | Access outpatient patient queue. |
| OPD | OPD Visits | Edit | `OPD_OPD_VISITS_EDIT` | Update visit consultation status (e.g. In Consultation, Completed). |
| OPD | OPD Vitals | View | `OPD_OPD_VITALS_VIEW` | Review vitals recorded by nursing triage. |
| OPD | OPD Consultation | View | `OPD_OPD_CONSULTATION_VIEW` | Review previous consultation notes and clinical history. |
| OPD | OPD Consultation | Edit | `OPD_OPD_CONSULTATION_EDIT` | **Conduct consultation:** record diagnosis, clinical notes, and complete visit. |
| OPD | OPD Prescription | View | `OPD_OPD_PRESCRIPTION_VIEW` | View current and past medication prescriptions. |
| OPD | OPD Prescription | Edit | `OPD_OPD_PRESCRIPTION_EDIT` | **Prescribe medications:** add drugs, dosage, frequency, and submit e-Rx. |
| OPD | OPD Clinical Orders | View | `OPD_OPD_CLINICAL_ORDERS_VIEW` | View ordered laboratory and imaging investigations. |
| OPD | OPD Clinical Orders | Edit | `OPD_OPD_CLINICAL_ORDERS_EDIT` | **Order diagnostics:** submit laboratory and radiology orders. |
| OPD | OPD Follow-up | View | `OPD_OPD_FOLLOW_UP_VIEW` | View scheduled follow-up visits. |
| OPD | OPD Follow-up | Edit | `OPD_OPD_FOLLOW_UP_EDIT` | Set follow-up timelines and instructions. |
| OPD | OPD Referral | View | `OPD_OPD_REFERRAL_VIEW` | Review incoming and outgoing clinical referrals. |
| OPD | OPD Referral | Edit | `OPD_OPD_REFERRAL_EDIT` | Generate medical referral orders to other specialties. |
| Admissions | Wards | View | `ADMISSIONS_WARDS_VIEW` | View ward layout when planning inpatient admissions. |
| Admissions | Beds | View | `ADMISSIONS_BEDS_VIEW` | View bed availability to recommend appropriate room categories. |
| Admissions | Admission Recommendations | View | `ADMISSIONS_ADMISSION_RECOMMENDATIONS_VIEW` | View submitted admission recommendations. |
| Admissions | Admission Recommendations | Create | `ADMISSIONS_ADMISSION_RECOMMENDATIONS_CREATE` | **Recommend patient for Inpatient Admission** with provisional diagnosis. |
| Admissions | Admission Recommendations | Cancel | `ADMISSIONS_ADMISSION_RECOMMENDATIONS_CANCEL` | Cancel admission recommendation if patient status stabilizes. |
| Admissions | Inpatient Admissions | View | `ADMISSIONS_INPATIENT_ADMISSIONS_VIEW` | View admitted patients, charts, and ongoing treatment. |
| Admissions | Inpatient Admissions | Create | `ADMISSIONS_INPATIENT_ADMISSIONS_CREATE` | Record physician inpatient round notes and progress summaries. |
| Admissions | Inpatient Admissions | Edit | `ADMISSIONS_INPATIENT_ADMISSIONS_EDIT` | Author and update patient **Discharge Summary**. |
| Admissions | Inpatient Admissions | Discharge | `ADMISSIONS_INPATIENT_ADMISSIONS_DISCHARGE` | **Finalize medical discharge** for inpatient. |
| Surgery | Recommendations | View | `SURGERY_RECOMMENDATIONS_VIEW` | View recommended surgeries and pre-op requirements. |
| Surgery | Recommendations | Create | `SURGERY_RECOMMENDATIONS_CREATE` | **Recommend surgical procedure** and anesthesia requirements. |
| Surgery | Recommendations | Cancel | `SURGERY_RECOMMENDATIONS_CANCEL` | Cancel surgical recommendation if contraindicated. |
| Surgery | Bookings | View | `SURGERY_BOOKINGS_VIEW` | View procedure bookings and OT slot allocations. |
| Surgery | Bookings | Complete | `SURGERY_BOOKINGS_COMPLETE` | Mark surgical procedure completed and record post-op notes. |
| Surgery | Schedule | View | `SURGERY_SCHEDULE_VIEW` | View OT schedule and slot availability. |
| Emergency | Encounters | View | `EMERGENCY_ENCOUNTERS_VIEW` | Access emergency department patient queue. |
| Emergency | Triage | View | `EMERGENCY_TRIAGE_VIEW` | Review emergency nursing triage score and priority level. |
| Emergency | Consultation | View | `EMERGENCY_CONSULTATION_VIEW` | View emergency clinical notes and evaluations. |
| Emergency | Consultation | Edit | `EMERGENCY_CONSULTATION_EDIT` | **Execute Emergency Doctor Evaluation:** call patient and document notes. |
| Emergency | Orders | View | `EMERGENCY_ORDERS_VIEW` | Review emergency orders. |
| Emergency | Orders | Create | `EMERGENCY_ORDERS_CREATE` | Order STAT emergency medications, lab tests, and imaging. |
| Emergency | Disposition | View | `EMERGENCY_DISPOSITION_VIEW` | View emergency disposition history. |
| Emergency | Disposition | Discharge | `EMERGENCY_DISPOSITION_DISCHARGE` | Discharge stabilized patient directly from Emergency. |
| Emergency | Disposition | Transfer | `EMERGENCY_DISPOSITION_TRANSFER` | Transfer emergency patient to external tertiary trauma facility. |
| Emergency | Disposition | ConvertToIP | `EMERGENCY_DISPOSITION_CONVERT_TO_IP` | **Convert Emergency encounter to Inpatient Admission**. |
| Emergency | Disposition | MarkLeft | `EMERGENCY_DISPOSITION_MARK_LEFT` | Document patient Left Against Medical Advice (LAMA) / DAMA. |
| Laboratory | Orders | View | `LABORATORY_ORDERS_VIEW` | Review finalized laboratory diagnostic results and reference ranges. |
| Imaging | Orders | View | `IMAGING_ORDERS_VIEW` | Review finalized radiology reports and attached imaging studies. |

#### B. Missing Permissions for Doctor
| Module | Screen | Action | Exact Permission Code | Why Missing & Needed |
|---|---|---|---|---|
| Admissions | Inpatient Admissions | Create | `ADMISSIONS_INPATIENT_ADMISSIONS_CREATE` | Doctors need this permission to record physician round notes (`POST /api/admissions/inpatients/:id/round-notes`). |
| Admissions | Wards | View | `ADMISSIONS_WARDS_VIEW` | Needed to view ward categories when selecting admission recommendations. |
| Admissions | Beds | View | `ADMISSIONS_BEDS_VIEW` | Needed to inspect bed availability for planned admissions. |
| Laboratory | Orders | View | `LABORATORY_ORDERS_VIEW` | Needed for full diagnostic history access across all patient workspaces. |
| Imaging | Orders | View | `IMAGING_ORDERS_VIEW` | Needed to view radiology report archives and scan summaries directly. |

#### C. Unnecessary / Excess Permissions Currently Seeded
| Module | Screen | Action | Exact Permission Code | Why Unnecessary |
|---|---|---|---|---|
| Emergency | Patient Linking | Link | `EMERGENCY_PATIENT_LINKING_LINK` | Identifying and merging unknown patient identity records is an administrative / front-desk / triage clerk responsibility. |
| Surgery | Bookings | Confirm | `SURGERY_BOOKINGS_CONFIRM` | OT scheduling and booking confirmations are handled by OT Coordinators / Reception. Doctors create recommendations (`Surgery -> Recommendations -> Create`). |
| Surgery | Bookings | Reschedule | `SURGERY_BOOKINGS_RESCHEDULE` | Rescheduling OT theater slots is an administrative/OT desk coordination action. |
| Surgery | Bookings | Cancel | `SURGERY_BOOKINGS_CANCEL` | Doctors cancel recommendations (`Surgery -> Recommendations -> Cancel`), whereas canceling booked OT slots is handled via OT desk. |

#### D. Optional Permissions
| Module | Screen | Action | Exact Permission Code | Context / Hospital Policy Decision |
|---|---|---|---|---|
| Surgery | Bookings | Create | `SURGERY_BOOKINGS_CREATE` | Optional for surgeons in outpatient minor procedure clinics who book their own minor procedure room slots directly. |
| Emergency | Triage | OverridePriority | `EMERGENCY_TRIAGE_OVERRIDE_PRIORITY` | Optional for Emergency Attending Physicians to clinically reclassify triage severity. |

---

### 4.4. PHARMACY USER

#### A. Required Permissions
| Module | Screen | Action | Exact Permission Code | Why Required |
|---|---|---|---|---|
| Administration | Medicines | View | `ADMINISTRATION_MEDICINES_VIEW` | Search and inspect central medicine master catalog and formulations. |
| Patients | Patient Records | View | `PATIENTS_PATIENT_RECORDS_VIEW` | View patient age, weight, and allergy alerts during dispensing. |
| OPD | OPD Prescription | View | `OPD_OPD_PRESCRIPTION_VIEW` | Access and verify outpatient electronic prescriptions. |
| Pharmacy | Dispensing | View | `PHARMACY_DISPENSING_VIEW` | View prescription fulfillment queue and order statuses. |
| Pharmacy | Dispensing | Edit | `PHARMACY_DISPENSING_EDIT` | Allocate batches, adjust quantities, and substitute equivalent generics. |
| Pharmacy | Dispensing | Dispense | `PHARMACY_DISPENSING_DISPENSE` | **Confirm dispensing** and deduct stock from inventory. |
| Pharmacy | Dispensing | Cancel | `PHARMACY_DISPENSING_CANCEL` | Cancel uncollected or voided dispensing requests. |
| Pharmacy | Dispensing | Reverse | `PHARMACY_DISPENSING_REVERSE` | Process returned medications and reverse dispensed stock back into inventory. |
| Pharmacy | Dispensing | UpdateStatus | `PHARMACY_DISPENSING_UPDATE_STATUS` | Update order processing state (`PREPARING`, `READY_FOR_PICKUP`). |
| Pharmacy | Medicine Inventory | View | `PHARMACY_MEDICINE_INVENTORY_VIEW` | View current batch stock balances, expiry dates, and movements. |
| Pharmacy | Medicine Inventory | RegisterBatch | `PHARMACY_MEDICINE_INVENTORY_REGISTER_BATCH` | Register new medicine shipments, batch numbers, MRP, and expiry dates. |
| Pharmacy | Medicine Inventory | RecordMovement | `PHARMACY_MEDICINE_INVENTORY_RECORD_MOVEMENT` | Record stock receipts, intra-department transfers, and issues. |
| Pharmacy | Medicine Inventory | EditBatch | `PHARMACY_MEDICINE_INVENTORY_EDIT_BATCH` | Update batch pricing or metadata corrections. |
| Pharmacy | Medicine Inventory | ConfigureLowStock | `PHARMACY_MEDICINE_INVENTORY_CONFIGURE_LOW_STOCK` | Configure low-stock alert thresholds for automatic reorder warnings. |

#### B. Missing Permissions for Pharmacy User
| Module | Screen | Action | Exact Permission Code | Why Missing & Needed |
|---|---|---|---|---|
| Administration | Medicines | View | `ADMINISTRATION_MEDICINES_VIEW` | Required to search the master medicine database when registering batches and checking contraindications. |
| Patients | Patient Records | View | `PATIENTS_PATIENT_RECORDS_VIEW` | Required to look up patient identity, age, and clinical allergy flags during dispensing. |

#### C. Unnecessary / Excess Permissions Currently Seeded
- None. The current dispensing and inventory assignment is well-scoped.

#### D. Optional Permissions
| Module | Screen | Action | Exact Permission Code | Context / Hospital Policy Decision |
|---|---|---|---|---|
| Pharmacy | Medicine Inventory | AdjustStock | `PHARMACY_MEDICINE_INVENTORY_ADJUST_STOCK` | Recommended for Chief Pharmacist / Inventory Manager. Standard staff pharmacists may be restricted from write-offs/adjustments depending on internal loss-prevention policy. |

---

### 4.5. LABORATORY USER

#### A. Required Permissions
| Module | Screen | Action | Exact Permission Code | Why Required |
|---|---|---|---|---|
| Patients | Patient Records | View | `PATIENTS_PATIENT_RECORDS_VIEW` | View patient demographics, age, and biological sex for reference intervals. |
| Administration | Services | View | `ADMINISTRATION_SERVICES_VIEW` | View diagnostic lab test definitions and parameter configurations. |
| Laboratory | Orders | View | `LABORATORY_ORDERS_VIEW` | Access laboratory work queue and pending investigation orders. |
| Laboratory | Orders | Edit | `LABORATORY_ORDERS_EDIT` | Update specimen collection and processing status (`IN_PROGRESS`, `REJECTED`). |
| Laboratory | Orders | EnterResult | `LABORATORY_ORDERS_ENTER_RESULT` | **Enter test values, findings, reference ranges, and flags**. |
| Laboratory | Orders | VerifyResult | `LABORATORY_ORDERS_VERIFY_RESULT` | **Review and authorize/verify final laboratory reports**. |

#### B. Missing Permissions for Laboratory User
| Module | Screen | Action | Exact Permission Code | Why Missing & Needed |
|---|---|---|---|---|
| Patients | Patient Records | View | `PATIENTS_PATIENT_RECORDS_VIEW` | Essential for pathologists to verify patient age, gender, and clinical context when interpreting critical values. |
| Administration | Services | View | `ADMINISTRATION_SERVICES_VIEW` | Required to look up test parameters and service catalog items. |

#### C. Unnecessary / Excess Permissions Currently Seeded
- None.

#### D. Optional Permissions
| Module | Screen | Action | Exact Permission Code | Context / Hospital Policy Decision |
|---|---|---|---|---|
| Laboratory | Orders | VerifyResult | `LABORATORY_ORDERS_VERIFY_RESULT` | In large hospitals, junior lab technicians only have `EnterResult`, while Senior Pathologists / Lab Directors hold `VerifyResult`. For standard all-in-one lab roles, both are assigned. |

---

### 4.6. IMAGING USER

#### A. Required Permissions
| Module | Screen | Action | Exact Permission Code | Why Required |
|---|---|---|---|---|
| Patients | Patient Records | View | `PATIENTS_PATIENT_RECORDS_VIEW` | View patient clinical details, age, and pregnancy/contrast precautions. |
| Administration | Services | View | `ADMINISTRATION_SERVICES_VIEW` | View imaging modalities and service catalog definitions. |
| Imaging | Orders | View | `IMAGING_ORDERS_VIEW` | Access imaging work queue and study requisitions. |
| Imaging | Orders | Edit | `IMAGING_ORDERS_EDIT` | Update study status (`IN_PROGRESS`, `COMPLETED`, `CANCELLED`). |
| Imaging | Orders | EnterReport | `IMAGING_ORDERS_ENTER_REPORT` | **Enter radiology findings, impressions, and upload scan images**. |
| Imaging | Orders | VerifyReport | `IMAGING_ORDERS_VERIFY_REPORT` | **Review, authorize, and verify finalized radiology reports**. |

#### B. Missing Permissions for Imaging User
| Module | Screen | Action | Exact Permission Code | Why Missing & Needed |
|---|---|---|---|---|
| Patients | Patient Records | View | `PATIENTS_PATIENT_RECORDS_VIEW` | Essential for radiologists to review patient age and clinical indication prior to scanning and reporting. |
| Administration | Services | View | `ADMINISTRATION_SERVICES_VIEW` | Required to view imaging procedure details and modality parameters. |

#### C. Unnecessary / Excess Permissions Currently Seeded
- None.

#### D. Optional Permissions
| Module | Screen | Action | Exact Permission Code | Context / Hospital Policy Decision |
|---|---|---|---|---|
| Imaging | Orders | VerifyReport | `IMAGING_ORDERS_VERIFY_REPORT` | In multi-tier imaging facilities, Radiographers / Techs perform scans with `EnterReport`, while Consultant Radiologists hold `VerifyReport`. For standard imaging roles, both are assigned. |

---

### 4.7. BILLING AUTHORIZED

#### A. Required Permissions
| Module | Screen | Action | Exact Permission Code | Why Required |
|---|---|---|---|---|
| Patients | Patient Records | View | `PATIENTS_PATIENT_RECORDS_VIEW` | Search and verify patient identity, billing category, and insurance. |
| Administration | Services | View | `ADMINISTRATION_SERVICES_VIEW` | Access service catalog pricing, tariff schedules, and doctor consultation fees. |
| Appointments | Appointment Records | View | `APPOINTMENTS_APPOINTMENT_RECORDS_VIEW` | Verify outpatient appointment status for consultation fee invoicing. |
| OPD | OPD Visits | View | `OPD_OPD_VISITS_VIEW` | Verify OPD visit encounters for outpatient billing. |
| Admissions | Inpatient Admissions | View | `ADMISSIONS_INPATIENT_ADMISSIONS_VIEW` | View inpatient admission details, room category, and bed days for final bill. |
| Admissions | Admission Requests | View | `ADMISSIONS_ADMISSION_REQUESTS_VIEW` | Verify admission request deposit requirements and advance payments. |
| Surgery | Bookings | View | `SURGERY_BOOKINGS_VIEW` | Verify surgical procedures performed and OT theater charges. |
| Pharmacy | Dispensing | View | `PHARMACY_DISPENSING_VIEW` | Verify pharmacy dispensation bills and medication charges. |
| Laboratory | Orders | View | `LABORATORY_ORDERS_VIEW` | Verify laboratory investigations ordered and completed. |
| Imaging | Orders | View | `IMAGING_ORDERS_VIEW` | Verify radiology studies performed. |
| Billing | Invoices | View | `BILLING_INVOICES_VIEW` | Access billing workspace, invoice lists, and financial summaries. |
| Billing | Invoices | Create | `BILLING_INVOICES_CREATE` | **Generate invoices** for consultations, diagnostics, medicines, and IP stays. |
| Billing | Invoices | Edit | `BILLING_INVOICES_EDIT` | Modify invoice line items, link admission/procedure context, and apply discounts. |
| Billing | Invoices | Cancel | `BILLING_INVOICES_CANCEL` | Cancel erroneous invoices with audited mandatory reasons. |
| Billing | Invoices | CollectPayment | `BILLING_INVOICES_COLLECT_PAYMENT` | **Collect payments** (cash, card, UPI, insurance) and update balance. |
| Billing | Invoices | ViewReceipt | `BILLING_INVOICES_VIEW_RECEIPT` | **Generate, view, and print payment receipts**. |
| Reports | Phase 2 Reports | View | `REPORTS_PHASE_2_REPORTS_VIEW` | Generate revenue, collection summary, and financial reconciliation reports. |

#### B. Missing Permissions for Billing Authorized
| Module | Screen | Action | Exact Permission Code | Why Missing & Needed |
|---|---|---|---|---|
| Appointments | Appointment Records | View | `APPOINTMENTS_APPOINTMENT_RECORDS_VIEW` | Needed to link and verify appointment fees. |
| Admissions | Inpatient Admissions | View | `ADMISSIONS_INPATIENT_ADMISSIONS_VIEW` | Crucial to verify inpatient stay length and room tier when compiling final discharge bills. |
| Admissions | Admission Requests | View | `ADMISSIONS_ADMISSION_REQUESTS_VIEW` | Needed to verify required admission deposits. |
| Surgery | Bookings | View | `SURGERY_BOOKINGS_VIEW` | Needed to verify procedure codes and OT charges. |
| Pharmacy | Dispensing | View | `PHARMACY_DISPENSING_VIEW` | Needed to cross-verify pharmacy bill items. |
| Laboratory | Orders | View | `LABORATORY_ORDERS_VIEW` | Needed to verify lab investigation billing items. |
| Imaging | Orders | View | `IMAGING_ORDERS_VIEW` | Needed to verify radiology study billing items. |

#### C. Unnecessary / Excess Permissions Currently Seeded
- None.

#### D. Optional Permissions
| Module | Screen | Action | Exact Permission Code | Context / Hospital Policy Decision |
|---|---|---|---|---|
| Billing | Invoices | Cancel | `BILLING_INVOICES_CANCEL` | Optional if invoice cancellation is restricted to Billing Supervisors / Finance Managers. |

---

### 4.8. ADMINISTRATOR

#### A. Required Permissions
| Module | Screen | Action | Exact Permission Code | Why Required |
|---|---|---|---|---|
| Administration | Dashboard | View | `ADMINISTRATION_DASHBOARD_VIEW` | Access executive administrative overview metrics. |
| Administration | Users | View | `ADMINISTRATION_USERS_VIEW` | View staff user directory. |
| Administration | Users | Create | `ADMINISTRATION_USERS_CREATE` | Create new staff user accounts. |
| Administration | Users | Edit | `ADMINISTRATION_USERS_EDIT` | Update user details, branch assignments, and status. |
| Administration | Users | ChangePassword | `ADMINISTRATION_USERS_CHANGE_PASSWORD` | Change user passwords. |
| Administration | Users | ResetPassword | `ADMINISTRATION_USERS_RESET_PASSWORD` | Reset forgotten user passwords. |
| Administration | Users | Delete | `ADMINISTRATION_USERS_DELETE` | Deactivate/remove departed staff users. |
| Administration | Users | Export | `ADMINISTRATION_USERS_EXPORT` | Export staff directory reports. |
| Administration | Roles | View | `ADMINISTRATION_ROLES_VIEW` | View existing user roles. |
| Administration | Roles | Create | `ADMINISTRATION_ROLES_CREATE` | Create custom organizational roles. |
| Administration | Roles | Edit | `ADMINISTRATION_ROLES_EDIT` | Edit role properties and names. |
| Administration | Roles | Assign | `ADMINISTRATION_ROLES_ASSIGN` | Assign roles to staff users. |
| Administration | Roles | Delete | `ADMINISTRATION_ROLES_DELETE` | Delete obsolete custom roles. |
| Administration | Permissions | View | `ADMINISTRATION_PERMISSIONS_VIEW` | View permission catalog. |
| Administration | Permissions | Assign | `ADMINISTRATION_PERMISSIONS_ASSIGN` | Assign and configure permissions for roles. |
| Administration | Branches | View | `ADMINISTRATION_BRANCHES_VIEW` | View hospital branches. |
| Administration | Branches | Create | `ADMINISTRATION_BRANCHES_CREATE` | Add new hospital branch locations. |
| Administration | Branches | Edit | `ADMINISTRATION_BRANCHES_EDIT` | Update branch facilities and contact info. |
| Administration | Branches | Delete | `ADMINISTRATION_BRANCHES_DELETE` | Deactivate closed branch records. |
| Administration | Branches | Export | `ADMINISTRATION_BRANCHES_EXPORT` | Export branch directory data. |
| Administration | Departments | View | `ADMINISTRATION_DEPARTMENTS_VIEW` | View hospital departments. |
| Administration | Departments | Create | `ADMINISTRATION_DEPARTMENTS_CREATE` | Set up clinical and administrative departments. |
| Administration | Departments | Edit | `ADMINISTRATION_DEPARTMENTS_EDIT` | Update department mappings. |
| Administration | Departments | Delete | `ADMINISTRATION_DEPARTMENTS_DELETE` | Deactivate departments. |
| Administration | Departments | Export | `ADMINISTRATION_DEPARTMENTS_EXPORT` | Export department listings. |
| Administration | Services | View | `ADMINISTRATION_SERVICES_VIEW` | View service catalog. |
| Administration | Services | Create | `ADMINISTRATION_SERVICES_CREATE` | Add new clinical services, procedures, and tariff rates. |
| Administration | Services | Edit | `ADMINISTRATION_SERVICES_EDIT` | Update service pricing and departmental mappings. |
| Administration | Services | Delete | `ADMINISTRATION_SERVICES_DELETE` | Deactivate obsolete services. |
| Administration | Services | Export | `ADMINISTRATION_SERVICES_EXPORT` | Export hospital tariff schedule. |
| Administration | Medicines | View | `ADMINISTRATION_MEDICINES_VIEW` | View central medicine formulary. |
| Administration | Medicines | Create | `ADMINISTRATION_MEDICINES_CREATE` | Add new pharmaceutical items to master catalog. |
| Administration | Medicines | Edit | `ADMINISTRATION_MEDICINES_EDIT` | Update drug strengths, generics, and manufacturer data. |
| Administration | Medicines | Delete | `ADMINISTRATION_MEDICINES_DELETE` | Deactivate discontinued medications. |
| Administration | Medicines | Export | `ADMINISTRATION_MEDICINES_EXPORT` | Export hospital medicine formulary. |
| Administration | Consent Templates | View | `ADMINISTRATION_CONSENT_TEMPLATES_VIEW` | View legal consent form templates. |
| Administration | Consent Templates | Create | `ADMINISTRATION_CONSENT_TEMPLATES_CREATE` | Create standardized informed consent templates. |
| Administration | Consent Templates | Edit | `ADMINISTRATION_CONSENT_TEMPLATES_EDIT` | Update and version consent templates. |
| Administration | Notifications | View | `ADMINISTRATION_NOTIFICATIONS_VIEW` | View system broadcast notifications. |
| Administration | Notifications | Create | `ADMINISTRATION_NOTIFICATIONS_CREATE` | Send hospital-wide system notifications. |
| Administration | Settings | View | `settings.view` | View system configuration settings. |
| Administration | Settings | Edit | `settings.edit` | Update hospital business settings and branding. |
| Administration | Settings | Export | `settings.export` | Export system configuration audits. |
| Doctors | Doctor Directory | View | `DOCTORS_DOCTOR_DIRECTORY_VIEW` | View medical staff directory. |
| Doctors | Doctor Directory | Create | `DOCTORS_DOCTOR_DIRECTORY_CREATE` | Onboard new doctors into physician directory. |
| Doctors | Doctor Directory | Edit | `DOCTORS_DOCTOR_DIRECTORY_EDIT` | Update doctor specialties, qualifications, and department mapping. |
| Doctors | Doctor Directory | Export | `DOCTORS_DOCTOR_DIRECTORY_EXPORT` | Export physician directory. |
| Doctors | Doctor Directory | Provision Login | `DOCTORS_DOCTOR_DIRECTORY_PROVISION_LOGIN` | Provision linked user login accounts for doctors. |
| Doctors | Doctor Availability | View | `DOCTORS_DOCTOR_AVAILABILITY_VIEW` | View physician schedule templates. |
| Doctors | Doctor Availability | Edit | `DOCTORS_DOCTOR_AVAILABILITY_EDIT` | Configure doctor availability schedules on their behalf. |
| Patients | Patient Records | View | `PATIENTS_PATIENT_RECORDS_VIEW` | View patient master index for administrative audits. |
| Patients | Patient Documents | View | `PATIENTS_PATIENT_DOCUMENTS_VIEW` | Inspect patient document archives for legal compliance. |
| Patients | Consent | View | `PATIENTS_CONSENT_VIEW` | Audit legal consent compliance. |
| Admissions | Wards | View | `ADMISSIONS_WARDS_VIEW` | View hospital ward configurations. |
| Admissions | Wards | Create | `ADMISSIONS_WARDS_CREATE` | Set up new wards and room wings. |
| Admissions | Wards | Edit | `ADMISSIONS_WARDS_EDIT` | Update ward names, categories, and capacities. |
| Admissions | Wards | ChangeStatus | `ADMISSIONS_WARDS_CHANGE_STATUS` | Activate / deactivate ward operations. |
| Admissions | Beds | View | `ADMISSIONS_BEDS_VIEW` | View bed master inventory. |
| Admissions | Beds | Create | `ADMISSIONS_BEDS_CREATE` | Add new beds into wards. |
| Admissions | Beds | Edit | `ADMISSIONS_BEDS_EDIT` | Update bed labels, types, and daily rates. |
| Admissions | Beds | ChangeStatus | `ADMISSIONS_BEDS_CHANGE_STATUS` | Mark beds under maintenance or inactive. |
| Admissions | Admission Policy | View | `ADMISSIONS_ADMISSION_POLICY_VIEW` | View admission deposit rules. |
| Admissions | Admission Policy | Edit | `ADMISSIONS_ADMISSION_POLICY_EDIT` | Update admission rules, deposit amounts, and hold durations. |
| Admissions | Inpatient Admissions | View | `ADMISSIONS_INPATIENT_ADMISSIONS_VIEW` | View hospital inpatient census. |
| Reports | Phase 2 Reports | View | `REPORTS_PHASE_2_REPORTS_VIEW` | View executive hospital performance and analytics reports. |
| Billing | Invoices | View | `BILLING_INVOICES_VIEW` | View billing transactions and financial audit logs. |

#### B. Missing Permissions for Administrator
| Module | Screen | Action | Exact Permission Code | Why Missing & Needed |
|---|---|---|---|---|
| Patients | Patient Records | View | `PATIENTS_PATIENT_RECORDS_VIEW` | Currently missing in admin seed; required to view patient profiles when managing records. |
| Reports | Phase 2 Reports | View | `REPORTS_PHASE_2_REPORTS_VIEW` | Crucial for executive monitoring of hospital operational and financial metrics. |
| Billing | Invoices | View | `BILLING_INVOICES_VIEW` | Needed for financial oversight and audit compliance. |
| Administration | Users | Delete | `ADMINISTRATION_USERS_DELETE` | Needed to delete or deactivate obsolete user accounts. |
| Administration | Roles | Delete | `ADMINISTRATION_ROLES_DELETE` | Needed to delete custom roles that are no longer needed. |
| Administration | Permissions | Delete | `ADMINISTRATION_PERMISSIONS_DELETE` | Needed to clean up custom permission configurations. |
| Administration | Branches | Delete | `ADMINISTRATION_BRANCHES_DELETE` | Needed to retire inactive branch records. |
| Administration | Departments | Delete | `ADMINISTRATION_DEPARTMENTS_DELETE` | Needed to retire closed departments. |
| Administration | Services | Delete | `ADMINISTRATION_SERVICES_DELETE` | Needed to deactivate discontinued clinical services. |
| Administration | Medicines | Delete | `ADMINISTRATION_MEDICINES_DELETE` | Needed to remove discontinued pharmaceutical items. |

#### C. Unnecessary / Excess Permissions Currently Seeded
| Module | Screen | Action | Exact Permission Code | Why Unnecessary |
|---|---|---|---|---|
| Emergency | Triage | Assess | `EMERGENCY_TRIAGE_ASSESS` | Triage assessment is a clinical nursing responsibility, not an administrative task. |
| Emergency | Consultation | Edit | `EMERGENCY_CONSULTATION_EDIT` | Emergency clinical evaluations belong strictly to attending physicians. |
| Emergency | Orders | Create | `EMERGENCY_ORDERS_CREATE` | Prescribing emergency medical orders is restricted to licensed doctors. |
| Emergency | Disposition | Discharge | `EMERGENCY_DISPOSITION_DISCHARGE` | Clinical emergency discharge must be authorized by a doctor. |
| Emergency | Disposition | ConvertToIP | `EMERGENCY_DISPOSITION_CONVERT_TO_IP` | Converting an emergency case to IP is an emergency physician clinical decision. |
| Surgery | Recommendations | Create | `SURGERY_RECOMMENDATIONS_CREATE` | Creating surgical recommendations is a surgeon's clinical domain. |
| Surgery | Bookings | Complete | `SURGERY_BOOKINGS_COMPLETE` | Marking surgery completed and entering operative notes is done by surgical staff. |
| Admissions | Admission Recommendations | Create | `ADMISSIONS_ADMISSION_RECOMMENDATIONS_CREATE` | Recommending inpatient admission is a clinical doctor action. |
| Admissions | Inpatient Admissions | Discharge | `ADMISSIONS_INPATIENT_ADMISSIONS_DISCHARGE` | Finalizing inpatient medical discharge requires licensed doctor authorization. |

#### D. Optional Permissions
| Module | Screen | Action | Exact Permission Code | Context / Hospital Policy Decision |
|---|---|---|---|---|
| Patients | Patient Records | Edit | `PATIENTS_PATIENT_RECORDS_EDIT` | Optional if administrators perform master data corrections on patient records. |
| Admissions | Bed Holds | Create / Release / Cancel | `ADMISSIONS_BED_HOLDS_*` | Optional if administrators manage VIP bed holds directly. |
| Admissions | Bed Transfers | Complete / CrossBranch | `ADMISSIONS_BED_TRANSFERS_*` | Optional if administrative oversight is required for inter-branch patient transfers. |

---

## 5. Summary of Missing & Unnecessary Seed Permissions

The following table summarizes the discrepancies identified between the current database seeds (`apps/api/src/database/seed.ts`) and actual operational requirements:

| Role | Missing Permissions (Needed but Not Seeded) | Unnecessary / Excess Permissions (Currently Seeded) |
|---|---|---|
| **Receptionist** | • `Administration -> Branches -> View`<br>• `Administration -> Departments -> View`<br>• `Administration -> Services -> View` | • `OPD -> OPD Vitals -> Create`<br>• `OPD -> OPD Vitals -> Edit`<br>• `OPD -> OPD Vitals -> View`<br>• `OPD -> OPD Visits -> Edit`<br>• `OPD -> OPD Referral -> Edit` |
| **Clinician / Nurse** | • `Admissions -> Inpatient Admissions -> Create`<br>• `OPD -> OPD Vitals -> Edit`<br>• `Emergency -> Orders -> View`<br>• `Emergency -> Disposition -> View` | *(None)* |
| **Doctor** | • `Admissions -> Inpatient Admissions -> Create`<br>• `Admissions -> Wards -> View`<br>• `Admissions -> Beds -> View`<br>• `Laboratory -> Orders -> View`<br>• `Imaging -> Orders -> View` | • `Emergency -> Patient Linking -> Link`<br>• `Surgery -> Bookings -> Confirm`<br>• `Surgery -> Bookings -> Reschedule`<br>• `Surgery -> Bookings -> Cancel` |
| **Pharmacy User** | • `Administration -> Medicines -> View`<br>• `Patients -> Patient Records -> View` | *(None)* |
| **Laboratory User** | • `Patients -> Patient Records -> View`<br>• `Administration -> Services -> View` | *(None)* |
| **Imaging User** | • `Patients -> Patient Records -> View`<br>• `Administration -> Services -> View` | *(None)* |
| **Billing Authorized** | • `Appointments -> Appointment Records -> View`<br>• `Admissions -> Inpatient Admissions -> View`<br>• `Admissions -> Admission Requests -> View`<br>• `Surgery -> Bookings -> View`<br>• `Pharmacy -> Dispensing -> View`<br>• `Laboratory -> Orders -> View`<br>• `Imaging -> Orders -> View` | *(None)* |
| **Administrator** | • `Patients -> Patient Records -> View`<br>• `Reports -> Phase 2 Reports -> View`<br>• `Billing -> Invoices -> View`<br>• `Administration -> Users/Roles/Permissions/Branches/Departments/Services/Medicines -> Delete` | • `Emergency -> Triage -> Assess`<br>• `Emergency -> Consultation -> Edit`<br>• `Emergency -> Orders -> Create`<br>• `Emergency -> Disposition -> Discharge / ConvertToIP`<br>• `Surgery -> Recommendations -> Create`<br>• `Surgery -> Bookings -> Complete`<br>• `Admissions -> Admission Recommendations -> Create`<br>• `Admissions -> Inpatient Admissions -> Discharge` |

---

## 6. Complete Recommended Role → Permission Matrix

The table below presents the final, authoritative matrix of all **88 permissions** in the HMS catalog mapped against all standard roles.

**Legend:**
- **`REQ` (Required):** Core operational permission necessary for the role's baseline responsibilities.
- **`OPT` (Optional):** Contextual permission dependent on specific hospital SOPs, supervisory tiers, or facility size.
- **`—` (No Access):** Role should not have access to this permission.

| Module | Screen | Action | Exact Permission Code | SUPER ADMIN | ADMIN | RECEPTION | NURSE | DOCTOR | PHARMACY | LAB | IMAGING | BILLING |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Administration** | Dashboard | View | `ADMINISTRATION_DASHBOARD_VIEW` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Users | View | `ADMINISTRATION_USERS_VIEW` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Users | Create | `ADMINISTRATION_USERS_CREATE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Users | Edit | `ADMINISTRATION_USERS_EDIT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Users | ChangePassword | `ADMINISTRATION_USERS_CHANGE_PASSWORD` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Users | ResetPassword | `ADMINISTRATION_USERS_RESET_PASSWORD` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Users | Delete | `ADMINISTRATION_USERS_DELETE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Users | Export | `ADMINISTRATION_USERS_EXPORT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Roles | View | `ADMINISTRATION_ROLES_VIEW` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Roles | Create | `ADMINISTRATION_ROLES_CREATE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Roles | Edit | `ADMINISTRATION_ROLES_EDIT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Roles | Assign | `ADMINISTRATION_ROLES_ASSIGN` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Roles | Delete | `ADMINISTRATION_ROLES_DELETE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Permissions | View | `ADMINISTRATION_PERMISSIONS_VIEW` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Permissions | Create | `ADMINISTRATION_PERMISSIONS_CREATE` | **REQ** | **OPT** | — | — | — | — | — | — | — |
| | Permissions | Edit | `ADMINISTRATION_PERMISSIONS_EDIT` | **REQ** | **OPT** | — | — | — | — | — | — | — |
| | Permissions | Assign | `ADMINISTRATION_PERMISSIONS_ASSIGN` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Permissions | Delete | `ADMINISTRATION_PERMISSIONS_DELETE` | **REQ** | **OPT** | — | — | — | — | — | — | — |
| | Branches | View | `ADMINISTRATION_BRANCHES_VIEW` | **REQ** | **REQ** | **REQ** | — | — | — | — | — | — |
| | Branches | Create | `ADMINISTRATION_BRANCHES_CREATE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Branches | Edit | `ADMINISTRATION_BRANCHES_EDIT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Branches | Delete | `ADMINISTRATION_BRANCHES_DELETE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Branches | Export | `ADMINISTRATION_BRANCHES_EXPORT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Departments | View | `ADMINISTRATION_DEPARTMENTS_VIEW` | **REQ** | **REQ** | **REQ** | — | — | — | — | — | — |
| | Departments | Create | `ADMINISTRATION_DEPARTMENTS_CREATE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Departments | Edit | `ADMINISTRATION_DEPARTMENTS_EDIT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Departments | Delete | `ADMINISTRATION_DEPARTMENTS_DELETE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Departments | Export | `ADMINISTRATION_DEPARTMENTS_EXPORT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Services | View | `ADMINISTRATION_SERVICES_VIEW` | **REQ** | **REQ** | **REQ** | — | — | — | **REQ** | **REQ** | **REQ** |
| | Services | Create | `ADMINISTRATION_SERVICES_CREATE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Services | Edit | `ADMINISTRATION_SERVICES_EDIT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Services | Delete | `ADMINISTRATION_SERVICES_DELETE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Services | Export | `ADMINISTRATION_SERVICES_EXPORT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Medicines | View | `ADMINISTRATION_MEDICINES_VIEW` | **REQ** | **REQ** | — | — | — | **REQ** | — | — | — |
| | Medicines | Create | `ADMINISTRATION_MEDICINES_CREATE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Medicines | Edit | `ADMINISTRATION_MEDICINES_EDIT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Medicines | Delete | `ADMINISTRATION_MEDICINES_DELETE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Medicines | Export | `ADMINISTRATION_MEDICINES_EXPORT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Consent Templates | View | `ADMINISTRATION_CONSENT_TEMPLATES_VIEW` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Consent Templates | Create | `ADMINISTRATION_CONSENT_TEMPLATES_CREATE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Consent Templates | Edit | `ADMINISTRATION_CONSENT_TEMPLATES_EDIT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Notifications | View | `ADMINISTRATION_NOTIFICATIONS_VIEW` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Notifications | Create | `ADMINISTRATION_NOTIFICATIONS_CREATE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Settings | View | `settings.view` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Settings | Edit | `settings.edit` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Settings | Export | `settings.export` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| **Patients** | Patient Records | View | `PATIENTS_PATIENT_RECORDS_VIEW` | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** |
| | Patient Records | Create | `PATIENTS_PATIENT_RECORDS_CREATE` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Patient Records | Edit | `PATIENTS_PATIENT_RECORDS_EDIT` | **REQ** | **OPT** | **REQ** | — | **REQ** | — | — | — | — |
| | Patient Documents | View | `PATIENTS_PATIENT_DOCUMENTS_VIEW` | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | — | — | — | — |
| | Patient Documents | Create | `PATIENTS_PATIENT_DOCUMENTS_CREATE` | **REQ** | — | **REQ** | **REQ** | **REQ** | — | — | — | — |
| | Patient Documents | Edit | `PATIENTS_PATIENT_DOCUMENTS_EDIT` | **REQ** | — | — | — | — | — | — | — | — |
| | Patient Documents | Delete | `PATIENTS_PATIENT_DOCUMENTS_DELETE` | **REQ** | — | — | — | — | — | — | — | — |
| | Consent | View | `PATIENTS_CONSENT_VIEW` | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | — | — | — | — |
| | Consent | Attach | `PATIENTS_CONSENT_ATTACH` | **REQ** | — | **REQ** | **REQ** | **REQ** | — | — | — | — |
| | Consent | Verify | `PATIENTS_CONSENT_VERIFY` | **REQ** | — | — | **REQ** | **REQ** | — | — | — | — |
| | Consent | Delete | `PATIENTS_CONSENT_DELETE` | **REQ** | — | — | — | — | — | — | — | — |
| **Doctors** | Doctor Directory | View | `DOCTORS_DOCTOR_DIRECTORY_VIEW` | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | — | — | — | — |
| | Doctor Directory | Create | `DOCTORS_DOCTOR_DIRECTORY_CREATE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Doctor Directory | Edit | `DOCTORS_DOCTOR_DIRECTORY_EDIT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Doctor Directory | Export | `DOCTORS_DOCTOR_DIRECTORY_EXPORT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Doctor Directory | Provision Login | `DOCTORS_DOCTOR_DIRECTORY_PROVISION_LOGIN` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Doctor Availability | View | `DOCTORS_DOCTOR_AVAILABILITY_VIEW` | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | — | — | — | — |
| | Doctor Availability | Edit | `DOCTORS_DOCTOR_AVAILABILITY_EDIT` | **REQ** | **REQ** | — | — | **REQ** | — | — | — | — |
| **Appointments** | Appointment Records | View | `APPOINTMENTS_APPOINTMENT_RECORDS_VIEW` | **REQ** | — | **REQ** | **REQ** | **REQ** | — | — | — | **REQ** |
| | Appointment Records | Edit | `APPOINTMENTS_APPOINTMENT_RECORDS_EDIT` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Appointment Booking | View | `APPOINTMENTS_APPOINTMENT_BOOKING_VIEW` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Appointment Booking | Create | `APPOINTMENTS_APPOINTMENT_BOOKING_CREATE` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Appointment Booking | Edit | `APPOINTMENTS_APPOINTMENT_BOOKING_EDIT` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| **OPD** | OPD Visits | View | `OPD_OPD_VISITS_VIEW` | **REQ** | — | **REQ** | **REQ** | **REQ** | — | — | — | **REQ** |
| | OPD Visits | Create | `OPD_OPD_VISITS_CREATE` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | OPD Visits | Edit | `OPD_OPD_VISITS_EDIT` | **REQ** | — | — | **REQ** | **REQ** | — | — | — | — |
| | OPD Vitals | View | `OPD_OPD_VITALS_VIEW` | **REQ** | — | — | **REQ** | **REQ** | — | — | — | — |
| | OPD Vitals | Create | `OPD_OPD_VITALS_CREATE` | **REQ** | — | — | **REQ** | — | — | — | — | — |
| | OPD Vitals | Edit | `OPD_OPD_VITALS_EDIT` | **REQ** | — | — | **REQ** | — | — | — | — | — |
| | OPD Consultation | View | `OPD_OPD_CONSULTATION_VIEW` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | OPD Consultation | Edit | `OPD_OPD_CONSULTATION_EDIT` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | OPD Prescription | View | `OPD_OPD_PRESCRIPTION_VIEW` | **REQ** | — | — | — | **REQ** | **REQ** | — | — | — |
| | OPD Prescription | Edit | `OPD_OPD_PRESCRIPTION_EDIT` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | OPD Clinical Orders | View | `OPD_OPD_CLINICAL_ORDERS_VIEW` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | OPD Clinical Orders | Edit | `OPD_OPD_CLINICAL_ORDERS_EDIT` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | OPD Follow-up | View | `OPD_OPD_FOLLOW_UP_VIEW` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | OPD Follow-up | Edit | `OPD_OPD_FOLLOW_UP_EDIT` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | OPD Referral | View | `OPD_OPD_REFERRAL_VIEW` | **REQ** | — | **REQ** | — | **REQ** | — | — | — | — |
| | OPD Referral | Edit | `OPD_OPD_REFERRAL_EDIT` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| **Pharmacy** | Medicine Inventory | View | `PHARMACY_MEDICINE_INVENTORY_VIEW` | **REQ** | — | — | — | — | **REQ** | — | — | — |
| | Medicine Inventory | RegisterBatch | `PHARMACY_MEDICINE_INVENTORY_REGISTER_BATCH` | **REQ** | — | — | — | — | **REQ** | — | — | — |
| | Medicine Inventory | RecordMovement | `PHARMACY_MEDICINE_INVENTORY_RECORD_MOVEMENT` | **REQ** | — | — | — | — | **REQ** | — | — | — |
| | Medicine Inventory | AdjustStock | `PHARMACY_MEDICINE_INVENTORY_ADJUST_STOCK` | **REQ** | — | — | — | — | **REQ** | — | — | — |
| | Medicine Inventory | EditBatch | `PHARMACY_MEDICINE_INVENTORY_EDIT_BATCH` | **REQ** | — | — | — | — | **REQ** | — | — | — |
| | Medicine Inventory | ConfigureLowStock | `PHARMACY_MEDICINE_INVENTORY_CONFIGURE_LOW_STOCK` | **REQ** | — | — | — | — | **REQ** | — | — | — |
| | Dispensing | View | `PHARMACY_DISPENSING_VIEW` | **REQ** | — | — | — | — | **REQ** | — | — | **REQ** |
| | Dispensing | Edit | `PHARMACY_DISPENSING_EDIT` | **REQ** | — | — | — | — | **REQ** | — | — | — |
| | Dispensing | Dispense | `PHARMACY_DISPENSING_DISPENSE` | **REQ** | — | — | — | — | **REQ** | — | — | — |
| | Dispensing | Cancel | `PHARMACY_DISPENSING_CANCEL` | **REQ** | — | — | — | — | **REQ** | — | — | — |
| | Dispensing | Reverse | `PHARMACY_DISPENSING_REVERSE` | **REQ** | — | — | — | — | **REQ** | — | — | — |
| | Dispensing | UpdateStatus | `PHARMACY_DISPENSING_UPDATE_STATUS` | **REQ** | — | — | — | — | **REQ** | — | — | — |
| **Admissions** | Wards | View | `ADMISSIONS_WARDS_VIEW` | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | — | — | — | — |
| | Wards | Create | `ADMISSIONS_WARDS_CREATE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Wards | Edit | `ADMISSIONS_WARDS_EDIT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Wards | ChangeStatus | `ADMISSIONS_WARDS_CHANGE_STATUS` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Beds | View | `ADMISSIONS_BEDS_VIEW` | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | — | — | — | — |
| | Beds | Create | `ADMISSIONS_BEDS_CREATE` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Beds | Edit | `ADMISSIONS_BEDS_EDIT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Beds | ChangeStatus | `ADMISSIONS_BEDS_CHANGE_STATUS` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Admission Policy | View | `ADMISSIONS_ADMISSION_POLICY_VIEW` | **REQ** | **REQ** | **REQ** | — | — | — | — | — | — |
| | Admission Policy | Edit | `ADMISSIONS_ADMISSION_POLICY_EDIT` | **REQ** | **REQ** | — | — | — | — | — | — | — |
| | Bed Holds | View | `ADMISSIONS_BED_HOLDS_VIEW` | **REQ** | **OPT** | **REQ** | — | — | — | — | — | — |
| | Bed Holds | Create | `ADMISSIONS_BED_HOLDS_CREATE` | **REQ** | **OPT** | **REQ** | — | — | — | — | — | — |
| | Bed Holds | Release | `ADMISSIONS_BED_HOLDS_RELEASE` | **REQ** | **OPT** | **REQ** | — | — | — | — | — | — |
| | Bed Holds | Cancel | `ADMISSIONS_BED_HOLDS_CANCEL` | **REQ** | **OPT** | **REQ** | — | — | — | — | — | — |
| | Bed Transfers | View | `ADMISSIONS_BED_TRANSFERS_VIEW` | **REQ** | **OPT** | — | **REQ** | — | — | — | — | — |
| | Bed Transfers | Create | `ADMISSIONS_BED_TRANSFERS_CREATE` | **REQ** | **OPT** | — | **OPT** | — | — | — | — | — |
| | Bed Transfers | Complete | `ADMISSIONS_BED_TRANSFERS_COMPLETE` | **REQ** | **OPT** | — | — | — | — | — | — | — |
| | Bed Transfers | Cancel | `ADMISSIONS_BED_TRANSFERS_CANCEL` | **REQ** | **OPT** | — | — | — | — | — | — | — |
| | Bed Transfers | CrossBranch | `ADMISSIONS_BED_TRANSFERS_CROSS_BRANCH` | **REQ** | **OPT** | — | — | — | — | — | — | — |
| | Inpatient Admissions | View | `ADMISSIONS_INPATIENT_ADMISSIONS_VIEW` | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | — | — | — | **REQ** |
| | Inpatient Admissions | Create | `ADMISSIONS_INPATIENT_ADMISSIONS_CREATE` | **REQ** | — | — | **REQ** | **REQ** | — | — | — | — |
| | Inpatient Admissions | Edit | `ADMISSIONS_INPATIENT_ADMISSIONS_EDIT` | **REQ** | — | — | **REQ** | **REQ** | — | — | — | — |
| | Inpatient Admissions | Discharge | `ADMISSIONS_INPATIENT_ADMISSIONS_DISCHARGE` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | Admission Recommendations | View | `ADMISSIONS_ADMISSION_RECOMMENDATIONS_VIEW` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | Admission Recommendations | Create | `ADMISSIONS_ADMISSION_RECOMMENDATIONS_CREATE` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | Admission Recommendations | Cancel | `ADMISSIONS_ADMISSION_RECOMMENDATIONS_CANCEL` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | Admission Requests | View | `ADMISSIONS_ADMISSION_REQUESTS_VIEW` | **REQ** | — | **REQ** | **REQ** | — | — | — | — | **REQ** |
| | Admission Requests | Create | `ADMISSIONS_ADMISSION_REQUESTS_CREATE` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Admission Requests | Validate | `ADMISSIONS_ADMISSION_REQUESTS_VALIDATE` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Admission Requests | Confirm | `ADMISSIONS_ADMISSION_REQUESTS_CONFIRM` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Admission Requests | Cancel | `ADMISSIONS_ADMISSION_REQUESTS_CANCEL` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| **Surgery** | Recommendations | View | `SURGERY_RECOMMENDATIONS_VIEW` | **REQ** | — | **REQ** | — | **REQ** | — | — | — | — |
| | Recommendations | Create | `SURGERY_RECOMMENDATIONS_CREATE` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | Recommendations | Cancel | `SURGERY_RECOMMENDATIONS_CANCEL` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | Bookings | View | `SURGERY_BOOKINGS_VIEW` | **REQ** | — | **REQ** | — | **REQ** | — | — | — | **REQ** |
| | Bookings | Create | `SURGERY_BOOKINGS_CREATE` | **REQ** | — | **REQ** | — | **OPT** | — | — | — | — |
| | Bookings | Confirm | `SURGERY_BOOKINGS_CONFIRM` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Bookings | Reschedule | `SURGERY_BOOKINGS_RESCHEDULE` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Bookings | Cancel | `SURGERY_BOOKINGS_CANCEL` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Bookings | Complete | `SURGERY_BOOKINGS_COMPLETE` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | Schedule | View | `SURGERY_SCHEDULE_VIEW` | **REQ** | — | **REQ** | — | **REQ** | — | — | — | — |
| **Emergency** | Encounters | View | `EMERGENCY_ENCOUNTERS_VIEW` | **REQ** | — | **REQ** | **REQ** | **REQ** | — | — | — | — |
| | Encounters | Register | `EMERGENCY_ENCOUNTERS_REGISTER` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Encounters | Edit | `EMERGENCY_ENCOUNTERS_EDIT` | **REQ** | — | — | — | — | — | — | — | — |
| | Triage | View | `EMERGENCY_TRIAGE_VIEW` | **REQ** | — | **REQ** | **REQ** | **REQ** | — | — | — | — |
| | Triage | Assess | `EMERGENCY_TRIAGE_ASSESS` | **REQ** | — | — | **REQ** | — | — | — | — | — |
| | Triage | OverridePriority | `EMERGENCY_TRIAGE_OVERRIDE_PRIORITY` | **REQ** | — | — | **OPT** | **OPT** | — | — | — | — |
| | Consultation | View | `EMERGENCY_CONSULTATION_VIEW` | **REQ** | — | — | **REQ** | **REQ** | — | — | — | — |
| | Consultation | Edit | `EMERGENCY_CONSULTATION_EDIT` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | Orders | View | `EMERGENCY_ORDERS_VIEW` | **REQ** | — | — | **REQ** | **REQ** | — | — | — | — |
| | Orders | Create | `EMERGENCY_ORDERS_CREATE` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | Disposition | View | `EMERGENCY_DISPOSITION_VIEW` | **REQ** | — | — | **REQ** | **REQ** | — | — | — | — |
| | Disposition | Discharge | `EMERGENCY_DISPOSITION_DISCHARGE` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | Disposition | Transfer | `EMERGENCY_DISPOSITION_TRANSFER` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | Disposition | ConvertToIP | `EMERGENCY_DISPOSITION_CONVERT_TO_IP` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | Disposition | MarkLeft | `EMERGENCY_DISPOSITION_MARK_LEFT` | **REQ** | — | — | — | **REQ** | — | — | — | — |
| | Disposition | MarkNoShow | `EMERGENCY_DISPOSITION_MARK_NO_SHOW` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Disposition | Cancel | `EMERGENCY_DISPOSITION_CANCEL` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Patient Linking | Link | `EMERGENCY_PATIENT_LINKING_LINK` | **REQ** | — | **REQ** | — | — | — | — | — | — |
| | Patient Linking | Correct | `EMERGENCY_PATIENT_LINKING_CORRECT` | **REQ** | — | **OPT** | — | — | — | — | — | — |
| **Laboratory** | Orders | View | `LABORATORY_ORDERS_VIEW` | **REQ** | — | — | — | **REQ** | — | **REQ** | — | **REQ** |
| | Orders | Edit | `LABORATORY_ORDERS_EDIT` | **REQ** | — | — | — | — | — | **REQ** | — | — |
| | Orders | EnterResult | `LABORATORY_ORDERS_ENTER_RESULT` | **REQ** | — | — | — | — | — | **REQ** | — | — |
| | Orders | VerifyResult | `LABORATORY_ORDERS_VERIFY_RESULT` | **REQ** | — | — | — | — | — | **REQ** | — | — |
| **Imaging** | Orders | View | `IMAGING_ORDERS_VIEW` | **REQ** | — | — | — | **REQ** | — | — | **REQ** | **REQ** |
| | Orders | Edit | `IMAGING_ORDERS_EDIT` | **REQ** | — | — | — | — | — | — | **REQ** | — |
| | Orders | EnterReport | `IMAGING_ORDERS_ENTER_REPORT` | **REQ** | — | — | — | — | **REQ** | — | — | — |
| | Orders | VerifyReport | `IMAGING_ORDERS_VERIFY_REPORT` | **REQ** | — | — | — | — | — | — | **REQ** | — |
| **Billing** | Invoices | View | `BILLING_INVOICES_VIEW` | **REQ** | **REQ** | — | — | — | — | — | — | **REQ** |
| | Invoices | Create | `BILLING_INVOICES_CREATE` | **REQ** | — | — | — | — | — | — | — | **REQ** |
| | Invoices | Edit | `BILLING_INVOICES_EDIT` | **REQ** | — | — | — | — | — | — | — | **REQ** |
| | Invoices | Cancel | `BILLING_INVOICES_CANCEL` | **REQ** | — | — | — | — | — | — | — | **REQ** |
| | Invoices | CollectPayment | `BILLING_INVOICES_COLLECT_PAYMENT` | **REQ** | — | — | — | — | — | — | — | **REQ** |
| | Invoices | ViewReceipt | `BILLING_INVOICES_VIEW_RECEIPT` | **REQ** | — | **OPT** | — | — | — | — | — | **REQ** |
| **Reports** | Phase 2 Reports | View | `REPORTS_PHASE_2_REPORTS_VIEW` | **REQ** | **REQ** | — | — | — | — | — | — | **REQ** |

---

## 7. Architectural Alignment & Safety Summary

1. **Principle of Least Privilege:** Clinical operational permissions (`Assess`, `Consultation Edit`, `Prescribe`, `Discharge`, `EnterResult`, `VerifyReport`) are strictly isolated to licensed medical and diagnostic roles.
2. **Atomic Context Integrity:** Frontend route accessibility matches backend route protection. Users cannot navigate to screens for which their roles do not hold backend authorization.
3. **Audit Trail Completeness:** Actions involving financial collections, clinical sign-offs, cancellations, and identity linking maintain actor metadata (`userId`, `ipAddress`, `userAgent`) without overexposing restricted patient data.
