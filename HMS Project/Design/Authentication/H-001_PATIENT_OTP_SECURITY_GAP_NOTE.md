# H-001 Patient OTP Security Gap Note

## Reusable implementation

- Patient portal OTP request, signup, login, existing-patient activation, and guardian activation routes.
- `OtpChallenge` storage fields for normalized phone, hashed OTP, expiry, attempts, and verification timestamp.
- Existing patient/guardian account creation, access grants, audit events, and JWT access/refresh token issuance.
- Existing Fastify/Zod request and response contracts.

## Confirmed gap

- `AuthService.isPatientDemoOtp()` unconditionally accepts every OTP in every environment.
- `PatientPortalService.verifyOtp()` and `verifyAndConsumeOtp()` return without reading or validating a challenge.
- Login can auto-link a patient account and issue tokens without possession of the requested OTP.
- Signup, existing-patient activation, and guardian activation can create portal access without a valid OTP.
- The configured demo OTP has an unsafe default and no production startup guard.
- Existing OTP tests assert the bypass instead of challenge verification.

## Shared dependencies

- `APP_ENV`, `NODE_ENV`, and patient demo-OTP environment configuration.
- Patient portal service registry wiring shared by patient login and activation routes.
- MongoDB atomic conditional updates for attempt counting and one-time challenge consumption.

## Intended files

- `apps/api/src/config/env.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/patient-portal/patient-otp.repository.ts`
- `apps/api/src/modules/patient-portal/patient-otp.service.ts`
- `apps/api/src/modules/patient-portal/patient-portal.service.ts`
- `apps/api/src/modules/patient-portal/patient-portal.routes.ts`
- `apps/api/src/shared/services/service-registry.ts`
- `apps/api/src/modules/patient-portal/otp.test.ts`
- `apps/api/.env.example`

No frontend contract or unrelated code-review finding is in scope.
