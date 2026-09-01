# HMS Scope 2 Phase 3 - Phase-Wise Execution Plan

## Document Purpose

This plan converts `HMS_Scope2_Developer1(Kamesh)_Phase_3_Prompts.docx` into a dependency-ordered implementation sequence for Developer 1.

All work is governed by `PROJECT_RULES.md` and `AGENTS.md`. Each phase must be implemented, verified, documented, and explicitly approved before the next phase begins.

**Analysis date:** 21 August 2026  
**Owner:** Developer 1 (Kamesh)  
**Release label:** Scope 2 Phase 3 / next release, pending confirmation because the source document internally says HMS Phase 2

## Source and Planning Gaps

The prompt was analyzed in full. It defines five sequential tasks: IP Bed Management, IP Admission and Emergency-to-IP Conversion, Surgery/Procedure, Emergency, and final integration.

Two source issues must be resolved in P3-0:

- `doc/HMS_Release2_FSD.docx`, referenced as the detailed source of truth, is not present in the repository.
- The filename and internal release title disagree on Phase 3 versus Phase 2.

The execution sequence below also removes a circular dependency in the supplied task order. P3-2 prepares a source-neutral encounter conversion contract, while the concrete Emergency-to-IP adapter is completed only after the Emergency encounter exists in P3-5.

## Current Implementation Baseline

| Area | Status on 21 Aug 2026 | Reuse / remaining gap |
|---|---|---|
| Patient, doctor, department, appointment, OPD | Implemented foundations | Reuse identities, encounters, availability, permissions, and timeline; do not duplicate them. |
| Ward and bed configuration | Partially complete | Ward/bed CRUD, statuses, summaries, RBAC, indexes, and live UI exist. Room hierarchy, hold, allotment history, transfer, release, cleaning, and full bed board remain. |
| Initial inpatient admission | Partially complete | List/get/create and atomic available-bed occupation exist. Recommendation/request, active-admission uniqueness, cancellation, prerequisites, conversion, richer lifecycle, timeline, and mock-free UI remain. |
| Consent | Partial integration foundation | Patient consent documents/status exist. No approved configurable IP/procedure consent prerequisite contract exists. |
| Billing/payment | Implemented OPD foundation | Invoice/payment workflows exist. IP advance/deposit requirement and admission linkage are not defined. |
| Pharmacy, laboratory, imaging | Implemented integration foundations | Reuse contracts; Developer 1 must not implement their internals. |
| Surgery/procedure | Not implemented | Appointment labels are not a surgery domain. Recommendation, booking, schedule, conflicts, lifecycle, audit, and timeline are required. |
| Emergency | Not implemented | HMS Local prototypes exist, but no live backend/module. Sidebar remains deferred. |
| Inpatient workspace | Prototype/partial planning only | Full IP record belongs after admission, transfer, release, and integrations are stable. |

## Dependency Order

```text
P3-0 Contract and Baseline Gate
  -> P3-1 IP Bed Lifecycle Foundation
      -> P3-2 IP Recommendation, Admission and Generic Conversion
          -> P3-3 Surgery / Procedure
          -> P3-4 Emergency Core Workflow
              -> P3-5 Emergency-to-IP and Downstream Integration
                  -> P3-6 Developer 1 End-to-End Validation
```

P3-3 and P3-4 may be developed independently only after P3-2 is approved. For a single developer, execute them in the order shown.

## Source Task Mapping

| Supplied task | Execution phase |
|---|---|
| Task 1 - IP Bed Management | P3-1 |
| Task 2 - IP Admission and Emergency-to-IP Conversion | P3-2 for the generic admission flow; P3-5 for the concrete Emergency adapter |
| Task 3 - Surgery / Procedure | P3-3 |
| Task 4 - Emergency Workflow | P3-4 for Emergency core; P3-5 for conversion integration |
| Task 5 - Developer 1 Integration and Validation | P3-6 |

---

## P3-0: Contract Reconciliation and Release Baseline

**Status:** Completed on 21 August 2026  
**Depends on:** Current repository  
**Blocks:** Every implementation phase

The shortened reconciliation reused the completed R0 contract and resolved only the new Surgery, Emergency, bed hold, contextual consent, and advance-deposit decisions. Baseline defects discovered by the initial verification were resolved and the passing evidence is recorded in `HMS_SCOPE2_PHASE3_P0_VERIFICATION.md`. No P3-1 feature implementation was started.

### Objective

Freeze the business contracts and establish a clean, reproducible baseline before changing production workflows.

### Tasks

- Obtain and read `doc/HMS_Release2_FSD.docx`, or receive written approval to use the supplied prompt as the controlling functional source.
- Confirm the release name and documentation location.
- Audit existing admission, bed, patient, consent, billing, encounter, order, permission, audit, and timeline contracts.
- Confirm final ward/room/bed hierarchy and bed statuses, including whether `CLEANING` is a distinct status.
- Confirm hold duration, expiry, extension, release, and conflict behavior.
- Confirm admission states, active-admission definition, cancellation rules, and source encounter model.
- Confirm configured consent and advance-payment/deposit rules, including who owns configuration and which actions they block.
- Confirm temporary/unknown Emergency patient rules and later patient reconciliation.
- Confirm procedure conflict, duplicate, bed requirement, reschedule, cancellation, and resource-release rules.
- Confirm cross-branch transfer and restricted Emergency permission names.
- Record current API/web typecheck, lint, build, and runtime results.
- Remove no functionality in this phase; document mock-data cleanup targets, including the current admission page presentation mocks.

### Deliverables

- `HMS_SCOPE2_PHASE3_CONTRACT.md` containing approved enums, transitions, invariants, ownership, permission matrix, integration contracts, and unresolved decisions.
- `HMS_SCOPE2_PHASE3_P0_VERIFICATION.md` containing baseline commands and results.

### Exit Gate

- All safety-critical contracts are approved.
- Missing integration owners are identified.
- API and UI work can proceed without inventing fields or statuses.

**Stop after P3-0 and wait for approval.**

---

## P3-1: IP Bed Lifecycle Foundation

**Status:** Completed on 21 August 2026  
**Depends on:** P3-0  
**Blocks:** P3-2, P3-3, P3-5

### Objective

Extend the existing ward/bed configuration into the complete reusable bed lifecycle required by admission, procedures, transfer, and discharge.

### Backend Tasks

- Reuse `admissions-configuration`; do not create a second ward/bed master.
- Add approved room/bed-type relationships only where the FSD requires them.
- Add bed-board and paginated availability projections using indexed queries.
- Add explicit hold, allotment, release, transfer, and approved cleaning/preparation contracts.
- Persist hold/allotment ownership, patient/admission context, expiry, reason, actor, and timestamps.
- Implement hold expiry/release according to the approved background-job or request-time pattern; do not add Redis or a cache.
- Revalidate availability with conditional updates inside transactions.
- Prevent overlapping active holds/occupancies with database constraints and conflict responses.
- Add same-ward and same-branch transfer; add cross-branch transfer only with its approved permission/process.
- Preserve complete assignment/transfer/release history and audit events.
- Prevent manual status changes from bypassing active holds or occupancy.

### Frontend Tasks

- Upgrade Bed Management using `scope/HMS Local/bed-management.html` and `admissions-module.css` patterns.
- Add a live Bed Board with branch, ward, room, bed type, status, patient/admission context, and pagination/filter URL state.
- Add hold, allot, transfer, release, block, maintenance, activation, and confirmation flows according to permissions.
- Show stale/conflict feedback when another user changes a bed.
- Provide loading, empty, error, success, permission-denied, and no-available-bed states.

### Manual Acceptance

- Create duplicate bed identifiers in one branch/ward and verify rejection.
- Hold one bed and verify another session cannot hold or allot it.
- Let a hold expire or release it and verify availability returns correctly.
- Allot, transfer, and release a bed and verify history and status consistency.
- Attempt occupied, blocked, maintenance, inactive, and cleaning beds.
- Test unauthorized and cross-branch actions.
- Force a transaction failure and verify no partial bed state remains.

### Exit Gate

All downstream modules can consume one authoritative availability/hold/allot/transfer/release service.

**Stop after P3-1 and wait for approval.**

---

## P3-2: IP Recommendation, Admission and Generic Encounter Conversion

**Status:** Completed on 21 August 2026  
**Depends on:** P3-1  
**Blocks:** P3-3, P3-5, P3-6

### Admission Request Refactor Addendum

**Status:** Completed on 1 September 2026
**Tracking:** `HMS_SCOPE2_PHASE3_ADMISSION_REQUEST_REFACTOR_GAP_NOTE.md` and `HMS_SCOPE2_PHASE3_ADMISSION_REQUEST_REFACTOR_VERIFICATION.md`

This addendum hardens the existing P3-2 request UI and backend source validation. It separates admission source, admission type, request status and actual admission; replaces the ambiguous `Admission` source label with `Direct Admission`; adds source-specific OPD and Referral selection; improves expired-session handling; and keeps actual inpatient admission creation behind the existing validation and confirmation lifecycle. It does not start a new phase.

### Objective

Complete the flow from doctor/encounter recommendation through reception validation, prerequisites, bed allotment, confirmed admission, and EMR linkage.

### Backend Tasks

- Extend the existing `inpatient-admissions` domain rather than replacing it.
- Add doctor/OPD admission recommendation and reception admission-request lifecycle.
- Reuse patient search/registration and validate one existing patient identity.
- Add atomic active-admission uniqueness protection.
- Link recommendation, originating encounter, patient, branch, department, doctor, ward, room, bed, consent, deposit, and admission.
- Use the P3-1 hold/allotment service instead of directly changing bed status.
- Enforce configured consent and deposit prerequisites through existing domain contracts.
- Support draft cancellation without occupied or orphaned resources.
- Add source-neutral encounter conversion so OPD and future Emergency adapters use one admission path.
- Update the originating encounter only in the same transaction or approved consistent workflow.
- Add admission and conversion timeline/audit events.
- Add paginated dashboard/request/list APIs and explicit transition validation.

### Frontend Tasks

- Replace the current admission page mock-derived source and status presentation with live fields.
- Implement recommendation/request, reception validation, active-admission warning, live bed selection, prerequisites, confirmation, and cancellation.
- Reuse the HMS Local admission dashboard/request and inpatient header patterns.
- Provide patient duplicate/open-profile actions through existing patient workflows.
- Show consent/deposit blockers and source encounter context without exposing unauthorized data.

### Manual Acceptance

- Admit an existing patient from an OPD recommendation.
- Register a new patient through the existing patient flow and continue admission.
- Reject duplicate active admission and stale/unavailable bed selection.
- Verify mandatory consent and deposit block confirmation and optional rules do not.
- Cancel a draft and verify holds/resources are released.
- Verify admission, encounter, bed, audit, and EMR references after logout/login.
- Verify unauthorized branch/department users cannot view or confirm the request.

### Exit Gate

The generic admission service is production-ready for direct, OPD, procedure, and future Emergency sources.

**Stop after P3-2 and wait for approval.**

---

## P3-3: Surgery and Procedure Workflow

**Status:** Completed on 21 August 2026  
**Depends on:** P3-2  
**Blocks:** P3-6

### Objective

Implement doctor recommendation through validated procedure booking, scheduling, rescheduling, cancellation, and timeline updates without implementing full OT or intra-operative care.

### Backend Tasks

- Add the approved surgery/procedure recommendation and booking domain using existing model/repository/service/route patterns.
- Link patient, encounter, recommendation, department, service, doctor, branch, proposed date/time, bed requirement, consent, deposit, and admission where applicable.
- Reuse existing service catalogue and doctor availability contracts.
- Prevent doctor/service/time conflicts and duplicate active bookings.
- Revalidate bed availability or hold through P3-1 when inpatient care is required.
- Enforce configured consent and deposit prerequisites.
- Implement explicit booking status transitions, reschedule reason/history, cancellation reason/history, and resource release.
- Add permissions, indexes, pagination, audit, and EMR timeline events.

### Frontend Tasks

- Reuse Doctor, Appointment, and HMS Local booking/calendar patterns.
- Add recommendation queue, booking stepper, availability alternatives, schedule/calendar, detail, reschedule, and cancel dialogs.
- Display bed, consent, and payment requirements with clear blockers.
- Keep filters/search/date/status in URL state and query lookups on demand.

### Manual Acceptance

- Create a valid recommendation and booking.
- Reject duplicate active booking and doctor/service conflicts.
- Show valid alternatives when the selected doctor has no availability.
- Verify required bed, consent, and deposit blockers.
- Reschedule and cancel with reasons; verify history and resource release.
- Verify permissions, branch/department scope, audit, timeline, and persistence.

### Exit Gate

The confirmed Phase 3 procedure scope works without full OT, anesthesia, intra-operative, or ward-nursing implementation.

**Stop after P3-3 and wait for approval.**

---

## P3-4: Emergency Core Workflow

**Status:** Completed on 21 August 2026  
**Depends on:** P3-2  
**Blocks:** P3-5 and P3-6

### Objective

Implement live Emergency registration, queue, assessment, doctor evaluation, downstream order initiation, and disposition using the existing patient and clinical foundations.

### Backend Tasks

- Add Emergency encounter, queue/priority, assessment, notes, disposition, and timeline contracts.
- Reuse existing patients; implement approved minimal/temporary registration without creating uncontrolled duplicates.
- Add emergency identifier generation and later identity reconciliation if approved.
- Add explicit Emergency lifecycle and transition rules for waiting, assessment, doctor care, downstream work, discharge, left/abandoned, and conversion-ready states.
- Link pharmacy, laboratory, and imaging orders through their existing contracts with Emergency source context.
- Expose billing/payment status through the existing billing contract; do not implement billing internals.
- Add permissions, branch/department scope, indexes, pagination, audit, and EMR timeline events.

### Frontend Tasks

- Enable Emergency navigation only when live routes and permissions are ready.
- Implement HMS Local Emergency dashboard, queue, registration, assessment, and workspace patterns.
- Use explicit triage/priority text and icons, urgent alerts, patient header, live vitals/assessment panels, orders, disposition, and confirmation dialogs.
- Maintain patient privacy and prevent shared queue views from exposing unnecessary clinical notes.

### Manual Acceptance

- Register known and approved unknown/incomplete patients.
- Confirm priority ordering and authorized assessment/doctor actions.
- Place pharmacy/lab/imaging requests and verify Emergency source context persists.
- Discharge and mark left/abandoned through valid transitions.
- Reject invalid, stale, unauthorized, and cross-branch actions.
- Verify audit, timeline, billing status, and persistence.

### Exit Gate

Emergency encounters can progress safely to a terminal disposition or a conversion-ready state.

**Stop after P3-4 and wait for approval.**

---

## P3-5: Emergency-to-IP Conversion and Cross-Module Integration

**Status:** Completed on 24 August 2026  
**Depends on:** P3-1, P3-2, and P3-4  
**Blocks:** P3-6

### Objective

Connect Emergency to the approved generic IP admission flow and validate all Developer 2 integration boundaries without rebuilding their modules.

### Tasks

- Add the Emergency adapter to the P3-2 recommendation/conversion contract.
- Reuse the same active-admission, consent, deposit, hold, allotment, and confirmation rules.
- Revalidate bed availability immediately before confirmation.
- Atomically or consistently update Emergency disposition, admission, bed assignment, source encounter, and timeline.
- Prevent duplicate conversion, patient duplication, admission duplication, and stale retries.
- Verify pharmacy/lab/imaging requests retain Emergency context after conversion.
- Verify billing/payment status and consent references remain linked.
- Add retry/idempotency behavior and focused integration tests.

### Manual Acceptance

- Convert a valid Emergency encounter to IP and verify one patient, one active admission, and one bed assignment.
- Retry conversion and verify no duplicate admission or occupancy.
- Reject unavailable beds and unmet prerequisites without changing Emergency status.
- Verify existing downstream orders remain linked before and after conversion.
- Test unauthorized users, branch boundaries, transaction rollback, audit, and timeline.

### Exit Gate

Emergency-to-IP is a thin integration over the authoritative admission and bed services.

**Stop after P3-5 and wait for approval.**

---

## P3-6: Developer 1 End-to-End Hardening and Release Validation

**Status:** Completed on 24 August 2026  
**Depends on:** P3-1 through P3-5

### Objective

Validate Developer 1 workflows as one release, fix only owned integration defects, and produce release evidence.

### Validation Scope

- Bed configuration -> availability -> hold -> allotment -> transfer -> release.
- Doctor/OPD recommendation -> admission request -> prerequisites -> confirmed admission.
- Procedure recommendation -> booking -> reschedule/cancel -> resource state.
- Emergency registration -> assessment -> orders -> discharge/abandonment or IP conversion.
- Patient, encounter, admission, recommendation, procedure, order, invoice, consent, and bed relationships.
- Branch/department scope, RBAC, state transitions, concurrency, duplicate prevention, audit, timeline, and rollback.
- Loading, empty, error, success, permission-denied, responsive, print, and accessibility states where required.
- Removal of all phase-owned mock data, dead code, and hardcoded production data.

### Automated Checks

Run the full API/web typecheck, lint, and build commands from `AGENTS.md`, plus focused integration tests for:

- Concurrent bed hold/allotment/transfer.
- Duplicate active admission and procedure booking.
- Consent/deposit blockers.
- Emergency order source context.
- Emergency conversion idempotency and rollback.
- Reschedule/cancellation resource release.
- Permission and branch/department isolation.

### Manual Release Tests

- Execute every prior phase manual test in at least two authorized branches where test data allows.
- Test an unauthorized role and a user without branch assignment.
- Test refresh/retry, two-session concurrency, logout/login persistence, and stale UI conflicts.
- Inspect audit records and patient EMR timelines for every important transition.
- Verify the live browser workflows against HMS Local visual references on desktop and mobile widths.

### Deliverables

- `HMS_SCOPE2_PHASE3_RELEASE_VERIFICATION.md`.
- Updated status tracker below.
- Explicit list of unresolved Developer 2 dependencies or FSD requirements.

### Exit Gate

The release is complete only when all approved Developer 1 requirements pass automated and manual verification with live MongoDB data and no phase-owned mocks.

**Stop after P3-6. Do not begin another release without explicit approval.**

---

## Phase Status Tracker

| Phase | Status | Completion date | Evidence |
|---|---|---|---|
| P3-0 Contract and baseline | Completed | 21 August 2026 | `HMS_SCOPE2_PHASE3_CONTRACT.md`, `HMS_SCOPE2_PHASE3_P0_VERIFICATION.md` |
| P3-1 IP bed lifecycle | Completed | 21 August 2026 | `HMS_SCOPE2_PHASE3_P1_VERIFICATION.md` |
| P3-2 IP recommendation/admission/conversion | Completed | 21 August 2026 | `HMS_SCOPE2_PHASE3_P2_VERIFICATION.md` |
| P3-3 Surgery/procedure | Completed | 21 August 2026 | `HMS_SCOPE2_PHASE3_P3_VERIFICATION.md` |
| P3-4 Emergency core | Completed | 21 August 2026 | `HMS_SCOPE2_PHASE3_P4_VERIFICATION.md` |
| P3-5 Emergency-to-IP integration | Completed | 24 August 2026 | `HMS_SCOPE2_PHASE3_P5_VERIFICATION.md` |
| P3-6 End-to-end hardening | Completed | 24 August 2026 | `HMS_SCOPE2_PHASE3_RELEASE_VERIFICATION.md` |
| Final cross-developer integration | Completed | 24 August 2026 | `HMS_SCOPE2_PHASE3_FINAL_INTEGRATION_GAP_NOTE.md`, `HMS_SCOPE2_PHASE3_FINAL_INTEGRATION_VERIFICATION.md` |
| Post-release role-based dashboard hardening | Completed | 30 August 2026 | `HMS_ROLE_BASED_DASHBOARD_GAP_NOTE.md`, `HMS_ROLE_BASED_DASHBOARD_VERIFICATION.md` |

## Release Completion Criteria

- All source gaps and lifecycle decisions are approved and documented.
- One authoritative bed lifecycle serves admission, procedures, transfer, release, and Emergency conversion.
- Duplicate active occupancy and admission are prevented under concurrency.
- Admission prerequisites and source encounter conversion are backend enforced.
- Procedure booking validates availability, duplicates, prerequisites, and resource release.
- Emergency uses existing patient, order, billing, consent, admission, and EMR domains.
- Emergency-to-IP creates no duplicate patient, admission, or bed assignment.
- Every protected operation enforces RBAC and branch/department scope on the backend.
- Audit and EMR timelines retain all important transitions and reasons.
- All lists are paginated and searchable/filterable fields are indexed.
- All live pages include loading, empty, error, success, permission-denied, and conflict states.
- No mock data, browser persistence, PostgreSQL, Redis, new database connection, or duplicate architecture is introduced.
- API and web typecheck, lint, build, focused tests, runtime workflows, and manual acceptance pass.
