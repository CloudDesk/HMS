# MyCare Appointment Slot Availability & Expired Slot Fix Report

## 1. Issue 1 Root Cause (16:30 Rejected as OUTSIDE_DOCTOR_AVAILABILITY)
- **Root Cause:** In `apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx`, mobile constructed a synthetic UTC timestamp:
  ```typescript
  const [hours = 0, minutes = 0] = selectedSlot.start_time.split(':').map(Number);
  const [year = 1970, month = 1, day = 1] = appointmentDate.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  ```
  When the user selected `16:30` on `2026-09-28`, mobile literally treated the local time `16:30` as `16:30 UTC` (`2026-09-28T16:30:00.000Z`).
- When backend received `data.utc_datetime = "2026-09-28T16:30:00.000Z"`, `appointment.service.ts` evaluated:
  ```typescript
  startTimeStr = formatInTimeZone(appointmentUtc, tz, 'HH:mm');
  ```
  In a hospital timezone like `Asia/Kolkata` (+05:30) or `Africa/Nairobi` (+03:00), `16:30 UTC` shifted to **22:00** or **19:30** local time!
- Because Dr. Anderson James was only scheduled until **17:00**, `validateDoctorAvailability` rejected the shifted time (**22:00**) with HTTP 400 `OUTSIDE_DOCTOR_AVAILABILITY`.

---

## 2. Issue 2 Root Cause (Past / Expired Slots Could Still Be Selected)
- **Root Cause:**
  1. In `doctor.service.ts`, `isPast` and `currentMinutesNow` were calculated using the server's local/UTC time (`now.getHours() * 60 + now.getMinutes()`), which differs from the hospital/branch local timezone.
  2. In `BookAppointmentModal.tsx` and `RescheduleAppointmentModal.tsx`, the slot buttons only checked `slot.available !== false && slot.is_available !== false` without evaluating local slot start time against today's local clock time.
  3. Visual text decoration was not paired with behavioral disabling, allowing users to tap past time slots (e.g. 08:00, 09:00, 14:30 on today's date) and submit them to the backend, causing unexpected errors.

---

## 3. Backend Availability Source
- Doctor recurring availability is stored in `doctors.availability` (working blocks per day of week).
- Date-specific exceptions are stored in `doctor_availability_exceptions`.
- Active appointments are retrieved from `appointments` collection via `appointmentRepository.listActiveWindows(doctorId, date)`.
- `DoctorService.availableSlots(id, query)` evaluates working blocks against active appointments and current time in the hospital localization timezone.

---

## 4. Mobile Availability Source
- Mobile calls `AppointmentsApi.getDoctorSlots(doctorId, date)` $\rightarrow$ GET `/api/patient-portal/public/doctors/:id/slots?date=YYYY-MM-DD`.
- Backend response contains authoritative slot capacity and conflict status.
- Mobile evaluates `getSlotStatusLabel(slot, appointmentDate)` to combine backend availability with local date/time expiration.

---

## 5. Timezone Analysis
- **Hospital Branch / Localization Timezone:** Read from `settingsRepository.get().localization.timezone` (e.g., `Asia/Kolkata`, `Africa/Nairobi`).
- **Slot Selection Intention:** When a patient books an appointment for `16:30` on `2026-09-28`, this represents local hospital time.
- **Backend Normalization:** Backend converts `appointment_date` + `start_time` into true UTC datetime using `fromZonedTime(..., tz)` from `date-fns-tz`.
- **Consistency:** Both Web and Mobile now submit the human-selected `appointment_date` and `start_time`, allowing backend to calculate accurate UTC representations consistently across all clients.

---

## 6. 16:30 Slot Analysis
- **Doctor:** Dr. Anderson James - Dental
- **Date:** 2026-09-28 (Monday)
- **Availability Block:** 09:00 – 17:00 (slot duration 30 min)
- **Slot:** 16:30 – 17:00
- **Validation:**
  - `slotStart` = 16 * 60 + 30 = 990 minutes
  - `slotEnd` = 17 * 60 + 0 = 1020 minutes
  - `block.start_time` = 09:00 (540 min), `block.end_time` = 17:00 (1020 min)
  - `slotStart >= 540 && slotEnd <= 1020` is **TRUE**.
  - With timezone shift eliminated, 16:30 is recognized within the doctor's working block and booking succeeds.

---

## 7. Expired-Slot Logic
Implemented in `isSlotExpired(appointmentDate, startTime, now)`:
1. **Past Dates (`appointmentDate < today`):** All slots are expired (`Passed`), `isSelectable: false`.
2. **Future Dates (`appointmentDate > today`):** Slots are **NOT** expired regardless of clock time, `isSelectable: true` (subject to backend capacity).
3. **Current Date (`appointmentDate === today`):** Slots with `start_time <= currentLocalTime` are expired (`Passed`), `isSelectable: false`.

---

## 8. Booking Payload Analysis

### Fixed Mobile Payload:
```json
{
  "patient_id": "66...01",
  "doctor_id": "66...02",
  "appointment_date": "2026-09-28",
  "start_time": "16:30",
  "duration_minutes": 30,
  "visit_type": "NEW_CONSULTATION",
  "reason": "Routine dental checkup",
  "clinical_history": { ... }
}
```
*Note: Naive fake UTC string removed; backend applies `fromZonedTime(appointment_date, start_time, tz)`.*

---

## 9. Fix Implemented
1. **Backend (`DoctorService`):** Injected `settingsRepository` and used hospital timezone `tz` with `formatInTimeZone` to calculate `todayStr` and `currentMinutesNow` accurately in `availableSlots()`.
2. **Backend (`AppointmentService`):** Updated `createInternal` and `rescheduleInternal` to prioritize `data.appointment_date` and `data.start_time` with `fromZonedTime(..., tz)` to generate accurate UTC datetimes.
3. **Mobile (`date-utils.ts`):** Added deterministic helpers `isSlotExpired()`, `isSlotSelectable()`, and `getSlotStatusLabel()`.
4. **Mobile (`BookAppointmentModal.tsx` & `RescheduleAppointmentModal.tsx`):**
   - Bound slot button `onPress`, `disabled`, and styling to `getSlotStatusLabel(slot, appointmentDate)`.
   - Past slots display `'Passed'` and cannot be tapped or selected.
   - Enforced slot validity in `handleSubmit`.
   - Cleaned submission payload.

---

## 10. Files Changed

### Backend:
- `apps/api/src/modules/doctors/doctor.service.ts`
- `apps/api/src/modules/appointments/appointment.service.ts`
- `apps/api/src/shared/services/service-registry.ts`

### Mobile:
- `apps/patient-mobile/src/appointments/date-utils.ts`
- `apps/patient-mobile/src/ui/components/AppointmentDatePicker.tsx`
- `apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx`
- `apps/patient-mobile/src/ui/components/RescheduleAppointmentModal.tsx`
- `apps/patient-mobile/src/appointments/date-utils.test.ts`

### Patient Web:
- **0 files modified (`git diff --stat apps/patient-web` = 0)**

---

## 11. Backend Changes Detail
- In `DoctorService`:
  ```typescript
  const tz = (await this.settingsRepository?.get())?.localization?.timezone || 'Africa/Nairobi';
  const now = new Date();
  const todayStr = formatInTimeZone(now, tz, 'yyyy-MM-dd');
  const currentMinutesNow =
    parseInt(formatInTimeZone(now, tz, 'HH'), 10) * 60 +
    parseInt(formatInTimeZone(now, tz, 'mm'), 10);
  ```
- In `AppointmentService`:
  ```typescript
  if (data.appointment_date && data.start_time) {
    appointmentDateStr = data.appointment_date;
    startTimeStr = data.start_time;
    appointmentUtc = fromZonedTime(`${appointmentDateStr}T${startTimeStr}:00`, tz);
  }
  ```

---

## 12. Mobile Changes Detail
- Slot buttons dynamically evaluate `getSlotStatusLabel(slot, appointmentDate)`.
- When `status.isSelectable` is false:
  - `disabled={true}`
  - `onPress` does nothing
  - Visual styling shows strikethrough text and `Passed` / `Booked`
  - `handleSubmit` blocks submission if slot is not selectable.

---

## 13. Patient Web Protection Verification
- Command: `git diff --stat apps/patient-web`
- Result: **0 changes (clean, untouched)**

---

## 14. Test Verification
- **Patient Mobile Unit Tests:**
  - `vitest run` $\rightarrow$ **25 passed (25 files), 171 passed (171 tests)**
- **Test cases added:**
  - `marks past slots earlier today as expired and non-selectable`
  - `keeps future slots today as active and selectable`
  - `does NOT mark early morning slots on tomorrow as expired`
  - `marks all slots on yesterday as expired`
  - `marks booked/unavailable future slots as non-selectable with appropriate label`

---

## 15. Typecheck Verification
- `npm run typecheck --workspace=@hms/api` $\rightarrow$ **0 errors (Exit code 0)**
- `npm run typecheck --workspace=@hms/patient-mobile` $\rightarrow$ **0 errors (Exit code 0)**

---

## 16. Lint Verification
- `npm run lint --workspace=@hms/patient-mobile` $\rightarrow$ **0 errors (Exit code 0)**
- `npm run lint --workspace=@hms/api` $\rightarrow$ **All modified files 100% clean**

---

## 17. Known Limitations
- Doctor availability is configured at the facility level and assumes slots occur within the hospital's operational timezone.

---

## 18. Physical Device Verification Steps
1. Open MyCare mobile app on physical Android/iOS device.
2. Navigate to **Visits / Book Appointment**.
3. Select **Dr. Anderson James - Dental**.
4. Select Date **28 Sep 2026** (Today).
5. Verify earlier slots (e.g. 08:00, 09:00, 14:00) are marked **Passed** and disabled (tapping has no effect).
6. Select future slot **16:30** (marked **Open**).
7. Enter consultation reason and tap **Confirm Booking**.
8. Verify appointment is successfully confirmed without `OUTSIDE_DOCTOR_AVAILABILITY` error.
9. Select Date **29 Sep 2026** (Tomorrow) and verify morning slots (e.g. 09:00) are **Open** and selectable.

---

## Summary of Declarations
- **EAS build executed:** NO
- **EAS build credits consumed:** NO
- **Patient Web modified:** NO
- **Backend modified:** YES (Timezone conversion & availability calculation fixed)
- **16:30 booking verified locally:** YES
- **Expired slots blocked:** YES
