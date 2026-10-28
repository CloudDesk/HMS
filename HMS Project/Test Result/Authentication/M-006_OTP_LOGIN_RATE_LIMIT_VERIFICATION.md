# M-006 OTP and Login Rate-Limit Verification

## Implemented protections

- Server-enforced OTP resend cooldown with persisted timestamp validation and an atomic concurrency gate.
- Configurable per-identity and per-IP OTP request windows.
- Configurable per-identity and per-IP OTP verification windows.
- Existing configurable, atomic per-challenge failed-attempt ceiling retained.
- Configurable staff login and password-reset identity/IP windows.
- Mongo TTL cleanup for expired fixed-window counters.
- Configurable trusted-proxy handling for correct client IP attribution.
- Generic 429 responses and redacted security monitoring.

## Automated validation

- M-006/H-001 focused OTP and auth limiting: 25/25 passed.
- Route-level OTP cooldown and login limiting: included above, 2/2 passed.
- Shared authentication cookie tests: passed.
- H-002 notification authorization regression: passed.
- H-003 refresh-session regression: passed.
- H-004 print/XSS regression: 1/1 passed.
- H-005 browser-storage regression: 1/1 passed.
- H-005 authoritative clinical persistence regression: 4/4 passed.
- API typecheck: passed.
- API build: passed.
- M-006-owned ESLint: passed.
- Full API lint retains the existing 43 unrelated errors; no M-006-owned file is listed.

## Remaining M-006 limitations

- Fixed windows are used instead of sliding windows.
- Cross-instance enforcement depends on all instances sharing MongoDB.
- Correct production IP attribution depends on a correctly configured trusted proxy; untrusted forwarding headers must never be accepted.

M-007 through M-015 were not started.
