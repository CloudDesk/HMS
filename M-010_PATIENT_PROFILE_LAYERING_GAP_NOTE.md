# M-010 Patient Profile Layering Gap Note

## Scope

This increment is limited to `apps/web/src/pages/PatientProfilePage.tsx` and the minimum existing patient hook/service architecture required by that page. No other page or backend module is in scope.

## Sources inspected

- `PROJECT_RULES.md`
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md`
- the current Patient Profile page, patient feature/domain hooks, related appointment/OPD/laboratory/imaging/billing hooks, patient document service, and patient API client
- the established OPD, Emergency, and Surgery feature-hook patterns
- `scope/HMS Local/patient-profile.html` as a read-only UI reference

## Existing architecture reused

- `usePatientProfileFeature` for cross-domain profile orchestration
- patient details, history, timeline, documents, update, upload, and download domain hooks
- appointment, OPD visit, doctor, laboratory, imaging, and billing domain hooks
- `patientDocumentsService` and the existing `patientsApi` contracts
- existing patient query-key factory and mutation invalidation conventions

## Gap found

Most profile queries and two mutations were already owned by `usePatientProfileFeature`. The page still imported the runtime patient API client and directly orchestrated document download, preview download, and document review. Document review also owned its mutation pending state and server call in the page. The page additionally mounted the existing settings-backed currency formatter, whose hook performs a settings API read.

## Intended files

- `apps/web/src/pages/PatientProfilePage.tsx`
- `apps/web/src/hooks/patients/usePatientProfileFeature.ts`
- `apps/web/src/hooks/patients/usePatients.ts`
- `apps/web/src/services/patient-documents.service.ts`
- focused Patient Profile tests and this M-010 evidence

No API contract, backend file, route, shared registry, or other page is changed.
