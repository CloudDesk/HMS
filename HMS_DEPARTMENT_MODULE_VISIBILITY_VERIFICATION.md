# Department Module Visibility Verification

## Implemented

- Added a validated, persisted department `hiddenModules` configuration.
- Added Doctor Module Visibility controls to Department Management create/edit/view flows.
- Added assigned active departments and their visibility settings to the authenticated access context.
- Applied department hiding after existing permission-based sidebar filtering and only for users with the `DOCTOR` role.
- Preserved Super Administrator behavior and all non-Doctor navigation behavior.
- Preserved existing API permission enforcement and clinical workflow authorization.
- Departments with no configuration default to an empty deny-list and retain existing behavior.
- Multiple assigned departments combine their hidden modules for least privilege.
- Department audit events include visibility configuration and before/after values on update.

## Automated verification

- API typecheck: passed.
- API lint: passed.
- API build: passed.
- Web typecheck: passed.
- Web lint: passed.
- Web build: passed.
- `department-module-visibility.test.ts`: 2 tests passed.
- `access-control.test.ts`: 12 tests passed, including Doctor-only filtering, backward-compatible empty configuration, non-Doctor preservation, and multiple-department behavior.
- HTTP response contracts plus department visibility: 9 tests passed after keeping the new `departments` response property optional for compatibility with older session producers and mocks.
- Access control plus Dashboard Shell regression: 32 tests passed.
- The broad web suite still reports four pre-existing failures in `components/opd/dental/tooth-3d.test.ts`; they concern tooth-region geometry and are unrelated to this feature.
- The broad API/web runs were stopped after the relevant regression result because they are long-running; the focused impacted suites, typechecks, lint, and builds are green.

## Manual acceptance

1. In Department Management, edit Dental and select `Hide Surgery`; save.
2. Edit General Doctor and leave Surgery unchecked; save.
3. Ensure the shared Doctor role has the Surgery permission required by normal doctors.
4. Sign out and back in as a Dental Doctor: Surgery must be absent from the sidebar.
5. Sign out and back in as a General Doctor: Surgery must remain visible.
6. Verify a non-Doctor user in Dental is unaffected by the Doctor visibility setting.
7. Clear Dental's hidden module selection and verify its previous navigation behavior returns.

The automated browser reached the local app but remained on its existing `Verifying access & session` state, so no live configuration was saved or user data changed during verification.

## Scope boundary

This is a navigation visibility policy. It does not grant permissions and does not replace backend RBAC or existing department-scoped clinical data authorization.
