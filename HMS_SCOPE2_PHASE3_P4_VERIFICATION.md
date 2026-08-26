# HMS Scope 2 Phase 3 - P3-4 Verification

**Phase:** P3-4 Emergency Core Workflow  
**Status:** Completed  
**Completed:** 21 August 2026  
**Next phase:** P3-5 is not started and requires explicit approval.

## Delivered

- Added a persistent Emergency encounter aggregate for known patients and approved provisional identities without creating fake Patient records.
- Added branch- and department-scoped registration, paginated priority queue, summary, encounter detail, patient linking/correction, triage, authorized priority override, doctor call/skip, consultation, downstream orders, disposition, no-show, left, and cancellation APIs.
- Implemented the approved five-level triage model and guarded lifecycle from registration through terminal or conversion-ready status.
- Added conditional state updates and versioning so stale or repeated transitions fail with a conflict response.
- Added Emergency permissions for Encounters, Triage, Consultation, Orders, Disposition, and Patient Linking, with backend enforcement and role reconciliation.
- Added audit events and Patient EMR timeline events for important Emergency transitions without placing clinical note bodies in audit metadata.
- Added queue-safe API projections that omit triage notes, vitals, consultation, orders, disposition, identity notes, and other unnecessary clinical payloads.
- Added permission-aware detail redaction for Triage, Consultation, Orders, and Disposition sections.
- Added live HMS Emergency dashboard, queue, registration, assessment, consultation, orders, disposition, timeline, patient-link, priority-override, no-show, left, and cancellation interfaces.
- Added URL-backed branch, department, priority, status, search, and selected-encounter state with loading, empty, error, conflict, and success feedback.
- Added Emergency source context to the existing prescription and clinical-order persistence contracts.
- Added Laboratory and Imaging catalogue validation on the backend; client-supplied service names and categories are not trusted.
- Added Emergency-origin Pharmacy, Laboratory, and Imaging order initiation without creating duplicate downstream modules.
- Added partial unique indexes so nullable OPD references cannot collide with Emergency-origin orders.
- Added fail-closed discharge behavior when Emergency downstream charges have no authoritative billing closure. A no-charge discharge records `NO_CHARGES_RECORDED`.
- No mock Emergency queue data, browser persistence, alternate database, or new database connection was introduced.

## Lifecycle

Implemented statuses:

```text
REGISTERED
WAITING_FOR_TRIAGE
TRIAGED
WAITING_FOR_DOCTOR
IN_CONSULTATION
IN_TREATMENT
READY_FOR_DISPOSITION
DISCHARGED
TRANSFERRED
CONVERTED_TO_IP
LEFT
NO_SHOW
CANCELLED
```

`ADMIT` currently records an admission decision while retaining `READY_FOR_DISPOSITION`. P3-5 owns the atomic Emergency-to-IP conversion and the final `CONVERTED_TO_IP` transition.

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

The production web build retains the existing bundle-size and mixed dynamic-import warnings; they do not fail the build and are not introduced by the Emergency workflow.

## Runtime Verification

Verified against the configured MongoDB database and the current checkout on API port `4001`:

- Provisional encounter registration persisted as `WAITING_FOR_TRIAGE`.
- Later Patient linking retained one Patient record and added an EMR event.
- Triage progressed to `WAITING_FOR_DOCTOR`; an authorized priority override changed the effective priority to `LEVEL_1_CRITICAL`.
- Calling and doctor evaluation progressed to `IN_CONSULTATION` and `READY_FOR_DISPOSITION`.
- A Laboratory request persisted with `source_type=EMERGENCY_ENCOUNTER` and the correct encounter source ID, and appeared in the existing Laboratory queue.
- An invalid catalogue service was rejected before downstream persistence.
- Discharge with an unbilled downstream request was rejected fail-closed.
- A no-charge encounter discharged with billing status `NO_CHARGES_RECORDED`.
- Mark-left and cancellation produced terminal states.
- A stale transition returned HTTP `409`.
- A cross-branch encounter lookup returned HTTP `404`.
- The Patient timeline contained seven Emergency events for the verification patient.
- The audit log contained 15 Emergency events from the runtime verification.
- The queue endpoint returned operational fields only and omitted consultation, order, disposition, vitals, and clinical note payloads.

Closed verification encounters remain in MongoDB as auditable test evidence; none is active in the queue.

## Manual Test Steps

Use the current isolated runtime at `http://localhost:5174` with API `http://localhost:4001/api`. If port `4000` is restarted with this checkout, the normal `http://localhost:5173` configuration may be used instead.

1. Sign in as a user with Emergency encounter permissions and open **Emergency > Dashboard**.
2. Confirm the KPIs show persisted values or zero values and do not use prototype records.
3. Open **Emergency > Queue** and confirm loading, empty, and error states render correctly when applicable.
4. Register an existing Patient with branch, clinical department, arrival mode, and chief complaint. Confirm the encounter appears as **Waiting for Triage** after refresh.
5. Register an unknown Patient using provisional identity. Confirm no new Patient record is created.
6. Open the provisional encounter, select **Link Patient**, search an existing Patient, link it, refresh, and confirm the MRN replaces the provisional identity label.
7. Complete triage with a level, area, vitals, pain score, and ABCDE assessment. Confirm the status becomes **Waiting for Doctor**.
8. As a user with override permission, change the effective priority with a reason. Confirm the queue reorders by effective priority and arrival time.
9. Click **Call**, select a doctor from the encounter department, save the evaluation, and confirm a second save from a stale state is rejected.
10. Add one Laboratory or Imaging request from the active Service Catalogue. Confirm it appears in the respective existing downstream queue with Emergency source context.
11. Try a downstream request before linking a Patient or before doctor evaluation. Confirm it is rejected and no downstream record is created.
12. Add a Pharmacy request and confirm it appears in the existing Pharmacy prescription queue. Do not dispense stock as part of this phase.
13. Attempt to discharge an encounter with unclosed downstream charges. Confirm discharge is blocked.
14. On an encounter without downstream charges, complete evaluation and discharge with summary and instructions. Confirm terminal status and `NO_CHARGES_RECORDED` billing status.
15. On separate eligible encounters, test **Skip / Return to Queue**, **Mark No Show**, **Mark Left**, **Cancel Encounter**, and **Transfer** with required reasons.
16. Select **ADMIT** and confirm the encounter remains conversion-ready rather than creating an inpatient admission. P3-5 will complete this integration.
17. Sign in as reception, nurse, and doctor users. Confirm actions are hidden according to permission and direct unauthorized API attempts return HTTP `403`.
18. Use a user without the encounter branch or department assignment. Confirm the encounter cannot be listed or opened.
19. Open the Patient EMR timeline and Administration audit log. Confirm Emergency events, actors, timestamps, source IDs, transitions, and reasons are present without clinical note bodies in audit metadata.
20. Test desktop and mobile widths. Confirm tables scroll safely, forms remain usable, text does not overlap, and the application shell does not remount during navigation.

## Phase Boundary

P3-4 covers Emergency core workflow and downstream order initiation. It does not implement:

- Emergency-to-IP admission creation or bed allotment.
- Emergency conversion idempotency and rollback.
- Laboratory result-entry or Imaging report-entry storage adapters for Emergency source records.
- Billing internals, Pharmacy stock confirmation, or downstream module redesign.

Those boundaries remain assigned to P3-5 or the owning downstream phases.

## Exit Gate

Emergency encounters can progress from known or provisional registration through triage, doctor care, downstream order initiation, and safe terminal or conversion-ready disposition with live MongoDB persistence, RBAC, scope checks, audit, and EMR history.

**P3-4 is complete. Stop here until P3-5 is explicitly approved.**
