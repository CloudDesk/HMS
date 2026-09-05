# HMS Role & Permission Usage

**Analysis date:** 3 September 2026  
**Scope:** Current source implementation in `apps/api`, `apps/web`, and `apps/patient-web`  
**Method:** Static, read-only trace of models, repositories, services, routes, authentication state, route guards, navigation, feature hooks, and seed definitions. No production code was changed. The Phase 3 prompt and Release 2 FSD DOCX files referenced by repository instructions are not present in this checkout.

## 1. Overall RBAC Flow

HMS implements database-backed role-based access control (RBAC) for the staff application. A staff user receives access through one or more active roles. Each role references permissions. Each permission is a case-insensitive `(module, screen, action)` tuple such as `(Billing, Invoices, CollectPayment)`.

Authorization has three separate dimensions:

1. **Authentication:** the bearer access token identifies an active user.
2. **Capability:** an active role must grant the required active permission, unless the user has the active `SUPER_ADMIN` role.
3. **Data scope:** domain services/repositories may further restrict records by the user's branch and, in selected domains, department assignments.

The backend is the final authority. Frontend route and button checks improve the experience and reduce unauthorized calls, but every protected staff operation is intended to be checked again by Fastify middleware or an equivalent dynamic permission check.

Patient and guardian access is a separate portal authorization model. `PATIENT` and `GUARDIAN` have no staff permissions; portal services authorize access by the authenticated account's linked patient/dependent ownership.

The complete staff access path is:

```text
User
  -> active Role(s)
  -> active Permission(s)
  -> Module
  -> Screen
  -> Action
  -> backend authorization
  -> branch scope
  -> department scope where implemented
  -> allowed records
```

In practical terms:

| Access concern | Primary control |
|---|---|
| What a user sees in the sidebar/dashboard | Expanded frontend permissions, plus role-specific dashboard composition |
| What page a user can open | Frontend route requirements |
| What operation a user can perform | Screen/action capability in the UI and an independent backend permission check |
| Which records a user can access | Branch scope, ownership rules, and department scope in the domains that implement it |
| Whether a role grants anything | Role and permission must both be active and not deleted |

## 2. Roles Available

### Persistence

`RoleModel` stores:

- `code`, `name`, optional `description` and display `color`
- `type`: logically `system | custom`
- `status`: `active | inactive`
- `permissionIds`: references to `Permission`
- audit actor fields and soft-delete fields

Roles do **not** store branch or department. Those assignments belong to `UserModel`.

`UserModel` stores arrays of `roleIds`, `branchIds`, and `departmentIds`; therefore a user can have multiple roles, multiple branches, and multiple departments. Effective permissions are the union of all active permissions from all active, non-deleted roles.

### System and custom role behavior

The database seed defines 11 system roles:

1. `SUPER_ADMIN` — Super Administrator
2. `ADMINISTRATOR` — Administrator
3. `PATIENT` — Patient
4. `GUARDIAN` — Parent / Guardian
5. `RECEPTIONIST` — Receptionist
6. `CLINICIAN_NURSE` — Clinician / Nurse
7. `DOCTOR` — Doctor
8. `PHARMACY_USER` — Pharmacy User
9. `LABORATORY_USER` — Laboratory User
10. `IMAGING_USER` — Imaging User
11. `BILLING_AUTHORIZED` — Billing Authorized

All 11 seeded roles are system roles. Their typical use, department relationship, and data boundary are:

| Role | Purpose / typical user | Department relationship | Branch restriction |
|---|---|---|---|
| Super Administrator | Global platform owner | Bypasses role/department compatibility checks | Permission checks are global; domain business rules still apply |
| Administrator | Hospital/branch operations administrator | Compatibility check is bypassed | Assigned branches are stored on the user, although current user-management scope has gaps noted in section 17 |
| Doctor | Treating clinician | Compatible with Doctor/Medical/Consultation/Clinic and Emergency-style departments | Assigned user branches; department filtering only where the domain implements it |
| Clinician / Nurse | Nursing and clinical support staff | Compatible with Nursing/Ward/IPD, Doctor/Medical, and Emergency-style departments | Assigned user branches; selective department filtering |
| Receptionist | Front desk, registration, booking, and intake staff | Compatible with Reception/Front Desk and Emergency-style departments | Assigned user branches; selective department filtering |
| Pharmacy User | Dispenser/inventory operator | Compatible with Pharmacy departments | Assigned user branches |
| Laboratory User | Laboratory order/result operator | Compatible with Laboratory/Lab departments | Assigned user branches |
| Imaging User | Radiology/imaging order/report operator | Compatible with Imaging/Radiology departments | Assigned user branches |
| Billing Authorized | Invoice/payment/report operator | Compatible with Billing/Finance/Accounts departments | Assigned user branches |
| Patient | Patient portal account | Staff compatibility and department requirement are bypassed | Linked-patient ownership, not staff branch RBAC |
| Parent / Guardian | Portal account acting for linked dependents | Staff compatibility and department requirement are bypassed | Dependent ownership/link authorization |
| Custom role | Organization-defined combination of existing permissions | Determined by the assigned user's departments and the current compatibility rules | Assigned branches on the user; no branch data is stored on the role |

The screenshot shows 12 total roles, 11 system roles, and one custom role. The custom role's identity and permissions cannot be determined from source code because custom records remain runtime database data. The detailed seeded permission grants for each role are in sections 8 and 9.

The service implements these rules:

- New roles created through the API must be custom; callers cannot create a system role or adopt a protected system code.
- Custom roles can be renamed, recolored, re-described, activated/deactivated, cloned, assigned to users, and have permissions replaced.
- A custom role can be deleted only when inactive and assigned to no users. Deletion is soft deletion.
- System roles cannot be deleted and cannot have their code/type changed.
- `SUPER_ADMIN` cannot be deactivated and its permission set cannot be edited.
- The backend technically permits non-`SUPER_ADMIN` system roles to be renamed/recolored/re-described, deactivated, and have permissions adjusted.
- The current UI is stricter: it disables Edit and Activate/Deactivate for every system role, while still allowing permission adjustment for non-`SUPER_ADMIN` system roles.
- Role assignment is authority-bounded: a non-super administrator cannot assign or modify a role containing permissions outside their own effective permission set, and only a Super Administrator can assign `SUPER_ADMIN`.
- Higher-authority users and roles cannot be modified through alternate assignment endpoints by lower-authority actors.

### User/department compatibility

User creation and update require at least one role, branch, and department for staff accounts, with exactly one primary branch and department. Portal account provisioning is the intentional exception and can use no branch/department.

The user service applies name/code-based role-to-department compatibility checks, for example:

- Imaging/Radiology department -> `IMAGING_USER`
- Laboratory/Lab -> `LABORATORY_USER`
- Pharmacy -> `PHARMACY_USER`
- Nursing/Ward/IPD -> `CLINICIAN_NURSE`
- Reception/Front Desk -> `RECEPTIONIST` (plus portal roles in the current check)
- Billing/Finance/Accounts -> `BILLING_AUTHORIZED`
- Doctor/Medical/Consultation/Clinic -> `DOCTOR` or `CLINICIAN_NURSE`
- Emergency/Casualty -> `DOCTOR`, `CLINICIAN_NURSE`, or `RECEPTIONIST`

`SUPER_ADMIN`, `ADMINISTRATOR`, `PATIENT`, and `GUARDIAN` bypass that compatibility check.

## 3. Permission Structure

### Representation and assignment

`PermissionModel` stores `code`, `name`, `module`, `screen`, `action`, `type`, `status`, category/group references, audit fields, and soft-delete fields. Permission categories are `SYSTEM`, `CLINICAL`, and `FINANCE`; groups generally mirror modules.

Permissions are assigned to roles through `Role.permissionIds`. There is no direct user-permission array. A user's access is therefore:

```text
User
  -> zero or more active Role records
  -> union of referenced active Permission records
  -> module/screen/action capability
  -> branch and sometimes department data scope
```

`SUPER_ADMIN` is special: both the auth response and backend permission check treat it as possessing every active, non-deleted permission, even if its stored `permissionIds` are stale.

### Permission granularity

Permissions combine page/feature and API action granularity:

- **Module:** Administration, Patients, Doctors, Appointments, OPD, Pharmacy, Admissions, Surgery, Emergency, Laboratory, Imaging, Billing, Reports.
- **Screen/workspace:** examples include Roles, Patient Records, OPD Consultation, Bed Holds, Bookings, Orders, and Invoices.
- **Action/API operation:** View, Create, Edit, Delete, Assign, Export, workflow-specific verbs, and so on.

There is no independent module-level grant. A module becomes visible when at least one configured sidebar route's required screen/action tuple is satisfied.

### Meaning of implemented actions

| Action family | Meaning in the current application |
|---|---|
| `View` | List, read detail, summary, download/read supporting data, or open a route whose default action is View. |
| `Create` | Create a record or, in some domains, add a clinical/operational child record. |
| `Edit` | Update a record, save a draft, change certain statuses, or complete a workflow when no more specific action exists. |
| `Delete` | Usually soft-delete/deactivate-capable deletion after service restrictions. |
| `Assign` | Assign users to roles or replace a role's permission set. |
| `ChangePassword` | Change another user's password only with the current password supplied. |
| `ResetPassword` | Administrative reset without the old password; authority comparison and session revocation apply. |
| `Export` | Backend CSV/export for users and master data. The Roles screen's JSON export is client-side and is not protected by a dedicated Export permission. |
| `Attach`, `Verify` | Attach/replace and verify patient consent documents. Consent upload/delete also passes the generic document guard plus a consent-specific dynamic check. |
| `Provision Login` | Create/map a login account for a doctor. |
| Pharmacy actions | `RegisterBatch`, `RecordMovement`, `AdjustStock`, `EditBatch`, `ConfigureLowStock`, `Dispense`, `Cancel`, `Reverse`, `UpdateStatus`. |
| Admission actions | `ChangeStatus`, hold `Release/Cancel`, transfer `Complete/CrossBranch`, request `Validate/Confirm/Cancel`, and admission `Discharge`. |
| Surgery actions | Recommendation `Cancel`; booking `Confirm/Reschedule/Cancel/Complete`. |
| Emergency actions | `Register`, `Assess`, `OverridePriority`, order `Create`, disposition `Discharge/Transfer/ConvertToIP/MarkLeft/MarkNoShow/Cancel`, and patient `Link/Correct`. |
| Lab/Imaging actions | `EnterResult/VerifyResult` and `EnterReport/VerifyReport`. |
| Billing actions | `Cancel`, `CollectPayment`, and `ViewReceipt`. |

`Approve` and `Print` appear only in the frontend's preferred column-order list. They are not active permission definitions in the seed. HMS uses specific actions such as Confirm, Validate, VerifyResult, and VerifyReport instead.

## 4. User → Role → Permission Relationship

The source of truth is MongoDB, not the JWT and not the frontend.

- JWT payload: user ID and username only.
- Every authenticated API request reloads the user by token subject and rejects inactive/locked users.
- Every `requirePermission` call queries the active permission tuple, active user, and at least one active role that either references the permission or has code `SUPER_ADMIN`.
- Login, refresh, and `/auth/me` expand active roles, active permissions, and active branches into the frontend `AuthUser` object.
- Departments are not returned in `AuthUser`; department scope remains backend-only.
- Inactive/deleted roles and inactive/deleted permissions stop granting backend access immediately because authorization is re-read from MongoDB per request.
- Another user's already-open frontend may display stale navigation/buttons until `/auth/me` refreshes on focus, visibility change, the 60-second sync, token refresh, or new login. A stale UI cannot override the backend denial.

### Implementation permission flow

```text
Role configuration page
  -> Roles/Permissions feature hook
  -> roles and permissions domain hooks
  -> API client
  -> Fastify role/permission routes
  -> requirePermission middleware
  -> RoleService / PermissionService
  -> RoleRepository / PermissionRepository
  -> MongoDB Role.permissionIds

User assignment
  -> User.roleIds (+ User.branchIds/User.departmentIds)

Login / refresh / auth-me
  -> AuthService
  -> AuthRepository.getUserAccessContext
  -> active roles + expanded active permissions + active branches
  -> AuthContext

Application access
  -> getAccessibleSidebarModules (navigation)
  -> canAccessRoute (direct URL)
  -> feature-hook capability flags (queries/buttons)
  -> API request
  -> requirePermission or dynamic backend permission check
  -> domain branch/department ownership validation
```

Relevant implementation responsibilities:

- `role.model.ts`, `permission.model.ts`, `user.model.ts`: persistence relationships.
- `role.service.ts`: role restrictions, lifecycle, assignment, audit, and authority checks.
- `permission.service.ts`: effective-authority comparison, permission CRUD, full role-permission replacement, denied-access audit.
- `permission.repository.ts`: actual effective permission lookup and `SUPER_ADMIN` exception.
- `auth.service.ts` and `auth.repository.ts`: login/session validation and frontend access-context expansion.
- `authenticate.ts`: bearer authentication.
- `require-permission.ts`: authoritative tuple check and 403 audit.
- `AuthContext.tsx`: session restoration and periodic/focus permission refresh.
- `access-control.ts`: frontend route and sidebar decisions.
- `AppRouter.tsx` and `ProtectedRoute.tsx`: authentication and direct-route handling.
- Domain feature hooks: query gating and action capability flags.

### Source-defined inventory note

The 11 source-defined system roles are listed in section 2. Custom roles are supported globally and are permission-driven. `BRANCH_ADMIN` appears in an unused role-manager helper but is not seeded and has no special effective-permission behavior; it should not be described as an available baseline role.

The seed creates representative users for Receptionist, Nurse, Pharmacy, Laboratory, Imaging, and Billing in two branches. A bootstrap `admin` user receives `SUPER_ADMIN`. Doctor accounts are provisioned through the doctor/user workflow rather than the general seed user list.

## 5. Dashboard Behavior by User

Dashboard tabs are assembled from the authenticated user's role identity and View permissions. `SUPER_ADMIN` and the major seeded staff roles have curated tab ordering; a custom role receives permission-derived tabs and falls back to **My Access** if no curated workspace qualifies. Dashboard tabs do not create authority: their pages and API calls remain independently protected.

| Role | Dashboard type and tabs |
|---|---|
| Super Administrator | Executive dashboard: Overview, Doctors, Appointments, OPD, Billing, Administration |
| Administrator | Administration, Emergency, Admissions, Surgery |
| Doctor | My Clinical Day, OPD, Emergency, Admissions, Surgery |
| Receptionist | Appointments, OPD, Emergency, Admissions, Surgery |
| Clinician / Nurse | Appointments, OPD, Emergency, Admissions |
| Pharmacy User | Pharmacy Queue, Pharmacy Inventory |
| Laboratory User | Laboratory |
| Imaging User | Imaging |
| Billing Authorized | Billing, OPD, Reports |
| Patient / Guardian | Separate patient portal overview rather than the staff dashboard |
| Custom role | Permission-derived tabs in configured order; My Access fallback |

Cards and quick actions are generally rendered within an authorized tab and use feature-hook capability flags. The principal dashboard risks are indirect: stale frontend permissions can leave a tab visible briefly after revocation, and composite pages can appear even when a supporting API permission is missing. The backend still denies unauthorized requests.

## 6. Navigation Behavior by User

The sidebar is generated from configured navigation items and filtered through route requirements using the permission set returned by `/auth/me`. Hiding an item is not the security boundary; direct URLs are checked separately and APIs authorize again.

| Role | Visible navigation areas |
|---|---|
| Super Administrator | All configured staff navigation |
| Administrator | Patient Consent/Documents support; Doctor Directory/Availability; Emergency; Admissions; Surgery; Users, Roles & Permissions, Departments, Services, Medicines, Branches, Consent Templates, Settings |
| Doctor | Patients; Doctor Directory/Availability/Schedule; Appointment Calendar/Queue; OPD Consultation/Queue; Emergency; Inpatient Workspace; Surgery |
| Receptionist | Patients; all Doctor and Appointment navigation; OPD Queue; Emergency; all Admissions navigation; Surgery |
| Clinician / Nurse | Patients; Doctor navigation; Appointment Calendar/Queue; OPD Queue; Emergency; Admissions |
| Pharmacy User | Prescription Queue and Pharmacy Inventory |
| Laboratory User | Laboratory Work Queue |
| Imaging User | Imaging Work Queue |
| Billing Authorized | Patient Search; OPD Queue; Billing Workspace/History; Reports; read-only Service Catalogue |
| Patient / Guardian | No staff sidebar; patient portal navigation only |
| Custom role | Only items whose configured route requirements are satisfied |

## 7. Module Access by User

**Full Access** below means the broad seeded lifecycle for that module, not immunity from validation or data scope. **Partial Access** means one or more screens/actions only. Live access can differ if administrators change non-super system roles or assign multiple/custom roles.

| Role | Dashboard | Patients | Appointments | OPD | Emergency | Admissions | Surgery | Pharmacy | Lab | Imaging | Billing | Reports | Administration |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Super Administrator | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full |
| Administrator | Partial | Partial | No | No | Full | Full | Full | No | No | No | No | No | Full |
| Doctor | Partial | Full | Partial | Full | Partial | Partial | Full | No | No | No | No | No | No |
| Receptionist | Partial | Full | Full | Partial | Partial | Full | Partial | No | No | No | No | No | No |
| Clinician / Nurse | Partial | Partial | Partial | Partial | Partial | Partial | No | No | No | No | No | No | No |
| Pharmacy User | Partial | No | No | Supporting prescription read only | No | No | No | Full | No | No | No | No | No |
| Laboratory User | Partial | No | No | No | No | No | No | No | Full | No | No | No | No |
| Imaging User | Partial | No | No | No | No | No | No | No | No | Full | No | No | No |
| Billing Authorized | Partial | Partial | No | Partial | No | No | No | No | No | No | Full | Full | Partial |
| Patient / Guardian | Portal | Portal | Portal | No | No | No | No | No | No | No | Portal | No | No |
| Custom role | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived |

## 8. Screen Access by User

This section describes the source-defined seed grants. A live database can differ because non-super system-role permission sets are editable and custom roles are runtime data.

### Super Administrator

- Dashboard: executive Overview plus Doctors, Appointments, OPD, Billing, and Administration tabs.
- Navigation/routes: all configured staff modules and all permission-controlled routes.
- Actions: every active permission; can create custom roles, adjust non-super role permissions, assign `SUPER_ADMIN`, and manage users of any authority.
- Restrictions: cannot edit its own permission set or deactivate/delete the protected `SUPER_ADMIN` role. Domain business-state validation still applies.

### Administrator

- Dashboard: Administration first, then Emergency, Admissions, and Surgery where the page requirements are met.
- Administration: dashboard; users except Delete; roles/permissions except Delete; branches/departments/services/medicines except Delete; consent templates; notifications; settings.
- Clinical/operations: doctor directory/availability administration, patient documents/consents, full Admissions management, full Surgery management, and full Emergency management.
- Does not receive baseline Patient Records, Appointments, OPD, Pharmacy, Laboratory, Imaging, Billing, or Reports permissions.
- Cannot assign/modify `SUPER_ADMIN` or a user/role beyond its own permission authority.

### Doctor

- Dashboard: `My Clinical Day` first, then OPD, Emergency, Admissions, and Surgery.
- Patients: view/edit records; view/create documents; view/attach/verify consent.
- Doctors/Appointments: view doctor directory; view/edit own availability; view appointment records. No baseline appointment booking or appointment-record edit.
- OPD: view/edit visits; view vitals; view/edit consultation, prescription, clinical orders, follow-up, and referral.
- Diagnosis: there is no separate Diagnosis permission. Diagnosis is represented inside the consultation assessment, so `OPD Consultation:Edit` controls creating/editing it.
- Admissions: view/edit/discharge inpatients and view/create/cancel recommendations; no admission-request confirmation or bed-management grant.
- Surgery: full recommendation and booking lifecycle plus schedule.
- Emergency: view encounter/triage; edit consultation; create orders; discharge, transfer, convert to IP, mark left; link patient.
- No baseline Billing, Administration, Pharmacy, Laboratory, Imaging, or Reports access.

### Receptionist

- Dashboard: Appointments first, then OPD, Emergency, Admissions, and Surgery.
- Patients: view/create/edit patient records; view/create documents; view/attach consent.
- Doctors/Appointments: view directory and availability; view/create/edit bookings; view/edit appointment records.
- OPD: view/create/edit visits and vitals; view/edit referrals. No consultation, prescription, orders, or follow-up access.
- Admissions: view beds/wards/policy; manage holds; view inpatients; create/validate/confirm/cancel requests.
- Surgery: view recommendations/schedule and create/confirm/reschedule/cancel bookings; cannot create/cancel recommendations or complete bookings.
- Emergency: view/register encounters, view triage, and link patients. No triage assessment, consultation edit, orders, or disposition actions.
- No baseline Pharmacy, Laboratory, Imaging, Billing, Reports, or Administration access.

### Clinician / Nurse

- Dashboard: Appointments first, then OPD, Emergency, and Admissions.
- Patients: view records; view/create documents; view/attach/verify consent.
- Doctors/Appointments: view directory, availability, and appointment records.
- OPD: view/edit visits; view/create vitals. No consultation editing, diagnosis, prescription, clinical orders, follow-up, or referral.
- Admissions: view beds/wards/requests; view/edit inpatients. No hold, transfer, confirmation, or discharge grant.
- Emergency: view encounters, assess triage, and view consultation. No consultation edit, orders, or disposition.
- No baseline Surgery, Pharmacy, Laboratory, Imaging, Billing, Reports, or Administration access.

### Pharmacy User

- Dashboard/navigation: Pharmacy Queue and Pharmacy Inventory only.
- Can view OPD prescriptions through supporting APIs.
- Full seeded inventory and dispensing action set, including dispensing cancellation/reversal and stock adjustments.
- No staff access to Patients, Doctors, Appointments, OPD pages, Admissions, Surgery, Emergency, Lab, Imaging, Billing, Reports, or Administration.

### Laboratory User

- Dashboard/navigation: Laboratory queue only.
- Can view/edit orders, enter results, and verify results.
- No other seeded module access.

### Imaging User

- Dashboard/navigation: Imaging queue only.
- Can view/edit orders, enter reports, and verify reports.
- No other seeded module access.

### Billing Authorized

- Dashboard: Billing first, then OPD and Reports.
- Billing: view/create/edit/cancel invoices, collect payments, and view receipts.
- Supporting read access: Patient Records, OPD Visits, and Administration Services.
- Reports: Phase 2 Reports.
- No Pharmacy, Lab, Imaging, Admissions, Surgery, Emergency, broader clinical-editing, user/role administration, or master-data mutation.

### Patient and Parent / Guardian

- Rejected by the staff frontend after login and directed to the patient website.
- Patient portal: overview, owned/dependent appointments, invoices, documents, profile, dependent linking, booking, and eligible rescheduling.
- Portal authorization is ownership/context based in `PatientPortalService`; it does not use the staff permission matrix.

### Detailed full/partial-access reference

Legend: **F** = broad seeded lifecycle access, **P** = partial/read/support access, **-** = no seeded access, **Portal** = separate portal only.

| Role | Patients | Doctors | Appointments | OPD | Emergency | Admissions | Surgery | Pharmacy | Lab | Imaging | Billing | Reports | Administration |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Super Administrator | F | F | F | F | F | F | F | F | F | F | F | F | F |
| Administrator | P | F | - | - | F | F | F | - | - | - | - | - | F |
| Doctor | F | P | P | F | F | P | F | - | - | - | - | - | - |
| Receptionist | F | P | F | P | P | F | P | - | - | - | - | - | - |
| Clinician / Nurse | P | P | P | P | P | P | - | - | - | - | - | - | - |
| Pharmacy User | - | - | - | - | - | - | - | F | - | - | - | - | - |
| Laboratory User | - | - | - | - | - | - | - | - | F | - | - | - | - |
| Imaging User | - | - | - | - | - | - | - | - | - | F | - | - | - |
| Billing Authorized | P | - | - | P | - | - | - | - | - | - | F | F | P |
| Patient / Guardian | Portal | - | Portal | - | - | - | - | - | - | - | Portal | - | - |

This table is conceptual. The action lists in section 8 and the seed are authoritative; a `P` does not imply access to every screen in that module.

## 9. Action/Permission Access by User

The role descriptions in section 8 are the detailed source-derived action lists. Important examples of **partial** access are:

- **Doctor / OPD:** visits View/Edit; vitals View; consultation, prescription, clinical orders, follow-up, and referral View/Edit. The Doctor cannot register an OPD visit, record vitals, or perform receptionist booking actions from these grants.
- **Doctor / Admissions:** inpatient View/Edit/Discharge and recommendation View/Create/Cancel. No bed hold/allotment administration or admission-request Validate/Confirm.
- **Receptionist / OPD:** visits and vitals View/Create/Edit, plus referral View/Edit. No consultation, prescription, clinical-order, or follow-up permission.
- **Receptionist / Emergency:** encounter View/Register, triage View, and patient Link. No Assess, consultation Edit, order Create, or disposition action.
- **Clinician / Nurse / OPD:** visits View/Edit and vitals View/Create. No consultation, diagnosis/assessment, prescription, clinical orders, follow-up, or referral.
- **Billing Authorized:** complete seeded invoice lifecycle plus read-only Patient Records, OPD Visits, Services, and Reports support.

Business meaning and seeded role ownership for important actions:

| Action | User-visible meaning | Seeded roles with that action in the relevant workflow |
|---|---|---|
| View | Open/list/read the protected resource | Varies by screen; Super Administrator always passes active permissions |
| Create | Register or add a new record | Administrator in owned admin/operational domains; Doctor for clinical recommendations; Receptionist for registration/booking; workflow roles where listed |
| Edit | Modify an existing record or save workflow data | Granted per screen, never implied by View |
| Delete | Soft-delete/remove where the service permits | Super Administrator broadly; Administrator lacks seeded Users/Roles/Permissions Delete |
| Assign | Assign users to roles or replace role permissions | Super Administrator and Administrator, subject to authority boundaries |
| Export | Request supported backend exports | Super Administrator and Administrator for seeded administration resources; the role-page JSON draft export is currently client-only |
| Verify / Confirm | Verify consent/results/reports, or confirm an admission/booking | Doctor/Nurse for consent Verify; Lab/Imaging specialists for results/reports; Receptionist/Administrator for applicable bookings/requests |
| Cancel | Cancel the specific workflow record after transition validation | Granted separately for admission, surgery, emergency, pharmacy, and billing workflows |
| CollectPayment / ViewReceipt | Take an invoice payment or retrieve its receipt | Billing Authorized and Super Administrator |
| Dispense / Reverse | Dispense prescribed medicine or reverse dispensing | Pharmacy User and Super Administrator |
| EnterResult / VerifyResult | Record and clinically verify laboratory results | Laboratory User and Super Administrator |
| EnterReport / VerifyReport | Record and verify an imaging report | Imaging User and Super Administrator |
| Discharge / Transfer / ConvertToIP | Perform the named patient-flow transition | Doctor or Administrator where seeded; Emergency and Admission actions are distinct permissions |

The UI normally hides or disables unauthorized controls and gates their queries. The backend remains decisive if a control is accidentally visible. Confirmed mismatches are documented in section 17; no confirmed protected business API was found that trusts button visibility alone.

## 10. Branch and Department Restrictions

```text
User
  |-- roleIds[]
  |-- branchIds[] (one primary branch)
  `-- departmentIds[] (one primary department)
```

- One user can have multiple roles, branches, and departments.
- Roles themselves contain neither branch nor department IDs.
- Permissions answer **what** the user may do; branch/department scope answers **where and to which records** they may do it.
- Branch scope is enforced broadly in domain services/repositories and is revalidated by the backend rather than trusting frontend filters.
- Department scope is explicitly implemented for Admissions, Surgery, and Emergency. It is not a universal row-level restriction across all domains.
- Staff creation/update requires branch and department assignments, except patient-portal provisioning. Role-to-department compatibility is checked by configured name/code heuristics.
- The current service does not ensure every selected department belongs to a selected branch. User create limits branch assignment to the actor's authority, but user update currently omits the equivalent delegation check.

Example: a Doctor with branch A and department Cardiology may have the capability to edit an OPD consultation. The permission allows the operation and branch A limits the record set. Whether Cardiology further limits the rows depends on that domain's explicit department-scope implementation; the role alone does not impose it.

## 11. Route Protection

### Staff application

Public routes are `/login`, `/forgot-password`, and `/reset-password`. All other routes render inside `ProtectedRoute`, which redirects unauthenticated/session-expired users to login with a return URL.

Known staff routes are checked by `canAccessRoute` against `routeRequirements`. The default action is `View`; some routes require `Create`, and composite routes can require several tuples. `SUPER_ADMIN` bypasses this frontend route map. Unauthorized direct navigation renders an Access Denied panel and does not mount the intended page.

Concrete examples:

| Attempt | Frontend result | Backend result if called directly |
|---|---|---|
| Doctor -> `/billing` | Billing navigation is hidden; direct URL shows Access Denied | Billing API returns 403 for the missing Billing permission |
| Receptionist -> `/administration/roles` | Administration item is hidden; direct URL shows Access Denied | Roles API returns 403 |
| Pharmacy User -> `/patients` | Patients navigation is hidden; direct URL shows Access Denied | Patient APIs return 403 |
| Unauthenticated user -> protected staff route | Redirect to login with return URL | API returns an authentication error |

Notable composite rules:

- Roles & Permissions requires both `Administration/Roles/View` and `Administration/Permissions/View`.
- Doctor Schedule requires Doctor Directory View, Doctor Availability View, and Appointment Records View.
- Referral Booking requires Appointment Booking View and OPD Referral View.
- `/surgery` requires Recommendations View, Bookings View, and Schedule View.

### Patient application

`/`, `/login`, and `/signup` are public. `/portal` requires an authenticated account with a patient link or an active Patient/Guardian role. Individual portal API operations then validate ownership/dependent access in the service.

### UI permission-control behavior

The dominant implementation pattern is:

```text
Page -> feature hook capability -> domain hook (enabled flag) -> API
```

Examples:

- Billing pages consume `useBillingCapabilities` for Create/Edit/Cancel/CollectPayment.
- OPD workspace exposes separate flags for consultation, prescription, clinical orders, referral, follow-up, appointment booking, and vitals.
- Pharmacy, Laboratory, Imaging, Emergency, Admissions, Surgery, Settings, Users, Patients, Branches, Departments, and Services use similar feature-hook flags.
- Sidebar modules are filtered by accessible routes.
- Dashboard tabs are built from View permissions; Doctor gets `My Clinical Day`, and custom roles get a safe permission-derived workspace fallback.

Buttons are generally hidden or disabled when the feature capability is absent, and queries are often gated with `enabled`. These checks are usability controls only; the API repeats authorization.

## 12. Backend Authorization

Most staff endpoints declare `requirePermission(services, module, screen, action)`. That middleware:

1. authenticates the bearer token;
2. loads the user from the database;
3. resolves the required active permission tuple;
4. checks active user roles, including `SUPER_ADMIN`;
5. audits denial as `auth.permission.denied`;
6. returns HTTP 403 `PERMISSION_REQUIRED` when denied.

Dynamic operations still enforce backend RBAC:

- Lab and Imaging status endpoints authenticate first, then require Edit or VerifyResult/VerifyReport according to the requested target status.
- Emergency disposition authenticates first, then maps the decision to Discharge, Transfer, ConvertToIP, or MarkLeft.
- Consent upload/replace/delete applies the generic Patient Documents permission and an additional consent-specific Attach/Delete check when the document is a consent.

After capability authorization, domain services apply branch scope broadly. Department scope is explicitly applied in Admissions, Surgery, and Emergency. Other major domains primarily scope by branch; department assignment is not a universal row-level filter.

### How the editable permission matrix is built

The actual matrix is not a hardcoded role table. It is a live projection:

```text
selected Role.permissionIds
  x all non-deleted Permission records
  grouped by Permission.module and Permission.screen
  columns generated from all action names
```

Checked means the permission ID is present in the selected role's current assignment. For `SUPER_ADMIN`, the API returns every active permission even though editing is disabled. Unchecked means it is absent. Empty cells mean no permission record exists for that module/screen/action combination. Inactive permissions are displayed as unavailable and are never submitted.

## 13. User Journey Examples

### System Administrator

```text
Login -> active SUPER_ADMIN loaded -> all active permissions expanded
-> executive dashboard -> every sidebar module visible
-> Roles & Permissions available -> may create/clone custom roles and assign permissions
-> every backend permission check passes -> branch/clinical business validation still applies
```

### Doctor

```text
Login -> DOCTOR permissions loaded -> My Clinical Day
-> Patients, Doctors, permitted Appointment pages, OPD, Emergency, Inpatient, Surgery visible
-> Billing and Administration direct URLs show Access Denied
-> open OPD consultation -> OPD Consultation View/Edit checked
-> diagnosis is saved as consultation assessment -> backend repeats Edit check and branch scope
```

### Receptionist

```text
Login -> Receptionist permission union -> Appointment dashboard
-> patient registration, appointment booking/queue, OPD queue/referral,
   admission requests/bed holds, surgery booking, and emergency registration are visible
-> consultation, clinical orders, billing, pharmacy, lab, imaging, and administration are absent
-> each create/validate/confirm action is checked again by its API
```

### Billing User

```text
Login -> Billing Authorized permissions -> Billing dashboard
-> Billing Workspace/History, Patients read, OPD queue read, Reports, Service Catalogue read
-> create/edit/cancel invoice, collect payment, view receipt available
-> clinical mutation and Administration management routes denied
-> invoice API rechecks Billing action and limits records to authorized branches
```

### Pharmacy User

```text
Login -> PHARMACY_USER permissions loaded -> Pharmacy Queue/Inventory dashboard
-> read prescriptions needed for dispensing -> select eligible item
-> Dispense permission authorizes dispensing; Cancel/Reverse authorize later corrections
-> inventory actions separately control batch registration, movements, adjustment, and low-stock setup
-> backend rechecks the exact Pharmacy permission and branch scope
-> unrelated patient, clinical, billing, and administration pages remain denied
```

### Laboratory User

```text
Login -> LABORATORY_USER permissions loaded -> Laboratory Work Queue
-> View/Edit order -> EnterResult records the result
-> VerifyResult is a separate permission and controls clinical verification
-> backend maps requested status/action to the required permission and applies scope
-> Imaging, Pharmacy, Billing, and general clinical workspaces remain denied
```

### Imaging User

```text
Login -> IMAGING_USER permissions loaded -> Imaging Work Queue
-> View/Edit order -> EnterReport records the report
-> VerifyReport is a separate permission and controls verification
-> backend performs the permission and scope checks independently of the visible buttons
-> Laboratory, Pharmacy, Billing, and general clinical workspaces remain denied
```

### Department-specific user

```text
Login -> department role permissions + assigned branches/departments
-> Pharmacy/Lab/Imaging/Nursing navigation derived from role permissions
-> backend permission check prevents cross-module actions
-> branch filter applies broadly
-> department row filtering applies only in domains that explicitly resolve department scope
```

## 14. Role vs Module Permission Matrix

This is the requested consolidated view. **Full** means the broad seeded workflow, **Partial** means only the screens/actions described in sections 8 and 9, and **No** means no seeded staff permission. Patient and Guardian use a separate ownership-based portal.

| Role | Dashboard | Patients | Appointments | OPD | Emergency | Admissions | Surgery | Pharmacy | Lab | Imaging | Billing | Reports | Administration |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Super Administrator | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full |
| Administrator | Partial | Partial | No | No | Full | Full | Full | No | No | No | No | No | Full |
| Doctor | Partial | Full | Partial | Full | Partial | Partial | Full | No | No | No | No | No | No |
| Receptionist | Partial | Full | Full | Partial | Partial | Full | Partial | No | No | No | No | No | No |
| Clinician / Nurse | Partial | Partial | Partial | Partial | Partial | Partial | No | No | No | No | No | No | No |
| Pharmacy User | Partial | No | No | Support only | No | No | No | Full | No | No | No | No | No |
| Laboratory User | Partial | No | No | No | No | No | No | No | Full | No | No | No | No |
| Imaging User | Partial | No | No | No | No | No | No | No | No | Full | No | No | No |
| Billing Authorized | Partial | Partial | No | Partial | No | No | No | No | No | No | Full | Full | Partial |
| Patient / Guardian | Portal | Portal | Portal | No | No | No | No | No | No | No | Portal | No | No |
| Custom role | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived | Permission-derived |

## 15. Current Behavior

The current application uses live database roles and permissions, multi-role permission union, frontend navigation/route/action gates, and independent backend enforcement. Branch scope is widespread; department scope is selective. The role-administration screen currently behaves as follows:

- **Search roles:** server-side substring search across code, name, and description; resets to page 1.
- **Role type/status filters:** server-side `system/custom` and `active/inactive`; reset to page 1.
- **Pagination:** five roles per page; first role on the current result page is auto-selected.
- **Permission search:** client-side filter by module or screen only; does not filter action names/codes.
- **Select All:** selects every active permission in the full loaded catalogue, not just visible/search-filtered rows.
- **Clear All:** clears every draft permission, not just visible rows.
- **Save:** replaces the role's full permission ID array; filters out inactive IDs; refreshes the saving user's `/auth/me`; backend blocks escalation and `SUPER_ADMIN` edits.
- **Export:** downloads client-generated JSON for the selected role and current draft (including unsaved changes). It is not a backend export and has no dedicated Export permission.
- **Refresh:** refetches role list/stats, permission catalogue, selected role, and selected role permissions. It does not warn about or preserve unsaved permission changes.
- **Clone:** creates a custom role named `<source> Copy`, then makes a second API call to copy permissions. Users are not copied.
- **Audit History:** fetches the latest 20 audit records whose metadata contains the role ID. Assignment timestamps shown in role detail are approximate because there is no assignment junction/history model.
- **Delete:** shown only for custom roles with Roles/Delete; backend additionally requires inactive status and zero assigned users.
- **Activate/deactivate:** UI exposes it only for custom roles; backend would permit non-super system roles.
- **Assign/remove user:** adds/removes the role ID in `User.roleIds`; multiple-role assignment is supported. Assignment of inactive roles/users and authority escalation are rejected.
- **Statistics:** role counts come from four list calls. Total Permissions is `permissions.length` for all non-deleted permissions returned, including inactive/custom permissions; it is not strictly the active permission count.
- **State:** role search/filter/page and permission search are local React state, not URL query state.

## 16. Expected Behavior

Under the repository's stated HMS rules, expected behavior is:

- Backend database state remains the only authorization authority.
- Every protected action has an exact backend permission and branch/department scope check.
- Frontend route, query, and button gates mirror the complete set of permissions required by their APIs.
- Inactive/deleted roles and permissions cease granting access immediately.
- System-role lifecycle rules are identical in UI and API.
- Permission updates cannot silently overwrite a concurrent administrator's changes.
- Composite workspaces declare all dependencies without making a page unusable for a legitimately granular custom role.
- User branch and department assignments are mutually consistent and all user-management reads/writes are scoped to the actor's authority.
- Patient/guardian portal access remains ownership-based and isolated from staff RBAC.

## 17. Gaps / Inconsistencies

### High priority

| Current behavior | Expected behavior | Gap / risk |
|---|---|---|
| `UserService.list`, summary, and detail are not actor-branch scoped; routes check only Users/View. | A branch-scoped administrator should see only users within authorized branches unless explicitly global. | A non-super custom/branch administrator with Users/View can enumerate global users. |
| User update validates referenced branches but does not call `assertCanAssignBranches`; create does. | Create and update must enforce the same branch-delegation boundary. | A permitted updater can move/expand a user to a branch outside the updater's scope. |
| Department IDs are active-checked but not verified to belong to one of the selected branch IDs. | Every department assignment should belong to an assigned branch. | Inconsistent branch/department combinations can be persisted. |
| Department scoping is explicit in Admissions, Surgery, and Emergency, but many other clinical/operational domains use branch-only scope. | Department-restricted users should have consistent row-level department isolation where clinically required. | A department assignment does not universally restrict same-branch data. Exact intended scope for each domain is not determined from current code/FSD. |

### Medium priority

| Current behavior | Expected behavior | Gap / risk |
|---|---|---|
| `/pharmacy/orders` is an implemented AppRouter alias but is absent from `routeRequirements` and sidebar matching. | Every implemented alias should be permission-controlled. | Any authenticated staff user can directly mount the Prescription Queue page at that alias; backend API calls still return 403, so data/action access remains blocked. |
| Patient Documents and Consent routes require only their screen View permission, while their pages also fetch patient list/detail requiring Patient Records/View. Administrator has document/consent grants but lacks Patient Records/View. | Composite route requirements and query gates should include supporting API permissions. | Page can be visible but fail its patient lookups with backend 403. |
| Assign User is enabled by Roles/Assign, but its modal fetches `/users`, which needs Users/View. | Composite action should require both permissions or use a purpose-built scoped lookup. | A granular custom role can see the action but cannot load candidates. |
| `/surgery` requires all three View permissions. Backend APIs allow each screen independently. | Granular custom roles should reach the screen(s) they can view. | Frontend can deny a role that the backend authorizes for only Recommendations, Bookings, or Schedule. |
| Roles & Permissions route requires both Roles/View and Permissions/View. | Page should either intentionally require both everywhere or split the workspaces. | A user authorized for only one backend resource cannot use its UI. |
| UI blocks Edit/status for all system roles; backend blocks only code/type changes, deletion, and protected Super Admin status. | UI and backend lifecycle contract should match. | API can perform operations the UI says are impossible. |
| Permission save is a full unversioned replacement. | Concurrent edits should detect stale versions or merge deliberately. | Last writer wins and can silently erase another administrator's changes. |
| Clone is two independent API calls. | Clone should be atomic or cleanly recoverable. | Permission-copy failure leaves an empty custom role behind. |
| Refresh overwrites the draft from refetched role permissions without a dirty confirmation. | Unsaved administrative changes should be protected. | An administrator can lose a draft silently. |
| Other users' frontend access context refreshes on focus/visibility/60 seconds, while backend changes are immediate. | UI should promptly reflect revoked/granted access. | Temporary stale navigation/buttons; backend remains safe. |

### Low priority / consistency

- `usePatientHistoryFeature` uses role names/codes instead of the permission utility and checks `NURSE`, while the seeded code is `CLINICIAN_NURSE`. Custom permission-based roles may get inconsistent UI behavior.
- System-role seed reconciliation reports changed permission sets but uses `$setOnInsert` for `permissionIds`, so existing non-super system roles are not actually reset to the code-defined baseline on reseed. Runtime database permissions can intentionally or accidentally drift from the seed.
- `RoleRepository` sorts `userCount` only after paginating, so user-count ordering is page-local rather than globally correct.
- Role assignment display uses `User.updatedAt/updatedBy` as an approximation, so it cannot prove who assigned a particular role or when. The audit log is the more reliable event source.
- Roles & Permissions has no focused component/service test suite for role lifecycle, matrix concurrency, clone failure, or system-role UI/API contract. Existing permission tests focus mainly on expansion performance and general authority checks.
- Permission category/group schemas have no persisted status even though service-level helper results model them as always active. They cannot currently be deactivated.
- Permission semantic uniqueness `(module, screen, action)` is service-checked but lacks a compound unique database index; concurrent creation could race. Permission code does have a unique index.

No confirmed staff API was found that accepts an unauthorized protected business action merely because the UI button is hidden. The principal security authority remains the backend. The confirmed frontend gaps primarily cause a page to mount then receive 403, or cause the UI to deny an operation that its API would allow.

## 18. Recommendations

1. Scope user list/summary/detail and user updates by the actor's branch authority; add tests for cross-branch reads and updates.
2. Validate department-to-branch membership and define a domain-by-domain department isolation contract before broadening department filters.
3. Make frontend route requirements a single audited registry covering every alias, including `/pharmacy/orders`, and test all implemented routes.
4. Declare composite page dependencies explicitly (Patient Records + Documents/Consent, Roles + Permissions, Roles Assign + Users View) and gate both mounting and queries.
5. Reconcile the system-role contract: either intentionally lock all system-role metadata/status in the backend or expose only the backend-supported operations in the UI.
6. Add optimistic concurrency/versioning to role permission replacement and a dirty-draft confirmation before refresh/role change.
7. Make clone a backend atomic operation or delete/mark the new role failed if permission copy cannot complete.
8. Replace remaining role-name shortcuts with `hasPermission`; reserve role-code checks for identity-specific behavior such as self-doctor views and `SUPER_ADMIN`.
9. Fix system-role seed reconciliation so reported changes are actually applied, or explicitly document that seed permissions are insert defaults and runtime edits are authoritative.
10. Add focused integration tests for system/custom lifecycle restrictions, permission replacement escalation, stale concurrent saves, inactive role/permission revocation, multi-role union, and UI/API parity.

### Source and verification notes

Primary files traced:

- `apps/api/src/database/seed.ts`
- `apps/api/src/modules/{auth,users,roles,permissions}/*`
- `apps/api/src/middleware/{authenticate,require-permission}.ts`
- all staff domain `*.routes.ts` files and representative domain scope repositories/services
- `apps/web/src/auth/{AuthContext,access-control}.tsx/ts`
- `apps/web/src/routing/{AppRouter,ProtectedRoute}.tsx`
- `apps/web/src/data/ui-foundation.ts`
- `apps/web/src/pages/{DashboardShell,RolesPermissionsPage}.tsx`
- `apps/web/src/hooks/admin/useRolesPermissionsFeature.ts`
- representative module feature hooks for Users, Patients, Doctors, OPD, Admissions, Emergency, Surgery, Pharmacy, Lab, Imaging, Billing, Reports, and Settings
- `apps/patient-web/src/auth/AuthContext.tsx`
- `apps/patient-web/src/routing/{AppRouter,ProtectedRoute}.tsx`
- `apps/api/src/modules/patient-portal/*`

Focused verification executed during this analysis:

- `npx vitest run apps/web/src/auth/access-control.test.ts apps/web/src/routing/AppRouter.test.tsx` — 2 files, 9 tests passed.
- `npx vitest run apps/api/src/modules/users/user-authorization.test.ts apps/api/src/modules/permissions/permission-expansion.test.ts` — 2 files, 10 tests passed.
- `git diff --check` completed without an analysis-document whitespace error. Existing uncommitted changes in `apps/web/src/domains/admin.css` and `apps/web/src/pages/RolesPermissionsPage.tsx` were treated as user-owned and were not modified or reverted.
