# H-002 Notification Authorization Gap Note

## Reusable implementation

- Shared JWT authentication middleware and database-backed permission middleware.
- System permission seeding and role assignment architecture.
- User branch assignments and `SUPER_ADMIN` branch-scope bypass pattern.
- Existing recipient-scoped `/api/notifications/me` and mark-as-read repository filters.
- Existing server-side OPD notification creation calls.

## Confirmed gap

- Global notification list and create routes require authentication but no permission.
- Global listing has no actor or branch filter.
- Global creation accepts recipient targets without actor branch validation.
- Recipient identifier schemas accept malformed MongoDB identifiers.
- Global route creation does not persist the authenticated actor.

## Intended change

- Add `Administration / Notifications / View|Create` system permissions using the existing permission seed.
- Require those permissions on global notification routes.
- Derive actor identity from `request.user.id` and persist it as `createdBy`.
- Resolve global list/create branch scope from the authenticated user's database assignments, with the existing `SUPER_ADMIN` exception.
- Validate recipient and related entity ObjectIds at schema and service boundaries.
- Preserve `/api/notifications/me` as an authenticated-user-only query.

No H-001 compatibility changes or H-003 through H-015 work is in scope.
