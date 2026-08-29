# M-010 Patient Profile Layering Verification

## Implemented

- Removed the runtime `patientsApi` import and direct document API calls from `PatientProfilePage.tsx`.
- Extended `usePatientProfileFeature` to compose document download and review actions with its existing patient-profile query and mutation orchestration.
- Moved composition of the existing settings-backed currency formatter into the feature hook.
- Extended the existing patient document service/domain hook path for document review; no duplicate API client, service, or query-key factory was created.
- Kept modal state, temporary files and form values, blob presentation, validation, navigation, and local toast wording in the page.

## Contract and cache checks

- Patient IDs and document IDs are forwarded unchanged.
- Profile update, upload, download, and review payloads are forwarded unchanged.
- Review invalidates the patient document collection, the affected patient history, and patient timeline queries through existing hierarchical keys.
- Existing query parameters and request gating for patient details, timeline, visits, appointments, labs, imaging, documents, billing, and doctors are unchanged.

## Automated verification

- Patient Profile page and feature/domain focused tests: recorded in the completion report.
- Staff-web typecheck: recorded in the completion report.
- Staff-web production build: recorded in the completion report.
- ESLint on changed M-010 files: recorded in the completion report, including any pre-existing page-only findings.

## Scope confirmation

No other page, backend module, completed finding, M-011 work, or M-015 work was changed. The next M-010 page increment has not started.
