# HMS Role-Based Permission Assignment Matrix

Date: 4 September 2026  
Status: Recommendation based on the current repository implementation; no RBAC code, role, or permission was created by this analysis.

## 1. Basis and interpretation

The current catalog contains **172 active system permission tuples across 48 screens**. Authorization is database-backed. A normal user's effective access is the union of permissions from all active assigned roles; inactive/deleted roles and permissions do not grant access. `SUPER_ADMIN` is a deliberate override and receives all active system permissions without needing a manually maintained 172-item assignment.

The code-defined staff roles are `ADMINISTRATOR`, `RECEPTIONIST`, `CLINICIAN_NURSE`, `DOCTOR`, `PHARMACY_USER`, `LABORATORY_USER`, and `BILLING_AUTHORIZED`. `PATIENT` and `GUARDIAN` also exist, but have no staff permissions and use ownership/dependent-scoped portal authorization. **Admission User, Surgery User, and Emergency User do not currently exist as seeded roles.** Their columns below are recommended custom-role profiles only; this document does not authorize creating them.

“Current” in this document means the code-defined seed baseline. A deployed database may differ because non-super system-role permissions are inserted with `$setOnInsert` and are not forcibly reset on reseed. A production rollout must export the live role assignments before applying this recommendation.

Permissions answer **what** a user may do. Branch and department assignments answer **which records** the user may access. A check mark never implies enterprise-wide data access.

## 2. Role responsibilities

| Role | Normal responsibility | Required working areas | Must not receive by default |
|---|---|---|---|
| Super Administrator | Restricted platform/bootstrap and break-glass administration | Every active permission through the existing override | Routine daily use; the account should not substitute for an operational role |
| Administrator | Staff access, role assignment, master data, configuration, doctor onboarding, ward/bed configuration, and management reporting | Administration, doctor directory setup, admission configuration, reports | Routine clinical decisions, dispensing, result verification, billing collection, Emergency disposition, or Surgery execution |
| Receptionist | Patient registration, appointment booking/status handling, check-in, queue coordination, document intake, and basic consent capture | Patients, doctors/availability lookup, appointments, OPD visit check-in, referral lookup | Clinical vitals, consultation, prescription, result/report verification, stock control, RBAC, or system settings |
| Doctor | Clinical review, consultation, diagnosis, prescriptions, orders, follow-up/referral, admission recommendation/discharge, and surgery recommendation | Patient clinical context, doctor schedule, OPD, relevant inpatient and surgery views, diagnostic results | User/RBAC management, billing collection, inventory adjustment, master-data mutation, lab/imaging entry or verification |
| Clinician / Nurse | Patient-care context, observations/vitals, visit progression, inpatient care coordination | Patient context, OPD visits/vitals, inpatient wards/beds and admissions | Patient check-in creation, doctor-only consultation/prescribing, administrative masters, result/report verification, stock or billing control |
| Billing Authorized | Invoice creation/update, payment collection, receipt access, and finance reporting | Billing, patient/visit lookup, service lookup, reports | Clinical editing, result verification, dispensing, stock control, admission/surgery/Emergency state transitions, administration |
| Pharmacy User | Medicine master lookup, batches, movements, dispensing, and inventory operations | Prescription view, Medicine Master dependencies, Pharmacy inventory/dispensing | Clinical editing, RBAC, billing, diagnostic verification; stock adjustment/reversal only for a supervisor |
| Laboratory User | Laboratory work queue, sample/order workflow, and result entry | Laboratory orders | Clinical editing, imaging, pharmacy, billing, administration; result verification only for an authorized verifier |
| Imaging User | Imaging work queue/study workflow and report entry | Imaging orders | Clinical editing, laboratory, pharmacy, billing, administration; report verification only for an authorized verifier |
| Admission / Front Desk User (not seeded) | Admission request validation/confirmation, holds, transfers, allotment, release, and administrative discharge | Admission workflows plus patient/doctor/master lookups | Clinical consultation/prescribing, Surgery/Emergency decisions, RBAC, pharmacy, diagnostic verification |
| Surgery User (not seeded) | Procedure coordination, booking, scheduling, prerequisites, and completion | Surgery plus patient, consent, doctor, service, inpatient, and diagnostic-result context | General administration, patient demographics editing, billing collection, pharmacy stock, unrelated Emergency actions |
| Emergency User (not seeded) | Emergency registration, triage, consultation, orders, disposition, linking, and conversion | Emergency plus required patient/doctor/service/medicine/inventory/diagnostic lookups | RBAC, master mutation, routine billing, pharmacy dispensing, unrelated admission/surgery management |
| Patient / Guardian | Patient portal self/dependent access | Ownership-scoped portal APIs | All staff permissions |

## 3. Recommended permission matrix

Legend: `✓` required for the baseline role; `○` optional and must be enabled only by approved hospital policy; `—` should not be assigned to the baseline role; `ALL*` is the existing SUPER_ADMIN override. Actions are written exactly as the current catalog defines them.

| Module | Screen | Existing permissions | Super Admin | Admin | Receptionist | Doctor | Nurse | Billing | Pharmacy | Lab | Imaging | Admission | Surgery | Emergency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Administration | Dashboard | View | ALL* | ✓ View | — | — | — | — | — | — | — | — | — | — |
| Administration | Users | View, Create, Edit, ChangePassword, ResetPassword, Delete, Export | ALL* | ✓ View/Create/Edit/ChangePassword/ResetPassword/Export; ○ Delete | — | — | — | — | — | — | — | — | — | — |
| Administration | Roles | View, Create, Edit, Assign, Delete | ALL* | ✓ View/Create/Edit/Assign; ○ Delete | — | — | — | — | — | — | — | — | — | — |
| Administration | Permissions | View, Create, Edit, Assign, Delete | ALL* | ✓ View/Assign; ○ Create/Edit/Delete | — | — | — | — | — | — | — | — | — | — |
| Administration | Branches | View, Create, Edit, Delete, Export | ALL* | ✓ View/Create/Edit/Export; ○ Delete | — | ✓ View | ✓ View | — | — | — | — | ✓ View | — | — |
| Administration | Departments | View, Create, Edit, Delete, Export | ALL* | ✓ View/Create/Edit/Export; ○ Delete | ○ View | ✓ View | ✓ View | — | — | — | — | ✓ View | ✓ View | ✓ View |
| Administration | Services | View, Create, Edit, Delete, Export | ALL* | ✓ View/Create/Edit/Export; ○ Delete | — | ✓ View | ✓ View | ✓ View | — | — | — | ✓ View | ✓ View | ✓ View |
| Administration | Medicines | View, Create, Edit, Delete, Export | ALL* | ✓ View/Create/Edit/Export; ○ Delete | — | — | — | — | ✓ View/Create; ○ Edit/Delete/Export | — | — | — | — | ✓ View |
| Administration | Consent Templates | View, Create, Edit | ALL* | ✓ View/Create/Edit | — | ✓ View | — | — | — | — | — | ✓ View | ✓ View | — |
| Administration | Notifications | View, Create | ALL* | ✓ View/Create | — | — | — | — | — | — | — | — | — | — |
| Administration | Settings | View, Edit, Export | ALL* | ✓ View/Edit; ○ Export | — | — | — | — | — | — | — | — | — | — |
| Patients | Patient Records | View, Create, Edit | ALL* | — | ✓ View/Create/Edit | ✓ View; ○ Edit | ✓ View | ✓ View | — | — | — | ✓ View | ✓ View | ✓ View; ○ Create/Edit |
| Patients | Patient Documents | View, Create, Edit, Delete | ALL* | ○ View | ✓ View/Create; ○ Edit/Delete | ✓ View/Create | ✓ View/Create | — | — | — | — | ✓ View; ○ Create | ✓ View/Create | ○ View |
| Patients | Consent | View, Attach, Verify, Delete | ALL* | ○ View/Verify | ✓ View/Attach | ✓ View/Verify; ○ Attach | ✓ View/Attach; ○ Verify | — | — | — | — | ✓ View/Attach; ○ Verify | ✓ View/Attach/Verify | ○ View |
| Doctors | Doctor Directory | View, Create, Edit, Export, Provision Login | ALL* | ✓ View/Create/Edit/Export/Provision Login | ✓ View | ✓ View | ✓ View | — | — | — | — | ✓ View | ✓ View | ✓ View |
| Doctors | Doctor Availability | View, Edit | ALL* | ✓ View/Edit | ✓ View | ✓ View/Edit | ○ View | — | — | — | — | ✓ View | ✓ View | ✓ View |
| Appointments | Appointment Records | View, Edit | ALL* | — | ✓ View/Edit | ✓ View | ✓ View | — | — | — | — | ○ View | — | — |
| Appointments | Appointment Booking | View, Create, Edit | ALL* | — | ✓ View/Create/Edit | ○ View/Create | — | — | — | — | — | ○ View/Create | — | ✓ Create; ○ View |
| OPD | OPD Visits | View, Create, Edit | ALL* | — | ✓ View/Create/Edit | ✓ View/Edit | ✓ View/Edit | ✓ View | — | — | — | ✓ View | — | — |
| OPD | OPD Vitals | View, Create, Edit | ALL* | — | — | ✓ View; ○ Create/Edit | ✓ View/Create/Edit | — | — | — | — | — | — | — |
| OPD | OPD Consultation | View, Edit | ALL* | — | — | ✓ View/Edit | ○ View | — | — | — | — | — | — | — |
| OPD | OPD Prescription | View, Edit | ALL* | — | — | ✓ View/Edit | ○ View | — | ✓ View | — | — | — | ○ View/Edit | — |
| OPD | OPD Clinical Orders | View, Edit | ALL* | — | — | ✓ View/Edit | ○ View | — | — | — | — | — | ○ View/Edit | — |
| OPD | OPD Follow-up | View, Edit | ALL* | — | — | ✓ View/Edit | — | — | — | — | — | — | — | — |
| OPD | OPD Referral | View, Edit | ALL* | — | ✓ View | ✓ View/Edit | — | — | — | — | — | — | — | ✓ View |
| Pharmacy | Medicine Inventory | View, RegisterBatch, RecordMovement, AdjustStock, EditBatch, ConfigureLowStock | ALL* | — | — | — | — | — | ✓ View/RegisterBatch/RecordMovement/EditBatch; ○ AdjustStock/ConfigureLowStock | — | — | — | — | ✓ View |
| Pharmacy | Dispensing | View, Edit, Dispense, Cancel, Reverse, UpdateStatus | ALL* | — | — | — | — | — | ✓ View/Edit/Dispense/UpdateStatus; ○ Cancel/Reverse | — | — | — | — | — |
| Admissions | Wards | View, Create, Edit, ChangeStatus | ALL* | ✓ View/Create/Edit/ChangeStatus | ○ View | — | ✓ View | — | — | — | — | ✓ View | — | — |
| Admissions | Beds | View, Create, Edit, ChangeStatus | ALL* | ✓ View/Create/Edit/ChangeStatus | ○ View | — | ✓ View | — | — | — | — | ✓ View | — | — |
| Admissions | Admission Policy | View, Edit | ALL* | ✓ View/Edit | ○ View | — | — | — | — | — | — | ✓ View | — | — |
| Admissions | Bed Holds | View, Create, Release, Cancel | ALL* | ○ View | ○ View/Create/Release/Cancel | — | — | — | — | — | — | ✓ View/Create/Release/Cancel | — | — |
| Admissions | Bed Transfers | View, Create, Complete, Cancel, CrossBranch | ALL* | ○ View | — | — | ○ View/Create | — | — | — | — | ✓ View/Create/Complete/Cancel; ○ CrossBranch | — | — |
| Admissions | Inpatient Admissions | View, Create, Edit, Discharge | ALL* | ○ View | ○ View | ✓ View/Edit/Discharge | ✓ View/Edit | ○ View | — | — | — | ✓ View/Create/Edit/Discharge | ✓ View | — |
| Admissions | Admission Recommendations | View, Create, Cancel | ALL* | — | — | ✓ View/Create/Cancel | ○ View | — | — | — | — | ✓ View | — | — |
| Admissions | Admission Requests | View, Create, Validate, Confirm, Cancel | ALL* | — | ○ View/Create/Validate/Confirm/Cancel | ○ View | ○ View | ○ View | — | — | — | ✓ View/Create/Validate/Confirm/Cancel | — | — |
| Surgery | Recommendations | View, Create, Cancel | ALL* | — | ○ View | ✓ View/Create/Cancel | — | — | — | — | — | — | ✓ View; ○ Create/Cancel | — |
| Surgery | Bookings | View, Create, Confirm, Reschedule, Cancel, Complete | ALL* | — | ○ View/Create/Confirm/Reschedule/Cancel | ✓ View; ○ Create/Confirm/Reschedule/Cancel/Complete | — | — | — | — | — | — | ✓ View/Create/Confirm/Reschedule/Cancel/Complete | — |
| Surgery | Schedule | View | ALL* | — | ○ View | ✓ View | ○ View | — | — | — | — | — | ✓ View | — |
| Emergency | Encounters | View, Register, Edit | ALL* | — | ○ View/Register | ○ View | ○ View | — | — | — | — | — | — | ✓ View/Register/Edit |
| Emergency | Triage | View, Assess, OverridePriority | ALL* | — | — | ○ View | ○ View/Assess | — | — | — | — | — | — | ✓ View/Assess; ○ OverridePriority |
| Emergency | Consultation | View, Edit | ALL* | — | — | ○ View/Edit | ○ View | — | — | — | — | — | — | ✓ View/Edit |
| Emergency | Orders | View, Create | ALL* | — | — | ○ View/Create | — | — | — | — | — | — | — | ✓ View/Create |
| Emergency | Disposition | View, Discharge, Transfer, ConvertToIP, MarkLeft, MarkNoShow, Cancel | ALL* | — | ○ View/MarkNoShow | ○ View/Discharge/Transfer/ConvertToIP/MarkLeft | — | — | — | — | — | — | — | ✓ View/Discharge/Transfer/ConvertToIP/MarkLeft/MarkNoShow; ○ Cancel |
| Emergency | Patient Linking | Link, Correct | ALL* | — | ○ Link | ○ Link | — | — | — | — | — | — | — | ✓ Link; ○ Correct |
| Laboratory | Orders | View, Edit, EnterResult, VerifyResult | ALL* | — | — | ✓ View | ○ View | — | — | ✓ View/Edit/EnterResult; ○ VerifyResult | — | — | ✓ View | ✓ View |
| Imaging | Orders | View, Edit, EnterReport, VerifyReport | ALL* | — | — | ✓ View | ○ View | — | — | — | ✓ View/Edit/EnterReport; ○ VerifyReport | — | ✓ View | ✓ View |
| Billing | Invoices | View, Create, Edit, Cancel, CollectPayment, ViewReceipt | ALL* | — | ○ View/Create/CollectPayment/ViewReceipt | — | — | ✓ View/Create/Edit/CollectPayment/ViewReceipt; ○ Cancel | — | — | — | ○ View/Create/CollectPayment/ViewReceipt | ○ View/ViewReceipt | — |
| Reports | Phase 2 Reports | View | ALL* | ✓ View | — | — | — | ✓ View | ○ View | ○ View | ○ View | ○ View | ○ View | ○ View |

## 4. Role-by-role required permissions and reasons

The following are all baseline `✓` assignments from the matrix. Optional permissions are intentionally excluded here.

### Super Administrator

- **All active permissions through the existing override** — required only for restricted bootstrap/break-glass operations. Do not duplicate the catalog into a manually curated role list.

### Administrator — 54 required permissions

- **Administration Dashboard → View** — opens the administration landing page.
- **Users → View/Create/Edit/ChangePassword/ResetPassword/Export** — manages staff accounts without making destructive deletion routine.
- **Roles → View/Create/Edit/Assign** and **Permissions → View/Assign** — creates normal roles and manages assignments while backend authority checks prevent escalation.
- **Branches, Departments, Services, Medicines → View/Create/Edit/Export** — maintains operational master data and exports supported lists.
- **Consent Templates → View/Create/Edit** — maintains approved consent templates, not patient-specific consent decisions.
- **Notifications → View/Create** — manages administrative notification workflows.
- **Settings → View/Edit** — maintains approved runtime configuration.
- **Doctor Directory → View/Create/Edit/Export/Provision Login** and **Doctor Availability → View/Edit** — supports doctor onboarding and schedule administration.
- **Wards/Beds → View/Create/Edit/ChangeStatus** and **Admission Policy → View/Edit** — configures admission resources and policy without performing daily patient transitions.
- **Reports → View** — provides management reporting.

### Receptionist — 18 required permissions

- **Patient Records → View/Create/Edit** — finds, registers, and corrects basic patient demographics.
- **Patient Documents → View/Create** and **Consent → View/Attach** — captures front-desk documents and attaches consent without clinical verification or deletion.
- **Doctor Directory/Availability → View** — selects an appropriate doctor and available slot.
- **Appointment Booking → View/Create/Edit** and **Appointment Records → View/Edit** — books, reschedules, cancels, and updates appointment status.
- **OPD Visits → View/Create/Edit** — `Create` is the exact Check In permission; `Edit` supports queue/no-show/completion state handling.
- **OPD Referral → View** — lets the receptionist coordinate an already-authored referral without changing its clinical contents.

### Doctor — 39 required permissions

- **Branches/Departments/Services/Consent Templates → View** — these are existing lookup dependencies used by the implemented inpatient and surgery workspaces; no create/edit administration permission is granted.
- **Patient Records → View; Patient Documents → View/Create; Consent → View/Verify** — provides clinical context, document capture, and prerequisite verification without routine demographic mutation.
- **Doctor Directory → View; Doctor Availability → View/Edit** — supports directory context and maintenance of the doctor's schedule.
- **Appointment Records → View** — shows the clinical schedule without giving booking/status administration.
- **OPD Visits → View/Edit; Vitals → View** — opens the active encounter and reviews observations; Check In/Create remains excluded.
- **Consultation, Prescription, Clinical Orders, Follow-up, Referral → View/Edit** — supplies the doctor's core clinical workflow.
- **Inpatient Admissions → View/Edit/Discharge** and **Admission Recommendations → View/Create/Cancel** — supports inpatient clinical review, recommendation, and authorized discharge.
- **Surgery Recommendations → View/Create/Cancel; Bookings → View; Schedule → View** — recommends a procedure and reviews its coordination without automatically becoming the surgery scheduler.
- **Laboratory Orders → View; Imaging Orders → View** — reviews diagnostic results without entering or verifying them.

### Clinician / Nurse — 19 required permissions

- **Branches/Departments/Services → View** — required lookup dependencies of the current inpatient workspace.
- **Patient Records → View; Patient Documents → View/Create; Consent → View/Attach** — provides care context and document/consent capture without demographic or verification authority.
- **Appointment Records → View; Doctor Directory → View** — supplies schedule and clinician context.
- **OPD Visits → View/Edit** — progresses an existing visit without creating/checking in the visit.
- **OPD Vitals → View/Create/Edit** — records and corrects observations.
- **Wards/Beds → View; Inpatient Admissions → View/Edit** — supports ward and inpatient care coordination without bed configuration or discharge finalization.

### Billing Authorized — 9 required permissions

- **Services → View** — resolves billable services and prices.
- **Patient Records → View; OPD Visits → View** — identifies the patient and source encounter without clinical editing.
- **Invoices → View/Create/Edit/CollectPayment/ViewReceipt** — performs routine billing and payment work; cancellation remains supervisory.
- **Reports → View** — provides the implemented finance/reporting workspace.

### Pharmacy User — 11 required permissions

- **Medicines → View/Create** — supplies the live Medicine Master lookup and “Add to Master” action used by the inventory workflow; it does not grant other Administration children.
- **OPD Prescription → View** — reads the prescriber's authorized order.
- **Medicine Inventory → View/RegisterBatch/RecordMovement/EditBatch** — receives and maintains batches and records normal stock movements.
- **Dispensing → View/Edit/Dispense/UpdateStatus** — prepares, confirms, and progresses dispensing.

### Laboratory User — 3 required permissions

- **Laboratory Orders → View/Edit/EnterResult** — works the laboratory queue and enters/corrects results. Verification is deliberately separate.

### Imaging User — 3 required permissions

- **Imaging Orders → View/Edit/EnterReport** — works the imaging queue and enters/corrects reports. Verification is deliberately separate.

### Admission / Front Desk User — 32 required permissions (recommended custom role)

- **Branches/Departments/Services/Consent Templates → View** — supplies the existing inpatient workspace lookups without master-data mutation.
- **Patient Records/Documents → View; Consent → View/Attach** — validates patient identity and captures admission prerequisites.
- **Doctor Directory/Availability → View; OPD Visits → View** — selects admitting context and reviews the originating visit.
- **Wards/Beds/Admission Policy → View** — reviews capacity and applicable policy without configuring those masters.
- **Bed Holds → View/Create/Release/Cancel** — manages the complete hold lifecycle.
- **Bed Transfers → View/Create/Complete/Cancel** — performs routine same-authority transfers; cross-branch transfer remains optional.
- **Inpatient Admissions → View/Create/Edit/Discharge** — confirms and administratively completes admissions.
- **Admission Recommendations → View** — consumes the doctor's recommendation without authoring it.
- **Admission Requests → View/Create/Validate/Confirm/Cancel** — performs the complete front-desk admission request workflow.

### Surgery User — 22 required permissions (recommended custom role)

- **Departments/Services/Consent Templates → View** — resolves procedure, department, and prerequisite configuration used by the live workspace.
- **Patient Records → View; Documents → View/Create; Consent → View/Attach/Verify** — reviews identity and manages procedure prerequisites.
- **Doctor Directory/Availability → View** — resolves surgeons and availability.
- **Inpatient Admissions → View** — reviews the linked inpatient context.
- **Surgery Recommendations → View; Bookings → View/Create/Confirm/Reschedule/Cancel/Complete; Schedule → View** — performs procedure coordination without automatically authoring the clinical recommendation.
- **Laboratory/Imaging Orders → View** — reviews prerequisite results without entering or verifying them.

### Emergency User — 27 required permissions (recommended custom role)

- **Departments/Services/Medicines → View** — supplies the live Emergency workspace lookup data without master mutation.
- **Patient Records → View; Doctor Directory/Availability → View; Pharmacy Inventory → View** — supports identity linking, clinician/availability selection, and medication availability review.
- **Appointment Booking → Create and OPD Referral → View** — supports the existing Emergency follow-up/referral endpoint dependency.
- **Encounters → View/Register/Edit** — registers and maintains Emergency encounters.
- **Triage → View/Assess** — performs normal triage while priority override remains supervisory.
- **Consultation → View/Edit and Orders → View/Create** — documents Emergency evaluation and downstream orders.
- **Disposition → View/Discharge/Transfer/ConvertToIP/MarkLeft/MarkNoShow** — performs normal patient-flow decisions; cancellation remains supervisory.
- **Patient Linking → Link** — links temporary Emergency identity to a patient; correction remains supervisory.
- **Laboratory/Imaging Orders → View** — reviews downstream diagnostic output without verification authority.

### Patient and Guardian

- **No staff permission assignment** — access is enforced through portal identity, ownership, and dependent relationships. Adding staff permissions would cross the portal/staff trust boundary.

## 5. Permissions that should not be assigned by default

| Role | Inappropriate baseline permissions | Reason |
|---|---|---|
| Administrator | Patient-specific clinical mutations; OPD consultation/prescription/orders; admission holds/transfers/requests; Surgery actions; Emergency actions; pharmacy, lab, imaging, and billing operations | Administration authority is not clinical or operational authority |
| Receptionist | OPD Vitals; consultation/prescription/orders; consent verification/deletion; diagnostic entry/verification; pharmacy inventory/dispensing; RBAC/settings | These are clinical, supervisory, inventory, or security functions |
| Doctor | Users/Roles/Permissions; master create/edit/delete; Appointment Check In/Create visit; billing payment/cancel; inventory adjustment; lab result entry/verification; imaging report entry/verification | Doctor identity does not imply administrative, cashier, technician, or verifier duties |
| Nurse | OPD Visits Create/Check In; doctor consultation/prescription edit; admission confirmation/discharge; result/report verification; pharmacy/billing/RBAC | Nursing care must not inherit receptionist, doctor, verifier, or cashier authority |
| Billing | Clinical editing; patient demographic editing; admissions/surgery/Emergency transitions; dispensing/stock; RBAC/settings | Billing needs source context, not clinical control |
| Pharmacy | Patient/OPD clinical editing; billing; lab/imaging; admissions/surgery/Emergency; RBAC/settings | Pharmacy authority is limited to medicines, inventory, and dispensing |
| Laboratory | Imaging report actions; clinical editing; pharmacy/billing; admissions/surgery/Emergency; Administration | Laboratory authority is order/result-specific |
| Imaging | Laboratory result actions; clinical editing; pharmacy/billing; admissions/surgery/Emergency; Administration | Imaging authority is study/report-specific |
| Admission | Consultation/prescription; surgery execution; Emergency clinical decisions; billing collection; stock control; result/report verification; RBAC/settings | Admission staff coordinate the administrative inpatient lifecycle |
| Surgery | Patient demographics edit; general Administration; billing collection; stock control; Emergency actions; result/report entry or verification | Surgery coordination needs context, not authority over source systems |
| Emergency | RBAC/settings; master mutation; routine billing; pharmacy dispensing/stock mutation; admission or surgery administration; diagnostic verification | Emergency actions should stay inside the Emergency encounter context |
| Patient/Guardian | Every staff permission | Portal authorization is ownership-based |

## 6. Optional permissions requiring hospital policy

- **Destructive Administration actions** — Users/Roles/Permissions/Branches/Departments/Services/Medicines Delete should be limited to a named senior administrator or SUPER_ADMIN policy.
- **Permission catalog Create/Edit/Delete** — optional only if the hospital genuinely maintains custom permission records; normal role assignment needs only Permissions View/Assign.
- **Receptionist admission, surgery, Emergency registration, and billing actions** — appropriate only where one combined front desk performs those functions. Prefer separate roles and multi-role assignment.
- **Doctor Patient Records Edit and Vitals Create/Edit** — enable only if doctors are responsible for demographic correction or recording vitals.
- **Doctor Surgery booking mutations and Emergency actions** — assign through Surgery/Emergency custom roles for clinicians rostered to those duties.
- **Nurse Consent Verify, diagnostic-result View, admission transfer initiation, and Emergency triage** — depends on local nursing scope and unit assignment.
- **Pharmacy AdjustStock/ConfigureLowStock/Dispensing Cancel/Reverse and Medicine Master Edit/Delete/Export** — supervisor or pharmacy-manager authority, not the baseline dispenser role.
- **Laboratory VerifyResult and Imaging VerifyReport** — supervisor/verifier authority; enterer and verifier separation should be retained where policy requires dual control.
- **Billing Cancel** — cashier supervisor authority. No refund permission exists in the current catalog.
- **Admission CrossBranch transfer** — only centralized bed control or explicitly authorized supervisors.
- **Surgery recommendation creation/cancellation or OPD prescribing** — only when the Surgery role is assigned to a clinician, not a coordinator.
- **Emergency OverridePriority, disposition Cancel, patient-link Correct, and formal Patient Create/Edit** — senior Emergency/registration authority with reasons and audit review.
- **Reports View for departmental roles** — optional only after confirming report-level branch/department filtering and absence of unrelated sensitive data.

## 7. Current versus recommended baseline

Optional permissions are not counted as baseline required. “Extra” means currently seeded but not in the baseline required set; an extra may be retained only after accepting the applicable policy decision.

| Role | Current seeded / override | Required baseline | Required already present | Missing required | Extra current |
|---|---:|---:|---:|---:|---:|
| Super Administrator | 172 via override | Override | Override | 0 | 0 |
| Administrator | 114 | 54 | 53 | 1 | 61 |
| Receptionist | 46 | 18 | 18 | 0 | 28 |
| Doctor | 52 | 39 | 33 | 6 | 19 |
| Clinician / Nurse | 22 | 19 | 15 | 4 | 7 |
| Billing Authorized | 10 | 9 | 9 | 0 | 1 |
| Pharmacy User | 13 | 11 | 9 | 2 | 4 |
| Laboratory User | 4 | 3 | 3 | 0 | 1 |
| Imaging User | 4 | 3 | 3 | 0 | 1 |
| Admission User | Not seeded | 32 | 0 | 32 if created | 0 |
| Surgery User | Not seeded | 22 | 0 | 22 if created | 0 |
| Emergency User | Not seeded | 27 | 0 | 27 if created | 0 |
| Patient / Guardian | 0 staff permissions | 0 | 0 | 0 | 0 |

### Missing permissions in existing seeded roles

- **Administrator:** Reports → View.
- **Doctor:** Administration Branches → View, Departments → View, Services → View, Consent Templates → View, Laboratory Orders → View, and Imaging Orders → View. The four Administration Views are lookup dependencies of the currently granted inpatient/surgery workflow; they do not justify any other Administration permission.
- **Clinician / Nurse:** Administration Branches → View, Departments → View, Services → View, and OPD Vitals → Edit. The first three support the currently granted inpatient workspace.
- **Pharmacy User:** Administration Medicines → View/Create. These support the current inventory medicine selector and “Add to Master” workflow without exposing other Administration children.
- **Receptionist, Billing, Laboratory, and Imaging:** no missing permission in the recommended baseline.
- **Admission, Surgery, Emergency:** no current role exists; creating any of these profiles is a business decision, not an automatic seed change.

### Excess permissions in existing seeded roles

- **Administrator — 61:** Permissions Create/Edit; Settings Export; all patient document/consent actions; all operational Bed Hold, Bed Transfer, Inpatient Admission, Admission Recommendation, and Admission Request actions; every Surgery permission; and every Emergency permission. Some may be deliberately retained in a small-hospital combined administrator policy, but they are not required for baseline administration.
- **Receptionist — 28:** OPD Vitals View/Create/Edit; OPD Referral Edit; 13 admission permissions; seven Surgery permissions; and four Emergency permissions. These should move to Admission/Surgery/Emergency or other explicitly combined roles.
- **Doctor — 19:** Patient Records Edit, Consent Attach, five Surgery booking mutations, and 12 Emergency permissions. Treat these as policy/specialty permissions rather than baseline Doctor authority.
- **Clinician / Nurse — 7:** Consent Verify, Doctor Availability View, Admission Requests View, and four Emergency permissions. Retain only for assigned clinical units.
- **Billing Authorized — 1:** Billing Invoice Cancel; reserve for a billing supervisor.
- **Pharmacy User — 4:** AdjustStock, ConfigureLowStock, Dispensing Cancel, and Reverse; reserve for a pharmacy supervisor/manager.
- **Laboratory User — 1:** VerifyResult; separate into a Lab Supervisor/verifier role where dual control is required.
- **Imaging User — 1:** VerifyReport; separate into an Imaging Supervisor/verifier role where dual control is required.

## 8. Multiple roles and custom roles

Use multi-role assignment instead of expanding a broad baseline role. Examples:

- A doctor rostered in Emergency receives `DOCTOR` plus a narrowly configured Emergency clinician role. Effective permissions are their union.
- A senior laboratory verifier receives `LABORATORY_USER` plus a custom role containing only `Laboratory / Orders / VerifyResult`.
- A pharmacy manager receives `PHARMACY_USER` plus the approved stock-control and reversal permissions.
- A receptionist who also collects payments receives `RECEPTIONIST` plus the selected Billing actions, not all Billing or Administration permissions.

Custom names such as Dental Coordinator, OPD Coordinator, Senior Nurse, Pharmacy Manager, Lab Supervisor, and Billing Supervisor must remain labels only. Authorization must continue to use permission tuples, never hard-coded custom role names.

## 9. Branch and department scope

- SUPER_ADMIN has enterprise permission override; normal operational use should still occur through scoped roles.
- Staff permissions operate only within branches authorized for the user. User and role-assignee administration is now branch-scoped for non-super users.
- Department assignments must belong to an assigned branch.
- Admissions, Surgery, and Emergency explicitly apply department row scope. Other major domains are primarily branch-scoped; the available FSD does not define universal department isolation.
- A role assignment must never be used to compensate for missing branch or department assignment. Conversely, branch membership never grants an action permission.

## 10. Business decisions required

1. Approve whether standalone Admission, Surgery, and Emergency roles should be created, or whether those duties will remain optional add-ons to existing roles.
2. Decide whether Administrator is configuration-only or a combined operational super-user. The baseline above removes 61 operational/clinical grants from routine administration.
3. Decide whether Receptionist is a general front desk or also performs admission, surgery scheduling, Emergency registration, or payment collection.
4. Define who may verify patient consent and whether the consent capturer may also verify it.
5. Define dual-control rules for Laboratory `EnterResult` versus `VerifyResult`, and Imaging `EnterReport` versus `VerifyReport`.
6. Define supervisor ownership for invoice cancellation, pharmacy cancellation/reversal, stock adjustment, low-stock configuration, cross-branch transfer, Emergency priority override, patient-link correction, and disposition cancellation.
7. Confirm whether doctors may edit patient demographics, record/edit vitals, manage Surgery bookings, or perform Emergency disposition under their baseline role.
8. Confirm whether nurses may view diagnostic results, verify consent, initiate transfers, or perform Emergency triage under their baseline role.
9. Define report-level data visibility before granting the broad Phase 2 Reports permission to departmental roles.
10. Define department row-level isolation domain by domain beyond Admissions, Surgery, and Emergency.
11. Decide whether the existing support lookups should continue using Administration child permissions or receive purpose-built non-administrative lookup contracts in a future approved architecture change. This analysis uses the current catalog and therefore recommends the narrow existing View permissions.
12. Export and reconcile live database role assignments before rollout; the seed baseline alone cannot prove current production assignments.

## 11. Final answer

Each role should receive only the `✓` permissions in the matrix as its baseline. `○` permissions must be approved and preferably supplied through a narrow additional/custom role. `—` permissions should not be assigned. SUPER_ADMIN should continue using its existing override. Multi-role access remains a union, while branch and department scope independently constrain the records on which those permissions operate.
