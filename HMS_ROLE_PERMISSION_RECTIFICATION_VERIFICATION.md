# HMS Role and Permission Rectification Verification

Date: 4 September 2026

## Implemented functionality

- Aligned navigation, route, page, query, and action checks with effective database permissions.
- Made appointment Check In depend on `OPD / OPD Visits / Create`; the default Receptionist grant permits it while the default Nurse and Doctor grants do not.
- Added composite route requirements for appointment booking, appointment queue, referral booking, patient documents, and patient consent.
- Added the missing `/pharmacy/orders` route requirement and made the shared Surgery route accessible from any independently authorized Surgery view.
- Removed authorization shortcuts based on Doctor, Nurse, Receptionist, and Administrator role names.
- Added human-readable permission names/descriptions while retaining stable internal permission codes and tuples.
- Added stale-write protection to role-permission replacement and dirty-edit warnings to the role matrix.
- Aligned system-role immutability between the UI and API.
- Added branch scope to user list, summary, detail, export, update, role assignment, role assignee lists, and role user counts; validated department assignments against selected branches.

## Existing functionality reused

- Database-backed role/permission expansion and multi-role union semantics.
- `requirePermission`, `hasPermission`, `ProtectedRoute`, domain/feature hooks, audit logging, and established branch-scope patterns.
- Existing HMS Local sidebar, appointment queue, and role-permission visual patterns; no prototype files were modified.

## Files and shared modules changed

- Backend: permission seed/display metadata, permission replacement schema/repository/service/routes, roles repository/service/routes, users repository/service/routes, and focused tests.
- Frontend: centralized access control, permission API/hooks, role-permission feature/page, appointment queue/calendar/dashboard feature hooks and pages, patient authorization checks, and dashboard navigation.
- Shared registries/contracts: permission seed metadata and route-access requirements were updated minimally; existing uncommitted UI/router work was preserved.
- Documentation: gap note, audit matrix, and this verification record.

## Backend validation, scope, audit, and error handling

- Exact endpoint permissions remain authoritative; frontend values are not trusted.
- Multi-role permissions remain an active-role union with SUPER_ADMIN override behavior unchanged.
- Cross-branch reads and mutations now return scoped results or `403` conflicts instead of exposing users.
- Department-to-branch inconsistency returns `DEPARTMENT_BRANCH_MISMATCH`.
- Concurrent role-permission edits return `409 STALE_ROLE_PERMISSIONS`.
- Higher-authority modification and permission-escalation protections remain in force.
- Existing audit events are preserved for role, assignment, and permission mutations. No new multi-document transaction was required for this rectification.

## HMS Local UI patterns reused

- Existing Administration hierarchy, action-table pattern, appointment queue language, status treatment, and top-right notification conventions were retained.
- `scope/HMS Local` was read only and was not modified.

## Automated checks and manual tests

- Expanded focused `npx vitest run ...`: 6 files, 44 tests passed.
- Full `npx vitest run`: 277 passed and 11 failed on the first run. One role-scope test-harness omission was corrected and its test now passes; the remaining 10 failures are outside phase-owned files: two patient portal refresh-session assertions, two patient/web auth refresh fixtures, three patient catalogue query-count assertions, one staff-web auth refresh fixture, and one fixture each for the Emergency and Surgery workspace pages.
- `npm run typecheck --workspace=@hms/api`: passed.
- `npm run lint --workspace=@hms/api`: passed.
- `npm run build --workspace=@hms/api`: passed.
- `npm run typecheck --workspace=@hms/web`: passed.
- `npm run lint --workspace=@hms/web`: passed.
- `npm run build --workspace=@hms/web`: passed; 770 modules transformed.
- Phase-owned diff whitespace check: passed (line-ending conversion warnings only).
- Repository-wide diff whitespace check still reports one pre-existing extra blank line at EOF in the user-owned `apps/web/src/pages/PhaseTwoReportsPage.tsx`; it was present before this work and was not changed as part of the rectification.
- Live browser/manual role walkthrough could not be completed because the configured browser runtime reported that no browser was available. Automated route/action tests cover the requested Receptionist, Nurse, Doctor, multi-role union, direct-route, Administration-child, stale-write, system-role, and branch-scope cases.

## Remaining dependency or clarification

- The available Release 2 FSD does not define universal department-level row isolation across every domain. Existing explicit department scoping in Admissions, Surgery, and Emergency remains unchanged; broadening it requires an approved domain-by-domain contract.
- Final live acceptance remains pending a browser-enabled environment and seeded test users. Run the normal permission seed/upsert before validating the new permission display metadata against an existing database.

## Stop confirmation

No subsequent phase has been started.
