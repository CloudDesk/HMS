# MyCare — Login Rate Limiting & Cooldown State Investigation

## 1. Problem Statement & Symptoms
- **Observed Behavior:** On physical devices, users experienced intermittent "Too many attempts" errors (e.g. `MOB-74169B` / `RATE_LIMITED`) when returning to the Login screen or when submitting their phone number after a logout/back navigation.
- **Context:** The backend enforces legitimate security rate limits (per-phone OTP resend cooldown and IP/identity request limits). However, the client mobile application's state manager retained the prior error object (`errorDetails` and `message`) across state transitions (such as `backToPhone()`, `logout()`, and re-entering the login screen). Furthermore, attempting to request OTP during the remaining cooldown interval previously re-triggered an uncaught error rather than displaying a graceful countdown notification.

---

## 2. Root Cause Analysis

### A. State Manager Error Retention
- In `apps/patient-mobile/src/auth/session-manager.ts`:
  - When transitioning from `otp_sent` back to `phone_input` via `backToPhone()`, or after `logout()` and `invalidate()`, the state manager preserved previous `errorDetails` and `message` properties.
  - When the user navigated back to `LoginScreen`, `state.errorDetails` or `state.message` remained populated, causing `displayError` to render the old error diagnostic banner immediately before any new submission.

### B. Client-Side Cooldown Handling
- When a user submitted their phone number while the cooldown timer was still active, `requestOtp` threw an error or left state in an unhandled error state rather than cleanly providing an active wait-time message.

---

## 3. Implemented Fixes

### A. Session Manager State Reset
- In `apps/patient-mobile/src/auth/session-manager.ts`:
  - Added explicit reset of `errorDetails: undefined` and `message: undefined` across all state transitions:
    - `requestingOtp`
    - `backToPhone()`
    - `logout()`
    - `invalidate()`
  - Added `clearError()` method to `SessionManager` and exposed it via `AuthContext.tsx`.
  - In `requestOtp()`: If called while a client cooldown is active, gracefully updates state with `message: 'Please wait ${remaining}s before requesting a new code.'` without raising stale API error diagnostics.

### B. Login Screen UI Cleanup
- In `apps/patient-mobile/src/ui/screens/LoginScreen.tsx`:
  - Connected `clearError` from `useAuth()`.
  - Cleared error state on `onChangeText` when the user edits their phone number.
  - Cleared error state on `handleSubmit` before submitting.
  - Updated `onDismiss` on `ErrorDiagnosticView` to clear both local and global auth errors.

---

## 4. Backend Rate Limit Invariant
- Backend security rate limits (60s resend cooldown, identity window, and IP limit) remain strictly active and unaltered in `apps/api/src/modules/patient-portal/patient-otp.service.ts`.
- Security invariants are preserved: OTP rate limiting is NOT bypassed or weakened.
