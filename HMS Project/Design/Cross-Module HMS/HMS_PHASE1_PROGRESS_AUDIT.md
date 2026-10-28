# HMS Phase 1 Progress Audit

## Scope Source

**Document:** `HMS_Phase_1_OPD_Understanding_for_Developer 1.docx`

**Audit Date:** 11 August 2026

**Repository reviewed:** `HMS` monorepo (`apps/api`, `apps/web`, `Scope`, and root documentation)

---

## Scope Reconciliation

The latest document is the controlling Phase 1 source. It limits Phase 1 to the connected outpatient (OPD) journey and says that broader documents may clarify approved OPD behavior but must not expand scope.

The two copies of `HMS_Release_1_Scope_Document_v2.docx` are byte-identical (SHA-256 `0CE317F059492E4319254766957A26B722F1684A6CAE7E2DAD95958155C8DD99`). That older scope includes Emergency, IPD, admission, ward/bed, corporate billing, inventory, and other capabilities that the new document does not approve for Phase 1. They are therefore excluded from completion scoring unless the new OPD document explicitly retains the capability.

Current navigation still exposes Emergency, Admissions, Inventory, and broad Reports groups inherited from the older scope. Those links lead to generic coming-soon screens. Their presence is not counted as implementation and should not be interpreted as Phase 1 approval.

Explicit Phase 1 exclusions from the latest document include IP beds/surgery, a full insurance-claim lifecycle, automated M-Pesa/payment-gateway integration, and any workflow not listed in the approved OPD understanding.

## Audit Method

- A feature is a distinct, testable capability listed in the feature inventory and final matrix below.
- `COMPLETE` requires a concrete implementation for the required system behavior. A label, route stub, static array, mock state, or coming-soon page does not qualify.
- `PARTIAL` means useful implementation exists but at least one required layer, integration, rule, or workflow is missing.
- `NOT STARTED` means no corresponding model, service, API, and usable page were found.
- `REQUIRES CLARIFICATION` is used where the latest source deliberately leaves configuration or status detail open. Such items are included in the Not Started count until clarified and implemented.
- Overall progress uses weighted completion: `COMPLETE = 1`, `PARTIAL = 0.5`, `NOT STARTED/REQUIRES CLARIFICATION = 0`.

Evidence inspected includes `apps/api/src/modules/index.ts`, all backend model/route/service/repository files, `apps/web/src/routing/AppRouter.tsx`, `apps/web/src/data/ui-foundation.ts`, frontend API clients, authentication context/storage, and all explicitly implemented pages.

---

# Executive Summary

- **Total Features:** 86
- **Completed Features:** 8
- **Partially Completed Features:** 24
- **Not Started Features:** 54 (including 2 tagged `REQUIRES CLARIFICATION`)
- **Strict Fully Complete:** 9% (`8 / 86`)
- **Overall Completion:** **23%** weighted (`(8 + 24 x 0.5) / 86`)

The application currently provides a functional administration foundation and authentication stack. It does not yet implement the connected OPD workflow that defines the new Phase 1 boundary. There are no backend OPD-domain modules/models/APIs and no implemented frontend patient, appointment, vitals, consultation, pharmacy, laboratory, imaging, billing, or referral pages.

---

# Completed Features

| Module | Scope Requirement | Current Implementation | Status |
|---|---|---|---|
| Authentication | Authenticated login, logout, current-user lookup, refresh-token rotation, and browser-session restoration | Backend login/refresh/logout/me services and routes exist. Frontend `AuthContext`, `apiClient`, and session token storage implement login, refresh retry, restoration, expiry handling, and logout. | COMPLETE |
| Users | Maintain user accounts with create, read, update, delete, search, and pagination | Backend user CRUD/list/search/pagination routes and services exist. `UserManagementPage.tsx` calls the real users API for these operations. | COMPLETE |
| Branches | Maintain branch records | Backend branch CRUD and a real API-backed `BranchManagementPage.tsx` are implemented. | COMPLETE |
| Branches | Search, filter, and paginate branches | Query schemas, repository filtering/pagination, frontend search/status filters, and pagination are implemented. | COMPLETE |
| Departments | Maintain department records linked to a branch | Backend department CRUD and real API-backed `DepartmentManagementPage.tsx` are implemented. | COMPLETE |
| Departments | Search, filter, and paginate departments | Backend branch/status/search filters and pagination are used by the frontend page. | COMPLETE |
| Services | Maintain a generic service catalogue with department, price, duration, category, and status | Backend service CRUD/search/pagination and real API-backed `ServiceCataloguePage.tsx` are implemented. This completed item covers only the generic catalogue, not specialized OPD masters. | COMPLETE |
| Navigation | SPA navigation shell, protected layout, history updates, active route matching, and not-found handling | Custom client-side navigation, protected routes, sidebar groups, dashboard layout, and explicit route matching are implemented. | COMPLETE |

---

# Partially Completed Features

| Module | Scope Requirement | Existing Work | Missing Work | Status |
|---|---|---|---|---|
| Authentication & Security | Configurable password policy, session timeout, and account lockout | Password-policy settings, access/refresh TTLs, failed-login logic, and lockout settings exist. | `User` schema does not define failed-attempt, lockout, password-change, or last-login fields used by repositories. Session behavior is token-TTL based rather than a confirmed inactivity timeout. | PARTIAL |
| Authentication & Security | Screen/action RBAC | Permission middleware protects current administration APIs by module/screen/action. | Frontend navigation is not permission-filtered; OPD screens/actions do not exist; branch-level access is not enforced. | PARTIAL |
| Authentication & Security | Audit sensitive edits, denied access, and permission changes | `AuditLogModel` and event writes exist across auth/admin services. | No audit API/UI, no reliable before/after value capture, and no complete patient/clinical/billing audit coverage. | PARTIAL |
| Authentication & Security | Admin configures which users can bill | Generic role/permission structures can represent assignments. | No Billing permission set, billing API, billing page, or end-to-end proof that billing is assigned independently of job title. | PARTIAL |
| Users | Activate, deactivate, lock, and unlock users | Status routes/UI actions exist. | Lock fields used by auth are absent from the declared user schema; persistence and complete lockout behavior require alignment. | PARTIAL |
| Users | Change/reset user passwords | Backend change/reset routes and frontend dialogs exist. | Self-service reset request creates a token but has no delivery mechanism; `AuthSupportPage` is not connected to a complete reset journey. | PARTIAL |
| Users | Assign users to branches with a primary assignment | User records store branch ObjectIds and the API accepts assignments. | Primary status is not stored; the repository infers the first item as primary. The UI requires manually entered IDs/names instead of authoritative selection. | PARTIAL |
| Users | Assign users to departments with a primary assignment | User records store department ObjectIds and the API accepts assignments. | Primary status is not stored, assignments are not validated against an active branch/department context, and the UI uses manual IDs. | PARTIAL |
| Users | Assign roles to users | Backend role-user assign/remove routes exist. | User create/edit does not accept roles and the frontend Roles page uses mock state, so assignment is not usable end to end. | PARTIAL |
| Roles & Permissions | Create, read, update, deactivate, and delete roles | Backend role lifecycle routes/services/repository are implemented. | `RolesPermissionsPage.tsx` uses `roles-permissions-mock.ts`; it does not call backend role APIs. | PARTIAL |
| Roles & Permissions | Maintain permission definitions | Backend permission CRUD is implemented. | No frontend permission API client or real permission-management screen is implemented. | PARTIAL |
| Roles & Permissions | Group permissions by category/module/screen/action | MongoDB category/group/permission models and API grouping metadata exist. | Frontend renders a separate hard-coded permission matrix unrelated to persisted permission definitions. | PARTIAL |
| Roles & Permissions | Assign/revoke permissions on roles | Backend GET/PUT role-permission endpoints exist. | Frontend saves only local component state and explicitly displays mock-save messages. | PARTIAL |
| Roles & Permissions | Assign/remove users on roles | Backend POST/DELETE assignment endpoints exist. | Frontend changes only a mock numeric user count and does not persist assignments. | PARTIAL |
| Roles & Permissions | Enforce authorized administration and future OPD actions | Current admin APIs use permission middleware. | No OPD permissions or routes exist; frontend visibility is not driven by the authenticated user's permission set. | PARTIAL |
| Branches | Use branch as an operational OPD context | Branch records and user branch IDs exist. | No doctor schedule, appointment, patient/visit, billing, or downstream order is branch-scoped; header branch selector is mock data. | PARTIAL |
| Departments | Use departments in OPD routing and downstream work queues | Department records and service department links exist. | No doctor, patient visit, pharmacy, lab, imaging, or billing workflow consumes department context. | PARTIAL |
| Services & Masters | Configure OPD service pricing | `Service` stores `standardPrice` and status. | No effective-date/history rules, historical invoice price preservation, payer pricing, or billing integration. | PARTIAL |
| Services & Masters | Maintain laboratory test master | Generic services can be categorized and linked to a department. | No lab-specific sample type, result schema, range, report template, or lab-order linkage. | PARTIAL |
| Services & Masters | Maintain scan/imaging service master | Generic services can be categorized and linked to a department. | No modality/procedure details, imaging request/report behavior, or patient/visit linkage. | PARTIAL |
| Services & Masters | Restrict master/configuration changes to authorized users | Generic service, branch, and department APIs use permission checks. | Specialized medicine/lab/imaging masters and their permissions do not exist; frontend route visibility is not permission-driven. | PARTIAL |
| Navigation | Show only approved, role-permitted Phase 1 areas | Sidebar configuration exists and active state is computed. | It is not filtered by permissions and still exposes Emergency, Admissions, Inventory, and broad Reports from the superseded scope. | PARTIAL |
| Navigation | Provide usable routes for approved OPD modules | Patient, Doctors, Appointments, OPD, Pharmacy, Laboratory, Imaging, and Billing links are listed. | All such links resolve to `ComingSoonPage`; several approved flows (Vitals and Referral) lack dedicated navigation entries. | PARTIAL |
| Dashboard | Provide an OPD operational dashboard | A styled dashboard shell, cards, chart components, and links exist. | Values, patients, activities, alerts, and chart series are hard-coded. Chart.js is neither a package dependency nor loaded by `index.html`, and there is no dashboard API. | PARTIAL |

---

# Not Started Features

| Module | Scope Requirement | Dependencies | Estimated Complexity | Status |
|---|---|---|---|---|
| Authentication & Security | Enforce branch-level data access and log cross-branch denial | User branch assignments, request context, repository filters, audit events | High | NOT STARTED |
| Services & Masters | Medicine/tablet master and availability/inventory data controlled by Admin | Medicine model, units, stock/availability rules, pharmacy workflow | High | NOT STARTED |
| Dashboard | Live OPD volumes, operational indicators, queues, and financial statistics | Patient, visit, appointment, order, and billing transactions | High | NOT STARTED |
| Dashboard | Role/permission/branch-aware dashboard data and filters | RBAC projection, branch context, dashboard aggregation API | High | NOT STARTED |
| Patient / EMR | Reusable patient registration/profile with MRN/system identifier | Patient model, identifier strategy, validation, permissions | High | NOT STARTED |
| Patient / EMR | Existing-patient search and duplicate prevention | Patient search indexes, matching rules, duplicate-review UX | High | NOT STARTED |
| Patient / EMR | Patient history across OPD visits | Patient and visit models, timeline queries | High | NOT STARTED |
| Patient / EMR | Chronological EMR timeline | Unified event model or aggregation across clinical modules | High | NOT STARTED |
| Patient / EMR | Patient documents/attachments linked to patient or visit | File storage, metadata model, upload/download authorization | High | NOT STARTED |
| Patient / EMR | Single patient/visit context shared by doctor, pharmacy, lab, imaging, and billing | Patient/visit identifiers and cross-module references | High | NOT STARTED |
| Reception / Appointments | New and existing patient front-desk workflow | Patient registration/search, reception permissions | High | NOT STARTED |
| Reception / Appointments | Doctor/practitioner master and OPD setup | Doctor model, specialty, branch/department mapping | Medium | NOT STARTED |
| Reception / Appointments | Doctor schedules, slots, leave, breaks, conflicts, and usable availability | Doctor master, schedule engine, timezone/branch rules | High | NOT STARTED |
| Reception / Appointments | Book OPD appointment/visit against patient and doctor | Patient, doctor availability, visit/appointment model | High | NOT STARTED |
| Reception / Appointments | Reschedule while retaining patient/visit context | Appointment lifecycle, conflict validation, audit | High | NOT STARTED |
| Reception / Appointments | Book a referred follow-up appointment | Referral, availability, appointment linkage | High | NOT STARTED |
| Reception / Appointments | Manual payer/insurance details and permission-based payment visibility | Patient/visit payer fields, billing permissions | Medium | NOT STARTED |
| Vitals | Capture weight, height, and blood pressure for an active OPD visit | Visit model, clinician/nurse permissions, vitals model | Medium | NOT STARTED |
| Vitals | Configure optional temperature, pulse, respiratory rate, and oxygen saturation fields | Agreed screen configuration and clinical field rules | Medium | REQUIRES CLARIFICATION |
| Vitals | Make saved visit vitals visible to Doctor and hand off the patient | Visit queue/state model, doctor workspace | High | NOT STARTED |
| Doctor Consultation | Open current patient/visit with history, EMR, and vitals | Patient, visit, EMR timeline, vitals | High | NOT STARTED |
| Doctor Consultation | Record OPD consultation clinical outcome | Consultation model, agreed clinical fields/templates | High | NOT STARTED |
| Doctor Consultation | Create e-prescription linked to patient/visit | Medicine master, prescription model, permissions | High | NOT STARTED |
| Doctor Consultation | Create laboratory order(s) linked to patient/visit | Lab test master, order model, lab queue | High | NOT STARTED |
| Doctor Consultation | Create scan/imaging order(s) linked to patient/visit | Imaging master, order model, imaging queue | High | NOT STARTED |
| Doctor Consultation | Create internal/external referral and follow-up need | Referral model, doctor/service master, appointment linkage | High | NOT STARTED |
| Doctor Consultation | Publish consultation outputs to EMR/timeline | Timeline/event integration across outputs | High | NOT STARTED |
| Pharmacy | Receive e-prescriptions in a pharmacy queue | Prescription model/statuses, pharmacy permissions | High | NOT STARTED |
| Pharmacy | View prescription and dispensing details | Prescription API and workspace | Medium | NOT STARTED |
| Pharmacy | Check medicine availability | Medicine/inventory model and stock query | High | NOT STARTED |
| Pharmacy | Dispense or mark unavailable with workflow status | Dispensing transaction, status rules, audit | High | NOT STARTED |
| Pharmacy | Link dispensed medicines to patient/visit and applicable billing item | Patient/visit, prescription, inventory, billing integration | High | NOT STARTED |
| Laboratory | Receive doctor-generated lab requests in a work queue | Lab master/order model and permissions | High | NOT STARTED |
| Laboratory | Process requested tests and track request status | Lab workflow/status model | High | NOT STARTED |
| Laboratory | Enter result/report | Result model, clinical validation, report format | High | NOT STARTED |
| Laboratory | Publish/attach report to the same patient/visit | Documents/storage and EMR timeline integration | High | NOT STARTED |
| Laboratory | Make results available to Doctor/authorized users | Authorization, patient/visit query, doctor workspace | Medium | NOT STARTED |
| Imaging | Receive doctor-generated imaging requests in a work queue | Imaging master/order model and permissions | High | NOT STARTED |
| Imaging | Process/update imaging request status | Imaging workflow/status model | Medium | NOT STARTED |
| Imaging | Upload report/image/document to patient/visit | File storage, imaging result metadata, authorization | High | NOT STARTED |
| Imaging | Make diagnostic information available to Doctor/authorized users | Patient/visit/EMR integration and doctor workspace | Medium | NOT STARTED |
| Billing & Payment | Create OPD bill/invoice from applicable services | Visit/services, pricing, invoice models, permissions | High | NOT STARTED |
| Billing & Payment | Capture payment and authorized payment-status visibility | Payment model, modes, receipt/status rules | High | NOT STARTED |
| Billing & Payment | Link billing/payment to patient, OPD visit, and services | Patient/visit/invoice relationships | High | NOT STARTED |
| Billing & Payment | Basic/manual payer or insurance handling without claims automation | Payer fields, manual workflow, authorization | Medium | NOT STARTED |
| Billing & Payment | Permission-driven billing with no fixed Reception/Cashier ownership | Billing screens/APIs and seeded action permissions | Medium | NOT STARTED |
| Billing & Payment | Finalize exact billing/payment state set beyond pending, billed, and payment updated | BA/UI confirmation and transaction lifecycle design | Medium | REQUIRES CLARIFICATION |
| Referral | Create referral from Doctor with reason and destination | Referral model/API and doctor workflow | High | NOT STARTED |
| Referral | Check availability and create a referred appointment | Doctor availability and appointment linkage | High | NOT STARTED |
| Referral | Track referral and expose it in patient history/timeline | Referral statuses and EMR integration | Medium | NOT STARTED |
| Cross-Workflow | Maintain one active OPD visit across Reception, Nurse, Doctor, Pharmacy/Lab/Imaging, and Billing | Visit aggregate/state machine and shared identifiers | High | NOT STARTED |
| Cross-Workflow | Route each doctor order to the correct downstream queue | Order dispatch and department work queues | High | NOT STARTED |
| Cross-Workflow | Return downstream results/statuses to the originating patient/visit | Cross-module references and EMR event updates | High | NOT STARTED |
| Cross-Workflow | Enforce minimum OPD state rules and exception handling without adding non-approved workflows | State transition rules, audit, validation, agreed statuses | High | NOT STARTED |

---

# Backend Status

## Authentication

**Status:** Partial

**Notes:** Login, access tokens, refresh rotation, logout, current user, password change/reset endpoints, password-policy checks, and permission middleware exist. Schema alignment for failed-login/lockout metadata, reset-token delivery, branch-level authorization, complete audit details, and OPD/billing permission coverage remain incomplete.

## Users

**Status:** Partial

**Notes:** User CRUD, search, pagination, status, passwords, and branch/department ID storage exist. Primary assignments are inferred rather than persisted, role assignment is not part of user create/edit, and branch/department references are not fully validated or enforced as access boundaries.

## Roles & Permissions

**Status:** Partial

**Notes:** Backend role/permission CRUD, grouping, role-permission replacement, role-user assignment, and route middleware exist. The frontend is entirely mock-backed and OPD/billing permissions are absent.

## Branches

**Status:** Partial

**Notes:** Administrative CRUD/search/pagination are implemented. Branches are not yet operationally linked to doctors, schedules, patients/visits, work queues, billing, or repository-level data isolation.

## Departments

**Status:** Partial

**Notes:** Administrative CRUD/search/pagination and service linkage are implemented. Departments do not yet drive OPD routing, practitioner assignment, or downstream work queues.

## Services

**Status:** Partial

**Notes:** A generic priced service catalogue is implemented. It is insufficient for medicine, lab-test, and imaging masters and is not connected to appointments, orders, invoices, or historical pricing.

## OPD

**Status:** Not Started

**Notes:** No patient, visit, appointment, doctor availability, vitals, consultation, prescription, lab order/result, imaging order/result, referral, billing, payment, document, or EMR backend module is registered.

---

# Frontend Status

## Dashboard

**Status:** Partial

**Notes:** The dashboard layout and visual components exist, but all business values and records are hard-coded. No dashboard API is called. Chart components expect a global `window.Chart`, while Chart.js is absent from dependencies and `index.html`.

## Administration

**Status:** Partial

**Notes:** Users, branches, departments, and services have API-backed pages. Roles & Permissions is mock-backed. Branch selection and notifications also use mock arrays. Frontend navigation is not filtered by permissions.

## OPD

**Status:** Not Started

**Notes:** Patient, Doctors, Appointments, OPD, Pharmacy, Laboratory, Imaging, and Billing links exist only as sidebar configuration and resolve to `ComingSoonPage`. There are no implemented OPD pages or corresponding frontend API clients.

---

# Database Status

MongoDB is the current persistence implementation. Collection names below are inferred from registered Mongoose models.

| Name | Status | Used By |
|---|---|---|
| `users` | Partial | Authentication, user administration, role membership, branch/department IDs; missing declared lockout/session metadata and OPD actor relationships |
| `roles` | Partial | Backend role management and permission assignment; frontend still mock-backed |
| `permissions` | Partial | Backend screen/action permission checks for current administration APIs; no OPD/billing permission catalogue |
| `permissioncategories` | Partial | Permission grouping foundation; not consumed by a real frontend management page |
| `permissiongroups` | Partial | Permission grouping foundation; not consumed by a real frontend management page |
| `branches` | Complete foundation | Branch administration; not yet connected to OPD operations or enforced data scope |
| `departments` | Complete foundation | Department administration and generic service linkage; not yet connected to OPD queues |
| `services` | Partial | Generic priced services; not specialized for lab/imaging/medicine or linked to orders/billing |
| `refreshtokens` | Partial | Authentication refresh-token rotation/revocation; revocation fields are used by repositories but not declared in the model interface/schema |
| `passwordresettokens` | Partial | Reset token storage; no delivery mechanism or complete frontend flow |
| `auditlogs` | Partial | Authentication and administration event records; no audit API/UI or complete before/after changes |

No code-backed collections/models exist for patients, visits, appointments, doctor profiles, schedules/availability, vitals, consultations, prescriptions, dispensing, medicines/stock, lab orders/results, imaging orders/results, referrals, invoices, payments, payer information, patient documents, or EMR timeline events.

---

# API Status

## Implemented or Partial APIs

| Area | Method and Path | Status | Notes |
|---|---|---|---|
| Health | `GET /api/health` | Implemented | Application health |
| Health | `GET /api/health/db` | Implemented | MongoDB connection/database status |
| Authentication | `POST /api/auth/login` | Implemented | Credential login and token pair |
| Authentication | `POST /api/auth/refresh` | Implemented | Refresh rotation |
| Authentication | `POST /api/auth/logout` | Implemented | Token revocation |
| Authentication | `GET /api/auth/me` | Implemented | Current user |
| Authentication | `POST /api/auth/change-password` | Implemented | Authenticated password change |
| Authentication | `POST /api/auth/password-reset/request` | Partial | Creates hashed reset record but does not deliver token |
| Authentication | `POST /api/auth/password-reset/confirm` | Partial | Confirmation exists; no usable token-delivery journey |
| Users | `GET /api/users` | Implemented | Search/filter/sort/pagination |
| Users | `GET /api/users/:id` | Implemented | Detail |
| Users | `POST /api/users` | Implemented | Create with branch/department assignments |
| Users | `PATCH /api/users/:id` | Implemented | Profile/assignment update |
| Users | `PATCH /api/users/:id/status` | Partial | Route exists; lockout schema fields require alignment |
| Users | `POST /api/users/:id/change-password` | Implemented | Administrator/user password change rules |
| Users | `POST /api/users/:id/reset-password` | Implemented | Administrator reset |
| Users | `DELETE /api/users/:id` | Implemented | Soft delete |
| Roles | `GET /api/roles` | Implemented | Backend list/search/pagination |
| Roles | `GET /api/roles/:id` | Implemented | Detail with assigned users |
| Roles | `POST /api/roles` | Implemented | Custom role create |
| Roles | `PATCH /api/roles/:id` | Implemented | Update |
| Roles | `PATCH /api/roles/:id/status` | Implemented | Activate/deactivate |
| Roles | `POST /api/roles/:id/users` | Implemented | Assign user |
| Roles | `DELETE /api/roles/:id/users/:userId` | Implemented | Remove user |
| Roles | `DELETE /api/roles/:id` | Implemented | Restricted soft delete |
| Permissions | `GET /api/permissions` | Implemented | Backend list/search/filter/pagination |
| Permissions | `GET /api/permissions/:id` | Implemented | Detail |
| Permissions | `GET /api/permissions/:id/roles` | Implemented | Roles using permission |
| Permissions | `POST /api/permissions` | Implemented | Custom permission create |
| Permissions | `PATCH /api/permissions/:id` | Implemented | Update |
| Permissions | `DELETE /api/permissions/:id` | Implemented | Restricted soft delete |
| Permissions | `GET /api/roles/:id/permissions` | Implemented | Role permission readback |
| Permissions | `PUT /api/roles/:id/permissions` | Implemented | Replace role permissions |
| Branches | `GET /api/branches` | Implemented | List/search/filter/pagination |
| Branches | `GET /api/branches/:id` | Implemented | Detail |
| Branches | `POST /api/branches` | Implemented | Create |
| Branches | `PATCH /api/branches/:id` | Implemented | Update |
| Branches | `DELETE /api/branches/:id` | Implemented | Hard delete; referential constraints are not enforced |
| Departments | `GET /api/departments` | Implemented | List/search/filter/pagination |
| Departments | `GET /api/departments/:id` | Implemented | Detail |
| Departments | `POST /api/departments` | Implemented | Create |
| Departments | `PATCH /api/departments/:id` | Implemented | Update |
| Departments | `DELETE /api/departments/:id` | Implemented | Hard delete; dependent-service constraints are not enforced |
| Services | `GET /api/services` | Partial | Generic catalogue only |
| Services | `GET /api/services/:id` | Partial | Generic catalogue only |
| Services | `POST /api/services` | Partial | No specialized lab/imaging/medicine fields |
| Services | `PATCH /api/services/:id` | Partial | No price-history semantics |
| Services | `DELETE /api/services/:id` | Partial | Hard delete without downstream/reference checks |

## Missing Phase 1 API Areas

| Required Capability | API Status |
|---|---|
| Patient registration/profile, search, duplicate review, and update | Missing |
| Patient history, EMR timeline, and documents/attachments | Missing |
| Doctor master and practitioner setup | Missing |
| Doctor schedules, slots, leave/unavailability, and conflict validation | Missing |
| OPD appointment booking, visit creation, queue, and rescheduling | Missing |
| Vitals capture/read for an active visit | Missing |
| Doctor OPD consultation and clinical outcome | Missing |
| E-prescription creation and pharmacy queue/dispensing/availability | Missing |
| Laboratory order queue, processing, result, report, and publish | Missing |
| Imaging order queue, processing, upload, report, and publish | Missing |
| Referral create, track, and appointment linkage | Missing |
| OPD invoice, payment, receipt/status, and manual payer data | Missing |
| Dashboard/KPI aggregations | Missing |
| Audit-log query/export | Missing |

---

# Gap Analysis

The following work remains to reach 100% of the reconciled Phase 1 scope:

1. **Define the OPD domain aggregate.** Add patient, OPD visit, visit-state, and shared identifiers that every downstream record references.
2. **Implement Patient/EMR.** Registration, MRN generation, duplicate search, returning-patient reuse, history, timeline, and document storage are all absent.
3. **Implement doctor setup and availability.** Doctor profile, branch/department assignment, schedules, slots, leave/breaks, and overlap prevention are prerequisites for Reception.
4. **Implement Reception.** New/existing patient selection, appointment/visit booking, valid-slot checks, rescheduling, referral booking, and basic payer capture are absent.
5. **Implement Vitals.** Persist visit-scoped vitals, configure the optional field set after clarification, and expose the result to Doctor.
6. **Implement Doctor consultation.** Clinical outcome, e-prescription, lab order, imaging order, referral, and EMR publication are absent.
7. **Implement downstream queues.** Pharmacy, Laboratory, and Imaging require their own models, state transitions, APIs, authorized workspaces, and links back to the originating visit.
8. **Implement specialized masters.** Medicine/tablet, lab-test, and imaging-service masters require domain fields beyond the generic service catalogue.
9. **Implement Billing and Payment.** Invoice, line item, payment, status, receipt/visibility, manual payer data, and permission-driven access are absent. Billing must remain job-title agnostic.
10. **Finish Roles & Permissions end to end.** Replace frontend mock state with backend clients and enforce permission-filtered navigation and action visibility.
11. **Enforce branch context.** Scope operational queries by the authenticated user's allowed branches and audit denied cross-branch access.
12. **Complete user assignment semantics.** Persist primary branch/department assignments, validate references, and expose real role assignment in the UI.
13. **Replace dashboard fixtures.** Add aggregation APIs and use live OPD data. Install/bundle the chart library or replace it with a supported implementation.
14. **Reconcile navigation with the new boundary.** Remove or clearly defer Emergency, Admissions, and other older-scope links; add missing Vitals and Referral access points; keep only authorized Phase 1 areas visible.
15. **Strengthen audit/compliance foundations.** Add audit query APIs, before/after sensitive changes, patient/clinical/billing events, and branch-level denial evidence.
16. **Align persistence contracts.** Add declared auth lifecycle fields, refresh-token revocation fields, referential validation, and deliberate soft-delete/retention rules.
17. **Update project documentation.** `README.md` still describes PostgreSQL and `DATABASE_URL`, which conflicts with the MongoDB implementation.
18. **Clarify open requirements.** Confirm the optional vitals field set and final billing/payment status vocabulary before those screens and state machines are finalized.

---

# Recommended Development Order

## Priority 1 - Patient, OPD Visit, and EMR Foundation

Define patient/MRN, OPD visit, shared lifecycle states, history/timeline events, and document references. All clinical and financial work depends on this identity model.

## Priority 2 - Doctor Master, Availability, and Appointment Engine

Implement doctor profiles, branch/department context, schedules, slots, leave/breaks, collision checks, Reception booking, and rescheduling.

## Priority 3 - Reception Patient Journey

Build patient search/deduplication, new/returning registration, OPD check-in/visit creation, and queue handoff.

## Priority 4 - Vitals and Doctor Consultation

Add visit-scoped vitals followed by the Doctor workspace and consultation outcome. Resolve the optional-vitals clarification during this priority.

## Priority 5 - Clinical Orders and Referral

Implement e-prescription, lab order, imaging order, and referral records with reliable links to patient and visit.

## Priority 6 - Pharmacy, Laboratory, and Imaging Work Queues

Implement downstream processing states, medicine availability/dispensing, lab results/reports, imaging reports/files, and EMR return flow.

## Priority 7 - Billing and Payment

Add invoices, service line items, payments/status, manual payer data, receipts, and permission-driven access. Finalize billing statuses before completion.

## Priority 8 - Specialized OPD Masters

Extend or separate the generic catalogue for medicines, lab tests, and imaging services. Add domain validation and authorized administration screens.

## Priority 9 - Complete Administration Integration

Connect Roles & Permissions to real APIs, implement real role assignment, persist primary branch/department assignments, and replace mock header branch data.

## Priority 10 - Security, Branch Scoping, and Audit Hardening

Enforce branch-aware repository filters, align auth schemas, implement detailed audit readback, and test all role/screen/action boundaries.

## Priority 11 - Live Dashboard and Scope-Aligned Navigation

Replace static metrics with aggregations, bundle chart support, filter by role/branch, and remove/defer navigation inherited from the superseded broader scope.

## Priority 12 - End-to-End OPD Validation and UAT Preparation

Validate the full patient journey, exception rules, unauthorized access, duplicate prevention, schedule conflicts, downstream result return, and payment linkage before UAT.

---

# Final Completion Matrix

Percentages use the audit's weighted formula: `(Complete + 0.5 x Partial) / Scope Items`. `Remaining` includes both Partial and Not Started items.

| Module | Scope Items | Completed | Remaining | % Complete |
|---|---:|---:|---:|---:|
| Authentication & Security | 6 | 1 | 5 | 50% |
| User Management | 6 | 1 | 5 | 58% |
| Roles & Permissions | 6 | 0 | 6 | 50% |
| Branches | 3 | 2 | 1 | 83% |
| Departments | 3 | 2 | 1 | 83% |
| Services & Masters | 6 | 1 | 5 | 50% |
| Navigation | 3 | 1 | 2 | 67% |
| Dashboard | 3 | 0 | 3 | 17% |
| Patient / EMR | 6 | 0 | 6 | 0% |
| Reception / Appointments | 7 | 0 | 7 | 0% |
| Vitals | 3 | 0 | 3 | 0% |
| Doctor Consultation | 7 | 0 | 7 | 0% |
| Pharmacy | 5 | 0 | 5 | 0% |
| Laboratory | 5 | 0 | 5 | 0% |
| Imaging | 4 | 0 | 4 | 0% |
| Billing & Payment | 6 | 0 | 6 | 0% |
| Referral | 3 | 0 | 3 | 0% |
| Cross-Workflow Integration | 4 | 0 | 4 | 0% |
| **Total** | **86** | **8** | **78** | **23%** |

---

## Validation Notes

- New scope content was extracted directly from the DOCX package and checked section-by-section, including all tables. It contains no embedded media.
- The existing Release 1 scope copies were hash-compared and structurally inspected. Their broader Emergency/IPD content is not used to inflate the new OPD boundary.
- The packaged DOCX renderer could not execute because its local `pdf2image` dependency is unavailable. No page-number-specific or visual-layout claims are made in this audit.
- Backend absence was verified both by registered modules and by filename/domain searches: no patient, OPD, appointment, availability, vitals, consultation, prescription, pharmacy, laboratory, imaging, billing, payment, or referral backend domain files exist.
- Frontend absence was verified from explicit `AppRouter` page branches: only Dashboard, Users, Roles & Permissions, Departments, Branches, and Services are implemented; other sidebar routes receive `ComingSoonPage`.
- No application feature was implemented or modified as part of this audit.
