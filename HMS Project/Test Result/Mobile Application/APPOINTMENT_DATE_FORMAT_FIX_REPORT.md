# MyCare Patient Mobile — Appointment Date Format Fix Report

## 1. Executive Summary
In the **MyCare** patient mobile application (`apps/patient-mobile`), appointment cards (specifically under "Past Visits" and "Upcoming Visits") and associated appointment detail/reschedule views previously rendered raw date/timestamp strings (e.g. `2026-09-17T00:00:00.000Z` or `2026-09-17`) directly on screen.

This fix introduces a centralized, timezone-safe formatting helper `formatAppointmentDate()` in `apps/patient-mobile/src/appointments/date-utils.ts` and applies it across all appointment surfaces. Raw ISO dates and UTC timestamps are now formatted into clean, patient-friendly dates (e.g., `17 Sep 2026`) without daylight savings shifts or timezone day-drift, while keeping the Date of Birth (`DD-MM-YYYY`) formatting strictly isolated.

---

## 2. Scope & Brand Alignment
- **Patient-Facing Brand:** `MyCare`
- **Internal Technical Package:** `@hms/patient-mobile` (unmodified)
- **Directory Path:** `apps/patient-mobile` (unmodified)
- **Backend/API Contracts & Naming:** Unchanged (`appointment_date`, `/api/patient-portal/appointments`)
- **Zero EAS Builds:** Verified — No `eas build` was triggered and zero build credits consumed.

---

## 3. Audit Findings & Root Cause Analysis
1. **Backend Serialization:** The backend API endpoint `/api/patient-portal/appointments` retrieves appointments from MongoDB and returns `appointment_date` serialized as an ISO string (e.g. `"2026-09-17T00:00:00.000Z"` or `"2026-09-17"`).
2. **Direct Template Interpolation in UI:**
   - In `AppointmentsScreen.tsx` (line 233): `{apt.appointment_date} • {apt.start_time} - {apt.end_time}` rendered the raw value directly without formatting.
   - In `AppointmentDetailsModal.tsx` (line 131): `📅 {appointment.appointment_date}` rendered the raw string directly.
   - In `RescheduleAppointmentModal.tsx` (line 227): `{appointment.appointment_date} · {appointment.start_time}–{appointment.end_time}` rendered the raw string directly.
3. **Date Helper Limitation:** `date-utils.ts` had a `formatHumanReadableDate()` function that only tested against strict `^\d{4}-\d{2}-\d{2}$`, failing on any timestamp format (`YYYY-MM-DDTHH:mm:ss.sssZ`) and returning the raw string unformatted.

---

## 4. Data Flow Tracing

```
MongoDB (appointments collection: appointment_date as Date / ISODate)
  │
  ▼
Backend Route & Controller (`/api/patient-portal/appointments`)
  │
  ▼
Mobile Client (`AppointmentsApi.getAppointments()`)
  │
  ▼
Domain Contract (`PortalAppointment.appointment_date`: string)
  │
  ├─► AppointmentsScreen (Past & Upcoming cards) ──► formatAppointmentDate(apt.appointment_date) ──► "17 Sep 2026"
  │
  ├─► AppointmentDetailsModal (Schedule section)  ──► formatAppointmentDate(appointment.appointment_date) ──► "17 Sep 2026"
  │
  └─► RescheduleAppointmentModal (Banner)         ──► formatAppointmentDate(appointment.appointment_date) ──► "17 Sep 2026"
```

---

## 5. Format Comparison Matrix

| Scenario / Input Value | Previous Display | Fixed Display (`formatAppointmentDate`) | Notes |
| :--- | :--- | :--- | :--- |
| Past Visit (`"2026-09-17T00:00:00.000Z"`) | `2026-09-17T00:00:00.000Z` | `17 Sep 2026` | Formatted cleanly |
| Past Visit (`"2026-09-17"`) | `2026-09-17` | `17 Sep 2026` | Formatted cleanly |
| Single Digit Day (`"2026-01-05"`) | `2026-01-05` | `5 Jan 2026` | Patient-friendly |
| Month End (`"2026-12-31"`) | `2026-12-31` | `31 Dec 2026` | Patient-friendly |
| Timestamp with Hour (`"2026-09-17T14:30:00.000Z"`) | `2026-09-17T14:30:00.000Z` | `17 Sep 2026` | No UTC day shift |
| Null / Undefined / Empty (`null`, `""`) | `null` / empty | `-` | Safe fallback |
| Invalid String (`"invalid-date"`) | `"invalid-date"` | `"invalid-date"` | Non-crashing graceful fallback |
| Date of Birth (`"2026-09-17T00:00:00.000Z"`) | `17-09-2026` | `17-09-2026` | Unchanged (`formatDateOfBirth`) |

---

## 6. Timezone & Daylight Saving Protection
- Standard JavaScript `new Date("2026-09-17T00:00:00.000Z").toLocaleDateString()` in timezones behind UTC (such as UTC-5 / EST) resolves `2026-09-17T00:00:00.000Z` as `2026-09-16 19:00:00`, causing an erroneous 1-day backward shift.
- To eliminate this defect, `formatAppointmentDate()` extracts the date components (`year`, `month`, `day`) directly via regex (`^(\d{4})-(\d{2})-(\d{2})`) before parsing.
- For non-matching date objects, it queries UTC getters (`getUTCDate()`, `getUTCMonth()`, `getUTCFullYear()`) ensuring zero day-shift regardless of client device timezone.

---

## 7. Exact Files Modified

1. `apps/patient-mobile/src/appointments/date-utils.ts`: Added `formatAppointmentDate()`, updated `formatHumanReadableDate()` to support ISO timestamps.
2. `apps/patient-mobile/src/ui/components/AppointmentDatePicker.tsx`: Re-exported `formatAppointmentDate()`.
3. `apps/patient-mobile/src/ui/screens/AppointmentsScreen.tsx`: Applied `formatAppointmentDate(apt.appointment_date)` to appointment card headers.
4. `apps/patient-mobile/src/ui/components/AppointmentDetailsModal.tsx`: Applied `formatAppointmentDate(appointment.appointment_date)` to the Schedule section.
5. `apps/patient-mobile/src/ui/components/RescheduleAppointmentModal.tsx`: Applied `formatAppointmentDate(appointment.appointment_date)` to current schedule banner.
6. `apps/patient-mobile/src/appointments/date-utils.test.ts`: Added comprehensive unit tests covering ISO strings, single-digit dates, UTC boundaries, null safety, and DOB isolation.

---

## 8. Date Formatter Implementation Details

```typescript
export function formatAppointmentDate(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return '-';
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  if (match && match[1] && match[2] && match[3]) {
    const year = match[1];
    const monthIndex = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const month = months[monthIndex];
    if (month && !isNaN(day)) {
      return `${day} ${month} ${year}`;
    }
  }
  try {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return trimmed;
    const day = d.getUTCDate();
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    if (month && !isNaN(day) && !isNaN(year)) {
      return `${day} ${month} ${year}`;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}
```

---

## 9. Patient Profile / DOB Isolation
- Patient Profile Date of Birth continues to use `formatDateOfBirth()` from `apps/patient-mobile/src/portal/formatters.ts` producing `DD-MM-YYYY` (e.g. `17-09-2026`).
- Appointment dates and DOB formatters remain in separate domain files with explicit regression tests asserting distinct format behaviors.

---

## 10. Patient Web Protection Verification
Command executed:
```bash
git diff --stat apps/patient-web
```
**Result:** `0` changes (diff is completely empty).

---

## 11. Backend Protection Verification
Command executed:
```bash
git diff --stat apps/api
```
**Result:** `0` changes (diff is completely empty).

---

## 12. Automated Verification Results

### Unit Tests:
```bash
npm run test --workspace=@hms/patient-mobile
```
- **Test Files:** 25 passed (25)
- **Tests:** 166 passed (166)
- **Duration:** 16.95s

### TypeScript Typecheck:
```bash
npm run typecheck --workspace=@hms/patient-mobile
```
- **Result:** Exit code 0 (No type errors).

### ESLint Check:
```bash
npm run lint --workspace=@hms/patient-mobile
```
- **Result:** Exit code 0 (No lint errors).

---

## 13. Manual & Scenario Verification
- [x] Past Visits list displays dates as `17 Sep 2026`
- [x] Upcoming Visits list displays dates as `17 Sep 2026`
- [x] Appointment Details modal displays `📅 17 Sep 2026`
- [x] Reschedule modal displays current scheduled time as `17 Sep 2026 · 10:00 - 10:30`
- [x] Date Picker continues to output backend-compliant `YYYY-MM-DD` (`2026-09-17`) for submission
- [x] No timezone day-shift across UTC-12 to UTC+14

---

## 14. Zero EAS Build Declaration
No EAS build was created or queued. Build credits consumed: **0**.

---

## 15. Risk Assessment & Mitigations
- **Risk:** Stored dates containing unexpected whitespace or non-standard ISO formats.
- **Mitigation:** `.trim()` applied, regex handles both `YYYY-MM-DD` and `YYYY-MM-DDTHH:mm:ss.sssZ`, and graceful UTC fallback handles standard date strings without throwing errors.

---

## 16. Final Sign-Off
All acceptance criteria met. Past visit dates and appointment schedules throughout **MyCare** are now consistently formatted in patient-friendly format (`17 Sep 2026`) with zero web/backend diffs and 100% test passage.
