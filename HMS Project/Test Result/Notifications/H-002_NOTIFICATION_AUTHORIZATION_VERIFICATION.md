# H-002 Notification Authorization Verification

## Implemented

- Protected global notification list and create routes with database-backed `Administration / Notifications / View|Create` permissions.
- Assigned those permissions to the existing `ADMINISTRATOR` seed role; the existing `SUPER_ADMIN` all-permissions behavior remains unchanged.
- Derived actor identity exclusively from the authenticated JWT user and recorded it as `createdBy` for global API creation.
- Restricted non-superadmin global listing and creation to active branches assigned to the authenticated user.
- Validated active recipient branches, roles, users, and recipient-user branch membership.
- Added MongoDB ObjectId validation for notification recipient, branch, related entity, and route identifiers.
- Preserved server-side OPD notification creation and authenticated `/api/notifications/me` behavior.

## Focused tests

`notification.authorization.test.ts` covers unauthenticated, patient, permissionless staff, and authorized staff access; branch isolation; actor spoof resistance; malformed identifiers; out-of-scope recipients; and authenticated-user-only `/me` behavior.

Result: 15 tests passed.

## Automated checks

- `npm run typecheck --workspace=@hms/api`: passed.
- `npm run build --workspace=@hms/api`: passed.
- H-001 OTP regression suite: 12 tests passed.
- Focused ESLint on all H-002-owned source/test files and `database/seed.ts`: passed.
- `npm run lint --workspace=@hms/api`: blocked by 43 pre-existing errors in unrelated scratch scripts and modules. No reported lint error is in an H-002-owned file.
- `git diff --check`: passed (Git only reported existing LF-to-CRLF checkout warnings).

## Manual review

- Confirmed frontend notification access uses `/api/notifications/me`, not the global routes.
- Confirmed internal OPD visit/referral notification creation remains a server-side service call and does not acquire an HTTP permission dependency.
- Confirmed mark-as-read remains constrained by the authenticated user's recipient identity, roles, and branches.

No H-001 behavior was changed and no H-003 through H-015 work was started.
