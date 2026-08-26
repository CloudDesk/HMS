# HMS Scope 2 Phase 3 Agent Instructions

## Purpose

This file governs AI/Codex work for the next HMS release described by `HMS_Scope2_Developer1(Kamesh)_Phase_3_Prompts.docx`.

It supplements `PROJECT_RULES.md`. It does not replace or weaken any project rule. When this file is silent, follow `PROJECT_RULES.md` and the existing implementation.

## Mandatory Source Order

Before implementing a phase, read and reconcile these sources in order:

1. `PROJECT_RULES.md` for architecture, security, data, UI/UX, testing, and completion rules.
2. `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md` for dependency order, phase boundaries, acceptance criteria, and stop gates.
3. `HMS_Scope2_Developer1(Kamesh)_Phase_3_Prompts.docx` for Developer 1 ownership and functional intent.
4. `doc/HMS_Release2_FSD.docx` when it becomes available, for final workflow fields, statuses, prerequisites, and business rules.
5. Existing code under `apps/api` and `apps/web` for actual contracts and architecture.
6. Matching prototypes under `scope/HMS Local` for UI and interaction patterns only.

Do not modify `scope/HMS Local`.

## Source Clarifications

- The supplied filename says Phase 3, while the document title says HMS Phase 2. Treat this work as **Scope 2 Phase 3 / next release** until the owner confirms different release naming.
- The prompt references `doc/HMS_Release2_FSD.docx`, but that file was not present during planning on 21 August 2026.
- Do not finalize new lifecycle enums, configurable consent/deposit rules, temporary-patient rules, or surgery conflict rules from assumptions. Record the missing decision in P3-0 and use an approved contract before feature implementation.
- Existing backend contracts take precedence over prototype mock behavior. Prototype data, local arrays, and `localStorage` must never become production functionality.

## Developer 1 Ownership

Developer 1 owns:

- IP ward, room, bed, hold, allotment, transfer, release, availability, and bed-board workflows.
- IP recommendation, admission request, patient validation, admission confirmation, and encounter conversion.
- Surgery/procedure recommendation, referral, booking, schedule, reschedule, cancellation, and status lifecycle.
- Emergency registration, queue, assessment, doctor evaluation, disposition, discharge, abandonment, and IP conversion.
- Integration and validation of the above workflows.

Developer 1 may integrate with, but must not reimplement, these existing domains:

- Patients and patient documents/consents.
- Doctors, departments, availability, appointments, and OPD encounters.
- Pharmacy and inventory.
- Laboratory and imaging.
- Billing and payments.
- EMR timeline and audit infrastructure.

If an integration contract is missing, document the dependency. Do not create a duplicate subsystem.

## Current Repository Baseline

Reuse these foundations before creating anything:

- `admissions-configuration`: branch-scoped ward/bed CRUD, status, availability filtering, summaries, indexes, RBAC, and audit events.
- `inpatient-admissions`: branch-scoped list/get/create and atomic initial `AVAILABLE -> OCCUPIED` bed assignment.
- Patient search, registration, profile, documents, consent metadata, and timeline.
- Doctor directory, department mapping, availability, appointments, and OPD encounters.
- Pharmacy dispensing/inventory, laboratory, imaging, and billing APIs.
- HMS Local admission, inpatient, bed, and Emergency prototypes.

Known partial or missing areas:

- No complete bed hold, allotment history, transfer, release, cleaning, or bed-board workflow.
- Inpatient admission currently supports only list/get/create and a limited `DRAFT | ADMITTED | CANCELLED` contract.
- Active-admission uniqueness, admission cancellation, recommendation/request, configured consent, advance deposit, encounter conversion, and admission timeline integration are incomplete.
- `InpatientAdmissionPage.tsx` contains mock-derived source/status presentation that must be removed when P3-2 is implemented.
- No dedicated surgery/procedure backend domain exists.
- No dedicated Emergency backend or live React workflow exists; its sidebar module remains deferred.
- Billing is visit-oriented and does not yet expose an approved IP advance/deposit contract.

## Mandatory Phase Workflow

For every phase:

1. Inspect the relevant backend models, repositories, services, routes, schemas, permissions, indexes, and audit patterns.
2. Inspect the relevant frontend API clients, services, domain hooks, feature hooks, routes, permission gates, and reusable UI components.
3. Inspect the matching HMS Local HTML/CSS/JS without modifying it.
4. Write a phase gap note listing reusable code, missing contracts, shared dependencies, and intended files.
5. Implement only the approved phase.
6. Keep database access in repositories and business/state-transition rules in services.
7. Use MongoDB transactions for multi-document bed, admission, booking, discharge, billing, or encounter state changes.
8. Add or update permissions, branch/department scope, indexes, validation, error codes, audit events, and pagination.
9. Connect the React UI through feature/domain hooks and live APIs. Remove all mocks from completed screens.
10. Run automated checks and browser/manual tests.
11. Update the phase plan and add a phase verification document.
12. Stop and wait for explicit approval before starting the next phase.

## Cross-Domain Safety Invariants

- One bed may have at most one active hold/allotment/occupancy according to the approved lifecycle.
- Bed availability must be revalidated immediately before every hold, allotment, transfer, or confirmation.
- A patient may not have a duplicate active IP admission unless the approved FSD explicitly allows it.
- Occupied, reserved/held, blocked, maintenance, inactive, or cleaning beds are not available for new allotment.
- Multi-document state changes must either commit completely or roll back completely.
- A failed or cancelled draft admission must not leave a bed occupied.
- Transfer must atomically release the previous assignment and occupy the destination while preserving history.
- Discharge/release and any reversal require validated transitions, permissions, reason where applicable, and audit history.
- Patient, encounter, admission, recommendation, procedure, order, invoice, and bed references must remain consistent.
- Emergency downstream orders must retain their Emergency encounter/source context.
- Mandatory consent or advance-payment rules must be enforced by the backend from approved configuration, not frontend flags.
- Frontend branch, department, permission, payment, consent, or status values are never authoritative.
- Restricted patient and clinical data must not be logged or overexposed in list responses.

## Status and Concurrency Rules

- Define explicit transition maps in the domain service before exposing status actions.
- Reject stale state transitions with conflict responses; do not silently overwrite them.
- Use conditional repository updates, version fields, partial unique indexes, idempotency keys, or transactions where the existing domain pattern requires them.
- Preserve before/after state, actor, reason, timestamp, source context, and affected resource IDs in audit records.
- Do not allow UI-only transition validation to substitute for backend validation.

## Frontend Execution Rules

- Follow `Page -> Feature Hook -> Domain Hook -> Domain Service -> API Client -> Backend`.
- Cross-domain admission, surgery, and Emergency orchestration belongs in feature hooks that compose domain hooks.
- Keep page, filter, tab, sort, and search state in URL query parameters.
- Gate queries by permission and required context. Fetch modal-only lookups only when the modal opens.
- Use React Hook Form with Zod schemas aligned to backend contracts.
- Provide loading, empty, error, success, permission-denied, stale/conflict, and retry states.
- Use HMS Local admission, inpatient, appointment, OPD, and Emergency patterns. Do not create a new visual system.
- Use explicit text plus status color/icon for critical states.
- Confirm destructive, release, cancellation, conversion, and transfer actions.
- Use top-right Sonner notifications and red required-field asterisks as required by `PROJECT_RULES.md`.

## Required Verification

Run after every phase:

```bash
npm run typecheck --workspace=@hms/api
npm run lint --workspace=@hms/api
npm run build --workspace=@hms/api
npm run typecheck --workspace=@hms/web
npm run lint --workspace=@hms/web
npm run build --workspace=@hms/web
```

Also run focused tests for:

- Permissions and branch/department scope.
- Invalid and stale state transitions.
- Duplicate active records.
- Concurrent bed selection or booking.
- Transaction rollback and idempotent retry.
- Consent/payment prerequisites when configured.
- Audit and EMR timeline events.
- Persistence after logout and login.
- Responsive browser workflows using live APIs.

Do not mark a phase complete while typecheck, lint, build, required tests, or live manual acceptance fail. If a pre-existing unrelated failure remains, document it precisely and prove the phase-owned files are clean.

## Working Tree and Shared Files

- Never revert or overwrite another developer's changes.
- Before editing shared registries, permission seeds, router/navigation, shared types, patient timeline enums, or service registries, inspect current changes and keep the edit minimal.
- Do not refactor Developer 2 modules while integrating with them.
- Report every required shared-file change in the phase completion note.
- Do not edit generated artifacts such as `tsconfig.tsbuildinfo` manually.

## Completion Report Format

At the end of each phase, report only:

- Implemented functionality.
- Existing functionality reused.
- Files/modules changed, including shared files.
- Backend validation, transaction, permission, scope, audit, and error handling.
- HMS Local UI patterns reused.
- Automated checks and manual tests completed.
- Remaining dependency or clarification for the next phase.
- Confirmation that the next phase has not started.

## Stop Conditions

Stop and report instead of guessing when:

- The required FSD contract is absent or conflicts with approved code/contracts.
- A required Developer 2 API or configuration does not exist.
- A lifecycle, payment, consent, temporary-patient, or cross-branch rule is ambiguous and affects patient safety or data integrity.
- A requested change requires new architecture, database technology, permission infrastructure, or a major shared-layout refactor.
- Live backend persistence is unavailable and the only alternative would be mock data.

