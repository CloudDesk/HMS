# HMS Referral Booking and Doctor Calendar Integration Gap Note

## Scope

Post-release defect correction for OPD referrals, OPD follow-up scheduling, Emergency referrals, Referral Booking, and the existing Appointment Calendar. No new appointment or calendar source of truth is introduced.

## Reused implementation

- `OpdReferral` remains the OPD referral record and the OPD referral booking endpoint remains responsible for creating a specialist `Appointment` only after Reception selects a valid slot.
- `OpdFollowUp` remains the OPD follow-up plan and the existing follow-up scheduling endpoint remains responsible for creating a `FOLLOW_UP` Appointment.
- `Appointment` remains the sole source displayed by Doctor Schedule and Calendar.
- Emergency encounters, doctor/department lookup, patient identity, branch scope, audit, and timeline foundations remain in the Emergency domain.
- HMS Local referral, follow-up, Emergency workspace, and appointment-calendar interaction patterns are retained without using prototype persistence.

## Confirmed gaps

1. OPD consultation completion closes the visit before the feature hook submits its referral. The referral service simultaneously requires a completed consultation and rejects a completed visit, so the submit path is unreachable. The feature hook suppresses that failure, leaving only a draft, which the Referral Booking query correctly excludes.
2. The current OPD Follow-up tab renders uncontrolled date/doctor inputs and never passes a follow-up payload to the existing follow-up API. Consequently no `OpdFollowUp` or `Appointment` is created for the calendar.
3. The Emergency Referral tab only shows a success toast and clears React state. It makes no API request and has no persisted referral representation, so refresh/restart loses the entry and Referral Booking has nothing to query.
4. Referral Booking loads only submitted `OpdReferral` records. It has no Emergency referral query or source mapping.
5. Doctor Calendar correctly queries `Appointment`; submitted referrals are intentionally absent until Reception books them. Follow-ups must therefore create/link an Appointment through the existing appointment service.

## Intended contract

- OPD referral: completed OPD consultation -> idempotent submitted `OpdReferral` -> Referral Booking queue -> Reception slot selection -> linked `Appointment` -> Calendar.
- OPD follow-up: completed OPD consultation + date/doctor/time -> idempotent scheduled `OpdFollowUp` -> linked `FOLLOW_UP` Appointment -> Calendar.
- Emergency referral: `EMERGENCY_ENCOUNTER`-owned persisted referral snapshot -> Referral Booking queue -> Reception slot selection for an assigned HMS doctor and linked patient -> linked `Appointment` -> Calendar.
- Dates use the existing `YYYY-MM-DD` date-only appointment contract and the existing branch timezone conversion when a slot is booked.
- Canonical MongoDB doctor IDs and department IDs are used end to end; display names are snapshots only.
- One OPD referral per OPD visit, one follow-up per OPD visit, and one Emergency referral per Emergency encounter provide the idempotency boundary. Concurrent booking uses conditional appointment linkage and cancels an orphan appointment if another request wins.

## Intended files

- OPD referral/follow-up services and repositories, feature hooks, API hooks/types, and `OpdVisitPage`.
- Emergency model/types/repository/service/routes/schema and the Emergency frontend API/hook/workspace.
- Referral Booking feature/page and Appointment Booking feature/page for source-aware booking.
- Focused API/web tests.
- Shared service construction only where the Emergency service needs the existing Appointment service.

## Boundaries

- No automatic specialist appointment is created on referral submission.
- Emergency referrals are not stored as OPD referrals.
- No second calendar/event collection is created.
- No prototype or browser-local persistence is used.
- The next release phase is not started.
