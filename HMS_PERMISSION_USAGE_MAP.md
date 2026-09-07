# HMS — Detailed Permission Usage Mapping

## 1. Purpose

This document provides a comprehensive, ground-truth technical mapping of **every existing permission** in the Hospital Management System (HMS) catalog to its actual implementation usage across the frontend user interface, navigation routing, and backend API authorization guards.

This is an **analysis and technical reference document** derived strictly from the current codebase (`apps/api/src/database/seed.ts`, `apps/api/src/modules/permissions/*`, `apps/api/src/modules/**/*.routes.ts`, and `apps/web/src/auth/access-control.ts`). No code, roles, or permissions have been modified or invented.

---

## 2. Permission Hierarchy

The HMS permission catalog is structured across 3 Categories, 13 Functional Groups, and 24 Distinct Screens, comprising **88 unique permission actions** (expanded into 172 permission assignments across system roles):

```text
HMS Permissions Catalog
├── SYSTEM CATEGORY
│   └── Administration
│       ├── Dashboard [View]
│       ├── Users [View, Create, Edit, ChangePassword, ResetPassword, Delete, Export]
│       ├── Roles [View, Create, Edit, Assign, Delete]
│       ├── Permissions [View, Create, Edit, Assign, Delete]
│       ├── Branches [View, Create, Edit, Delete, Export]
│       ├── Departments [View, Create, Edit, Delete, Export]
│       ├── Services [View, Create, Edit, Delete, Export]
│       ├── Medicines [View, Create, Edit, Delete, Export]
│       ├── Consent Templates [View, Create, Edit]
│       ├── Notifications [View, Create]
│       └── Settings [View, Edit, Export]
│
├── CLINICAL CATEGORY
│   ├── Patients
│   │   ├── Patient Records [View, Create, Edit]
│   │   ├── Patient Documents [View, Create, Edit, Delete]
│   │   └── Consent [View, Attach, Verify, Delete]
│   ├── Doctors
│   │   ├── Doctor Directory [View, Create, Edit, Export, Provision Login]
│   │   └── Doctor Availability [View, Edit]
│   ├── Appointments
│   │   ├── Appointment Records [View, Edit]
│   │   └── Appointment Booking [View, Create, Edit]
│   ├── OPD
│   │   ├── OPD Visits [View, Create, Edit]
│   │   ├── OPD Vitals [View, Create, Edit]
│   │   ├── OPD Consultation [View, Edit]
│   │   ├── OPD Prescription [View, Edit]
│   │   ├── OPD Clinical Orders [View, Edit]
│   │   ├── OPD Follow-up [View, Edit]
│   │   └── OPD Referral [View, Edit]
│   ├── Pharmacy
│   │   ├── Medicine Inventory [View, RegisterBatch, RecordMovement, AdjustStock, EditBatch, ConfigureLowStock]
│   │   └── Dispensing [View, Edit, Dispense, Cancel, Reverse, UpdateStatus]
│   ├── Admissions
│   │   ├── Wards [View, Create, Edit, ChangeStatus]
│   │   ├── Beds [View, Create, Edit, ChangeStatus]
│   │   ├── Admission Policy [View, Edit]
│   │   ├── Bed Holds [View, Create, Release, Cancel]
│   │   ├── Bed Transfers [View, Create, Complete, Cancel, CrossBranch]
│   │   ├── Inpatient Admissions [View, Create, Edit, Discharge]
│   │   ├── Admission Recommendations [View, Create, Cancel]
│   │   └── Admission Requests [View, Create, Validate, Confirm, Cancel]
│   ├── Surgery
│   │   ├── Recommendations [View, Create, Cancel]
│   │   ├── Bookings [View, Create, Confirm, Reschedule, Cancel, Complete]
│   │   └── Schedule [View]
│   ├── Emergency
│   │   ├── Encounters [View, Register, Edit]
│   │   ├── Triage [View, Assess, OverridePriority]
│   │   ├── Consultation [View, Edit]
│   │   ├── Orders [View, Create]
│   │   ├── Disposition [View, Discharge, Transfer, ConvertToIP, MarkLeft, MarkNoShow, Cancel]
│   │   └── Patient Linking [Link, Correct]
│   ├── Laboratory
│   │   └── Orders [View, Edit, EnterResult, VerifyResult]
│   └── Imaging
│       └── Orders [View, Edit, EnterReport, VerifyReport]
│
└── FINANCE CATEGORY
    ├── Billing
    │   └── Invoices [View, Create, Edit, Cancel, CollectPayment, ViewReceipt]
    └── Reports
        └── Phase 2 Reports [View]
```

---

## 3. Complete Permission Usage Table

| # | Permission Name | Module | Screen | Action | Actual Usage in Code | Controlling UI Element | Route Protected | Backend Endpoint Guard | Current Seeded Roles |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Administration → Dashboard → View** | Administration | Dashboard | View | Accessing administrative overview, inspecting total branch count, active user count, department count, and system health status. | Administration sidebar menu item; KPI Metric Cards (Total Users, Branches, Departments, Services); System Health indicators. | `/administration` | `GET /api/admin/dashboard` | SUPER_ADMIN, ADMINISTRATOR |
| 2 | **Administration → Users → View** | Administration | Users | View | Browsing staff accounts, filtering users by branch/role/department, and viewing user account metadata. | User Management sidebar link; User directory table; Search and filter controls; User detail drawer. | `/administration/users` | `GET /api/users` | SUPER_ADMIN, ADMINISTRATOR |
| 3 | **Administration → Users → Create** | Administration | Users | Create | Submitting new staff user creation form. | 'Add User' primary button on User Management page; New User submission modal. | `Not directly route-gated (page requires View)` | `POST /api/users` | SUPER_ADMIN, ADMINISTRATOR |
| 4 | **Administration → Users → Edit** | Administration | Users | Edit | Updating staff user profiles, changing assigned branches/departments, locking/unlocking user accounts. | 'Edit' action icon in User table row; 'Status' dropdown toggle (Active/Inactive/Locked). | `None (Sub-action)` | `PATCH /api/users/:id` | SUPER_ADMIN, ADMINISTRATOR |
| 5 | **Administration → Users → ChangePassword** | Administration | Users | ChangePassword | Setting a new password when current password credentials are verified. | 'Change Password' option in user action menu. | `None (Sub-action)` | `POST /api/users/:id/change-password` | SUPER_ADMIN, ADMINISTRATOR |
| 6 | **Administration → Users → ResetPassword** | Administration | Users | ResetPassword | Admin recovering locked-out staff accounts and assigning temporary credentials. | 'Reset Password' button in user action menu. | `None (Sub-action)` | `POST /api/users/:id/reset-password` | SUPER_ADMIN, ADMINISTRATOR |
| 7 | **Administration → Users → Delete** | Administration | Users | Delete | Permanently deactivating/decommissioning departed staff accounts. | 'Delete User' option in context menu. | `None (Sub-action)` | `DELETE /api/users/:id` | SUPER_ADMIN |
| 8 | **Administration → Users → Export** | Administration | Users | Export | Downloading CSV reports of staff users. | 'Export CSV' button on User Management page. | `None (Sub-action)` | `GET /api/users/export` | SUPER_ADMIN, ADMINISTRATOR |
| 9 | **Administration → Roles → View** | Administration | Roles | View | Inspecting role list, viewing role user assignments, and reviewing role change audit history. | Roles & Permissions sidebar link (co-required with Permissions View); Roles list tab; Role Detail card. | `/administration/roles-permissions` | `GET /api/roles` | SUPER_ADMIN, ADMINISTRATOR |
| 10 | **Administration → Roles → Create** | Administration | Roles | Create | Registering new custom role names, codes, and color badges. | 'Add Role' button on Roles tab; Create Role modal dialog. | `None (Sub-action)` | `POST /api/roles` | SUPER_ADMIN, ADMINISTRATOR |
| 11 | **Administration → Roles → Edit** | Administration | Roles | Edit | Updating role display details and changing role status. | 'Edit Role' button; Role status switch. | `None (Sub-action)` | `PATCH /api/roles/:id` | SUPER_ADMIN, ADMINISTRATOR |
| 12 | **Administration → Roles → Assign** | Administration | Roles | Assign | Mapping staff users to roles (`POST /api/roles/:id/users`, `DELETE /api/roles/:id/users/:userId`). | 'Assign User' button in Role Detail; Role checkboxes in User form. | `None (Sub-action)` | `POST /api/roles/:id/users` | SUPER_ADMIN, ADMINISTRATOR |
| 13 | **Administration → Roles → Delete** | Administration | Roles | Delete | Removing obsolete custom roles. | 'Delete Role' trash icon button. | `None (Sub-action)` | `DELETE /api/roles/:id` | SUPER_ADMIN |
| 14 | **Administration → Permissions → View** | Administration | Permissions | View | Inspecting permission definitions, filtering permissions by module/group, and viewing role permissions. | Permissions matrix tab; Permission Detail drawer; Role-Permission checklist. | `/administration/roles-permissions` | `GET /api/permissions` | SUPER_ADMIN, ADMINISTRATOR |
| 15 | **Administration → Permissions → Create** | Administration | Permissions | Create | Adding new custom permissions to extensible modules. | 'Add Custom Permission' button. | `None (Sub-action)` | `POST /api/permissions` | SUPER_ADMIN |
| 16 | **Administration → Permissions → Edit** | Administration | Permissions | Edit | Modifying custom permission names and descriptions. | 'Edit' button on custom permission card. | `None (Sub-action)` | `PATCH /api/permissions/:id` | SUPER_ADMIN |
| 17 | **Administration → Permissions → Assign** | Administration | Permissions | Assign | Saving role permission matrix modifications (`PUT /api/roles/:id/permissions`). | 'Save Changes' / 'Save Permissions' button on Permission Matrix workspace. | `None (Sub-action)` | `PUT /api/roles/:id/permissions` | SUPER_ADMIN, ADMINISTRATOR |
| 18 | **Administration → Permissions → Delete** | Administration | Permissions | Delete | Removing obsolete custom permissions. | 'Delete Permission' button. | `None (Sub-action)` | `DELETE /api/permissions/:id` | SUPER_ADMIN |
| 19 | **Administration → Branches → View** | Administration | Branches | View | Listing hospital branches and populating branch dropdowns across the HMS. | Branch Management sidebar link; Branch list table; Branch Switcher in top bar. | `/administration/branches` | `GET /api/branches` | SUPER_ADMIN, ADMINISTRATOR |
| 20 | **Administration → Branches → Create** | Administration | Branches | Create | Submitting new branch registration form (code, name, address, timezone, capacity). | 'Add Branch' primary action button. | `None (Sub-action)` | `POST /api/branches` | SUPER_ADMIN, ADMINISTRATOR |
| 21 | **Administration → Branches → Edit** | Administration | Branches | Edit | Modifying branch metadata and activating/deactivating branches. | 'Edit' button in branch table; Branch status switch. | `None (Sub-action)` | `PATCH /api/branches/:id` | SUPER_ADMIN, ADMINISTRATOR |
| 22 | **Administration → Branches → Delete** | Administration | Branches | Delete | Decommissioning closed hospital branches. | 'Delete Branch' trash icon action. | `None (Sub-action)` | `DELETE /api/branches/:id` | SUPER_ADMIN |
| 23 | **Administration → Branches → Export** | Administration | Branches | Export | Downloading CSV reports of hospital branches. | 'Export CSV' button on Branch Management page. | `None (Sub-action)` | `GET /api/branches/export` | SUPER_ADMIN, ADMINISTRATOR |
| 24 | **Administration → Departments → View** | Administration | Departments | View | Listing clinical/administrative departments and populating department filters. | Department Management sidebar link; Department list table; Specialty dropdowns. | `/administration/departments` | `GET /api/departments` | SUPER_ADMIN, ADMINISTRATOR |
| 25 | **Administration → Departments → Create** | Administration | Departments | Create | Submitting new department creation form (code, name, type, branch associations). | 'Add Department' primary button. | `None (Sub-action)` | `POST /api/departments` | SUPER_ADMIN, ADMINISTRATOR |
| 26 | **Administration → Departments → Edit** | Administration | Departments | Edit | Updating department metadata and activating/deactivating departments. | 'Edit' button in department table; Department status switch. | `None (Sub-action)` | `PATCH /api/departments/:id` | SUPER_ADMIN, ADMINISTRATOR |
| 27 | **Administration → Departments → Delete** | Administration | Departments | Delete | Decommissioning closed hospital departments. | 'Delete Department' trash icon button. | `None (Sub-action)` | `DELETE /api/departments/:id` | SUPER_ADMIN |
| 28 | **Administration → Departments → Export** | Administration | Departments | Export | Downloading CSV reports of hospital departments. | 'Export CSV' button on Department Management page. | `None (Sub-action)` | `GET /api/departments/export` | SUPER_ADMIN, ADMINISTRATOR |
| 29 | **Administration → Services → View** | Administration | Services | View | Browsing service items, looking up standard prices, and verifying test codes. | Service Catalogue sidebar link; Service table; Billing service autocomplete. | `/administration/services` | `GET /api/services` | SUPER_ADMIN, ADMINISTRATOR, BILLING_AUTHORIZED |
| 30 | **Administration → Services → Create** | Administration | Services | Create | Adding new tariff items, test types, and charge categories. | 'Add Service' primary action button. | `None (Sub-action)` | `POST /api/services` | SUPER_ADMIN, ADMINISTRATOR |
| 31 | **Administration → Services → Edit** | Administration | Services | Edit | Updating service pricing, adjusting tariff schedules, and activating/deactivating services. | 'Edit' button in service table; Service status switch. | `None (Sub-action)` | `PATCH /api/services/:id` | SUPER_ADMIN, ADMINISTRATOR |
| 32 | **Administration → Services → Delete** | Administration | Services | Delete | Decommissioning discontinued medical services. | 'Delete Service' trash icon button. | `None (Sub-action)` | `DELETE /api/services/:id` | SUPER_ADMIN |
| 33 | **Administration → Services → Export** | Administration | Services | Export | Downloading CSV export of hospital tariff schedules. | 'Export CSV' button on Service Catalogue page. | `None (Sub-action)` | `GET /api/services/export` | SUPER_ADMIN, ADMINISTRATOR |
| 34 | **Administration → Medicines → View** | Administration | Medicines | View | Searching formulary medications and inspecting drug specifications. | Medicine Master sidebar link; Medicine directory table; Prescription medication search autocomplete. | `/administration/medicines` | `GET /api/medicines` | SUPER_ADMIN, ADMINISTRATOR |
| 35 | **Administration → Medicines → Create** | Administration | Medicines | Create | Registering new generic and brand medications in the hospital formulary. | 'Add Medicine' primary action button. | `None (Sub-action)` | `POST /api/medicines` | SUPER_ADMIN, ADMINISTRATOR |
| 36 | **Administration → Medicines → Edit** | Administration | Medicines | Edit | Updating drug formulations and activating/deactivating medications. | 'Edit' button in medicine table; Medicine status switch. | `None (Sub-action)` | `PATCH /api/medicines/:id` | SUPER_ADMIN, ADMINISTRATOR |
| 37 | **Administration → Medicines → Delete** | Administration | Medicines | Delete | Decommissioning discontinued pharmaceutical products. | 'Delete Medicine' trash icon button. | `None (Sub-action)` | `DELETE /api/medicines/:id` | SUPER_ADMIN |
| 38 | **Administration → Medicines → Export** | Administration | Medicines | Export | Downloading CSV export of hospital medicine formulary. | 'Export CSV' button on Medicine Master page. | `None (Sub-action)` | `GET /api/medicines/export` | SUPER_ADMIN, ADMINISTRATOR |
| 39 | **Administration → Consent Templates → View** | Administration | Consent Templates | View | Inspecting consent template legal texts and selecting templates during consent signing. | Consent Templates sidebar link; Template list cards; Consent Template preview modal. | `/administration/consent-templates` | `GET /api/consents/templates` | SUPER_ADMIN, ADMINISTRATOR |
| 40 | **Administration → Consent Templates → Create** | Administration | Consent Templates | Create | Creating standardized consent forms for surgeries, admissions, and procedures. | 'Add Template' primary button on Consent Templates page. | `None (Sub-action)` | `POST /api/consents/templates` | SUPER_ADMIN, ADMINISTRATOR |
| 41 | **Administration → Consent Templates → Edit** | Administration | Consent Templates | Edit | Publishing updated revisions of legal consent templates. | 'Edit' action button; Version update trigger; Template status switch. | `None (Sub-action)` | `PATCH /api/consents/templates/:id` | SUPER_ADMIN, ADMINISTRATOR |
| 42 | **Administration → Notifications → View** | Administration | Notifications | View | Reviewing system alert history and notification feeds. | Notification center panel; System alert bell. | `None (Sub-action)` | `GET /api/notifications` | SUPER_ADMIN, ADMINISTRATOR |
| 43 | **Administration → Notifications → Create** | Administration | Notifications | Create | Publishing system maintenance notices or critical operational announcements. | 'Send Broadcast' / 'New Notification' button. | `None (Sub-action)` | `POST /api/notifications` | SUPER_ADMIN, ADMINISTRATOR |
| 44 | **Administration → Settings → View** | Administration | Settings | View | Inspecting system operational configurations. | System Settings sidebar link; Settings panels and tab navigation. | `/administration/settings` | `GET /api/settings` | SUPER_ADMIN, ADMINISTRATOR |
| 45 | **Administration → Settings → Edit** | Administration | Settings | Edit | Updating hospital business settings, session timeouts, and branding configurations. | 'Save Settings' button on System Settings tabs. | `None (Sub-action)` | `PATCH /api/settings` | SUPER_ADMIN, ADMINISTRATOR |
| 46 | **Administration → Settings → Export** | Administration | Settings | Export | Exporting configuration snapshots for audit and disaster recovery. | 'Export Settings' button. | `None (Sub-action)` | `GET /api/settings/export` | SUPER_ADMIN, ADMINISTRATOR |
| 47 | **Patients → Patient Records → View** | Patients | Patient Records | View | Looking up patient records, verifying patient identity, and reviewing comprehensive patient EMR timeline. | Patients sidebar link; Search Patients input; Patient list table; 'View Patient' profile link; EMR timeline tab. | `/patients, /patients/search, /patients/profile` | `GET /api/patients` | SUPER_ADMIN, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR, BILLING_AUTHORIZED |
| 48 | **Patients → Patient Records → Create** | Patients | Patient Records | Create | Submitting new patient registrations to generate unique MRN / UHID identifiers. | 'Register Patient' sidebar link and primary button; Patient registration form; Save Patient button. | `/patients/register` | `POST /api/patients` | SUPER_ADMIN, RECEPTIONIST |
| 49 | **Patients → Patient Records → Edit** | Patients | Patient Records | Edit | Updating demographic changes, correcting spelling, and recording chronic medical alerts. | 'Edit Profile' / 'Edit Patient' button in Patient Workspace header; Save Patient button. | `None (Sub-action)` | `PATCH /api/patients/:id` | SUPER_ADMIN, RECEPTIONIST, DOCTOR |
| 50 | **Patients → Patient Documents → View** | Patients | Patient Documents | View | Browsing attached files, previewing documents, and downloading file attachments. | Patient Documents tab; Document table; 'Download' icon button; Document preview viewer. | `/patients/documents` | `GET /api/patients/:id/documents` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR |
| 51 | **Patients → Patient Documents → Create** | Patients | Patient Documents | Create | Uploading files to patient medical records via multipart upload (`POST /api/patients/:id/documents/upload`). | 'Upload Document' button; File dropzone; Document metadata form. | `None (Sub-action)` | `POST /api/patients/:id/documents/upload` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR |
| 52 | **Patients → Patient Documents → Edit** | Patients | Patient Documents | Edit | Replacing an uploaded document file or adding administrative review notes. | 'Edit Document' button; 'Review Document' button in document row. | `None (Sub-action)` | `PUT /api/patients/:id/documents/:documentId/upload` | SUPER_ADMIN, ADMINISTRATOR |
| 53 | **Patients → Patient Documents → Delete** | Patients | Patient Documents | Delete | Removing erroneously uploaded or duplicate patient files. | 'Delete Document' trash icon button. | `None (Sub-action)` | `DELETE /api/patients/:id/documents/:documentId` | SUPER_ADMIN, ADMINISTRATOR |
| 54 | **Patients → Consent → View** | Patients | Consent | View | Checking whether mandatory informed consent has been obtained before surgery or admission. | Consent Attachment sidebar link; Consent status badge; Signed consent viewer. | `/patients/consent, /patients/consents` | `GET /api/patients/:id/documents?document_type=CONSENT` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR |
| 55 | **Patients → Consent → Attach** | Patients | Consent | Attach | Linking signed consent forms to inpatient admissions, surgical procedures, or clinical encounters. | 'Attach Consent' primary button; Consent file upload form; 'Mark as Signed' checkbox. | `None (Sub-action)` | `POST /api/patients/:id/documents/upload (checked when document_type === 'CONSENT')` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR |
| 56 | **Patients → Consent → Verify** | Patients | Consent | Verify | Transitioning consent status from `ATTACHED` / `SIGNED` to `VERIFIED`. | 'Verify Consent' button / badge in Consent Management table. | `None (Sub-action)` | `PATCH /api/patients/:id/documents/:documentId/consent/verify` | SUPER_ADMIN, ADMINISTRATOR, CLINICIAN_NURSE, DOCTOR |
| 57 | **Patients → Consent → Delete** | Patients | Consent | Delete | Revoking invalidated or erroneously attached consent forms. | 'Delete Consent' button in consent row. | `None (Sub-action)` | `DELETE /api/patients/:id/documents/:documentId (checked when document_type === 'CONSENT')` | SUPER_ADMIN, ADMINISTRATOR |
| 58 | **Doctors → Doctor Directory → View** | Doctors | Doctor Directory | View | Browsing doctor list, filtering doctors by specialty/department, and selecting doctors for booking. | Doctor Directory sidebar link; Doctor cards; Specialty dropdowns; Doctor lookup modals. | `/doctors, /doctors/directory, /doctors/profile, /doctors/schedule, /doctors/performance` | `GET /api/doctors` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR |
| 59 | **Doctors → Doctor Directory → Create** | Doctors | Doctor Directory | Create | Registering physician profiles, licenses, consultation fees, and department affiliations. | 'Add Doctor' primary button on Doctor Directory page. | `None (Sub-action)` | `POST /api/doctors` | SUPER_ADMIN, ADMINISTRATOR |
| 60 | **Doctors → Doctor Directory → Edit** | Doctors | Doctor Directory | Edit | Updating doctor credentials, changing departmental assignments, linking doctor to user accounts. | 'Edit Doctor' button; 'Map User' button; Doctor active/inactive toggle. | `None (Sub-action)` | `PATCH /api/doctors/:id` | SUPER_ADMIN, ADMINISTRATOR |
| 61 | **Doctors → Doctor Directory → Export** | Doctors | Doctor Directory | Export | Downloading CSV export of active hospital physicians. | 'Export CSV' button on Doctor Directory page. | `None (Sub-action)` | `GET /api/doctors/export` | SUPER_ADMIN, ADMINISTRATOR |
| 62 | **Doctors → Doctor Directory → Provision Login** | Doctors | Doctor Directory | Provision Login | Enabling 'Create Login Account' when onboarding a doctor and fetching eligible user accounts (`GET /api/doctors/user-options`). | 'Create Login Account' toggle switch in Add Doctor modal; 'Select User' dropdown in User Mapping modal. | `None (Sub-action)` | `GET /api/doctors/user-options` | SUPER_ADMIN, ADMINISTRATOR |
| 63 | **Doctors → Doctor Availability → View** | Doctors | Doctor Availability | View | Checking doctor on-duty hours, calculating available appointment slots, and viewing scheduled leaves. | Doctor Availability sidebar link; Weekly availability grid; Available slots timeline; Leave list table. | `/doctors/availability` | `GET /api/doctors/:id/available-slots` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR |
| 64 | **Doctors → Doctor Availability → Edit** | Doctors | Doctor Availability | Edit | Updating weekly consulting hours, applying for leaves, canceling leaves, adding schedule overrides. | 'Save Schedule' button; 'Apply Leave' button; 'Cancel Leave' button; 'Add Exception' button. | `None (Sub-action)` | `PATCH /api/doctors/:id/availability` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 65 | **Appointments → Appointment Records → View** | Appointments | Appointment Records | View | Monitoring outpatient appointments, filtering by doctor/department/status, and viewing appointment history. | Appointments sidebar link; Calendar View sidebar link; Queue Management sidebar link; Appointment table; Appointment status filter. | `/appointments, /appointments/calendar, /appointments/queue` | `GET /api/appointments` | SUPER_ADMIN, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR |
| 66 | **Appointments → Appointment Records → Edit** | Appointments | Appointment Records | Edit | Canceling appointments (`PATCH /api/appointments/:id/status` with `status: 'CANCELLED'`). | 'Cancel' button in Appointment queue actions; 'Cancel Appointment' dialog. | `None (Sub-action)` | `PATCH /api/appointments/:id/status` | SUPER_ADMIN, RECEPTIONIST |
| 67 | **Appointments → Appointment Booking → View** | Appointments | Appointment Booking | View | Navigating to appointment booking workflows and inspecting slot availability. | Book Appointment sidebar link; Referral Booking sidebar link; Slot booking scheduler view. | `/appointments/book, /appointments/referrals` | `Implicitly used in frontend route access control for booking screens.` | SUPER_ADMIN, RECEPTIONIST |
| 68 | **Appointments → Appointment Booking → Create** | Appointments | Appointment Booking | Create | Submitting new outpatient appointment bookings (`POST /api/appointments`) and booking referred appointments (`POST /api/opd/referrals/:id/book`). | 'Confirm Booking' / 'Book Appointment' button on booking form. | `/appointments/book, /appointments/referrals (co-required for route access in access-control.ts)` | `POST /api/appointments` | SUPER_ADMIN, RECEPTIONIST |
| 69 | **Appointments → Appointment Booking → Edit** | Appointments | Appointment Booking | Edit | Modifying scheduled appointment time/doctor (`PATCH /api/appointments/:id`). | 'Reschedule' button in appointment row actions; Reschedule Appointment modal. | `None (Sub-action)` | `PATCH /api/appointments/:id` | SUPER_ADMIN, RECEPTIONIST |
| 70 | **OPD → OPD Visits → View** | OPD | OPD Visits | View | Monitoring patient queue progression from Check In -> Vitals -> Consultation -> Completed. | OPD Dashboard sidebar link; Waiting Queue sidebar link; OPD live queue table; Patient visit card. | `/opd, /opd/queue` | `GET /api/opd/visits` | SUPER_ADMIN, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR, BILLING_AUTHORIZED |
| 71 | **OPD → OPD Visits → Create** | OPD | OPD Visits | Create | Executing patient check-in to generate token number and place patient in OPD waiting queue (`POST /api/opd/visits`). | 'Check In' primary action button on Appointment Queue; Check In confirmation modal. | `None (Sub-action)` | `POST /api/opd/visits` | SUPER_ADMIN, RECEPTIONIST |
| 72 | **OPD → OPD Visits → Edit** | OPD | OPD Visits | Edit | Calling patient to vitals room/consultation room (`POST /api/opd/visits/:id/call-next`) and updating visit status (`PATCH /api/opd/visits/:id/status`). | 'Call Next' button on OPD Waiting Queue; Status dropdown (In Vitals, In Consultation, Completed, Cancelled). | `None (Sub-action)` | `PATCH /api/opd/visits/:id/status` | SUPER_ADMIN, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR |
| 73 | **OPD → OPD Vitals → View** | OPD | OPD Vitals | View | Inspecting latest and historical vital signs during clinical triage and doctor consultation. | Vitals badge tile on consultation workspace; Vitals History modal table. | `None (Sub-action)` | `GET /api/opd/visits/:visitId/vitals` | SUPER_ADMIN, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR |
| 74 | **OPD → OPD Vitals → Create** | OPD | OPD Vitals | Create | Nursing intake: submitting physiological measurements (`POST /api/opd/visits/:visitId/vitals`). | 'Record Vitals' / 'Add Vitals' button in OPD Queue; Vitals entry modal form. | `None (Sub-action)` | `POST /api/opd/visits/:visitId/vitals` | SUPER_ADMIN, RECEPTIONIST, CLINICIAN_NURSE |
| 75 | **OPD → OPD Vitals → Edit** | OPD | OPD Vitals | Edit | Correcting data entry mistakes in recorded vitals. | 'Edit' button on vitals record row. | `None (Sub-action)` | `Enforced when updating existing vital logs.` | SUPER_ADMIN, RECEPTIONIST |
| 76 | **OPD → OPD Consultation → View** | OPD | OPD Consultation | View | Reviewing physician clinical evaluation notes. | Consultation Workspace sidebar link; Clinical Notes viewer card. | `/opd/visit, /opd/consultation` | `GET /api/opd/visits/:visitId/consultation` | SUPER_ADMIN, DOCTOR |
| 77 | **OPD → OPD Consultation → Edit** | OPD | OPD Consultation | Edit | Authoring clinical notes (`PUT /api/opd/visits/:id/consultation`) and finalizing medical consultation (`POST /api/opd/visits/:id/consultation/complete`). | 'Save Draft' button; 'Complete Consultation' primary action button on consultation form. | `None (Sub-action)` | `PUT /api/opd/visits/:visitId/consultation` | SUPER_ADMIN, DOCTOR |
| 78 | **OPD → OPD Prescription → View** | OPD | OPD Prescription | View | Reviewing prescribed medications across OPD, Pharmacy, Inpatient, and Surgery modules. | Prescription list card; E-Prescription preview modal; Pharmacy prescription viewer. | `None (Sub-action)` | `GET /api/opd/prescriptions` | SUPER_ADMIN, DOCTOR, PHARMACY_USER |
| 79 | **OPD → OPD Prescription → Edit** | OPD | OPD Prescription | Edit | Saving draft prescriptions and finalizing electronic prescriptions (`POST /api/opd/visits/:id/prescription/submit`, `POST /api/admissions/inpatients/:id/prescription`). | 'Add Medication' button; 'Save Prescription Draft' button; 'Submit Prescription' button. | `None (Sub-action)` | `PUT /api/opd/visits/:visitId/prescription` | SUPER_ADMIN, DOCTOR |
| 80 | **OPD → OPD Clinical Orders → View** | OPD | OPD Clinical Orders | View | Reviewing ordered lab tests, imaging studies, and clinical indications. | Clinical Orders list card; Investigation summary tile. | `None (Sub-action)` | `GET /api/opd/visits/:visitId/clinical-orders/:orderType` | SUPER_ADMIN, DOCTOR |
| 81 | **OPD → OPD Clinical Orders → Edit** | OPD | OPD Clinical Orders | Edit | Dispatching lab and radiology requests to diagnostic work queues (`POST /api/opd/visits/:id/clinical-orders/:type/submit`). | 'Add Test / Order' button; 'Submit Orders' primary button. | `None (Sub-action)` | `PUT /api/opd/visits/:visitId/clinical-orders/:orderType` | SUPER_ADMIN, DOCTOR |
| 82 | **OPD → OPD Follow-up → View** | OPD | OPD Follow-up | View | Checking follow-up instructions and scheduled revisit dates. | Follow-up schedule summary card. | `None (Sub-action)` | `GET /api/opd/visits/:visitId/follow-up` | SUPER_ADMIN, DOCTOR |
| 83 | **OPD → OPD Follow-up → Edit** | OPD | OPD Follow-up | Edit | Scheduling follow-up appointments (`POST /api/opd/visits/:id/follow-up/schedule`). | 'Schedule Follow-up' button; Follow-up date picker and instructions input. | `None (Sub-action)` | `PUT /api/opd/visits/:visitId/follow-up` | SUPER_ADMIN, DOCTOR |
| 84 | **OPD → OPD Referral → View** | OPD | OPD Referral | View | Looking up doctor referral orders to book referred appointments (`GET /api/opd/referrals`). | Referral Booking table; Referral details card on consultation screen. | `/appointments/referrals (co-required with Appointments Booking Create in access-control.ts)` | `GET /api/opd/referrals` | SUPER_ADMIN, RECEPTIONIST, DOCTOR |
| 85 | **OPD → OPD Referral → Edit** | OPD | OPD Referral | Edit | Generating clinical referral orders during doctor consultation (`POST /api/opd/visits/:id/referral/submit`). | 'Add Referral' button; 'Submit Referral' button on consultation form. | `None (Sub-action)` | `PUT /api/opd/visits/:visitId/referral` | SUPER_ADMIN, RECEPTIONIST, DOCTOR |
| 86 | **Pharmacy → Medicine Inventory → View** | Pharmacy | Medicine Inventory | View | Inspecting current on-hand stock quantities, batch expiries, movement logs, and low-stock alerts. | Medicine Inventory sidebar link; Stock balance table; Batch list drawer; Stock Movement history tab. | `/pharmacy/inventory` | `GET /api/pharmacy/medicine-inventory` | SUPER_ADMIN, PHARMACY_USER |
| 87 | **Pharmacy → Medicine Inventory → RegisterBatch** | Pharmacy | Medicine Inventory | RegisterBatch | Onboarding newly received medicine stock shipments (`POST /api/pharmacy/medicine-inventory/:medicineId/batches`). | 'Register Batch' primary button; Batch details entry form. | `None (Sub-action)` | `POST /api/pharmacy/medicine-inventory/:medicineId/batches` | SUPER_ADMIN, PHARMACY_USER |
| 88 | **Pharmacy → Medicine Inventory → RecordMovement** | Pharmacy | Medicine Inventory | RecordMovement | Documenting inbound/outbound stock transfers (`POST /api/pharmacy/medicine-inventory/movements`). | 'Record Movement' / 'Stock Transfer' button; Movement entry form. | `None (Sub-action)` | `POST /api/pharmacy/medicine-inventory/movements` | SUPER_ADMIN, PHARMACY_USER |
| 89 | **Pharmacy → Medicine Inventory → AdjustStock** | Pharmacy | Medicine Inventory | AdjustStock | Reconciling physical inventory variances with audited adjustment reasons (`POST /api/pharmacy/medicine-inventory/adjustments`). | 'Adjust Stock' action button; Reason dropdown (DAMAGED, EXPIRED, LOSS, FOUND, AUDIT_CORRECTION). | `None (Sub-action)` | `POST /api/pharmacy/medicine-inventory/adjustments` | SUPER_ADMIN, PHARMACY_USER |
| 90 | **Pharmacy → Medicine Inventory → EditBatch** | Pharmacy | Medicine Inventory | EditBatch | Correcting batch pricing and expiry dates (`PATCH /api/pharmacy/medicine-inventory/batches/:batchId`). | 'Edit Batch' button in batch details table. | `None (Sub-action)` | `PATCH /api/pharmacy/medicine-inventory/batches/:batchId` | SUPER_ADMIN, PHARMACY_USER |
| 91 | **Pharmacy → Medicine Inventory → ConfigureLowStock** | Pharmacy | Medicine Inventory | ConfigureLowStock | Setting per-medicine minimum safety stock levels (`PATCH /api/pharmacy/medicine-inventory/:id/low-stock-threshold`). | 'Set Low Stock Threshold' button / input field. | `None (Sub-action)` | `PATCH /api/pharmacy/medicine-inventory/:medicineId/low-stock-threshold` | SUPER_ADMIN, PHARMACY_USER |
| 92 | **Pharmacy → Dispensing → View** | Pharmacy | Dispensing | View | Monitoring pending prescriptions from OPD, Emergency, and Inpatient units. | Prescription Queue sidebar link; Dispensing queue table; Prescription items card. | `/pharmacy, /pharmacy/queue, /pharmacy/orders, /pharmacy/dispensing` | `GET /api/pharmacy/dispensings` | SUPER_ADMIN, PHARMACY_USER |
| 93 | **Pharmacy → Dispensing → Edit** | Pharmacy | Dispensing | Edit | Assigning FEFO medicine batches to prescription items (`PUT /api/pharmacy/dispensings/:id`). | Batch selection dropdowns; Quantity input; Generic substitution selector; 'Save Allocation' button. | `None (Sub-action)` | `PUT /api/pharmacy/dispensings/:id` | SUPER_ADMIN, PHARMACY_USER |
| 94 | **Pharmacy → Dispensing → Dispense** | Pharmacy | Dispensing | Dispense | Executing atomic stock decrement and finalizing pharmacy dispensing (`POST /api/pharmacy/dispensings/:id/confirm`). | 'Confirm Dispense' / 'Dispense' button on dispensing modal. | `None (Sub-action)` | `POST /api/pharmacy/dispensings/:id/confirm` | SUPER_ADMIN, PHARMACY_USER |
| 95 | **Pharmacy → Dispensing → Cancel** | Pharmacy | Dispensing | Cancel | Canceling pending dispensing requests with mandatory reason (`POST /api/pharmacy/dispensings/:id/cancel`). | 'Cancel Order' button; Reason modal. | `None (Sub-action)` | `POST /api/pharmacy/dispensings/:id/cancel` | SUPER_ADMIN, PHARMACY_USER |
| 96 | **Pharmacy → Dispensing → Reverse** | Pharmacy | Dispensing | Reverse | Executing atomic stock restoration and transaction reversal (`POST /api/pharmacy/dispensings/:id/reverse`). | 'Reverse Dispense' button; Return reason and quantity verification modal. | `None (Sub-action)` | `POST /api/pharmacy/dispensings/:id/reverse` | SUPER_ADMIN, PHARMACY_USER |
| 97 | **Pharmacy → Dispensing → UpdateStatus** | Pharmacy | Dispensing | UpdateStatus | Signaling medication preparation progress. | Fulfillment status dropdown on dispensing card. | `None (Sub-action)` | `Enforced during intermediate workflow status updates.` | SUPER_ADMIN, PHARMACY_USER |
| 98 | **Admissions → Wards → View** | Admissions | Wards | View | Browsing ward master list and filtering beds by ward category. | Ward list filter tabs; Ward cards; Ward dropdowns. | `/admissions/beds (co-view with Beds)` | `GET /api/admissions/wards` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE |
| 99 | **Admissions → Wards → Create** | Admissions | Wards | Create | Registering new hospital wards (`POST /api/admissions/wards`). | 'Add Ward' primary action button. | `None (Sub-action)` | `POST /api/admissions/wards` | SUPER_ADMIN, ADMINISTRATOR |
| 100 | **Admissions → Wards → Edit** | Admissions | Wards | Edit | Modifying ward master properties (`PATCH /api/admissions/wards/:id`). | 'Edit Ward' button. | `None (Sub-action)` | `PATCH /api/admissions/wards/:id` | SUPER_ADMIN, ADMINISTRATOR |
| 101 | **Admissions → Wards → ChangeStatus** | Admissions | Wards | ChangeStatus | Activating/deactivating ward operations (`PATCH /api/admissions/wards/:id/status`). | Ward active status switch. | `None (Sub-action)` | `PATCH /api/admissions/wards/:id/status` | SUPER_ADMIN, ADMINISTRATOR |
| 102 | **Admissions → Beds → View** | Admissions | Beds | View | Inspecting live bed census, viewing occupied/available/cleaning beds, and checking daily bed charges. | Bed Management sidebar link; Live Bed Board grid; Bed status color badges; Bed detail modal. | `/admissions/beds, /admissions/bed-availability` | `GET /api/admissions/beds` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE |
| 103 | **Admissions → Beds → Create** | Admissions | Beds | Create | Registering new bed numbers and room numbers in wards (`POST /api/admissions/beds`). | 'Add Bed' primary button on Bed Management page. | `None (Sub-action)` | `POST /api/admissions/beds` | SUPER_ADMIN, ADMINISTRATOR |
| 104 | **Admissions → Beds → Edit** | Admissions | Beds | Edit | Updating bed rates and features (`PATCH /api/admissions/beds/:id`). | 'Edit Bed' button in bed action menu. | `None (Sub-action)` | `PATCH /api/admissions/beds/:id` | SUPER_ADMIN, ADMINISTRATOR |
| 105 | **Admissions → Beds → ChangeStatus** | Admissions | Beds | ChangeStatus | Releasing beds from housekeeping cleaning to available status (`PATCH /api/admissions/beds/:id/status`). | 'Mark as Cleaned' button; 'Set Under Maintenance' option in bed context menu. | `None (Sub-action)` | `PATCH /api/admissions/beds/:id/status` | SUPER_ADMIN, ADMINISTRATOR |
| 106 | **Admissions → Admission Policy → View** | Admissions | Admission Policy | View | Inspecting branch admission requirements before admitting patients. | Admission Policy summary card; Required deposit rule banner. | `None (Sub-action)` | `GET /api/admissions/policy` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST |
| 107 | **Admissions → Admission Policy → Edit** | Admissions | Admission Policy | Edit | Configuring branch-level admission and advance deposit policies (`PUT /api/admissions/policy`). | 'Save Admission Policy' primary button. | `None (Sub-action)` | `PUT /api/admissions/policy` | SUPER_ADMIN, ADMINISTRATOR |
| 108 | **Admissions → Bed Holds → View** | Admissions | Bed Holds | View | Checking existing temporary bed reservations. | Bed Hold badge on bed card; Bed Hold details drawer. | `None (Sub-action)` | `Enforced when querying bed hold records.` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST |
| 109 | **Admissions → Bed Holds → Create** | Admissions | Bed Holds | Create | Reserving an available bed for a specific patient for a configurable hold duration (`POST /api/admissions/beds/:id/holds`). | 'Hold Bed' button on Bed card; Hold Bed modal form. | `None (Sub-action)` | `POST /api/admissions/beds/:id/holds` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST |
| 110 | **Admissions → Bed Holds → Release** | Admissions | Bed Holds | Release | Releasing bed holds (`POST /api/admissions/bed-holds/:id/release`). | 'Release Hold' button in bed action menu. | `None (Sub-action)` | `POST /api/admissions/bed-holds/:id/release` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST |
| 111 | **Admissions → Bed Holds → Cancel** | Admissions | Bed Holds | Cancel | Canceling temporary bed holds (`POST /api/admissions/bed-holds/:id/cancel`). | 'Cancel Hold' button; Reason modal. | `None (Sub-action)` | `POST /api/admissions/bed-holds/:id/cancel` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST |
| 112 | **Admissions → Bed Transfers → View** | Admissions | Bed Transfers | View | Tracking patient internal and cross-branch transfer progressions. | Transfer History table; Active transfer badge on inpatient card. | `None (Sub-action)` | `Enforced when querying transfer lists.` | SUPER_ADMIN, ADMINISTRATOR |
| 113 | **Admissions → Bed Transfers → Create** | Admissions | Bed Transfers | Create | Submitting bed transfer requests (`POST /api/admissions/inpatients/:id/transfers`). | 'Transfer Bed' button on inpatient workspace; Transfer Destination modal. | `None (Sub-action)` | `POST /api/admissions/inpatients/:id/transfers` | SUPER_ADMIN, ADMINISTRATOR |
| 114 | **Admissions → Bed Transfers → Complete** | Admissions | Bed Transfers | Complete | Finalizing physical bed transfer (`POST /api/admissions/bed-transfers/:id/complete`). | 'Complete Transfer' / 'Confirm Transfer' action button. | `None (Sub-action)` | `POST /api/admissions/bed-transfers/:id/complete` | SUPER_ADMIN, ADMINISTRATOR |
| 115 | **Admissions → Bed Transfers → Cancel** | Admissions | Bed Transfers | Cancel | Aborting pending transfer requests (`POST /api/admissions/bed-transfers/:id/cancel`). | 'Cancel Transfer' button; Reason modal. | `None (Sub-action)` | `POST /api/admissions/bed-transfers/:id/cancel` | SUPER_ADMIN, ADMINISTRATOR |
| 116 | **Admissions → Bed Transfers → CrossBranch** | Admissions | Bed Transfers | CrossBranch | Authorizing inter-facility transfers between distinct branch databases (`POST /cross-branch-transfers`). | 'Cross-Branch Transfer' toggle switch; Branch destination selector. | `None (Sub-action)` | `POST /api/admissions/inpatients/:id/cross-branch-transfers` | SUPER_ADMIN, ADMINISTRATOR |
| 117 | **Admissions → Inpatient Admissions → View** | Admissions | Inpatient Admissions | View | Monitoring admitted patients, reviewing admission vitals, round notes, and care plans. | Inpatient Workspace sidebar link; Inpatient Census table; Patient Inpatient Chart view. | `/admissions, /admissions/workspace` | `GET /api/admissions/inpatients` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR |
| 118 | **Admissions → Inpatient Admissions → Create** | Admissions | Inpatient Admissions | Create | Recording daily nursing/physician round observations (`POST /round-notes`) and bedside vitals (`POST /vitals`). | 'Add Round Note' button; 'Record Vitals' button on Inpatient Chart. | `None (Sub-action)` | `POST /api/admissions/inpatients/:id/round-notes` | SUPER_ADMIN, ADMINISTRATOR |
| 119 | **Admissions → Inpatient Admissions → Edit** | Admissions | Inpatient Admissions | Edit | Drafting and saving medical discharge summaries (`POST /api/admissions/inpatients/:id/discharge-summary`). | 'Save Discharge Summary' button on Inpatient chart. | `None (Sub-action)` | `POST /api/admissions/inpatients/:id/discharge-summary` | SUPER_ADMIN, ADMINISTRATOR, CLINICIAN_NURSE, DOCTOR |
| 120 | **Admissions → Inpatient Admissions → Discharge** | Admissions | Inpatient Admissions | Discharge | Executing medical discharge authorization (`POST /api/admissions/inpatients/:id/finalize-discharge`). | 'Finalize Discharge' / 'Discharge Patient' button; Discharge confirmation dialog. | `None (Sub-action)` | `POST /api/admissions/inpatients/:id/finalize-discharge` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 121 | **Admissions → Admission Recommendations → View** | Admissions | Admission Recommendations | View | Inspecting recommended admissions. | Admission Recommendation badge/card. | `None (Sub-action)` | `Implicitly queried in admission request feeds.` | SUPER_ADMIN, DOCTOR |
| 122 | **Admissions → Admission Recommendations → Create** | Admissions | Admission Recommendations | Create | Submitting physician admission recommendations (`POST /api/admissions/recommendations`). | 'Recommend Admission' button on consultation workspace; Provisional diagnosis & ward recommendation form. | `None (Sub-action)` | `POST /api/admissions/recommendations` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 123 | **Admissions → Admission Recommendations → Cancel** | Admissions | Admission Recommendations | Cancel | Canceling admission recommendations if patient condition improves. | 'Cancel Recommendation' button in Doctor workspace. | `None (Sub-action)` | `Enforced in recommendation cancellation handlers.` | SUPER_ADMIN, DOCTOR |
| 124 | **Admissions → Admission Requests → View** | Admissions | Admission Requests | View | Monitoring incoming requests from OPD/Emergency/External for bed allotment and admission processing. | Admission Requests sidebar link; Request queue table; Request Status stats cards. | `/admissions/inpatients, /admissions/requests` | `GET /api/admissions/requests` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE |
| 125 | **Admissions → Admission Requests → Create** | Admissions | Admission Requests | Create | Registering admission requests for walk-in or referred patients (`POST /api/admissions/requests`). | 'New Admission Request' primary button; Request form modal. | `None (Sub-action)` | `POST /api/admissions/requests` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST |
| 126 | **Admissions → Admission Requests → Validate** | Admissions | Admission Requests | Validate | Transitioning request from PENDING -> VALIDATED (`PATCH /api/admissions/requests/:id/validate`). | 'Validate' button in request table; Validate Request modal with checklist. | `None (Sub-action)` | `PATCH /api/admissions/requests/:id/validate` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST |
| 127 | **Admissions → Admission Requests → Confirm** | Admissions | Admission Requests | Confirm | Admitting patient to bed (`POST /api/admissions/requests/:id/confirm`). | 'Confirm Admission' / 'Admit' primary action button. | `None (Sub-action)` | `POST /api/admissions/requests/:id/confirm` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST |
| 128 | **Admissions → Admission Requests → Cancel** | Admissions | Admission Requests | Cancel | Canceling admission requests with mandatory audit reason (`POST /api/admissions/requests/:id/cancel`). | 'Cancel Request' button; Reason modal. | `None (Sub-action)` | `POST /api/admissions/requests/:id/cancel` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST |
| 129 | **Surgery → Recommendations → View** | Surgery | Recommendations | View | Reviewing recommended procedures and scheduling theater slots. | Surgery & Procedures sidebar link (any-permission gate); Recommendations tab. | `/surgery, /surgery/recommendations` | `GET /api/surgery/recommendations` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR |
| 130 | **Surgery → Recommendations → Create** | Surgery | Recommendations | Create | Submitting surgical recommendations (`POST /api/surgery/recommendations`). | 'Recommend Surgery' button on consultation; Procedure selection modal. | `None (Sub-action)` | `POST /api/surgery/recommendations` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 131 | **Surgery → Recommendations → Cancel** | Surgery | Recommendations | Cancel | Canceling surgery recommendations with mandatory reason (`POST /api/surgery/recommendations/:id/cancel`). | 'Cancel Recommendation' button; Reason dialog. | `None (Sub-action)` | `POST /api/surgery/recommendations/:id/cancel` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 132 | **Surgery → Bookings → View** | Surgery | Bookings | View | Monitoring OT bookings and procedure timelines. | Bookings tab; Surgery booking list table; Booking detail modal. | `/surgery, /surgery/bookings` | `GET /api/surgery/bookings` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR |
| 133 | **Surgery → Bookings → Create** | Surgery | Bookings | Create | Reserving OT theater time slots (`POST /api/surgery/bookings`). | 'Book Slot' button; Surgery Booking modal with theater & timing pickers. | `None (Sub-action)` | `POST /api/surgery/bookings` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR |
| 134 | **Surgery → Bookings → Confirm** | Surgery | Bookings | Confirm | Transitioning booking status from REQUESTED -> CONFIRMED (`POST /api/surgery/bookings/:id/confirm`). | 'Confirm Booking' action button in bookings table. | `None (Sub-action)` | `POST /api/surgery/bookings/:id/confirm` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR |
| 135 | **Surgery → Bookings → Reschedule** | Surgery | Bookings | Reschedule | Updating OT slot reservation timings (`POST /api/surgery/bookings/:id/reschedule`). | 'Reschedule' button in booking actions; Reschedule Surgery modal. | `None (Sub-action)` | `POST /api/surgery/bookings/:id/reschedule` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR |
| 136 | **Surgery → Bookings → Cancel** | Surgery | Bookings | Cancel | Canceling booked surgeries with mandatory cancellation reason (`POST /api/surgery/bookings/:id/cancel`). | 'Cancel Booking' button; Reason modal. | `None (Sub-action)` | `POST /api/surgery/bookings/:id/cancel` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR |
| 137 | **Surgery → Bookings → Complete** | Surgery | Bookings | Complete | Finalizing surgical procedures and releasing OT room (`POST /api/surgery/bookings/:id/complete`). | 'Complete Surgery' / 'Mark Completed' primary action button. | `None (Sub-action)` | `POST /api/surgery/bookings/:id/complete` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 138 | **Surgery → Schedule → View** | Surgery | Schedule | View | Inspecting OT theater occupancy and calculating alternative open slots (`GET /api/surgery/availability/alternatives`). | Schedule tab; Theater timeline grid; Slot alternatives helper. | `/surgery, /surgery/schedule` | `GET /api/surgery/schedule` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR |
| 139 | **Emergency → Encounters → View** | Emergency | Encounters | View | Monitoring active emergency census, triage priority badges, and attending doctor assignments. | Emergency Dashboard sidebar link; Emergency Queue sidebar link; Emergency table; Emergency case cards. | `/emergency, /emergency/queue, /emergency/workspace` | `GET /api/emergency/encounters` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR |
| 140 | **Emergency → Encounters → Register** | Emergency | Encounters | Register | Registering emergency encounters with chief complaint, arrival mode, and temporary identity (`POST /api/emergency/encounters`). | 'Register Emergency Patient' / 'New Arrival' primary button; Emergency intake modal. | `None (Sub-action)` | `POST /api/emergency/encounters` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST |
| 141 | **Emergency → Encounters → Edit** | Emergency | Encounters | Edit | Updating emergency demographic/arrival info. | 'Edit Encounter' button. | `None (Sub-action)` | `Enforced in encounter updating handlers.` | SUPER_ADMIN, ADMINISTRATOR |
| 142 | **Emergency → Triage → View** | Emergency | Triage | View | Inspecting triage severity and physiological parameters. | Triage severity badge (Red/Orange/Yellow/Green/Blue); Triage history card. | `None (Sub-action)` | `Checked when fetching triage detail in GET /api/emergency/encounters/:id (redacts triage if missing).` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR |
| 143 | **Emergency → Triage → Assess** | Emergency | Triage | Assess | Nursing triage: scoring patient acuity (`POST /api/emergency/encounters/:id/triage`). | 'Perform Triage' / 'Triage Patient' action button in Emergency queue; Triage assessment form. | `None (Sub-action)` | `POST /api/emergency/encounters/:id/triage` | SUPER_ADMIN, ADMINISTRATOR, CLINICIAN_NURSE |
| 144 | **Emergency → Triage → OverridePriority** | Emergency | Triage | OverridePriority | Elevating or lowering triage category due to clinical deterioration or re-evaluation (`POST /api/emergency/encounters/:id/override-priority`). | 'Override Priority' button; Priority selector & mandatory clinical rationale input. | `None (Sub-action)` | `POST /api/emergency/encounters/:id/override-priority` | SUPER_ADMIN, ADMINISTRATOR |
| 145 | **Emergency → Consultation → View** | Emergency | Consultation | View | Reviewing physician emergency evaluation. | Emergency Consultation card. | `None (Sub-action)` | `Checked in GET /api/emergency/encounters/:id (redacts consultation if missing).` | SUPER_ADMIN, ADMINISTRATOR, CLINICIAN_NURSE, DOCTOR |
| 146 | **Emergency → Consultation → Edit** | Emergency | Consultation | Edit | Doctor emergency intake (`POST /call`, `POST /skip`, `PUT /consultation`). | 'Call Patient' button; 'Save Consultation' button on Emergency doctor evaluation form. | `None (Sub-action)` | `POST /api/emergency/encounters/:id/call` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 147 | **Emergency → Orders → View** | Emergency | Orders | View | Reviewing emergency doctor orders to administer medications or prepare tests. | Emergency Orders list table; Order status badges. | `None (Sub-action)` | `Checked in GET /api/emergency/encounters/:id (redacts orders to empty array if missing).` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 148 | **Emergency → Orders → Create** | Emergency | Orders | Create | Placing urgent diagnostic and pharmaceutical orders (`POST /api/emergency/encounters/:id/orders`). | 'Add Order' button; STAT order builder modal. | `None (Sub-action)` | `POST /api/emergency/encounters/:id/orders` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 149 | **Emergency → Disposition → View** | Emergency | Disposition | View | Checking patient discharge/transfer status. | Disposition status banner; Disposition summary drawer. | `None (Sub-action)` | `Checked in GET /api/emergency/encounters/:id (redacts disposition if missing).` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 150 | **Emergency → Disposition → Discharge** | Emergency | Disposition | Discharge | Finalizing emergency discharge (`POST /api/emergency/encounters/:id/disposition` with `decision: 'DISCHARGE'`). | 'Discharge' button in Emergency disposition action bar. | `None (Sub-action)` | `Checked inside dispositionPermission guard in POST /api/emergency/encounters/:id/disposition` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 151 | **Emergency → Disposition → Transfer** | Emergency | Disposition | Transfer | Executing inter-hospital emergency transfers (`POST /disposition` with `decision: 'TRANSFER'`). | 'Transfer to External Facility' button; Facility destination modal. | `None (Sub-action)` | `Checked inside dispositionPermission guard in POST /api/emergency/encounters/:id/disposition` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 152 | **Emergency → Disposition → ConvertToIP** | Emergency | Disposition | ConvertToIP | Triggering Emergency-to-IP conversion workflow (`POST /disposition` with `decision: 'ADMIT'`). | 'Admit as Inpatient' primary action button; Inpatient admission request pre-fill modal. | `None (Sub-action)` | `Checked inside dispositionPermission guard in POST /api/emergency/encounters/:id/disposition` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 153 | **Emergency → Disposition → MarkLeft** | Emergency | Disposition | MarkLeft | Documenting uncompleted visits when patient leaves without clinical discharge (`POST /api/emergency/encounters/:id/left`). | 'Mark as Left' / 'LAMA' button; Reason modal. | `None (Sub-action)` | `POST /api/emergency/encounters/:id/left` | SUPER_ADMIN, ADMINISTRATOR, DOCTOR |
| 154 | **Emergency → Disposition → MarkNoShow** | Emergency | Disposition | MarkNoShow | Canceling emergency cases where patient was registered but never presented (`POST /api/emergency/encounters/:id/no-show`). | 'No-Show' button in Emergency Queue. | `None (Sub-action)` | `POST /api/emergency/encounters/:id/no-show` | SUPER_ADMIN, ADMINISTRATOR |
| 155 | **Emergency → Disposition → Cancel** | Emergency | Disposition | Cancel | Voiding emergency encounter records (`POST /api/emergency/encounters/:id/cancel`). | 'Cancel Encounter' button; Reason modal. | `None (Sub-action)` | `POST /api/emergency/encounters/:id/cancel` | SUPER_ADMIN, ADMINISTRATOR |
| 156 | **Emergency → Patient Linking → Link** | Emergency | Patient Linking | Link | Merging emergency encounter records once identity is established (`POST /api/emergency/encounters/:id/link-patient`). | 'Link Patient Identity' button; Patient Master Search modal. | `None (Sub-action)` | `POST /api/emergency/encounters/:id/link-patient` | SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR |
| 157 | **Emergency → Patient Linking → Correct** | Emergency | Patient Linking | Correct | Remapping an encounter that was incorrectly linked to the wrong MRN (`POST /api/emergency/encounters/:id/correct-patient`). | 'Correct Link' button; Override confirmation dialog. | `None (Sub-action)` | `POST /api/emergency/encounters/:id/correct-patient` | SUPER_ADMIN, ADMINISTRATOR |
| 158 | **Laboratory → Orders → View** | Laboratory | Orders | View | Accessing lab work queue, filtering tests by priority (STAT/Routine), and reviewing test summaries. | Laboratory Work Queue sidebar link; Lab order table; Lab Summary statistics tiles; Test detail view. | `/laboratory, /laboratory/queue, /laboratory/workspace, /laboratory/reports, /laboratory/results` | `GET /api/laboratory/orders` | SUPER_ADMIN, LABORATORY_USER |
| 159 | **Laboratory → Orders → Edit** | Laboratory | Orders | Edit | Advancing laboratory specimen processing stages (`PATCH /api/laboratory/orders/:id/status`). | 'Collect Sample' button; 'Start Test' button; 'Reject Specimen' modal. | `None (Sub-action)` | `PATCH /api/laboratory/orders/:id/status (checked when status !== 'VERIFIED')` | SUPER_ADMIN, LABORATORY_USER |
| 160 | **Laboratory → Orders → EnterResult** | Laboratory | Orders | EnterResult | Drafting and saving lab investigation findings (`POST /api/laboratory/orders/:id/results`, `PATCH /api/laboratory/orders/:id/results`). | 'Enter Results' button in queue; Result input fields; 'Save Draft' button in Results modal. | `None (Sub-action)` | `POST /api/laboratory/orders/:id/results` | SUPER_ADMIN, LABORATORY_USER |
| 161 | **Laboratory → Orders → VerifyResult** | Laboratory | Orders | VerifyResult | Transitioning laboratory order to `VERIFIED` status (`PATCH /api/laboratory/orders/:id/status` with `status: 'VERIFIED'`). | 'Verify Result' / 'Approve & Release' button on Results Workspace. | `None (Sub-action)` | `PATCH /api/laboratory/orders/:id/status (checked when status === 'VERIFIED')` | SUPER_ADMIN, LABORATORY_USER |
| 162 | **Imaging → Orders → View** | Imaging | Orders | View | Monitoring pending radiology orders, reviewing image scans, and inspecting diagnostic impressions. | Imaging Work Queue sidebar link; Imaging orders table; Study detail modal; Summary statistics cards. | `/imaging, /imaging/queue, /imaging/workspace, /imaging/reports` | `GET /api/imaging/orders` | SUPER_ADMIN, IMAGING_USER |
| 163 | **Imaging → Orders → Edit** | Imaging | Orders | Edit | Advancing radiological scan execution stages (`PATCH /api/imaging/orders/:id/status`). | 'Start Scan' button; 'Complete Scan' button; 'Cancel Order' button. | `None (Sub-action)` | `PATCH /api/imaging/orders/:id/status (checked when status !== 'VERIFIED')` | SUPER_ADMIN, IMAGING_USER |
| 164 | **Imaging → Orders → EnterReport** | Imaging | Orders | EnterReport | Drafting radiological findings, impressions, and recommendations (`POST /api/imaging/orders/:id/report`, `PATCH /api/imaging/orders/:id/report`). | 'Enter Report' button in queue; Radiology report editor; Image attachment upload zone; 'Save Draft' button. | `None (Sub-action)` | `POST /api/imaging/orders/:id/report` | SUPER_ADMIN, IMAGING_USER |
| 165 | **Imaging → Orders → VerifyReport** | Imaging | Orders | VerifyReport | Transitioning imaging order to `VERIFIED` status (`PATCH /api/imaging/orders/:id/status` with `status: 'VERIFIED'`). | 'Verify Report' / 'Sign Off' button on Reports Workspace. | `None (Sub-action)` | `PATCH /api/imaging/orders/:id/status (checked when status === 'VERIFIED')` | SUPER_ADMIN, IMAGING_USER |
| 166 | **Billing → Invoices → View** | Billing | Invoices | View | Reviewing patient billing records, checking advance deposits, and inspecting financial transaction summaries. | Billing Workspace sidebar link; Billing History sidebar link; Invoice list table; Revenue metrics cards. | `/billing, /billing/workspace, /billing/history` | `GET /api/billing/invoices` | SUPER_ADMIN, BILLING_AUTHORIZED |
| 167 | **Billing → Invoices → Create** | Billing | Invoices | Create | Submitting new invoice creation with itemized service charges (`POST /api/billing/invoices`). | 'Generate Invoice' / 'New Bill' button; Service line item builder; 'Create Invoice' button. | `None (Sub-action)` | `POST /api/billing/invoices` | SUPER_ADMIN, BILLING_AUTHORIZED |
| 168 | **Billing → Invoices → Edit** | Billing | Invoices | Edit | Modifying invoice amounts, adding line items, associating invoices to admissions/procedures (`PATCH /api/billing/invoices/:id`, `PATCH /admission-context`, `POST /api/advance-payments/sync`). | 'Edit Invoice' button; 'Link Admission' button; Discount input field; 'Update Invoice' button. | `None (Sub-action)` | `PATCH /api/billing/invoices/:id` | SUPER_ADMIN, BILLING_AUTHORIZED |
| 169 | **Billing → Invoices → Cancel** | Billing | Invoices | Cancel | Canceling invoices (`POST /api/billing/invoices/:id/cancel`). | 'Cancel Invoice' button; Cancellation Reason modal dialog. | `None (Sub-action)` | `POST /api/billing/invoices/:id/cancel` | SUPER_ADMIN, BILLING_AUTHORIZED |
| 170 | **Billing → Invoices → CollectPayment** | Billing | Invoices | CollectPayment | Recording payments, settling invoice balances, and generating transaction logs (`POST /api/billing/invoices/:id/payments`). | 'Collect Payment' primary button; Payment method selector; Amount input; Tender confirmation button. | `None (Sub-action)` | `POST /api/billing/invoices/:id/payments` | SUPER_ADMIN, BILLING_AUTHORIZED |
| 171 | **Billing → Invoices → ViewReceipt** | Billing | Invoices | ViewReceipt | Rendering formal patient payment receipts and transaction vouchers (`GET /api/billing/payments/:id/receipt`). | 'View Receipt' / 'Print Receipt' button; Receipt modal with print layout. | `None (Sub-action)` | `GET /api/billing/payments/:id/receipt` | SUPER_ADMIN, BILLING_AUTHORIZED |
| 172 | **Reports → Phase 2 Reports → View** | Reports | Phase 2 Reports | View | Generating and reviewing hospital performance and revenue analytics (`GET /api/reports/phase-2`). | Reports sidebar link; Report Library list; Report filter controls; Export Report button. | `/reports/library` | `GET /api/reports/phase-2` | SUPER_ADMIN, BILLING_AUTHORIZED |

---

## 4. Detailed Permission Breakdown

This section documents the end-to-end trace for every single permission in the HMS catalog.

### 1. Administration → Dashboard → View
- **Permission Code:** `ADMINISTRATION_DASHBOARD_VIEW`
- **Display Name:** View Dashboard
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Dashboard
- **Action:** View

**What it means:**
Allows viewing the executive administrative overview dashboard, KPI summary tiles, and system operational statistics.

**Where it is used:**
Administration Dashboard page (`AdministrationDashboardPage.tsx`), Overview statistics cards, and Admin sidebar module.

**Actual Usage:**
Accessing administrative overview, inspecting total branch count, active user count, department count, and system health status.

**UI Behavior & Elements:**
Administration sidebar menu item; KPI Metric Cards (Total Users, Branches, Departments, Services); System Health indicators.

**Route Protection:**
`/administration`

**Backend Endpoint & Guard:**
`GET /api/admin/dashboard, GET /api/admin/system-stats`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Route /administration redirects to Access Denied; API endpoints reject requests with 403 PERMISSION_REQUIRED.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Direct entry point for administrative metrics.

---

### 2. Administration → Users → View
- **Permission Code:** `ADMINISTRATION_USERS_VIEW`
- **Display Name:** View Users
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Users
- **Action:** View

**What it means:**
Allows viewing the staff user directory, user list, user profiles, and assignment scopes.

**Where it is used:**
User Management page (`UserManagementPage.tsx`), staff selector dropdowns, and user summary counts.

**Actual Usage:**
Browsing staff accounts, filtering users by branch/role/department, and viewing user account metadata.

**UI Behavior & Elements:**
User Management sidebar link; User directory table; Search and filter controls; User detail drawer.

**Route Protection:**
`/administration/users`

**Backend Endpoint & Guard:**
`GET /api/users, GET /api/users/summary, GET /api/users/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Route /administration/users is inaccessible; User list API requests return 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Standard read permission for user administration.

---

### 3. Administration → Users → Create
- **Permission Code:** `ADMINISTRATION_USERS_CREATE`
- **Display Name:** Create Users
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Users
- **Action:** Create

**What it means:**
Allows creating new staff user accounts with employee codes, credentials, and initial branch/department assignments.

**Where it is used:**
User Management page -> Add User modal dialog.

**Actual Usage:**
Submitting new staff user creation form.

**UI Behavior & Elements:**
'Add User' primary button on User Management page; New User submission modal.

**Route Protection:**
`Not directly route-gated (page requires View)`

**Backend Endpoint & Guard:**
`POST /api/users`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Add User button is hidden or disabled; POST /api/users is rejected with 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Branch scope checks prevent assigning branches outside the creator's authority.

---

### 4. Administration → Users → Edit
- **Permission Code:** `ADMINISTRATION_USERS_EDIT`
- **Display Name:** Edit Users
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Users
- **Action:** Edit

**What it means:**
Allows modifying existing user account profiles, contact details, job titles, and active/inactive status.

**Where it is used:**
User Management table row actions -> Edit User modal, Status toggle.

**Actual Usage:**
Updating staff user profiles, changing assigned branches/departments, locking/unlocking user accounts.

**UI Behavior & Elements:**
'Edit' action icon in User table row; 'Status' dropdown toggle (Active/Inactive/Locked).

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/users/:id, PATCH /api/users/:id/status`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Edit and status actions are disabled/hidden; PATCH requests return 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Privilege escalation checks prevent modifying users with equal or higher authority.

---

### 5. Administration → Users → ChangePassword
- **Permission Code:** `ADMINISTRATION_USERS_CHANGE_PASSWORD`
- **Display Name:** Change Password
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Users
- **Action:** ChangePassword

**What it means:**
Allows updating account passwords for staff members.

**Where it is used:**
User Management row action -> Change Password modal.

**Actual Usage:**
Setting a new password when current password credentials are verified.

**UI Behavior & Elements:**
'Change Password' option in user action menu.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/users/:id/change-password`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Change Password action is hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 6. Administration → Users → ResetPassword
- **Permission Code:** `ADMINISTRATION_USERS_RESET_PASSWORD`
- **Display Name:** Reset Password
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Users
- **Action:** ResetPassword

**What it means:**
Allows administrative forced password reset for staff accounts without providing the current password.

**Where it is used:**
User Management row action -> Reset Password confirmation modal.

**Actual Usage:**
Admin recovering locked-out staff accounts and assigning temporary credentials.

**UI Behavior & Elements:**
'Reset Password' button in user action menu.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/users/:id/reset-password`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Reset Password action is hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 7. Administration → Users → Delete
- **Permission Code:** `ADMINISTRATION_USERS_DELETE`
- **Display Name:** Delete Users
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Users
- **Action:** Delete

**What it means:**
Allows soft-deleting staff user records.

**Where it is used:**
User Management row action menu -> Delete User confirmation dialog.

**Actual Usage:**
Permanently deactivating/decommissioning departed staff accounts.

**UI Behavior & Elements:**
'Delete User' option in context menu.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`DELETE /api/users/:id`

**Current Seeded Roles:**
SUPER_ADMIN

**Without Permission Behavior:**
Delete option is hidden in UI; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Currently seeded only for SUPER_ADMIN to prevent accidental bulk deletions.

---

### 8. Administration → Users → Export
- **Permission Code:** `ADMINISTRATION_USERS_EXPORT`
- **Display Name:** Export Users
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Users
- **Action:** Export

**What it means:**
Allows exporting the user directory to downloadable CSV format.

**Where it is used:**
User Management page header action bar.

**Actual Usage:**
Downloading CSV reports of staff users.

**UI Behavior & Elements:**
'Export CSV' button on User Management page.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/users/export`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Export button is hidden; GET /api/users/export returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 9. Administration → Roles → View
- **Permission Code:** `ADMINISTRATION_ROLES_VIEW`
- **Display Name:** View Roles
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Roles
- **Action:** View

**What it means:**
Allows viewing defined system and custom roles, role codes, assigned user counts, and role audit logs.

**Where it is used:**
Roles & Permissions page (`RolesPermissionsPage.tsx`), Roles list tab.

**Actual Usage:**
Inspecting role list, viewing role user assignments, and reviewing role change audit history.

**UI Behavior & Elements:**
Roles & Permissions sidebar link (co-required with Permissions View); Roles list tab; Role Detail card.

**Route Protection:**
`/administration/roles-permissions`

**Backend Endpoint & Guard:**
`GET /api/roles, GET /api/roles/:id, GET /api/roles/:id/audit-logs`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Roles list is hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Route /administration/roles-permissions requires both Roles View and Permissions View.

---

### 10. Administration → Roles → Create
- **Permission Code:** `ADMINISTRATION_ROLES_CREATE`
- **Display Name:** Create Roles
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Roles
- **Action:** Create

**What it means:**
Allows creating new custom organizational roles.

**Where it is used:**
Roles & Permissions page -> Add Role button & modal.

**Actual Usage:**
Registering new custom role names, codes, and color badges.

**UI Behavior & Elements:**
'Add Role' button on Roles tab; Create Role modal dialog.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/roles`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Add Role button is hidden; POST /api/roles returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 11. Administration → Roles → Edit
- **Permission Code:** `ADMINISTRATION_ROLES_EDIT`
- **Display Name:** Edit Roles
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Roles
- **Action:** Edit

**What it means:**
Allows editing custom role metadata (name, description, color, active/inactive status).

**Where it is used:**
Roles & Permissions page -> Edit Role modal, Status toggle.

**Actual Usage:**
Updating role display details and changing role status.

**UI Behavior & Elements:**
'Edit Role' button; Role status switch.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/roles/:id, PATCH /api/roles/:id/status`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Edit role options are hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
System roles cannot have their code or type edited.

---

### 12. Administration → Roles → Assign
- **Permission Code:** `ADMINISTRATION_ROLES_ASSIGN`
- **Display Name:** Assign Roles
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Roles
- **Action:** Assign

**What it means:**
Allows assigning or removing users to/from specific roles.

**Where it is used:**
Roles & Permissions page -> 'Assign Users' modal; User Management -> Role picker dropdown.

**Actual Usage:**
Mapping staff users to roles (`POST /api/roles/:id/users`, `DELETE /api/roles/:id/users/:userId`).

**UI Behavior & Elements:**
'Assign User' button in Role Detail; Role checkboxes in User form.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/roles/:id/users, DELETE /api/roles/:id/users/:userId`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Role assignment controls are hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Escalation checks prevent assigning roles with privileges exceeding the actor's authority.

---

### 13. Administration → Roles → Delete
- **Permission Code:** `ADMINISTRATION_ROLES_DELETE`
- **Display Name:** Delete Roles
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Roles
- **Action:** Delete

**What it means:**
Allows deleting custom roles that have 0 assigned users.

**Where it is used:**
Roles & Permissions page -> Delete Role button.

**Actual Usage:**
Removing obsolete custom roles.

**UI Behavior & Elements:**
'Delete Role' trash icon button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`DELETE /api/roles/:id`

**Current Seeded Roles:**
SUPER_ADMIN

**Without Permission Behavior:**
Delete button is hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
System roles cannot be deleted.

---

### 14. Administration → Permissions → View
- **Permission Code:** `ADMINISTRATION_PERMISSIONS_VIEW`
- **Display Name:** View Permissions
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Permissions
- **Action:** View

**What it means:**
Allows viewing the master permission catalog, permission categories, groups, and assigned roles.

**Where it is used:**
Roles & Permissions workspace -> Permissions Matrix tab.

**Actual Usage:**
Inspecting permission definitions, filtering permissions by module/group, and viewing role permissions.

**UI Behavior & Elements:**
Permissions matrix tab; Permission Detail drawer; Role-Permission checklist.

**Route Protection:**
`/administration/roles-permissions`

**Backend Endpoint & Guard:**
`GET /api/permissions, GET /api/permissions/:id, GET /api/permissions/:id/roles, GET /api/roles/:id/permissions`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Permissions tab is hidden/inaccessible; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 15. Administration → Permissions → Create
- **Permission Code:** `ADMINISTRATION_PERMISSIONS_CREATE`
- **Display Name:** Create Permissions
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Permissions
- **Action:** Create

**What it means:**
Allows creating new custom permission entries in the catalog.

**Where it is used:**
Roles & Permissions page -> Custom Permission dialog.

**Actual Usage:**
Adding new custom permissions to extensible modules.

**UI Behavior & Elements:**
'Add Custom Permission' button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/permissions`

**Current Seeded Roles:**
SUPER_ADMIN

**Without Permission Behavior:**
Add Permission button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
System permissions cannot be created dynamically.

---

### 16. Administration → Permissions → Edit
- **Permission Code:** `ADMINISTRATION_PERMISSIONS_EDIT`
- **Display Name:** Edit Permissions
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Permissions
- **Action:** Edit

**What it means:**
Allows updating custom permission metadata and descriptions.

**Where it is used:**
Roles & Permissions page -> Edit Permission modal.

**Actual Usage:**
Modifying custom permission names and descriptions.

**UI Behavior & Elements:**
'Edit' button on custom permission card.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/permissions/:id`

**Current Seeded Roles:**
SUPER_ADMIN

**Without Permission Behavior:**
Edit button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
System permission code/status/type cannot be modified.

---

### 17. Administration → Permissions → Assign
- **Permission Code:** `ADMINISTRATION_PERMISSIONS_ASSIGN`
- **Display Name:** Assign Permissions
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Permissions
- **Action:** Assign

**What it means:**
Allows configuring and replacing the permission set assigned to any role.

**Where it is used:**
Roles & Permissions page -> Role Permissions editor -> 'Save Permissions' action.

**Actual Usage:**
Saving role permission matrix modifications (`PUT /api/roles/:id/permissions`).

**UI Behavior & Elements:**
'Save Changes' / 'Save Permissions' button on Permission Matrix workspace.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PUT /api/roles/:id/permissions`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Permission checkboxes are read-only; Save button is disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Enforces optimistic locking (expectedRoleUpdatedAt) and escalation prevention.

---

### 18. Administration → Permissions → Delete
- **Permission Code:** `ADMINISTRATION_PERMISSIONS_DELETE`
- **Display Name:** Delete Permissions
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Permissions
- **Action:** Delete

**What it means:**
Allows deleting inactive custom permissions that are not assigned to any role.

**Where it is used:**
Roles & Permissions page -> Delete Custom Permission dialog.

**Actual Usage:**
Removing obsolete custom permissions.

**UI Behavior & Elements:**
'Delete Permission' button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`DELETE /api/permissions/:id`

**Current Seeded Roles:**
SUPER_ADMIN

**Without Permission Behavior:**
Delete option hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
System permissions cannot be deleted.

---

### 19. Administration → Branches → View
- **Permission Code:** `ADMINISTRATION_BRANCHES_VIEW`
- **Display Name:** View Branches
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Branches
- **Action:** View

**What it means:**
Allows viewing hospital branch records, branch facilities, codes, and operational status.

**Where it is used:**
Branch Management page (`BranchManagementPage.tsx`), global branch switcher, appointment/admission branch selectors.

**Actual Usage:**
Listing hospital branches and populating branch dropdowns across the HMS.

**UI Behavior & Elements:**
Branch Management sidebar link; Branch list table; Branch Switcher in top bar.

**Route Protection:**
`/administration/branches`

**Backend Endpoint & Guard:**
`GET /api/branches, GET /api/branches/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Branch Management page is inaccessible; Direct API requests return 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Used widely across frontend feature hooks to load authorized branch options.

---

### 20. Administration → Branches → Create
- **Permission Code:** `ADMINISTRATION_BRANCHES_CREATE`
- **Display Name:** Create Branches
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Branches
- **Action:** Create

**What it means:**
Allows adding new hospital branch entities.

**Where it is used:**
Branch Management page -> Add Branch modal dialog.

**Actual Usage:**
Submitting new branch registration form (code, name, address, timezone, capacity).

**UI Behavior & Elements:**
'Add Branch' primary action button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/branches`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Add Branch button hidden; POST /api/branches returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 21. Administration → Branches → Edit
- **Permission Code:** `ADMINISTRATION_BRANCHES_EDIT`
- **Display Name:** Edit Branches
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Branches
- **Action:** Edit

**What it means:**
Allows updating branch details, contact information, facilities, and active/inactive status.

**Where it is used:**
Branch Management table row actions -> Edit Branch modal, Status toggle.

**Actual Usage:**
Modifying branch metadata and activating/deactivating branches.

**UI Behavior & Elements:**
'Edit' button in branch table; Branch status switch.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/branches/:id, PATCH /api/branches/:id/status`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Edit options disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 22. Administration → Branches → Delete
- **Permission Code:** `ADMINISTRATION_BRANCHES_DELETE`
- **Display Name:** Delete Branches
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Branches
- **Action:** Delete

**What it means:**
Allows soft-deleting / retiring hospital branch records.

**Where it is used:**
Branch Management row action menu -> Delete Branch dialog.

**Actual Usage:**
Decommissioning closed hospital branches.

**UI Behavior & Elements:**
'Delete Branch' trash icon action.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`DELETE /api/branches/:id`

**Current Seeded Roles:**
SUPER_ADMIN

**Without Permission Behavior:**
Delete option hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 23. Administration → Branches → Export
- **Permission Code:** `ADMINISTRATION_BRANCHES_EXPORT`
- **Display Name:** Export Branches
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Branches
- **Action:** Export

**What it means:**
Allows exporting hospital branch records to CSV.

**Where it is used:**
Branch Management page header action bar.

**Actual Usage:**
Downloading CSV reports of hospital branches.

**UI Behavior & Elements:**
'Export CSV' button on Branch Management page.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/branches/export`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Export button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 24. Administration → Departments → View
- **Permission Code:** `ADMINISTRATION_DEPARTMENTS_VIEW`
- **Display Name:** View Departments
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Departments
- **Action:** View

**What it means:**
Allows viewing hospital departments, specialty classifications, and branch mappings.

**Where it is used:**
Department Management page (`DepartmentManagementPage.tsx`), appointment booking specialty dropdowns, doctor profile.

**Actual Usage:**
Listing clinical/administrative departments and populating department filters.

**UI Behavior & Elements:**
Department Management sidebar link; Department list table; Specialty dropdowns.

**Route Protection:**
`/administration/departments`

**Backend Endpoint & Guard:**
`GET /api/departments, GET /api/departments/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Department Management page is inaccessible; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 25. Administration → Departments → Create
- **Permission Code:** `ADMINISTRATION_DEPARTMENTS_CREATE`
- **Display Name:** Create Departments
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Departments
- **Action:** Create

**What it means:**
Allows creating new clinical or administrative departments.

**Where it is used:**
Department Management page -> Add Department modal dialog.

**Actual Usage:**
Submitting new department creation form (code, name, type, branch associations).

**UI Behavior & Elements:**
'Add Department' primary button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/departments`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Add Department button hidden; POST /api/departments returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 26. Administration → Departments → Edit
- **Permission Code:** `ADMINISTRATION_DEPARTMENTS_EDIT`
- **Display Name:** Edit Departments
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Departments
- **Action:** Edit

**What it means:**
Allows modifying department names, type, head of department, and active status.

**Where it is used:**
Department Management table row actions -> Edit Department modal, Status toggle.

**Actual Usage:**
Updating department metadata and activating/deactivating departments.

**UI Behavior & Elements:**
'Edit' button in department table; Department status switch.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/departments/:id, PATCH /api/departments/:id/status`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Edit options disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 27. Administration → Departments → Delete
- **Permission Code:** `ADMINISTRATION_DEPARTMENTS_DELETE`
- **Display Name:** Delete Departments
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Departments
- **Action:** Delete

**What it means:**
Allows deleting / deactivating obsolete departments.

**Where it is used:**
Department Management row action menu -> Delete Department confirmation.

**Actual Usage:**
Decommissioning closed hospital departments.

**UI Behavior & Elements:**
'Delete Department' trash icon button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`DELETE /api/departments/:id`

**Current Seeded Roles:**
SUPER_ADMIN

**Without Permission Behavior:**
Delete button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 28. Administration → Departments → Export
- **Permission Code:** `ADMINISTRATION_DEPARTMENTS_EXPORT`
- **Display Name:** Export Departments
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Departments
- **Action:** Export

**What it means:**
Allows exporting hospital department records to CSV.

**Where it is used:**
Department Management page header action bar.

**Actual Usage:**
Downloading CSV reports of hospital departments.

**UI Behavior & Elements:**
'Export CSV' button on Department Management page.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/departments/export`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Export button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 29. Administration → Services → View
- **Permission Code:** `ADMINISTRATION_SERVICES_VIEW`
- **Display Name:** View Services
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Services
- **Action:** View

**What it means:**
Allows viewing hospital clinical services, diagnostic tests, procedures, and tariff prices.

**Where it is used:**
Service Catalogue page (`ServiceCataloguePage.tsx`), Billing service line lookup, Lab/Imaging order pickers.

**Actual Usage:**
Browsing service items, looking up standard prices, and verifying test codes.

**UI Behavior & Elements:**
Service Catalogue sidebar link; Service table; Billing service autocomplete.

**Route Protection:**
`/administration/services`

**Backend Endpoint & Guard:**
`GET /api/services, GET /api/services/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, BILLING_AUTHORIZED

**Without Permission Behavior:**
Service Catalogue page inaccessible; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Essential for billing and diagnostic test lookups.

---

### 30. Administration → Services → Create
- **Permission Code:** `ADMINISTRATION_SERVICES_CREATE`
- **Display Name:** Create Services
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Services
- **Action:** Create

**What it means:**
Allows creating new clinical services, procedures, lab tests, and setting prices.

**Where it is used:**
Service Catalogue page -> Add Service modal dialog.

**Actual Usage:**
Adding new tariff items, test types, and charge categories.

**UI Behavior & Elements:**
'Add Service' primary action button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/services`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Add Service button hidden; POST /api/services returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 31. Administration → Services → Edit
- **Permission Code:** `ADMINISTRATION_SERVICES_EDIT`
- **Display Name:** Edit Services
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Services
- **Action:** Edit

**What it means:**
Allows editing service names, codes, pricing tariffs, department links, and status.

**Where it is used:**
Service Catalogue table row actions -> Edit Service modal, Status toggle.

**Actual Usage:**
Updating service pricing, adjusting tariff schedules, and activating/deactivating services.

**UI Behavior & Elements:**
'Edit' button in service table; Service status switch.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/services/:id, PATCH /api/services/:id/status`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Edit actions disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 32. Administration → Services → Delete
- **Permission Code:** `ADMINISTRATION_SERVICES_DELETE`
- **Display Name:** Delete Services
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Services
- **Action:** Delete

**What it means:**
Allows deleting / deactivating obsolete services from the catalog.

**Where it is used:**
Service Catalogue row action menu -> Delete Service confirmation.

**Actual Usage:**
Decommissioning discontinued medical services.

**UI Behavior & Elements:**
'Delete Service' trash icon button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`DELETE /api/services/:id`

**Current Seeded Roles:**
SUPER_ADMIN

**Without Permission Behavior:**
Delete button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 33. Administration → Services → Export
- **Permission Code:** `ADMINISTRATION_SERVICES_EXPORT`
- **Display Name:** Export Services
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Services
- **Action:** Export

**What it means:**
Allows exporting hospital service catalogue and price list to CSV.

**Where it is used:**
Service Catalogue page header action bar.

**Actual Usage:**
Downloading CSV export of hospital tariff schedules.

**UI Behavior & Elements:**
'Export CSV' button on Service Catalogue page.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/services/export`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Export button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 34. Administration → Medicines → View
- **Permission Code:** `ADMINISTRATION_MEDICINES_VIEW`
- **Display Name:** View Medicine Master
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Medicines
- **Action:** View

**What it means:**
Allows viewing central medicine master catalogue, generic names, dosage forms, and manufacturer info.

**Where it is used:**
Medicine Master page (`MedicineMasterPage.tsx`), prescription drug search, pharmacy batch registration.

**Actual Usage:**
Searching formulary medications and inspecting drug specifications.

**UI Behavior & Elements:**
Medicine Master sidebar link; Medicine directory table; Prescription medication search autocomplete.

**Route Protection:**
`/administration/medicines`

**Backend Endpoint & Guard:**
`GET /api/medicines, GET /api/medicines/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Medicine Master page inaccessible; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 35. Administration → Medicines → Create
- **Permission Code:** `ADMINISTRATION_MEDICINES_CREATE`
- **Display Name:** Create Medicine Master
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Medicines
- **Action:** Create

**What it means:**
Allows adding new pharmaceutical drug items into the central hospital formulary.

**Where it is used:**
Medicine Master page -> Add Medicine modal dialog.

**Actual Usage:**
Registering new generic and brand medications in the hospital formulary.

**UI Behavior & Elements:**
'Add Medicine' primary action button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/medicines`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Add Medicine button hidden; POST /api/medicines returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 36. Administration → Medicines → Edit
- **Permission Code:** `ADMINISTRATION_MEDICINES_EDIT`
- **Display Name:** Edit Medicine Master
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Medicines
- **Action:** Edit

**What it means:**
Allows editing medicine master details, dosage strengths, categories, and active/inactive status.

**Where it is used:**
Medicine Master table row actions -> Edit Medicine modal, Status toggle.

**Actual Usage:**
Updating drug formulations and activating/deactivating medications.

**UI Behavior & Elements:**
'Edit' button in medicine table; Medicine status switch.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/medicines/:id, PATCH /api/medicines/:id/status`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Edit options disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 37. Administration → Medicines → Delete
- **Permission Code:** `ADMINISTRATION_MEDICINES_DELETE`
- **Display Name:** Delete Medicine Master
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Medicines
- **Action:** Delete

**What it means:**
Allows soft-deleting / retiring obsolete medicine entries from the formulary.

**Where it is used:**
Medicine Master row action menu -> Delete Medicine confirmation.

**Actual Usage:**
Decommissioning discontinued pharmaceutical products.

**UI Behavior & Elements:**
'Delete Medicine' trash icon button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`DELETE /api/medicines/:id`

**Current Seeded Roles:**
SUPER_ADMIN

**Without Permission Behavior:**
Delete button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 38. Administration → Medicines → Export
- **Permission Code:** `ADMINISTRATION_MEDICINES_EXPORT`
- **Display Name:** Export Medicine Master
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Medicines
- **Action:** Export

**What it means:**
Allows exporting the hospital medicine master formulary to CSV.

**Where it is used:**
Medicine Master page header action bar.

**Actual Usage:**
Downloading CSV export of hospital medicine formulary.

**UI Behavior & Elements:**
'Export CSV' button on Medicine Master page.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/medicines/export`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Export button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 39. Administration → Consent Templates → View
- **Permission Code:** `ADMINISTRATION_CONSENT_TEMPLATES_VIEW`
- **Display Name:** View Consent Templates
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Consent Templates
- **Action:** View

**What it means:**
Allows viewing standardized informed consent templates and legal version histories.

**Where it is used:**
Consent Templates page (`ConsentTemplatesPage.tsx`), Patient consent attachment template pickers.

**Actual Usage:**
Inspecting consent template legal texts and selecting templates during consent signing.

**UI Behavior & Elements:**
Consent Templates sidebar link; Template list cards; Consent Template preview modal.

**Route Protection:**
`/administration/consent-templates`

**Backend Endpoint & Guard:**
`GET /api/consents/templates, GET /api/consents/templates/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Consent Templates page inaccessible; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 40. Administration → Consent Templates → Create
- **Permission Code:** `ADMINISTRATION_CONSENT_TEMPLATES_CREATE`
- **Display Name:** Create Consent Templates
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Consent Templates
- **Action:** Create

**What it means:**
Allows authoring new legal informed consent form templates.

**Where it is used:**
Consent Templates page -> 'Add Template' action.

**Actual Usage:**
Creating standardized consent forms for surgeries, admissions, and procedures.

**UI Behavior & Elements:**
'Add Template' primary button on Consent Templates page.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/consents/templates`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Add Template button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 41. Administration → Consent Templates → Edit
- **Permission Code:** `ADMINISTRATION_CONSENT_TEMPLATES_EDIT`
- **Display Name:** Edit Consent Templates
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Consent Templates
- **Action:** Edit

**What it means:**
Allows updating template body text, versioning consent forms, and activating/deactivating templates.

**Where it is used:**
Consent Templates page -> Edit Template dialog, Status toggle.

**Actual Usage:**
Publishing updated revisions of legal consent templates.

**UI Behavior & Elements:**
'Edit' action button; Version update trigger; Template status switch.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/consents/templates/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Edit buttons disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 42. Administration → Notifications → View
- **Permission Code:** `ADMINISTRATION_NOTIFICATIONS_VIEW`
- **Display Name:** View Notifications
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Notifications
- **Action:** View

**What it means:**
Allows viewing system broadcast notifications and message history.

**Where it is used:**
Top bar notification bell dropdown; Notification center workspace.

**Actual Usage:**
Reviewing system alert history and notification feeds.

**UI Behavior & Elements:**
Notification center panel; System alert bell.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/notifications`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Notification list returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 43. Administration → Notifications → Create
- **Permission Code:** `ADMINISTRATION_NOTIFICATIONS_CREATE`
- **Display Name:** Create Notifications
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Notifications
- **Action:** Create

**What it means:**
Allows dispatching hospital-wide or role-targeted broadcast notifications.

**Where it is used:**
Notification management modal -> Broadcast notification action.

**Actual Usage:**
Publishing system maintenance notices or critical operational announcements.

**UI Behavior & Elements:**
'Send Broadcast' / 'New Notification' button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/notifications`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Send Broadcast button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 44. Administration → Settings → View
- **Permission Code:** `settings.view`
- **Display Name:** View Settings
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Settings
- **Action:** View

**What it means:**
Allows viewing system global configuration settings, hospital branding, currency, and date formats.

**Where it is used:**
System Settings page (`SystemSettingsPage.tsx`).

**Actual Usage:**
Inspecting system operational configurations.

**UI Behavior & Elements:**
System Settings sidebar link; Settings panels and tab navigation.

**Route Protection:**
`/administration/settings`

**Backend Endpoint & Guard:**
`GET /api/settings`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
System Settings page is inaccessible; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Code uses lowercase dot notation `settings.view` in seed.

---

### 45. Administration → Settings → Edit
- **Permission Code:** `settings.edit`
- **Display Name:** Edit Settings
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Settings
- **Action:** Edit

**What it means:**
Allows modifying hospital system parameters, security policies, and organizational settings.

**Where it is used:**
System Settings page -> Save Settings button.

**Actual Usage:**
Updating hospital business settings, session timeouts, and branding configurations.

**UI Behavior & Elements:**
'Save Settings' button on System Settings tabs.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/settings`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Save Settings button is disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Code uses lowercase dot notation `settings.edit`.

---

### 46. Administration → Settings → Export
- **Permission Code:** `settings.export`
- **Display Name:** Export Settings
- **Category:** `SYSTEM` | **Group:** `ADMINISTRATION`
- **Module:** Administration
- **Screen:** Settings
- **Action:** Export

**What it means:**
Allows exporting system settings configuration audits.

**Where it is used:**
System Settings page header action bar.

**Actual Usage:**
Exporting configuration snapshots for audit and disaster recovery.

**UI Behavior & Elements:**
'Export Settings' button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/settings/export`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Export button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Code uses lowercase dot notation `settings.export`.

---

### 47. Patients → Patient Records → View
- **Permission Code:** `PATIENTS_PATIENT_RECORDS_VIEW`
- **Display Name:** View Patient Records
- **Category:** `CLINICAL` | **Group:** `PATIENTS`
- **Module:** Patients
- **Screen:** Patient Records
- **Action:** View

**What it means:**
Allows searching and viewing patient demographic master profiles, contact info, and medical timeline.

**Where it is used:**
Patient Search page (`PatientSearchPage.tsx`), Patient Workspace (`PatientProfilePage.tsx`), OPD/IP lookups.

**Actual Usage:**
Looking up patient records, verifying patient identity, and reviewing comprehensive patient EMR timeline.

**UI Behavior & Elements:**
Patients sidebar link; Search Patients input; Patient list table; 'View Patient' profile link; EMR timeline tab.

**Route Protection:**
`/patients, /patients/search, /patients/profile`

**Backend Endpoint & Guard:**
`GET /api/patients, GET /api/patients/:id, GET /api/patients/:id/history, GET /api/patients/:id/timeline`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR, BILLING_AUTHORIZED

**Without Permission Behavior:**
Patient search and profile pages return Access Denied; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Fundamental clinical and operational read permission.

---

### 48. Patients → Patient Records → Create
- **Permission Code:** `PATIENTS_PATIENT_RECORDS_CREATE`
- **Display Name:** Create Patient Records
- **Category:** `CLINICAL` | **Group:** `PATIENTS`
- **Module:** Patients
- **Screen:** Patient Records
- **Action:** Create

**What it means:**
Allows registering new patients with demographic details, national ID, emergency contacts, and insurance.

**Where it is used:**
Register Patient page (`PatientRegistrationPage.tsx`), Quick registration modals in appointment and OPD queues.

**Actual Usage:**
Submitting new patient registrations to generate unique MRN / UHID identifiers.

**UI Behavior & Elements:**
'Register Patient' sidebar link and primary button; Patient registration form; Save Patient button.

**Route Protection:**
`/patients/register`

**Backend Endpoint & Guard:**
`POST /api/patients`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST

**Without Permission Behavior:**
Route /patients/register is blocked; Registration form cannot be submitted (403 on POST).

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Primary front-desk patient intake authorization.

---

### 49. Patients → Patient Records → Edit
- **Permission Code:** `PATIENTS_PATIENT_RECORDS_EDIT`
- **Display Name:** Edit Patient Records
- **Category:** `CLINICAL` | **Group:** `PATIENTS`
- **Module:** Patients
- **Screen:** Patient Records
- **Action:** Edit

**What it means:**
Allows updating patient demographic profiles, contact numbers, address, insurance policy, and clinical flags.

**Where it is used:**
Patient Workspace -> Edit Demographics modal; Doctor Workspace -> Edit Medical Alerts.

**Actual Usage:**
Updating demographic changes, correcting spelling, and recording chronic medical alerts.

**UI Behavior & Elements:**
'Edit Profile' / 'Edit Patient' button in Patient Workspace header; Save Patient button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/patients/:id`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST, DOCTOR

**Without Permission Behavior:**
Edit Patient button is hidden; PATCH /api/patients/:id is rejected with 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 50. Patients → Patient Documents → View
- **Permission Code:** `PATIENTS_PATIENT_DOCUMENTS_VIEW`
- **Display Name:** View Patient Documents
- **Category:** `CLINICAL` | **Group:** `PATIENTS`
- **Module:** Patients
- **Screen:** Patient Documents
- **Action:** View

**What it means:**
Allows viewing and downloading uploaded patient documents, ID cards, insurance policies, and clinical attachments.

**Where it is used:**
Patient Documents page (`PatientDocumentsPage.tsx`), Patient Workspace -> Documents tab.

**Actual Usage:**
Browsing attached files, previewing documents, and downloading file attachments.

**UI Behavior & Elements:**
Patient Documents tab; Document table; 'Download' icon button; Document preview viewer.

**Route Protection:**
`/patients/documents`

**Backend Endpoint & Guard:**
`GET /api/patients/:id/documents, GET /api/patients/:id/documents/:documentId/download`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Documents tab displays empty/blocked state; Direct download URL returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 51. Patients → Patient Documents → Create
- **Permission Code:** `PATIENTS_PATIENT_DOCUMENTS_CREATE`
- **Display Name:** Create Patient Documents
- **Category:** `CLINICAL` | **Group:** `PATIENTS`
- **Module:** Patients
- **Screen:** Patient Documents
- **Action:** Create

**What it means:**
Allows uploading new documents (IDENTITY, INSURANCE, CLINICAL, OTHER) and scanned paperwork.

**Where it is used:**
Patient Documents page -> 'Upload Document' modal dialog.

**Actual Usage:**
Uploading files to patient medical records via multipart upload (`POST /api/patients/:id/documents/upload`).

**UI Behavior & Elements:**
'Upload Document' button; File dropzone; Document metadata form.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/patients/:id/documents/upload`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Upload button is hidden; Multipart upload endpoint rejects request with 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
When document_type is 'CONSENT', backend additionally requires `Patients -> Consent -> Attach`.

---

### 52. Patients → Patient Documents → Edit
- **Permission Code:** `PATIENTS_PATIENT_DOCUMENTS_EDIT`
- **Display Name:** Edit Patient Documents
- **Category:** `CLINICAL` | **Group:** `PATIENTS`
- **Module:** Patients
- **Screen:** Patient Documents
- **Action:** Edit

**What it means:**
Allows modifying document metadata, replacing document files, and entering document review notes.

**Where it is used:**
Patient Documents page -> Edit Document modal, Document Review modal.

**Actual Usage:**
Replacing an uploaded document file or adding administrative review notes.

**UI Behavior & Elements:**
'Edit Document' button; 'Review Document' button in document row.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PUT /api/patients/:id/documents/:documentId/upload, PATCH /api/patients/:id/documents/:documentId/review`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Edit/Review buttons are hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 53. Patients → Patient Documents → Delete
- **Permission Code:** `PATIENTS_PATIENT_DOCUMENTS_DELETE`
- **Display Name:** Delete Patient Documents
- **Category:** `CLINICAL` | **Group:** `PATIENTS`
- **Module:** Patients
- **Screen:** Patient Documents
- **Action:** Delete

**What it means:**
Allows soft-deleting / removing uploaded patient document files.

**Where it is used:**
Patient Documents page -> Delete Document confirmation dialog.

**Actual Usage:**
Removing erroneously uploaded or duplicate patient files.

**UI Behavior & Elements:**
'Delete Document' trash icon button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`DELETE /api/patients/:id/documents/:documentId`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Delete button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
If the deleted document is a consent form, backend additionally requires `Patients -> Consent -> Delete`.

---

### 54. Patients → Consent → View
- **Permission Code:** `PATIENTS_CONSENT_VIEW`
- **Display Name:** View Consent
- **Category:** `CLINICAL` | **Group:** `PATIENTS`
- **Module:** Patients
- **Screen:** Consent
- **Action:** View

**What it means:**
Allows viewing patient consent status, signed consent attachments, and verification audits.

**Where it is used:**
Patient Consent page (`PatientConsentPage.tsx`), Pre-op checklist, Admission validation modal.

**Actual Usage:**
Checking whether mandatory informed consent has been obtained before surgery or admission.

**UI Behavior & Elements:**
Consent Attachment sidebar link; Consent status badge; Signed consent viewer.

**Route Protection:**
`/patients/consent, /patients/consents`

**Backend Endpoint & Guard:**
`GET /api/patients/:id/documents?document_type=CONSENT`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Consent page is inaccessible; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 55. Patients → Consent → Attach
- **Permission Code:** `PATIENTS_CONSENT_ATTACH`
- **Display Name:** Attach Consent
- **Category:** `CLINICAL` | **Group:** `PATIENTS`
- **Module:** Patients
- **Screen:** Consent
- **Action:** Attach

**What it means:**
Allows attaching signed consent documents, digital signatures, or scanned paper consent forms to patient encounters.

**Where it is used:**
Patient Consent page -> 'Attach Signed Consent' modal; Admission confirmation; Surgery booking.

**Actual Usage:**
Linking signed consent forms to inpatient admissions, surgical procedures, or clinical encounters.

**UI Behavior & Elements:**
'Attach Consent' primary button; Consent file upload form; 'Mark as Signed' checkbox.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/patients/:id/documents/upload (checked when document_type === 'CONSENT')`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Attach Consent button is hidden; Uploading consent returns 403 PERMISSION_REQUIRED.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Dual-guarded: Requires both `Patients -> Patient Documents -> Create` and `Patients -> Consent -> Attach`.

---

### 56. Patients → Consent → Verify
- **Permission Code:** `PATIENTS_CONSENT_VERIFY`
- **Display Name:** Verify Consent
- **Category:** `CLINICAL` | **Group:** `PATIENTS`
- **Module:** Patients
- **Screen:** Consent
- **Action:** Verify

**What it means:**
Allows clinical staff (nurses/doctors) to verify and legally sign off on attached patient consents.

**Where it is used:**
Patient Consent page -> 'Verify Consent' action button; Pre-op anesthesia checklist.

**Actual Usage:**
Transitioning consent status from `ATTACHED` / `SIGNED` to `VERIFIED`.

**UI Behavior & Elements:**
'Verify Consent' button / badge in Consent Management table.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/patients/:id/documents/:documentId/consent/verify`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Verify Consent button is hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Mandatory clinical verification check before major surgical procedures.

---

### 57. Patients → Consent → Delete
- **Permission Code:** `PATIENTS_CONSENT_DELETE`
- **Display Name:** Delete Consent
- **Category:** `CLINICAL` | **Group:** `PATIENTS`
- **Module:** Patients
- **Screen:** Consent
- **Action:** Delete

**What it means:**
Allows revoking / deleting attached consent records.

**Where it is used:**
Patient Consent page -> Delete Consent action.

**Actual Usage:**
Revoking invalidated or erroneously attached consent forms.

**UI Behavior & Elements:**
'Delete Consent' button in consent row.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`DELETE /api/patients/:id/documents/:documentId (checked when document_type === 'CONSENT')`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Delete Consent option hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Dual-guarded: Requires both `Patients -> Patient Documents -> Delete` and `Patients -> Consent -> Delete`.

---

### 58. Doctors → Doctor Directory → View
- **Permission Code:** `DOCTORS_DOCTOR_DIRECTORY_VIEW`
- **Display Name:** View Doctor Directory
- **Category:** `CLINICAL` | **Group:** `DOCTORS`
- **Module:** Doctors
- **Screen:** Doctor Directory
- **Action:** View

**What it means:**
Allows viewing medical staff profiles, physician qualifications, specialties, and department mappings.

**Where it is used:**
Doctor Directory page (`DoctorDirectoryPage.tsx`), Doctor Schedule page, Appointment doctor selector.

**Actual Usage:**
Browsing doctor list, filtering doctors by specialty/department, and selecting doctors for booking.

**UI Behavior & Elements:**
Doctor Directory sidebar link; Doctor cards; Specialty dropdowns; Doctor lookup modals.

**Route Protection:**
`/doctors, /doctors/directory, /doctors/profile, /doctors/schedule, /doctors/performance`

**Backend Endpoint & Guard:**
`GET /api/doctors, GET /api/doctors/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Doctor Directory is inaccessible; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Central medical staff directory permission.

---

### 59. Doctors → Doctor Directory → Create
- **Permission Code:** `DOCTORS_DOCTOR_DIRECTORY_CREATE`
- **Display Name:** Create Doctor Directory
- **Category:** `CLINICAL` | **Group:** `DOCTORS`
- **Module:** Doctors
- **Screen:** Doctor Directory
- **Action:** Create

**What it means:**
Allows onboarding new medical doctors into the physician directory.

**Where it is used:**
Doctor Directory page -> Add Doctor modal dialog.

**Actual Usage:**
Registering physician profiles, licenses, consultation fees, and department affiliations.

**UI Behavior & Elements:**
'Add Doctor' primary button on Doctor Directory page.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/doctors`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Add Doctor button hidden; POST /api/doctors returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 60. Doctors → Doctor Directory → Edit
- **Permission Code:** `DOCTORS_DOCTOR_DIRECTORY_EDIT`
- **Display Name:** Edit Doctor Directory
- **Category:** `CLINICAL` | **Group:** `DOCTORS`
- **Module:** Doctors
- **Screen:** Doctor Directory
- **Action:** Edit

**What it means:**
Allows modifying doctor profiles, specialties, consultation charges, active status, and user account mapping.

**Where it is used:**
Doctor Directory table row actions -> Edit Doctor modal, Status toggle, User Mapping modal.

**Actual Usage:**
Updating doctor credentials, changing departmental assignments, linking doctor to user accounts.

**UI Behavior & Elements:**
'Edit Doctor' button; 'Map User' button; Doctor active/inactive toggle.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/doctors/:id, PATCH /api/doctors/:id/status, PATCH /api/doctors/:id/user-mapping`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Edit options disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 61. Doctors → Doctor Directory → Export
- **Permission Code:** `DOCTORS_DOCTOR_DIRECTORY_EXPORT`
- **Display Name:** Export Doctor Directory
- **Category:** `CLINICAL` | **Group:** `DOCTORS`
- **Module:** Doctors
- **Screen:** Doctor Directory
- **Action:** Export

**What it means:**
Allows exporting doctor directory rosters to CSV format.

**Where it is used:**
Doctor Directory page header action bar.

**Actual Usage:**
Downloading CSV export of active hospital physicians.

**UI Behavior & Elements:**
'Export CSV' button on Doctor Directory page.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/doctors/export`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Export button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 62. Doctors → Doctor Directory → Provision Login
- **Permission Code:** `DOCTORS_DOCTOR_DIRECTORY_PROVISION_LOGIN`
- **Display Name:** Provision Doctor Login
- **Category:** `CLINICAL` | **Group:** `DOCTORS`
- **Module:** Doctors
- **Screen:** Doctor Directory
- **Action:** Provision Login

**What it means:**
Allows creating or mapping a dedicated login user account for a doctor profile.

**Where it is used:**
Doctor Directory page -> Add Doctor form ('Create Login Account' toggle) / Map User dropdown.

**Actual Usage:**
Enabling 'Create Login Account' when onboarding a doctor and fetching eligible user accounts (`GET /api/doctors/user-options`).

**UI Behavior & Elements:**
'Create Login Account' toggle switch in Add Doctor modal; 'Select User' dropdown in User Mapping modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/doctors/user-options, POST /api/doctors (checked when create_login_account is true)`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
'Create Login Account' switch is disabled/hidden; Fetching user options returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls user identity provisioning for clinical staff.

---

### 63. Doctors → Doctor Availability → View
- **Permission Code:** `DOCTORS_DOCTOR_AVAILABILITY_VIEW`
- **Display Name:** View Doctor Availability
- **Category:** `CLINICAL` | **Group:** `DOCTORS`
- **Module:** Doctors
- **Screen:** Doctor Availability
- **Action:** View

**What it means:**
Allows viewing doctor weekly schedule templates, consultation hours, leave calendars, and slot availability.

**Where it is used:**
Doctor Availability page (`DoctorAvailabilityPage.tsx`), Appointment booking calendar view.

**Actual Usage:**
Checking doctor on-duty hours, calculating available appointment slots, and viewing scheduled leaves.

**UI Behavior & Elements:**
Doctor Availability sidebar link; Weekly availability grid; Available slots timeline; Leave list table.

**Route Protection:**
`/doctors/availability`

**Backend Endpoint & Guard:**
`GET /api/doctors/:id/available-slots, GET /api/doctors/:id/leaves, GET /api/doctors/:id/availability-exceptions`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Availability page inaccessible; Slot calculation returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 64. Doctors → Doctor Availability → Edit
- **Permission Code:** `DOCTORS_DOCTOR_AVAILABILITY_EDIT`
- **Display Name:** Edit Doctor Availability
- **Category:** `CLINICAL` | **Group:** `DOCTORS`
- **Module:** Doctors
- **Screen:** Doctor Availability
- **Action:** Edit

**What it means:**
Allows configuring weekly availability time slots, filing doctor leaves, and defining schedule exceptions.

**Where it is used:**
Doctor Availability page -> 'Save Availability' button, 'Add Leave' dialog, 'Add Exception' dialog.

**Actual Usage:**
Updating weekly consulting hours, applying for leaves, canceling leaves, adding schedule overrides.

**UI Behavior & Elements:**
'Save Schedule' button; 'Apply Leave' button; 'Cancel Leave' button; 'Add Exception' button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/doctors/:id/availability, POST /api/doctors/:id/leaves, PATCH /api/doctors/:id/leaves/:childId/cancel, POST /api/doctors/:id/availability-exceptions, DELETE /api/doctors/:id/availability-exceptions/:childId`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Save Schedule and Leave buttons are hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls both schedule authoring and leave/exception management.

---

### 65. Appointments → Appointment Records → View
- **Permission Code:** `APPOINTMENTS_APPOINTMENT_RECORDS_VIEW`
- **Display Name:** View Appointment Records
- **Category:** `CLINICAL` | **Group:** `APPOINTMENTS`
- **Module:** Appointments
- **Screen:** Appointment Records
- **Action:** View

**What it means:**
Allows viewing scheduled patient appointments, appointment calendars, daily rosters, and appointment details.

**Where it is used:**
Appointment Dashboard (`AppointmentDashboardPage.tsx`), Appointment Queue (`AppointmentQueuePage.tsx`), Calendar View (`AppointmentCalendarPage.tsx`).

**Actual Usage:**
Monitoring outpatient appointments, filtering by doctor/department/status, and viewing appointment history.

**UI Behavior & Elements:**
Appointments sidebar link; Calendar View sidebar link; Queue Management sidebar link; Appointment table; Appointment status filter.

**Route Protection:**
`/appointments, /appointments/calendar, /appointments/queue`

**Backend Endpoint & Guard:**
`GET /api/appointments, GET /api/appointments/:id`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Appointment dashboard, calendar, and queue pages return Access Denied; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Primary operational appointment view permission.

---

### 66. Appointments → Appointment Records → Edit
- **Permission Code:** `APPOINTMENTS_APPOINTMENT_RECORDS_EDIT`
- **Display Name:** Edit Appointment Records
- **Category:** `CLINICAL` | **Group:** `APPOINTMENTS`
- **Module:** Appointments
- **Screen:** Appointment Records
- **Action:** Edit

**What it means:**
Allows updating appointment status (specifically **Cancel Appointment** or mark No-Show).

**Where it is used:**
Appointment Queue table row actions -> 'Cancel Appointment' button; Appointment Detail modal.

**Actual Usage:**
Canceling appointments (`PATCH /api/appointments/:id/status` with `status: 'CANCELLED'`).

**UI Behavior & Elements:**
'Cancel' button in Appointment queue actions; 'Cancel Appointment' dialog.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/appointments/:id/status`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST

**Without Permission Behavior:**
Cancel Appointment button is hidden; Status patch returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Cancel Appointment** business action.

---

### 67. Appointments → Appointment Booking → View
- **Permission Code:** `APPOINTMENTS_APPOINTMENT_BOOKING_VIEW`
- **Display Name:** View Appointment Booking
- **Category:** `CLINICAL` | **Group:** `APPOINTMENTS`
- **Module:** Appointments
- **Screen:** Appointment Booking
- **Action:** View

**What it means:**
Allows accessing the appointment booking workspace and referral booking screen.

**Where it is used:**
Book Appointment page (`AppointmentBookingPage.tsx`), Referral Booking page (`ReferralBookingPage.tsx`).

**Actual Usage:**
Navigating to appointment booking workflows and inspecting slot availability.

**UI Behavior & Elements:**
Book Appointment sidebar link; Referral Booking sidebar link; Slot booking scheduler view.

**Route Protection:**
`/appointments/book, /appointments/referrals`

**Backend Endpoint & Guard:**
`Implicitly used in frontend route access control for booking screens.`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST

**Without Permission Behavior:**
Book Appointment and Referral Booking sidebar links are hidden; Pages return Access Denied.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `No`

**Technical Notes:**
Frontend route gate for booking screens.

---

### 68. Appointments → Appointment Booking → Create
- **Permission Code:** `APPOINTMENTS_APPOINTMENT_BOOKING_CREATE`
- **Display Name:** Create Appointment Booking
- **Category:** `CLINICAL` | **Group:** `APPOINTMENTS`
- **Module:** Appointments
- **Screen:** Appointment Booking
- **Action:** Create

**What it means:**
Allows **Booking New Appointments** and **Booking Doctor Referrals**.

**Where it is used:**
Book Appointment page -> 'Confirm Booking' button; Referral Booking page -> 'Book Appointment' button.

**Actual Usage:**
Submitting new outpatient appointment bookings (`POST /api/appointments`) and booking referred appointments (`POST /api/opd/referrals/:id/book`).

**UI Behavior & Elements:**
'Confirm Booking' / 'Book Appointment' button on booking form.

**Route Protection:**
`/appointments/book, /appointments/referrals (co-required for route access in access-control.ts)`

**Backend Endpoint & Guard:**
`POST /api/appointments, POST /api/opd/referrals/:id/book, POST /api/emergency/encounters/:id/referral/book`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST

**Without Permission Behavior:**
Confirm Booking button is hidden/disabled; POST /api/appointments returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls both standard outpatient appointment booking and specialist referral conversion.

---

### 69. Appointments → Appointment Booking → Edit
- **Permission Code:** `APPOINTMENTS_APPOINTMENT_BOOKING_EDIT`
- **Display Name:** Edit Appointment Booking
- **Category:** `CLINICAL` | **Group:** `APPOINTMENTS`
- **Module:** Appointments
- **Screen:** Appointment Booking
- **Action:** Edit

**What it means:**
Allows **Rescheduling Appointments** (changing slot date, time, consulting doctor, or reason).

**Where it is used:**
Appointment Queue / Calendar -> 'Reschedule Appointment' modal dialog.

**Actual Usage:**
Modifying scheduled appointment time/doctor (`PATCH /api/appointments/:id`).

**UI Behavior & Elements:**
'Reschedule' button in appointment row actions; Reschedule Appointment modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/appointments/:id`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST

**Without Permission Behavior:**
Reschedule button is hidden; PATCH /api/appointments/:id returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Reschedule Appointment** business action.

---

### 70. OPD → OPD Visits → View
- **Permission Code:** `OPD_OPD_VISITS_VIEW`
- **Display Name:** View OPD Visits
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Visits
- **Action:** View

**What it means:**
Allows viewing outpatient patient visits, arrival statuses, visit tokens, and live waiting queues.

**Where it is used:**
OPD Dashboard (`OpdDashboardPage.tsx`), OPD Waiting Queue (`OpdQueuePage.tsx`), Appointment Queue check-in status.

**Actual Usage:**
Monitoring patient queue progression from Check In -> Vitals -> Consultation -> Completed.

**UI Behavior & Elements:**
OPD Dashboard sidebar link; Waiting Queue sidebar link; OPD live queue table; Patient visit card.

**Route Protection:**
`/opd, /opd/queue`

**Backend Endpoint & Guard:**
`GET /api/opd/visits, GET /api/opd/visits/:id`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR, BILLING_AUTHORIZED

**Without Permission Behavior:**
OPD Queue and Dashboard pages return Access Denied; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Essential view permission for outpatient operations.

---

### 71. OPD → OPD Visits → Create
- **Permission Code:** `OPD_OPD_VISITS_CREATE`
- **Display Name:** Check In Patient
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Visits
- **Action:** Create

**What it means:**
Allows **Checking In** an arrived appointed or walk-in patient, creating the linked active OPD visit encounter.

**Where it is used:**
Appointment Queue page -> 'Check In' button; Patient Profile -> 'New Visit' action.

**Actual Usage:**
Executing patient check-in to generate token number and place patient in OPD waiting queue (`POST /api/opd/visits`).

**UI Behavior & Elements:**
'Check In' primary action button on Appointment Queue; Check In confirmation modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/opd/visits`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST

**Without Permission Behavior:**
Check In button is hidden; POST /api/opd/visits returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Crucial: Controls the **Check In** action. Seeded display name is 'Check In Patient'.

---

### 72. OPD → OPD Visits → Edit
- **Permission Code:** `OPD_OPD_VISITS_EDIT`
- **Display Name:** Edit OPD Visits
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Visits
- **Action:** Edit

**What it means:**
Allows updating visit status, specifically **Calling Next Patient** or transitioning queue stages.

**Where it is used:**
OPD Waiting Queue -> 'Call Next' button; Visit status dropdown.

**Actual Usage:**
Calling patient to vitals room/consultation room (`POST /api/opd/visits/:id/call-next`) and updating visit status (`PATCH /api/opd/visits/:id/status`).

**UI Behavior & Elements:**
'Call Next' button on OPD Waiting Queue; Status dropdown (In Vitals, In Consultation, Completed, Cancelled).

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/opd/visits/:id/status, POST /api/opd/visits/:id/call-next`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Call Next button disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Call Next Patient** and visit stage transitions.

---

### 73. OPD → OPD Vitals → View
- **Permission Code:** `OPD_OPD_VITALS_VIEW`
- **Display Name:** View OPD Vitals
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Vitals
- **Action:** View

**What it means:**
Allows viewing patient vital signs (BP, Pulse, Temperature, SpO2, Respiratory Rate, BMI, Pain Score).

**Where it is used:**
OPD Consultation workspace -> Vitals summary tile; Vitals history drawer; Nurse intake screen.

**Actual Usage:**
Inspecting latest and historical vital signs during clinical triage and doctor consultation.

**UI Behavior & Elements:**
Vitals badge tile on consultation workspace; Vitals History modal table.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/opd/visits/:visitId/vitals, GET /api/opd/visits/:visitId/vitals/latest`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Vitals values are obscured/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 74. OPD → OPD Vitals → Create
- **Permission Code:** `OPD_OPD_VITALS_CREATE`
- **Display Name:** Create OPD Vitals
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Vitals
- **Action:** Create

**What it means:**
Allows **Recording Vital Signs** for an outpatient visit encounter.

**Where it is used:**
OPD Waiting Queue -> 'Record Vitals' button; Vitals entry modal dialog.

**Actual Usage:**
Nursing intake: submitting physiological measurements (`POST /api/opd/visits/:visitId/vitals`).

**UI Behavior & Elements:**
'Record Vitals' / 'Add Vitals' button in OPD Queue; Vitals entry modal form.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/opd/visits/:visitId/vitals`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST, CLINICIAN_NURSE

**Without Permission Behavior:**
Record Vitals button is hidden; POST /vitals returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Record Vitals** action. Seeded for Receptionist erroneously in baseline.

---

### 75. OPD → OPD Vitals → Edit
- **Permission Code:** `OPD_OPD_VITALS_EDIT`
- **Display Name:** Edit OPD Vitals
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Vitals
- **Action:** Edit

**What it means:**
Allows editing or correcting previously recorded vital sign entries.

**Where it is used:**
Vitals history table -> Edit Vitals icon.

**Actual Usage:**
Correcting data entry mistakes in recorded vitals.

**UI Behavior & Elements:**
'Edit' button on vitals record row.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Enforced when updating existing vital logs.`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST

**Without Permission Behavior:**
Edit icon hidden.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `No`

**Technical Notes:**
Missing from baseline Nurse seed.

---

### 76. OPD → OPD Consultation → View
- **Permission Code:** `OPD_OPD_CONSULTATION_VIEW`
- **Display Name:** View OPD Consultation
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Consultation
- **Action:** View

**What it means:**
Allows viewing clinical consultation notes, recorded symptoms, physical examination findings, and diagnoses.

**Where it is used:**
Consultation Workspace (`OpdVisitPage.tsx`), Patient Timeline -> Consultation note viewer.

**Actual Usage:**
Reviewing physician clinical evaluation notes.

**UI Behavior & Elements:**
Consultation Workspace sidebar link; Clinical Notes viewer card.

**Route Protection:**
`/opd/visit, /opd/consultation`

**Backend Endpoint & Guard:**
`GET /api/opd/visits/:visitId/consultation`

**Current Seeded Roles:**
SUPER_ADMIN, DOCTOR

**Without Permission Behavior:**
Route /opd/consultation returns Access Denied; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 77. OPD → OPD Consultation → Edit
- **Permission Code:** `OPD_OPD_CONSULTATION_EDIT`
- **Display Name:** Edit OPD Consultation
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Consultation
- **Action:** Edit

**What it means:**
Allows **Saving Consultation Drafts** and **Completing Consultations** (recording diagnosis, ICD-10 codes, examination).

**Where it is used:**
Consultation Workspace -> 'Save Draft' button and 'Complete Consultation' button.

**Actual Usage:**
Authoring clinical notes (`PUT /api/opd/visits/:id/consultation`) and finalizing medical consultation (`POST /api/opd/visits/:id/consultation/complete`).

**UI Behavior & Elements:**
'Save Draft' button; 'Complete Consultation' primary action button on consultation form.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PUT /api/opd/visits/:visitId/consultation, POST /api/opd/visits/:visitId/consultation/complete`

**Current Seeded Roles:**
SUPER_ADMIN, DOCTOR

**Without Permission Behavior:**
Save Draft and Complete buttons are hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls both **Save Draft Consultation** and **Complete Consultation** actions.

---

### 78. OPD → OPD Prescription → View
- **Permission Code:** `OPD_OPD_PRESCRIPTION_VIEW`
- **Display Name:** View OPD Prescription
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Prescription
- **Action:** View

**What it means:**
Allows viewing electronic prescriptions, medication items, dosage regimens, and instructions.

**Where it is used:**
Consultation Workspace -> Prescription tab; Pharmacy Queue; Inpatient chart; Surgery bookings.

**Actual Usage:**
Reviewing prescribed medications across OPD, Pharmacy, Inpatient, and Surgery modules.

**UI Behavior & Elements:**
Prescription list card; E-Prescription preview modal; Pharmacy prescription viewer.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/opd/prescriptions, GET /api/opd/visits/:visitId/prescription, GET /api/admissions/inpatients/:id/prescription, GET /api/surgery/bookings/:id/prescription`

**Current Seeded Roles:**
SUPER_ADMIN, DOCTOR, PHARMACY_USER

**Without Permission Behavior:**
Prescription details hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Cross-domain read permission used by Doctor, Pharmacy, Inpatient, and Surgery.

---

### 79. OPD → OPD Prescription → Edit
- **Permission Code:** `OPD_OPD_PRESCRIPTION_EDIT`
- **Display Name:** Edit OPD Prescription
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Prescription
- **Action:** Edit

**What it means:**
Allows authoring, editing, and **Submitting E-Prescriptions** (adding drug items, dosage, frequency, duration).

**Where it is used:**
Consultation Workspace -> Prescription builder -> 'Submit Prescription' button; Inpatient prescription builder.

**Actual Usage:**
Saving draft prescriptions and finalizing electronic prescriptions (`POST /api/opd/visits/:id/prescription/submit`, `POST /api/admissions/inpatients/:id/prescription`).

**UI Behavior & Elements:**
'Add Medication' button; 'Save Prescription Draft' button; 'Submit Prescription' button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PUT /api/opd/visits/:visitId/prescription, POST /api/opd/visits/:visitId/prescription/submit, POST /api/admissions/inpatients/:id/prescription, POST /api/surgery/bookings/:id/prescription`

**Current Seeded Roles:**
SUPER_ADMIN, DOCTOR

**Without Permission Behavior:**
Prescription editing tools hidden; Submit returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Submit Prescription** across OPD, Inpatient, and Surgery.

---

### 80. OPD → OPD Clinical Orders → View
- **Permission Code:** `OPD_OPD_CLINICAL_ORDERS_VIEW`
- **Display Name:** View OPD Clinical Orders
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Clinical Orders
- **Action:** View

**What it means:**
Allows viewing diagnostic investigation orders (Laboratory & Imaging) placed during consultations.

**Where it is used:**
Consultation Workspace -> Orders tab; Inpatient Orders tab; Surgery Orders tab.

**Actual Usage:**
Reviewing ordered lab tests, imaging studies, and clinical indications.

**UI Behavior & Elements:**
Clinical Orders list card; Investigation summary tile.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/opd/visits/:visitId/clinical-orders/:orderType, GET /api/admissions/inpatients/:id/clinical-orders/:orderType, GET /api/surgery/bookings/:id/clinical-orders/:orderType`

**Current Seeded Roles:**
SUPER_ADMIN, DOCTOR

**Without Permission Behavior:**
Orders tab hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 81. OPD → OPD Clinical Orders → Edit
- **Permission Code:** `OPD_OPD_CLINICAL_ORDERS_EDIT`
- **Display Name:** Edit OPD Clinical Orders
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Clinical Orders
- **Action:** Edit

**What it means:**
Allows **Submitting Clinical Orders** (ordering Laboratory tests and Radiology/Imaging procedures).

**Where it is used:**
Consultation Workspace -> Orders builder -> 'Submit Orders' button; Inpatient orders modal.

**Actual Usage:**
Dispatching lab and radiology requests to diagnostic work queues (`POST /api/opd/visits/:id/clinical-orders/:type/submit`).

**UI Behavior & Elements:**
'Add Test / Order' button; 'Submit Orders' primary button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PUT /api/opd/visits/:visitId/clinical-orders/:orderType, POST /api/opd/visits/:visitId/clinical-orders/:orderType/submit, POST /api/admissions/inpatients/:id/clinical-orders/:orderType, POST /api/surgery/bookings/:id/clinical-orders/:orderType`

**Current Seeded Roles:**
SUPER_ADMIN, DOCTOR

**Without Permission Behavior:**
Add Order controls disabled/hidden; Submit returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Submit Clinical Orders (Lab/Imaging)** across OPD, Inpatient, and Surgery.

---

### 82. OPD → OPD Follow-up → View
- **Permission Code:** `OPD_OPD_FOLLOW_UP_VIEW`
- **Display Name:** View OPD Follow-up
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Follow-up
- **Action:** View

**What it means:**
Allows viewing follow-up schedules and review advice recorded during consultation.

**Where it is used:**
Consultation Workspace -> Follow-up tab; Patient summary.

**Actual Usage:**
Checking follow-up instructions and scheduled revisit dates.

**UI Behavior & Elements:**
Follow-up schedule summary card.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/opd/visits/:visitId/follow-up`

**Current Seeded Roles:**
SUPER_ADMIN, DOCTOR

**Without Permission Behavior:**
Follow-up card hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 83. OPD → OPD Follow-up → Edit
- **Permission Code:** `OPD_OPD_FOLLOW_UP_EDIT`
- **Display Name:** Edit OPD Follow-up
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Follow-up
- **Action:** Edit

**What it means:**
Allows **Scheduling Follow-up Revisit** (setting revisit timeline, e.g. 7 days, 14 days, and instructions).

**Where it is used:**
Consultation Workspace -> Follow-up form -> 'Schedule Follow-up' button.

**Actual Usage:**
Scheduling follow-up appointments (`POST /api/opd/visits/:id/follow-up/schedule`).

**UI Behavior & Elements:**
'Schedule Follow-up' button; Follow-up date picker and instructions input.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PUT /api/opd/visits/:visitId/follow-up, POST /api/opd/visits/:visitId/follow-up/schedule`

**Current Seeded Roles:**
SUPER_ADMIN, DOCTOR

**Without Permission Behavior:**
Follow-up inputs disabled; Schedule button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Schedule Follow-up** action.

---

### 84. OPD → OPD Referral → View
- **Permission Code:** `OPD_OPD_REFERRAL_VIEW`
- **Display Name:** View OPD Referral
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Referral
- **Action:** View

**What it means:**
Allows viewing medical referral recommendations, target specialty, doctor notes, and referral queues.

**Where it is used:**
Referral Booking page (`ReferralBookingPage.tsx`), Consultation Workspace -> Referral tab.

**Actual Usage:**
Looking up doctor referral orders to book referred appointments (`GET /api/opd/referrals`).

**UI Behavior & Elements:**
Referral Booking table; Referral details card on consultation screen.

**Route Protection:**
`/appointments/referrals (co-required with Appointments Booking Create in access-control.ts)`

**Backend Endpoint & Guard:**
`GET /api/opd/referrals, GET /api/opd/visits/:visitId/referral, GET /api/emergency/referrals, GET /api/emergency/encounters/:id/referral`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST, DOCTOR

**Without Permission Behavior:**
Referral Booking queue inaccessible; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Essential for Receptionist to view referrals and execute **Book Referral**.

---

### 85. OPD → OPD Referral → Edit
- **Permission Code:** `OPD_OPD_REFERRAL_EDIT`
- **Display Name:** Edit OPD Referral
- **Category:** `CLINICAL` | **Group:** `OPD`
- **Module:** OPD
- **Screen:** OPD Referral
- **Action:** Edit

**What it means:**
Allows **Creating and Submitting Medical Referrals** (referring patient to another doctor or specialty).

**Where it is used:**
Consultation Workspace -> Referral form -> 'Submit Referral' button.

**Actual Usage:**
Generating clinical referral orders during doctor consultation (`POST /api/opd/visits/:id/referral/submit`).

**UI Behavior & Elements:**
'Add Referral' button; 'Submit Referral' button on consultation form.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PUT /api/opd/visits/:visitId/referral, POST /api/opd/visits/:visitId/referral/submit`

**Current Seeded Roles:**
SUPER_ADMIN, RECEPTIONIST, DOCTOR

**Without Permission Behavior:**
Submit Referral button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Submit Medical Referral**. Receptionist has this in seed erroneously.

---

### 86. Pharmacy → Medicine Inventory → View
- **Permission Code:** `PHARMACY_MEDICINE_INVENTORY_VIEW`
- **Display Name:** View Medicine Inventory
- **Category:** `CLINICAL` | **Group:** `PHARMACY`
- **Module:** Pharmacy
- **Screen:** Medicine Inventory
- **Action:** View

**What it means:**
Allows viewing pharmacy medicine stock levels, batch balances, stock movements, and inventory summaries.

**Where it is used:**
Pharmacy Medicine Inventory page (`PharmacyMedicineInventoryPage.tsx`), Batch selection dropdowns in dispensing.

**Actual Usage:**
Inspecting current on-hand stock quantities, batch expiries, movement logs, and low-stock alerts.

**UI Behavior & Elements:**
Medicine Inventory sidebar link; Stock balance table; Batch list drawer; Stock Movement history tab.

**Route Protection:**
`/pharmacy/inventory`

**Backend Endpoint & Guard:**
`GET /api/pharmacy/medicine-inventory, GET /api/pharmacy/medicine-inventory/summary, GET /api/pharmacy/medicine-inventory/movements, GET /api/pharmacy/medicine-inventory/batches, GET /api/pharmacy/medicine-inventory/:id, GET /api/pharmacy/medicine-inventory/:id/batches`

**Current Seeded Roles:**
SUPER_ADMIN, PHARMACY_USER

**Without Permission Behavior:**
Pharmacy Inventory page returns Access Denied; Inventory queries return 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Core inventory read permission.

---

### 87. Pharmacy → Medicine Inventory → RegisterBatch
- **Permission Code:** `PHARMACY_MEDICINE_INVENTORY_REGISTER_BATCH`
- **Display Name:** Register Medicine Batch
- **Category:** `CLINICAL` | **Group:** `PHARMACY`
- **Module:** Pharmacy
- **Screen:** Medicine Inventory
- **Action:** RegisterBatch

**What it means:**
Allows **Registering New Medicine Batches** (recording received batch number, expiry date, purchase cost, MRP, quantity).

**Where it is used:**
Medicine Inventory page -> 'Register Batch' modal dialog.

**Actual Usage:**
Onboarding newly received medicine stock shipments (`POST /api/pharmacy/medicine-inventory/:medicineId/batches`).

**UI Behavior & Elements:**
'Register Batch' primary button; Batch details entry form.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/pharmacy/medicine-inventory/:medicineId/batches`

**Current Seeded Roles:**
SUPER_ADMIN, PHARMACY_USER

**Without Permission Behavior:**
Register Batch button is hidden; POST /batches returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Register Medicine Batch** action.

---

### 88. Pharmacy → Medicine Inventory → RecordMovement
- **Permission Code:** `PHARMACY_MEDICINE_INVENTORY_RECORD_MOVEMENT`
- **Display Name:** Record Stock Movement
- **Category:** `CLINICAL` | **Group:** `PHARMACY`
- **Module:** Pharmacy
- **Screen:** Medicine Inventory
- **Action:** RecordMovement

**What it means:**
Allows **Recording Stock Movements** (stock receipts from vendors, departmental transfers, and stock issues).

**Where it is used:**
Medicine Inventory page -> 'Record Movement' modal dialog.

**Actual Usage:**
Documenting inbound/outbound stock transfers (`POST /api/pharmacy/medicine-inventory/movements`).

**UI Behavior & Elements:**
'Record Movement' / 'Stock Transfer' button; Movement entry form.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/pharmacy/medicine-inventory/movements`

**Current Seeded Roles:**
SUPER_ADMIN, PHARMACY_USER

**Without Permission Behavior:**
Record Movement button is hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls standard stock movement receipts and transfers.

---

### 89. Pharmacy → Medicine Inventory → AdjustStock
- **Permission Code:** `PHARMACY_MEDICINE_INVENTORY_ADJUST_STOCK`
- **Display Name:** Adjust Stock
- **Category:** `CLINICAL` | **Group:** `PHARMACY`
- **Module:** Pharmacy
- **Screen:** Medicine Inventory
- **Action:** AdjustStock

**What it means:**
Allows **Adjusting Stock** (recording audited stock adjustments for found, lost, expired, or damaged medicine).

**Where it is used:**
Medicine Inventory page -> 'Adjust Stock' modal dialog.

**Actual Usage:**
Reconciling physical inventory variances with audited adjustment reasons (`POST /api/pharmacy/medicine-inventory/adjustments`).

**UI Behavior & Elements:**
'Adjust Stock' action button; Reason dropdown (DAMAGED, EXPIRED, LOSS, FOUND, AUDIT_CORRECTION).

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/pharmacy/medicine-inventory/adjustments`

**Current Seeded Roles:**
SUPER_ADMIN, PHARMACY_USER

**Without Permission Behavior:**
Adjust Stock button is hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Adjust Stock** action.

---

### 90. Pharmacy → Medicine Inventory → EditBatch
- **Permission Code:** `PHARMACY_MEDICINE_INVENTORY_EDIT_BATCH`
- **Display Name:** Edit Medicine Batch
- **Category:** `CLINICAL` | **Group:** `PHARMACY`
- **Module:** Pharmacy
- **Screen:** Medicine Inventory
- **Action:** EditBatch

**What it means:**
Allows editing batch metadata (updating MRP, cost, expiry date, or supplier reference).

**Where it is used:**
Medicine Inventory -> Batch list table -> 'Edit Batch' icon.

**Actual Usage:**
Correcting batch pricing and expiry dates (`PATCH /api/pharmacy/medicine-inventory/batches/:batchId`).

**UI Behavior & Elements:**
'Edit Batch' button in batch details table.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/pharmacy/medicine-inventory/batches/:batchId`

**Current Seeded Roles:**
SUPER_ADMIN, PHARMACY_USER

**Without Permission Behavior:**
Edit Batch icon hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 91. Pharmacy → Medicine Inventory → ConfigureLowStock
- **Permission Code:** `PHARMACY_MEDICINE_INVENTORY_CONFIGURE_LOW_STOCK`
- **Display Name:** Configure Low-Stock Level
- **Category:** `CLINICAL` | **Group:** `PHARMACY`
- **Module:** Pharmacy
- **Screen:** Medicine Inventory
- **Action:** ConfigureLowStock

**What it means:**
Allows configuring the minimum reorder threshold level that triggers automated low-stock warnings.

**Where it is used:**
Medicine Inventory -> 'Configure Threshold' modal.

**Actual Usage:**
Setting per-medicine minimum safety stock levels (`PATCH /api/pharmacy/medicine-inventory/:id/low-stock-threshold`).

**UI Behavior & Elements:**
'Set Low Stock Threshold' button / input field.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/pharmacy/medicine-inventory/:medicineId/low-stock-threshold`

**Current Seeded Roles:**
SUPER_ADMIN, PHARMACY_USER

**Without Permission Behavior:**
Threshold input is read-only; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 92. Pharmacy → Dispensing → View
- **Permission Code:** `PHARMACY_DISPENSING_VIEW`
- **Display Name:** View Dispensing
- **Category:** `CLINICAL` | **Group:** `PHARMACY`
- **Module:** Pharmacy
- **Screen:** Dispensing
- **Action:** View

**What it means:**
Allows viewing prescription dispensing queue, fulfillment statuses, and dispensing order details.

**Where it is used:**
Prescription Queue page (`PrescriptionQueuePage.tsx`), Dispensing Workspace.

**Actual Usage:**
Monitoring pending prescriptions from OPD, Emergency, and Inpatient units.

**UI Behavior & Elements:**
Prescription Queue sidebar link; Dispensing queue table; Prescription items card.

**Route Protection:**
`/pharmacy, /pharmacy/queue, /pharmacy/orders, /pharmacy/dispensing`

**Backend Endpoint & Guard:**
`GET /api/pharmacy/dispensings, GET /api/pharmacy/dispensings/:id`

**Current Seeded Roles:**
SUPER_ADMIN, PHARMACY_USER

**Without Permission Behavior:**
Prescription Queue returns Access Denied; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Core dispensary queue view permission.

---

### 93. Pharmacy → Dispensing → Edit
- **Permission Code:** `PHARMACY_DISPENSING_EDIT`
- **Display Name:** Edit Dispensing
- **Category:** `CLINICAL` | **Group:** `PHARMACY`
- **Module:** Pharmacy
- **Screen:** Dispensing
- **Action:** Edit

**What it means:**
Allows **Allocating Batches** and modifying dispensing quantities / generic substitutions.

**Where it is used:**
Dispensing Workspace -> Batch Allocation table -> 'Save Batch Allocation' button.

**Actual Usage:**
Assigning FEFO medicine batches to prescription items (`PUT /api/pharmacy/dispensings/:id`).

**UI Behavior & Elements:**
Batch selection dropdowns; Quantity input; Generic substitution selector; 'Save Allocation' button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PUT /api/pharmacy/dispensings/:id`

**Current Seeded Roles:**
SUPER_ADMIN, PHARMACY_USER

**Without Permission Behavior:**
Batch allocation inputs disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls batch allocation and preparation of medication orders.

---

### 94. Pharmacy → Dispensing → Dispense
- **Permission Code:** `PHARMACY_DISPENSING_DISPENSE`
- **Display Name:** Dispense
- **Category:** `CLINICAL` | **Group:** `PHARMACY`
- **Module:** Pharmacy
- **Screen:** Dispensing
- **Action:** Dispense

**What it means:**
Allows **Confirming Dispensing** (finalizing medication handover, deducting inventory, and marking order DISPENSED).

**Where it is used:**
Dispensing Workspace -> 'Confirm Dispense' / 'Dispense Medication' primary action button.

**Actual Usage:**
Executing atomic stock decrement and finalizing pharmacy dispensing (`POST /api/pharmacy/dispensings/:id/confirm`).

**UI Behavior & Elements:**
'Confirm Dispense' / 'Dispense' button on dispensing modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/pharmacy/dispensings/:id/confirm`

**Current Seeded Roles:**
SUPER_ADMIN, PHARMACY_USER

**Without Permission Behavior:**
Confirm Dispense button hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Dispense / Confirm Dispense** action.

---

### 95. Pharmacy → Dispensing → Cancel
- **Permission Code:** `PHARMACY_DISPENSING_CANCEL`
- **Display Name:** Cancel Dispensing
- **Category:** `CLINICAL` | **Group:** `PHARMACY`
- **Module:** Pharmacy
- **Screen:** Dispensing
- **Action:** Cancel

**What it means:**
Allows **Canceling Dispensing Orders** (voiding uncollected or rejected prescription requests).

**Where it is used:**
Dispensing Queue row actions -> 'Cancel Order' dialog.

**Actual Usage:**
Canceling pending dispensing requests with mandatory reason (`POST /api/pharmacy/dispensings/:id/cancel`).

**UI Behavior & Elements:**
'Cancel Order' button; Reason modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/pharmacy/dispensings/:id/cancel`

**Current Seeded Roles:**
SUPER_ADMIN, PHARMACY_USER

**Without Permission Behavior:**
Cancel button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Cancel Dispensing** action.

---

### 96. Pharmacy → Dispensing → Reverse
- **Permission Code:** `PHARMACY_DISPENSING_REVERSE`
- **Display Name:** Reverse Dispensing
- **Category:** `CLINICAL` | **Group:** `PHARMACY`
- **Module:** Pharmacy
- **Screen:** Dispensing
- **Action:** Reverse

**What it means:**
Allows **Reversing Dispensed Medications** (processing returned drugs, restoring inventory batches, and voiding charges).

**Where it is used:**
Dispensing History / Workspace -> 'Reverse Dispense' / 'Return Medicine' modal.

**Actual Usage:**
Executing atomic stock restoration and transaction reversal (`POST /api/pharmacy/dispensings/:id/reverse`).

**UI Behavior & Elements:**
'Reverse Dispense' button; Return reason and quantity verification modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/pharmacy/dispensings/:id/reverse`

**Current Seeded Roles:**
SUPER_ADMIN, PHARMACY_USER

**Without Permission Behavior:**
Reverse button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Reverse Dispensing** action.

---

### 97. Pharmacy → Dispensing → UpdateStatus
- **Permission Code:** `PHARMACY_DISPENSING_UPDATE_STATUS`
- **Display Name:** Update Status
- **Category:** `CLINICAL` | **Group:** `PHARMACY`
- **Module:** Pharmacy
- **Screen:** Dispensing
- **Action:** UpdateStatus

**What it means:**
Allows updating intermediate dispensing fulfillment statuses (`PREPARING`, `READY_FOR_PICKUP`).

**Where it is used:**
Dispensing Queue table -> Stage status selector.

**Actual Usage:**
Signaling medication preparation progress.

**UI Behavior & Elements:**
Fulfillment status dropdown on dispensing card.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Enforced during intermediate workflow status updates.`

**Current Seeded Roles:**
SUPER_ADMIN, PHARMACY_USER

**Without Permission Behavior:**
Status selector disabled.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 98. Admissions → Wards → View
- **Permission Code:** `ADMISSIONS_WARDS_VIEW`
- **Display Name:** View Wards
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Wards
- **Action:** View

**What it means:**
Allows viewing ward configurations, ward types (ICU, General, Private, Pediatric), and active ward lists.

**Where it is used:**
Bed Management page (`BedManagementPage.tsx`), Branch Ward/Bed Configuration, Inpatient Admission ward selectors.

**Actual Usage:**
Browsing ward master list and filtering beds by ward category.

**UI Behavior & Elements:**
Ward list filter tabs; Ward cards; Ward dropdowns.

**Route Protection:**
`/admissions/beds (co-view with Beds)`

**Backend Endpoint & Guard:**
`GET /api/admissions/wards, GET /api/admissions/wards/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE

**Without Permission Behavior:**
Ward information hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 99. Admissions → Wards → Create
- **Permission Code:** `ADMISSIONS_WARDS_CREATE`
- **Display Name:** Create Wards
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Wards
- **Action:** Create

**What it means:**
Allows creating new inpatient wards and care wings.

**Where it is used:**
Bed Management / Branch Configuration -> 'Add Ward' modal.

**Actual Usage:**
Registering new hospital wards (`POST /api/admissions/wards`).

**UI Behavior & Elements:**
'Add Ward' primary action button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/wards`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Add Ward button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 100. Admissions → Wards → Edit
- **Permission Code:** `ADMISSIONS_WARDS_EDIT`
- **Display Name:** Edit Wards
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Wards
- **Action:** Edit

**What it means:**
Allows updating ward names, categories, gender designations, and room configurations.

**Where it is used:**
Bed Management -> 'Edit Ward' modal dialog.

**Actual Usage:**
Modifying ward master properties (`PATCH /api/admissions/wards/:id`).

**UI Behavior & Elements:**
'Edit Ward' button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/admissions/wards/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Edit Ward option hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 101. Admissions → Wards → ChangeStatus
- **Permission Code:** `ADMISSIONS_WARDS_CHANGE_STATUS`
- **Display Name:** Change Ward Status
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Wards
- **Action:** ChangeStatus

**What it means:**
Allows changing operational ward status (`ACTIVE`, `INACTIVE`, `MAINTENANCE`).

**Where it is used:**
Bed Management -> Ward status toggle switch.

**Actual Usage:**
Activating/deactivating ward operations (`PATCH /api/admissions/wards/:id/status`).

**UI Behavior & Elements:**
Ward active status switch.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/admissions/wards/:id/status`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Status switch disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 102. Admissions → Beds → View
- **Permission Code:** `ADMISSIONS_BEDS_VIEW`
- **Display Name:** View Beds
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Beds
- **Action:** View

**What it means:**
Allows viewing bed availability boards, bed numbers, room categories, occupancy status, and cleaning state.

**Where it is used:**
Bed Management page (`BedManagementPage.tsx`), Bed Availability board (`BedAvailabilityPage.tsx`), Inpatient bed allotments.

**Actual Usage:**
Inspecting live bed census, viewing occupied/available/cleaning beds, and checking daily bed charges.

**UI Behavior & Elements:**
Bed Management sidebar link; Live Bed Board grid; Bed status color badges; Bed detail modal.

**Route Protection:**
`/admissions/beds, /admissions/bed-availability`

**Backend Endpoint & Guard:**
`GET /api/admissions/beds, GET /api/admissions/beds/summary, GET /api/admissions/beds/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE

**Without Permission Behavior:**
Bed Management and Availability screens return Access Denied; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Core bed board visibility permission.

---

### 103. Admissions → Beds → Create
- **Permission Code:** `ADMISSIONS_BEDS_CREATE`
- **Display Name:** Create Beds
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Beds
- **Action:** Create

**What it means:**
Allows adding new beds into wards and setting daily room tariffs.

**Where it is used:**
Bed Management page -> 'Add Bed' modal dialog.

**Actual Usage:**
Registering new bed numbers and room numbers in wards (`POST /api/admissions/beds`).

**UI Behavior & Elements:**
'Add Bed' primary button on Bed Management page.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/beds`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Add Bed button hidden; POST /api/admissions/beds returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 104. Admissions → Beds → Edit
- **Permission Code:** `ADMISSIONS_BEDS_EDIT`
- **Display Name:** Edit Beds
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Beds
- **Action:** Edit

**What it means:**
Allows editing bed properties, bed types, daily rates, and room designations.

**Where it is used:**
Bed Management page -> 'Edit Bed' modal.

**Actual Usage:**
Updating bed rates and features (`PATCH /api/admissions/beds/:id`).

**UI Behavior & Elements:**
'Edit Bed' button in bed action menu.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/admissions/beds/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Edit Bed button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 105. Admissions → Beds → ChangeStatus
- **Permission Code:** `ADMISSIONS_BEDS_CHANGE_STATUS`
- **Display Name:** Change Bed Status
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Beds
- **Action:** ChangeStatus

**What it means:**
Allows updating bed operational statuses (`AVAILABLE`, `CLEANING`, `MAINTENANCE`, `BLOCKED`, `INACTIVE`).

**Where it is used:**
Bed Management board -> Bed action menu -> 'Mark Cleaned' / 'Set Maintenance' actions.

**Actual Usage:**
Releasing beds from housekeeping cleaning to available status (`PATCH /api/admissions/beds/:id/status`).

**UI Behavior & Elements:**
'Mark as Cleaned' button; 'Set Under Maintenance' option in bed context menu.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/admissions/beds/:id/status`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Status actions disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls housekeeping status transitions and maintenance blocks.

---

### 106. Admissions → Admission Policy → View
- **Permission Code:** `ADMISSIONS_ADMISSION_POLICY_VIEW`
- **Display Name:** View Admission Policy
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Admission Policy
- **Action:** View

**What it means:**
Allows viewing branch admission policy rules, mandatory deposit percentages, and bed hold duration limits.

**Where it is used:**
Bed Management -> Policy tab; Admission confirmation modal.

**Actual Usage:**
Inspecting branch admission requirements before admitting patients.

**UI Behavior & Elements:**
Admission Policy summary card; Required deposit rule banner.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/admissions/policy`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST

**Without Permission Behavior:**
Policy queries return 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 107. Admissions → Admission Policy → Edit
- **Permission Code:** `ADMISSIONS_ADMISSION_POLICY_EDIT`
- **Display Name:** Edit Admission Policy
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Admission Policy
- **Action:** Edit

**What it means:**
Allows updating admission rules, deposit requirements, advance payment thresholds, and bed hold expiration timeouts.

**Where it is used:**
Bed Management -> Policy editor -> 'Save Policy' button.

**Actual Usage:**
Configuring branch-level admission and advance deposit policies (`PUT /api/admissions/policy`).

**UI Behavior & Elements:**
'Save Admission Policy' primary button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PUT /api/admissions/policy`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Save Policy button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 108. Admissions → Bed Holds → View
- **Permission Code:** `ADMISSIONS_BED_HOLDS_VIEW`
- **Display Name:** View Bed Holds
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Bed Holds
- **Action:** View

**What it means:**
Allows viewing active bed holds, reserved patient names, hold timestamps, and expiration countdowns.

**Where it is used:**
Bed Availability board; Bed Hold details modal.

**Actual Usage:**
Checking existing temporary bed reservations.

**UI Behavior & Elements:**
Bed Hold badge on bed card; Bed Hold details drawer.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Enforced when querying bed hold records.`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST

**Without Permission Behavior:**
Hold details hidden.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 109. Admissions → Bed Holds → Create
- **Permission Code:** `ADMISSIONS_BED_HOLDS_CREATE`
- **Display Name:** Create Bed Hold
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Bed Holds
- **Action:** Create

**What it means:**
Allows **Placing a Temporary Hold on a Bed** for an incoming elective admission or surgery.

**Where it is used:**
Bed Management / Availability board -> 'Hold Bed' button.

**Actual Usage:**
Reserving an available bed for a specific patient for a configurable hold duration (`POST /api/admissions/beds/:id/holds`).

**UI Behavior & Elements:**
'Hold Bed' button on Bed card; Hold Bed modal form.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/beds/:id/holds`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST

**Without Permission Behavior:**
Hold Bed button hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Create Bed Hold** action.

---

### 110. Admissions → Bed Holds → Release
- **Permission Code:** `ADMISSIONS_BED_HOLDS_RELEASE`
- **Display Name:** Release Bed Hold
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Bed Holds
- **Action:** Release

**What it means:**
Allows **Releasing a Bed Hold** back to available status upon fulfillment or manual unreserve.

**Where it is used:**
Bed Management -> 'Release Hold' action on held bed card.

**Actual Usage:**
Releasing bed holds (`POST /api/admissions/bed-holds/:id/release`).

**UI Behavior & Elements:**
'Release Hold' button in bed action menu.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/bed-holds/:id/release`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST

**Without Permission Behavior:**
Release Hold button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Release Bed Hold** action.

---

### 111. Admissions → Bed Holds → Cancel
- **Permission Code:** `ADMISSIONS_BED_HOLDS_CANCEL`
- **Display Name:** Cancel Bed Hold
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Bed Holds
- **Action:** Cancel

**What it means:**
Allows **Canceling an Active Bed Hold** if patient cancels admission.

**Where it is used:**
Bed Management -> 'Cancel Hold' action.

**Actual Usage:**
Canceling temporary bed holds (`POST /api/admissions/bed-holds/:id/cancel`).

**UI Behavior & Elements:**
'Cancel Hold' button; Reason modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/bed-holds/:id/cancel`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST

**Without Permission Behavior:**
Cancel Hold button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Cancel Bed Hold** action.

---

### 112. Admissions → Bed Transfers → View
- **Permission Code:** `ADMISSIONS_BED_TRANSFERS_VIEW`
- **Display Name:** View Bed Transfers
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Bed Transfers
- **Action:** View

**What it means:**
Allows viewing bed transfer requests, transfer history, and destination wards.

**Where it is used:**
Inpatient Workspace -> Transfer History tab; Bed Management transfer queue.

**Actual Usage:**
Tracking patient internal and cross-branch transfer progressions.

**UI Behavior & Elements:**
Transfer History table; Active transfer badge on inpatient card.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Enforced when querying transfer lists.`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Transfer history hidden.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 113. Admissions → Bed Transfers → Create
- **Permission Code:** `ADMISSIONS_BED_TRANSFERS_CREATE`
- **Display Name:** Create Bed Transfer
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Bed Transfers
- **Action:** Create

**What it means:**
Allows **Initiating Bed Transfers** (requesting transfer of an admitted patient to another bed/ward).

**Where it is used:**
Inpatient Workspace -> 'Transfer Patient' / 'Transfer Bed' action button.

**Actual Usage:**
Submitting bed transfer requests (`POST /api/admissions/inpatients/:id/transfers`).

**UI Behavior & Elements:**
'Transfer Bed' button on inpatient workspace; Transfer Destination modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/inpatients/:id/transfers, POST /api/admissions/inpatients/:id/cross-branch-transfers`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Transfer Bed button is hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Initiate Bed Transfer** action.

---

### 114. Admissions → Bed Transfers → Complete
- **Permission Code:** `ADMISSIONS_BED_TRANSFERS_COMPLETE`
- **Display Name:** Complete Bed Transfer
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Bed Transfers
- **Action:** Complete

**What it means:**
Allows **Completing / Executing Bed Transfers** (atomically vacating previous bed and occupying destination bed).

**Where it is used:**
Bed Management -> Transfer Queue -> 'Complete Transfer' button.

**Actual Usage:**
Finalizing physical bed transfer (`POST /api/admissions/bed-transfers/:id/complete`).

**UI Behavior & Elements:**
'Complete Transfer' / 'Confirm Transfer' action button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/bed-transfers/:id/complete, POST /api/admissions/bed-transfers/:id/complete-cross-branch`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Complete Transfer button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Complete Bed Transfer** action.

---

### 115. Admissions → Bed Transfers → Cancel
- **Permission Code:** `ADMISSIONS_BED_TRANSFERS_CANCEL`
- **Display Name:** Cancel Bed Transfer
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Bed Transfers
- **Action:** Cancel

**What it means:**
Allows **Canceling Pending Bed Transfers**.

**Where it is used:**
Transfer Queue -> 'Cancel Transfer' button.

**Actual Usage:**
Aborting pending transfer requests (`POST /api/admissions/bed-transfers/:id/cancel`).

**UI Behavior & Elements:**
'Cancel Transfer' button; Reason modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/bed-transfers/:id/cancel`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Cancel Transfer button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Cancel Bed Transfer** action.

---

### 116. Admissions → Bed Transfers → CrossBranch
- **Permission Code:** `ADMISSIONS_BED_TRANSFERS_CROSS_BRANCH`
- **Display Name:** Transfer Across Branches
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Bed Transfers
- **Action:** CrossBranch

**What it means:**
Allows **Transferring Inpatients Across Different Hospital Branches**.

**Where it is used:**
Inpatient Workspace -> 'Cross-Branch Transfer' toggle / modal.

**Actual Usage:**
Authorizing inter-facility transfers between distinct branch databases (`POST /cross-branch-transfers`).

**UI Behavior & Elements:**
'Cross-Branch Transfer' toggle switch; Branch destination selector.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/inpatients/:id/cross-branch-transfers, POST /api/admissions/bed-transfers/:id/complete-cross-branch`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Cross-Branch toggle is disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Dual-guarded: Requires both `Admissions -> Bed Transfers -> Create` and `Admissions -> Bed Transfers -> CrossBranch`.

---

### 117. Admissions → Inpatient Admissions → View
- **Permission Code:** `ADMISSIONS_INPATIENT_ADMISSIONS_VIEW`
- **Display Name:** View Inpatient Admissions
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Inpatient Admissions
- **Action:** View

**What it means:**
Allows viewing the inpatient census, active inpatient admissions, patient charts, and admission summaries.

**Where it is used:**
Inpatient Workspace page (`InpatientWorkspacePage.tsx`), Ward census board.

**Actual Usage:**
Monitoring admitted patients, reviewing admission vitals, round notes, and care plans.

**UI Behavior & Elements:**
Inpatient Workspace sidebar link; Inpatient Census table; Patient Inpatient Chart view.

**Route Protection:**
`/admissions, /admissions/workspace`

**Backend Endpoint & Guard:**
`GET /api/admissions/inpatients, GET /api/admissions/inpatients/:id, GET /api/admissions/inpatients/:id/round-notes, GET /api/admissions/inpatients/:id/vitals`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Inpatient Workspace returns Access Denied; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Core inpatient clinical and administrative view permission.

---

### 118. Admissions → Inpatient Admissions → Create
- **Permission Code:** `ADMISSIONS_INPATIENT_ADMISSIONS_CREATE`
- **Display Name:** Create Inpatient Admissions
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Inpatient Admissions
- **Action:** Create

**What it means:**
Allows **Recording Inpatient Round Notes and Inpatient Bedside Vitals**.

**Where it is used:**
Inpatient Workspace -> 'Add Round Note' button, 'Record Bedside Vitals' button.

**Actual Usage:**
Recording daily nursing/physician round observations (`POST /round-notes`) and bedside vitals (`POST /vitals`).

**UI Behavior & Elements:**
'Add Round Note' button; 'Record Vitals' button on Inpatient Chart.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/inpatients/:id/round-notes, POST /api/admissions/inpatients/:id/vitals`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Add Round Note and Record Vitals buttons are hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Critical: Controls **Record Inpatient Round Note** and **Record Inpatient Vitals**. Missing in baseline nurse/doctor seeds.

---

### 119. Admissions → Inpatient Admissions → Edit
- **Permission Code:** `ADMISSIONS_INPATIENT_ADMISSIONS_EDIT`
- **Display Name:** Edit Inpatient Admissions
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Inpatient Admissions
- **Action:** Edit

**What it means:**
Allows **Authoring and Saving Inpatient Discharge Summaries** (clinical course, condition at discharge, medications).

**Where it is used:**
Inpatient Workspace -> Discharge Summary tab -> 'Save Discharge Summary' button.

**Actual Usage:**
Drafting and saving medical discharge summaries (`POST /api/admissions/inpatients/:id/discharge-summary`).

**UI Behavior & Elements:**
'Save Discharge Summary' button on Inpatient chart.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/inpatients/:id/discharge-summary`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Discharge summary inputs disabled; Save button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Save Discharge Summary** action.

---

### 120. Admissions → Inpatient Admissions → Discharge
- **Permission Code:** `ADMISSIONS_INPATIENT_ADMISSIONS_DISCHARGE`
- **Display Name:** Discharge Inpatient
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Inpatient Admissions
- **Action:** Discharge

**What it means:**
Allows **Finalizing Medical Inpatient Discharge** (releasing bed to cleaning, marking admission DISCHARGED).

**Where it is used:**
Inpatient Workspace -> 'Finalize Discharge' primary button.

**Actual Usage:**
Executing medical discharge authorization (`POST /api/admissions/inpatients/:id/finalize-discharge`).

**UI Behavior & Elements:**
'Finalize Discharge' / 'Discharge Patient' button; Discharge confirmation dialog.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/inpatients/:id/finalize-discharge`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Finalize Discharge button is hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Finalize Inpatient Discharge** action.

---

### 121. Admissions → Admission Recommendations → View
- **Permission Code:** `ADMISSIONS_ADMISSION_RECOMMENDATIONS_VIEW`
- **Display Name:** View Admission Recommendations
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Admission Recommendations
- **Action:** View

**What it means:**
Allows viewing physician admission recommendation orders.

**Where it is used:**
Consultation Workspace -> Recommendations card; Inpatient admissions queue.

**Actual Usage:**
Inspecting recommended admissions.

**UI Behavior & Elements:**
Admission Recommendation badge/card.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Implicitly queried in admission request feeds.`

**Current Seeded Roles:**
SUPER_ADMIN, DOCTOR

**Without Permission Behavior:**
Recommendation details hidden.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `No`

---

### 122. Admissions → Admission Recommendations → Create
- **Permission Code:** `ADMISSIONS_ADMISSION_RECOMMENDATIONS_CREATE`
- **Display Name:** Create Admission Recommendations
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Admission Recommendations
- **Action:** Create

**What it means:**
Allows **Recommending Inpatient Admission** (doctor issuing clinical order to admit patient).

**Where it is used:**
Consultation Workspace -> 'Recommend IP Admission' button.

**Actual Usage:**
Submitting physician admission recommendations (`POST /api/admissions/recommendations`).

**UI Behavior & Elements:**
'Recommend Admission' button on consultation workspace; Provisional diagnosis & ward recommendation form.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/recommendations`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Recommend Admission button hidden; POST /recommendations returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Create Admission Recommendation** action.

---

### 123. Admissions → Admission Recommendations → Cancel
- **Permission Code:** `ADMISSIONS_ADMISSION_RECOMMENDATIONS_CANCEL`
- **Display Name:** Cancel Admission Recommendations
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Admission Recommendations
- **Action:** Cancel

**What it means:**
Allows canceling unfulfilled doctor admission recommendations.

**Where it is used:**
Doctor Workspace -> Cancel Recommendation button.

**Actual Usage:**
Canceling admission recommendations if patient condition improves.

**UI Behavior & Elements:**
'Cancel Recommendation' button in Doctor workspace.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Enforced in recommendation cancellation handlers.`

**Current Seeded Roles:**
SUPER_ADMIN, DOCTOR

**Without Permission Behavior:**
Cancel button hidden.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Cancel Admission Recommendation**.

---

### 124. Admissions → Admission Requests → View
- **Permission Code:** `ADMISSIONS_ADMISSION_REQUESTS_VIEW`
- **Display Name:** View Admission Requests
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Admission Requests
- **Action:** View

**What it means:**
Allows viewing the admission request work queue, pending requests, stats, and request details.

**Where it is used:**
Admission Requests page (`InpatientAdmissionPage.tsx`).

**Actual Usage:**
Monitoring incoming requests from OPD/Emergency/External for bed allotment and admission processing.

**UI Behavior & Elements:**
Admission Requests sidebar link; Request queue table; Request Status stats cards.

**Route Protection:**
`/admissions/inpatients, /admissions/requests`

**Backend Endpoint & Guard:**
`GET /api/admissions/requests, GET /api/admissions/requests/:id, GET /api/admissions/request-stats`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE

**Without Permission Behavior:**
Admission Requests page returns Access Denied; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Core admissions desk view permission.

---

### 125. Admissions → Admission Requests → Create
- **Permission Code:** `ADMISSIONS_ADMISSION_REQUESTS_CREATE`
- **Display Name:** Create Admission Requests
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Admission Requests
- **Action:** Create

**What it means:**
Allows **Creating Admission Requests** (intake desk initiating admission workflow for a patient).

**Where it is used:**
Admission Requests page -> 'New Admission Request' button.

**Actual Usage:**
Registering admission requests for walk-in or referred patients (`POST /api/admissions/requests`).

**UI Behavior & Elements:**
'New Admission Request' primary button; Request form modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/requests`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST

**Without Permission Behavior:**
New Request button hidden; POST /api/admissions/requests returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Create Admission Request**.

---

### 126. Admissions → Admission Requests → Validate
- **Permission Code:** `ADMISSIONS_ADMISSION_REQUESTS_VALIDATE`
- **Display Name:** Validate Admission Requests
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Admission Requests
- **Action:** Validate

**What it means:**
Allows **Validating Admission Requests** (checking required documents, advance deposit clearance, and assigning bed).

**Where it is used:**
Admission Requests page -> 'Validate Request' action modal.

**Actual Usage:**
Transitioning request from PENDING -> VALIDATED (`PATCH /api/admissions/requests/:id/validate`).

**UI Behavior & Elements:**
'Validate' button in request table; Validate Request modal with checklist.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/admissions/requests/:id/validate`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST

**Without Permission Behavior:**
Validate button hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Validate Admission Request**.

---

### 127. Admissions → Admission Requests → Confirm
- **Permission Code:** `ADMISSIONS_ADMISSION_REQUESTS_CONFIRM`
- **Display Name:** Confirm Admission Requests
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Admission Requests
- **Action:** Confirm

**What it means:**
Allows **Confirming Admission Requests (Admitting Patient)** (executing atomic bed occupation and creating Inpatient record).

**Where it is used:**
Admission Requests page -> 'Confirm Admission' / 'Admit Patient' action.

**Actual Usage:**
Admitting patient to bed (`POST /api/admissions/requests/:id/confirm`).

**UI Behavior & Elements:**
'Confirm Admission' / 'Admit' primary action button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/requests/:id/confirm`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST

**Without Permission Behavior:**
Confirm Admission button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Confirm Admission / Admit Patient** action.

---

### 128. Admissions → Admission Requests → Cancel
- **Permission Code:** `ADMISSIONS_ADMISSION_REQUESTS_CANCEL`
- **Display Name:** Cancel Admission Requests
- **Category:** `CLINICAL` | **Group:** `ADMISSIONS`
- **Module:** Admissions
- **Screen:** Admission Requests
- **Action:** Cancel

**What it means:**
Allows **Canceling Admission Requests** (voiding rejected or unfulfilled admission requests).

**Where it is used:**
Admission Requests page -> 'Cancel Request' action.

**Actual Usage:**
Canceling admission requests with mandatory audit reason (`POST /api/admissions/requests/:id/cancel`).

**UI Behavior & Elements:**
'Cancel Request' button; Reason modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/admissions/requests/:id/cancel`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST

**Without Permission Behavior:**
Cancel button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Cancel Admission Request** action.

---

### 129. Surgery → Recommendations → View
- **Permission Code:** `SURGERY_RECOMMENDATIONS_VIEW`
- **Display Name:** View Surgery Recommendations
- **Category:** `CLINICAL` | **Group:** `SURGERY`
- **Module:** Surgery
- **Screen:** Recommendations
- **Action:** View

**What it means:**
Allows viewing surgical and procedure recommendations, pre-op prerequisites, and clinical indication.

**Where it is used:**
Surgery Workspace page (`SurgeryWorkspacePage.tsx`), Recommendations tab.

**Actual Usage:**
Reviewing recommended procedures and scheduling theater slots.

**UI Behavior & Elements:**
Surgery & Procedures sidebar link (any-permission gate); Recommendations tab.

**Route Protection:**
`/surgery, /surgery/recommendations`

**Backend Endpoint & Guard:**
`GET /api/surgery/recommendations`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR

**Without Permission Behavior:**
Recommendations tab hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 130. Surgery → Recommendations → Create
- **Permission Code:** `SURGERY_RECOMMENDATIONS_CREATE`
- **Display Name:** Create Surgery Recommendations
- **Category:** `CLINICAL` | **Group:** `SURGERY`
- **Module:** Surgery
- **Screen:** Recommendations
- **Action:** Create

**What it means:**
Allows **Recommending Surgery / Procedures** (doctor creating surgery order with procedure code and anesthesia type).

**Where it is used:**
Consultation Workspace -> 'Recommend Procedure' button; Surgery Workspace -> 'New Recommendation' button.

**Actual Usage:**
Submitting surgical recommendations (`POST /api/surgery/recommendations`).

**UI Behavior & Elements:**
'Recommend Surgery' button on consultation; Procedure selection modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/surgery/recommendations`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Recommend Surgery button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Recommend Surgery / Procedure** action.

---

### 131. Surgery → Recommendations → Cancel
- **Permission Code:** `SURGERY_RECOMMENDATIONS_CANCEL`
- **Display Name:** Cancel Surgery Recommendations
- **Category:** `CLINICAL` | **Group:** `SURGERY`
- **Module:** Surgery
- **Screen:** Recommendations
- **Action:** Cancel

**What it means:**
Allows **Canceling Surgery Recommendations** if patient or clinical condition changes.

**Where it is used:**
Surgery Workspace -> Recommendations tab -> 'Cancel Recommendation' button.

**Actual Usage:**
Canceling surgery recommendations with mandatory reason (`POST /api/surgery/recommendations/:id/cancel`).

**UI Behavior & Elements:**
'Cancel Recommendation' button; Reason dialog.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/surgery/recommendations/:id/cancel`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Cancel button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Cancel Surgery Recommendation** action.

---

### 132. Surgery → Bookings → View
- **Permission Code:** `SURGERY_BOOKINGS_VIEW`
- **Display Name:** View Surgery Bookings
- **Category:** `CLINICAL` | **Group:** `SURGERY`
- **Module:** Surgery
- **Screen:** Bookings
- **Action:** View

**What it means:**
Allows viewing surgical procedure bookings, scheduled OT times, lead surgeon, and booking statuses.

**Where it is used:**
Surgery Workspace -> Bookings tab; Inpatient procedure schedule.

**Actual Usage:**
Monitoring OT bookings and procedure timelines.

**UI Behavior & Elements:**
Bookings tab; Surgery booking list table; Booking detail modal.

**Route Protection:**
`/surgery, /surgery/bookings`

**Backend Endpoint & Guard:**
`GET /api/surgery/bookings, GET /api/surgery/bookings/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR

**Without Permission Behavior:**
Bookings tab hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 133. Surgery → Bookings → Create
- **Permission Code:** `SURGERY_BOOKINGS_CREATE`
- **Display Name:** Create Surgery Bookings
- **Category:** `CLINICAL` | **Group:** `SURGERY`
- **Module:** Surgery
- **Screen:** Bookings
- **Action:** Create

**What it means:**
Allows **Booking Surgery / Procedure Slots** (allocating operating theater, date, start/end time, and surgical team).

**Where it is used:**
Surgery Workspace -> 'Book Surgery' / 'Book Procedure' action modal.

**Actual Usage:**
Reserving OT theater time slots (`POST /api/surgery/bookings`).

**UI Behavior & Elements:**
'Book Slot' button; Surgery Booking modal with theater & timing pickers.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/surgery/bookings`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR

**Without Permission Behavior:**
Book Surgery button hidden; POST /api/surgery/bookings returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Book Surgery / Procedure** action.

---

### 134. Surgery → Bookings → Confirm
- **Permission Code:** `SURGERY_BOOKINGS_CONFIRM`
- **Display Name:** Confirm Surgery Bookings
- **Category:** `CLINICAL` | **Group:** `SURGERY`
- **Module:** Surgery
- **Screen:** Bookings
- **Action:** Confirm

**What it means:**
Allows **Confirming Surgery Bookings** (after verifying pre-op fitness, consent, and advance deposit).

**Where it is used:**
Surgery Workspace -> 'Confirm Booking' action button.

**Actual Usage:**
Transitioning booking status from REQUESTED -> CONFIRMED (`POST /api/surgery/bookings/:id/confirm`).

**UI Behavior & Elements:**
'Confirm Booking' action button in bookings table.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/surgery/bookings/:id/confirm`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR

**Without Permission Behavior:**
Confirm Booking button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Confirm Surgery Booking** action.

---

### 135. Surgery → Bookings → Reschedule
- **Permission Code:** `SURGERY_BOOKINGS_RESCHEDULE`
- **Display Name:** Reschedule Surgery Bookings
- **Category:** `CLINICAL` | **Group:** `SURGERY`
- **Module:** Surgery
- **Screen:** Bookings
- **Action:** Reschedule

**What it means:**
Allows **Rescheduling Surgery Bookings** (changing OT room, date, or procedure start time).

**Where it is used:**
Surgery Workspace -> 'Reschedule Booking' modal dialog.

**Actual Usage:**
Updating OT slot reservation timings (`POST /api/surgery/bookings/:id/reschedule`).

**UI Behavior & Elements:**
'Reschedule' button in booking actions; Reschedule Surgery modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/surgery/bookings/:id/reschedule`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR

**Without Permission Behavior:**
Reschedule button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Reschedule Surgery Booking** action.

---

### 136. Surgery → Bookings → Cancel
- **Permission Code:** `SURGERY_BOOKINGS_CANCEL`
- **Display Name:** Cancel Surgery Bookings
- **Category:** `CLINICAL` | **Group:** `SURGERY`
- **Module:** Surgery
- **Screen:** Bookings
- **Action:** Cancel

**What it means:**
Allows **Canceling Booked Surgeries**.

**Where it is used:**
Surgery Workspace -> 'Cancel Booking' action.

**Actual Usage:**
Canceling booked surgeries with mandatory cancellation reason (`POST /api/surgery/bookings/:id/cancel`).

**UI Behavior & Elements:**
'Cancel Booking' button; Reason modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/surgery/bookings/:id/cancel`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR

**Without Permission Behavior:**
Cancel button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Cancel Surgery Booking** action.

---

### 137. Surgery → Bookings → Complete
- **Permission Code:** `SURGERY_BOOKINGS_COMPLETE`
- **Display Name:** Complete Surgery Bookings
- **Category:** `CLINICAL` | **Group:** `SURGERY`
- **Module:** Surgery
- **Screen:** Bookings
- **Action:** Complete

**What it means:**
Allows **Completing Surgery / Procedures** (marking surgery completed, documenting operative summary).

**Where it is used:**
Surgery Workspace -> 'Complete Surgery' action button.

**Actual Usage:**
Finalizing surgical procedures and releasing OT room (`POST /api/surgery/bookings/:id/complete`).

**UI Behavior & Elements:**
'Complete Surgery' / 'Mark Completed' primary action button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/surgery/bookings/:id/complete`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Complete button hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Complete Surgery** action.

---

### 138. Surgery → Schedule → View
- **Permission Code:** `SURGERY_SCHEDULE_VIEW`
- **Display Name:** View Surgery Schedule
- **Category:** `CLINICAL` | **Group:** `SURGERY`
- **Module:** Surgery
- **Screen:** Schedule
- **Action:** View

**What it means:**
Allows viewing Operating Theater schedule grids, OT slot availability, and slot conflict alternatives.

**Where it is used:**
Surgery Workspace -> Schedule tab; Theater calendar view.

**Actual Usage:**
Inspecting OT theater occupancy and calculating alternative open slots (`GET /api/surgery/availability/alternatives`).

**UI Behavior & Elements:**
Schedule tab; Theater timeline grid; Slot alternatives helper.

**Route Protection:**
`/surgery, /surgery/schedule`

**Backend Endpoint & Guard:**
`GET /api/surgery/schedule, GET /api/surgery/availability/alternatives`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR

**Without Permission Behavior:**
Schedule tab hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 139. Emergency → Encounters → View
- **Permission Code:** `EMERGENCY_ENCOUNTERS_VIEW`
- **Display Name:** View Emergency Encounters
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Encounters
- **Action:** View

**What it means:**
Allows viewing emergency department arrivals, live emergency queue, trauma cases, and emergency summary metrics.

**Where it is used:**
Emergency Dashboard (`EmergencyDashboardPage.tsx`), Emergency Queue (`EmergencyQueuePage.tsx`), Emergency Workspace (`EmergencyWorkspacePage.tsx`).

**Actual Usage:**
Monitoring active emergency census, triage priority badges, and attending doctor assignments.

**UI Behavior & Elements:**
Emergency Dashboard sidebar link; Emergency Queue sidebar link; Emergency table; Emergency case cards.

**Route Protection:**
`/emergency, /emergency/queue, /emergency/workspace`

**Backend Endpoint & Guard:**
`GET /api/emergency/encounters, GET /api/emergency/summary, GET /api/emergency/encounters/:id`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Emergency module screens return Access Denied; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Core emergency module entry permission.

---

### 140. Emergency → Encounters → Register
- **Permission Code:** `EMERGENCY_ENCOUNTERS_REGISTER`
- **Display Name:** Register Emergency Encounters
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Encounters
- **Action:** Register

**What it means:**
Allows **Registering New Emergency Arrivals** (intake of walk-in, ambulance, or unidentified trauma patients).

**Where it is used:**
Emergency Dashboard / Queue -> 'Register Emergency Patient' button.

**Actual Usage:**
Registering emergency encounters with chief complaint, arrival mode, and temporary identity (`POST /api/emergency/encounters`).

**UI Behavior & Elements:**
'Register Emergency Patient' / 'New Arrival' primary button; Emergency intake modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/emergency/encounters`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST

**Without Permission Behavior:**
Register Emergency Patient button hidden; POST returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Register Emergency Patient** action.

---

### 141. Emergency → Encounters → Edit
- **Permission Code:** `EMERGENCY_ENCOUNTERS_EDIT`
- **Display Name:** Edit Emergency Encounters
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Encounters
- **Action:** Edit

**What it means:**
Allows editing general emergency encounter details and updating arrival modes.

**Where it is used:**
Emergency Workspace -> Edit Encounter details modal.

**Actual Usage:**
Updating emergency demographic/arrival info.

**UI Behavior & Elements:**
'Edit Encounter' button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Enforced in encounter updating handlers.`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Edit option hidden.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

---

### 142. Emergency → Triage → View
- **Permission Code:** `EMERGENCY_TRIAGE_VIEW`
- **Display Name:** View Emergency Triage
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Triage
- **Action:** View

**What it means:**
Allows viewing emergency triage scores, assigned triage levels (Levels 1-5), and vital signs at intake.

**Where it is used:**
Emergency Queue -> Triage priority badge; Emergency Workspace -> Triage Assessment card.

**Actual Usage:**
Inspecting triage severity and physiological parameters.

**UI Behavior & Elements:**
Triage severity badge (Red/Orange/Yellow/Green/Blue); Triage history card.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Checked when fetching triage detail in GET /api/emergency/encounters/:id (redacts triage if missing).`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Triage clinical notes are redacted in API response; Triage card is hidden in UI.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Backend explicitly redacts triage clinical detail if user lacks this permission.

---

### 143. Emergency → Triage → Assess
- **Permission Code:** `EMERGENCY_TRIAGE_ASSESS`
- **Display Name:** Perform Triage Assessment
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Triage
- **Action:** Assess

**What it means:**
Allows **Performing Emergency Triage Assessment** (recording primary complaint, baseline vitals, and assigning initial triage priority level).

**Where it is used:**
Emergency Queue -> 'Triage' button; Triage Assessment modal dialog.

**Actual Usage:**
Nursing triage: scoring patient acuity (`POST /api/emergency/encounters/:id/triage`).

**UI Behavior & Elements:**
'Perform Triage' / 'Triage Patient' action button in Emergency queue; Triage assessment form.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/emergency/encounters/:id/triage`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, CLINICIAN_NURSE

**Without Permission Behavior:**
Triage button hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Perform Triage Assessment** action.

---

### 144. Emergency → Triage → OverridePriority
- **Permission Code:** `EMERGENCY_TRIAGE_OVERRIDE_PRIORITY`
- **Display Name:** Override Triage Priority
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Triage
- **Action:** OverridePriority

**What it means:**
Allows **Overriding Triage Priority Level** with a mandatory clinical justification.

**Where it is used:**
Emergency Workspace -> 'Override Priority' button / modal.

**Actual Usage:**
Elevating or lowering triage category due to clinical deterioration or re-evaluation (`POST /api/emergency/encounters/:id/override-priority`).

**UI Behavior & Elements:**
'Override Priority' button; Priority selector & mandatory clinical rationale input.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/emergency/encounters/:id/override-priority`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Override Priority button is hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Override Triage Priority** action.

---

### 145. Emergency → Consultation → View
- **Permission Code:** `EMERGENCY_CONSULTATION_VIEW`
- **Display Name:** View Emergency Consultation
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Consultation
- **Action:** View

**What it means:**
Allows viewing doctor emergency clinical notes, medical examination findings, and diagnosis.

**Where it is used:**
Emergency Workspace -> Doctor Consultation card; Patient Timeline.

**Actual Usage:**
Reviewing physician emergency evaluation.

**UI Behavior & Elements:**
Emergency Consultation card.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Checked in GET /api/emergency/encounters/:id (redacts consultation if missing).`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, CLINICIAN_NURSE, DOCTOR

**Without Permission Behavior:**
Consultation details are redacted by backend (returns null); UI card is hidden.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Backend explicitly redacts consultation notes if user lacks this permission.

---

### 146. Emergency → Consultation → Edit
- **Permission Code:** `EMERGENCY_CONSULTATION_EDIT`
- **Display Name:** Edit Emergency Consultation
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Consultation
- **Action:** Edit

**What it means:**
Allows **Calling Emergency Patients**, **Skipping Patients**, and **Saving Doctor Clinical Evaluations**.

**Where it is used:**
Emergency Workspace -> 'Call Patient' button, 'Skip' button, 'Save Consultation' button.

**Actual Usage:**
Doctor emergency intake (`POST /call`, `POST /skip`, `PUT /consultation`).

**UI Behavior & Elements:**
'Call Patient' button; 'Save Consultation' button on Emergency doctor evaluation form.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/emergency/encounters/:id/call, POST /api/emergency/encounters/:id/skip, PUT /api/emergency/encounters/:id/consultation, POST /api/emergency/encounters/:id/referral`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Call Patient and Save Consultation buttons disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Emergency Doctor Evaluation** and emergency queue progression.

---

### 147. Emergency → Orders → View
- **Permission Code:** `EMERGENCY_ORDERS_VIEW`
- **Display Name:** View Emergency Orders
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Orders
- **Action:** View

**What it means:**
Allows viewing STAT emergency medication orders, laboratory requisitions, and imaging orders.

**Where it is used:**
Emergency Workspace -> Orders list tab; Emergency nursing administration sheet.

**Actual Usage:**
Reviewing emergency doctor orders to administer medications or prepare tests.

**UI Behavior & Elements:**
Emergency Orders list table; Order status badges.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Checked in GET /api/emergency/encounters/:id (redacts orders to empty array if missing).`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Orders list is redacted by backend (returns []); Orders tab hidden in UI.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Backend explicitly redacts orders if user lacks this permission. Missing from baseline Nurse seed.

---

### 148. Emergency → Orders → Create
- **Permission Code:** `EMERGENCY_ORDERS_CREATE`
- **Display Name:** Create Emergency Orders
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Orders
- **Action:** Create

**What it means:**
Allows **Ordering STAT Emergency Medications, Lab Tests, and Imaging Studies**.

**Where it is used:**
Emergency Workspace -> 'Add Emergency Order' modal dialog.

**Actual Usage:**
Placing urgent diagnostic and pharmaceutical orders (`POST /api/emergency/encounters/:id/orders`).

**UI Behavior & Elements:**
'Add Order' button; STAT order builder modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/emergency/encounters/:id/orders`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Add Order button hidden; POST returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Create Emergency Orders**.

---

### 149. Emergency → Disposition → View
- **Permission Code:** `EMERGENCY_DISPOSITION_VIEW`
- **Display Name:** View Emergency Disposition
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Disposition
- **Action:** View

**What it means:**
Allows viewing the final emergency disposition decision (Discharged, Transferred, Admitted to IP, Left Against Medical Advice, Deceased).

**Where it is used:**
Emergency Workspace -> Disposition status card; Emergency audit trail.

**Actual Usage:**
Checking patient discharge/transfer status.

**UI Behavior & Elements:**
Disposition status banner; Disposition summary drawer.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Checked in GET /api/emergency/encounters/:id (redacts disposition if missing).`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Disposition detail is redacted by backend (returns null); UI banner is hidden.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Backend explicitly redacts disposition data if user lacks this permission.

---

### 150. Emergency → Disposition → Discharge
- **Permission Code:** `EMERGENCY_DISPOSITION_DISCHARGE`
- **Display Name:** Emergency Discharge
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Disposition
- **Action:** Discharge

**What it means:**
Allows **Discharging Stabilized Patients Directly from Emergency**.

**Where it is used:**
Emergency Workspace -> Disposition panel -> 'Discharge Patient' action.

**Actual Usage:**
Finalizing emergency discharge (`POST /api/emergency/encounters/:id/disposition` with `decision: 'DISCHARGE'`).

**UI Behavior & Elements:**
'Discharge' button in Emergency disposition action bar.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Checked inside dispositionPermission guard in POST /api/emergency/encounters/:id/disposition`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Discharge button hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Emergency Discharge** action.

---

### 151. Emergency → Disposition → Transfer
- **Permission Code:** `EMERGENCY_DISPOSITION_TRANSFER`
- **Display Name:** Emergency Transfer
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Disposition
- **Action:** Transfer

**What it means:**
Allows **Transferring Emergency Patients to External Healthcare Facilities**.

**Where it is used:**
Emergency Workspace -> Disposition panel -> 'Transfer' action.

**Actual Usage:**
Executing inter-hospital emergency transfers (`POST /disposition` with `decision: 'TRANSFER'`).

**UI Behavior & Elements:**
'Transfer to External Facility' button; Facility destination modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Checked inside dispositionPermission guard in POST /api/emergency/encounters/:id/disposition`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Transfer button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Emergency Transfer** action.

---

### 152. Emergency → Disposition → ConvertToIP
- **Permission Code:** `EMERGENCY_DISPOSITION_CONVERT_TO_IP`
- **Display Name:** Convert to Inpatient
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Disposition
- **Action:** ConvertToIP

**What it means:**
Allows **Converting Emergency Encounters to Inpatient Admissions**.

**Where it is used:**
Emergency Workspace -> Disposition panel -> 'Admit to Inpatient' action.

**Actual Usage:**
Triggering Emergency-to-IP conversion workflow (`POST /disposition` with `decision: 'ADMIT'`).

**UI Behavior & Elements:**
'Admit as Inpatient' primary action button; Inpatient admission request pre-fill modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`Checked inside dispositionPermission guard in POST /api/emergency/encounters/:id/disposition`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Admit as Inpatient button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Emergency Convert to Inpatient** action.

---

### 153. Emergency → Disposition → MarkLeft
- **Permission Code:** `EMERGENCY_DISPOSITION_MARK_LEFT`
- **Display Name:** Mark Patient as Left
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Disposition
- **Action:** MarkLeft

**What it means:**
Allows **Marking Emergency Patients as Left Against Medical Advice (LAMA / DAMA)**.

**Where it is used:**
Emergency Workspace -> Disposition panel -> 'Mark as Left' action.

**Actual Usage:**
Documenting uncompleted visits when patient leaves without clinical discharge (`POST /api/emergency/encounters/:id/left`).

**UI Behavior & Elements:**
'Mark as Left' / 'LAMA' button; Reason modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/emergency/encounters/:id/left, POST /api/emergency/encounters/:id/disposition (decision: 'LEFT')`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, DOCTOR

**Without Permission Behavior:**
Mark as Left button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Emergency Mark as Left** action.

---

### 154. Emergency → Disposition → MarkNoShow
- **Permission Code:** `EMERGENCY_DISPOSITION_MARK_NO_SHOW`
- **Display Name:** Mark No-Show
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Disposition
- **Action:** MarkNoShow

**What it means:**
Allows **Marking Registered Emergency Cases as No-Show**.

**Where it is used:**
Emergency Queue row actions -> 'Mark No-Show' action.

**Actual Usage:**
Canceling emergency cases where patient was registered but never presented (`POST /api/emergency/encounters/:id/no-show`).

**UI Behavior & Elements:**
'No-Show' button in Emergency Queue.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/emergency/encounters/:id/no-show`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
No-Show button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Emergency Mark No-Show** action.

---

### 155. Emergency → Disposition → Cancel
- **Permission Code:** `EMERGENCY_DISPOSITION_CANCEL`
- **Display Name:** Cancel Emergency Encounter
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Disposition
- **Action:** Cancel

**What it means:**
Allows **Canceling Erroneously Created Emergency Encounters**.

**Where it is used:**
Emergency Queue row actions -> 'Cancel Encounter' action.

**Actual Usage:**
Voiding emergency encounter records (`POST /api/emergency/encounters/:id/cancel`).

**UI Behavior & Elements:**
'Cancel Encounter' button; Reason modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/emergency/encounters/:id/cancel`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Cancel button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Emergency Cancel Encounter** action.

---

### 156. Emergency → Patient Linking → Link
- **Permission Code:** `EMERGENCY_PATIENT_LINKING_LINK`
- **Display Name:** Link Emergency Patient
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Patient Linking
- **Action:** Link

**What it means:**
Allows **Linking Unknown/Trauma Emergency Patients to Verified Patient Master Records**.

**Where it is used:**
Emergency Workspace -> 'Link Patient' action banner / modal.

**Actual Usage:**
Merging emergency encounter records once identity is established (`POST /api/emergency/encounters/:id/link-patient`).

**UI Behavior & Elements:**
'Link Patient Identity' button; Patient Master Search modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/emergency/encounters/:id/link-patient`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR, RECEPTIONIST, DOCTOR

**Without Permission Behavior:**
Link Patient button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Link Unknown Patient** action.

---

### 157. Emergency → Patient Linking → Correct
- **Permission Code:** `EMERGENCY_PATIENT_LINKING_CORRECT`
- **Display Name:** Correct Emergency Patient Link
- **Category:** `CLINICAL` | **Group:** `EMERGENCY`
- **Module:** Emergency
- **Screen:** Patient Linking
- **Action:** Correct

**What it means:**
Allows **Correcting Erroneously Linked Emergency Patient Identifiers**.

**Where it is used:**
Emergency Workspace -> 'Correct Patient Link' action.

**Actual Usage:**
Remapping an encounter that was incorrectly linked to the wrong MRN (`POST /api/emergency/encounters/:id/correct-patient`).

**UI Behavior & Elements:**
'Correct Link' button; Override confirmation dialog.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/emergency/encounters/:id/correct-patient`

**Current Seeded Roles:**
SUPER_ADMIN, ADMINISTRATOR

**Without Permission Behavior:**
Correct Link button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Correct Emergency Patient Link** action.

---

### 158. Laboratory → Orders → View
- **Permission Code:** `LABORATORY_ORDERS_VIEW`
- **Display Name:** View Laboratory Orders
- **Category:** `CLINICAL` | **Group:** `LABORATORY`
- **Module:** Laboratory
- **Screen:** Orders
- **Action:** View

**What it means:**
Allows viewing the diagnostic laboratory work queue, ordered lab tests, specimen status, and test results.

**Where it is used:**
Laboratory Dashboard (`LaboratoryQueuePage.tsx`), Laboratory Results page (`LaboratoryResultEntryPage.tsx`).

**Actual Usage:**
Accessing lab work queue, filtering tests by priority (STAT/Routine), and reviewing test summaries.

**UI Behavior & Elements:**
Laboratory Work Queue sidebar link; Lab order table; Lab Summary statistics tiles; Test detail view.

**Route Protection:**
`/laboratory, /laboratory/queue, /laboratory/workspace, /laboratory/reports, /laboratory/results`

**Backend Endpoint & Guard:**
`GET /api/laboratory/orders, GET /api/laboratory/orders/:id, GET /api/laboratory/orders/:id/results, GET /api/laboratory/summary`

**Current Seeded Roles:**
SUPER_ADMIN, LABORATORY_USER

**Without Permission Behavior:**
Laboratory module pages return Access Denied; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Core diagnostic laboratory view permission.

---

### 159. Laboratory → Orders → Edit
- **Permission Code:** `LABORATORY_ORDERS_EDIT`
- **Display Name:** Edit Laboratory Orders
- **Category:** `CLINICAL` | **Group:** `LABORATORY`
- **Module:** Laboratory
- **Screen:** Orders
- **Action:** Edit

**What it means:**
Allows **Updating Specimen Collection & Test Processing Status** (`IN_PROGRESS`, `REJECTED`, `CANCELLED`).

**Where it is used:**
Laboratory Work Queue -> Status action buttons ('Collect Specimen', 'Start Processing', 'Reject Specimen').

**Actual Usage:**
Advancing laboratory specimen processing stages (`PATCH /api/laboratory/orders/:id/status`).

**UI Behavior & Elements:**
'Collect Sample' button; 'Start Test' button; 'Reject Specimen' modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/laboratory/orders/:id/status (checked when status !== 'VERIFIED')`

**Current Seeded Roles:**
SUPER_ADMIN, LABORATORY_USER

**Without Permission Behavior:**
Status action buttons hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls general order status transitions.

---

### 160. Laboratory → Orders → EnterResult
- **Permission Code:** `LABORATORY_ORDERS_ENTER_RESULT`
- **Display Name:** Enter Laboratory Result
- **Category:** `CLINICAL` | **Group:** `LABORATORY`
- **Module:** Laboratory
- **Screen:** Orders
- **Action:** EnterResult

**What it means:**
Allows **Entering Laboratory Test Results** (recording quantitative values, reference intervals, units, and abnormal flags).

**Where it is used:**
Laboratory Results Workspace -> Test parameter result entry form -> 'Save Results' button.

**Actual Usage:**
Drafting and saving lab investigation findings (`POST /api/laboratory/orders/:id/results`, `PATCH /api/laboratory/orders/:id/results`).

**UI Behavior & Elements:**
'Enter Results' button in queue; Result input fields; 'Save Draft' button in Results modal.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/laboratory/orders/:id/results, PATCH /api/laboratory/orders/:id/results`

**Current Seeded Roles:**
SUPER_ADMIN, LABORATORY_USER

**Without Permission Behavior:**
Result inputs are read-only; Save button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Enter Lab Result** action without granting verification authority.

---

### 161. Laboratory → Orders → VerifyResult
- **Permission Code:** `LABORATORY_ORDERS_VERIFY_RESULT`
- **Display Name:** Verify Laboratory Result
- **Category:** `CLINICAL` | **Group:** `LABORATORY`
- **Module:** Laboratory
- **Screen:** Orders
- **Action:** VerifyResult

**What it means:**
Allows **Verifying and Authorizing Final Laboratory Reports** for clinical release into the patient EMR.

**Where it is used:**
Laboratory Results Workspace -> 'Verify & Publish Result' primary action button.

**Actual Usage:**
Transitioning laboratory order to `VERIFIED` status (`PATCH /api/laboratory/orders/:id/status` with `status: 'VERIFIED'`).

**UI Behavior & Elements:**
'Verify Result' / 'Approve & Release' button on Results Workspace.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/laboratory/orders/:id/status (checked when status === 'VERIFIED')`

**Current Seeded Roles:**
SUPER_ADMIN, LABORATORY_USER

**Without Permission Behavior:**
Verify button is hidden/disabled; Status update to VERIFIED returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Verify Lab Result** action.

---

### 162. Imaging → Orders → View
- **Permission Code:** `IMAGING_ORDERS_VIEW`
- **Display Name:** View Imaging Orders
- **Category:** `CLINICAL` | **Group:** `IMAGING`
- **Module:** Imaging
- **Screen:** Orders
- **Action:** View

**What it means:**
Allows viewing radiological imaging work queue, study requisitions, modality types (X-Ray, CT, MRI, USG), and radiology reports.

**Where it is used:**
Imaging Dashboard (`ImagingQueuePage.tsx`), Imaging Reports page (`ImagingReportEntryPage.tsx`).

**Actual Usage:**
Monitoring pending radiology orders, reviewing image scans, and inspecting diagnostic impressions.

**UI Behavior & Elements:**
Imaging Work Queue sidebar link; Imaging orders table; Study detail modal; Summary statistics cards.

**Route Protection:**
`/imaging, /imaging/queue, /imaging/workspace, /imaging/reports`

**Backend Endpoint & Guard:**
`GET /api/imaging/orders, GET /api/imaging/orders/:id, GET /api/imaging/orders/:id/report, GET /api/imaging/summary`

**Current Seeded Roles:**
SUPER_ADMIN, IMAGING_USER

**Without Permission Behavior:**
Imaging module pages return Access Denied; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Core radiology and imaging view permission.

---

### 163. Imaging → Orders → Edit
- **Permission Code:** `IMAGING_ORDERS_EDIT`
- **Display Name:** Edit Imaging Orders
- **Category:** `CLINICAL` | **Group:** `IMAGING`
- **Module:** Imaging
- **Screen:** Orders
- **Action:** Edit

**What it means:**
Allows **Updating Imaging Study Processing Status** (`IN_PROGRESS`, `COMPLETED`, `CANCELLED`).

**Where it is used:**
Imaging Work Queue -> Status action buttons ('Start Scan', 'Complete Scan', 'Cancel Study').

**Actual Usage:**
Advancing radiological scan execution stages (`PATCH /api/imaging/orders/:id/status`).

**UI Behavior & Elements:**
'Start Scan' button; 'Complete Scan' button; 'Cancel Order' button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/imaging/orders/:id/status (checked when status !== 'VERIFIED')`

**Current Seeded Roles:**
SUPER_ADMIN, IMAGING_USER

**Without Permission Behavior:**
Status buttons disabled/hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls study execution status updates.

---

### 164. Imaging → Orders → EnterReport
- **Permission Code:** `IMAGING_ORDERS_ENTER_REPORT`
- **Display Name:** Enter Imaging Report
- **Category:** `CLINICAL` | **Group:** `IMAGING`
- **Module:** Imaging
- **Screen:** Orders
- **Action:** EnterReport

**What it means:**
Allows **Entering Radiology Findings & Uploading DICOM/Image Attachments**.

**Where it is used:**
Imaging Reports Workspace -> Findings text editor -> 'Save Draft Report' button; Image upload dropzone.

**Actual Usage:**
Drafting radiological findings, impressions, and recommendations (`POST /api/imaging/orders/:id/report`, `PATCH /api/imaging/orders/:id/report`).

**UI Behavior & Elements:**
'Enter Report' button in queue; Radiology report editor; Image attachment upload zone; 'Save Draft' button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/imaging/orders/:id/report, PATCH /api/imaging/orders/:id/report`

**Current Seeded Roles:**
SUPER_ADMIN, IMAGING_USER

**Without Permission Behavior:**
Report editor is read-only; Save button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Enter Imaging Report** action without granting verification authority.

---

### 165. Imaging → Orders → VerifyReport
- **Permission Code:** `IMAGING_ORDERS_VERIFY_REPORT`
- **Display Name:** Verify Imaging Report
- **Category:** `CLINICAL` | **Group:** `IMAGING`
- **Module:** Imaging
- **Screen:** Orders
- **Action:** VerifyReport

**What it means:**
Allows **Verifying and Authorizing Final Radiology Reports** for clinical release.

**Where it is used:**
Imaging Reports Workspace -> 'Verify & Finalize Report' primary action button.

**Actual Usage:**
Transitioning imaging order to `VERIFIED` status (`PATCH /api/imaging/orders/:id/status` with `status: 'VERIFIED'`).

**UI Behavior & Elements:**
'Verify Report' / 'Sign Off' button on Reports Workspace.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/imaging/orders/:id/status (checked when status === 'VERIFIED')`

**Current Seeded Roles:**
SUPER_ADMIN, IMAGING_USER

**Without Permission Behavior:**
Verify button hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Verify Imaging Report** action.

---

### 166. Billing → Invoices → View
- **Permission Code:** `BILLING_INVOICES_VIEW`
- **Display Name:** View Invoices
- **Category:** `FINANCE` | **Group:** `BILLING`
- **Module:** Billing
- **Screen:** Invoices
- **Action:** View

**What it means:**
Allows viewing invoices, billing histories, payment receipts, outstanding balances, and financial summaries.

**Where it is used:**
Billing Dashboard (`BillingDashboardPage.tsx`), Billing Workspace (`BillingWorkspacePage.tsx`), Billing History (`BillingHistoryPage.tsx`).

**Actual Usage:**
Reviewing patient billing records, checking advance deposits, and inspecting financial transaction summaries.

**UI Behavior & Elements:**
Billing Workspace sidebar link; Billing History sidebar link; Invoice list table; Revenue metrics cards.

**Route Protection:**
`/billing, /billing/workspace, /billing/history`

**Backend Endpoint & Guard:**
`GET /api/billing/invoices, GET /api/billing/invoices/:id, GET /api/billing/summary, GET /api/billing/invoices/:id/payments, GET /api/advance-payments`

**Current Seeded Roles:**
SUPER_ADMIN, BILLING_AUTHORIZED

**Without Permission Behavior:**
Billing screens return Access Denied; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Core financial and billing view permission.

---

### 167. Billing → Invoices → Create
- **Permission Code:** `BILLING_INVOICES_CREATE`
- **Display Name:** Create Invoices
- **Category:** `FINANCE` | **Group:** `BILLING`
- **Module:** Billing
- **Screen:** Invoices
- **Action:** Create

**What it means:**
Allows **Generating Invoices** (creating consolidated bills for consultations, diagnostics, medicines, and inpatient stays).

**Where it is used:**
Billing Workspace -> 'Generate Invoice' primary button; Auto-populate billing modal.

**Actual Usage:**
Submitting new invoice creation with itemized service charges (`POST /api/billing/invoices`).

**UI Behavior & Elements:**
'Generate Invoice' / 'New Bill' button; Service line item builder; 'Create Invoice' button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/billing/invoices`

**Current Seeded Roles:**
SUPER_ADMIN, BILLING_AUTHORIZED

**Without Permission Behavior:**
Create Invoice button hidden; POST /api/billing/invoices returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Create Invoice** action.

---

### 168. Billing → Invoices → Edit
- **Permission Code:** `BILLING_INVOICES_EDIT`
- **Display Name:** Edit Invoices
- **Category:** `FINANCE` | **Group:** `BILLING`
- **Module:** Billing
- **Screen:** Invoices
- **Action:** Edit

**What it means:**
Allows editing invoices, applying discounts, linking admission/procedure context, and syncing advance payment requirements.

**Where it is used:**
Billing Workspace -> Edit Line Items modal; 'Link Admission Context' action; 'Link Procedure Context' action.

**Actual Usage:**
Modifying invoice amounts, adding line items, associating invoices to admissions/procedures (`PATCH /api/billing/invoices/:id`, `PATCH /admission-context`, `POST /api/advance-payments/sync`).

**UI Behavior & Elements:**
'Edit Invoice' button; 'Link Admission' button; Discount input field; 'Update Invoice' button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`PATCH /api/billing/invoices/:id, PATCH /api/billing/invoices/:id/admission-context, PATCH /api/billing/invoices/:id/procedure-context, POST /api/advance-payments/sync`

**Current Seeded Roles:**
SUPER_ADMIN, BILLING_AUTHORIZED

**Without Permission Behavior:**
Edit Invoice and Context linking options are hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls invoice modification and clinical context association.

---

### 169. Billing → Invoices → Cancel
- **Permission Code:** `BILLING_INVOICES_CANCEL`
- **Display Name:** Cancel Invoices
- **Category:** `FINANCE` | **Group:** `BILLING`
- **Module:** Billing
- **Screen:** Invoices
- **Action:** Cancel

**What it means:**
Allows **Canceling Invoices** (voiding erroneously generated bills with mandatory audit justification).

**Where it is used:**
Billing History -> 'Cancel Invoice' action button.

**Actual Usage:**
Canceling invoices (`POST /api/billing/invoices/:id/cancel`).

**UI Behavior & Elements:**
'Cancel Invoice' button; Cancellation Reason modal dialog.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/billing/invoices/:id/cancel`

**Current Seeded Roles:**
SUPER_ADMIN, BILLING_AUTHORIZED

**Without Permission Behavior:**
Cancel Invoice button hidden; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls **Cancel Invoice** action.

---

### 170. Billing → Invoices → CollectPayment
- **Permission Code:** `BILLING_INVOICES_COLLECT_PAYMENT`
- **Display Name:** Collect Payment
- **Category:** `FINANCE` | **Group:** `BILLING`
- **Module:** Billing
- **Screen:** Invoices
- **Action:** CollectPayment

**What it means:**
Allows **Collecting Payments** against invoices across multiple payment methods (Cash, Card, UPI, Insurance, Cheque).

**Where it is used:**
Billing Workspace -> 'Collect Payment' button; Payment Collection modal dialog.

**Actual Usage:**
Recording payments, settling invoice balances, and generating transaction logs (`POST /api/billing/invoices/:id/payments`).

**UI Behavior & Elements:**
'Collect Payment' primary button; Payment method selector; Amount input; Tender confirmation button.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`POST /api/billing/invoices/:id/payments`

**Current Seeded Roles:**
SUPER_ADMIN, BILLING_AUTHORIZED

**Without Permission Behavior:**
Collect Payment button hidden/disabled; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **Collect Payment** action.

---

### 171. Billing → Invoices → ViewReceipt
- **Permission Code:** `BILLING_INVOICES_VIEW_RECEIPT`
- **Display Name:** View Receipt
- **Category:** `FINANCE` | **Group:** `BILLING`
- **Module:** Billing
- **Screen:** Invoices
- **Action:** ViewReceipt

**What it means:**
Allows **Viewing and Printing Formal Payment Receipts**.

**Where it is used:**
Billing Workspace -> 'Print Receipt' button; Payment History -> 'View Receipt' icon.

**Actual Usage:**
Rendering formal patient payment receipts and transaction vouchers (`GET /api/billing/payments/:id/receipt`).

**UI Behavior & Elements:**
'View Receipt' / 'Print Receipt' button; Receipt modal with print layout.

**Route Protection:**
`Not directly route-gated`

**Backend Endpoint & Guard:**
`GET /api/billing/payments/:id/receipt`

**Current Seeded Roles:**
SUPER_ADMIN, BILLING_AUTHORIZED

**Without Permission Behavior:**
View Receipt button is hidden; Direct receipt fetch returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Controls the **View Receipt** action.

---

### 172. Reports → Phase 2 Reports → View
- **Permission Code:** `REPORTS_PHASE_2_REPORTS_VIEW`
- **Display Name:** View Reports
- **Category:** `FINANCE` | **Group:** `REPORTS`
- **Module:** Reports
- **Screen:** Phase 2 Reports
- **Action:** View

**What it means:**
Allows viewing hospital analytics, operational summaries, and financial reports.

**Where it is used:**
Reports Library page (`PhaseTwoReportsPage.tsx`).

**Actual Usage:**
Generating and reviewing hospital performance and revenue analytics (`GET /api/reports/phase-2`).

**UI Behavior & Elements:**
Reports sidebar link; Report Library list; Report filter controls; Export Report button.

**Route Protection:**
`/reports/library`

**Backend Endpoint & Guard:**
`GET /api/reports/phase-2`

**Current Seeded Roles:**
SUPER_ADMIN, BILLING_AUTHORIZED

**Without Permission Behavior:**
Reports page returns Access Denied; API returns 403.

**Usage Status:** `Used` | **Frontend Checked:** `Yes` | **Backend Checked:** `Yes`

**Technical Notes:**
Screen is labeled 'Phase 2 Reports' in permission catalog and displays as 'Reports' in UI.

---

## 5. Permission → Business Action Mapping

In many workflows, the technical permission name differs from the user-facing action label on the button or workflow trigger. The table below provides the authoritative cross-reference:

| User Action / Button Label | Screen / Context | Exact Controlling Permission | Permission Code | Architectural Reason |
|---|---|---|---|---|
| **Check In** | Appointments / OPD Queue | `OPD → OPD Visits → Create` | `OPD_OPD_VISITS_CREATE` | Checking in an appointment creates an active OPD visit encounter. |
| **Call Next Patient** | OPD Waiting Queue | `OPD → OPD Visits → Edit` | `OPD_OPD_VISITS_EDIT` | Calling a patient advances the visit state from waiting to in-progress. |
| **Book Appointment** | Book Appointment | `Appointments → Appointment Booking → Create` | `APPOINTMENTS_APPOINTMENT_BOOKING_CREATE` | Creates a new outpatient appointment reservation. |
| **Book Referral** | Referral Booking | `OPD → OPD Referral → View & Appointments → Appointment Booking → Create` | `OPD_OPD_REFERRAL_VIEW + APPOINTMENTS_APPOINTMENT_BOOKING_CREATE` | Consumes a clinical referral order to book a new appointment. |
| **Reschedule Appointment** | Appointments Queue | `Appointments → Appointment Booking → Edit` | `APPOINTMENTS_APPOINTMENT_BOOKING_EDIT` | Modifies scheduled slot date, time, or consulting physician. |
| **Cancel Appointment** | Appointments Queue | `Appointments → Appointment Records → Edit` | `APPOINTMENTS_APPOINTMENT_RECORDS_EDIT` | Transitions appointment status to CANCELLED. |
| **Record OPD Vitals** | OPD Intake | `OPD → OPD Vitals → Create` | `OPD_OPD_VITALS_CREATE` | Creates physiological measurement record for outpatient visit. |
| **Edit OPD Vitals** | OPD Intake | `OPD → OPD Vitals → Edit` | `OPD_OPD_VITALS_EDIT` | Modifies mistakenly entered vital signs. |
| **Save Consultation Draft** | Doctor Consultation | `OPD → OPD Consultation → Edit` | `OPD_OPD_CONSULTATION_EDIT` | Saves in-progress clinical examination and notes. |
| **Complete Consultation** | Doctor Consultation | `OPD → OPD Consultation → Edit` | `OPD_OPD_CONSULTATION_EDIT` | Finalizes medical consultation and records ICD-10 diagnosis. |
| **Submit E-Prescription** | OPD / IP / Surgery | `OPD → OPD Prescription → Edit` | `OPD_OPD_PRESCRIPTION_EDIT` | Dispatches electronic prescription orders to dispensary. |
| **Submit Clinical Orders** | OPD / IP / Surgery | `OPD → OPD Clinical Orders → Edit` | `OPD_OPD_CLINICAL_ORDERS_EDIT` | Dispatches laboratory and imaging requisitions to diagnostic queues. |
| **Schedule Follow-up** | Doctor Consultation | `OPD → OPD Follow-up → Edit` | `OPD_OPD_FOLLOW_UP_EDIT` | Records revisit timeframe and clinical instructions. |
| **Create Medical Referral** | Doctor Consultation | `OPD → OPD Referral → Edit` | `OPD_OPD_REFERRAL_EDIT` | Generates specialist inter-department referral order. |
| **Recommend Admission** | Doctor Consultation | `Admissions → Admission Recommendations → Create` | `ADMISSIONS_ADMISSION_RECOMMENDATIONS_CREATE` | Physician recommends inpatient admission. |
| **Create Admission Request** | Admissions Desk | `Admissions → Admission Requests → Create` | `ADMISSIONS_ADMISSION_REQUESTS_CREATE` | Front desk creates formal admission booking request. |
| **Validate Admission Request** | Admissions Desk | `Admissions → Admission Requests → Validate` | `ADMISSIONS_ADMISSION_REQUESTS_VALIDATE` | Verifies documentation, bed availability, and advance deposit. |
| **Confirm Admission (Admit)** | Admissions Desk | `Admissions → Admission Requests → Confirm` | `ADMISSIONS_ADMISSION_REQUESTS_CONFIRM` | Atomically occupies bed and creates inpatient admission record. |
| **Cancel Admission Request** | Admissions Desk | `Admissions → Admission Requests → Cancel` | `ADMISSIONS_ADMISSION_REQUESTS_CANCEL` | Cancels pending or rejected admission request. |
| **Hold Bed** | Bed Board | `Admissions → Bed Holds → Create` | `ADMISSIONS_BED_HOLDS_CREATE` | Places temporary reservation lock on a bed. |
| **Release Bed Hold** | Bed Board | `Admissions → Bed Holds → Release` | `ADMISSIONS_BED_HOLDS_RELEASE` | Unlocks bed back to AVAILABLE status. |
| **Initiate Bed Transfer** | Inpatient Chart | `Admissions → Bed Transfers → Create` | `ADMISSIONS_BED_TRANSFERS_CREATE` | Requests moving patient to another bed/ward. |
| **Complete Bed Transfer** | Bed Board | `Admissions → Bed Transfers → Complete` | `ADMISSIONS_BED_TRANSFERS_COMPLETE` | Vacates old bed and occupies new destination bed. |
| **Record Inpatient Round Note** | Inpatient Chart | `Admissions → Inpatient Admissions → Create` | `ADMISSIONS_INPATIENT_ADMISSIONS_CREATE` | Records daily nursing or physician progress note. |
| **Record Inpatient Vitals** | Inpatient Chart | `Admissions → Inpatient Admissions → Create` | `ADMISSIONS_INPATIENT_ADMISSIONS_CREATE` | Records bedside vital sign measurements for inpatient. |
| **Save Discharge Summary** | Inpatient Chart | `Admissions → Inpatient Admissions → Edit` | `ADMISSIONS_INPATIENT_ADMISSIONS_EDIT` | Drafts medical discharge summary report. |
| **Finalize Inpatient Discharge** | Inpatient Chart | `Admissions → Inpatient Admissions → Discharge` | `ADMISSIONS_INPATIENT_ADMISSIONS_DISCHARGE` | Authorizes medical discharge and sends bed to CLEANING. |
| **Recommend Surgery** | Doctor Consultation | `Surgery → Recommendations → Create` | `SURGERY_RECOMMENDATIONS_CREATE` | Surgeon creates procedure recommendation. |
| **Book Surgery Slot** | Surgery Workspace | `Surgery → Bookings → Create` | `SURGERY_BOOKINGS_CREATE` | Reserves operating theater room and time slot. |
| **Confirm Surgery Booking** | Surgery Workspace | `Surgery → Bookings → Confirm` | `SURGERY_BOOKINGS_CONFIRM` | Confirms surgery slot after pre-op clearance. |
| **Reschedule Surgery** | Surgery Workspace | `Surgery → Bookings → Reschedule` | `SURGERY_BOOKINGS_RESCHEDULE` | Moves surgery booking to a new time or theater. |
| **Complete Surgery** | Surgery Workspace | `Surgery → Bookings → Complete` | `SURGERY_BOOKINGS_COMPLETE` | Marks operation completed and documents operative notes. |
| **Register Emergency Patient** | Emergency Intake | `Emergency → Encounters → Register` | `EMERGENCY_ENCOUNTERS_REGISTER` | Registers walk-in/ambulance emergency arrival. |
| **Perform Triage Assessment** | Emergency Triage | `Emergency → Triage → Assess` | `EMERGENCY_TRIAGE_ASSESS` | Assigns acuity level and records triage vitals. |
| **Override Triage Priority** | Emergency Triage | `Emergency → Triage → OverridePriority` | `EMERGENCY_TRIAGE_OVERRIDE_PRIORITY` | Reclassifies triage level with clinical rationale. |
| **Call Emergency Patient** | Emergency Queue | `Emergency → Consultation → Edit` | `EMERGENCY_CONSULTATION_EDIT` | Doctor calls emergency patient for evaluation. |
| **Create Emergency Orders** | Emergency Workspace | `Emergency → Orders → Create` | `EMERGENCY_ORDERS_CREATE` | Orders STAT emergency medications and diagnostics. |
| **Emergency Discharge** | Emergency Workspace | `Emergency → Disposition → Discharge` | `EMERGENCY_DISPOSITION_DISCHARGE` | Discharges stabilized patient from emergency. |
| **Emergency Transfer** | Emergency Workspace | `Emergency → Disposition → Transfer` | `EMERGENCY_DISPOSITION_TRANSFER` | Transfers emergency patient to external hospital. |
| **Emergency Convert to IP** | Emergency Workspace | `Emergency → Disposition → ConvertToIP` | `EMERGENCY_DISPOSITION_CONVERT_TO_IP` | Converts emergency encounter to inpatient admission. |
| **Emergency Mark as Left** | Emergency Workspace | `Emergency → Disposition → MarkLeft` | `EMERGENCY_DISPOSITION_MARK_LEFT` | Documents patient Left Against Medical Advice (LAMA). |
| **Link Unknown Patient** | Emergency Identification | `Emergency → Patient Linking → Link` | `EMERGENCY_PATIENT_LINKING_LINK` | Merges temporary emergency record with master MRN. |
| **Correct Patient Link** | Emergency Identification | `Emergency → Patient Linking → Correct` | `EMERGENCY_PATIENT_LINKING_CORRECT` | Re-maps mistakenly linked emergency identity. |
| **Enter Lab Result** | Laboratory Workspace | `Laboratory → Orders → EnterResult` | `LABORATORY_ORDERS_ENTER_RESULT` | Enters test parameter values and reference ranges. |
| **Verify Lab Result** | Laboratory Workspace | `Laboratory → Orders → VerifyResult` | `LABORATORY_ORDERS_VERIFY_RESULT` | Authorizes and verifies final laboratory report. |
| **Enter Imaging Report** | Imaging Workspace | `Imaging → Orders → EnterReport` | `IMAGING_ORDERS_ENTER_REPORT` | Enters radiology findings and uploads scan files. |
| **Verify Imaging Report** | Imaging Workspace | `Imaging → Orders → VerifyReport` | `IMAGING_ORDERS_VERIFY_REPORT` | Authorizes and verifies final radiology report. |
| **Allocate Batches** | Pharmacy Dispensing | `Pharmacy → Dispensing → Edit` | `PHARMACY_DISPENSING_EDIT` | Allocates specific batch numbers to prescription items. |
| **Confirm Dispensing** | Pharmacy Dispensing | `Pharmacy → Dispensing → Dispense` | `PHARMACY_DISPENSING_DISPENSE` | Confirms drug handover and decrements inventory. |
| **Cancel Dispensing** | Pharmacy Dispensing | `Pharmacy → Dispensing → Cancel` | `PHARMACY_DISPENSING_CANCEL` | Cancels uncollected medication order. |
| **Reverse Dispensing** | Pharmacy Dispensing | `Pharmacy → Dispensing → Reverse` | `PHARMACY_DISPENSING_REVERSE` | Returns medicine to stock and reverses transaction. |
| **Register Medicine Batch** | Pharmacy Inventory | `Pharmacy → Medicine Inventory → RegisterBatch` | `PHARMACY_MEDICINE_INVENTORY_REGISTER_BATCH` | Registers new batch number, MRP, and expiry date. |
| **Adjust Stock** | Pharmacy Inventory | `Pharmacy → Medicine Inventory → AdjustStock` | `PHARMACY_MEDICINE_INVENTORY_ADJUST_STOCK` | Records audited loss, damage, or found stock adjustment. |
| **Create Invoice** | Billing Workspace | `Billing → Invoices → Create` | `BILLING_INVOICES_CREATE` | Generates itemized invoice for patient services. |
| **Edit Invoice / Link Context** | Billing Workspace | `Billing → Invoices → Edit` | `BILLING_INVOICES_EDIT` | Modifies charges or links bill to admission/procedure. |
| **Cancel Invoice** | Billing History | `Billing → Invoices → Cancel` | `BILLING_INVOICES_CANCEL` | Voids invoice with mandatory audit reason. |
| **Collect Payment** | Billing Workspace | `Billing → Invoices → CollectPayment` | `BILLING_INVOICES_COLLECT_PAYMENT` | Records financial collection across payment tenders. |
| **View / Print Receipt** | Billing Workspace | `Billing → Invoices → ViewReceipt` | `BILLING_INVOICES_VIEW_RECEIPT` | Renders and prints official payment receipt. |
| **Attach Signed Consent** | Patient Consent | `Patients → Patient Documents → Create + Patients → Consent → Attach` | `PATIENTS_PATIENT_DOCUMENTS_CREATE + PATIENTS_CONSENT_ATTACH` | Uploads and maps signed informed consent document. |
| **Verify Consent** | Patient Consent | `Patients → Consent → Verify` | `PATIENTS_CONSENT_VERIFY` | Clinically reviews and verifies patient consent signature. |
| **Provision Doctor Login** | Doctor Directory | `Doctors → Doctor Directory → Provision Login` | `DOCTORS_DOCTOR_DIRECTORY_PROVISION_LOGIN` | Creates or links login user credentials for doctor. |

---

## 6. Frontend / Backend Permission Parity

This section compares frontend UI conditioning with backend endpoint enforcement to identify security gaps or mismatches:

| Permission | Frontend Guard | Backend Guard | Parity Status | Technical Assessment |
|---|---|---|---|---|
| **Administration → Dashboard → View** | Yes (`canViewDashboard`) | Yes (`GET /api/admin/dashboard`) | `Correct` | Fully protected at page and endpoint level. |
| **Administration → Users → (Create/Edit/Delete)** | Yes (Action buttons) | Yes (`POST/PATCH/DELETE /api/users`) | `Correct` | Fully aligned with privilege escalation validation. |
| **Appointments → Appointment Booking → View** | Yes (Route guard) | No direct endpoint guard | `UI conditioning only` | Route guard in React; backend enforces create/edit on action. |
| **Appointments → Appointment Booking → Create** | Yes (`Confirm Booking`) | Yes (`POST /api/appointments`) | `Correct` | Controls appointment creation. |
| **OPD → OPD Visits → Create** | Yes (`canCheckIn`) | Yes (`POST /api/opd/visits`) | `Correct` | Controls Check In. |
| **OPD → OPD Visits → Edit** | Yes (`canCallNext`) | Yes (`PATCH /status, POST /call-next`) | `Correct` | Controls queue call and status updates. |
| **OPD → OPD Vitals → Create** | Yes (`canCreateVitals`) | Yes (`POST /vitals`) | `Correct` | Controls vitals recording. |
| **OPD → OPD Vitals → Edit** | Yes (Vitals table edit) | No direct edit endpoint guard | `Backend gap` | Vitals updates use creation endpoint or implicit visit context. |
| **Admissions → Inpatient Admissions → Create** | Yes (Round note & vitals modals) | Yes (`POST /round-notes, POST /vitals`) | `Correct` | Backend guards round notes and vitals with Inpatient Create. |
| **Admissions → Admission Requests → Confirm** | Yes (`Confirm Admission`) | Yes (`POST /requests/:id/confirm`) | `Correct` | Controls bed occupation and admission confirmation. |
| **Pharmacy → Dispensing → Dispense** | Yes (`Confirm Dispense`) | Yes (`POST /dispensings/:id/confirm`) | `Correct` | Controls atomic stock deduction. |
| **Laboratory → Orders → EnterResult vs VerifyResult** | Yes (Separate modal actions) | Yes (`POST /results` vs `PATCH /status [VERIFIED]`) | `Correct` | Strict separation between result entry and verification. |
| **Imaging → Orders → EnterReport vs VerifyReport** | Yes (Separate modal actions) | Yes (`POST /report` vs `PATCH /status [VERIFIED]`) | `Correct` | Strict separation between report entry and verification. |
| **Billing → Invoices → CollectPayment** | Yes (`Collect Payment`) | Yes (`POST /invoices/:id/payments`) | `Correct` | Controls payment tender collection. |

---

## 7. Unclear Permission Names & Explanations

The following permissions have technical codes, abbreviated labels, or names whose business purpose is not immediately obvious from the title alone:

### `Doctors → Doctor Directory → Provision Login`
- **Permission Code:** `DOCTORS_DOCTOR_DIRECTORY_PROVISION_LOGIN`
- **Actual Implementation Usage:** Allows linking an authentication user account to a doctor profile or creating new user credentials during doctor onboarding.
- **Plain-Language Business Meaning:** Controls user account generation and mapping for doctors.
- **Where the User Sees It:** Toggle switch 'Create Login Account' in Add Doctor modal and 'Map User Account' in Doctor Profile.
- **Display / Documentation Recommendation:** No code change. Display label: 'Provision Doctor User Account'.

### `OPD → OPD Visits → Create`
- **Permission Code:** `OPD_OPD_VISITS_CREATE`
- **Actual Implementation Usage:** Controls the **Check In** action for arriving appointed and walk-in patients.
- **Plain-Language Business Meaning:** Generates an active visit encounter in the OPD waiting queue.
- **Where the User Sees It:** 'Check In' button on Appointment Queue.
- **Display / Documentation Recommendation:** Display name is already registered as 'Check In Patient' in permission display metadata.

### `Admissions → Inpatient Admissions → Create`
- **Permission Code:** `ADMISSIONS_INPATIENT_ADMISSIONS_CREATE`
- **Actual Implementation Usage:** Controls recording daily **Inpatient Nursing/Physician Round Notes** and **Bedside Vitals**.
- **Plain-Language Business Meaning:** Allows clinical staff to add progress notes and bedside vital sign logs to an active inpatient admission.
- **Where the User Sees It:** 'Add Round Note' button and 'Record Vitals' button in Inpatient Chart.
- **Display / Documentation Recommendation:** Display label: 'Record Inpatient Notes & Vitals'.

### `Emergency → Disposition → ConvertToIP`
- **Permission Code:** `EMERGENCY_DISPOSITION_CONVERT_TO_IP`
- **Actual Implementation Usage:** Controls converting an emergency trauma/acute patient into an admitted inpatient.
- **Plain-Language Business Meaning:** Initiates emergency-to-inpatient bed allocation and admission request creation.
- **Where the User Sees It:** 'Admit as Inpatient' button on Emergency Disposition panel.
- **Display / Documentation Recommendation:** Display label: 'Convert Emergency to Inpatient Admission'.

### `Admissions → Bed Transfers → CrossBranch`
- **Permission Code:** `ADMISSIONS_BED_TRANSFERS_CROSS_BRANCH`
- **Actual Implementation Usage:** Controls transferring admitted patients between distinct hospital branch facilities.
- **Plain-Language Business Meaning:** Authorizes multi-branch transaction coordination and cross-database patient movement.
- **Where the User Sees It:** 'Cross-Branch Transfer' toggle on Inpatient Bed Transfer modal.
- **Display / Documentation Recommendation:** Display label: 'Inter-Branch Patient Transfer'.

### `Administration → Settings → (View / Edit / Export)`
- **Permission Code:** `settings.view / settings.edit / settings.export`
- **Actual Implementation Usage:** Controls access to global hospital system configuration settings.
- **Plain-Language Business Meaning:** Uses lowercase dot notation code syntax instead of standard UPPER_SNAKE_CASE.
- **Where the User Sees It:** System Settings page.
- **Display / Documentation Recommendation:** Handled transparently by `permission-display.ts` and `seed.ts`.

---

## 8. Unused Permissions

Analysis of the codebase identified the following permissions that exist in the permission catalog but have limited or indirect standalone UI usage:

- **`Appointments → Appointment Booking → View` (`APPOINTMENTS_APPOINTMENT_BOOKING_VIEW`):** Used in frontend route access control for `/appointments/book`, but does not guard a dedicated backend GET endpoint (appointment booking forms query availability and doctor directories).
- **`Emergency → Encounters → Edit` (`EMERGENCY_ENCOUNTERS_EDIT`):** Seeded in Administrator role. In current UI, emergency encounter updates are driven primarily through Triage (`EMERGENCY_TRIAGE_ASSESS`), Doctor Consultation (`EMERGENCY_CONSULTATION_EDIT`), and Disposition (`EMERGENCY_DISPOSITION_*`).
- **`Patients → Patient Documents → Edit` (`PATIENTS_PATIENT_DOCUMENTS_EDIT`):** Guards document replacement (`PUT /api/patients/:id/documents/:documentId/upload`) and document review notes (`PATCH /review`). In operational front-desk use, documents are typically uploaded or deleted rather than replaced.

---

## 9. Overloaded Permissions

The following permissions control multiple distinct business actions, which should be understood during RBAC design:

### `OPD → OPD Consultation → Edit (`OPD_OPD_CONSULTATION_EDIT`)`
- **Potentially Overloaded:** YES
- **Actions Controlled:**
  - 1. Save Consultation Draft (`PUT /consultation`)
  - 2. Complete Consultation (`POST /consultation/complete`)
- **Architectural Implication:** A doctor cannot be granted draft saving rights without also receiving final consultation completion authority.

### `OPD → OPD Prescription → Edit (`OPD_OPD_PRESCRIPTION_EDIT`)`
- **Potentially Overloaded:** YES
- **Actions Controlled:**
  - 1. Save Prescription Draft
  - 2. Submit E-Prescription across OPD, Inpatient, and Surgery
- **Architectural Implication:** Controls prescription formulation and submission across three clinical domains.

### `OPD → OPD Clinical Orders → Edit (`OPD_OPD_CLINICAL_ORDERS_EDIT`)`
- **Potentially Overloaded:** YES
- **Actions Controlled:**
  - 1. Order Diagnostic Laboratory Tests
  - 2. Order Radiological Imaging Studies
- **Architectural Implication:** Controls ordering both Pathology and Radiology investigations simultaneously across OPD, IP, and Surgery.

### `Admissions → Inpatient Admissions → Create (`ADMISSIONS_INPATIENT_ADMISSIONS_CREATE`)`
- **Potentially Overloaded:** YES
- **Actions Controlled:**
  - 1. Record Inpatient Nursing Round Notes
  - 2. Record Inpatient Bedside Vitals
- **Architectural Implication:** Both nursing progress notes and bedside vital sign measurements are governed by this single permission.

### `Emergency → Consultation → Edit (`EMERGENCY_CONSULTATION_EDIT`)`
- **Potentially Overloaded:** YES
- **Actions Controlled:**
  - 1. Call Patient in Emergency Queue
  - 2. Skip Patient in Emergency Queue
  - 3. Document Doctor Clinical Consultation Notes
  - 4. Submit Emergency Medical Referral
- **Architectural Implication:** Controls all doctor queue management actions and clinical documentation in the emergency workspace.

---

## 10. Current Seeded Role → Permission Assignments (Baseline State)

This section reflects the **exact current baseline seed** (`apps/api/src/database/seed.ts`) in the HMS codebase without any modifications:

| Module | Screen | Action | SUPER ADMIN | ADMINISTRATOR | RECEPTIONIST | CLINICIAN_NURSE | DOCTOR | PHARMACY_USER | LABORATORY_USER | IMAGING_USER | BILLING_AUTHORIZED |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Administration | Dashboard | View | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Users | View | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Users | Create | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Users | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Users | ChangePassword | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Users | ResetPassword | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Users | Delete | ✓ | — | — | — | — | — | — | — | — |
| Administration | Users | Export | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Roles | View | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Roles | Create | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Roles | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Roles | Assign | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Roles | Delete | ✓ | — | — | — | — | — | — | — | — |
| Administration | Permissions | View | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Permissions | Create | ✓ | — | — | — | — | — | — | — | — |
| Administration | Permissions | Edit | ✓ | — | — | — | — | — | — | — | — |
| Administration | Permissions | Assign | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Permissions | Delete | ✓ | — | — | — | — | — | — | — | — |
| Administration | Branches | View | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Branches | Create | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Branches | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Branches | Delete | ✓ | — | — | — | — | — | — | — | — |
| Administration | Branches | Export | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Departments | View | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Departments | Create | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Departments | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Departments | Delete | ✓ | — | — | — | — | — | — | — | — |
| Administration | Departments | Export | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Services | View | ✓ | ✓ | — | — | — | — | — | — | ✓ |
| Administration | Services | Create | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Services | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Services | Delete | ✓ | — | — | — | — | — | — | — | — |
| Administration | Services | Export | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Medicines | View | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Medicines | Create | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Medicines | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Medicines | Delete | ✓ | — | — | — | — | — | — | — | — |
| Administration | Medicines | Export | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Consent Templates | View | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Consent Templates | Create | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Consent Templates | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Notifications | View | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Notifications | Create | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Settings | View | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Settings | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Administration | Settings | Export | ✓ | ✓ | — | — | — | — | — | — | — |
| Patients | Patient Records | View | ✓ | — | ✓ | ✓ | ✓ | — | — | — | ✓ |
| Patients | Patient Records | Create | ✓ | — | ✓ | — | — | — | — | — | — |
| Patients | Patient Records | Edit | ✓ | — | ✓ | — | ✓ | — | — | — | — |
| Patients | Patient Documents | View | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Patients | Patient Documents | Create | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Patients | Patient Documents | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Patients | Patient Documents | Delete | ✓ | ✓ | — | — | — | — | — | — | — |
| Patients | Consent | View | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Patients | Consent | Attach | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Patients | Consent | Verify | ✓ | ✓ | — | ✓ | ✓ | — | — | — | — |
| Patients | Consent | Delete | ✓ | ✓ | — | — | — | — | — | — | — |
| Doctors | Doctor Directory | View | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Doctors | Doctor Directory | Create | ✓ | ✓ | — | — | — | — | — | — | — |
| Doctors | Doctor Directory | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Doctors | Doctor Directory | Export | ✓ | ✓ | — | — | — | — | — | — | — |
| Doctors | Doctor Directory | Provision Login | ✓ | ✓ | — | — | — | — | — | — | — |
| Doctors | Doctor Availability | View | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Doctors | Doctor Availability | Edit | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Appointments | Appointment Records | View | ✓ | — | ✓ | ✓ | ✓ | — | — | — | — |
| Appointments | Appointment Records | Edit | ✓ | — | ✓ | — | — | — | — | — | — |
| Appointments | Appointment Booking | View | ✓ | — | ✓ | — | — | — | — | — | — |
| Appointments | Appointment Booking | Create | ✓ | — | ✓ | — | — | — | — | — | — |
| Appointments | Appointment Booking | Edit | ✓ | — | ✓ | — | — | — | — | — | — |
| OPD | OPD Visits | View | ✓ | — | ✓ | ✓ | ✓ | — | — | — | ✓ |
| OPD | OPD Visits | Create | ✓ | — | ✓ | — | — | — | — | — | — |
| OPD | OPD Visits | Edit | ✓ | — | ✓ | ✓ | ✓ | — | — | — | — |
| OPD | OPD Vitals | View | ✓ | — | ✓ | ✓ | ✓ | — | — | — | — |
| OPD | OPD Vitals | Create | ✓ | — | ✓ | ✓ | — | — | — | — | — |
| OPD | OPD Vitals | Edit | ✓ | — | ✓ | — | — | — | — | — | — |
| OPD | OPD Consultation | View | ✓ | — | — | — | ✓ | — | — | — | — |
| OPD | OPD Consultation | Edit | ✓ | — | — | — | ✓ | — | — | — | — |
| OPD | OPD Prescription | View | ✓ | — | — | — | ✓ | ✓ | — | — | — |
| OPD | OPD Prescription | Edit | ✓ | — | — | — | ✓ | — | — | — | — |
| OPD | OPD Clinical Orders | View | ✓ | — | — | — | ✓ | — | — | — | — |
| OPD | OPD Clinical Orders | Edit | ✓ | — | — | — | ✓ | — | — | — | — |
| OPD | OPD Follow-up | View | ✓ | — | — | — | ✓ | — | — | — | — |
| OPD | OPD Follow-up | Edit | ✓ | — | — | — | ✓ | — | — | — | — |
| OPD | OPD Referral | View | ✓ | — | ✓ | — | ✓ | — | — | — | — |
| OPD | OPD Referral | Edit | ✓ | — | ✓ | — | ✓ | — | — | — | — |
| Pharmacy | Medicine Inventory | View | ✓ | — | — | — | — | ✓ | — | — | — |
| Pharmacy | Medicine Inventory | RegisterBatch | ✓ | — | — | — | — | ✓ | — | — | — |
| Pharmacy | Medicine Inventory | RecordMovement | ✓ | — | — | — | — | ✓ | — | — | — |
| Pharmacy | Medicine Inventory | AdjustStock | ✓ | — | — | — | — | ✓ | — | — | — |
| Pharmacy | Medicine Inventory | EditBatch | ✓ | — | — | — | — | ✓ | — | — | — |
| Pharmacy | Medicine Inventory | ConfigureLowStock | ✓ | — | — | — | — | ✓ | — | — | — |
| Pharmacy | Dispensing | View | ✓ | — | — | — | — | ✓ | — | — | — |
| Pharmacy | Dispensing | Edit | ✓ | — | — | — | — | ✓ | — | — | — |
| Pharmacy | Dispensing | Dispense | ✓ | — | — | — | — | ✓ | — | — | — |
| Pharmacy | Dispensing | Cancel | ✓ | — | — | — | — | ✓ | — | — | — |
| Pharmacy | Dispensing | Reverse | ✓ | — | — | — | — | ✓ | — | — | — |
| Pharmacy | Dispensing | UpdateStatus | ✓ | — | — | — | — | ✓ | — | — | — |
| Admissions | Wards | View | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — |
| Admissions | Wards | Create | ✓ | ✓ | — | — | — | — | — | — | — |
| Admissions | Wards | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Admissions | Wards | ChangeStatus | ✓ | ✓ | — | — | — | — | — | — | — |
| Admissions | Beds | View | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — |
| Admissions | Beds | Create | ✓ | ✓ | — | — | — | — | — | — | — |
| Admissions | Beds | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Admissions | Beds | ChangeStatus | ✓ | ✓ | — | — | — | — | — | — | — |
| Admissions | Admission Policy | View | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| Admissions | Admission Policy | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Admissions | Bed Holds | View | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| Admissions | Bed Holds | Create | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| Admissions | Bed Holds | Release | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| Admissions | Bed Holds | Cancel | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| Admissions | Bed Transfers | View | ✓ | ✓ | — | — | — | — | — | — | — |
| Admissions | Bed Transfers | Create | ✓ | ✓ | — | — | — | — | — | — | — |
| Admissions | Bed Transfers | Complete | ✓ | ✓ | — | — | — | — | — | — | — |
| Admissions | Bed Transfers | Cancel | ✓ | ✓ | — | — | — | — | — | — | — |
| Admissions | Bed Transfers | CrossBranch | ✓ | ✓ | — | — | — | — | — | — | — |
| Admissions | Inpatient Admissions | View | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Admissions | Inpatient Admissions | Create | ✓ | ✓ | — | — | — | — | — | — | — |
| Admissions | Inpatient Admissions | Edit | ✓ | ✓ | — | ✓ | ✓ | — | — | — | — |
| Admissions | Inpatient Admissions | Discharge | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Admissions | Admission Recommendations | View | ✓ | — | — | — | ✓ | — | — | — | — |
| Admissions | Admission Recommendations | Create | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Admissions | Admission Recommendations | Cancel | ✓ | — | — | — | ✓ | — | — | — | — |
| Admissions | Admission Requests | View | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — |
| Admissions | Admission Requests | Create | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| Admissions | Admission Requests | Validate | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| Admissions | Admission Requests | Confirm | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| Admissions | Admission Requests | Cancel | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| Surgery | Recommendations | View | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| Surgery | Recommendations | Create | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Surgery | Recommendations | Cancel | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Surgery | Bookings | View | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| Surgery | Bookings | Create | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| Surgery | Bookings | Confirm | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| Surgery | Bookings | Reschedule | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| Surgery | Bookings | Cancel | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| Surgery | Bookings | Complete | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Surgery | Schedule | View | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| Emergency | Encounters | View | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Emergency | Encounters | Register | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| Emergency | Encounters | Edit | ✓ | ✓ | — | — | — | — | — | — | — |
| Emergency | Triage | View | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Emergency | Triage | Assess | ✓ | ✓ | — | ✓ | — | — | — | — | — |
| Emergency | Triage | OverridePriority | ✓ | ✓ | — | — | — | — | — | — | — |
| Emergency | Consultation | View | ✓ | ✓ | — | ✓ | ✓ | — | — | — | — |
| Emergency | Consultation | Edit | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Emergency | Orders | View | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Emergency | Orders | Create | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Emergency | Disposition | View | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Emergency | Disposition | Discharge | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Emergency | Disposition | Transfer | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Emergency | Disposition | ConvertToIP | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Emergency | Disposition | MarkLeft | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Emergency | Disposition | MarkNoShow | ✓ | ✓ | — | — | — | — | — | — | — |
| Emergency | Disposition | Cancel | ✓ | ✓ | — | — | — | — | — | — | — |
| Emergency | Patient Linking | Link | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| Emergency | Patient Linking | Correct | ✓ | ✓ | — | — | — | — | — | — | — |
| Laboratory | Orders | View | ✓ | — | — | — | — | — | ✓ | — | — |
| Laboratory | Orders | Edit | ✓ | — | — | — | — | — | ✓ | — | — |
| Laboratory | Orders | EnterResult | ✓ | — | — | — | — | — | ✓ | — | — |
| Laboratory | Orders | VerifyResult | ✓ | — | — | — | — | — | ✓ | — | — |
| Imaging | Orders | View | ✓ | — | — | — | — | — | — | ✓ | — |
| Imaging | Orders | Edit | ✓ | — | — | — | — | — | — | ✓ | — |
| Imaging | Orders | EnterReport | ✓ | — | — | — | — | — | — | ✓ | — |
| Imaging | Orders | VerifyReport | ✓ | — | — | — | — | — | — | ✓ | — |
| Billing | Invoices | View | ✓ | — | — | — | — | — | — | — | ✓ |
| Billing | Invoices | Create | ✓ | — | — | — | — | — | — | — | ✓ |
| Billing | Invoices | Edit | ✓ | — | — | — | — | — | — | — | ✓ |
| Billing | Invoices | Cancel | ✓ | — | — | — | — | — | — | — | ✓ |
| Billing | Invoices | CollectPayment | ✓ | — | — | — | — | — | — | — | ✓ |
| Billing | Invoices | ViewReceipt | ✓ | — | — | — | — | — | — | — | ✓ |
| Reports | Phase 2 Reports | View | ✓ | — | — | — | — | — | — | — | ✓ |

---

### Summary of Seeded Assignment Totals
- **Super Administrator (`SUPER_ADMIN`):** 172 active permissions (inherits all catalog entries dynamically)
- **Administrator (`ADMINISTRATOR`):** 78 permissions
- **Receptionist (`RECEPTIONIST`):** 28 permissions
- **Clinician / Nurse (`CLINICIAN_NURSE`):** 18 permissions
- **Doctor (`DOCTOR`):** 36 permissions
- **Pharmacy User (`PHARMACY_USER`):** 13 permissions
- **Laboratory User (`LABORATORY_USER`):** 4 permissions
- **Imaging User (`IMAGING_USER`):** 4 permissions
- **Billing Authorized (`BILLING_AUTHORIZED`):** 10 permissions
- **Patient (`PATIENT`):** 0 permissions (portal authentication)
- **Parent / Guardian (`GUARDIAN`):** 0 permissions (portal authentication)
