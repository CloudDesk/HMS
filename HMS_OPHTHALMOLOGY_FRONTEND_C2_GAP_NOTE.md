# Ophthalmology Frontend C2 Gap Note

## Scope

C2 closes the missing technician handoff between a completed test result and doctor review. The backend contract is implemented and verified first; only then is the matching queue action exposed in the React UI.

## Reusable implementation

- Existing branch-scoped test-task lookup and consultation write lock.
- Existing station membership and assigned-performer checks.
- Existing MongoDB transaction wrapper, conditional task version update, transition history, audit metadata, and conflict errors.
- Existing `OPD / Ophthalmology Test Queue / Complete` permission; no new permission is required.
- Existing queue API client, domain mutation hook, feature action registry, and confirmation dialog.

## Missing contract

- No explicit API command currently moves a task from `COMPLETED` to `SUBMITTED_FOR_REVIEW`.
- Doctor review currently accepts `COMPLETED` directly, so the documented submission gate is not enforced.
- The queue UI intentionally hides submission because the backend command does not exist.

## Approved C2 contract

- `POST /api/ophthalmology/test-tasks/:id/submit-for-review`
- Body: `{ "expected_status": "COMPLETED", "expected_version": number }`
- Permission: `OPD / Ophthalmology Test Queue / Complete`
- Preconditions: branch access, writable consultation, active station membership, assigned performer, completed current result, exact task status/version.
- Atomic outcome: task becomes `SUBMITTED_FOR_REVIEW`, submission actor/time and transition history are saved, and an audit event is written.
- Stale, duplicate, invalid-state, missing-result, or unauthorized submissions are rejected without a partial write.
- Doctor review accepts only `SUBMITTED_FOR_REVIEW` after this contract is introduced.

## Intended files

- Backend model, types, repository, service, schemas, routes, contract document, and focused tests.
- Frontend queue API schema/client, action definitions, confirmation UI, queue display, and focused tests.

## Stop gate

Backend focused tests, typecheck, lint of owned files, and build must pass before frontend integration begins. C3 is out of scope.
