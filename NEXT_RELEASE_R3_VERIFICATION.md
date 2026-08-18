# Next Release R3 Verification

## Status

R3, Inpatient Admission and Initial Bed Assignment, was completed on 18 Aug 2026.

The implementation stops here. R4, Bed Transfer, has not been started.

## Included

- Branch-scoped inpatient admission model, repository, service, routes, validation, indexes, and audit event.
- Live patient, doctor, department, ward, and available-bed selection.
- Atomic admission creation with a conditional `AVAILABLE` to `OCCUPIED` bed update in one Mongo transaction.
- Active patient, doctor, department, ward, and branch validation.
- Duplicate active bed protection through conditional assignment and a partial unique index.
- Admissions navigation and HMS Local-style inpatient admission form.
- Recent inpatient admissions list with live API data.
- R3 permissions: `Admissions / Inpatient Admissions / View` and `Create`.

## Manual Test Steps

1. Run the API and web applications and sign in with a user that has an authorized branch and the Admissions Inpatient Admissions permissions.
2. Open `Admissions > Inpatient Admission`.
3. Select an active branch. Confirm the patient, department, doctor, active ward, and available bed controls load from the backend.
4. Search for an active patient by MRN or name and select the patient.
5. Select a department, admitting doctor, active ward, available bed, admission date/time, admission type, and enter a reason.
6. Submit the form. Confirm a success notification appears, a new admission appears in Recent inpatient admissions, and the selected bed no longer appears in the available-bed list.
7. Open `Admissions > Bed Management`, select the same branch, and confirm the bed status is `OCCUPIED` and the occupied summary increased.
8. Attempt to submit the same bed again from a second browser/session or after refreshing the form. Confirm the API rejects it with a bed-not-available error and no second admission is created.
9. Repeat with a reserved, blocked, under-maintenance, or inactive bed. Confirm each is rejected and no admission is created.
10. Use an inactive patient, doctor, department, or ward if available in the test data. Confirm the API rejects the admission and the bed remains available.
11. Remove the user’s branch assignment and sign in again. Confirm the admission page cannot load or create data for that branch.
12. Re-login and reopen the admission page. Confirm the admission and occupied bed persist from MongoDB rather than browser state.

## Verification Results

- `npx eslint apps/api/src/modules/inpatient-admissions`: passed.
- Focused web ESLint for R3 files: passed.
- `npm run typecheck --workspace=@hms/web`: passed.
- `npm run build --workspace=@hms/web`: passed.
- `npm run typecheck --workspace=@hms/api`: blocked by pre-existing errors in `apps/api/src/modules/departments/department.repository.ts`, where legacy references use `branchId` while the current department model exposes `branchIds`. No R3 error was reported.

## Deferred to Later Phases

- R4 bed transfer and transfer history.
- R5 discharge, bed release, cleaning, and discharge reversal.
- R6 inpatient workspace, inpatient clinical records, billing, documents, and discharge summary.
