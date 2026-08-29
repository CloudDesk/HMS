# H-003 Patient Refresh Session Verification

## Implemented

- Reused the existing backend refresh-token persistence, hashing, rotation, revocation, and `/api/auth/refresh` cookie contract.
- Centralized refresh-cookie establishment/clearing so staff login, staff refresh, patient OTP login, signup, existing-patient activation, and guardian activation use identical attributes.
- Patient authentication responses now expose only the access token, token type, and access-token lifetime. Refresh tokens remain server-issued HttpOnly cookie values.
- New-patient and guardian continuation paths securely validate the OTP without consuming it when registration is required; the activation endpoint then atomically consumes it before issuing the session. Authentication still requires a consumed verification proof.
- `patient-web` now retains only the access token in module memory, removes obsolete refresh-token storage values, never reads a refresh token, and sends empty refresh/logout bodies with credentials enabled.
- Page reload always asks the backend to restore the session from the HttpOnly cookie. Signup restores the newly established cookie session instead of reusing its consumed OTP.
- Production rejects `COOKIE_SECURE=false`; `SameSite=None` also requires a secure cookie. The default remains `SameSite=Lax`, host-only domain, `/api/auth` path, and configured refresh-token max-age.

## Automated verification

- H-003 patient backend suite: 8 tests passed.
- Shared staff authentication suite: 4 tests passed.
- Patient frontend suite: 6 tests passed, including 5 H-003 storage/request/reload tests.
- Combined serial API regression run: 39 tests passed across H-003, H-001, and H-002.
- API typecheck and build: passed.
- Patient frontend typecheck, build, and full lint: passed.
- H-003-owned API and patient frontend ESLint: passed.
- Full API lint: still reports the same 43 unrelated pre-existing errors; no H-003-owned file is reported.
- `git diff --check`: passed with checkout line-ending warnings only.

## Notes

- The production build reports the existing Vite chunk-size warning; the build succeeds.
- Focused MongoDB tests emit an existing Mongoose deprecation warning for an unrelated `findOneAndUpdate({ new: ... })` caller; tests succeed.
- No H-002 notification behavior changed, and H-004 through H-015 were not started.
