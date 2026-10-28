# HMS Role-Based Dashboard and Navigation Gap Note

## Scope

Make the staff dashboard, dashboard tabs, sidebar navigation, direct-route access, and dashboard requests follow the authenticated user's existing database-backed roles and permissions for every current staff role.

## Reusable implementation

- `AuthProvider` restores `/auth/refresh` or `/auth/me` before protected UI is rendered.
- `AuthUser` already contains the user ID, active roles, expanded permissions, and assigned branches.
- `hasPermission`, `canAccessRoute`, and `getAccessibleSidebarModules` are the existing frontend authorization primitives.
- `AppRouter` and `AccessDeniedPage` are the existing direct-route enforcement path.
- Fastify routes use `requirePermission(module, screen, action)` and remain authoritative.
- Existing Doctor, Appointment, OPD, Emergency, Billing, Administration, Pharmacy, Laboratory, Imaging, Admissions, Surgery, and Reports pages/hooks provide live operational workflows.
- Existing module hooks already use TanStack Query and mostly expose `enabled` permission/context gates.

## Roles discovered

- `SUPER_ADMIN`
- `ADMINISTRATOR`
- `RECEPTIONIST`
- `CLINICIAN_NURSE`
- `DOCTOR`
- `PHARMACY_USER`
- `LABORATORY_USER`
- `IMAGING_USER`
- `BILLING_AUTHORIZED`
- `PATIENT` and `GUARDIAN` are patient-portal roles and are rejected by the staff login.

Custom roles are also supported. Dashboard selection must therefore be permission-driven and cannot depend on an exhaustive role switch.

## Current gaps

- `DashboardShell` exposes six hardcoded tabs to every authenticated staff user.
- The executive overview is always the initial tab and unconditionally requests Patients, Doctors, Appointments, OPD, and Billing APIs.
- A manually supplied dashboard `tab` query value is not checked against the user's permissions.
- The dashboard has no safe permission-based fallback for custom or operational roles without a dedicated dashboard.
- Several sidebar or implemented route aliases are absent from `routeRequirements`, and Bed Management currently requires a state-changing permission merely to view the page.
- Dashboard behavior has no focused permission-matrix tests.

## Shared dependencies

- Auth session response from `AuthRepository.getUserAccessContext`.
- System permissions and role assignments in `apps/api/src/database/seed.ts`.
- Backend `requirePermission` middleware on every reused API.
- Central sidebar definitions in `apps/web/src/data/ui-foundation.ts`.

## Intended files

- `apps/web/src/auth/access-control.ts`
- `apps/web/src/pages/DashboardShell.tsx`
- Focused web tests for access control and dashboard selection
- This gap note and a matching verification note

No backend role, permission, model, route, or API contract change is intended.

## Dashboard strategy

- `SUPER_ADMIN`: retain the current executive overview and all existing dashboard tabs.
- All other staff and custom roles: build tabs from existing View permissions only.
- `DOCTOR`: use the existing authenticated-doctor dashboard as the first permitted clinical dashboard.
- Pharmacy, Laboratory, Imaging, Billing, Administration, Emergency, Admissions, Surgery, Reports, Patients, Appointments, and OPD users: expose only the operational tabs backed by permissions they actually hold.
- Roles without a dedicated metric page: show a safe module-access overview containing only routes already authorized by `canAccessRoute`; do not call executive APIs.
- An unauthorized or stale `?tab=` value falls back to the first permitted tab and never mounts the unauthorized page/query.

