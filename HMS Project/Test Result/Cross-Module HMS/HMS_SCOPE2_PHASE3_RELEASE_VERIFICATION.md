# HMS Scope 2 Phase 3 Release Verification

**Phase:** P3-6 Developer 1 End-to-End Hardening and Release Validation  
**Status:** Completed  
**Completion date:** 24 August 2026  
**Next phase:** Not started

## Scope Verified

- Branch-scoped ward, bed, hold, allotment, transfer, release and bed-board behavior.
- Admission recommendation/request, validation, consent and deposit prerequisites, confirmation, cancellation and encounter conversion.
- Procedure recommendation, booking, confirmation, scheduling, rescheduling and cancellation.
- Emergency registration, triage, consultation, downstream orders, disposition, discharge and inpatient conversion.
- RBAC, branch scope, lifecycle conflicts, duplicate prevention, transactions, idempotency, audit events and Patient EMR events.
- Live API-backed React routes, standard UI states and absence of phase-owned mock/browser-persisted data.

## Hardening Fixes

P3-6 reproduced and fixed these release-owned defects:

1. Nullable unique fields used sparse indexes, allowing `null` values to collide in MongoDB. Admission request source keys, admission request links, Emergency conversion links, and OPD appointment/admission links now use typed partial unique indexes.
2. Bed transfer claimed the destination before releasing the source, conflicting with admission ownership uniqueness. Transfer completion now releases and claims sequentially inside one transaction; any failed claim rolls back the source release.
3. Surgery reference lookups used concurrent operations on one MongoDB-compatible session. Reference reads are now sequential within the transaction.
4. Admissions and Surgery route-level Zod failures could surface as `INTERNAL_ERROR`. They now return HTTP 400 with `VALIDATION_ERROR` and flattened field details.
5. Surgery list status filtering accepted arbitrary strings. It now uses the approved recommendation and booking status enums.

## Existing Functionality Reused

- Existing authentication, database-loaded RBAC, branch authorization and request metadata.
- Mongoose repositories, MongoDB sessions, audit repository and Patient EMR timeline service.
- Existing Patient, Doctor, Department, OPD, Billing, Pharmacy, Laboratory, Imaging and Service Catalogue contracts.
- Existing React API clients, domain services, TanStack Query hooks, React Hook Form/Zod forms, Sonner feedback and HMS Local visual patterns.

## Files Changed During P3-6

- `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts`
- `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.model.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts`
- `apps/api/src/modules/surgery/surgery.repository.ts`
- `apps/api/src/modules/surgery/surgery.routes.ts`
- `apps/api/src/modules/surgery/surgery.schemas.ts`
- `apps/api/src/modules/emergency/emergency.model.ts`
- `apps/api/src/modules/opd/opd-visit.model.ts`
- `HMS_SCOPE2_PHASE3_P6_GAP_NOTE.md`
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md`
- `HMS_SCOPE2_PHASE3_RELEASE_VERIFICATION.md`

The model changes are shared integration changes required to preserve uniqueness across Admissions, Emergency and OPD. No Developer 2 workflow was redesigned.

## Live Validation Results

Controlled fixtures were exercised against the running API and MongoDB, inspected for persisted relationships/audit/timeline events, and removed afterward.

### Bed And Admission

| Case | Result |
|---|---|
| Duplicate bed number | `409` |
| Idempotent hold replay | `200` |
| Competing hold on the same bed | `409` |
| Hold release | `200` |
| Admission confirmation retry | `200`, same admission ID |
| Duplicate active admission | `409` |
| Competing transfer destination | `409` |
| Completed transfer retry | Rejected without a second transition |
| Cross-branch transfer | Admission moved; source `AVAILABLE`, destination `OCCUPIED` |
| Missing required consent | `409`; selected bed remained `AVAILABLE` |
| Missing required deposit | `409 ADVANCE_DEPOSIT_REQUIRED`; selected bed remained `AVAILABLE` |
| Draft request cancellation | `200` |
| Unauthenticated access | `401` |
| Wrong-branch admission lookup | `404` |

### Surgery

| Case | Result |
|---|---|
| Duplicate active recommendation | `409` |
| Booking confirmation | `BOOKED` |
| Reschedule | New schedule persisted with one history entry |
| Overlapping active booking | `409` |
| Recommendation cancellation | `200` |
| Booking cancellation | `200`; procedure hold released and bed `AVAILABLE` |
| Invalid status filter | `400 VALIDATION_ERROR` |
| Unauthenticated access | `401` |
| Unauthorized Nurse role | `403` |

### Emergency

| Case | Result |
|---|---|
| Duplicate active source encounter | `409` |
| Emergency-to-IP conversion | `CONVERTED_TO_IP`; linked admission persisted |
| Conversion retry | Same admission ID returned |
| Downstream prescription context | `EMERGENCY_ENCOUNTER` and original source ID preserved |
| Converted bed state | `OCCUPIED` |
| Discharge without billable charges | `DISCHARGED`, `NO_CHARGES_RECORDED` |
| Repeated stale disposition | `409` |
| Unauthenticated access | `401` |
| Nurse attempting restricted confirmation | `403` |

### Persistence And Evidence

- Records created in one authenticated session were read in later authenticated sessions, confirming MongoDB persistence rather than browser/mock persistence.
- Two branches were used for cross-branch transfer and wrong-branch isolation.
- Audit evidence covered ward/bed creation, hold lifecycle, allotment, transfer, request lifecycle, Surgery lifecycle, Emergency lifecycle, orders, conversion and discharge.
- Patient timeline evidence covered admission requests/confirmation, Surgery recommendation/booking lifecycle, and Emergency registration/triage/consultation/disposition/conversion.
- Fixture cleanup reported zero remaining P3-6 wards, requests, admissions, procedures, Emergency encounters and services.

## Static And Runtime Verification

- No phase-owned `mock`, `localStorage`, `console.log`, `console.debug`, `TODO` or `FIXME` markers were found.
- API health: `ok`; MongoDB health: `ok` for database `hms`.
- SPA route smoke tests returned the application shell for `/admissions/beds`, `/admissions/inpatients`, `/surgery`, `/emergency`, `/emergency/queue` and `/emergency/workspace`.
- `git diff --check` passed; only existing Git line-ending notices were emitted.
- Development indexes were reconciled after replacing nullable sparse unique indexes. Production deployment must run the project's controlled index synchronization/migration before traffic is enabled.

## Automated Checks

All required checks passed on 24 August 2026:

```text
npm run typecheck --workspace=@hms/api  PASS
npm run lint --workspace=@hms/api       PASS
npm run build --workspace=@hms/api      PASS
npm run typecheck --workspace=@hms/web  PASS
npm run lint --workspace=@hms/web       PASS
npm run build --workspace=@hms/web      PASS
```

The web build retains non-blocking pre-existing warnings for mixed static/dynamic API imports and a main bundle larger than 500 kB.

## Manual Release Test Steps

Use live API and MongoDB environments. Repeat the branch-scoped cases in two authorized branches where data is available.

### Bed Lifecycle

1. Sign in as an Admissions-authorized user and select Branch A.
2. Create a ward and two beds; confirm totals and availability update without a page reload.
3. Hold Bed 1, retry the same action, and verify no duplicate hold is created.
4. In a second browser session, try to hold/allot Bed 1 to another patient; confirm a conflict is shown and no state changes.
5. Admit the first patient, transfer them to Bed 2, refresh, and verify Bed 1 is available and Bed 2 occupied.
6. Try a stale transfer action again; verify an error notification and unchanged states.
7. Perform an authorized cross-branch transfer and verify branch, ward, bed and history all move together.

### Admission Prerequisites

1. Create an admission request from an eligible Patient/OPD source and validate an available bed.
2. Enable required consent and confirm without a valid consent; verify confirmation is blocked and the bed stays available.
3. Enable required advance deposit and confirm without a qualifying paid invoice; verify the same rollback behavior.
4. Satisfy configured prerequisites and confirm; verify exactly one active admission and one occupied bed.
5. Retry confirmation and verify the same admission opens instead of creating a duplicate.
6. Cancel a draft request and verify no bed remains held or occupied.

### Surgery

1. Create a procedure recommendation from a valid Patient and source encounter.
2. Attempt a duplicate active recommendation and confirm it is rejected.
3. Create and confirm a booking, then reschedule it; verify schedule history and resource status.
4. Attempt an overlapping booking for the same constrained resource and verify a conflict.
5. Cancel the booking with a reason and verify held resources are released.
6. Sign in as Nurse and verify restricted Surgery actions return permission denied.

### Emergency

1. Register/link a Patient, triage the encounter, start consultation and create an order.
2. Verify the order retains `EMERGENCY_ENCOUNTER` source context in the destination module.
3. Choose inpatient disposition and convert; verify one linked admission and occupied bed.
4. Retry conversion and verify the existing admission is returned.
5. For another encounter, complete discharge/abandonment and verify the final state and billing outcome.
6. Retry an obsolete disposition action and verify a stale-state conflict.

### UI, Scope And Persistence

1. Verify loading, empty, error, success, permission-denied and retry states on all release pages.
2. Verify filters, page and tabs survive URL refresh where supported.
3. Log out and back in; confirm records and status history remain.
4. Test a user without branch assignment and a user assigned only to Branch A; verify Branch B data/actions are inaccessible.
5. Inspect audit records and the Patient EMR timeline for every transition above.
6. At desktop and mobile widths, verify no overlap, clipped controls or inaccessible modal actions; test keyboard focus and labels.
7. Verify print/export actions use current live filters and do not expose records outside the user's scope.

## Remaining Boundaries

- The repository has no configured automated integration-test runner. P3-6 therefore used controlled live API/MongoDB matrices plus the six required static/build checks; the manual browser checklist above remains the operator acceptance record.
- Full OT/intra-operative care, inpatient nursing, inpatient discharge implementation, and downstream Pharmacy/Laboratory/Imaging/Billing internals remain outside P3-6.
- No unresolved Developer 2 API dependency blocks the approved P3-1 through P3-5 workflows.

## Exit Gate

P3-6 is complete for the approved Developer 1 release scope. No subsequent release phase has been started.
