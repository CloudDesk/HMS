# HMS Next Release: Pharmacy Integration and Inpatient Management

## Document Purpose

This document reconciles the next release requirements with the current HMS repository and defines the implementation sequence for the remaining work.

It is governed by [PROJECT_RULES.md](PROJECT_RULES.md). MongoDB/Mongoose remains the only database strategy, existing HMS Local UI patterns remain the visual reference, and no mock persistence is acceptable for completed functionality.

**Analysis date:** 18 August 2026  
**Scope:** Pharmacy and inventory integration plus branch-wise wards, beds, admission, transfer, discharge, and inpatient records

## Important Baseline Note

`HMS_PHASE1_PROGRESS_AUDIT.md` describes an earlier repository state and should not be used as the sole measure of current implementation. Later work has added live modules for OPD, prescriptions, clinical orders, pharmacy inventory, laboratory, imaging, and billing. This document evaluates the current source tree and separates those foundations from the new inpatient requirements.

## Current Completion Summary

| Area | Current status | What exists now | What this release still needs |
|---|---|---|---|
| Authentication, JWT, refresh rotation, RBAC foundation | Complete foundation | Existing protected routes, permission middleware, branch-aware patterns, refresh-token rotation, and audit infrastructure | Add permissions and audit events for the new pharmacy/inpatient actions |
| Patient foundation | Implemented | Patient registration, search, profile, history, documents, EMR timeline, consent flows, and patient-linked APIs | Reuse the patient context in admission and inpatient records; do not create a second patient model |
| Doctor foundation and availability | Implemented | Doctor directory/profile, schedules, availability, and appointment-related doctor data | Reuse doctor and department references for admitting and treating doctors |
| Appointment and queue workflow | Implemented | Appointment booking, dashboard, calendar, queue controls, and status transitions | Reuse appointment/visit context where an admission follows an outpatient encounter |
| OPD visit and clinical workflow | Implemented | Check-in, OPD visit workspace, vitals, consultation, diagnosis/notes, prescription, follow-up, referral, and timeline integration | Link inpatient medication, documents, reports, and charges without changing OPD behavior |
| Prescription foundation | Implemented foundation | Mongoose prescription model, draft/submit lifecycle, permissions, validation, and audit events | Add pharmacy queue consumption, pharmacist editing rules, confirmation, cancellation/reversal, and stock integration |
| Clinical orders | Implemented foundation | Laboratory and imaging order creation and downstream workflow foundations | No direct inpatient gap; inpatient records must display related clinical documents/reports |
| Pharmacy medicine master | Implemented | Medicine master CRUD and medicine lifecycle rules | Reuse medicine IDs in prescriptions and inventory; do not duplicate medicine data |
| Pharmacy inventory | Implemented foundation | Branch-scoped batches, opening stock, stock in/out, adjustments, expiry handling, stock movements, summaries, thresholds, indexes, and audit events | Add prescription-driven reservation/confirmation/deduction and reversal transactions |
| Pharmacy UI | Implemented foundation | Prescription queue and medicine inventory screens exist | Add end-to-end dispense/edit/confirm/cancel/reversal actions and bill generation from the pharmacy workflow |
| Billing | Implemented OPD foundation | Invoice creation/update/cancel, pharmacy invoice item support, payments, receipts, branch scope, validation, and audit events | Connect confirmed pharmacy dispensing to billing and enforce reversal/refund rules for stock and invoices |
| File/document storage | Implemented temporary backend storage | Patient document metadata in MongoDB and temporary files on backend local storage pending GCP credentials | Reuse the same document service for inpatient documents and reports; keep authorization and metadata linkage intact |
| Branch-wise ward and bed configuration | Not started | A general settings `bedCapacity` value and HMS Local prototype pages only | Ward/bed models, APIs, UI, branch scoping, statuses, lifecycle rules, and availability summary |
| Inpatient admission and bed assignment | Not started | HMS Local admission/inpatient prototype only | Admission model, active-bed uniqueness, bed occupation transaction, permissions, and UI |
| Bed transfer | Not started | No transfer model or API found | Same-ward, cross-ward, and authorized cross-branch transfer workflow with history |
| Bed release and discharge | Not started | No discharge workflow found | Confirmed discharge, cleaning/blocking state, release transaction, reversal permissions, and audit |
| Inpatient record | Not started | No inpatient aggregate/workspace found | Patient admission record with bed history, clinical data, documents, prescriptions, charges, and discharge summary |

## Requirement-by-Requirement Gap Analysis

### 1. Pharmacy and Inventory Integration

**Status: PARTIALLY IMPLEMENTED**

#### Already available

- E-prescriptions have a persisted OPD prescription model and draft/submitted lifecycle.
- Prescription routes use validation and existing permission middleware.
- Submitted prescription state is protected from ordinary editing.
- Pharmacy medicine master and branch-specific batch inventory exist.
- Inventory supports stock quantities, batches, stock movements, expiry handling, low-stock states, and audit entries.
- Billing supports pharmacy invoice items, invoice totals, payments, receipts, branch scope, and audit entries.

#### Missing

- A pharmacy queue must consume submitted e-prescriptions from the live prescription API.
- Authorized pharmacy users must be able to edit allowed medicine details before confirmation, with the original prescription and pharmacist changes retained.
- The final confirmed quantity must be validated atomically against the selected branch and batch stock.
- Confirmation must deduct stock only once and must be idempotent under retries.
- Draft, unconfirmed, rejected, and cancelled prescriptions must not deduct stock.
- Cancellation/reversal must restore stock only when a prior deduction exists.
- Cancellation and reversal must be permission-protected and audited with before/after quantities, actor, reason, prescription, patient, branch, and related invoice references.
- Billing must be generated or finalized from the confirmed dispensing result rather than from an arbitrary batch selected independently in billing.
- Concurrent confirmation of the same prescription or insufficient stock must fail safely without partial deduction.

#### Required design decision

Use a pharmacy dispensing transaction linked to `prescription_id`, `patient_id`, `visit_id`, `branch_id`, medicine, batch, confirmed quantity, unit price, status, and reversal details. Stock deduction and dispensing confirmation must use a MongoDB transaction where the deployment supports transactions.

### 2. Branch-wise Bed Configuration

**Status: NOT STARTED**

#### Existing evidence

- `settings.bedCapacity` is a general hospital setting and is not a ward or bed registry.
- `scope/HMS Local/bed-management.html` is a prototype reference only.
- No ward or bed Mongoose models, repositories, services, routes, API clients, or live pages were found.

#### Required

- `Ward` model linked to a branch with name, type, floor, description, active status, and audit fields.
- `Bed` model linked to both branch and ward with unique bed number/name within the branch and ward, category, room number, status, active status, and audit fields.
- Bed statuses: `AVAILABLE`, `OCCUPIED`, `RESERVED`, `BLOCKED`, `UNDER_MAINTENANCE`, and `INACTIVE`. Add `CLEANING` only if the workflow is approved; otherwise use the existing blocked state with a reason.
- Unique database index preventing duplicate bed identifiers within the same branch and ward.
- APIs for ward CRUD, bed CRUD, status changes, availability, and summary counts.
- Branch scope enforced from authenticated user permissions, never from trusted frontend branch values.
- Prevention of new assignment to occupied, reserved, blocked, maintenance, or inactive beds.
- Summary counts for total, available, occupied, reserved, blocked, maintenance, and inactive beds.
- Live HMS Local-style configuration screens with loading, empty, error, success, permission-denied, and confirmation states.

### 3. Inpatient Admission and Bed Assignment

**Status: NOT STARTED**

#### Required

- Reuse an existing patient or register a new patient through the patient service.
- Admission fields: patient, branch, admission date/time, admitting doctor, department, admission type, reason, notes, status, ward, and bed.
- Ward list must be filtered by the selected branch.
- Bed availability must be live and filtered by the selected ward.
- Admission and bed occupation must be one atomic operation.
- A bed must not be assignable to two active inpatients, including concurrent requests.
- Admission record must retain branch, ward, bed, admission date/time, admitting doctor, treating doctor references where applicable, and audit fields.
- Draft admission cancellation must not occupy a bed.
- Permission checks must cover admission creation, bed assignment, and branch access.

#### Required state model

At minimum, define explicit admission states such as `DRAFT`, `ADMITTED`, `TRANSFER_PENDING`, `DISCHARGE_PENDING`, `DISCHARGED`, and `CANCELLED`. Final names must be aligned with the existing naming convention before implementation.

### 4. Bed Transfer

**Status: NOT STARTED**

#### Required

- Transfer within the same ward.
- Transfer between wards within the same branch.
- Cross-branch transfer with an explicit permission and authorization process.
- Destination bed availability validation immediately before confirmation.
- Atomic release of the old bed and occupation of the new bed.
- Transfer history containing previous branch/ward/bed, new branch/ward/bed, date/time, reason, actor, and audit metadata.
- Protection against transfer races, duplicate submissions, and transfers for inactive/discharged admissions.
- Clear confirmation dialog and reason validation for clinical/operational traceability.

### 5. Bed Release and Discharge

**Status: NOT STARTED**

#### Required

- Discharge workflow must be confirmed before releasing the assigned bed.
- Confirmed discharge changes the bed from `OCCUPIED` to `AVAILABLE`.
- Optional cleaning/preparation flow may move the bed to `BLOCKED` or approved `CLEANING` state before availability.
- Draft admission cancellation must leave the bed available.
- Reopening or cancelling a confirmed discharge must require an explicit permission.
- Reversal must be audited with actor, reason, prior state, new state, admission, patient, branch, ward, and bed.
- Discharge summary and discharge date/time must be stored in the inpatient record.
- Bed state and admission state must never become inconsistent after a failed transaction.

### 6. Inpatient Record

**Status: NOT STARTED**

#### Required record sections

- Patient and admission overview.
- Branch, ward, room, and current bed.
- Admitting and treating doctors.
- Admission and discharge status.
- Current assignment and complete transfer history.
- Prescriptions and medication/dispensing details.
- Clinical documents, laboratory reports, and imaging reports.
- Charges, invoices, payments, and balances.
- Discharge details and discharge summary.
- Audit/timeline history for admission, transfers, medication, documents, billing, and discharge.

The inpatient record must reference existing patient, doctor, appointment/visit, prescription, order, document, billing, ward, and bed records. It must not copy mutable patient or medicine master data unnecessarily.

## Recommended Implementation Sequence

The implementation must proceed in dependency order and stop after each phase for manual verification and approval.

### Release Phase R1: Pharmacy Dispensing Integration

1. Confirm prescription and inventory status/state contracts.
2. Add dispensing model, repository, service, Zod schemas, routes, permissions, indexes, and audit events.
3. Implement atomic stock validation, deduction, confirmation, cancellation, and reversal.
4. Connect confirmed dispensing to billing without allowing duplicate invoices or duplicate stock deductions.
5. Connect the pharmacy queue and dispensing workspace to live APIs.
6. Add focused backend tests for insufficient stock, retry/idempotency, cancellation, reversal, permissions, branch scope, and billing linkage.
7. Add manual test document and stop for approval.

### Release Phase R2: Ward and Bed Configuration

1. Define ward and bed status contracts and permissions.
2. Add ward/bed models, repositories, indexes, services, validation, routes, and audit events.
3. Add branch-scoped availability and summary queries with pagination where lists are used.
4. Implement HMS Local-style ward and bed management screens.
5. Add duplicate and invalid-state tests.
6. Add manual test document and stop for approval.

### Release Phase R3: Admission and Initial Bed Assignment

1. Define the inpatient admission aggregate and lifecycle.
2. Add admission model, repository, service, schemas, routes, permissions, and audit events.
3. Implement patient, branch, doctor, department, ward, and available-bed selection.
4. Add atomic admission plus bed-occupation transaction and concurrency protection.
5. Implement the admission screen using the HMS Local inpatient prototype patterns.
6. Add manual test document and stop for approval.

### Release Phase R4: Bed Transfer

1. Add transfer model/history and destination-bed validation.
2. Implement same-ward and same-branch transfers.
3. Implement authorized cross-branch transfer with explicit permission and audit.
4. Add atomic old-bed release/new-bed occupation behavior.
5. Add transfer workspace and manual tests.
6. Stop for approval.

### Release Phase R5: Discharge and Bed Release

1. Define discharge and optional cleaning/preparation states.
2. Implement confirmed discharge and bed release transaction.
3. Add permission-protected discharge reversal/reopening.
4. Add discharge summary and audit timeline.
5. Implement discharge workspace and manual tests.
6. Stop for approval.

### Release Phase R6: Inpatient Record and Cross-Module Display

1. Implement the inpatient profile/workspace.
2. Display admission, current bed, transfer history, doctors, medication, reports, documents, charges, payments, and discharge data through live APIs.
3. Add permission-scoped tabs and patient-sensitive data handling.
4. Add timeline/audit display and print/download behavior where approved.
5. Run end-to-end validation from admission through discharge.
6. Stop for approval before any unrelated release work.

## Required New Backend Domains

The following domains are not currently present and must follow the existing model → repository → service → routes → API client → feature hook → page pattern:

- `wards` or the project-approved ward configuration domain
- `beds` or a project-approved combined ward/bed domain
- `inpatient-admissions`
- `bed-transfers`
- `discharges`
- `pharmacy-dispensing`

These names are provisional. Before creating files, inspect existing naming conventions and reuse any shared admission or facility types discovered in the repository.

## Required Permissions

Permission names must use the existing module/screen/action model. The following capabilities must be represented and seeded before live screens depend on them:

- View and manage pharmacy prescription queue.
- Edit pharmacy dispensing details.
- Confirm dispensing and deduct stock.
- Cancel or reverse dispensing.
- View and manage ward configuration.
- View and manage bed configuration.
- Create inpatient admission.
- Assign and reassign beds.
- Transfer patients within a branch.
- Transfer patients across branches.
- Initiate and confirm discharge.
- Reopen or reverse confirmed discharge.
- View inpatient records, documents, reports, medication, and billing sections.

Frontend visibility is only a usability layer. Every API operation must enforce authorization and branch scope on the backend.

## Cross-Module Invariants

- A bed can have at most one active inpatient assignment.
- A patient can have at most one active admission unless a future requirement explicitly permits multiple concurrent admissions.
- A bed that is occupied, reserved, blocked, under maintenance, or inactive cannot be newly assigned.
- An unconfirmed prescription never changes stock.
- A confirmed prescription deducts stock exactly once.
- A valid reversal restores only the quantity previously deducted by that dispensing transaction.
- A cancelled or reversed dispensing cannot remain billable without an explicit billing reversal rule.
- Admission, transfer, discharge, and stock-changing operations must be atomic where multiple documents change together.
- Branch scope must be derived from authenticated permissions and verified against every referenced branch, ward, bed, prescription, invoice, and patient context.
- Every cancellation, reversal, transfer, discharge reopening, and stock correction must be audited.
- Failed transactions must not leave an occupied bed, deducted stock, or partially-created billing state.

## Completion Criteria for This Release

This release is complete only when:

- Pharmacy queue consumes live submitted prescriptions.
- Authorized pharmacy users can edit permitted details, confirm quantities, and generate the correct bill.
- Stock validation and deduction are atomic, branch-specific, idempotent, and audited.
- Unconfirmed/cancelled prescriptions do not affect stock.
- Authorized reversal restores stock correctly and records the audit event.
- Branch users can create and manage wards and beds with all required statuses and summaries.
- Duplicate bed identifiers are rejected within a branch and ward.
- Admission assigns only an available bed and occupies it atomically.
- Transfers release and occupy beds correctly and preserve full history.
- Confirmed discharge releases the bed; draft cancellation does not occupy it.
- Discharge reversal/reopening is permission-protected and audited.
- Inpatient profile displays all required clinical, document, medication, billing, bed, transfer, and discharge data.
- All pages have loading, empty, error, success, and permission-denied states.
- No mock data is used for these workflows.
- TypeScript, lint, build, focused tests, and manual browser tests pass.

## Manual Verification Expectations

Each release phase must have its own manual test document. At minimum, verification must cover:

- Authorized and unauthorized users.
- Multiple branches and cross-branch access.
- Duplicate submissions and browser refresh/retry behavior.
- Invalid and boundary quantities/statuses.
- Concurrent or stale availability conditions.
- Audit-log records and before/after values.
- Failure rollback for stock, bed, admission, transfer, discharge, and billing transactions.
- Live data persistence after logout and re-login.

No next release phase should begin until the current phase is manually verified and explicitly approved.

