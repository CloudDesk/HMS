# MYCARE — APPOINTMENT DATE PICKER CALENDAR WEEKDAY ALIGNMENT AUDIT REPORT

**Document Version:** 1.0.0  
**Date:** 2026-09-28  
**Application:** MyCare Native Patient Mobile (`apps/patient-mobile`)  
**Components Audited & Updated:**
- `apps/patient-mobile/src/ui/components/AppointmentDatePicker.tsx`
- `apps/patient-mobile/src/appointments/date-utils.ts`
- `apps/patient-mobile/src/appointments/calendar-weekday-alignment.test.ts`

---

## 1. Executive Summary & Compliance Overview

An end-to-end mathematical and layout audit was performed on the MyCare "Book Appointment" custom date-picker calendar grid (`AppointmentDatePicker.tsx`) to ensure strict weekday alignment across all months, leap years, month navigations, and year boundaries.

### Audit Conclusion
1. **Mathematical Weekday Calculation**: The calendar uses the standard JavaScript Sunday-first convention ($\text{Sunday}=0, \text{Monday}=1, \dots, \text{Saturday}=6$) matching the 7 column headers (`Su`, `Mo`, `Tu`, `We`, `Th`, `Fr`, `Sa`).
2. **September 2026 Verification**:
   - $\text{Sep 1, 2026} \rightarrow \text{Tuesday (Index 2)}$ with 2 leading empty cells (`Su`, `Mo`).
   - $\text{Sep 28, 2026} \rightarrow \text{Monday (Index 1)}$ — verified matching the physical device screenshot.
   - $\text{Sep 29, 2026} \rightarrow \text{Tuesday (Index 2)}$.
   - $\text{Sep 30, 2026} \rightarrow \text{Wednesday (Index 3)}$.
3. **Enhancements Implemented**:
   - Inoculated calendar grid calculations against midnight Daylight Saving Time (DST) shifts by using noon timestamps (`new Date(viewYear, viewMonth, 1, 12, 0, 0)`).
   - Unified column widths between `weekRow` (`weekDayLabel: { width: '14.285%', textAlign: 'center' }`) and `daysGrid` (`dayCell` / `dayCellEmpty: { width: '14.285%' }`) for pixel-perfect vertical alignment across all screen sizes.
4. **Safety & Compliance**:
   - `apps/patient-web` diff remains **0** (untouched).
   - Zero EAS build credits were consumed.
   - 205 tests across 27 test files passed in `@hms/patient-mobile`.
   - TypeScript compilation: 0 errors; ESLint: 0 errors / 0 warnings.

---

## 2. Compliance Checklist

| Requirement | Status | Details |
|---|---|---|
| **EAS Build Executed** | **NO** | No `eas build` commands run |
| **EAS Build Credits Consumed** | **NO** | 0 credits used |
| **Patient Web Modified** | **NO** | `git diff --stat apps/patient-web` = 0 |
| **Backend Modified** | **NO** | Backend is untouched for calendar UI audit |
| **September 28, 2026 Weekday Verified** | **PASS** | Confirmed under Monday (Column 1) |
| **Calendar Weekday Alignment** | **PASS** | Verified across all months & reference dates |
| **Appointment Selected-Date Integrity** | **PASS** | Tapping 28 outputs `'2026-09-28'` without off-by-one shifts |

---

## 3. Detailed Audit Findings

### A. Weekday Index & Header Mapping
The calendar UI presents 7 column headers:
$$\text{Column 0: Su} \quad \text{Column 1: Mo} \quad \text{Column 2: Tu} \quad \text{Column 3: We} \quad \text{Column 4: Th} \quad \text{Column 5: Fr} \quad \text{Column 6: Sa}$$

JavaScript's native `Date.prototype.getDay()` returns:
- `0` for Sunday
- `1` for Monday
- `2` for Tuesday
- `3` for Wednesday
- `4` for Thursday
- `5` for Friday
- `6` for Saturday

Because the UI header order directly matches `getDay()`, no artificial offsets are required.

### B. Grid Generation Algorithm
```tsx
const firstDayIndex = new Date(viewYear, viewMonth, 1, 12, 0, 0).getDay();
const daysInMonth = new Date(viewYear, viewMonth + 1, 0, 12, 0, 0).getDate();

const days: ({ day: number; dateStr: string; isPast: boolean } | null)[] = [];

// 1. Prepend leading empty cells for offset
for (let i = 0; i < firstDayIndex; i++) {
  days.push(null);
}

// 2. Append numbered days of month
for (let day = 1; day <= daysInMonth; day++) {
  const monthStr = String(viewMonth + 1).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  const dateStr = `${viewYear}-${monthStr}-${dayStr}`;
  const isPast = dateStr < effectiveMinDate;
  days.push({ day, dateStr, isPast });
}
```

### C. Timezone & DST Safety
- Standard JavaScript `new Date("2026-09-28")` parses as UTC in ISO formats, which can shift the day if formatted via local time functions in negative UTC offset zones.
- `date-utils.ts` prevents this by using `parseFromDateString` with explicit year, month, day components at `12:00:00` (noon).
- The calendar generation in `AppointmentDatePicker.tsx` was updated to also use `12, 0, 0` for `firstDayIndex` and `daysInMonth`.

---

## 4. Verification Matrix

### A. Reference Date Alignment
| Date String | Target Month | Day Number | Calculated Weekday Index | Weekday Name | Alignment Status |
|---|---|---|---|---|---|
| `2026-01-01` | Jan 2026 | 1 | 4 | Thursday | **PASS** |
| `2026-02-28` | Feb 2026 | 28 | 6 | Saturday | **PASS** |
| `2026-03-01` | Mar 2026 | 1 | 0 | Sunday | **PASS** |
| `2026-09-01` | Sep 2026 | 1 | 2 | Tuesday | **PASS** |
| `2026-09-28` | Sep 2026 | 28 | 1 | Monday | **PASS** (Matches screenshot) |
| `2026-09-29` | Sep 2026 | 29 | 2 | Tuesday | **PASS** |
| `2026-09-30` | Sep 2026 | 30 | 3 | Wednesday | **PASS** |
| `2026-12-31` | Dec 2026 | 31 | 4 | Thursday | **PASS** |

### B. Leap Year Calculations
- **February 2024 (Leap Year)**: 29 days (`2024-02-29` is Thursday, Index 4) $\rightarrow$ **PASS**
- **February 2025 (Non-leap)**: 28 days $\rightarrow$ **PASS**
- **February 2026 (Non-leap)**: 28 days (`2026-02-01` is Sunday, Index 0; `2026-02-28` is Saturday, Index 6) $\rightarrow$ **PASS**
- **February 2027 (Non-leap)**: 28 days $\rightarrow$ **PASS**
- **February 2028 (Leap Year)**: 29 days (`2028-02-29` is Tuesday, Index 2) $\rightarrow$ **PASS**

### C. Month Navigation & Year Transitions
- **Dec 2026 $\rightarrow$ Jan 2027**: Dec 31 is Thursday (Index 4); Jan 1 is Friday (Index 5 with 5 leading empty cells) $\rightarrow$ **PASS**
- **Jan 2027 $\rightarrow$ Dec 2026**: Moving backward across year boundary resets `viewYear` to `2026` and `viewMonth` to `11` (Dec, 31 days) $\rightarrow$ **PASS**

---

## 5. Automated Test Suite

A dedicated test suite [`calendar-weekday-alignment.test.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/appointments/calendar-weekday-alignment.test.ts) was added with 17 deterministic tests.

```
Test Files: 27 passed (27)
Tests:      205 passed (205)
Duration:   13.53s
```

All checks passed:
- `npm run test --workspace=@hms/patient-mobile` $\rightarrow$ **205 passed**
- `npm run typecheck --workspace=@hms/patient-mobile` $\rightarrow$ **0 errors**
- `npm run lint --workspace=@hms/patient-mobile` $\rightarrow$ **0 errors / 0 warnings**
- `git diff --stat apps/patient-web` $\rightarrow$ **0 diff**
