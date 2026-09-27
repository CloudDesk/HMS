# HMS Patient Mobile — Final Release Checklist

## Code
- [x] No unintended Patient Web changes (`git status -- apps/patient-web` is 100% clean)
- [x] No unrelated refactoring or scope creep
- [x] No secrets or private keys in repository code
- [x] No debug code or leftover test harnesses in client bundle
- [x] No sensitive logging (`console.log` / `console.error` completely absent in mobile codebase)

## Authentication
- [x] Login verified (OTP request & verification with fixed OTP `1234`)
- [x] Refresh verified (single-use rotating refresh token with family revocation)
- [x] Logout verified (single-session revocation leaving other devices active)
- [x] Multi-session behavior verified (independent sessions per device)
- [x] Secure storage verified (`expo-secure-store` for refresh credential, memory-only for access token)

## Patient Privacy
- [x] Context switching verified (instant state reset and re-fetch across all 9 modules)
- [x] Cache isolation verified (no cross-patient data leakage)
- [x] Backend authorization verified (all endpoints validate token and patient ownership/guardian link)

## Functional Modules
- [x] Appointments (list upcoming/completed, reschedule slot modal)
- [x] Prescriptions (active & history lists, full medication dosage breakdown)
- [x] Laboratory (diagnostic test panels, reference intervals, flags)
- [x] Imaging (radiology reports, modality, clinical findings & impression)
- [x] Billing (invoices list, payment breakdown, receipt history)
- [x] Documents (clinical documents list, authenticated download resolver)
- [x] Dental (treatment quotations list, procedure itemization, Accept/Reject/Postpone actions)
- [x] Notifications (in-app notification center, unread filter, mark as read, allowlisted deep linking)

## Testing
- [x] Full mobile tests passing (`npm test --workspace=@hms/patient-mobile`: 21 files, 103 tests)
- [x] Typecheck clean (`npm run typecheck --workspace=@hms/patient-mobile`: 0 errors)
- [x] Lint clean (`npm run lint --workspace=@hms/patient-mobile`: 0 errors)
- [x] Native export successful (`npm run export:native --workspace=@hms/patient-mobile`: iOS & Android Hermes bundles)
- [x] Patient Web typecheck clean (`npm run typecheck --workspace=@hms/patient-web`: 0 errors)
- [x] Patient Web build clean (`npm run build --workspace=@hms/patient-web`: 0 errors)
- [x] Relevant backend tests passing (`native-auth.integration.test.ts`: 30 tests passing)

## Release
- [x] Production API configuration reviewed (`publicConfigSchema` with HTTPS enforcement)
- [x] Android configuration reviewed (package `com.hms.patient.dev`, `allowBackup: false`)
- [x] iOS configuration reviewed (bundle ID `com.hms.patient.dev`, SecureStore Keychain entitlement)
- [x] Environment separation reviewed (development vs staging vs production URL schemas)
- [x] Known limitations documented (Online payment & Native push contracts)
- [x] Release blockers classified (0 Critical, 0 High, 0 Medium blockers)
