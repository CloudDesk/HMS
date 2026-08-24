# HMS Scope 2 Phase 3 - P3-3 Verification

**Phase:** P3-3 Surgery and Procedure Workflow  
**Status:** Completed  
**Completed:** 21 August 2026  
**Next phase:** P3-4 is not started and requires explicit approval.

## Delivered

- Extended the existing Service Catalogue with `PROCEDURE`, duration, overlapping capacity, bed, consent, and advance-deposit configuration.
- Added persistent procedure recommendations and bookings with pagination, indexes, audit fields, cancellation reasons, and reschedule history.
- Added the approved recommendation and booking state transitions without adding OT, anesthesia, intra-operative, or ward-nursing states.
- Enforced active patient, OPD encounter, doctor, department, branch, and procedure-service context.
- Enforced full-interval doctor availability, leave/exception rules, appointment conflicts, procedure conflicts, and service capacity.
- Reused P3-1 bed holds and releases; no direct bed status mutation was introduced.
- Reused contextual patient consent and Billing-owned procedure deposit verification.
- Added Surgery permissions, role reconciliation, audit events, and patient EMR timeline events.
- Added live recommendation queue, booking workflow, availability alternatives, booking detail, blockers, schedule, reschedule, cancel, and completion UI.
- Added URL-backed tab, branch, status, date, and search state with loading, empty, error, and success feedback.
- No mock procedure data or separate procedure master was added.

## Automated Verification

Passed:

```text
npm run typecheck --workspace=@hms/api
npm run lint --workspace=@hms/api
npm run build --workspace=@hms/api
npm run typecheck --workspace=@hms/web
npm run lint --workspace=@hms/web
npm run build --workspace=@hms/web
```

Runtime verification:

- API connected to MongoDB and completed permission seeding.
- API listening on `http://localhost:4000`.
- Web application available on `http://localhost:5173`.
- Authenticated recommendation and booking list requests returned HTTP `200` from the live browser workflow.

The workspaces do not define automated test scripts, so the following manual acceptance is required.

## Manual Test Setup

1. Sign in as `SUPER_ADMIN` or a user with the required Surgery permissions and an authorized branch/department.
2. In Administration > Service Catalogue, create an active Procedure service in a clinical department.
3. Configure duration between 5 and 720 minutes and capacity between 1 and 100.
4. For prerequisite tests, enable bed, consent, and advance deposit and enter a non-negative minimum deposit.
5. Ensure an active doctor in the same branch/department has working hours and no leave for the test interval.
6. Ensure an active patient has an OPD visit with that doctor, branch, and department.

## Manual Acceptance Steps

### 1. Service Configuration

1. Save a Procedure service without duration or capacity.
2. Verify the save is rejected.
3. Enable advance deposit without an amount and verify the save is rejected.
4. Save valid settings, refresh, and verify all values persist.
5. Verify non-Procedure service behavior remains unchanged.

### 2. Recommendation

1. Open Surgery > Procedure Workflow and select the authorized branch.
2. Create a recommendation using the patient, matching OPD visit ID, department, doctor, Procedure service, and clinical reason.
3. Verify it appears as `ACTIVE` with a generated recommendation number.
4. Attempt a mismatched patient, encounter, doctor, department, or inactive service and verify rejection.
5. Create another recommendation for the same active encounter/service and verify duplicate prevention.
6. Cancel an unbooked recommendation and verify a reason is mandatory and status becomes `CANCELLED`.

### 3. Pending Booking and Availability

1. Click Book on an active recommendation.
2. Select a future interval inside the doctor's full working block.
3. Verify available alternative doctors are displayed.
4. Create the booking and verify `PENDING CONFIRMATION`.
5. Attempt a time outside availability, on leave, or spanning midnight and verify rejection.
6. Create an overlapping appointment or procedure for the doctor and verify conflict rejection.
7. Fill the configured service capacity and verify the next overlapping booking is rejected.

### 4. Prerequisite Confirmation

1. Confirm a booking for a service that does not require prerequisites and verify status becomes `BOOKED`.
2. For a bed-required procedure, confirm without a hold and verify the bed blocker.
3. Create an active P3-1 hold for the same patient/branch, enter its ID, and verify the bed blocker clears.
4. Upload a signed consent with context type `PROCEDURE_BOOKING` and this booking ID; verify a missing, expired, unsigned, wrong-patient, or wrong-context consent is rejected.
5. Link an invoice through `/api/billing/invoices/:id/procedure-context`, collect less than the minimum, and verify confirmation is blocked.
6. Complete payment to the configured minimum and verify confirmation succeeds.
7. Refresh and verify the prerequisite snapshot and linked IDs persist.

### 5. Reschedule, Cancel, and Complete

1. Reschedule a `BOOKED` procedure without a reason and verify validation rejects it.
2. Reschedule to a valid interval and verify status remains `BOOKED` and history contains old/new schedule, doctor, reason, user, and time.
3. Reschedule into a doctor conflict or full-capacity interval and verify rejection.
4. Cancel a pending or booked procedure without a reason and verify rejection.
5. Cancel with a reason and verify status becomes `CANCELLED` and its active bed hold is released.
6. Attempt to cancel or reschedule a completed/cancelled booking and verify transition rejection.
7. After the booked start time, complete a `BOOKED` procedure and verify status becomes `COMPLETED`.

### 6. Schedule, Security, Audit, and Timeline

1. Open Schedule, select a date, and verify all authorized doctors' procedure bookings appear in time order.
2. Verify search, status, date, tab, and branch values remain in the URL and survive refresh.
3. Sign in without Surgery permissions and verify sidebar/route/API access is denied.
4. Use an unauthorized branch and verify HTTP `403`.
5. Verify department-scoped users only receive their authorized recommendation and booking lists.
6. Verify audit records exist for recommendation create/cancel and booking create/confirm/reschedule/cancel/complete.
7. Open the patient's EMR timeline and verify the matching procedure events.
8. Restart API and web, refresh the page, and verify MongoDB persistence with no mock records.

## Exit Gate

P3-3 meets the approved recommendation-to-procedure-booking scope. Full OT, anesthesia, intra-operative, and ward-nursing workflows remain excluded. Stop here and wait for approval before P3-4.
