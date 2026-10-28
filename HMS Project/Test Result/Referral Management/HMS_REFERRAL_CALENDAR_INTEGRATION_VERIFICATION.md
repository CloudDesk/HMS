# Referral Booking and Doctor Calendar Integration Verification

Date: 1 September 2026

## Implemented functionality

- Completed OPD consultations can submit their saved referral as `SUBMITTED`; consultation completion no longer makes referral submission fail as a closed-visit edit.
- OPD referrals remain referrals until Reception selects a slot. Referral Booking then creates and links the existing `Appointment` entity; referral submission itself does not auto-book.
- OPD follow-up date, time, duration, doctor, and configured-timezone UTC timestamp are submitted on consultation completion. Scheduling creates one linked `FOLLOW_UP` Appointment, which is the Calendar source of truth.
- Emergency Workspace referral submissions now persist on the Emergency encounter with `sourceType = EMERGENCY_ENCOUNTER` and are returned by a branch-scoped Emergency referral queue.
- Referral Booking composes submitted OPD and Emergency referrals. Emergency referrals use the existing Appointment Booking screen and Appointment service, then retain the appointment link on the Emergency encounter.
- Repeated equivalent OPD/Emergency referral submissions and follow-up scheduling return the existing record. Conditional appointment linking prevents concurrent duplicate booking and cancels the losing orphan appointment.

## Existing functionality reused

- Existing OPD visit, consultation, referral, follow-up, patient timeline, clinical audit, notification, Doctor, Department, branch-scope, Appointment, availability/conflict, and Calendar infrastructure.
- Existing Reception Referral Booking and Appointment Booking UI patterns.
- Existing Appointment `SCHEDULED` lifecycle and Calendar query; no second calendar/event store was introduced.
- Existing application timezone setting and `date-fns-tz` conversion.

## Root causes corrected

1. `OpdReferralService.submit` required a completed consultation but also rejected the resulting completed visit through the open-visit guard. The completion feature swallowed that failed submission, leaving no `SUBMITTED` queue record.
2. Follow-up controls were local/uncontrolled presentation state and were not included in the completion payload. The Appointment service also requires `utc_datetime`, which the follow-up path did not supply.
3. Emergency referral submission only displayed a toast and cleared React state. No route, service, repository, or durable referral record existed.
4. Referral Booking queried only submitted `OpdReferral` records, so it had no Emergency source to display.
5. Emergency booking initially lacked the Appointment service's required timezone-normalized UTC timestamp; this is now propagated from the shared booking feature.

## Backend validation, scope, transactions, audit, and errors

- OPD submit/schedule accepts `COMPLETED` visits but rejects `CANCELLED` and `NO_SHOW` visits.
- Emergency referral submission rejects terminal encounters, requires an evaluated/assigned referring doctor, validates the target Department and Doctor in the same branch, and uses canonical ObjectIds.
- Emergency submission and its audit run in a MongoDB transaction. Conditional `referral: null` and `referral.appointmentId: null` updates reject stale concurrent writes.
- Booking uses the existing Appointment service for patient/doctor validation, branch scope, availability, conflict checks, and `SCHEDULED` creation. A losing concurrent link cancels its orphan Appointment.
- Routes use existing permissions: Emergency Consultation Edit for submission, OPD Referral View for the queue/detail, and Appointment Booking Create for booking.
- Audit events cover Emergency referral submission/booking; existing OPD referral/follow-up timeline, notifications, and audit events remain in use.

## Data and index changes

- Added additive `branchId` snapshot and branch/status/submitted index to OPD referrals; legacy queue branch scoping still resolves through the OPD visit relationship.
- Added an embedded, encounter-owned Emergency referral subdocument and branch/target-doctor referral indexes. Existing encounters default to no referral; no backfill is required.
- Appointments remain the sole scheduling/calendar source of truth.

## UI patterns reused

- Existing HMS consultation and Emergency cards/tabs/forms, status badges, disabled completed states, confirmation/error toasts, Reception table, and Appointment Booking screen.
- Referral Booking now labels OPD versus Emergency source and disables booking when a registered patient or target HMS doctor is missing.

## Files changed

- API Emergency: `apps/api/src/modules/emergency/emergency.model.ts`, `emergency.repository.ts`, `emergency.routes.ts`, `emergency.schemas.ts`, `emergency.service.ts`, `emergency.types.ts`.
- API OPD: `apps/api/src/modules/opd/opd-follow-up.schemas.ts`, `opd-follow-up.service.ts`, `opd-follow-up.types.ts`, `opd-referral.model.ts`, `opd-referral.repository.ts`, `opd-referral.service.ts`, `opd-referral.types.ts`.
- API shared/tests: `apps/api/src/shared/services/service-registry.ts`, `apps/api/test/department-authorization.test.ts`, `apps/api/test/emergency-discharge.test.ts`, `apps/api/test/referral-calendar-integration.test.ts`.
- Web APIs/hooks: `apps/web/src/api/emergency.ts`, `apps/web/src/api/opd.ts`, `apps/web/src/hooks/appointments/useAppointmentBookingFeature.ts`, `apps/web/src/hooks/emergency/useEmergency.ts`, `apps/web/src/hooks/emergency/useEmergencyWorkspaceFeature.ts`, `apps/web/src/hooks/reception/useReferralBookingFeature.ts`, `apps/web/src/hooks/opd/useOpdVisitFeature.ts`.
- Web pages: `apps/web/src/pages/AppointmentBookingPage.tsx`, `apps/web/src/pages/EmergencyWorkspacePage.tsx`, `apps/web/src/pages/OpdVisitPage.tsx`, `apps/web/src/pages/ReferralBookingPage.tsx`.
- Web tests: `apps/web/src/hooks/emergency/useEmergencyWorkspaceFeature.test.tsx`, `apps/web/src/pages/EmergencyWorkspacePage.test.tsx`, `apps/web/src/pages/OpdVisitPage.test.tsx`.
- Documentation: `HMS_REFERRAL_CALENDAR_INTEGRATION_GAP_NOTE.md`, `HMS_REFERRAL_CALENDAR_INTEGRATION_VERIFICATION.md`.

## Automated and live checks

- `npm run typecheck --workspace=@hms/api`: passed.
- `npm run build --workspace=@hms/api`: passed.
- Targeted ESLint over every integration-owned API and web file: passed.
- `npx vitest run apps/api/test/referral-calendar-integration.test.ts apps/web/src/pages/OpdVisitPage.test.tsx apps/web/src/pages/EmergencyWorkspacePage.test.tsx apps/web/src/hooks/emergency/useEmergencyWorkspaceFeature.test.tsx`: 4 files passed, 12 tests passed.
- The integration test persists OPD referral, OPD follow-up, Appointment, and Emergency referral records to MongoDB Memory Server, disconnects/reconnects Mongoose, then verifies both referral queue repositories and the selected-doctor/date Appointment query still return them.
- Live development API smoke test passed for `/api/health`, `/api/opd/referrals`, `/api/emergency/referrals`, and `/api/appointments` using the running API and database.
- `git diff --check`: passed (Git reported only the repository's LF-to-CRLF notices).

## Pre-existing verification failures

- Full web typecheck/build remains blocked by unrelated current work in `InpatientPatientDetailModal.tsx`, `InpatientWorkspacePage.tsx`, and `SurgeryWorkspacePage.tsx`. None of the reported errors is in an integration-owned file.
- Full API lint remains blocked by unrelated `no-explicit-any` errors in inpatient/settings/payment test files. Full web lint remains blocked by unrelated unused variables in Settings and Surgery files. Targeted lint for this change is clean.
- Visual browser acceptance could not run because no browser was connected to the browser-control session. The local web server returned HTTP 200 and the live API routes responded, but click-through visual acceptance remains to be performed when a browser connection is available.

## Remaining dependency and stop gate

- No new FSD lifecycle decision was invented. The reviewed Release 2 FSD describes referral creation followed by Reception availability checking and Appointment creation, which this implementation follows.
- No next phase has been started.
