# M-013 HTTP Response Contracts Verification

## Implemented

- Closed Fastify success-response schemas for staff login, refresh, and current-user responses.
- Closed patient OTP request/verify responses and the same safe session schema on patient OTP login.
- Closed patient/guardian portal-context schema.
- Closed administrative user list/detail schemas.
- Closed branch-scoped administrative patient list/detail schemas.
- Endpoint-level serializer tests using deliberately unsafe mocked service results.

## Controlled and Excluded Fields

The contracts preserve the existing frontend-visible auth user, token, user-management, patient, pagination, assignment, role, audit, and patient-context fields.

Serialization tests prove removal of unexpected `passwordHash`, `otp`, `refreshToken`, `refreshExpiresIn`, `failedLoginAttempts`, MongoDB `_id`, nested internal fields, and arbitrary security metadata. Refresh tokens remain cookie-only.

## Automated Validation

- `npm.cmd test --workspace=@hms/api -- src/modules/http-response-contracts.test.ts`: PASS, 5 tests.
- `npm.cmd test --workspace=@hms/api -- test/auth.test.ts`: PASS, 4 tests (individual rerun).
- `npm.cmd test --workspace=@hms/api -- src/modules/patient-portal/patient-refresh-session.test.ts`: PASS, 8 tests (individual rerun).
- `npm.cmd test --workspace=@hms/api -- src/modules/patient-portal/otp.test.ts`: PASS, 19 tests (H-001 regression).
- `npm.cmd test --workspace=@hms/api -- src/modules/notifications/notification.authorization.test.ts`: PASS, 15 tests (H-002 regression).
- `npm.cmd run typecheck --workspace=@hms/api`: PASS.
- `npm.cmd run build --workspace=@hms/api`: PASS.
- M-013-owned ESLint: all owned files/changes pass except two pre-existing findings in `patient.routes.ts` at lines 219 and 262 (`no-unused-vars`, `no-explicit-any`). Those unrelated lines were not changed.

## Manual Validation

No browser workflow was required because M-013 changes only backend serialization and the compatible shapes were exercised through Fastify injection and the existing frontend-facing authentication regressions.

## Remaining M-013 Coverage

This is intentionally representative, not exhaustive. Public catalogue responses, patient portal overview/appointments/documents, mutation responses, history/timeline/document responses, and other backend domains still lack explicit response schemas.
