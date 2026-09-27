# HMS Patient Mobile — Release Evidence Index

This directory contains the final release validation, QA auditing, and device test matrices for the **HMS Patient Mobile Application** (`@hms/patient-mobile`).

---

## Release Audit & Evidence Documents

1. [`PATIENT_MOBILE_RELEASE/RELEASE_QA_REPORT.md`](file:///c:/Users/lenovo/Documents/GitHub/HMS/PATIENT_MOBILE_RELEASE/RELEASE_QA_REPORT.md) — Final Release QA Report, build configurations, and overall release status (`RELEASE VALIDATED WITH KNOWN LIMITATIONS`).
2. [`PATIENT_MOBILE_RELEASE/DEVICE_TEST_MATRIX.md`](file:///c:/Users/lenovo/Documents/GitHub/HMS/PATIENT_MOBILE_RELEASE/DEVICE_TEST_MATRIX.md) — Real device test matrix and automated test evidence across all 9 application modules.
3. [`PATIENT_MOBILE_PHASE_10/REPORT.md`](file:///c:/Users/lenovo/Documents/GitHub/HMS/PATIENT_MOBILE_PHASE_10/REPORT.md) — Phase 10 Final Integration, Security & Release Report.
4. [`PATIENT_MOBILE_PHASE_10/FINAL_READINESS_AUDIT.md`](file:///c:/Users/lenovo/Documents/GitHub/HMS/PATIENT_MOBILE_PHASE_10/FINAL_READINESS_AUDIT.md) — Exhaustive readiness audit covering functional, security, privacy, and performance layers.
5. [`PATIENT_MOBILE_PHASE_10/FINAL_TEST_MATRIX.md`](file:///c:/Users/lenovo/Documents/GitHub/HMS/PATIENT_MOBILE_PHASE_10/FINAL_TEST_MATRIX.md) — Complete end-to-end automated test matrix.
6. [`PATIENT_MOBILE_PHASE_10/SECURITY_AUDIT.md`](file:///c:/Users/lenovo/Documents/GitHub/HMS/PATIENT_MOBILE_PHASE_10/SECURITY_AUDIT.md) — Comprehensive security and credential isolation audit.
7. [`PATIENT_MOBILE_PHASE_10/RELEASE_CHECKLIST.md`](file:///c:/Users/lenovo/Documents/GitHub/HMS/PATIENT_MOBILE_PHASE_10/RELEASE_CHECKLIST.md) — Final pre-release sign-off checklist.

---

## Known Limitations Summary

- **Online Payment:** `ONLINE PAYMENT NOT AVAILABLE IN CURRENT HMS PAYMENT CONTRACT` (Authoritative invoices and receipt view active; online gateway deferred).
- **Native Push:** `Native Push: NOT AVAILABLE IN CURRENT HMS PUSH CONTRACT` (In-app Notification Center active; background FCM/APNs deferred).
- **Environment Verification Code:** Fixed OTP `1234` configured for environment verification.
- **Physical Device Testing:** Hardware not attached to headless execution environment (`NOT PERFORMED`).
