# HMS Next Release Phase-Wise Execution Plan

## Purpose

This plan defines the dependency-wise implementation order for pharmacy integration and inpatient management. It follows [PROJECT_RULES.md](PROJECT_RULES.md) and [NEXT_RELEASE_PHARMACY_INPATIENT_GAP_ANALYSIS.md](NEXT_RELEASE_PHARMACY_INPATIENT_GAP_ANALYSIS.md).

Every phase must pass backend checks, frontend checks, manual browser tests, and explicit approval before the next phase begins.

## Dependency Order

```text
R0 Shared contracts, permissions, and state design
        |
   +----+----+
   |         |
   v         v
R1 Pharmacy  R2 Ward and bed configuration
   |         |
   +----+----+
        v
R3 Admission and initial bed assignment
        |
        v
R4 Bed transfer
        |
        v
R5 Discharge and bed release
        |
        v
R6 Inpatient record and end-to-end hardening
```

### Strict sequence

1. `R0` Shared contracts, permissions, and state design
2. `R1` Pharmacy and inventory integration
3. `R2` Ward and bed configuration
4. `R3` Inpatient admission and initial bed assignment
5. `R4` Bed transfer
6. `R5` Discharge and bed release
7. `R6` Inpatient record and end-to-end hardening

`R1` and `R2` are technically independent after `R0`, but the recommended single-developer order is `R1` first because pharmacy already has active foundations. `R3` must wait for both `R1` and `R2`.

## R0: Shared Contracts, Permissions, and State Design

**Status:** Completed on 18 August 2026

**Depends on:** Existing HMS patient, branch, doctor, prescription, inventory, billing, document, RBAC, and audit foundations.

### Objective

Define shared contracts before creating new models or screens.

### Tasks

- Confirm existing identifiers for patients, branches, doctors, departments, prescriptions, inventory batches, invoices, documents, and audit records.
- Define prescription and dispensing states: draft, submitted, confirmed, cancelled, and reversed.
- Define ward, bed, admission, transfer, and discharge statuses.
- Decide whether cleaning is a new bed status or a blocked state with a reason.
- Define active-admission and active-bed uniqueness rules.
- Define branch-scope rules for every new query and mutation.
- Define permission module/screen/action entries and audit event names.
- Confirm MongoDB transaction support for multi-document operations.
- Inspect matching HMS Local prototype screens without modifying prototype files.

### Gate

- Statuses, ownership, permissions, scope, and transaction decisions are approved.
- No new model duplicates an existing patient, doctor, medicine, branch, or invoice model.

## R1: Pharmacy and Inventory Integration

**Status:** Completed on 18 August 2026

**Depends on:** `R0`

### Objective

Connect submitted e-prescriptions to a live pharmacy queue. Only confirmation may validate and deduct stock.

### Backend tasks

- Add a dispensing model linked to prescription, patient, visit, branch, medicine, batch, requested quantity, confirmed quantity, price, status, and reversal details.
- Add repository, service, routes, Zod schemas, indexes, permissions, and audit events.
- Add queue, detail, permitted-edit, confirm, cancel, and reverse operations.
- Validate branch scope from authenticated permissions, not frontend branch values.
- Atomically validate prescription state, batch state, available quantity, and branch before confirmation.
- Deduct stock exactly once and create the stock movement.
- Reject duplicate, stale, concurrent, or insufficient-stock confirmations safely.
- Ensure draft, unconfirmed, rejected, and cancelled prescriptions do not change stock.
- Restore only the quantity previously deducted when an authorized reversal occurs.
- Link confirmed dispensing to billing without duplicate invoice items.
- Audit confirmation, cancellation, reversal, deduction, restoration, and billing linkage.

### Frontend tasks

- Replace static pharmacy queue values with live APIs.
- Add permitted pharmacist editing, available-stock display, quantity validation, confirmation, cancellation, and reversal dialogs.
- Add loading, empty, error, success, and permission-denied states.
- Invalidate only affected prescription, dispensing, inventory, and billing queries.

### Acceptance and manual tests

- Submitted prescriptions appear in the queue.
- Confirming a valid quantity reduces the correct branch batch and creates the correct bill.
- Excess quantity is rejected with no stock change.
- Refresh/retry does not deduct twice.
- Unconfirmed/cancelled prescriptions do not affect stock.
- Authorized reversal restores stock and creates an audit entry.
- Unauthorized cancellation/reversal is denied.
- Two-branch tests prove scope isolation.

**R1 gate:** Completed before starting R2.

## R2: Branch-wise Ward and Bed Configuration

**Status:** Completed on 18 August 2026

**Depends on:** `R0`  
**Blocks:** `R3`

### Objective

Create the live branch-scoped ward and bed registry required for admission.

### Backend tasks

- Add ward fields: branch, name, type, floor, description, active status, and audit fields.
- Add bed fields: branch, ward, bed number/name, category, room number, status, active status, and audit fields.
- Add a unique index preventing duplicate bed identifiers within a branch and ward.
- Add paginated ward/bed queries, filters, availability, and summary counts.
- Add CRUD and status-change APIs with branch scope and permissions.
- Support `AVAILABLE`, `OCCUPIED`, `RESERVED`, `BLOCKED`, `UNDER_MAINTENANCE`, and `INACTIVE`.
- Audit creation, edits, activation, deactivation, and status changes.

### Frontend tasks

- Implement HMS Local-style ward and bed management screens.
- Add branch, ward, floor, type, room, category, status, and active filters.
- Display total, available, occupied, reserved, blocked, maintenance, and inactive counts.
- Add duplicate validation, confirmation dialogs, and all required page states.

### Acceptance and manual tests

- Authorized users can manage wards and beds only within permitted branches.
- Duplicate bed numbers/names are rejected.
- Ineligible beds cannot be selected for admission.
- Summary counts remain accurate after status changes.
- Deactivated wards/beds are unavailable for new assignments.

**Stop after R2 and wait for approval.**

## R3: Inpatient Admission and Initial Bed Assignment

**Status:** Completed on 18 Aug 2026

**Depends on:** `R1` and `R2`  
**Blocks:** `R4`, `R5`, and `R6`

### Objective

Admit an existing or newly registered patient into a branch, ward, and available bed with one consistent transaction.

### Tasks

- Add the inpatient admission model, lifecycle, repository, service, routes, schemas, permissions, indexes, and audit events.
- Reuse patient registration/search and existing doctor, department, branch, ward, and bed references.
- Validate admission date/time, type, reason, notes, and all referenced records.
- Create the admission and occupy the selected bed atomically.
- Prevent two active inpatients from holding one bed, including concurrent requests.
- Ensure draft admission cancellation leaves the bed available.
- Implement the HMS Local-style admission screen with live ward and bed availability.

### Manual tests

- Admit an existing patient and verify the assigned bed.
- Attempt occupied, reserved, blocked, maintenance, and inactive beds.
- Submit two assignments for the same bed and verify only one succeeds.
- Cancel a draft admission and verify the bed remains available.
- Re-login and verify patient, branch, ward, bed, doctor, department, and timestamps persist.

**Stop after R3 and wait for approval.**

## R4: Bed Transfer

**Status:** Not started

**Depends on:** `R3`

### Tasks

- Add transfer history model, repository, service, routes, schemas, permissions, and audit events.
- Support same-ward, same-branch cross-ward, and authorized cross-branch transfers.
- Validate destination availability immediately before confirmation.
- Atomically release the old bed and occupy the new bed.
- Require and retain reason, old/new branch, old/new ward, old/new bed, timestamp, and actor.
- Reject duplicate, stale, discharged, and concurrent transfers.
- Implement transfer confirmation and history UI.

### Manual tests

- Transfer within a ward and across wards.
- Reject unavailable destination beds.
- Reject unauthorized cross-branch transfer.
- Complete authorized cross-branch transfer.
- Verify both bed states and full history after refresh.

**Stop after R4 and wait for approval.**

## R5: Discharge and Bed Release

**Status:** Not started

**Depends on:** `R3` and `R4`

### Tasks

- Add discharge fields, states, schemas, routes, services, permissions, and audit events.
- Require discharge confirmation before changing admission or bed state.
- Change the occupied bed to available, or to an approved blocked/cleaning state.
- Store discharge date/time, reason, summary, actor, and billing references.
- Prevent duplicate discharge and invalid reversal.
- Require permission and reason for reopening/reversing a confirmed discharge.
- Ensure failed operations cannot leave admission and bed states inconsistent.
- Implement the discharge workspace.

### Manual tests

- Confirm discharge and verify bed release.
- Verify blocked/cleaning preparation if approved.
- Cancel a draft admission and verify no occupied bed remains.
- Reject unauthorized discharge reversal.
- Complete authorized reversal and verify audit details.
- Verify duplicate discharge is safely rejected.

**Stop after R5 and wait for approval.**

## R6: Inpatient Record and End-to-End Hardening

**Status:** Not started

**Depends on:** `R1` through `R5`

### Tasks

- Implement the inpatient profile/workspace using HMS Local inpatient patterns.
- Display patient/admission overview, branch, ward, room, current bed, doctors, and status.
- Display assignment and transfer history.
- Display prescriptions, dispensing, medication, stock-linked billing, charges, payments, and balances.
- Display clinical documents, lab reports, imaging reports, discharge details, and discharge summary.
- Add permission-gated tabs, branch scoping, timeline/audit display, and partial-data states.
- Remove prototype/mock data from all release workflows.
- Verify upload/download authorization for inpatient documents.
- Run the complete admission-to-discharge browser workflow.

### Manual tests

- Patient → admission → bed assignment → prescription → pharmacy confirmation → billing → transfer → documents/reports → discharge.
- Verify all state after logout and re-login.
- Verify branch isolation.
- Verify audit events for stock, assignment, transfer, discharge, reversal, and reopening.
- Verify rollback behavior for validation and transaction failures.
- Verify desktop and mobile layouts.

**Stop after R6 and prepare the release completion report.**

## Engineering Verification Per Phase

```powershell
npm run typecheck --workspace=@hms/api
npm run lint --workspace=@hms/api
npm run build --workspace=@hms/api
npm run typecheck --workspace=@hms/web
npm run lint --workspace=@hms/web
npm run build --workspace=@hms/web
```

Also verify the real browser workflow with MongoDB, API, web application, authentication, permissions, and persisted data. A successful build alone is not phase completion.

## Phase Completion Record

| Phase | Status | Approval date | Notes |
|---|---|---|---|
| R0 Shared contracts, permissions, state design | Completed | 18 Aug 2026 | Contract finalized in `NEXT_RELEASE_R0_FOUNDATION_CONTRACT.md`; embedded migration credential removed from current source and rotation required. |
| R1 Pharmacy and inventory integration | Completed | 18 Aug 2026 | Live dispensing aggregate, branch-scoped stock transactions, billing linkage, cancellation/reversal controls, queue UI, and manual verification documented in `NEXT_RELEASE_R1_VERIFICATION.md`. |
| R2 Ward and bed configuration | Completed | 18 Aug 2026 | Branch-scoped ward/bed registry, unique bed constraints, status and summary APIs, RBAC, live management UI, audit events, and manual verification documented in `NEXT_RELEASE_R2_VERIFICATION.md`. |
| R3 Admission and bed assignment | Completed | 18 Aug 2026 | Branch-scoped inpatient admission, validated live references, atomic available-bed assignment, duplicate-bed protection, RBAC, audit event, live admission UI, and manual verification documented in `NEXT_RELEASE_R3_VERIFICATION.md`. |
| R4 Bed transfer | Not started | - | - |
| R5 Discharge and bed release | Not started | - | - |
| R6 Inpatient record and hardening | Not started | - | - |

## Execution Rule

Start with `R0`. After each phase, update the completion record, attach manual test evidence, and wait for explicit approval. Never replace a missing backend API with mock data, local arrays, or localStorage persistence.
