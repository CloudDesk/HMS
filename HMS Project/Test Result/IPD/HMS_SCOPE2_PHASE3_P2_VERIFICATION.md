# HMS Scope 2 Phase 3 - P3-2 Verification

## Status

**Phase:** P3-2 - IP Recommendation, Admission and Generic Encounter Conversion  
**Status:** Completed  
**Completion date:** 21 August 2026

## Implemented

- Added paginated, branch-scoped admission recommendation/request records with explicit `PENDING_VALIDATION`, `READY_FOR_CONFIRMATION`, `CONFIRMED`, and `CANCELLED` states.
- Added direct and OPD visit source contracts, immutable source references, one active request per source, and one successful conversion per source.
- Added backend validation for patient, branch, department, recommending doctor, and OPD source consistency.
- Added an atomic unique active-admission constraint per patient and retained the existing unique active bed ownership constraint.
- Confirmation now uses the P3-1 hold/allotment service and never edits bed status directly.
- Extended patient consents with admission/procedure context, context ID, and consent kind. Mandatory consent is validated from backend metadata and snapshotted at confirmation.
- Extended Billing with an authorized admission-context link and authoritative paid-invoice verification. Mandatory deposits fail closed and are snapshotted at confirmation.
- OPD conversion, admission creation, request confirmation, bed allotment, audit, and patient timeline updates execute in one MongoDB transaction.
- Draft cancellation requires a reason, cancels an active hold in the same transaction, and records audit/timeline events.
- Replaced the mock-derived Admissions screen with live request KPIs, search, patient lookup, direct/OPD source selection, validation, live ward/bed selection, contextual consent upload, deposit reference, confirmation, cancellation, and persistent states.
- Added permissions for admission recommendations and request lifecycle actions. Reception, nursing, doctor, and administrator role mappings follow their workflow responsibilities.

## API Surface

- `GET /api/admissions/requests`
- `GET /api/admissions/requests/:id`
- `POST /api/admissions/requests`
- `POST /api/admissions/recommendations`
- `PATCH /api/admissions/requests/:id/validate`
- `POST /api/admissions/requests/:id/confirm`
- `POST /api/admissions/requests/:id/cancel`
- `PATCH /api/billing/invoices/:id/admission-context`

## Automated Verification

- `npm run typecheck --workspace=@hms/api` - passed
- `npm run lint --workspace=@hms/api` - passed
- `npm run build --workspace=@hms/api` - passed
- `npm run typecheck --workspace=@hms/web` - passed
- `npm run lint --workspace=@hms/web` - passed
- `npm run build --workspace=@hms/web` - passed
- Runtime request-list API smoke test - HTTP 200
- Runtime `/admissions/inpatients` application route smoke test - HTTP 200
- Missing branch policy smoke test - HTTP 409 as designed

The repository currently has no automated test runner. P3-2 therefore uses compilation, linting, production builds, runtime API smoke checks, database indexes, transactional guards, and the manual acceptance flow below.

## Manual Test Steps

### 1. Branch policy prerequisite

1. Sign in as an administrator.
2. Open **Admissions > Bed Management** and select the test branch.
3. Configure the admission policy. Test once with consent and deposit optional, then repeat with each mandatory.
4. Verify a missing policy shows a clear blocker and prevents hold/confirmation.

### 2. Direct request and patient identity

1. Open **Admissions > Admission Requests**.
2. Click **Find / Register Patient** and verify the existing patient search/registration flow opens without a page reload.
3. Return, click **New Request**, search for an existing patient, and select branch department and doctor.
4. Select `Direct`, enter admission type, priority, reason, and submit.
5. Verify one persisted `PENDING VALIDATION` request appears after refresh and logout/login.

### 3. OPD recommendation/conversion

1. Identify a live OPD visit and copy its ID.
2. Create an admission request with source `OPD visit`, using the same patient, branch, department, and doctor as the visit.
3. Verify mismatched patient/branch/department/doctor data is rejected.
4. Complete validation and confirmation.
5. Verify the request and final admission retain the OPD visit reference and a second request/conversion for that visit is rejected.

### 4. Validation and active-admission guard

1. Review a pending request.
2. Select a live ward and available bed, then click **Validate**.
3. Verify the state becomes `READY FOR CONFIRMATION`.
4. Attempt another active admission for the same patient and verify `ACTIVE_ADMISSION_EXISTS` or `ACTIVE_ADMISSION_CONFLICT`.
5. Make the selected bed unavailable in another authorized session and verify confirmation rejects the stale selection without creating an admission.

### 5. Consent prerequisite

1. Enable mandatory admission consent in the branch policy.
2. Validate a request without consent and attempt confirmation; verify `CONSENT_REQUIRED`.
3. Click **Upload signed consent**, choose an allowed PDF/JPEG/PNG, signer, and signed date.
4. Verify the returned document ID is populated automatically.
5. Confirm successfully, then verify the snapshot retains consent ID, kind, signed date, and satisfaction result.
6. Verify an expired, unsigned, other-patient, or other-request consent is rejected.

### 6. Deposit prerequisite

1. Enable mandatory advance deposit and configure a non-zero minimum amount.
2. From Billing, create/finalize an invoice for the same patient and branch, link it to the admission request through `PATCH /api/billing/invoices/:id/admission-context`, and collect payment.
3. Try confirmation before the minimum is paid; verify `ADVANCE_DEPOSIT_REQUIRED`.
4. Pay at least the minimum and confirm.
5. Verify the snapshot contains required amount, paid amount, invoice ID, payment IDs, and verification time.
6. Verify an invoice linked to another patient, branch, or request is rejected.

### 7. Bed hold, confirmation, and persistence

1. Create a P3-1 bed hold for the request patient, then enter the hold ID during validation.
2. Confirm the request.
3. Verify exactly one inpatient admission is created, the hold is `CONSUMED`, and the bed is `OCCUPIED` by that admission.
4. Refresh and logout/login; verify request, admission, OPD source, bed assignment, prerequisite snapshots, timeline, and audit references persist.

### 8. Draft cancellation

1. Create and validate another request with an active hold.
2. Click **Cancel Draft**, enter a reason, and confirm.
3. Verify the request is `CANCELLED`, the hold is cancelled, and the bed returns to `AVAILABLE`.
4. Verify no inpatient admission or orphaned occupancy was created.

### 9. Permissions and branch isolation

1. Verify a doctor can create an OPD recommendation but cannot perform reception confirmation without the request permission.
2. Verify a receptionist can create, validate, confirm, and cancel requests only for assigned branches.
3. Verify a nurse has read-only admission request and bed visibility.
4. Verify an unauthorized branch user receives HTTP 403 and cannot infer request, consent, invoice, or patient details.

## Known Environment Note

The current first active branch returned `ADMISSION_POLICY_NOT_CONFIGURED` during smoke testing. This is valid fail-closed behavior, not mock data. Configure the branch policy before running confirmation tests.

## Stop Gate

P3-2 is complete. Do not start P3-3 until explicit approval is received.
