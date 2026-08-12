# HMS Phase 1 Implementation Tracker

**Created:** 11 August 2026  
**Purpose:** Living two-developer implementation and validation tracker for HMS Phase 1.

## Baseline Sources

- `Scope/HMS_Phase_1_OPD_Understanding_for_Developer 1.docx`
- `docs/HMS_PHASE1_PROGRESS_AUDIT.md`
- `Scope/HMS Local`
- `apps/api`
- `apps/web`

`docs/HMS_PHASE1_PROGRESS_AUDIT.md` remains the baseline audit and must not be rewritten here.

## Architecture Guardrails

| Area | Status | Notes |
|---|---|---|
| Database | Confirmed MongoDB-only in runtime code | API config requires `MONGODB_DATABASE_URL`; Mongoose is used for persistence. |
| PostgreSQL fallback | Not found in app runtime path | No PostgreSQL startup attempt occurred. No `DATABASE_URL` runtime config is used by `apps/api`. |
| SQL migrations | Not found in registered backend startup | API starts through Mongoose connection and seed routine. |
| Stale docs | Needs cleanup later | `README.md` still references PostgreSQL and `DATABASE_URL`; this tracker does not change it. |
| HMS Local | Untouched | Visual/reference prototype only. No validation work modified `Scope/HMS Local`. |

## Runtime Startup

| App | Command | Expected URL | Result |
|---|---|---|---|
| Backend API | `npm run dev --workspace=@hms/api` | `http://localhost:4000` | Running, PID `9932` |
| Frontend Web | `npm run dev --workspace=@hms/web` | `http://localhost:5173` | Running, PID `14324` |

### Backend Startup Evidence

- MongoDB connected successfully.
- Database health verified for database `hms`.
- API listening on port `4000`.
- No PostgreSQL connection attempt was observed.
- Startup warning remains: repeated Mongoose deprecation warning for `findOneAndUpdate()`/`findOneAndReplace()` using `new: true`; recommendation is to use `returnDocument: 'after'`.

## Health Checks

| Check | Endpoint | Result |
|---|---|---|
| API health | `GET /api/health` | Passed: `status=ok`, `service=hms-api`, `environment=dev` |
| Database health | `GET /api/health/db` | Passed: `status=ok`, `database=hms` |
| Frontend route availability | `GET /login` on web server | Passed: HTTP `200` |

## Browser Validation

| Item | Result | Notes |
|---|---|---|
| Actual browser session | Blocked | Browser connector returned no available browser backends. |
| Screenshots | Not captured | Blocked by unavailable browser surface. |
| Console inspection | Not completed | Requires browser access. |
| Network tab inspection | Not completed | Requires browser access. |

Do not mark browser validation as passed until a real browser session is available and the UI is opened/tested.

## Auth And API Runtime Validation

| Area | Result | Notes |
|---|---|---|
| Login | Passed | Existing seeded administrator account authenticated successfully. |
| Current user | Passed | `GET /api/auth/me` returned authenticated user `admin`. |
| Refresh token | Passed | `POST /api/auth/refresh` returned a rotated token pair. |
| Logout | Passed | `POST /api/auth/logout` completed successfully. |
| Unauthenticated protection | Passed | `GET /api/users` and `GET /api/branches` without a token returned `401 AUTHENTICATION_REQUIRED`. |

## Administration API Validation

| Module | Validated Actions | Result | Notes |
|---|---|---|---|
| Users | create, list, view, update, deactivate, activate, lock, unlock, reset password, delete | Passed | Temporary validation user was removed after testing. |
| Branches | create, list, delete | Passed | Temporary validation branch was removed after testing. |
| Departments | create, list, delete | Passed | Temporary validation department was removed after testing. |
| Services | create, list, delete | Passed | Temporary validation service was removed after testing. |
| Roles | list | Passed | Backend returned live MongoDB roles. |
| Permissions | list | Passed | Backend returned live MongoDB permissions. |

Temporary validation data cleanup was confirmed: matching validation users, branches, departments, and services all returned total `0`.

## Frontend Implementation Status

| Screen | Current Status | Evidence | Next Action |
|---|---|---|---|
| Login | Implemented | Auth context and API client exist. Browser validation pending. | Validate in browser when available. |
| Dashboard | Partial | Page uses hard-coded values and expects global `window.Chart`; no Chart.js dependency/CDN found. | Add live dashboard API and supported chart dependency in a future feature task. |
| User Management | API-backed | `UserManagementPage.tsx` uses `usersApi`. | Browser-test full UI workflow when browser is available. |
| Roles & Permissions | Mock-backed | `RolesPermissionsPage.tsx` imports `roles-permissions-mock`. | Replace with live roles/permissions APIs in a future integration task. |
| Department Management | API-backed | `DepartmentManagementPage.tsx` uses `departmentsApi` and `branchesApi`. | Browser-test full UI workflow when browser is available. |
| Branch Management | API-backed | `BranchManagementPage.tsx` uses `branchesApi`. | Browser-test full UI workflow when browser is available. |
| Service Catalogue | API-backed | `ServiceCataloguePage.tsx` uses `servicesApi`, `departmentsApi`, and `branchesApi`. | Browser-test full UI workflow when browser is available. |
| System Settings | Pending | No backend route/module found; frontend route resolves through coming-soon behavior. | Define backend/API before implementing UI. Do not mock. |

## Navigation And Sidebar Findings

| Check | Result | Notes |
|---|---|---|
| SPA navigation code | Passed static check | `apps/web/src/routing/navigation.ts` uses `history.pushState`/`replaceState` and custom event dispatch. |
| Full reload calls | Passed static check | No `window.location.href`, `location.assign`, or `location.replace` found in `apps/web/src`. |
| Sidebar route registry | Partial | Registered routes include Phase 1 OPD items plus broader older-scope groups such as Emergency, Admissions, Inventory, and Reports. |
| Permission-filtered navigation | Pending | Sidebar is not currently filtered by authenticated user permissions. |
| Browser sidebar behavior | Blocked | Requires browser access to validate expansion, active child, and scroll-position behavior. |

## Missing Or Pending APIs

| Capability | Required Endpoint/Dependency | Status |
|---|---|---|
| System Settings | Settings API/module | Missing |
| Live Dashboard KPIs/charts | Dashboard aggregation API | Missing |
| OPD patient/visit workflow | Patient, visit, appointment, vitals, consultation, orders, pharmacy, lab, imaging, billing APIs | Missing per baseline audit |
| Audit log UI/API | Audit query/export API | Missing |

## Automated Validation

| Workspace | Command | Result |
|---|---|---|
| API | `npm run typecheck --workspace=@hms/api` | Passed |
| API | `npm run lint --workspace=@hms/api` | Failed: 86 ESLint errors |
| API | `npm run build --workspace=@hms/api` | Passed |
| Web | `npm run typecheck --workspace=@hms/web` | Passed |
| Web | `npm run lint --workspace=@hms/web` | Passed |
| Web | `npm run build --workspace=@hms/web` | Passed |

### API Lint Failure Summary

- `apps/api/src/database/client.ts`: unused `db` assignment.
- Multiple Mongo model and repository files: `@typescript-eslint/no-explicit-any`.
- Several repositories: unused imports and unused variables.

These were not fixed during this validation pass because the task was validation/tracker setup, not source-code hardening.

## Current Blockers

1. Actual browser validation is blocked because no browser backend is available to this session.
2. API lint fails and must be cleaned before production-readiness can be claimed.
3. Roles & Permissions frontend is still mock-backed despite live backend APIs.
4. Dashboard charts can render blank if `window.Chart` is absent; no Chart.js package/CDN was found.
5. System Settings has no backend/API and should remain pending rather than mocked.
6. `README.md` still contains stale PostgreSQL setup guidance.

## Developer Split Recommendation

| Developer | Workstream | Immediate Next Items |
|---|---|---|
| Developer 1 | Backend/API hardening | Fix API lint, replace deprecated Mongoose `new: true`, align docs with MongoDB, define missing settings/dashboard APIs. |
| Developer 2 | Frontend integration | Connect Roles & Permissions to live APIs, add permission-filtered navigation, browser-validate admin screens once browser access is available. |

## Latest Validation Decision

The backend and frontend start successfully against MongoDB, and the implemented administration APIs are functional at runtime. Production readiness is not yet confirmed because browser validation is blocked, API lint fails, and some implemented frontend screens still use mock/static behavior where live backend APIs exist.

## Login Failure Investigation And Password Visibility (2026-08-11)

### Investigation Result

- The React client and Fastify API both use `POST /api/auth/login` with `{ identifier, password }`; no request-contract mismatch was found.
- The MongoDB administrator record exists, is active, is not deleted or locked, has an active `SUPER_ADMIN` role, and uses the expected `scrypt` password-hash format.
- The stored hash matches the credential configured by the existing database seed. No password or hash was changed or exposed.
- Recent authentication audit records classify the reported browser failures as `invalid_password`.
- The live login endpoint returned HTTP `200` when tested with the credential already configured by the project seed. The reported failure was caused by the submitted password not matching the stored administrator credential, not by the frontend request, MongoDB lookup, password verifier, JWT generation, or response mapping.

### Implementation

- Added an accessible show/hide control to the existing React login password field.
- The password remains masked by default, the toggle is a non-submit button, its icon and accessible label reflect the current state, and the password value is preserved.
- The existing login layout, styling, authentication service, JWT behavior, environment configuration, and MongoDB data were otherwise unchanged.

### Validation

| Check | Result |
|---|---|
| Web typecheck | Passed |
| Web lint | Passed |
| Web build | Passed |
| API typecheck | Passed |
| API build | Passed |
| Login API | Passed: HTTP `200` |
| Current user | Passed: HTTP `200` |
| Refresh rotation | Passed: HTTP `200`, token rotated |
| Protected API | Passed: HTTP `200` |
| Logout | Passed: HTTP `200` |
| Revoked refresh replay | Passed: HTTP `401` |
| Browser login and password-toggle interaction | Blocked: no browser backend is available to this session |

The existing API lint baseline was not changed by this task; its previously recorded errors remain pending.

## Roles And Permissions Frontend Live API Integration (2026-08-11)

### Implementation

- Replaced the React Roles & Permissions screen's mock role list and permission matrix with the existing authenticated APIs.
- Added typed frontend clients for roles and permissions, including server-side role search, type/status filters, pagination, role details, user assignment/removal, and permission replacement.
- The permission matrix is now generated from live `module -> screen -> action` records and loads the assigned permission set whenever a role is selected.
- Existing create, clone, assign/remove user, delete, matrix export, and roles export controls now use live API data and persistence where supported.
- Removed `apps/web/src/data/roles-permissions-mock.ts`; no mock role or permission imports remain in `apps/web/src`.

### APIs Used

- `GET /api/roles`
- `GET /api/roles/:id`
- `POST /api/roles`
- `PATCH /api/roles/:id/status`
- `POST /api/roles/:id/users`
- `DELETE /api/roles/:id/users/:userId`
- `DELETE /api/roles/:id`
- `GET /api/permissions`
- `GET /api/roles/:id/permissions`
- `PUT /api/roles/:id/permissions`
- `GET /api/users` for the role-assignment selector

### Validation

| Check | Result |
|---|---|
| Web typecheck | Passed |
| Web lint | Passed |
| Web build | Passed |
| API typecheck | Passed |
| API build | Passed |
| Roles list/search/filter | Passed against live API |
| Permission catalog | Passed: 33 MongoDB-backed permissions returned |
| Permission replacement and persistence | Passed |
| Role user assignment/removal | Passed |
| Role create/deactivate/delete | Passed |
| Temporary validation data cleanup | Passed: zero validation roles remain |
| Browser validation | BLOCKED - browser backend unavailable |

### Remaining Capability Gap

The screen's Audit History action cannot be connected because the backend does not expose an audit-log query endpoint. The UI reports that limitation and does not display mock audit data. The existing API lint baseline remains unchanged and was not addressed in this integration task.

## Branch Management Frontend Integration And Contract Hardening (2026-08-11)

### Scope And Existing State

- Used `Scope/HMS_Phase_1_OPD_Understanding_for_Developer 1.docx` as the primary functional scope.
- The task description's `ComingSoonPage` premise was stale: `/administration/branches`, `BranchManagementPage.tsx`, and `branches.ts` already existed and used the live API.
- Work was limited to the missing integration details and branch-specific defects. No Developer 2 or clinical module was changed.

### Implementation

- Corrected the frontend client contracts for unwrapped single-branch and delete responses.
- Added all existing backend-supported branch fields to create/edit workflows: short name, email, phone, address, city, state, country, and postal code.
- Prevented edit requests from sending the unsupported `status` field; the status control is read-only while editing.
- Added branch-specific MongoDB-to-API serialization so camelCase Mongoose fields are returned through the documented snake_case API contract and incoming snake_case fields persist correctly.
- Added correct pagination recovery after deleting the last row on a page and after server totals shrink.
- Disabled branch mutation controls when branch-list access returns `403`; operation-specific `403` responses use the existing modal/toast error handling, with backend authorization remaining the final authority.
- Replaced the shared header's hard-coded branch names with active branches loaded through the authenticated Branch API. No mock/static branch records remain in `apps/web/src`.

### APIs Used

- `GET /api/branches`
- `GET /api/branches/:id`
- `POST /api/branches`
- `PATCH /api/branches/:id`
- `DELETE /api/branches/:id`

### Validation

| Check | Result |
|---|---|
| Web typecheck | Passed |
| Web lint | Passed |
| Web build | Passed |
| API typecheck | Passed |
| API build | Passed |
| API/database health | Passed against MongoDB database `hms` |
| Authentication/authorization | Passed: authenticated administrator access; unauthenticated list returned `401` |
| List/get/search/status filter/sort/pagination | Passed against the live API |
| Create/update/delete | Passed with temporary MongoDB records |
| Required field validation | Passed: `400` |
| Duplicate branch code | Passed: `409` |
| Missing/malformed branch ID | Passed: `404`/`400` |
| Snake_case API contract and persistence | Passed |
| Temporary validation data cleanup | Passed: zero matching records remain |
| Regression API checks | Passed for Auth, Users, Roles, Permissions, Departments, and Branches |
| Registered SPA route HTTP checks | Passed for Login, Dashboard, Users, Roles & Permissions, Departments, and Branches |
| Browser validation | BLOCKED - browser backend unavailable |

### Remaining Backend Capability Gaps

1. The backend has no branch status-update endpoint. `PATCH /api/branches/:id` strips a submitted `status`, returns `200`, and leaves the persisted status unchanged. The frontend does not simulate this capability.
2. `DELETE /api/branches/:id` performs a hard delete and does not check whether departments reference the branch. Dependency rejection/deactivation behavior is therefore not available for the frontend to surface.
3. The Developer 1 scope identifies branches as a core administration master but does not define the branch status lifecycle or deletion/dependency business rules. Those rules need product/backend clarification before extending the API.

Actual browser interaction, console/network inspection, responsive viewport checks, sidebar active-state behavior, and document-reload observation remain pending until a browser backend is available.

## Service Catalogue Frontend Integration And Contract Hardening (2026-08-11)

### Scope And Existing State

- Used `Scope/HMS_Phase_1_OPD_Understanding_for_Developer 1.docx` as the primary functional scope.
- Service Catalogue was already routed at `/administration/services` and partially API-backed; it was not a `ComingSoonPage` and did not use mock service records.
- The approved scope supports authorized administration of generic OPD master data. Specialized medicine, laboratory-test, and imaging masters remain outside this generic catalogue implementation.

### Implementation

- Corrected the frontend API contracts for unwrapped service detail/create/update responses and the `{ success: true }` delete response.
- Added explicit service serialization and persistence mapping between snake_case API fields and camelCase Mongoose fields, including timestamps and audit IDs.
- Corrected default and requested service sorting, including `standard_price` and `updated_at` field mapping.
- Added backend validation that a referenced Department exists during service creation and department reassignment.
- Fixed live Branch/Department lookup loading to respect the backend maximum of 100 rows and fetch every lookup page.
- Separated the form's Branch selector from list filtering so modal changes no longer alter the catalogue query.
- Removed the list's unsupported Branch filter; the backend exposes `department_id`, not `branch_id`, and local aggregation would break server pagination/sorting semantics.
- Enabled backend-supported service-code edits and duplicate validation.
- Kept service status read-only during edit because the existing PATCH contract does not support status changes; create continues to support ACTIVE/INACTIVE.
- Added lookup error feedback, list-level forbidden handling, and correct page recovery after deletion or shrinking totals.
- No Service or Department mock data, fake persistence, localStorage, or sessionStorage is used by this feature.

### APIs Used

- `GET /api/services`
- `GET /api/services/:id`
- `POST /api/services`
- `PATCH /api/services/:id`
- `DELETE /api/services/:id`
- `GET /api/departments`
- `GET /api/branches`

### Validation

| Check | Result |
|---|---|
| Web typecheck | Passed |
| Web lint | Passed |
| Web build | Passed |
| API typecheck | Passed |
| API build | Passed |
| API/database health | Passed against MongoDB database `hms` |
| Authentication/authorization | Passed: authenticated administrator access; unauthenticated service list returned `401` |
| List/get/search/department filter/status filter/sort/pagination | Passed against live APIs |
| Create/update/delete | Passed with temporary MongoDB records |
| Required field validation | Passed: `400` |
| Duplicate service code | Passed: `409` |
| Missing/malformed service ID | Passed: `404`/`400` |
| Missing/malformed Department assignment | Passed: `400` |
| Snake_case API contract and MongoDB persistence | Passed |
| Temporary validation data cleanup | Passed: zero matching Services, Departments, and Branches remain |
| Regression API checks | Passed for Auth, Users, Roles, Permissions, Branches, Departments, and Services |
| Registered SPA route HTTP checks | Passed for Login, Dashboard, Users, Roles & Permissions, Branches, Departments, and Services |
| Browser validation | BLOCKED - browser backend unavailable |

### Remaining Backend And Scope Gaps

1. The backend has no Service status-update endpoint. `PATCH /api/services/:id` strips `status`, returns `200`, and leaves the persisted value unchanged. The frontend does not simulate this capability.
2. `DELETE /api/services/:id` performs a hard delete without checking downstream references or preserving historical prices.
3. The list API has no `branch_id` filter. Services can be filtered by their actual `department_id` relationship only.
4. Catalogue KPI and analytics panels are based on the current paginated result because no aggregate Service API exists.
5. The approved scope requires specialized medicine, laboratory-test, and imaging masters, but does not define those domain fields in the generic Service model. They require separate product/backend clarification and implementation.

Actual browser interaction, responsive viewport checks, console/network inspection, sidebar active-state behavior, and document-reload observation remain pending because the browser runtime returned no available backend.

## Next Developer 1 Scope Item Investigation - Doctor Setup And Availability Blocker (2026-08-11)

### Selection

- Primary source: `Scope/HMS_Phase_1_OPD_Understanding_for_Developer 1.docx`.
- Selected requirement: Admin-maintained Doctor setup and Doctor availability, including branch/working context, slots, leave/unavailability, and conflict-safe availability for Reception.
- Reason: Authentication and the current Administration masters are already API-backed. Doctor setup/availability is the next explicit Admin configuration dependency in the scope and is required before Reception booking and rescheduling can use valid slots.
- System Settings was not selected. It is a sidebar item but is not defined as the next approved scope requirement, and no Settings backend exists.

### Initial State And Evidence

- Status: NOT STARTED / BLOCKED BY MISSING BACKEND.
- `apps/api/src/modules` contains only Auth, Health, Users, Roles, Permissions, Branches, Departments, and Services.
- No Doctor/Practitioner, schedule, availability, slot, leave, break, or appointment MongoDB model exists.
- No Doctor/availability repository, service, schemas, routes, or service-registry registration exists.
- No Doctor/availability permissions are seeded; current Administration permissions cover Users, Roles, Permissions, Branches, Departments, and Services only.
- No Doctor/availability API client or implemented React page exists.
- `/doctors`, `/doctors/directory`, `/doctors/schedule`, and `/doctors/availability` are sidebar-only routes and resolve through `ComingSoonPage`.
- No `/api/doctors*`, `/api/doctor-availability*`, scheduling, slot, leave, or conflict-validation endpoint is registered.

### Required Backend Work Before Frontend Implementation

1. Confirm backend ownership and the Doctor/Practitioner domain contract.
2. Define Doctor profile fields, identifier rules, specialty, status, and Branch/Department assignment semantics.
3. Define timezone, recurring schedule, slot duration, breaks, leave/unavailability, overlap/conflict, and deletion/retention rules.
4. Add MongoDB/Mongoose Doctor and availability/schedule models with indexes and reference validation.
5. Add repositories, services, request schemas, routes, centralized registration, and audit events.
6. Add Administration permissions for Doctor setup and availability actions.
7. Define and implement authenticated list/detail/create/update/status and availability-management API contracts.
8. Validate live MongoDB persistence, invalid assignments, overlap prevention, authorization, and audit behavior before starting frontend integration.

The exact REST shape and status vocabulary are not specified by the approved scope and were not invented during this investigation.

### Task Outcome

| Item | Result |
|---|---|
| Feature implementation | Not started - prohibited without backend/API contract |
| Files created | None |
| Source files modified | None |
| Files deleted | None |
| Tracker modified | This tracker only |
| Mock data introduced | None |
| Runtime API validation | Not applicable - no relevant API exists |
| Automated build/typecheck/lint | Not rerun - no application code changed |
| Browser validation | Not applicable - no feature was implemented |

### Ownership And Next Step

Backend ownership is not assigned by the authoritative scope document. Developer 1 cannot continue with frontend implementation under the current task rules. The project lead must assign and approve the Doctor/availability backend design, resolve the domain ambiguities above, and deliver a validated MongoDB-backed API before the React pages are implemented.
