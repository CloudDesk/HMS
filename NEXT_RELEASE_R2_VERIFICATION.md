# R2 Branch-wise Ward and Bed Configuration

## Delivered

- Added the Mongoose `HmsWard` and `HmsBed` models with audit fields, branch references, timestamps, searchable indexes, and a unique `(branchId, wardId, bedNumber)` bed index.
- Added ward fields for branch, name, type, floor, description, and active status.
- Added bed fields for branch, ward, bed number, category, room number, and `AVAILABLE`, `OCCUPIED`, `RESERVED`, `BLOCKED`, `UNDER_MAINTENANCE`, and `INACTIVE` statuses.
- Added branch-scoped paginated ward and bed list APIs, filters, detail APIs, bed summary counts, creation, and status-change APIs.
- Added backend branch authorization for every read and mutation. Frontend branch values are treated as requested scope only; the backend remains authoritative.
- Added duplicate validation and database unique indexes for ward names within a branch and bed identifiers within a branch and ward.
- Added audit events for ward/bed creation, edits, activation/deactivation, and status changes.
- Added Admissions -> Bed Management navigation and a live React screen with HMS operational panels, branch selection, KPI counts, ward/bed tabs, filters, forms, status badges, confirmations, loading, empty, error, and success states.
- New beds can only be created under active wards. Occupied and reserved beds are displayed as admission-workflow controlled and are not deactivated from this configuration screen.

## Verification Commands

Passed:

```text
npm run typecheck --workspace=@hms/web
npm run build --workspace=@hms/web
npx eslint apps/api/src/modules/admissions-configuration apps/web/src/api/admissions-configuration.ts apps/web/src/services/admissions-configuration.service.ts apps/web/src/hooks/useAdmissionsConfiguration.ts apps/web/src/pages/BedManagementPage.tsx
```

The API typecheck/build remains blocked by the pre-existing errors in `apps/api/src/modules/departments/department.repository.ts`, where existing code references `branchId` but the current department type exposes `branchIds`. No R2 file has a remaining TypeScript or lint error.

## Manual Test Steps

1. Run the API and web applications and sign in with an administrator or authorized Admissions user assigned to Branch A.
2. Open Admissions -> Bed Management. Verify the branch selector lists only branches authorized for the signed-in user and the initial KPI values come from the API.
3. Create a ward with a name, type, floor, and description. Verify it appears in the Wards table after the success notification and refresh.
4. Try to create another ward with the same name in the same branch. Verify the request is rejected with a duplicate error and only one ward remains.
5. Switch to Beds, create a bed under the active ward, and verify the bed appears with `AVAILABLE` status.
6. Try to create the same bed number under the same ward. Verify it is rejected. Create the same bed number under a different ward and verify it succeeds.
7. Verify the bed summary counts update after bed creation and match the table records.
8. Deactivate a ward. Verify the ward status changes to `INACTIVE`, the action is audited, and the inactive ward is unavailable in the Add Bed ward selector.
9. Reactivate the ward, then deactivate an available bed. Verify the bed status becomes `INACTIVE` and it is not eligible for future assignment.
10. Use the status API/UI to move a bed between `AVAILABLE`, `BLOCKED`, and `UNDER_MAINTENANCE`. Verify each change updates the summary and status badge. Confirm occupied/reserved records remain admission-workflow controlled.
11. Log in as a user assigned only to Branch B. Verify Branch A wards, beds, and summaries cannot be listed, opened, created under, or changed by changing the submitted `branch_id` in browser requests.
12. Log in as a user without Admissions permissions. Verify the Admissions navigation is hidden or the route displays Access Denied, and direct API requests return HTTP 403.
13. Refresh the page and verify there is no mock or localStorage configuration data and all displayed records are backend records.

## Stop Condition

R2 is complete. Do not begin R3 Inpatient Admission and Initial Bed Assignment until the next explicit approval.
