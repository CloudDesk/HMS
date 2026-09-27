# HMS Patient Mobile — Final Test Matrix

| Area | Test | Result | Evidence |
|---|---|---|---|
| **Auth** | Login (OTP Request & Verification) | **PASS** | `src/auth/auth-api.test.ts`, `src/auth/session-manager.test.ts`, `apps/api/src/modules/auth/native-auth.integration.test.ts` |
| **Auth** | Refresh & Token Rotation | **PASS** | `src/auth/session-manager.test.ts`, `apps/api/src/modules/auth/native-auth.integration.test.ts` |
| **Auth** | Single-Session Logout | **PASS** | `src/auth/session-manager.test.ts`, `apps/api/src/modules/auth/native-auth.integration.test.ts` |
| **Context** | Self Context Switching | **PASS** | `src/portal/patient-context.test.ts`, `src/portal/portal-api.test.ts` |
| **Context** | Dependent / Family Context Switching | **PASS** | `src/portal/patient-context.test.ts`, `src/portal/portal-api.test.ts` |
| **Appointments** | View Upcoming & Historical Appointments | **PASS** | `src/appointments/contracts.test.ts`, `src/appointments/appointments-api.test.ts` |
| **Appointments** | Reschedule Appointment Slot | **PASS** | `src/appointments/appointments-api.test.ts` |
| **Prescriptions** | View Prescriptions & Drug Lines | **PASS** | `src/prescriptions/contracts.test.ts`, `src/prescriptions/prescriptions-api.test.ts` |
| **Lab** | View Lab Test Panels & Statuses | **PASS** | `src/records/contracts.test.ts`, `src/records/records-api.test.ts` |
| **Imaging** | View Radiology Reports & Modalities | **PASS** | `src/records/contracts.test.ts`, `src/records/records-api.test.ts` |
| **Billing** | View Invoices & Payment Summaries | **PASS** | `src/billing/contracts.test.ts`, `src/billing/billing-api.test.ts` |
| **Documents** | View Clinical Documents List | **PASS** | `src/documents/contracts.test.ts`, `src/documents/documents-api.test.ts` |
| **Documents** | Resolve Authenticated Download URL | **PASS** | `src/documents/documents-api.test.ts` |
| **Dental** | View Treatment Quotations & Procedures | **PASS** | `src/dental/contracts.test.ts`, `src/dental/dental-api.test.ts` |
| **Dental** | Decision Action (Accept / Reject / Postpone) | **PASS** | `src/dental/contracts.test.ts`, `src/dental/dental-api.test.ts` |
| **Notifications** | List In-App Notifications & Unread Filter | **PASS** | `src/notifications/contracts.test.ts`, `src/notifications/notifications-api.test.ts` |
| **Notifications** | Mark Notification as Read | **PASS** | `src/notifications/notifications-api.test.ts` |
| **Notifications** | Allowlisted Safe Internal Deep Linking | **PASS** | `src/notifications/contracts.test.ts` |
| **Patient Web** | Typecheck (`tsc -b --noEmit`) | **PASS** | `npm run typecheck --workspace=@hms/patient-web` (0 errors) |
| **Patient Web** | Production Build (`vite build`) | **PASS** | `npm run build --workspace=@hms/patient-web` (Clean dist output) |
| **Mobile** | Typecheck (`tsc --noEmit`) | **PASS** | `npm run typecheck --workspace=@hms/patient-mobile` (0 errors) |
| **Mobile** | Lint (`eslint .`) | **PASS** | `npm run lint --workspace=@hms/patient-mobile` (0 errors/warnings) |
| **Mobile** | Full Test Suite (`vitest`) | **PASS** | `npm test --workspace=@hms/patient-mobile` (21 suites, 103 tests passed) |
| **Mobile** | Native Bundle Export (`expo export`) | **PASS** | `npm run export:native --workspace=@hms/patient-mobile` (iOS & Android 2.3MB Hermes bundles) |

---

## Test Execution Summary

- **Total Mobile Unit & Integration Test Suites:** 21
- **Total Mobile Tests Passed:** 103 / 103 (100%)
- **Total Backend Native Auth Tests Passed:** 30 / 30 (100%)
- **Test Failures:** 0
