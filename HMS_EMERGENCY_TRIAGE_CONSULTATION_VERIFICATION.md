# Emergency Triage-to-Consultation Verification

**Date:** 4 September 2026  
**Scope:** Emergency Workspace `Complete Triage → Consultation`

## Implemented functionality

- `POST /api/emergency/encounters/:id/triage` now completes the existing approved lifecycle in one MongoDB transaction:
  - persists triage data and transitions to `WAITING_FOR_DOCTOR` with action `TRIAGED`;
  - transitions from `WAITING_FOR_DOCTOR` to `IN_CONSULTATION` with action `CALLED`.
- Both transitions preserve their real previous and next states in queue history.
- Both `emergency.triage.completed` and `emergency.encounter.called` audit events are written in the same transaction.
- The existing patient EMR triage event remains linked to the persisted triage.
- The triage route accepts any one of the existing permissions:
  - `Emergency / Triage / Assess`;
  - `Emergency / Consultation / Edit`;
  - `Emergency / Encounters / Edit`.
- Branch authorization remains enforced by the Emergency service. A user's unrelated primary department is not used to reject Emergency work.
- Frontend capability gating matches the backend any-of permission contract, including an authorized Emergency doctor with Consultation Edit.
- Client-side pain-score and vital-sign ranges now match the backend Zod schema.
- Numeric form values, including pain-score radio values, are normalized before Zod validation so browser string values are submitted as numbers.
- If an earlier attempt already persisted triage and left the encounter in `TRIAGED` or `WAITING_FOR_DOCTOR`, the same completion action safely resumes from that approved intermediate state, updates the submitted triage record, and enters `IN_CONSULTATION` without adding a duplicate triage queue step.
- Invalid client submissions display the first meaningful validation message instead of appearing unresponsive.
- The successful mutation writes the returned `IN_CONSULTATION` encounter to the detail cache, awaits targeted Emergency list/summary invalidation, shows a success toast, and then opens Consultation.

## Existing functionality reused

- Emergency API endpoint, service, repository transition primitive, lifecycle states, branch scope, queue history, audit infrastructure, patient timeline, API error envelope, React Hook Form, Zod, Sonner, and TanStack Query keys.
- HMS Local Triage-to-Consultation tab progression pattern.

## Files changed for this correction

- `apps/api/src/modules/emergency/emergency.routes.ts` — existing-permission any-of authorization for triage completion.
- `apps/api/src/modules/emergency/emergency.service.ts` — atomic triage persistence and consultation entry with history/audit records.
- `apps/api/test/emergency-triage-consultation.test.ts` — service, lifecycle, branch, validation, and permission regression coverage.
- `apps/web/src/hooks/emergency/useEmergency.ts` — await targeted list/summary invalidation after updating detail cache.
- `apps/web/src/hooks/emergency/useEmergencyWorkspaceFeature.ts` — expose existing Encounters Edit capability.
- `apps/web/src/components/emergency/EmergencyTriageSection.tsx` — aligned authorization, validation feedback, and completion success behavior.
- `apps/web/src/pages/EmergencyWorkspacePage.test.tsx` — authorized doctor visibility and successful submit/tab-transition coverage.
- `HMS_EMERGENCY_TRIAGE_CONSULTATION_GAP_NOTE.md` — scoped pre-implementation gap note.
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md` — correction status and evidence link.
- This verification document.

The worktree already contained unrelated Emergency Queue, calling authorization, RBAC, page, component, and documentation changes. They were preserved and were not reverted or claimed as part of this correction.

## Automated verification

Passed:

```text
npm run typecheck --workspace=@hms/api
npm run typecheck --workspace=@hms/web
npm run lint --workspace=@hms/api
npm run lint --workspace=@hms/web
npm run build --workspace=@hms/api
npm run build --workspace=@hms/web
```

Focused backend command:

```text
node --import tsx --test apps/api/test/emergency-triage-consultation.test.ts
```

Result: 5 passed, 0 failed. Coverage includes atomic two-step transition, triage persistence, real history/audit states, repeated/non-actionable rejection, branch denial, invalid vitals, nurse/doctor/encounter-editor permission acceptance, and unauthorized `PERMISSION_REQUIRED` denial.

Focused frontend command:

```text
npx vitest run apps/web/src/pages/EmergencyWorkspacePage.test.tsx apps/web/src/hooks/emergency/useEmergency.test.tsx apps/web/src/hooks/emergency/useEmergencyWorkspaceFeature.test.tsx --pool=threads --maxWorkers=1
```

Result: 3 files passed; 11 tests passed, 0 failed. Coverage includes authorized doctor access to the completion action, successful triage submission before tab progression, payload forwarding, detail cache update, and targeted queue/summary refresh.

An initial combined Vitest run using the default fork pool timed out while starting web test workers and ran no tests. The same web tests were rerun with one thread and passed as reported above.

## Live HTTP API and MongoDB verification

- `/api/health` returned `200` with service status `ok`.
- `/api/health/db` returned `200` with database status `ok`.
- An authenticated Emergency encounter was created through the live API.
- The production triage endpoint was called with valid triage, vital-sign, and ABCDE data.
- The endpoint succeeded and a subsequent detail read confirmed:
  - persisted status `IN_CONSULTATION`;
  - triage data remained persisted;
  - queue history included:

```text
WAITING_FOR_TRIAGE -> WAITING_FOR_DOCTOR : TRIAGED
WAITING_FOR_DOCTOR -> IN_CONSULTATION    : CALLED
```

- Active runtime verification encounters were closed through valid Emergency lifecycle actions.

## Manual browser acceptance

Not completed. The browser-control runtime reported that no browser was available, so the actual click sequence from Emergency Queue through the rendered Workspace could not be executed in this session. The live API/database transition and frontend interaction tests pass, but this correction must not be called fully complete under the supplied acceptance definition until an authorized nurse and authorized Emergency doctor each perform the real browser workflow and the Network panel confirms the successful request and refreshed Queue/Workspace state.

## Remaining acceptance

- Run the rendered browser flow as an authorized Emergency/Triage Nurse.
- Repeat as an authorized Emergency doctor whose primary department differs from Emergency.
- Confirm an unauthorized user receives `403 PERMISSION_REQUIRED` in the live browser/API session.
- Capture the Network request/response and confirm the Queue and Workspace show `IN_CONSULTATION` without stale state.

No subsequent phase or unrelated Emergency workflow was started.
