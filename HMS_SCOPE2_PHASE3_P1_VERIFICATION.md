# HMS Scope 2 Phase 3 - P3-1 Verification

## Status

**Phase:** P3-1 - IP Bed Lifecycle Foundation  
**Result:** Completed  
**Verification date:** 21 August 2026

## Implemented Scope

P3-1 extends the existing `admissions-configuration` and `inpatient-admissions` domains. It does not introduce a second ward, bed, patient, or admission source of truth.

### Backend

- Added branch admission policy with an explicit 5-240 minute hold duration and fail-closed `ADMISSION_POLICY_NOT_CONFIGURED` behavior.
- Added indexed, paginated owner-aware bed-board reads and status summaries.
- Added bed holds with `ACTIVE`, `CONSUMED`, `RELEASED`, `EXPIRED`, and `CANCELLED` states.
- Added request-time hold expiry with indexed selection, transactional bed release, and audit history.
- Added hold idempotency: the same key and payload replays the result; changed input returns `IDEMPOTENCY_CONFLICT`.
- Added atomic direct allotment and held-bed consumption through inpatient admission creation.
- Added same-ward, same-branch, and permission-gated cross-branch transfer request/completion/cancellation.
- Added assignment history for allotment, transfer-out, transfer-in, and release.
- Added an internal transactional admission-bed release command for the later discharge workflow. Cleaning/preparation releases to `BLOCKED` with `blockReasonCode = CLEANING`; ordinary release returns to `AVAILABLE`.
- Added conditional ownership updates and partial unique indexes for active bed holds, bed owners, admission owners, and pending transfer destinations.
- Prevented manual `OCCUPIED` and `RESERVED` changes and protected held/occupied beds and wards from unsafe edits/deactivation.
- Added separate RBAC actions for admission policy, holds, transfers, and cross-branch transfer. Cross-branch commands require their base action and `CrossBranch` permission.
- Added lifecycle audit events without logging tokens, secrets, or clinical payloads.

### Frontend

- Replaced the basic bed configuration view with a responsive live Bed Board using existing HMS shell, controls, modal, status, and notification patterns.
- Added branch, ward, status, bed/room search, and pagination URL state.
- Added live capacity metrics and patient/admission or hold ownership context from backend data only.
- Added permission-aware policy, ward, bed, hold, release, cancellation, transfer, block, maintenance, inactive, and activation controls.
- Added stale ownership/conflict feedback from backend error codes through Sonner.
- Connected `Allot Bed` to the existing inpatient admission workflow.
- Added reserved-bed handoff of patient, hold, ward, and bed context. Admission confirmation consumes the matching hold atomically.
- Removed pseudo age/source values from the inpatient admission surface touched by this phase.
- Added loading, empty, API error, no-branch, no-policy, and no-available-bed states.

## API Surface

| Method | Endpoint | Purpose |
|---|---|---|
| `GET`, `PUT` | `/api/admissions/policy` | Read or configure branch admission policy |
| `GET` | `/api/admissions/beds` | Paginated owner-aware bed board |
| `GET` | `/api/admissions/beds/summary` | Live branch bed totals |
| `POST` | `/api/admissions/beds/:id/holds` | Create an idempotent hold |
| `POST` | `/api/admissions/bed-holds/:id/release` | Release an active hold |
| `POST` | `/api/admissions/bed-holds/:id/cancel` | Cancel an active hold |
| `POST` | `/api/admissions/inpatients/:id/transfers` | Request same-branch transfer |
| `POST` | `/api/admissions/inpatients/:id/cross-branch-transfers` | Request authorized cross-branch transfer |
| `POST` | `/api/admissions/bed-transfers/:id/complete` | Complete same-branch transfer |
| `POST` | `/api/admissions/bed-transfers/:id/complete-cross-branch` | Complete authorized cross-branch transfer |
| `POST` | `/api/admissions/bed-transfers/:id/cancel` | Cancel a pending transfer |

`POST /api/admissions/inpatients` now accepts optional `hold_id` and uses the P3-1 lifecycle service for all bed allotment. Occupied-bed release remains an internal transaction command so a user cannot bypass the later discharge confirmation workflow.

## Automated Verification

| Workspace | Command | Result |
|---|---|---|
| API | `npm run typecheck --workspace=@hms/api` | Passed |
| API | `npm run lint --workspace=@hms/api` | Passed |
| API | `npm run build --workspace=@hms/api` | Passed |
| Web | `npm run typecheck --workspace=@hms/web` | Passed |
| Web | `npm run lint --workspace=@hms/web` | Passed |
| Web | `npm run build --workspace=@hms/web` | Passed with existing non-blocking chunk/dynamic-import warnings |

The repository has no configured automated test runner. P3-1 therefore uses compile/lint/build checks, authenticated runtime API checks, and the manual concurrency/transaction acceptance below.

## Runtime Verification

- API started successfully on `http://localhost:4000` and connected to MongoDB.
- `GET /api/health` returned HTTP 200.
- Bootstrap administrator authentication succeeded and included the new P3-1 permissions.
- Authenticated branch and paginated bed-board reads succeeded.
- A branch without a policy returned HTTP 409 instead of using a silent hold-duration default.
- Web started successfully on `http://localhost:5174` because port 5173 was already occupied.
- The `/admissions/beds` SPA route returned HTTP 200.
- Existing data currently contains no configured beds, so destructive lifecycle runtime fixtures were not inserted.

## Manual Test Steps

### 1. Policy, Ward and Bed Setup

1. Sign in as a user with Admissions policy, ward, and bed permissions.
2. Open **Admissions > Bed Management** and select an authorized branch.
3. Confirm the missing-policy alert appears, open **Policy**, set a hold duration between 5 and 240 minutes, and save.
4. Add a ward and two beds in that ward.
5. Attempt to add the same bed number again in the same ward. Verify a conflict is shown and only one record exists.
6. Deactivate and reactivate an empty ward. Then hold or occupy a bed and verify ward deactivation is rejected.

### 2. Hold and Expiry

1. Select an available bed, choose **Hold Bed**, find a real patient, enter a reason, and confirm.
2. Verify the bed changes to `RESERVED`, displays its hold number/expiry, and the reserved KPI increments.
3. In a second authenticated session, refresh and attempt to hold or directly allot the same bed. Verify HTTP 409/stale feedback and no duplicate owner.
4. Release the hold and verify the bed returns to `AVAILABLE` and ownership clears.
5. Create another hold and wait beyond the configured duration.
6. Refresh the bed board. Verify request-time expiry marks the hold `EXPIRED`, returns the bed to `AVAILABLE`, and creates an audit event.

### 3. Allotment and Hold Consumption

1. For an available bed, select **Allot Bed**, complete the inpatient form using real patient, doctor, and department records, and submit.
2. Verify the admission is created and the bed becomes `OCCUPIED` with the matching admission/patient context.
3. Create a hold and select **Allot Bed** on the reserved bed.
4. Verify the reserved patient cannot be changed, complete the form, and submit.
5. Verify the hold becomes `CONSUMED`, the bed becomes `OCCUPIED`, and `currentHoldId` is cleared.
6. Attempt to submit the same stale bed from a second session. Verify the admission transaction rolls back and no orphan admission remains.

### 4. Transfer

1. Select an occupied bed and choose **Transfer**.
2. Transfer within the same ward, then between wards in the same branch. Verify the source returns to `AVAILABLE`, destination becomes `OCCUPIED`, and the admission points to the destination.
3. Verify transfer-out and transfer-in history preserve both bed snapshots, reason, actor, and timestamp.
4. Remove `CrossBranch` permission and verify another branch cannot be selected or used by API.
5. Grant `Create`, `Complete`, `CrossBranch`, and access to both branches; complete a cross-branch transfer and verify both branch scopes update atomically.

### 5. Restricted States and Failure Safety

1. Mark an available bed `BLOCKED`, `UNDER_MAINTENANCE`, and `INACTIVE` in turn. Verify none appears in admission or transfer destination choices.
2. Verify block and maintenance require a reason.
3. Attempt a direct API status change to `OCCUPIED` or `RESERVED`; verify `MANUAL_BED_OWNERSHIP_FORBIDDEN`.
4. Attempt to edit, deactivate, block, or maintain a held/occupied bed; verify ownership conflict responses.
5. Force a destination conflict by selecting it in two sessions and completing both transfers. Verify only one succeeds and the failed transaction leaves source, destination, admission, and history unchanged.
6. Verify users without each policy/hold/transfer action receive HTTP 403 even when the frontend control is hidden.

## Exit Assessment

P3-1's exit gate is satisfied. Downstream admission, procedure, transfer, and discharge workflows can consume one authoritative, transaction-safe bed lifecycle service. P3-2 recommendation, request, prerequisite, cancellation, active-admission uniqueness, and conversion work has not started.
