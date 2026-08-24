# HMS Scope 2 Phase 3 - Reconciled Contract

## Status

**Phase:** P3-0 - Shortened Contract Reconciliation  
**Status:** Completed  
**Completion date:** 21 August 2026

This contract supplements `NEXT_RELEASE_R0_FOUNDATION_CONTRACT.md`. R0 remains authoritative for existing patient, pharmacy, ward, bed, admission, transfer, discharge, RBAC, audit, transaction, and branch-scope decisions.

The supplied Phase 3 prompt is the controlling functional source for the new hold, consent/deposit, Surgery, and Emergency decisions because the referenced `doc/HMS_Release2_FSD.docx` is not currently present. If that FSD is later supplied and conflicts with this contract, implementation must stop for reconciliation rather than silently changing behavior.

## Reused R0 Decisions

The following decisions are not reopened:

- MongoDB/Mongoose and the existing connection are the only persistence strategy.
- `CLEANING` is represented by bed status `BLOCKED` with `blockReasonCode = CLEANING`.
- Draft admissions do not occupy beds.
- Only one active admission is allowed per patient.
- Final admission, transfer, discharge, and reversal operations follow the R0 transaction and concurrency rules.
- Transfer remains a separate aggregate; an admission remains `ADMITTED` while a transfer is pending.
- Patient, branch, department, doctor, OPD visit, prescription, inventory, billing, documents, and audit records are reused.
- Backend RBAC and branch/department scope remain authoritative.
- Existing R0 permissions, audit events, error codes, API outline, and security requirements remain the baseline.

## New Branch Admission Policy

Consent, deposit, and hold behavior must be configured by the backend for each branch. Frontend flags are never authoritative.

The admissions domain will own one active policy per branch with:

- `branchId`
- `bedHoldDurationMinutes`, an integer from 5 through 240
- `admissionConsentRequired`
- `admissionAdvanceDepositRequired`
- `admissionMinimumDepositAmount`, a non-negative amount in the configured hospital currency
- Standard status, version, created/updated actor, and timestamps

There is no silent production default. A branch must have an explicit active policy before a hold or admission confirmation is allowed. Missing policy returns `ADMISSION_POLICY_NOT_CONFIGURED`.

Policy changes affect new holds and confirmations only. A hold snapshots its expiry; an admission confirmation snapshots the consent/deposit requirements it satisfied.

## Bed Hold Contract

### Purpose

A hold temporarily reserves one eligible bed while reception completes patient validation, consent, deposit, and admission confirmation.

### Lifecycle

Approved statuses:

- `ACTIVE`
- `CONSUMED`
- `RELEASED`
- `EXPIRED`
- `CANCELLED`

Allowed transitions:

```text
None -> ACTIVE
ACTIVE -> CONSUMED
ACTIVE -> RELEASED
ACTIVE -> EXPIRED
ACTIVE -> CANCELLED
```

Terminal holds cannot be reopened. A new hold is required.

### Required Fields

- Hold number and idempotency key
- Patient and branch references
- Optional admission request/admission reference while the request is being prepared
- Ward and bed references plus immutable ward/room/bed snapshots
- Status, version, held-at timestamp, and expires-at timestamp
- Created/updated/released/cancelled/consumed actor and timestamp fields
- Release/cancellation reason where applicable

### Bed State

- Creating an active hold conditionally changes an eligible bed from `AVAILABLE` to `RESERVED` and stores `currentHoldId`.
- Consuming a hold during admission atomically changes the bed from `RESERVED` to `OCCUPIED`, clears `currentHoldId`, and sets `currentAdmissionId`.
- Releasing, cancelling, or expiring a hold conditionally changes the bed from `RESERVED` to `AVAILABLE` and clears `currentHoldId`.
- A hold operation must never change a bed owned by another active hold or admission.
- Manual bed status changes cannot bypass `currentHoldId` or `currentAdmissionId`.

### Expiry

- `expiresAt` is calculated from the branch policy when the hold is created.
- Expiry is enforced authoritatively on every availability, hold, allotment, and confirmation path.
- P3-1 must use the existing project job pattern if one exists. If none exists, request-time expiry with indexed cleanup is the approved minimum; no Redis, cache, or second database connection may be added.
- Extension is not included in P3-1. Release and create a new hold instead, preventing indefinite reservation.

### Concurrency and Idempotency

- One active hold or active admission may own a bed.
- Conditional updates, an active-owner uniqueness constraint, optimistic version checks, and a MongoDB transaction are required.
- Replaying the same idempotency key and payload returns the original hold/result.
- Reusing the key with different input returns `IDEMPOTENCY_CONFLICT`.

## Consent Prerequisite Contract

The existing patient document/consent storage is reused and extended; no second consent file system is created.

### Context

Consent metadata must be able to identify:

- `contextType`: `INPATIENT_ADMISSION` or `PROCEDURE_BOOKING`
- `contextId`: the admission request/admission or procedure booking identifier
- `consentKind`: approved admission or procedure consent kind

The existing OPD `visitId` remains unchanged for existing documents. New context fields are optional for old records and required for new admission/procedure consents.

### Valid Consent

A consent satisfies a mandatory prerequisite only when:

- It belongs to the same patient.
- Its document type is `CONSENT`.
- Its context type and context ID match the current workflow.
- Its status is `SIGNED`.
- `signedAt` is present and not in the future.
- `validUntil` is absent or not expired.
- `signedByName` is present.
- The document is active and accessible to the authenticated user.

Admission/procedure confirmation snapshots the consent document ID, kind, signed date, and requirement result. Later replacement or deletion does not rewrite historical confirmation evidence, though document access remains permission-controlled.

If consent is mandatory and no valid contextual consent exists, confirmation returns `CONSENT_REQUIRED`. The frontend may display the requirement but cannot override it.

## Advance Deposit Contract

Billing/payment remains owned by the existing Billing domain. Admissions and Surgery must not query Billing models or implement payment collection internally.

### Required Billing Integration

Before P3-2 confirmation can enforce a mandatory deposit, the Billing owner must expose an authorized service/API contract that resolves, for an admission request or procedure booking:

- Patient and branch
- Source context type and ID
- Required amount and configured currency
- Paid amount
- Remaining amount
- Whether the prerequisite is satisfied
- Related invoice and payment references

The admission/procedure service calls the Billing service and treats its result as authoritative. Frontend payment values and receipt numbers are untrusted.

### Rules

- When the branch/service policy marks deposit as optional, confirmation does not require a payment record.
- When mandatory, `paidAmount >= requiredAmount` is required.
- Zero required amount is valid only when explicitly configured.
- Confirmation snapshots required amount, paid amount, invoice ID, payment references, and verification timestamp.
- Cancellation, refund, reversal, and invoice mutation remain Billing-owned workflows.
- If mandatory deposit is configured but the Billing verification contract is unavailable, confirmation fails closed with `DEPOSIT_VERIFICATION_UNAVAILABLE`.
- An unmet requirement returns `ADVANCE_DEPOSIT_REQUIRED`.

## Generic Admission Source Contract

Admission recommendations and conversions use one source-neutral reference:

- `DIRECT`
- `OPD_VISIT`
- `EMERGENCY_ENCOUNTER`
- `PROCEDURE_BOOKING`

The admission request stores `sourceType`, `sourceId`, patient, branch, department, recommending doctor, reason, priority, and source snapshot.

At most one non-cancelled admission request and one successful admission conversion may exist for the same source context. Conditional updates and unique indexes enforce this rule.

P3-2 implements `DIRECT` and `OPD_VISIT`. P3-5 adds the `EMERGENCY_ENCOUNTER` adapter after Emergency exists. Procedure admission uses the same contract after P3-3.

## Surgery and Procedure Contract

### Existing Domains to Reuse

- Patient and encounter context
- Doctor and availability
- Department
- Service catalogue
- Appointment date/time utilities and conflict patterns
- P3-1 bed hold/allotment
- Existing consent, billing, audit, RBAC, and timeline infrastructure

### Procedure Service Configuration

The existing Service Catalogue is extended instead of creating a second procedure master.

- Add `PROCEDURE` to the approved service type.
- A procedure service has `defaultDurationMinutes` from 5 through 720.
- `bookingCapacity` is an integer from 1 through 100 for overlapping bookings of that service.
- `requiresBed`, `requiresConsent`, and `requiresAdvanceDeposit` are backend configuration.
- `minimumAdvanceDepositAmount` is required and non-negative when advance deposit is mandatory.
- Department, price, active status, and audit fields continue to come from the existing service record.

### Recommendation Lifecycle

Approved statuses:

- `ACTIVE`
- `BOOKED`
- `CANCELLED`

A doctor creates an active recommendation linked to a patient and clinical encounter. Booking consumes the recommendation. Cancellation requires a reason.

### Booking Lifecycle

Approved statuses:

- `PENDING_CONFIRMATION`
- `BOOKED`
- `COMPLETED`
- `CANCELLED`

Reschedule is an audited operation, not a status. A reschedule keeps the booking `BOOKED` and appends old/new schedule history.

Allowed transitions:

```text
None -> PENDING_CONFIRMATION
PENDING_CONFIRMATION -> BOOKED
PENDING_CONFIRMATION -> CANCELLED
BOOKED -> BOOKED through authorized reschedule
BOOKED -> COMPLETED
BOOKED -> CANCELLED
```

No full OT, anesthesia, intra-operative, or ward-nursing state is introduced in this release.

### Booking Rules

- Only active `PROCEDURE` services and active doctors in the selected branch/department are valid.
- Doctor availability and leave/exception rules are checked for the entire interval.
- An active doctor cannot have overlapping active appointments or procedure bookings.
- Overlapping active bookings for a service cannot exceed its configured booking capacity.
- One patient cannot have duplicate active bookings for the same recommendation.
- A required bed uses P3-1 availability/hold, never a direct bed status update.
- Mandatory contextual consent and deposit must be satisfied before `BOOKED`.
- Reschedule requires a reason, revalidates all conflicts/prerequisites, and atomically updates held resources.
- Cancellation requires a reason and releases any active bed hold in the same transaction/consistent command.

### Procedure Permissions

Use the existing module/screen/action permission pattern:

- Surgery / Recommendations / View, Create, Cancel
- Surgery / Bookings / View, Create, Confirm, Reschedule, Cancel, Complete
- Surgery / Schedule / View

Final seed names must match these values so frontend and backend do not diverge.

## Emergency Contract

### Patient Identity

- Search and reuse an existing Patient whenever one can be identified.
- An Emergency encounter may temporarily have no `patientId` when identity is incomplete.
- Provisional identity is stored only on the Emergency encounter using a generated emergency identifier, display name/description, estimated age where known, gender where known, contact where known, and identity notes.
- Do not create a fake or incomplete Patient merely to satisfy Emergency registration.
- An authorized patient-link action later attaches one existing/registered Patient and records before/after identity audit history.
- Once downstream clinical or financial records exist, changing the linked patient requires an explicit restricted correction workflow; ordinary edit cannot relink it.

### Triage Levels

The HMS Local five-level model is approved:

- `LEVEL_1_CRITICAL`
- `LEVEL_2_HIGH`
- `LEVEL_3_MEDIUM`
- `LEVEL_4_LOW`
- `LEVEL_5_NON_URGENT`

Queue ordering is triage level first and arrival time second. Manual priority override requires permission, reason, and audit history.

### Encounter Lifecycle

Approved statuses:

- `REGISTERED`
- `WAITING_FOR_TRIAGE`
- `TRIAGED`
- `WAITING_FOR_DOCTOR`
- `IN_CONSULTATION`
- `IN_TREATMENT`
- `READY_FOR_DISPOSITION`
- `DISCHARGED`
- `TRANSFERRED`
- `CONVERTED_TO_IP`
- `LEFT`
- `NO_SHOW`
- `CANCELLED`

Terminal states are `DISCHARGED`, `TRANSFERRED`, `CONVERTED_TO_IP`, `LEFT`, `NO_SHOW`, and `CANCELLED`.

Skipping a called patient returns the encounter to an eligible waiting state while retaining queue history. `NO_SHOW`, `LEFT`, cancellation, discharge, transfer, and conversion require the approved reason/summary fields and audit event.

### Assessment and Clinical Context

- Triage records priority, area, nurse, assessment time, pain score, vitals, ABCDE assessment, notes, and authorized attachments.
- Doctor evaluation records assigned doctor, consultation time, chief complaint, history, examination, diagnosis, plan, treatment, and notes.
- Clinical notes remain in their owning Emergency repository and are not written to audit logs.

### Downstream Orders

Existing Pharmacy, Laboratory, Imaging, Billing, Documents, and EMR domains are reused.

Their contracts must support a source context containing `sourceType = EMERGENCY_ENCOUNTER` and `sourceId`. Current OPD-only required visit/consultation references cannot be faked. The owning domain must add a compatible source reference before Emergency submits that order type.

Developer 1 integrates through owning services/hooks and does not query or mutate downstream models directly.

### Disposition

Approved decisions:

- `DISCHARGE`
- `ADMIT`
- `TRANSFER`
- `LEFT`

`ADMIT` first moves the encounter to `READY_FOR_DISPOSITION`/conversion-ready behavior and then uses the generic P3-2 admission request. P3-5 atomically or consistently completes the source encounter as `CONVERTED_TO_IP` only after admission confirmation succeeds.

Emergency discharge must store summary, instructions, doctor, timestamp, and authoritative Billing status result. If the approved Billing closure rule is unavailable, the action fails closed rather than inventing a payment state.

### Emergency Permissions

- Emergency / Encounters / View, Register, Edit
- Emergency / Triage / View, Assess, OverridePriority
- Emergency / Consultation / View, Edit
- Emergency / Orders / View, Create
- Emergency / Disposition / View, Discharge, Transfer, ConvertToIP, MarkLeft, MarkNoShow, Cancel
- Emergency / Patient Linking / Link, Correct

## Cross-Module Dependencies

The following dependencies must be available before their consuming phase can pass acceptance:

| Dependency | Owner | Required by |
|---|---|---|
| Context-bound consent metadata and lookup | Existing Patients/Documents domain, minimal shared extension | P3-2 and P3-3 |
| Admission/procedure deposit verification | Billing owner | P3-2 and P3-3 |
| `PROCEDURE` service configuration | Service Catalogue owner/shared foundation | P3-3 |
| Emergency source context for prescriptions/orders | Pharmacy, Laboratory, and Imaging owners | P3-4/P3-5 |
| Emergency billing closure status | Billing owner | P3-4 |
| Emergency document context | Patient Documents owner | P3-4 |

Missing dependencies are blockers. Developer 1 must not replace them with local arrays, frontend flags, direct model access, or duplicate modules.

## New Error Codes

- `ADMISSION_POLICY_NOT_CONFIGURED`
- `BED_HOLD_NOT_FOUND`
- `BED_HOLD_EXPIRED`
- `BED_HOLD_CONFLICT`
- `BED_HOLD_NOT_ACTIVE`
- `CONSENT_REQUIRED`
- `ADVANCE_DEPOSIT_REQUIRED`
- `DEPOSIT_VERIFICATION_UNAVAILABLE`
- `ADMISSION_SOURCE_ALREADY_CONVERTED`
- `PROCEDURE_RECOMMENDATION_NOT_ACTIONABLE`
- `PROCEDURE_BOOKING_CONFLICT`
- `PROCEDURE_SERVICE_CAPACITY_EXCEEDED`
- `PROCEDURE_PREREQUISITE_NOT_MET`
- `EMERGENCY_ENCOUNTER_NOT_ACTIONABLE`
- `EMERGENCY_PATIENT_LINK_CONFLICT`
- `EMERGENCY_SOURCE_CONTEXT_UNSUPPORTED`
- `EMERGENCY_DISPOSITION_NOT_ALLOWED`

Existing R0 error codes remain unchanged.

## New Audit Events

### Holds

- `admissions.bed_hold.created`
- `admissions.bed_hold.consumed`
- `admissions.bed_hold.released`
- `admissions.bed_hold.expired`
- `admissions.bed_hold.cancelled`

### Admission prerequisites and source

- `admissions.request.created`
- `admissions.request.cancelled`
- `admissions.consent.verified`
- `admissions.deposit.verified`
- `admissions.source.converted`

### Surgery/procedure

- `surgery.recommendation.created`
- `surgery.recommendation.cancelled`
- `surgery.booking.created`
- `surgery.booking.confirmed`
- `surgery.booking.rescheduled`
- `surgery.booking.cancelled`
- `surgery.booking.completed`

### Emergency

- `emergency.encounter.registered`
- `emergency.patient.linked`
- `emergency.patient.corrected`
- `emergency.triage.completed`
- `emergency.priority.overridden`
- `emergency.consultation.updated`
- `emergency.disposition.confirmed`
- `emergency.encounter.discharged`
- `emergency.encounter.transferred`
- `emergency.encounter.converted_to_ip`
- `emergency.encounter.left`
- `emergency.encounter.no_show`
- `emergency.encounter.cancelled`

Audit metadata contains identifiers, status transitions, actor, timestamp, and required reason. It must not contain full triage notes, clinical notes, diagnosis narratives, or other sensitive record bodies.

## P3-0 Completion Gate

P3-0 is complete because:

- Existing R0 decisions were reused without redesign.
- Bed hold behavior and concurrency are defined.
- Consent is context-bound to admission/procedure workflows.
- Advance deposit is explicitly Billing-owned and fails closed when verification is unavailable.
- Procedure service configuration, recommendation, booking, conflict, reschedule, cancellation, and status rules are defined.
- Emergency provisional identity, triage, encounter, order context, disposition, and IP conversion boundaries are defined.
- Shared dependencies and blockers are explicit.
- No feature model, route, navigation item, mock API, or production behavior was added during reconciliation.

