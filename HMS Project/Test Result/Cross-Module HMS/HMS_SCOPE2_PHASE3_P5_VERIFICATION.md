# HMS Scope 2 Phase 3 - P3-5 Verification

**Phase:** P3-5 Emergency-to-IP Conversion and Cross-Module Integration  
**Status:** Completed  
**Completed:** 24 August 2026  
**Next phase:** P3-6 is not started and requires explicit approval.

## Delivered

- Added `EMERGENCY_ENCOUNTER` as an approved source for the existing inpatient admission-request workflow.
- Validated the source Emergency encounter, linked Patient, branch, department, assigned doctor, conversion state and `ADMIT` disposition on request creation and again immediately before confirmation.
- Reused the existing active-admission, consent, advance-deposit, hold, bed-availability and allotment rules without creating a separate Emergency admission path.
- Confirmed the admission, occupied the bed, linked the source and transitioned Emergency to `CONVERTED_TO_IP` in one MongoDB transaction.
- Stored the resulting inpatient admission reference and conversion actor/time on the Emergency encounter.
- Made confirmed-request retries idempotent and rejected duplicate source requests or stale conversions.
- Added `emergency.encounter.converted_to_ip` and `admissions.source.converted` audit events and an `EMERGENCY_CONVERTED_TO_IP` Patient EMR event.
- Preserved existing Pharmacy, Laboratory and Imaging records with their original `EMERGENCY_ENCOUNTER` source context.
- Added a live Emergency-to-Reception handoff that opens the existing admission form with branch, Patient, department, doctor, reason, notes and source context prefilled.
- Exposed conversion metadata in the frontend Emergency contract.
- Removed no mocks and introduced no duplicate Patient, bed, admission, billing, consent or downstream-order subsystem.

## Reused Foundations

- P3-1 bed availability, hold and atomic allotment services.
- P3-2 admission request, validation, configured consent/deposit checks, active-admission uniqueness and generic conversion workflow.
- P3-4 Emergency registration, Patient linking, consultation, orders and disposition lifecycle.
- Existing branch authorization, RBAC, audit, Patient timeline, React hooks, admission page and HMS Local workflow patterns.

## Backend Safety

- Database access remains in repositories and conversion rules remain in domain services.
- Confirmation uses one transaction for admission creation, bed allotment, Emergency conversion and request completion.
- Conditional updates reject stale source state and prevent a source from linking to more than one inpatient admission.
- Confirmed retries return the original admission rather than creating another admission or occupancy.
- Unmet consent/deposit/bed/hold prerequisites fail before conversion and roll back all transactional writes.
- Wrong-branch resources remain undiscoverable and protected routes retain existing permission middleware.
- Audit metadata records actor, source and resulting resource identifiers without clinical note bodies.

## Compatibility Fixes

- Admission-reference reads inside the confirmation transaction are sequential because the configured Mongo-compatible database rejects parallel operations on one session.
- Admission policy upsert no longer sets and increments `version` in the same update, which previously caused Mongo error code `40`.
- Development database bed indexes were synchronized once to replace obsolete sparse unique definitions with the current partial unique definitions. No application data was deleted.

## Automated Verification

Passed:

```text
npm run typecheck --workspace=@hms/api
npm run lint --workspace=@hms/api
npm run build --workspace=@hms/api
npm run typecheck --workspace=@hms/web
npm run lint --workspace=@hms/web
npm run build --workspace=@hms/web
```

The production web build retains the existing bundle-size and mixed dynamic-import warnings. They do not fail the build and were not introduced by P3-5.

## Runtime Verification

Verified against the configured MongoDB database and API on port `4001`:

- A valid Emergency `ADMIT` source produced one confirmed request, one active admission and one bed allotment.
- The Emergency encounter became `CONVERTED_TO_IP`, referenced the same admission and the selected bed became `OCCUPIED`.
- Retrying confirmation returned the same admission and created no duplicate records.
- A duplicate request for the same source returned HTTP `409`.
- Mandatory consent failure returned HTTP `409`; the Emergency remained conversion-ready, the bed remained `AVAILABLE` and no admission was created.
- An unauthenticated request returned HTTP `401`; a wrong-branch source lookup returned HTTP `404`.
- Pharmacy source type and source ID remained `EMERGENCY_ENCOUNTER` and unchanged after conversion.
- Both required audit events and both admission/conversion Patient timeline events persisted.
- Unique test records and temporary policy configuration were removed after verification; no active test admission, bed, ward, request or Emergency encounter remains.

## Manual Test Steps

1. Sign in as an authorized Emergency clinician and create or open an Emergency encounter linked to an existing Patient.
2. Complete triage, call a doctor, save the doctor evaluation, and choose the `ADMIT` disposition.
3. Confirm the application opens **Admissions > Inpatient Admissions** and displays the new admission-request form.
4. Confirm branch, Patient, department, doctor, Emergency source ID, reason and notes are prefilled from the encounter.
5. Save the request and confirm it appears with source type **Emergency Encounter** and the Emergency encounter number.
6. Attempt to create another request for the same encounter. Confirm the API rejects it and no duplicate request appears.
7. Validate the request. If configured consent or deposit is missing, confirm validation or confirmation fails with an actionable message.
8. After satisfying configured prerequisites, select an available bed or valid active hold and confirm the admission.
9. Confirm the request is **Confirmed**, one inpatient admission exists, the bed is **Occupied**, and the Emergency encounter is **Converted to IP**.
10. Refresh and retry the confirmation action. Confirm the same admission is returned and occupancy does not duplicate.
11. Open the Patient EMR timeline and verify admission-confirmed and Emergency-to-IP events reference the same admission.
12. Open the audit log and verify `admissions.source.converted` and `emergency.encounter.converted_to_ip` with actor and source identifiers.
13. For an Emergency encounter with Pharmacy, Laboratory or Imaging orders, compare source type and source ID before and after conversion. Confirm they remain unchanged.
14. Test an unavailable bed and a stale request/version. Confirm HTTP `409`, no Emergency status change and no partial admission or bed assignment.
15. Sign in without admission-confirm or branch access and verify the action is hidden or rejected by the backend.
16. Repeat the workflow at desktop and mobile widths and verify the existing shell, modal, required fields, loading, error and success feedback remain usable.

## Exit Gate

Emergency-to-IP conversion is a thin adapter over the authoritative admission and bed services, with transactional persistence, idempotency, scope enforcement, audit and EMR evidence.

**P3-5 is complete. P3-6 has not started.**
