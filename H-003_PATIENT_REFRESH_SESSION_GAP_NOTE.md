# H-003 Patient Refresh Session Gap Note

## Reusable implementation

- The backend staff authentication routes already issue, rotate, revoke, and clear the `hms-refresh-token` HttpOnly cookie.
- `/api/auth/refresh` already accepts an empty body, reads the cookie, rotates the stored refresh record, and returns only an access token in JSON.
- `/api/auth/logout` already revokes the cookie token and clears the cookie with the matching path/domain.
- API CORS already allows configured origins with credentials.
- The staff frontend already demonstrates the intended cookie-backed refresh request pattern.

## Confirmed gap

- Patient OTP login and guardian activation return the raw refresh token in JSON and do not set the refresh cookie.
- New-patient signup consumes its OTP, then the patient frontend tries to reuse that consumed OTP to obtain a session.
- Existing-patient activation creates an account without establishing a refresh session.
- `patient-web` stores refresh tokens and expiry timestamps in `sessionStorage`, reads them during restoration/logout, and submits them to refresh/logout request bodies.
- The patient API client does not opt into credentialed cross-origin requests, so the browser cannot reliably store/send the HttpOnly cookie.
- The existing backend auth test file uses `node:test` under Vitest and is therefore not discovered as a test suite.

## Intended change

- Reuse one backend cookie helper for staff and patient authentication responses.
- Set the same secure refresh cookie and strip refresh fields from every patient response that issues a session.
- Establish sessions directly after signup, existing-patient activation, and guardian activation using the already-consumed OTP verification proof.
- Adapt `patient-web` to access-token-only memory storage, empty refresh/logout bodies, `credentials: 'include'`, and cookie-authoritative page restoration.
- Add focused Vitest coverage for backend refresh lifecycle, patient/guardian activation cookies, frontend storage, requests, and reload recovery.

No H-001/H-002 behavior or H-004 through H-015 work is in scope.
