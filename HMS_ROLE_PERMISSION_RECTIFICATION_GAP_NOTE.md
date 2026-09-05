# HMS Role and Permission Rectification Gap Note

Date: 4 September 2026

## Scope

This rectification keeps the existing database-backed RBAC architecture. It aligns effective multi-role permissions across frontend navigation, route mounting, action visibility, backend authorization, and approved data scope. The three reported symptoms (appointment check-in, Administration visibility, and unclear permission labels) are treated as audit entry points rather than isolated fixes.

## Reusable implementation

- `PermissionModel`, `RoleModel`, `User.roleIds`, and the existing authentication permission expansion remain authoritative.
- `hasPermission`, `canAccessRoute`, `ProtectedRoute`, and permission-aware feature hooks remain the frontend authorization pattern.
- `requirePermission` remains the backend action authorization boundary.
- Existing branch-scope patterns in Patients, Appointments, Doctors, Billing, Laboratory, Imaging, OPD, and Notifications are reused.
- HMS Local sidebar, appointment queue, and roles-permissions presentation patterns are retained for UI consistency only.

## Confirmed gaps to rectify

- Appointment check-in creates an OPD visit but its UI is not conditioned by the same `OPD / OPD Visits / Create` permission enforced by the API.
- `/pharmacy/orders` mounts an implemented staff page but is absent from the centralized route requirements.
- Patient Documents and Consent routes omit their supporting `Patients / Patient Records / View` dependency.
- Surgery's combined workspace route requires all three View permissions even though each section is independently authorized by the backend.
- Role assignment UI can open with `Roles / Assign` while its user lookup requires `Administration / Users / View`.
- Remaining patient-history and patient-demographic UI shortcuts use role names instead of effective permissions.
- Permission names are generated from technical tokens, descriptions are not seeded, and the matrix abbreviates important actions.
- User list, summary, detail, and export are not scoped by the requesting user's authorized branches; update does not recheck branch delegation.
- Role details and role list counts expose assignees outside a branch administrator's branch scope.
- Department assignments are validated as active but are not validated against the selected branch set.

## Intended files

- `apps/api/src/database/seed.ts`
- `apps/api/src/modules/users/user.repository.ts`
- `apps/api/src/modules/users/user.service.ts`
- `apps/api/src/modules/users/user.routes.ts`
- `apps/api/src/modules/roles/role.repository.ts`
- `apps/api/src/modules/roles/role.service.ts`
- `apps/api/src/modules/roles/role.routes.ts`
- focused API tests under `apps/api/src/modules/users`
- `apps/web/src/auth/access-control.ts` and its tests
- `apps/web/src/hooks/appointments/useAppointmentQueueFeature.ts`
- `apps/web/src/pages/AppointmentQueuePage.tsx`
- `apps/web/src/hooks/admin/useRolesPermissionsFeature.ts`
- `apps/web/src/pages/RolesPermissionsPage.tsx`
- patient feature/page capability checks where confirmed
- audit and verification Markdown documents

## Shared dependencies and boundaries

- The FSD confirms branch-aware authorization and permission-driven actions, but it does not define universal department row isolation for every domain. Existing department scope in Admissions, Surgery, and Emergency will not be broadened by assumption.
- Existing role-to-department assignment heuristics are outside this rectification's approved contract and will not be expanded.
- Internal permission codes and `(module, screen, action)` tuples remain unchanged. Human-readable names and descriptions are presentation metadata.
- Existing uncommitted work in the roles-permissions UI, reports label, router labels, navigation data, and admin CSS is user-owned and must be preserved.

## Stop gate

After implementing and verifying the confirmed gaps, unresolved domain-by-domain department isolation will remain documented as an FSD/business decision. No new RBAC architecture or subsequent release phase will be started.
