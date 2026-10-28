# HMS Scope 2 Phase 3 - Admission Request Refactor Verification

## Status

**Area:** Admission Requests screen and create flow  
**Status:** Verified with documented unrelated lint blockers  
**Verification date:** 1 September 2026

## Implemented Functionality

- Refactored the Admission Requests page to separate Source, Admission Type, Request Status and Actual Admission.
- Replaced the ambiguous `Admission` source label with `Direct Admission`.
- Limited UI admission types to currently supported request types: `INPATIENT`, `OBSERVATION`, and `DAY_CARE`.
- Added source-specific create behavior:
  - OPD selects an existing OPD visit and fills patient, doctor, department, priority and clinical summary context.
  - Referral selects an existing submitted referral and fills patient, referring doctor, priority and clinical summary context.
  - Direct Admission uses searchable registered patients and asks only for direct request details.
- Added duplicate-risk warnings for active admissions and pending admission requests for the selected patient.
- Kept actual inpatient admission creation behind validation and confirmation actions.
- Added readable frontend error handling for session expiration, authorization, validation, active-admission conflicts, source mismatches, source conversion, bed conflicts, consent and deposit blockers.
- Fixed protected-request handling when a stored access token is already expired and refresh fails.
- Hardened backend transaction fallback so a failed transaction attempt does not reuse an expired Mongo session.
- Centralized inpatient admission type/source enum values for backend schemas and models.
- Added backend validation for submitted Referral sources.

## Existing Functionality Reused

- Existing patient, active-patient, doctor, department, OPD visit, Reception referral, Emergency encounter, ward, bed and admission APIs.
- Existing admission request lifecycle and confirmation service.
- Existing consent upload and advance-payment prerequisite integrations.
- Existing authorization/unauthorized handler in the web API client.
- Existing HMS Local admission-request table, KPI, modal and side-panel visual patterns.

## Automated Verification

- `npm run typecheck --workspace=@hms/api` - passed
- `npm run typecheck --workspace=@hms/web` - passed
- `npm run lint --workspace=@hms/api` - failed on pre-existing unrelated lint errors in `apps/api/src/modules/settings/system-settings-quick-wins.test.ts`
- `npm run lint --workspace=@hms/web` - failed on pre-existing unrelated lint errors in `apps/web/src/components/settings/SettingsForms.tsx` and `apps/web/src/hooks/surgery/useSurgeryWorkspaceFeature.ts`
- `npm run build --workspace=@hms/api` - passed
- `npm run build --workspace=@hms/web` - passed
- `npx vitest run apps/web/src/auth/auth-refresh.test.tsx` - failed with the default fork pool because the worker timed out before loading tests
- `npx vitest run apps/web/src/auth/auth-refresh.test.tsx --pool=threads` - passed, 4 tests
- `npx eslint apps/api/src/modules/inpatient-admissions/inpatient-admission.types.ts apps/api/src/modules/inpatient-admissions/inpatient-admission.schemas.ts apps/api/src/modules/inpatient-admissions/inpatient-admission.model.ts apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts apps/web/src/api/client.ts apps/web/src/auth/auth-refresh.test.tsx apps/web/src/hooks/admissions/useInpatientAdmissionFeature.ts apps/web/src/hooks/reception/useReception.ts apps/web/src/pages/InpatientAdmissionPage.tsx` - passed
- `git diff --check` - passed with line-ending warnings only

## Manual Verification Scope

Manual browser verification should cover:

- Expired-token create request path redirects/signals session expiration without sending the stale protected request.
- OPD create flow requires and links an existing OPD source.
- Referral create flow requires and links an existing submitted referral source.
- Direct Admission create flow omits source-record fields.
- Active-admission and pending-request warnings appear for matching patients.
- Validation selects a live ward and available bed.
- Confirmation creates the actual admission only from `READY_FOR_CONFIRMATION`.
- Cancellation remains destructive and reason-gated.

## Remaining Constraints

- Direct Admission duplicate pending-request hard blocking remains a product-rule dependency.
- Emergency source support exists in code, but the default source selector remains OPD, Referral and Direct Admission.
- Logged-in doctor/staff prefill for Requested By remains blocked on an auth-to-staff mapping contract.
- `.firebase/hosting.YXBwc1x3ZWJcZGlzdA.cache` was already modified before this refactor and was not edited manually.
- `.codex-tmp/` contains temporary document-extraction files from source review. Recursive cleanup was blocked by shell safety policy.

## Stop Gate

This refactor does not start the next phase.
