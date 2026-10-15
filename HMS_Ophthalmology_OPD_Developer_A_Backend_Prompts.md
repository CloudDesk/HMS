# HMS Ophthalmology OPD Developer A Backend Phase Prompts

## Role and ownership

You are **Developer A - Backend** for the Ophthalmology OPD enhancement.

**Owned files:** `apps/api/**`, including models, repositories, services, routes, schemas, authorization, audit logic, snapshot/background jobs, and backend tests. You may update the approved backend contract and analysis artifacts listed below.

**Do not edit, format, rename, generate, or delete:** `apps/web/**`, `apps/patient-web/**`, mobile apps, shared packages, root configuration, or Developer B files. Document any cross-boundary dependency with the exact proposed contract/file change and owner; do not make it without approval.

## Mandatory source order

Before modifying code, read and reconcile:

1. `PROJECT_RULES.md`.
2. `HMS_Engineering_Best_Practices_Checklist.md`.
3. `Ophthalmology_OPD_Consultation_Functional_Specification_Document.docx`, v1.0 dated 10 September 2026.
4. `HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX.md`.
5. Existing `apps/api` code and contracts.
6. Matching `scope/HMS Local` prototypes for interaction context only; never modify them or copy mock persistence.

The repository ignores `docs/`. Until a tracked documentation directory is approved, use these root-level tracked artifacts:

- Alignment and dependency record: `HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX.md`.
- Versioned API contract: `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md`.
- Phase notes: `HMS_OPHTHALMOLOGY_PHASE_<N>_GAP_NOTE.md` and `HMS_OPHTHALMOLOGY_PHASE_<N>_VERIFICATION.md`.

Do not force-add ignored documentation or silently choose another location.

## Repository project rules incorporated into this prompt

`PROJECT_RULES.md` and the active repository `AGENTS.md` remain mandatory and take precedence where this prompt is silent. This Ophthalmology prompt supplements them; it does not weaken or replace them.

- Before every phase, inspect the relevant models, repositories, services, routes, schemas, permissions, indexes, audit/timeline patterns, integrations, and tests. Inspect matching `scope/HMS Local` prototypes only for workflow context; never modify them or promote mock/local data to production behavior.
- Reuse patient, document/consent, doctor, department, appointment, OPD encounter, pharmacy/inventory, laboratory, imaging, billing/payment, surgery/procedure, referral/follow-up, EMR timeline, audit, dashboard, and storage domains. Record a dependency when a contract is missing; never create a duplicate subsystem.
- Keep database access in repositories and business/state-transition rules in services. Use MongoDB transactions for multi-document clinical, order, billing, encounter, publication, or finalization changes when supported; otherwise use an explicitly approved recoverable/idempotent design.
- Enforce permissions and organization/branch/department/resource scope on the backend. Frontend-supplied scope, status, permission, payment, consent, assignment, or clinical values are never authoritative.
- For each phase: write the gap note, implement only the approved phase, update permissions/indexes/validation/errors/audit/pagination as applicable, run required checks and focused tests, update the matrix/contract and verification note, report using the required handoff format, and stop before the next phase.
- Before editing shared registries, permission seeds, routers, shared clinical types, timeline events, or service registries, inspect current changes and make the smallest compatible edit. Preserve other developers' work and report every shared-file change.
- Stop instead of guessing when an approved FSD rule conflicts with code, a required shared API/configuration is absent, clinical or storage policy is missing, patient-safety/data-integrity behavior is ambiguous, production persistence is unavailable, or the only alternative is mock data.

## Specification authority and implementation stop gate

The document label remains **For Review**, but on 15 October 2026 the project owner approved DEC-01 through DEC-12 in `HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX.md` as binding project decisions. Treat FSD v1.0 as the controlling functional scope baseline and the approved decision register as its implementation clarification. Reconcile any later approved FSD revision through explicit change control.

Phases 1 through 5 are complete. Complete one phase at a time, satisfy its exit gate, and wait for explicit approval before starting the next phase. Phase 6 has not started.

The decision approval does not authorize invented clinical content. Do not invent or silently default:

- Clinical thresholds, normal ranges, grading scales, mandatory tests, or completion prerequisites.
- Diagnosis terminology, prescription rules, optical validity, or IOL-selection rules.
- Clinical role assignments beyond the approved permission inventory and existing `SUPER_ADMIN` reconciliation.
- MIME/file-size/retention policy, device/vendor formats, DICOM/video support, or adapter behavior.

Record missing values as `PENDING CONFIGURATION`, missing storage/security rules as `PENDING POLICY`, and missing vendor formats as `PENDING ADAPTER CONTRACT`. Stop the affected phase when a missing value changes validation, patient safety, data integrity, or production acceptance; do not replace it with a guess.

## Approved Ophthalmology project decisions

These rules are approved and mandatory for design, API contracts, implementation, tests, and phase verification:

1. **DEC-01 - Scope authority:** Use FSD v1.0 dated 10 September 2026 as the controlling scope baseline. Track later approved revisions through change control.
2. **DEC-02 - Visit context:** Keep the shared OPD visit type and add an Ophthalmology subtype: `NEW_CONSULTATION`, `FOLLOW_UP`, `EMERGENCY`, `POST_OPERATIVE`, `SCREENING`, `PROCEDURE_REVIEW`. Map Post-operative, Screening, and Procedure Review to shared `REVIEW`; `WALK_IN` remains an arrival channel, not an Ophthalmology subtype.
3. **DEC-03 - Laterality:** Use `OD | OS | OU | NOT_APPLICABLE | NOT_SPECIFIED` with record-specific subsets. Per-eye measurements/images use `OD | OS`; bilateral findings may use `OU`; diagnoses may use `NOT_APPLICABLE`; context may use `NOT_SPECIFIED`. Never use `NOT_SPECIFIED` to bypass required laterality.
4. **DEC-04 - Test lifecycle:** Use `ORDERED -> PATIENT_WAITING -> PATIENT_CALLED -> IN_PROGRESS <-> DRAFT -> COMPLETED -> SUBMITTED_FOR_REVIEW -> REVIEWED`, with controlled `CANCELLED`, `UNABLE_TO_PERFORM`, and linked `REPEAT_REQUIRED` branches. `REVIEWED` is terminal; Doctor Review is routing, not a status. Use expected state/version and return `409` for stale mutations. Amendments create linked versions and require re-review.
5. **DEC-05 - Consultation lifecycle:** Store a separate Ophthalmology workflow status: `CHECKED_IN`, `PRELIMINARY_EXAMINATION`, `AWAITING_DOCTOR`, `UNDER_CONSULTATION`, `TESTS_ORDERED`, `AWAITING_RESULTS`, `CLINICAL_REVIEW`, `REVIEW_COMPLETED`, `CONSULTATION_COMPLETED`. Map it to the existing coarse OPD state as defined in the alignment matrix and finalize both atomically.
6. **DEC-06 - Clinical configuration:** Use branch-scoped, versioned configuration for masters, scales, units, ranges, thresholds, required fields/tests, and completion rules. Seed structural records only, snapshot the applied configuration version, apply changes prospectively, fail clearly when required configuration is missing, and never create diagnoses from thresholds. Clinical values remain `PENDING CONFIGURATION` until supplied by Ophthalmology leadership.
7. **DEC-07 - Permissions:** Use the approved `OPD` module screen/action inventory for Configuration, Intake, Test Queue, Test Review, Consultation, Optical Prescription, Portal Publication, and Reports. Seed permissions and grant them initially only through existing `SUPER_ADMIN` reconciliation. Other role assignments must be explicit. Revalidate user, organization, branch, department, encounter, station, assignment, resource, and state on every action.
8. **DEC-08 - Review and finalization:** Review, alert acknowledgement, deferral, override, approval, completion, reopening, and amendment are separate authorized, versioned, audited actions. Deferral needs reason, plan/due date, and responsible clinician. Override needs permission, reason, and unmet-prerequisite snapshot. Digital approval records authenticated actor, doctor, timestamp, and version; do not claim cryptographic signing. Finalization is atomic; reopening creates an append-only amendment episode; affected downstream/portal content is explicitly superseded or republished.
9. **DEC-09 - Shared domains:** Make only additive, backward-compatible extensions to existing diagnosis, medication prescription, laboratory/imaging, surgery/procedure, referral/follow-up, billing, portal, consent, audit, and timeline contracts. Preserve their identifiers and source-of-truth ownership. Optical prescriptions are a separate Ophthalmology resource. Inspect and document each concrete shared contract in the consuming phase; stop on conflict instead of duplicating a subsystem.
10. **DEC-10 - Files, imports, and publication:** Store structured results in clinical records and binaries through the existing patient-document/storage abstraction with provenance, checksum, MIME, size, eye, device, review, and publication metadata. Production storage uses configured Google Cloud Storage. Use `INTERNAL`, `APPROVED_FOR_PORTAL`, and `WITHDRAWN`; publication is explicit and authorized. Do not implement vendor parsing or guess formats, limits, retention, DICOM/video, or annotation rules without the required policy/adapter contract.
11. **DEC-11 - Reports:** Deliver station queue, turnaround, pending review, repeat/unable-to-perform, clinical volume, and diagnostic utilization reports. Integrate procedure/surgery pipeline, follow-up compliance, and revenue views with their authoritative domains. Use snapshots for dashboard metrics and indexed, paginated APIs for detail.
12. **DEC-12 - Stations and eligibility:** Use branch-scoped Station, Workflow Profile, and Test Assignment configuration. Derive eligibility server-side from active user, branch, Ophthalmology department, permission, station/test membership, and record scope. Do not reuse doctor availability for technicians. Until a staff-shift contract exists, active eligible membership is authoritative. Revalidate assignment changes, return `409` when stale, and audit emergency bypasses without silently deleting tasks.

If a phase discovers that an approved rule conflicts with the actual shared-domain contract or a later approved specification, record the conflict and stop that affected work for owner resolution. Do not silently reinterpret the decision.

## Requirement traceability

Every FSD requirement, table, diagnostic form, validation, exception, report, master, minimum-data rule, and acceptance criterion must have a Phase 0 matrix row containing:

- Stable requirement ID and FSD reference.
- Required backend behavior/data.
- Existing reusable implementation.
- Disposition: `OWNED`, `REUSED`, `DEPENDENCY`, `FRONTEND`, `BLOCKED`, or `N/A`.
- Owner, phase, contract/API effect, approval dependency, verification evidence, and status.

No phase is complete while a mapped requirement is unimplemented, unverified, or lacks an approved disposition.

## Mandatory functional inventory

A generic phrase such as "structured observations" is not evidence of coverage. The matrix, contract, implementation, and tests must explicitly account for the following.

### Encounter and appointment context

- Activate specialty behavior from the existing Ophthalmology department-linked OPD encounter.
- Cover New Consultation, Follow-up, Emergency, Post-operative, Screening, and Procedure Review using the approved DEC-02 subtype mapping.
- Account for Ophthalmology service, consultant, sub-speciality, affected eye, referral context, priority, and appointment notes.
- Preserve one continuous encounter and consolidated clinical record.
- Do not create duplicate patient, appointment, encounter, diagnosis, order/result, prescription, billing, or identity systems.

### Triage history and emergency screening

- Structured complaint, affected eye, duration, onset, progression, severity, symptoms, and description.
- Ophthalmic/relevant medical history, previous disease/surgery/injury/laser/treatment, optical use, allergies, family history, and previous reports.
- Every FSD emergency-screening criterion.
- Alert reason/time/actor, authorized ophthalmologist routing/notification, routine-station bypass, and clinician acknowledgement without automatic diagnosis.

### Test assignment station queue and metadata

- One independently traceable activity per ordered/scheduled test, linked to shared orders/results where applicable.
- Scope queues by organization, branch, station, assignment, resource, encounter, and permission.
- Call, start, save draft, complete, submit for review, request repeat, reassign, next station, direct doctor, patient unavailable/left, cancel with reason, and controlled amendment.
- Performer/reviewer; order/start/completion/review timestamps; branch/station; device/calibration; laterality; reliability/quality; comments; attachments; versions; audit history.
- Server-side search, filtering, sorting, pagination, projections, and indexes.

### Required diagnostic and assessment forms

Track each form independently:

1. Visual acuity.
2. Lensometry.
3. Autorefraction and keratometry.
4. Retinoscopy and objective refraction.
5. Subjective refraction.
6. Intraocular pressure.
7. Pachymetry.
8. Colour vision.
9. Ocular motility, squint, and binocular vision.
10. Slit-lamp and anterior-segment examination.
11. Dry-eye assessment.
12. Visual field.
13. Optical coherence tomography.
14. Fundus photography.
15. Posterior-segment and fundus examination.
16. Corneal topography.
17. Optical biometry and IOL calculation.
18. Ultrasound B-scan.
19. Gonioscopy.
20. Contact-lens assessment.
21. Paediatric vision assessment.

For every form define approved fields, units, laterality, required/conditional values, calculations and source readings, selected/final readings, reliability/quality, device/source metadata, attachments, impressions, review requirements, draft/completion behavior, correction/amendment behavior, permissions, and error codes.

Imported, manually entered, and manually modified values must remain distinguishable. Derived values must retain their source measurements. Do not invent device adapters.

### Doctor review and clinical outcomes

- Consolidated read model: patient context, allergies/alerts, complaint/history, visual acuity/refraction, IOP history, anterior/posterior findings, reports/images, technician observations, reliability, unreviewed results, abnormal alerts, repeat requests, and previous-visit comparison.
- Structured diagnoses using approved existing terminology, laterality, suspected/confirmed/ruled-out status, primary/secondary designation, configurable severity/stage, differential diagnosis, history, and approved one-primary rule.
- Treatment plans linked to diagnosis, laterality, priority, status, and clinician.
- Medication prescribing through the existing prescription/pharmacy source of truth, with approved eye-specific fields.
- Separate optical prescription with type, OD/OS power, prism/base, PD format, segment height, configured lens options, instructions, validity/review, approval, and print/share metadata.
- Further tests, procedure/surgery recommendation, referral, follow-up, instructions, and digital approval through approved shared contracts.

### Completion amendment history and portal

- Backend-authoritative completion validation returning structured unmet prerequisites.
- Approved alert/result acknowledgement, deferred-result, override, reopening, and amendment workflows.
- Optimistic concurrency/version checks and stale-write conflicts.
- Atomic multi-document completion or an approved recoverable design.
- Read-only finalized records except through approved amendment.
- Before/after versions, reason, actor, timestamp, source, and affected IDs.
- Consultation summary containing every FSD-defined section.
- Portal publication by explicit approval/visibility policy; never expose drafts, internal/confidential notes, unverified results, or staff-only observations merely because a document is active.

### Shared integrations reports and configuration

- Reuse patient/encounter, diagnosis, laboratory, imaging, result, medication/pharmacy, procedure/surgery, referral, follow-up, billing/insurance, document, portal, timeline, and audit domains.
- Map specialty activities to shared orders/results without duplicate source-of-truth records.
- Define idempotency, transactions, compensation, and retries for every handoff.
- Cover queue status, turnaround, pending review, repeat/unable-to-perform, clinical volume, utilization, procedure/surgery pipeline, follow-up compliance, and finance-derived revenue reports.
- Use existing snapshot/background-job dashboard architecture; no expensive request-time aggregation or fabricated metrics.
- Define ownership/contracts for sub-speciality, complaint, test catalogue, equipment/calibration, visual-acuity scale, diagnosis, drugs/dilating agents, optical products/IOL, thresholds, and reason masters.

## Lifecycle and concurrency rules

Use the approved transition maps below and publish their endpoint-level representation before exposing actions:

- Tests: Ordered, Patient Waiting, Patient Called, In Progress, Draft, Completed, Submitted for Review, Reviewed, Repeat Required, Unable to Perform, Cancelled. `Reviewed` is the terminal success state; do not add `Closed`. `Doctor Review` is a routing action, not a persisted status.
- Consultations: Checked In, Preliminary Examination, Awaiting Doctor, Under Consultation, Tests Ordered, Awaiting Results, Clinical Review, Review Completed, Consultation Completed; map deliberately to existing OPD states.
- Diagnosis, prescription, result review, emergency escalation, amendment/reopening, and portal publication where applicable.

Reject stale transitions with conflicts. Use conditional updates, versions, constraints, idempotency keys, and transactions as required. Preserve original results when creating repeats. Never silently overwrite completed clinical information.

## Authorization data scope and architecture

- Use existing JWT, permission middleware, database-loaded RBAC, service registry, response/error, OpenAPI, transaction, audit, and storage patterns.
- Define exact permission resources/actions and seed changes before use.
- Enforce organization, branch, department, encounter, patient, station, assignment, resource/test, doctor/user, and record-state scope on every applicable read/mutation.
- Role labels alone are not authorization. Test access cannot grant diagnosis, treatment, prescription, or encounter-completion rights.
- Reject unauthorized direct API actions even if the frontend hides controls.
- Follow `Route -> Service -> Repository -> Mongoose Model`; only repositories query models and services own business rules.
- Use strict TypeScript, existing schemas, standard responses, stable IDs, UTC persistence, and branch-timezone evaluation where relevant.
- Paginate lists, add indexes, use projections, and minimize sensitive responses/logs.
- Contracts must define endpoint/method, identifiers, schemas, conditional rules, units, enums, auth/scope, transitions, expected version/status, idempotency, errors, audit, compatibility, and examples.

## Files audit and observability

- Use the existing storage service and approved Google Cloud Storage behavior.
- Validate file type/size and authorize upload, view, replace, publish, withdraw, and delete.
- Coordinate file metadata and storage with compensation/orphan cleanup.
- Audit all applicable create/update/assign/reassign/call/start/draft/complete/submit/review/repeat/cancel/acknowledge/approve/amend/reopen/override/publish actions.
- Include actor, time, action, patient/encounter/resource/source references, reason, expected/previous state, resulting state, and required before/after values.
- Use Pino; never log clinical notes, full records, tokens, secrets, or private file URLs.

## Verification requirements

Each phase must test applicable:

- Schemas, conditional fields, units, laterality, and minimum data.
- Organization/branch/department/encounter/patient/station/assignment/role/resource denials.
- Invalid and stale transitions, unauthorized direct actions, duplicate saves, retries, idempotency, version conflicts, and concurrent updates.
- Transaction rollback, compensation, persistence failures, and no silent partial success.
- Repeat preservation, wrong-eye correction, unreliable/unable/cancelled/unavailable/device-unavailable/pending-external-result flows.
- Emergency routing and alert acknowledgement without automatic diagnosis.
- Completion prerequisites, override/defer, reopening/amendment, portal publication, and audit history.
- Cross-patient/encounter isolation, source-of-truth integrity, indexes, pagination, and realistic performance.
- General OPD, Dental, and shared-domain regression.

Run and report actual results:

```bash
npm run typecheck --workspace=@hms/api
npm run lint --workspace=@hms/api
npm run build --workspace=@hms/api
```

Clearly distinguish executed, inspected, blocked, mocked, and live transaction-capable integration tests.

## Repository safety and execution discipline

- Work only in the current branch. Do not switch, reset, rebase, stash, cherry-pick, or discard changes.
- Inspect `git status` and relevant diffs before and after work; preserve unrelated changes.
- Do not run destructive database operations against real data or modify generated files/lockfiles without approval.
- Work only on the approved phase and stop after its completion report.
- Use 10 minutes only for initial triage. Do not timebox implementation or verification in a way that weakens an exit gate.
- Never claim a test, approval, integration, or requirement passed unless verified.

## Phase 0 Contract reconciliation and readiness

**Objective:** Establish an approved, traceable baseline. No feature implementation.

**Status:** COMPLETE on 15 October 2026. Evidence is recorded in `HMS_OPHTHALMOLOGY_PHASE_0_GAP_NOTE.md`, `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md`, `HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX.md`, and `HMS_OPHTHALMOLOGY_PHASE_0_VERIFICATION.md`. Phase 1 subsequently completed and is recorded separately.

1. Verify source paths, identity, version, date, status, and authority.
2. Complete the matrix for every FSD requirement and acceptance criterion.
3. Inspect patient, appointment, OPD, service catalogue, laboratory, imaging, pharmacy, surgery/procedure, billing/insurance, document, portal, permissions, audit, timeline, dashboard, transaction, and storage implementations.
4. Record reusable code, gaps, cross-domain changes, frontend dependencies, and decision owners.
5. Resolve or obtain decisions for every contradiction/blocker.
6. Publish proposed lifecycle maps, permission inventory, data model, transactions, concurrency/idempotency, file/publication, masters, and phase allocation.
7. Draft `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md`; mark unresolved sections blocked.
8. Run baseline API checks without changing production behavior.

**Deliverables:** Updated matrix, dependency/decision register, code-gap assessment, lifecycle/permission proposals, transaction plan, API contract draft, baseline results, readiness recommendation.

**Exit gate:** The 15 October 2026 decision approval is recorded, the matrix has no unexplained requirement, configuration/policy/adapter dependencies are explicitly marked, and the Phase 1 gap note, API contract draft, and baseline results are complete. Then Phase 1 may start; otherwise report `BLOCKED` or `NOT READY` and stop.

## Phase 1 Existing OPD defects and transactional foundation

**Status:** COMPLETE on 15 October 2026. Evidence is recorded in `HMS_OPHTHALMOLOGY_PHASE_1_GAP_NOTE.md` and `HMS_OPHTHALMOLOGY_PHASE_1_VERIFICATION.md`. Phase 2 subsequently completed and is recorded separately.

- Correct the confirmed service-catalogue fallback without weakening type enforcement.
- Permit approved clinical ordering during consultation instead of only after completion.
- Prevent stale OPD visit/consultation writes with approved conditional/version behavior.
- Make consultation/visit/appointment/timeline/audit finalization atomic or approved recoverable.
- Close confirmed scope, authorization, response-minimization, and audit gaps.
- Preserve General OPD/Dental compatibility.

**Exit gate:** Success, failure, authorization, concurrency, rollback, and regression tests pass; shared-contract changes are approved.

## Phase 2 Ophthalmology context configuration and permissions

**Status:** COMPLETE on 15 October 2026. Evidence is recorded in `HMS_OPHTHALMOLOGY_PHASE_2_GAP_NOTE.md`, `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md`, and `HMS_OPHTHALMOLOGY_PHASE_2_VERIFICATION.md`. Phase 3 subsequently completed and is recorded separately.

- Validate Ophthalmology department activation and approved specialty context.
- Integrate visit-context fields without duplicating appointment/encounter domains.
- Implement approved masters, stations, equipment/calibration, test catalogue, sequencing, thresholds, and reasons through existing patterns.
- Add exact permissions, scopes, indexes, audit, and paginated configuration APIs.
- Implement the approved Procedure Review mapping and record-specific laterality contract.

**Exit gate:** Configuration/permission contracts are approved and wrong-department, cross-branch, and unauthorized tests pass.

## Phase 3 Triage history and emergency escalation

**Status:** COMPLETE on 15 October 2026. Evidence is recorded in `HMS_OPHTHALMOLOGY_PHASE_3_GAP_NOTE.md`, API contract version 1.2.0, and `HMS_OPHTHALMOLOGY_PHASE_3_VERIFICATION.md`. Phase 4 subsequently completed and is recorded separately.

- Implement approved structured complaint, history, previous-report, and emergency resources.
- Reuse allergies and shared medical history.
- Implement alert creation, routing/notification, bypass, acknowledgement, and audit without diagnosis automation.
- Support drafts, version checks, ownership, and conditional validation.

**Exit gate:** All intake/emergency requirements pass validation, scope, wrong-patient, concurrency, and audit tests.

## Phase 4 Test assignment station queue and lifecycle

**Status:** COMPLETE on 15 October 2026. Evidence is recorded in `HMS_OPHTHALMOLOGY_PHASE_4_GAP_NOTE.md`, API contract version 1.3.0, and `HMS_OPHTHALMOLOGY_PHASE_4_VERIFICATION.md`. Phase 5 was subsequently completed as recorded below.

- Implement task/order linkage, assignment, station/device context, common metadata, queue APIs, filters, sorting, pagination, and indexes.
- Implement every approved action/transition, repeat linkage, unavailable/left, device-unavailable, cancellation, reassignment, handoff, and stale-state conflict.
- Keep shared lab/imaging results authoritative.

**Exit gate:** Transition contract is published; concurrency, repeat preservation, scope, audit, and pagination tests pass.

## Phase 5 Core clinical tests

**Status:** COMPLETE on 15 October 2026. Evidence is recorded in `HMS_OPHTHALMOLOGY_PHASE_5_GAP_NOTE.md`, API contract version 1.4.0, and `HMS_OPHTHALMOLOGY_PHASE_5_VERIFICATION.md`. Phase 6 has not started and requires explicit owner approval.

Implement Visual Acuity, Lensometry, Autorefraction/Keratometry, Objective Refraction, Subjective Refraction, IOP, Slit-lamp/Anterior Segment, and Posterior/Fundus Examination with every approved FSD field and common rule.

**Exit gate:** Every field-level row is contracted and each form has schema, permission, persistence, amendment, concurrency, and error-path tests.

## Phase 6 Advanced diagnostics

Implement Pachymetry, Colour Vision, Motility/Squint/Binocular Vision, Dry Eye, Visual Field, OCT, Fundus Photography, Corneal Topography, Biometry/IOL Calculation, B-scan, and Gonioscopy with approved device/source, calculation, quality, comparison, file, review, and audit behavior.

**Exit gate:** Every form is mapped, contracted, tested, and permission-visible through the consolidated read model.

## Phase 7 Contact lens and paediatric assessments

- Implement contact-lens trial/final distinction, fit, over-refraction, outcome, education, and follow-up.
- Implement paediatric methods, cycloplegic context, alignment/red reflex, amblyopia/binocular assessment, cooperation, parent symptoms, relevant history, and results.
- Reuse approved patient, guardian/consent, medication, and follow-up contracts.

**Exit gate:** Specialized field, conditional, context, permission, and audit tests pass.

## Phase 8 Doctor review diagnosis treatment and prescriptions

- Implement consolidated doctor review and historical comparison.
- Extend approved existing diagnosis behavior; do not duplicate it.
- Implement treatment plans, integrate medication prescriptions, and create the separate optical-prescription resource.
- Integrate further tests, procedure/surgery, referral, and follow-up through shared contracts.

**Exit gate:** Permission, duplicate-prevention, stale-state, source-of-truth, and audit tests pass.

## Phase 9 Clinical review completion amendment and summary

- Implement approved review/consultation transitions and structured unmet requirements.
- Implement acknowledgement, result deferral, override, digital approval, completion, reopening, and amendment.
- Make completion atomic/idempotent, lock finalized records, preserve version history, and generate summary/history APIs.

**Exit gate:** Incomplete, success, duplicate, concurrent, unauthorized, rollback, reopen, amendment, and audit tests pass.

## Phase 10 Shared integrations portal reports and dashboards

- Finalize lab, imaging, result, pharmacy, procedure/surgery, referral, follow-up, finance, document, timeline, audit, and portal handoffs.
- Enforce idempotency/compensation, explicit publication/withdrawal, and restricted-content exclusion.
- Implement approved reports and snapshot jobs using authoritative finance data.

**Exit gate:** Integration, retry, duplicate, partial-failure, publication, scope, performance, and shared-domain regression tests pass.

## Phase 11 End to end hardening and release validation

- Execute the complete acceptance matrix across roles, branches, encounters, stations, forms, exceptions, completion, portal, and integrations.
- Run typecheck, lint, build, focused tests, transaction-capable integration tests, security/scope tests, query/index checks, and General OPD/Dental regression.
- Verify no mocks, localhost production dependencies, fabricated metrics, sensitive logs, unapproved local storage, or duplicate sources of truth remain.

**Exit gate:** Every approved acceptance criterion has evidence and deferred items have owner-approved release disposition.

## Required phase gap note

Before each implementation phase, record requirement IDs/FSD references, reusable code, missing contracts, shared dependencies, intended files, data/index/permission/transition/transaction/idempotency/audit/error/test design, and explicit exclusions.

## Required phase handoff

Report only:

- Phase/status: `COMPLETE`, `PARTIALLY COMPLETE`, `BLOCKED`, or `NOT STARTED`.
- FSD identity/authority/alignment and requirement IDs closed.
- Checklist review and outstanding violations.
- Existing functionality reused.
- Files changed, including shared files.
- API contract version and Developer B dependencies.
- Validation, scope, concurrency, transaction, idempotency, audit, storage, and errors.
- Commands/tests run and actual results.
- Limitations, deferred requirements, unresolved decisions, next owner/action.
- Confirmation that the next phase has not started.

Do not complete a phase with incomplete matrix rows, contracts, implementation, tests, or acceptance evidence.
