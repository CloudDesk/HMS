# HMS Phase 1 Developer 2 - Appointment Calendar and Queue Gap Analysis

## Source Reviewed

- `HMS_PHASE1_PROGRESS_AUDIT.md`
- `PROJECT_RULES.md`
- HMS Local prototype screens:
  - `doctor-schedule.html`
  - `appointment-dashboard.html`
  - `appointment-calendar.html`
  - `appointment-queue.html`
- Live React application under `apps/web`
- Existing appointment backend under `apps/api/src/modules/appointments`

## Gap Summary

| Area | Audit / Existing Status | Requested Addition | Included Now | Remaining Gap |
| --- | --- | --- | --- | --- |
| Doctor Schedule UI | Doctor schedule foundation exists, but live screen was limited to a single-doctor day list. | Match prototype calendar/time-slot view. | Day time-slot view retained and Week/Month calendar views added using live appointment data. | Dedicated doctor leave/block-time records are still not modeled. |
| Appointment Dashboard | Appointment APIs and booking exist; dashboard needed prototype visual structure. | Match prototype KPI, trend, quick actions, upcoming, and notifications layout. | Prototype-style dashboard panels added above live appointment table. | Snapshot-based dashboard collections are still not implemented. Metrics are derived from paginated appointment API results for this phase only. |
| Appointment Calendar | Sidebar route existed but resolved to Coming Soon. | Show all doctors' appointments in calendar format. | `/appointments/calendar` added with Day/Week/Month, department/doctor/status/date filters, print, export, and event navigation. | Drag/move/reschedule from calendar cells is not implemented yet; reschedule continues through appointment edit API/future UI. |
| Queue Management | Sidebar route existed but resolved to Coming Soon. | Live queue summary and calling controls. | `/appointments/queue` added using live appointment records and status updates. | A dedicated OPD visit/queue collection is still required for full clinical handoff, room assignment, vitals dependency, and token audit trail. |
| Call Next | No queue action existed. | Call the next waiting patient. | Calls the first waiting appointment and marks it `CHECKED_IN`. | Needs future real-time queue display/notification channel. |
| Recall Patient | No queue action existed. | Recall current patient. | Shows live confirmation toast for the active `CHECKED_IN` patient. | Needs audio/display integration later if required. |
| Skip Patient | No queue action existed. | Skip current patient and move them to the last waiting position. | Adds `SKIPPED` status; skipped appointments sort after regular waiting tokens and can be called again after other waiting patients. | A future queue-token history model should record each skip event separately. |
| Mark No Show | Existing `NO_SHOW` status existed. | Mark absent patient. | Current called patient can be persisted as `NO_SHOW`. | Policy for marking no-show before calling is not defined; current implementation requires the patient to be called first. |
| Complete Visit | No completed status existed. | Mark patient visit completed after validation. | Adds `COMPLETED` status and requires a completion note before persisting completion. | Full OPD consultation validation must later require visit, vitals, consultation notes, diagnosis, and prescription state when OPD module is implemented. |
| Status Contract | Existing enum: `SCHEDULED`, `CONFIRMED`, `CHECKED_IN`, `CANCELLED`, `RESCHEDULED`, `NO_SHOW`. | Queue needs skipped and completed lifecycle states. | Backend/frontend appointment contract extended with `SKIPPED` and `COMPLETED`. | If downstream OPD creates its own visit status enum, appointment-to-visit sync rules must be defined. |

## Developer Scope Included

1. Live Doctor Schedule day/week/month calendar behavior.
2. Live Appointment Dashboard prototype-style metrics, trend, quick actions, upcoming list, and notifications.
3. Live Appointment Calendar view across all doctors.
4. Live Queue Management screen with filters, token display, queue summary, export, and patient profile navigation.
5. Queue action persistence through existing appointment status API:
   - `Call Next` -> `CHECKED_IN`
   - `Skip Patient` -> `SKIPPED`
   - `Mark No Show` -> `NO_SHOW`
   - `Complete Visit` -> `COMPLETED`
6. Completion-note validation before completing a visit.

## Known Dependencies For Later Phases

- OPD Visit model and APIs.
- Vitals model and doctor handoff validation.
- Consultation, diagnosis, prescription, referral, lab order, and imaging order modules.
- Dedicated queue/token event history if audit requires every call/recall/skip/no-show action as separate records.
- Real-time queue display or notification integration.
- Dashboard snapshot collections and background jobs, as required by `PROJECT_RULES.md`.

## Developer Note

This implementation intentionally does not create mock queue data. Empty calendar, dashboard, and queue states render zero/live empty UI using persisted MongoDB appointment records only.
