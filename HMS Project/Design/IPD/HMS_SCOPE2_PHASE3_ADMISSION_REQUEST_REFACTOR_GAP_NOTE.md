# HMS Scope 2 Phase 3 - Admission Request Refactor Gap Note

**Area:** Admission Requests screen and create flow  
**Status:** Implemented on 1 September 2026

## Sources Reconciled

- `PROJECT_RULES.md`
- `AGENTS.md`
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md`
- `HMS_SCOPE2_PHASE3_CONTRACT.md`
- `HMS_Release2_FSD.docx`
- `HMS_Scope2_Developer1(Kamesh)_Phase_3_Prompts.docx`
- Pasted Admission Requests refactor request and screenshot
- Existing `inpatient-admissions`, OPD, Emergency, Reception referrals, Patients, Doctors, Departments, Wards and Beds implementations
- `scope/HMS Local/admission-requests.html`, `scope/HMS Local/admissions-module.js`, and `scope/HMS Local/admissions-module.css` for UI patterns only

## Existing Functionality Reused

- Admission request lifecycle: `PENDING_VALIDATION`, `READY_FOR_CONFIRMATION`, `CONFIRMED`, `CANCELLED`.
- Existing `AdmissionRequest` and `InpatientAdmission` models, repositories, services, routes and schemas.
- Existing OPD visit and submitted OPD referral records as source records.
- Existing Emergency encounter list source support where an Emergency source is already exposed by the admission backend.
- Existing active-patient lookup, branch-scoped doctors/departments, admission configuration, wards, beds, consent upload and advance-payment hooks.
- Existing API client authentication refresh architecture.

## Gaps Closed

- Source is now treated as request origin, not the final admission event.
- UI source labels use `OPD`, `Referral`, and `Direct Admission`; `Admission` is no longer presented as a source.
- Admission Type is separate from Source and the create form only exposes supported request types: `Inpatient`, `Observation`, and `Day Care`.
- The create form changes its required source selector and autofill behavior based on source type.
- OPD and Referral request creation prefers existing source records instead of re-entering patient/doctor/department context.
- Direct Admission captures patient, department, requested by, reason, clinical summary and priority without OPD/referral fields.
- Backend admission source and admission type enum values are centralized instead of duplicated across schema/model/type files.
- Submitted Referral sources are validated against patient, branch and referring doctor context before an admission request is created.
- Expired access tokens are handled before protected API requests are sent; failed refresh now raises a session-expired API error and invokes the existing unauthorized handler.
- The Mongo transaction fallback no longer retries with a failed or ended session after a transaction-topology error.

## Remaining Constraints

- Direct Admission pending-duplicate prevention is surfaced as a UI warning. Backend hard blocking for duplicate direct pending requests still needs an approved active-request uniqueness rule because there is no source ID to key against.
- Emergency remains available as a linked source in the feature hook for existing P3-5 support, but it is not shown in the default source selector until the product owner confirms it should be selectable from this screen.
- Requested By is selected from the existing doctor/staff lookup. Logged-in doctor prefill is not implemented because the current web auth context does not expose a stable doctor/staff entity link for this field.
- Referral organization/hospital fields are shown only if future referral APIs expose them; no duplicate referral capture fields were added.

## Intended Files

Backend:

- `apps/api/src/modules/inpatient-admissions/inpatient-admission.types.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.schemas.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.model.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts`

Frontend:

- `apps/web/src/api/client.ts`
- `apps/web/src/auth/auth-refresh.test.tsx`
- `apps/web/src/hooks/admissions/useInpatientAdmissionFeature.ts`
- `apps/web/src/hooks/reception/useReception.ts`
- `apps/web/src/pages/InpatientAdmissionPage.tsx`
- `apps/web/src/domains/inpatient.css`

Tracking:

- `HMS_SCOPE2_PHASE3_ADMISSION_REQUEST_REFACTOR_GAP_NOTE.md`
- `HMS_SCOPE2_PHASE3_ADMISSION_REQUEST_REFACTOR_VERIFICATION.md`
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md`

## Phase Boundary

This refactor hardens the existing P3-2/P3-5 admission-request workflow. It does not start a new phase, add a second admission subsystem, add a new referral model, change Billing/Consent architecture, or implement inpatient treatment/discharge workflows.
