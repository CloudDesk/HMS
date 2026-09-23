# Patient OTP static development/SIT mode

The existing settings are reused; no additional OTP mode variables are needed.

```dotenv
APP_ENV=prod
NODE_ENV=production
PATIENT_PORTAL_DEMO_OTP_ENABLED=true
PATIENT_PORTAL_DEMO_OTP=1234
```

For local development use APP_ENV=dev and NODE_ENV=development. The local
apps/api/.env.dev already enables 1234. Restart the backend after updating code.
For Render, keep the existing shared environment and set the two patient OTP
variables on the backend, then deploy this code.
For cross-site HTTPS hosting retain COOKIE_SECURE=true, COOKIE_SAME_SITE=none
and the existing explicit CORS origins. The explicit patient OTP flag now permits
static mode independently of APP_ENV/NODE_ENV, as requested by the owner.
A publicly known static code does not prove phone ownership: anyone who knows
a patient's mobile number can request a challenge and attempt patient login.
Other applications' environment settings and password authentication are unchanged.

Request an OTP before submitting 1234. Static generation persists the configured
code as the existing phone-bound SHA-256 hash, and skips SMS. Verification has
no static-code exception: a stored unexpired, unconsumed challenge is required.
Attempt limits, request/verification rate limits, single use, mobile association,
registration tokens and the normal session/refresh-cookie flow are unchanged.
The code is not returned by the API or logged.

With the flag false, generation remains crypto.randomInt(1000, 10000) and SMS
delivery is required. Missing/invalid gateway settings (including MOCK) return
SMS_NOT_CONFIGURED. MockSmsService remains available for explicitly injected
unit tests, but is no longer selected by the runtime factory. 1234 has no special
meaning in real mode; it can only verify if it happens to be the actual issued
random code for that challenge.

Changed files: patient-otp.service.ts, otp.test.ts, sms.service.ts,
sms.service.test.ts, and this document. No UI, dental, appointment, quotation,
or treatment-plan changes are part of this work. Hosted changes are not deployed.

Latest verification: 44 OTP/SMS tests passed. A configuration-load check with
APP_ENV=prod and NODE_ENV=production confirmed explicit static mode loads;
that check did not connect to a database. Full workspace checks and live Render
login were not repeated. New tests cover static persistence,
no SMS, wrong code, expiry, attempts, single use, mobile binding, resend limits,
and missing real-mode SMS configuration; existing real-mode and session tests
remain in the suite.
