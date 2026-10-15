# HMS Ophthalmology OPD Phase 4 Gap Note

**Date:** 15 October 2026  
**Phase:** 4 - Test assignment, station queue, lifecycle, repeat, and handoff  
**Status:** COMPLETE - AWAITING PHASE 5 APPROVAL

## Approved scope

Phase 4 implements the operational Ophthalmology test-task aggregate governed by DEC-04, DEC-05, DEC-07, DEC-09, and DEC-12. It includes idempotent configured task creation, order-item references, station/user assignment, paginated station queues, patient call/start/unavailable actions, reasoned cancellation and unable-to-perform handling, linked repeat creation, next-task station handoff, doctor-review routing, optimistic concurrency, scope, audit, and read projections. Clinical result forms, result completion/submission/review, device imports, consultation completion, frontend screens, dashboards, and Phase 5+ workflows are excluded.

## Existing functionality reused

- Phase 2 Ophthalmology context, active test catalogue configuration, workflow profile, stations, devices, memberships, permissions, scope, audit, and transaction infrastructure.
- Existing OPD visit and clinical-order records. Laboratory and imaging orders/results remain authoritative; an Ophthalmology task may reference an exact submitted order item but never mutates the shared order or result lifecycle.
- Existing active User/Role/Permission and Ophthalmology department assignments for server-derived performer eligibility.
- Existing queue/list response conventions, MongoDB transaction helper, audit model, and standard API error envelope.
- Existing web laboratory/imaging queue hooks and HMS Local OPD/laboratory/imaging queue patterns were inspected for future frontend compatibility. No frontend or prototype file is changed in this backend phase.

## Missing contracts and explicit boundaries

1. No real-time technician shift/availability contract exists. Eligibility is active user + branch + Ophthalmology department + active station membership + `Ophthalmology Test Queue / Start`; the API does not claim schedule availability.
2. No Phase 4 clinical form is approved. Task transitions to `DRAFT`, `COMPLETED`, `SUBMITTED_FOR_REVIEW`, or `REVIEWED` remain reserved for Phases 5-7 result services and are not exposed by Phase 4 queue actions.
3. Shared laboratory/imaging task references are operational links only. Shared modules own their order/result status and Phase 4 rejects any attempt to use an Ophthalmology queue action to change those records.
4. `Patient Unavailable` is not an approved persisted task status. The action is an audited `PATIENT_CALLED -> PATIENT_WAITING` return with a required reason. A patient leaving the encounter remains an existing OPD outcome; pending tasks must be cancelled individually under the approved task transition.
5. `Device Unavailable` is not a task status. Before work starts, use reasoned reassignment. After work starts, use `UNABLE_TO_PERFORM` and doctor-review/repeat handling. Phase 4 does not invent a scheduling subsystem.
6. `Doctor Review` is a routing target, not a status. The task retains its approved status and exposes an indexed `doctor_review_required` flag and routing history.
7. Phase 4 does not auto-advance the specialty encounter overlay because preliminary tests and clinician-ordered tests can occur at different encounter stages. Later result/doctor-review phases own the configured context transitions.

## Frozen Phase 4 contract

### Task identity and source

- One POST creates one task and requires the `Idempotency-Key` header. Repeating the same key and normalized payload returns the existing task; a different payload returns `OPHTHALMOLOGY_IDEMPOTENCY_CONFLICT`.
- Every task snapshots patient, visit/context, branch, department, configured test code/name, catalogue version, optional workflow stage, laterality, priority, instructions, and source.
- Source is `WORKFLOW` or `CLINICAL_ORDER_ITEM`. An order-item source requires both the existing order ID and embedded item ID and must match the same visit, patient, branch, submitted-or-later state, and configured test code reference.
- A supplied workflow stage must exist in the context's bound workflow profile and contain the selected test code. Omitting a stage represents an authorized additional/ad-hoc configured test.
- Task priority is `ROUTINE | PRIORITY | EMERGENCY`. Laterality uses the approved task subset `OD | OS | OU | NOT_APPLICABLE`.

### Persisted lifecycle

`ORDERED -> PATIENT_WAITING -> PATIENT_CALLED -> IN_PROGRESS <-> DRAFT -> COMPLETED -> SUBMITTED_FOR_REVIEW -> REVIEWED`

Controlled Phase 4 actions:

- Assign: `ORDERED -> PATIENT_WAITING` with active station, optional eligible user, assignment timestamp, and history.
- Reassign: preserves `PATIENT_WAITING | PATIENT_CALLED | DRAFT`, requires reason, and records before/after station/user. It is rejected for `IN_PROGRESS` and finalized statuses.
- Call: `PATIENT_WAITING -> PATIENT_CALLED`.
- Patient unavailable: `PATIENT_CALLED -> PATIENT_WAITING` with required reason and queue-event history.
- Start: `PATIENT_CALLED -> IN_PROGRESS`, requires the assigned eligible actor and validates any selected device as active and calibration-current/not-required.
- Unable to perform: `IN_PROGRESS | DRAFT -> UNABLE_TO_PERFORM`, requires reason, and creates doctor-review routing metadata.
- Cancel: `ORDERED | PATIENT_WAITING | PATIENT_CALLED | DRAFT -> CANCELLED`, requires reason.
- Request repeat: `COMPLETED | SUBMITTED_FOR_REVIEW -> REPEAT_REQUIRED` and atomically creates exactly one linked repeat task in `PATIENT_WAITING` at a validated active station. The original task/result is never overwritten.
- Handoff: a `COMPLETED | REVIEWED` source can atomically assign an existing `ORDERED` task from the same context to the next station; `UNABLE_TO_PERFORM` can route directly to doctor review. Routing does not invent a task status.

Every mutation requires exact `expected_status` and `expected_version`. Repository updates are conditional and stale actions return `409`.

### Queue and scope

- Lists are paginated and support branch, station, assigned user, status, test code, priority, source, visit/patient, search, sort, and direction filters.
- List/detail results are restricted to the actor's authorized branches and active Ophthalmology station memberships, or tasks explicitly assigned to the actor. Doctor-review tasks are additionally visible to an eligible mapped Ophthalmologist.
- Assignment/reassignment revalidates active station, supported test code, branch/department, active user, station membership, and queue-start permission immediately before writing.
- Call and start require active station membership; start additionally requires the actor to be the assigned performer.
- Queue list projections contain operational identity/status fields only and exclude complaint/history/result payloads.

### API and permissions

- `GET /api/ophthalmology/test-tasks` - Test Queue View.
- `GET /api/ophthalmology/test-tasks/:id` - Test Queue View.
- `POST /api/opd/visits/:visitId/ophthalmology/test-tasks` - Consultation Edit plus required `Idempotency-Key`.
- `POST /api/ophthalmology/test-tasks/:id/assign` - Test Queue Assign.
- `POST /api/ophthalmology/test-tasks/:id/reassign` - Test Queue Reassign.
- `POST /api/ophthalmology/test-tasks/:id/call` - Test Queue Call.
- `POST /api/ophthalmology/test-tasks/:id/patient-unavailable` - Test Queue Call.
- `POST /api/ophthalmology/test-tasks/:id/start` - Test Queue Start.
- `POST /api/ophthalmology/test-tasks/:id/unable` - Test Queue Cancel.
- `POST /api/ophthalmology/test-tasks/:id/cancel` - Test Queue Cancel.
- `POST /api/ophthalmology/test-tasks/:id/request-repeat` - Test Review Request Repeat.
- `POST /api/ophthalmology/test-tasks/:id/route` - Test Queue Reassign.

## Intended files

- Add a Phase 4 test-task model and focused tests under `apps/api/src/modules/ophthalmology/`.
- Extend Ophthalmology types, schemas, repository, service, and routes.
- Update the API contract, execution status documents, and add a Phase 4 verification document after checks pass.
- No frontend, shared laboratory/imaging implementation, permission seed, or HMS Local file is changed.

## Data, index, transaction, audit, and error plan

- Unique `(contextId, idempotencyKey)` task creation and unique non-null `repeatOfTaskId` prevent retry/repeat duplication.
- Queue indexes cover branch/station/status/priority/waiting time, assigned user/status, context/test/status, doctor-review routing, source order item, and repeat links.
- Create, assign/reassign, call/unavailable/start/unable/cancel, repeat creation, and handoff execute task mutation plus safe audit atomically.
- Histories record actor/time/action, before/after state, station/user/device references, and reason where applicable. Audit logs contain identifiers/codes only, not clinical notes or result payloads.
- Use explicit task/configuration/source/station/assignment/scope/status/version/idempotency/device errors.

## Acceptance checks

- Configured task creation, exact retry, conflicting retry, invalid configuration/stage/order item, and duplicate repeat.
- Cross-branch/station, unsupported test, inactive member, missing performer permission, wrong assignee, stale status/version, and inactive/uncalibrated device.
- Valid assign/call/unavailable/start/unable/cancel, reason requirements, assignment history, next-task handoff, doctor routing, and atomic repeat preservation.
- Paginated/filter/sort queue scope and minimized projections.
- Audit and transaction rollback assertions using `MongoMemoryReplSet`.
- Phase 1-3, shared OPD, laboratory/imaging, permission, typecheck, lint-owned-files, build, and full API regressions.

## Stop gate

Phase 5 must not start until Phase 4 implementation, focused tests, contract update, verification report, and owner approval are complete. Clinical result forms and form-specific values remain Phase 5+ configuration dependencies.
