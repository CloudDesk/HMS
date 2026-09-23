# Patient portal OTP investigation — 23 September 2026

## Findings and limits

The live Firebase portal accepted an OTP request for the supplied test mobile
9999988888, then rejected 1234 with the reported invalid/expired message. This
reproduction does not prove which server-side rejection condition occurred.
The live Render environment, SMS delivery receipt, and production MongoDB
challenge were not available for inspection. No production OTP or hash was
retrieved or logged. Exact production root cause remains unconfirmed.

A confirmed code defect is the SMS factory's silent fallback: absent gateway
configuration, unknown providers, and HTTP with no URL previously selected
MockSmsService, including in production. That sender captures an SMS in memory
and reports success without sending it. The deployment blueprint does not
configure a gateway; Render may have manual overrides, which require checking.
This is consistent with an undelivered random code and an assumed test code.

## Traced behavior

- PatientLoginPage calls requestOtp on Continue or explicit Resend, never from
  an effect. Countdown updates do not generate codes. Verify calls loginWithOtp.
- Actual endpoints are POST /api/patient-portal/otp/request, followed by
  POST /api/patient-portal/login/otp. The /otp/verify endpoint issues a registration
  token for the new-patient/guardian flow; it is not the existing-patient login.
- Generation uses crypto.randomInt(1000, 10000): four decimal digits. No change.
- MongoDB stores SHA-256 of normalized phone + ':' + code, not plaintext.
  Request/verify remove non-digits identically. Spaces, hyphens and a plus sign
  are removed; adding 91 changes identity. No country is guessed or stripped.
- Multiple historical challenges may exist. New requests invalidate earlier
  unconsumed records; verification selects the latest createdAt record.
- Defaults: TTL 300 seconds, cooldown 60 seconds, three incorrect attempts.
  Expiry is now.getTime() + TTL * 1000 and rejects at expiresAt <= now.
  MongoDB TTL cleanup is not relied on for verification enforcement.
- Wrong code increments attempts conditionally. Consume is an atomic update
  requiring matching phone/hash, unconsumed, unexpired, and below attempt limit.
- Database-backed identity/IP limits remain in place. A rejected duplicate
  request does not replace the active challenge in the tested flow.
- Login validates OTP before account lookup, consumes it before creating the
  session, and establishes the existing access-token/refresh-cookie contract.
- A configured non-production demo code is an existing explicit opt-in.
  Production rejects demo configuration. 1234 has no universal validity.

## Change

createSmsService now permits MOCK only outside production. HTTP requires a
valid URL and API key, plus HTTPS in production. Invalid settings return a
sender that rejects with 503 SMS_NOT_CONFIGURED when used, so unrelated API
domains can still start. The frontend already displays that API error without
moving to code entry. No OTP generation, comparison, expiry, session or mobile
matching rules were weakened or changed.

Before with missing gateway: request -> random challenge -> mock success ->
assumed code -> INVALID_OTP. After: request -> explicit SMS_NOT_CONFIGURED.
With a configured gateway: request -> delivered random code -> login/otp ->
session. Enabling real SMS delivery remains an operational prerequisite.

## Verification

Focused automated results: API OTP/SMS/session suites passed 49 tests in
three files; patient frontend login/auth suites passed 14 tests in four files.
Logs: otp-focused-tests.log and otp-frontend-tests.log (ignored local files).

Patient-web typecheck, lint and production build passed. API typecheck and build
passed. Staff-web lint passed; its build failed with the same type error below.
Full API lint found one error outside this change:
apps/api/test/dental-quotation-patient-portal-sync.test.ts:49, unused
planItemScalingId. It reported no errors in the OTP/SMS files.
Staff-web typecheck failed outside this change at
apps/web/src/pages/OpdVisitPage.tsx:1435: incompatible ConsultationFormState
treatment_plan types (string versus string | undefined). These unrelated files
were not modified for this investigation. Full workspace validation is not green.

Tests cover generated hash persistence, correct/incorrect/expired/used codes,
resend invalidation, request and verification limits, cross-mobile rejection,
exact TTL boundary, formatting normalization, concurrent requests, supplied
mobile regression, token creation and single-use login. Provider tests cover
production mock rejection, malformed/missing HTTP settings, HTTPS, and valid
HTTP selection. Frontend tests cover StrictMode, countdown, explicit resend,
invalid verification without regeneration, and delivery configuration errors.

The existing frontend refresh test needed its required QueryClientProvider;
only its test wrapper changed. Production browser request counting is not
verified: the available browser diagnostics did not expose a network trace.
The live error was reproduced, but a successful live SMS/login requires the
configured gateway and the received code. Changes have not been deployed.

## Files

- apps/api/src/shared/services/sms.service.ts: createSmsService.
- apps/api/src/shared/services/sms.service.test.ts: provider configuration tests.
- apps/api/src/modules/patient-portal/otp.test.ts: OTP regression/security tests.
- apps/patient-web/src/pages/PatientLoginPage.test.tsx: request-sequence tests.
- apps/patient-web/src/auth/auth-refresh.test.tsx: test provider setup.
- README.md: Render SMS configuration and operational instructions.
- PATIENT_OTP_VERIFICATION.md: this investigation record.
