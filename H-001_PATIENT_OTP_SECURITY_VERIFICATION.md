# H-001 Patient OTP Security Verification

## Implemented behavior

- OTP request stores only a SHA-256 representation bound to the normalized phone identity.
- Verification rejects missing, wrong-phone, expired, consumed, and attempt-exhausted challenges.
- Wrong OTP submissions atomically increment the challenge attempt count.
- Correct OTP comparison uses constant-time comparison and atomic conditional consumption.
- Patient login, signup, existing-patient activation, and guardian activation all require the shared consume path.
- Token issuance after route-level orchestration requires an internal branded OTP verification result.
- Demo OTP is disabled by default, requires explicit enablement and a four-digit value, and is rejected at production startup.

## Automated verification

- `npm run test --workspace=@hms/api -- src/modules/patient-portal/otp.test.ts`: passed, 12 tests.
- `node --env-file=apps/api/.env.test --import tsx --test apps/api/test/auth.test.ts`: passed, 9 tests.
- `npm run typecheck --workspace=@hms/api`: passed.
- `npm run build --workspace=@hms/api`: passed.
- H-001-owned ESLint command: passed.
- Production demo-OTP startup rejection command: passed.
- `git diff --check`: passed.

## Full lint baseline

`npm run lint --workspace=@hms/api` remains blocked by 43 pre-existing errors outside H-001-owned files. The failures are in scratch/fix scripts and unrelated appointment, patient, pharmacy inventory, surgery, utility, and legacy test files. No H-001-owned file produced an ESLint error.

No H-002 through H-015 work was started.
