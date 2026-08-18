# HMS Next Release R0 Foundation Contract

## Status

**Phase:** R0 - Shared Contracts, Permissions, and State Design  
**Status:** Completed  
**Completion date:** 18 August 2026

This contract governs R1 through R6. Feature implementation must follow [PROJECT_RULES.md](PROJECT_RULES.md), the existing repository architecture, and the current MongoDB/Mongoose, RBAC, audit, branch-scope, and API response patterns.

## Existing Records to Reuse

No new release domain may duplicate these existing records:

| Context | Existing source of truth |
|---|---|
| Patient | Existing `Patient` record and patient APIs |
| Branch | Existing `Branch` record and authenticated user branch assignments |
| Department | Existing `Department` record linked to a branch |
| Doctor | Existing `Doctor` record and doctor/department/branch relationships |
| OPD visit | Existing `OpdVisit` record |
| Prescription | Existing `OpdPrescription` record |
| Medicine | Existing medicine master |
| Inventory | Existing branch-specific pharmacy inventory and batch records |
| Stock history | Existing pharmacy stock movement records |
| Billing | Existing billing invoice, invoice item, payment, and receipt records |
| Documents | Existing patient document metadata and storage service |
| Audit | Existing `AuditLog` infrastructure |
| User access | Existing roles, permissions, branch assignments, and `requirePermission` middleware |

New records must reference these records by ObjectId and retain immutable snapshots only where historical accuracy requires them, such as names, numbers, prices, and bed labels at transaction time.

## Architecture Contract

Backend implementation order remains:

```text
Mongoose Model
-> Repository
-> Service
-> Fastify Route
-> Existing API Response Helper
```

Frontend implementation order remains:

```text
Page / Component
-> Feature Hook
-> Domain Hook
-> Domain Service
-> API Client
-> Backend
```

- Repositories are the only new layers allowed to query Mongoose models.
- Services own validation beyond schema shape, state transitions, branch scope, transactions, and audit decisions.
- Routes use strict Zod parsing, authentication, and the existing permission middleware.
- List endpoints are paginated and use projections and indexed filters.
- TanStack Query owns frontend server state with stable domain query keys and targeted invalidation.

## Pharmacy Contract

### Existing prescription lifecycle

The existing lifecycle is preserved and extended:

```text
DRAFT -> SUBMITTED -> DISPENSED
              |          |
              v          v
          CANCELLED   CANCELLED through authorized reversal
```

Approved prescription statuses for R1:

- `DRAFT`: Doctor-owned and editable; never visible as actionable pharmacy stock work.
- `SUBMITTED`: Clinically finalized and available to the authorized pharmacy queue.
- `DISPENSED`: Linked dispensing confirmation completed and stock deducted exactly once.
- `CANCELLED`: Cancelled before dispensing or closed by an authorized post-confirmation reversal.

The pharmacy may not modify the original clinical fields on a submitted prescription. Pharmacist changes are stored on the dispensing record as fulfillment details, preserving the doctor's source prescription.

### Dispensing lifecycle

Approved dispensing statuses:

- `DRAFT`: Pharmacist has selected fulfillment details; no stock or billing effect.
- `CONFIRMED`: Stock deducted exactly once and billable dispensing snapshot created.
- `CANCELLED`: Unconfirmed dispensing cancelled; no stock effect.
- `REVERSED`: Previously confirmed dispensing reversed; deducted stock restored exactly once.

Allowed transitions:

| From | To | Required permission | Stock effect | Billing effect |
|---|---|---|---|---|
| None | `DRAFT` | Pharmacy / Dispensing / Edit | None | None |
| `DRAFT` | `CONFIRMED` | Pharmacy / Dispensing / Dispense | Deduct once | Create/link pharmacy charge once |
| `DRAFT` | `CANCELLED` | Pharmacy / Dispensing / Cancel | None | None |
| `CONFIRMED` | `REVERSED` | Pharmacy / Dispensing / Reverse | Restore once | Cancel/remove unpaid charge atomically |

No transition out of `CANCELLED` or `REVERSED` is allowed in this release. A new clinical prescription is required for a new dispensing attempt.

### Dispensing record

The R1 model must include:

- `prescriptionId`, `patientId`, `visitId`, and `branchId`
- Source prescription status/version at confirmation
- Status and optimistic concurrency version
- Requested and confirmed item snapshots
- Medicine and selected batch references
- Requested quantity and confirmed quantity
- Strength, dosage, route, frequency, duration, and pharmacist instructions
- Unit price and line total captured at confirmation
- Confirmation, cancellation, and reversal actor/date/reason fields
- Linked invoice/invoice-item references where created
- Standard created/updated audit fields and soft-delete fields where the existing domain pattern requires them

Each confirmed item must preserve the source prescription item ID and medicine/batch references. Free-text medicine names may remain in the clinical snapshot, but stock-changing items must resolve to an active medicine master and active branch batch.

### Pharmacy invariants

- Only `CONFIRMED` creates stock-out movement and billing effect.
- Confirmation is idempotent and accepts an idempotency key.
- The idempotency key is unique within the branch and dispensing operation.
- A conditional batch update must require sufficient quantity and an active, non-expired batch.
- Prescription, dispensing, batch, inventory summary, stock movement, and billing changes occur in one MongoDB transaction.
- Reversal has its own idempotency key and restores no more than the original confirmed quantity.
- Partial payments or paid invoices block dispensing reversal until a refund workflow is explicitly implemented.
- An unpaid `DRAFT` or `PENDING` linked invoice may be cancelled/adjusted in the reversal transaction.
- The source prescription becomes `DISPENSED` only after confirmation succeeds.
- Cancellation before confirmation and reversal after confirmation set the source prescription to `CANCELLED`.
- Failed confirmation or reversal leaves prescription, stock, dispensing, and billing unchanged.

## Ward and Bed Contract

### Ward lifecycle

Approved ward statuses:

- `ACTIVE`
- `INACTIVE`

Ward fields:

- `branchId`
- `name`
- `wardType`
- `floor`
- `description`
- `status`
- Created/updated/deleted audit fields

`wardType` is a normalized, validated string in this release because no approved ward-type master exists. It must not be hardcoded to production values in the frontend.

Ward names must be unique within a branch among non-deleted records using a normalized name key.

### Bed lifecycle

Approved bed statuses:

- `AVAILABLE`
- `OCCUPIED`
- `RESERVED`
- `BLOCKED`
- `UNDER_MAINTENANCE`
- `INACTIVE`

No separate `CLEANING` status is introduced. Cleaning/preparation uses:

```text
status = BLOCKED
blockReasonCode = CLEANING
```

Bed fields:

- `branchId` and `wardId`
- `bedNumber` or bed name plus normalized unique key
- `bedType`
- Optional `roomNumber`
- `status`
- Optional `blockReasonCode` and `statusReason`
- Optional `currentAdmissionId`
- Status-change actor/date
- Created/updated/deleted audit fields

`bedType` is a normalized, validated string until an approved bed-type master exists.

Required unique index:

```text
branchId + wardId + normalizedBedNumber
```

### Bed eligibility

Only a bed satisfying all of the following is assignable:

- Bed status is `AVAILABLE`.
- `currentAdmissionId` is null.
- Bed is not deleted.
- Ward status is `ACTIVE` and ward is not deleted.
- Branch is active.
- User is authorized for the branch.

Manual status changes to `AVAILABLE` or away from `OCCUPIED` are prohibited while `currentAdmissionId` exists. Admission, transfer, and discharge services own occupied-bed transitions.

## Inpatient Admission Contract

Approved admission statuses:

- `DRAFT`
- `ADMITTED`
- `DISCHARGE_PENDING`
- `DISCHARGED`
- `CANCELLED`

`TRANSFER_PENDING` is not an admission status. Transfer is a separate transaction and the admission remains `ADMITTED` while a transfer request is pending.

Admission fields include:

- Admission number and patient reference
- Branch, department, admitting doctor, and treating doctor references
- Admission type, reason, clinical/operational notes
- Admission date/time
- Current ward, room snapshot, and bed references
- Status and optimistic concurrency version
- Discharge date/time and summary references when completed
- Created/updated/cancelled actor/date/reason fields

Only one active admission is allowed per patient. The implementation must enforce this at database level using an active-admission unique key that exists only while status is `ADMITTED` or `DISCHARGE_PENDING`.

Draft admission creation does not occupy a bed. Final admission confirmation atomically:

1. Validates patient, branch, doctor, department, ward, and bed.
2. Claims the bed using a conditional `AVAILABLE` plus null-assignment update.
3. Sets the admission to `ADMITTED`.
4. Stores current ward and bed references.
5. Creates assignment history and audit events.

## Transfer Contract

Approved transfer statuses:

- `PENDING`
- `COMPLETED`
- `CANCELLED`

Transfer fields include old/new branch, ward, room, and bed references/snapshots; requested and completed date/time; reason; status; requester; approver/completer; and audit fields.

- Same-ward and same-branch transfers use the standard transfer permission.
- Cross-branch transfer requires the explicit cross-branch permission and authorization for both source and destination branches.
- `PENDING` has no bed-state effect.
- Completion atomically claims the destination, releases the source, updates the admission, and writes history/audit.
- The destination must still be eligible at confirmation time.
- Failed completion leaves both bed assignments unchanged.

## Discharge Contract

Approved discharge statuses:

- `DRAFT`
- `CONFIRMED`
- `REVERSED`

- A draft discharge sets the admission to `DISCHARGE_PENDING` but does not release the bed.
- Confirmation stores the discharge summary and date/time, sets admission to `DISCHARGED`, and releases the bed atomically.
- The release target is `AVAILABLE` unless cleaning/preparation is required.
- Cleaning/preparation sets the bed to `BLOCKED` with `blockReasonCode = CLEANING` and clears `currentAdmissionId`.
- Reversal requires permission, a reason, and a currently available eligible bed. It must not silently reclaim a bed assigned to another patient.
- If the original bed is unavailable, reversal is rejected; a separately authorized readmission is required.
- Draft admission cancellation does not modify bed state because draft admissions never claim beds.

## Entity Relationships

```text
Patient 1 ---- * InpatientAdmission
Branch  1 ---- * Ward
Ward    1 ---- * Bed
Bed     1 ---- 0..1 active InpatientAdmission

InpatientAdmission 1 ---- * BedAssignmentHistory
InpatientAdmission 1 ---- * BedTransfer
InpatientAdmission 1 ---- 0..1 confirmed Discharge

OpdPrescription 1 ---- 0..1 active PharmacyDispensing
PharmacyDispensing 1 ---- * DispensingItem
DispensingItem * ---- 1 Medicine
DispensingItem * ---- 1 PharmacyMedicineBatch
PharmacyDispensing 1 ---- * StockMovement
PharmacyDispensing 1 ---- 0..1 BillingInvoice

InpatientAdmission * ---- 1 Patient
InpatientAdmission * ---- 1 Branch
InpatientAdmission * ---- 1 Department
InpatientAdmission * ---- 1 admitting Doctor
```

Documents, lab reports, imaging reports, prescriptions, and billing records remain in their existing domains and are queried by patient/admission/visit references for the inpatient workspace.

## Permission Matrix

All permissions are system permissions in the existing `module / screen / action` format.

### Pharmacy permissions

| Module | Screen | Action | Purpose |
|---|---|---|---|
| Pharmacy | Dispensing | View | View branch-scoped pharmacy queue/details |
| Pharmacy | Dispensing | Edit | Save permitted fulfillment details without stock effect |
| Pharmacy | Dispensing | Dispense | Confirm dispensing and deduct stock |
| Pharmacy | Dispensing | Cancel | Cancel an unconfirmed dispensing/prescription |
| Pharmacy | Dispensing | Reverse | Reverse confirmed dispensing and restore stock |

Existing `UpdateStatus` remains for backward compatibility during R1 but must not authorize cancellation or reversal. Existing inventory permissions remain unchanged.

### Admissions permissions

| Module | Screen | Actions |
|---|---|---|
| Admissions | Wards | View, Create, Edit, Activate, Deactivate |
| Admissions | Beds | View, Create, Edit, ChangeStatus, Activate, Deactivate |
| Admissions | Inpatient Admissions | View, Create, EditDraft, Admit, CancelDraft |
| Admissions | Bed Transfers | View, Create, Complete, Cancel, CrossBranch |
| Admissions | Discharge | View, Create, Confirm, Reverse |
| Admissions | Inpatient Records | View |

Permissions must be seeded in their owning implementation phase before routes or navigation depend on them. No role receives new permissions merely because of its display name. Role assignments must follow existing database-backed RBAC.

## Branch-Scope Contract

- Every list query is filtered to active branches assigned to the authenticated user.
- Super Administrator follows the existing unrestricted branch convention.
- A requested branch ID is validated for existence, active state, and user assignment.
- Every referenced ward, bed, admission, prescription, dispensing, batch, invoice, doctor, and department must belong to the validated branch context.
- Cross-branch transfer validates authorization for both branches.
- A 403 `BRANCH_ACCESS_DENIED` response is used for unauthorized active branches without leaking branch-owned record details.
- Branch denial is audited through the existing audit infrastructure.
- Frontend branch selectors never grant access and must not issue disabled/unauthorized queries.

## Audit Event Contract

Required R1 events:

- `pharmacy.dispensing.draft_saved`
- `pharmacy.dispensing.confirmed`
- `pharmacy.dispensing.cancelled`
- `pharmacy.dispensing.reversed`
- Existing stock movement event plus dispensing reference
- `pharmacy.dispensing.invoice_linked`
- `pharmacy.dispensing.permission_denied`

Required R2-R5 events:

- `admissions.ward.created`, `updated`, `activated`, `deactivated`
- `admissions.bed.created`, `updated`, `status_changed`, `activated`, `deactivated`
- `admissions.inpatient.draft_created`, `admitted`, `draft_cancelled`
- `admissions.transfer.requested`, `completed`, `cancelled`
- `admissions.discharge.draft_created`, `confirmed`, `reversed`
- `admissions.permission_denied` and `admissions.branch_access_denied`

Audit metadata for state-changing events must include:

- Actor user ID, IP address, and user agent through existing metadata patterns
- Patient, branch, admission/prescription/dispensing/invoice identifiers as applicable
- Previous status and new status
- Previous and new ward/bed or stock quantities where applicable
- Required reason for cancellation, reversal, transfer, block, maintenance, and discharge reopening
- Idempotency key/reference for retry-safe financial, stock, admission, transfer, and discharge operations

Do not log tokens, secrets, full clinical notes, full medical records, private file URLs, or connection strings.

## API Contract Outline

All endpoints use `/api`, existing success/error envelopes, strict Zod validation, authentication, RBAC, branch scope, and pagination for lists.

### R1 pharmacy endpoints

```text
GET    /api/pharmacy/dispensings
GET    /api/pharmacy/dispensings/:id
PUT    /api/pharmacy/dispensings/:id
POST   /api/pharmacy/dispensings/:id/confirm
POST   /api/pharmacy/dispensings/:id/cancel
POST   /api/pharmacy/dispensings/:id/reverse
```

Queue creation may be lazy from submitted prescriptions, but there must be only one non-terminal dispensing per prescription.

### R2 ward and bed endpoints

```text
GET    /api/admissions/wards
POST   /api/admissions/wards
GET    /api/admissions/wards/:id
PATCH  /api/admissions/wards/:id
POST   /api/admissions/wards/:id/activate
POST   /api/admissions/wards/:id/deactivate

GET    /api/admissions/beds
POST   /api/admissions/beds
GET    /api/admissions/beds/:id
PATCH  /api/admissions/beds/:id
POST   /api/admissions/beds/:id/status
GET    /api/admissions/beds/summary
```

### R3-R6 inpatient endpoints

```text
GET    /api/admissions/inpatients
POST   /api/admissions/inpatients
GET    /api/admissions/inpatients/:id
PATCH  /api/admissions/inpatients/:id
POST   /api/admissions/inpatients/:id/admit
POST   /api/admissions/inpatients/:id/cancel

GET    /api/admissions/inpatients/:id/transfers
POST   /api/admissions/inpatients/:id/transfers
POST   /api/admissions/inpatients/:id/transfers/:transferId/complete
POST   /api/admissions/inpatients/:id/transfers/:transferId/cancel

GET    /api/admissions/inpatients/:id/discharge
PUT    /api/admissions/inpatients/:id/discharge
POST   /api/admissions/inpatients/:id/discharge/confirm
POST   /api/admissions/inpatients/:id/discharge/reverse
```

The inpatient detail response may compose existing authorized domain services, but controllers/routes must not query models and admission repositories must not absorb pharmacy, billing, laboratory, imaging, or document business logic.

## Error Code Contract

At minimum, implementations must use stable errors for:

- `BRANCH_ACCESS_DENIED`
- `INVALID_STATE_TRANSITION`
- `IDEMPOTENCY_CONFLICT`
- `PRESCRIPTION_NOT_ACTIONABLE`
- `DISPENSING_ALREADY_CONFIRMED`
- `INSUFFICIENT_STOCK`
- `DISPENSING_REVERSAL_NOT_ALLOWED`
- `PAID_DISPENSING_REVERSAL_REQUIRES_REFUND`
- `DUPLICATE_WARD_NAME`
- `DUPLICATE_BED_NUMBER`
- `BED_NOT_AVAILABLE`
- `BED_ASSIGNMENT_CONFLICT`
- `PATIENT_ALREADY_ADMITTED`
- `ADMISSION_NOT_ACTIVE`
- `TRANSFER_DESTINATION_UNAVAILABLE`
- `DISCHARGE_ALREADY_CONFIRMED`
- `DISCHARGE_REVERSAL_BED_UNAVAILABLE`

Validation failures use the existing validation response format and do not expose MongoDB errors or internal identifiers unnecessarily.

## Transaction and Concurrency Contract

- Reuse the existing Mongoose connection; never create another connection.
- Multi-document stock, billing, admission, transfer, and discharge operations require `startSession()` and `withTransaction()` following current service patterns.
- The deployment must provide transaction-capable MongoDB topology. This is already an architectural requirement because current pharmacy inventory and billing services use transactions.
- Conditional updates and unique indexes remain mandatory even inside transactions.
- Every retry-sensitive command uses an idempotency key and returns the original result when replayed with the same payload.
- Reuse of an idempotency key with a different payload returns `IDEMPOTENCY_CONFLICT`.
- Optimistic version checks prevent stale edits to dispensing, admission, transfer, and discharge records.

## Security Decisions

- Backend authorization remains authoritative; frontend gating is supplementary.
- Patient, branch, role, permission, department, doctor, pricing, quantity, stock, and status values from the frontend are untrusted.
- Prices are resolved from persisted batch/catalogue data at confirmation time.
- Available quantity is checked in the transaction, not trusted from a previously rendered screen.
- Cancellation, reversal, transfer, discharge, and status-change reasons are validated and audited.
- Sensitive patient data is projected only where required by the active screen.
- No private file URL is returned without document authorization.
- The repository scan found an embedded database credential in a migration utility. The utility now uses the existing environment-based database connection and no longer logs the connection string. The exposed credential must be rotated outside the codebase because source removal does not revoke it or remove it from history.

## R0 Completion Gate

R0 is complete because this document now provides:

- Approved state maps
- Approved entity relationships
- Approved permission matrix
- Approved branch-scope and audit contracts
- Approved API outline and error codes
- Approved transaction, idempotency, and concurrency rules
- Explicit security decisions
- Dependency ownership for R1 through R6

R0 does not seed permissions or create feature models/routes. Those changes belong to the owning implementation phase so no unavailable navigation or authorization surface is exposed early.

