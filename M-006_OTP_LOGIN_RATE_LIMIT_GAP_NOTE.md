# M-006 OTP and Login Rate-Limit Gap Note

## Existing architecture

- H-001 stores only SHA-256 OTP representations in `OtpChallenge`, binds challenges to normalized phone identities, enforces expiry, atomically increments failed attempts, and atomically consumes successful challenges.
- `OtpChallenge.resendAvailableAt` existed but was not checked before issuing another challenge.
- No Fastify rate-limit plugin, Redis/Valkey deployment, or other shared limiter existed.
- Staff accounts had per-account password failure lockout, but unknown identities and IP addresses were not bounded.
- The mock SMS adapter logged the full recipient and OTP-containing message.

## M-006 boundary

- MongoDB is already the shared required datastore, so M-006 uses atomic fixed-window Mongo counters rather than a process-local limiter or an unsupported new infrastructure dependency.
- OTP request limits cover the persisted resend timestamp, normalized identity, and request IP.
- OTP verification limits cover normalized identity and IP while preserving H-001's per-challenge atomic attempt ceiling.
- Staff login and password-reset request/confirmation use normalized identity/token and IP limits.
- Patient signup, OTP login, existing-patient activation, and guardian activation inherit verification limiting through the shared OTP service.
- Refresh, logout, and authenticated application APIs are deliberately not globally throttled by this change.

## Security decisions

- Counter keys contain secret-keyed SHA-256 HMACs, not raw phone numbers, login identifiers, reset tokens, or IP addresses.
- Limit responses use one generic `AUTH_RATE_LIMITED` response and do not reveal account existence, attempt counts, challenge IDs, or remaining time.
- A permitted resend invalidates prior unconsumed challenges before creating the new authoritative challenge.
- Browser timers and browser storage are not part of enforcement.
- Rate-limit audit events are emitted at most once per key/window to avoid log flooding.
- Mock SMS logs now redact recipient and message content.

## Deployment requirement

All API instances must use the same MongoDB deployment for cluster-wide limiting. `TRUST_PROXY` must contain only the trusted reverse proxy IP addresses, CIDR ranges, or supported named ranges that supply correct forwarding headers; unrestricted boolean proxy trust is rejected. Separate MongoDB deployments do not share counters.
