# HMS Patient Mobile — Security Audit

| Security Area | Result | Notes |
|---|---|---|
| **Native access token handling** | **PASS** | Access tokens are strictly in-memory (`SessionManager` state) and never stored in unencrypted storage (`AsyncStorage`, `localStorage`). |
| **Native refresh credential storage** | **PASS** | Refresh credentials stored exclusively using `expo-secure-store` (iOS Keychain / Android EncryptedSharedPreferences). |
| **Refresh rotation** | **PASS** | Backend issues a new single-use refresh token with every refresh request; client securely updates stored credentials atomically. |
| **Replay protection** | **PASS** | Presenting an already-consumed refresh token immediately triggers family revocation in the backend session repository. |
| **Logout isolation** | **PASS** | Logout revokes only the specific native device session ID (`sessionId`), leaving other mobile devices and web sessions untouched. |
| **Patient context isolation** | **PASS** | Switching active patient in `PatientContextSelector` resets all UI state, clears in-flight requests, and queries only the newly selected patient ID. |
| **Billing authorization** | **PASS** | Invoice list and detail queries enforce authenticated patient/guardian session token; client does not compute or modify financial balances. |
| **Document authorization** | **PASS** | Download links are dynamically resolved via authenticated API endpoints; no public unauthenticated URLs or S3 credentials exposed. |
| **Dental authorization** | **PASS** | Decision actions (`ACCEPT`, `REJECT`, `POSTPONE`) require valid authorization; server performs state machine and quotation ownership validation. |
| **Notification authorization** | **PASS** | Notifications are fetched per authenticated user/patient context and marked as read with validated ID parameters. |
| **Deep-link validation** | **PASS** | Deep-links use a strict allowlist (`appointments`, `prescriptions`, `records`, `billing`, `documents`, `dental`). Arbitrary URLs and external protocols are rejected. |
| **Sensitive logging** | **PASS** | Zero `console.log` / `console.error` calls exist in `apps/patient-mobile`. No PII, PHI, OTPs, or bearer tokens are printed to stdout/stderr. |
| **Secret scanning** | **PASS** | Static regex scan found 0 API secrets, private keys, service account credentials, or database passwords in mobile workspace. |
| **Environment configuration** | **PASS** | Public configuration is validated with Zod schema (`publicConfigSchema`); non-development environments enforce HTTPS endpoints. |
| **Lock-screen notification privacy** | **PASS** | In-app Notification Center is used. No background push notifications expose medical, clinical, or financial data on the lock screen. |
