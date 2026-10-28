# HMS Scope 2 Phase 3 - P3-5 Gap Note

**Phase:** P3-5 Emergency-to-IP Conversion and Cross-Module Integration  
**Status:** Implementation approved on 24 August 2026

## Sources Reconciled

- `PROJECT_RULES.md`
- `AGENTS.md`
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md`
- `HMS_SCOPE2_PHASE3_CONTRACT.md`
- `HMS_Release2_FSD.docx`
- `HMS_Scope2_Developer1(Kamesh)_Phase_3_Prompts.docx`
- Existing P3-1, P3-2 and P3-4 code under `apps/api` and `apps/web`
- HMS Local Emergency workspace and admission-request patterns

## Approved Workflow

1. The Emergency clinician records an `ADMIT` disposition while the encounter remains `READY_FOR_DISPOSITION`.
2. Reception opens the existing admission-request workflow with the Emergency source context.
3. The admission service validates patient, branch, department, doctor, active-admission, bed, consent, deposit and hold requirements.
4. Confirmation uses the existing MongoDB transaction for admission creation and bed allotment.
5. In the same transaction, the Emergency encounter becomes `CONVERTED_TO_IP` and stores the resulting inpatient admission reference.
6. Existing Emergency pharmacy, laboratory and imaging records retain their original `EMERGENCY_ENCOUNTER` source context.

## Existing Functionality Reused

- Generic admission request, validation, confirmation and cancellation APIs.
- Active patient/admission/source uniqueness indexes.
- Branch authorization and admission permissions.
- Bed availability revalidation, hold validation and atomic allotment.
- Configured admission consent and advance-deposit verification.
- Emergency patient linking, doctor evaluation, ADMIT disposition and downstream source records.
- Patient EMR timeline and Pino/audit infrastructure.
- Live React admission and Emergency workspaces.

## Gaps To Close

- Admission request create validation only accepts `DIRECT` and `OPD_VISIT` sources.
- The admission service does not validate an Emergency source or reject provisional/unlinked encounters.
- Confirmation only updates OPD sources; it does not atomically transition Emergency to `CONVERTED_TO_IP`.
- Emergency encounters do not store the resulting inpatient admission reference or conversion metadata.
- The required `admissions.source.converted` and `emergency.encounter.converted_to_ip` audit events are absent.
- The EMR timeline has no explicit Emergency-to-IP conversion event.
- The Emergency UI does not hand the ADMIT decision to Reception with a prefilled source context.
- The admission form cannot create an `EMERGENCY_ENCOUNTER` request.
- A repeated confirmation currently returns a stale-state conflict instead of an idempotent confirmed result.

## Intended Files

Backend:

- `apps/api/src/modules/inpatient-admissions/inpatient-admission.types.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.schemas.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts`
- `apps/api/src/modules/emergency/emergency.model.ts`
- `apps/api/src/modules/emergency/emergency.repository.ts`
- `apps/api/src/modules/patients/patient.types.ts`
- `apps/api/src/modules/patients/patient.model.ts`
- `apps/api/src/shared/services/service-registry.ts`

Frontend:

- `apps/web/src/api/inpatient-admissions.ts`
- `apps/web/src/pages/InpatientAdmissionPage.tsx`
- `apps/web/src/pages/EmergencyWorkspacePage.tsx`

Verification and tracking:

- `HMS_SCOPE2_PHASE3_P5_VERIFICATION.md`
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md`

## Shared Dependencies And Isolation

- Patient timeline enums and the service registry are shared files; edits will be limited to the new conversion event and Emergency repository injection.
- No Patient, Pharmacy, Laboratory, Imaging, Billing, OPD, bed-management or shared-layout architecture will be duplicated or redesigned.
- P3-6 reporting and broader release hardening are explicitly out of scope.
