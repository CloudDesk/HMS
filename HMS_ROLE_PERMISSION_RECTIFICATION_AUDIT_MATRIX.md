# HMS Role and Permission Rectification Audit Matrix

Date: 4 September 2026

Legend: **Aligned** means the frontend condition, route policy, and backend check use the same effective database permissions. **Section-gated** means the parent screen remains accessible while an independently authorized section/action is hidden and its request is disabled. **Decision required** marks an FSD/business rule that was not inferred.

| Module | Screen | Action | Permission | Frontend condition | Route condition | Backend condition | Status |
|---|---|---|---|---|---|---|---|
| Administration | Dashboard | View | Administration / Dashboard / View | Dashboard tab and page | Exact View | Exact View | Aligned |
| Administration | Users | View | Administration / Users / View | Query and sidebar | Exact View | Exact View plus actor branch scope | Aligned |
| Administration | Users | Create | Administration / Users / Create | Create action | Parent View | Exact Create plus branch delegation and department/branch validation | Aligned |
| Administration | Users | Edit/status | Administration / Users / Edit | Edit/status actions | Parent View | Exact Edit plus authority and actor branch scope | Aligned |
| Administration | Users | Change password | Administration / Users / ChangePassword | Exact action capability | Parent View | Exact ChangePassword plus authority and actor branch scope | Aligned |
| Administration | Users | Reset password | Administration / Users / ResetPassword | Exact action capability | Parent View | Exact ResetPassword plus higher-authority and actor branch checks | Aligned |
| Administration | Users | Delete | Administration / Users / Delete | Exact action capability | Parent View | Exact Delete plus self/last-super-admin/branch checks | Aligned |
| Administration | Users | Export | Administration / Users / Export | Exact action capability | Parent View | Exact Export; exported pages retain actor branch scope | Aligned |
| Administration | Roles | View | Administration / Roles / View | Query and route | Requires Roles View and Permissions View for combined page | Exact View; assignee lists and user counts are actor-branch-scoped | Aligned composite |
| Administration | Roles | Create/edit/delete | Administration / Roles / Create, Edit, Delete | Separate action capabilities | Combined page Views | Matching exact middleware and service rules | Aligned |
| Administration | Roles | Assign/remove user | Administration / Roles / Assign | Requires Roles Assign; assignment picker also requires Users View | Combined page Views | Exact Assign plus authority and branch-scope enforcement | Aligned composite |
| Administration | Permissions | View | Administration / Permissions / View | Matrix query | Requires Roles View and Permissions View | Exact View | Aligned composite |
| Administration | Permissions | Assign | Administration / Permissions / Assign | Matrix editing | Combined page Views | Exact Assign, escalation protection, stale-version conflict | Aligned |
| Administration | Branches | View/create/edit/delete/export | Administration / Branches / exact action | Separate capabilities | Exact View for screen | Exact action middleware | Aligned |
| Administration | Departments | View/create/edit/delete/export | Administration / Departments / exact action | Separate capabilities | Exact View for screen | Exact action middleware | Aligned |
| Administration | Services | View/create/edit/delete/export | Administration / Services / exact action | Separate capabilities | Exact View for screen | Exact action middleware | Aligned |
| Administration | Medicine Master | View/create/edit/delete/export | Administration / Medicines / exact action | Separate capabilities | Exact Medicines View; Administration container shows only this child when it is the sole grant | Exact action middleware | Aligned; independent child |
| Administration | Consent Templates | View/create/edit | Administration / Consent Templates / exact action | Separate capabilities | Exact View | Exact action middleware | Aligned |
| Administration | Settings | View/edit/export | `settings.view`, `settings.edit`, `settings.export` tuples | Separate capabilities | Exact View | Exact action middleware | Aligned; internal keys preserved |
| Patients | Patient Records | View | Patients / Patient Records / View | Page/query/history capability | Exact View | Exact View plus branch scope | Aligned |
| Patients | Patient Records | Create | Patients / Patient Records / Create | Register action/form | Exact Create for register route | Exact Create plus branch scope | Aligned |
| Patients | Patient Records | Edit | Patients / Patient Records / Edit | Demographic editing; no Administrator role-name shortcut | Parent View | Exact Edit plus branch scope | Aligned |
| Patients | Patient Documents | View | Patients / Patient Documents / View | Document section/query | Requires Patient Records View and Documents View | Exact Documents View plus patient branch scope | Aligned composite |
| Patients | Patient Documents | Create/edit/delete | Patients / Patient Documents / exact action | Separate upload/review/delete capabilities | Composite parent Views | Exact action middleware | Aligned |
| Patients | Consent | View | Patients / Consent / View | Consent section/query | Requires Patient Records View and Consent View | Exact Consent View | Aligned composite |
| Patients | Consent | Attach/verify/delete | Patients / Consent / exact action | Separate action capabilities | Composite parent Views | Consent-specific check in addition to document authorization | Aligned |
| Doctors | Doctor Directory | View | Doctors / Doctor Directory / View | Directory/query | Exact View | Exact View plus branch scope | Aligned |
| Doctors | Doctor Directory | Create/edit/export | Doctors / Doctor Directory / exact action | Separate capabilities | Parent View | Exact action middleware plus branch scope | Aligned |
| Doctors | Doctor Directory | Provision doctor login | Doctors / Doctor Directory / Provision Login | `canProvisionLogin` only | Parent View | Explicit permission check and transactional account mapping | Aligned; display name clarified |
| Doctors | Availability | View/edit | Doctors / Doctor Availability / exact action | Separate capabilities | Directory View plus Availability View | Exact action middleware and doctor/branch context | Aligned composite |
| Appointments | Appointment Records | View | Appointments / Appointment Records / View | Dashboard/calendar/list | Exact View | Exact View plus branch scope | Aligned |
| Appointments | Appointment Records | Confirm/cancel/status | Appointments / Appointment Records / Edit | Exact status capability | Parent View | Exact Edit | Aligned |
| Appointments | Booking | Open and book | Appointment Booking / View + Create, Patient Records / View, Doctor Directory / View, Doctor Availability / View | Booking links require complete dependency set | Composite route requires all dependencies | Appointment Create plus supporting API permissions | Aligned composite |
| Appointments | Referral Booking | Book referral | Appointment Booking / View + Create and OPD Referral / View | Exact composite capability | Composite route | Backend referral booking requires OPD Referral View and Appointment Booking Create | Aligned composite |
| Appointments | Queue | View | Appointment Records / View + OPD Visits / View | Query gated by route; optional admin filter lookups are request-gated | Composite route requires both | Both list APIs independently protected | Aligned composite |
| Appointments | Queue | Check In | OPD / OPD Visits / Create | Check In and unlinked Call Next appear only with exact capability | Parent queue Views | OPD visit create endpoint requires exact Create | Aligned; Receptionist yes, Nurse/Doctor no by default |
| Appointments | Queue | Vitals | OPD Vitals / Create + OPD Visits / Edit | Requires both | Parent queue Views | Each API enforces its exact permission | Aligned composite |
| Appointments | Queue | Skip/no-show/complete | Appointment Records / Edit or OPD Visits / Edit according to record state | State-specific exact capability | Parent queue Views | Matching appointment/visit update endpoint | Aligned |
| Appointments | Calendar | Reschedule | Appointment Booking / Edit | Drag/drop and reschedule action require exact capability | Parent View | Appointment update requires Booking Edit | Aligned |
| OPD | Visits | View/create/edit | OPD / OPD Visits / exact action | Screen and workflow capabilities | View for OPD screens; Create is Check In | Exact action middleware plus branch scope | Aligned |
| OPD | Vitals | View/create/edit | OPD / OPD Vitals / exact action | Separate capability | Section-gated | Exact action middleware | Aligned |
| OPD | Consultation | View/edit | OPD / OPD Consultation / exact action | Start/open and edit capabilities separated | Exact View | Exact action middleware | Aligned |
| OPD | Prescription | View/edit | OPD / OPD Prescription / exact action | Section-gated | OPD workspace View | Exact action middleware | Aligned |
| OPD | Clinical Orders | View/edit | OPD / OPD Clinical Orders / exact action | Section-gated | OPD workspace View | Exact action middleware | Aligned |
| OPD | Follow-up | View/edit | OPD / OPD Follow-up / exact action | Section-gated | OPD workspace View | Exact action middleware | Aligned |
| OPD | Referral | View/edit | OPD / OPD Referral / exact action | Section-gated | OPD workspace View | Exact action middleware | Aligned |
| Admissions | Wards/Beds | View/create/edit/change status | Admissions / Wards or Beds / exact action | Separate capabilities | Exact View | Exact action plus branch scope and lifecycle validation | Aligned |
| Admissions | Bed Holds | View/create/release/cancel | Admissions / Bed Holds / exact action | Separate capabilities | Bed screen View | Exact action, conditional updates, transaction/audit | Aligned |
| Admissions | Bed Transfers | View/create/complete/cancel/cross-branch | Admissions / Bed Transfers / exact action | Separate capabilities | Inpatient workspace View | Exact action and explicit CrossBranch permission | Aligned |
| Admissions | Admission Requests | View/create/validate/confirm/cancel | Admissions / Admission Requests / exact action | Separate capabilities | Exact View | Exact action, branch/department scope, prerequisites and transactions | Aligned |
| Admissions | Inpatient Admissions | View/create/edit/discharge | Admissions / Inpatient Admissions / exact action | Separate capabilities | Exact View | Exact action, branch/department scope, lifecycle/audit | Aligned |
| Surgery | Recommendations | View/create/cancel | Surgery / Recommendations / exact action | Independent section capabilities | Shared route opens with any one Surgery View | Exact action and branch/department scope | Aligned section-gated |
| Surgery | Bookings | View/create/confirm/reschedule/cancel/complete | Surgery / Bookings / exact action | Independent action capabilities | Shared route opens with any one Surgery View | Exact action, conflicts, prerequisites and audit | Aligned section-gated |
| Surgery | Schedule | View | Surgery / Schedule / View | Independent tab/query | Shared route opens with any one Surgery View | Exact View | Aligned section-gated |
| Emergency | Encounters | View/register/edit | Emergency / Encounters / exact action | Separate capabilities | Exact View | Exact action plus branch/department scope | Aligned |
| Emergency | Triage | View/assess/override priority | Emergency / Triage / exact action | Separate capabilities | Emergency parent View | Exact action middleware | Aligned |
| Emergency | Consultation | View/edit | Emergency / Consultation / exact action | Separate capabilities | Emergency parent View | Exact action middleware | Aligned |
| Emergency | Orders | View/create | Emergency / Orders / exact action | Section-gated | Emergency parent View | Exact action and source-context validation | Aligned |
| Emergency | Disposition | Discharge/transfer/convert/left/no-show/cancel | Emergency / Disposition / exact action | Decision-specific capability | Emergency parent View | Backend maps each decision to the same exact permission | Aligned |
| Emergency | Patient Linking | Link/correct | Emergency / Patient Linking / exact action | Separate capabilities | Emergency parent View | Exact action plus identity validation/audit | Aligned |
| Pharmacy | Dispensing | View/edit/dispense/cancel/reverse/update status | Pharmacy / Dispensing / exact action | Separate capabilities | Exact View | Exact action middleware and branch scope | Aligned |
| Pharmacy | Medicine Inventory | View/register batch/edit batch | Pharmacy / Medicine Inventory / exact action | Separate capabilities | Exact View | Exact action middleware and branch scope | Aligned |
| Pharmacy | Medicine Inventory | Record movement/adjust stock/configure low stock | Existing technical actions retained | Operation choices and buttons use exact capability | Parent View | Matching exact middleware | Aligned; display names clarified |
| Laboratory | Orders | View/edit | Laboratory / Orders / exact action | Separate capabilities | Exact View | Exact action and branch scope | Aligned |
| Laboratory | Orders | Enter result | Laboratory / Orders / EnterResult | Entry button/form only | Parent View | Exact EnterResult on create/update result APIs | Aligned and independent |
| Laboratory | Orders | Verify result | Laboratory / Orders / VerifyResult | Verify transition only | Parent View | Status endpoint maps VERIFIED to VerifyResult | Aligned and independent |
| Imaging | Orders | View/edit | Imaging / Orders / exact action | Separate capabilities | Exact View | Exact action and branch scope | Aligned |
| Imaging | Orders | Enter report | Imaging / Orders / EnterReport | Entry button/form only | Parent View | Exact EnterReport on create/update APIs | Aligned and independent |
| Imaging | Orders | Verify report | Imaging / Orders / VerifyReport | Verify transition only | Parent View | Status endpoint maps VERIFIED to VerifyReport | Aligned and independent |
| Billing | Invoices | View/create/edit/cancel | Billing / Invoices / exact action | Separate capabilities | Exact View | Exact action plus branch scope | Aligned |
| Billing | Invoices | Collect payment | Billing / Invoices / CollectPayment | Exact payment capability | Parent View | Exact CollectPayment plus transaction/idempotency rules | Aligned |
| Billing | Invoices | View receipt | Billing / Invoices / ViewReceipt | Exact receipt capability | Parent View | Exact ViewReceipt | Aligned; display name clarified |
| Reports | Reports | View | Reports / Phase 2 Reports / View | Dashboard/sidebar/query | Exact View | Exact View plus report-level branch filters | Aligned; display label simplified |

## Scope audit result

- Effective permissions are the union of all active roles; inactive/deleted roles and permissions are excluded by authentication and backend permission resolution.
- Frontend access refreshes on role save for the editing user, on window focus/visibility, and every 60 seconds; backend authorization changes are immediate.
- Branch scope is already enforced in the principal patient, appointment, doctor, OPD, Emergency, Admissions, Surgery, Pharmacy, Laboratory, Imaging, Billing, notification, and report services. This rectification closes the confirmed user-management read/export/update, role-assignment, role-assignee-list, and role-user-count branch gaps.
- A user with no active branch assignment receives an empty non-super user-management scope rather than implicit enterprise access.
- Department assignments must now belong to at least one selected branch.
- Universal department row isolation is not defined by the available FSD. Existing explicit department isolation in Admissions, Surgery, and Emergency is preserved. Extending it to other domains remains **Decision required**.

## Known non-authoritative UI exports

Client-side Print/Export controls that only format data already returned by an authorized View API do not grant additional record access. Where a dedicated backend Export permission exists, the frontend and backend use it. No new technical permission keys were invented for local formatting actions.
