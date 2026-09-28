import { describe, expect, it } from 'vitest';
import { formatHumanReadableDate, formatToDateString, parseFromDateString } from './date-utils';

/**
 * Helper to simulate the calendar grid generation algorithm in AppointmentDatePicker
 */
function generateCalendarGrid(viewYear: number, viewMonth: number, effectiveMinDate: string) {
  const firstDayIndex = new Date(viewYear, viewMonth, 1, 12, 0, 0).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0, 12, 0, 0).getDate();

  const days: ({ day: number; dateStr: string; isPast: boolean; weekdayIndex: number } | null)[] = [];

  // Leading empty cells before 1st day of month
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }

  // Days in current month
  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${viewYear}-${monthStr}-${dayStr}`;
    const isPast = dateStr < effectiveMinDate;
    const cellIndex = days.length;
    const weekdayIndex = cellIndex % 7;
    days.push({ day, dateStr, isPast, weekdayIndex });
  }

  return {
    firstDayIndex,
    daysInMonth,
    totalCells: days.length,
    days,
  };
}

describe('MyCare Date Picker — Calendar Weekday Alignment Audit', () => {
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdayShort = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  describe('1. Standard Sunday-First Weekday Conventions', () => {
    it('uses standard JS day mapping (0=Sunday ... 6=Saturday)', () => {
      expect(weekdayShort).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
      expect(weekdayNames[0]).toBe('Sunday');
      expect(weekdayNames[1]).toBe('Monday');
      expect(weekdayNames[2]).toBe('Tuesday');
      expect(weekdayNames[3]).toBe('Wednesday');
      expect(weekdayNames[4]).toBe('Thursday');
      expect(weekdayNames[5]).toBe('Friday');
      expect(weekdayNames[6]).toBe('Saturday');
    });
  });

  describe('2. September 2026 Verification (Screenshot Reference)', () => {
    it('correctly places 1 Sep 2026 under Tuesday (Index 2) with 2 leading empty cells', () => {
      const grid = generateCalendarGrid(2026, 8, '2026-09-28'); // Month 8 = September
      expect(grid.firstDayIndex).toBe(2); // Tuesday
      expect(grid.daysInMonth).toBe(30);

      // First two cells must be empty
      expect(grid.days[0]).toBeNull(); // Su
      expect(grid.days[1]).toBeNull(); // Mo

      // Day 1 must be Tuesday (Index 2)
      const day1 = grid.days[2];
      expect(day1).not.toBeNull();
      expect(day1?.day).toBe(1);
      expect(day1?.dateStr).toBe('2026-09-01');
      expect(day1?.weekdayIndex).toBe(2); // Tu
    });

    it('correctly places 28 Sep 2026 under Monday (Index 1)', () => {
      const grid = generateCalendarGrid(2026, 8, '2026-09-28');
      const cell28 = grid.days.find((c) => c?.day === 28);
      expect(cell28).not.toBeNull();
      expect(cell28?.dateStr).toBe('2026-09-28');
      expect(cell28?.weekdayIndex).toBe(1); // Mo
      expect(cell28?.isPast).toBe(false);
    });

    it('correctly places 29 Sep 2026 under Tuesday (Index 2)', () => {
      const grid = generateCalendarGrid(2026, 8, '2026-09-28');
      const cell29 = grid.days.find((c) => c?.day === 29);
      expect(cell29).not.toBeNull();
      expect(cell29?.dateStr).toBe('2026-09-29');
      expect(cell29?.weekdayIndex).toBe(2); // Tu
      expect(cell29?.isPast).toBe(false);
    });

    it('correctly places 30 Sep 2026 under Wednesday (Index 3) as the last day of month', () => {
      const grid = generateCalendarGrid(2026, 8, '2026-09-28');
      const cell30 = grid.days.find((c) => c?.day === 30);
      expect(cell30).not.toBeNull();
      expect(cell30?.dateStr).toBe('2026-09-30');
      expect(cell30?.weekdayIndex).toBe(3); // We
      expect(cell30?.isPast).toBe(false);
    });
  });

  describe('3. Deterministic Reference Dates', () => {
    const referenceCases = [
      { year: 2026, monthIndex: 0, day: 1, dateStr: '2026-01-01', expectedWeekday: 4, expectedName: 'Thursday' },
      { year: 2026, monthIndex: 1, day: 28, dateStr: '2026-02-28', expectedWeekday: 6, expectedName: 'Saturday' },
      { year: 2026, monthIndex: 2, day: 1, dateStr: '2026-03-01', expectedWeekday: 0, expectedName: 'Sunday' },
      { year: 2026, monthIndex: 8, day: 1, dateStr: '2026-09-01', expectedWeekday: 2, expectedName: 'Tuesday' },
      { year: 2026, monthIndex: 8, day: 28, dateStr: '2026-09-28', expectedWeekday: 1, expectedName: 'Monday' },
      { year: 2026, monthIndex: 8, day: 29, dateStr: '2026-09-29', expectedWeekday: 2, expectedName: 'Tuesday' },
      { year: 2026, monthIndex: 8, day: 30, dateStr: '2026-09-30', expectedWeekday: 3, expectedName: 'Wednesday' },
      { year: 2026, monthIndex: 11, day: 31, dateStr: '2026-12-31', expectedWeekday: 4, expectedName: 'Thursday' },
    ];

    referenceCases.forEach((testCase) => {
      it(`verifies ${testCase.dateStr} lands on ${testCase.expectedName} (Column Index ${testCase.expectedWeekday})`, () => {
        const grid = generateCalendarGrid(testCase.year, testCase.monthIndex, '2026-01-01');
        const cell = grid.days.find((c) => c?.day === testCase.day);
        expect(cell).not.toBeNull();
        expect(cell?.dateStr).toBe(testCase.dateStr);
        expect(cell?.weekdayIndex).toBe(testCase.expectedWeekday);
        expect(weekdayNames[cell!.weekdayIndex]).toBe(testCase.expectedName);
      });
    });
  });

  describe('4. Leap-Year Calculations', () => {
    it('correctly identifies February days across leap and non-leap years', () => {
      // 2024 is a leap year (29 days)
      const feb2024 = generateCalendarGrid(2024, 1, '2024-01-01');
      expect(feb2024.daysInMonth).toBe(29);
      expect(feb2024.days.find((c) => c?.day === 29)?.dateStr).toBe('2024-02-29');

      // 2025 is not a leap year (28 days)
      const feb2025 = generateCalendarGrid(2025, 1, '2025-01-01');
      expect(feb2025.daysInMonth).toBe(28);
      expect(feb2025.days.find((c) => c?.day === 29)).toBeUndefined();

      // 2026 is not a leap year (28 days)
      const feb2026 = generateCalendarGrid(2026, 1, '2026-01-01');
      expect(feb2026.daysInMonth).toBe(28);
      expect(feb2026.days.find((c) => c?.day === 29)).toBeUndefined();

      // 2027 is not a leap year (28 days)
      const feb2027 = generateCalendarGrid(2027, 1, '2027-01-01');
      expect(feb2027.daysInMonth).toBe(28);

      // 2028 is a leap year (29 days)
      const feb2028 = generateCalendarGrid(2028, 1, '2028-01-01');
      expect(feb2028.daysInMonth).toBe(29);
      expect(feb2028.days.find((c) => c?.day === 29)?.dateStr).toBe('2028-02-29');
    });
  });

  describe('5. Month Navigation & Year Transitions', () => {
    it('transitions smoothly from December 2026 to January 2027', () => {
      // December 2026
      const dec2026 = generateCalendarGrid(2026, 11, '2026-01-01');
      const dec31 = dec2026.days.find((c) => c?.day === 31);
      expect(dec31?.weekdayIndex).toBe(4); // Thursday

      // January 2027: 1st must be Friday (Index 5)
      const jan2027 = generateCalendarGrid(2027, 0, '2026-01-01');
      expect(jan2027.firstDayIndex).toBe(5); // Friday
      const jan1 = jan2027.days.find((c) => c?.day === 1);
      expect(jan1?.weekdayIndex).toBe(5); // Friday
    });

    it('transitions backward from January 2027 to December 2026', () => {
      let viewYear = 2027;
      let viewMonth = 0; // January

      // User presses previous month
      if (viewMonth === 0) {
        viewMonth = 11;
        viewYear -= 1;
      }

      expect(viewYear).toBe(2026);
      expect(viewMonth).toBe(11);

      const decGrid = generateCalendarGrid(viewYear, viewMonth, '2026-01-01');
      expect(decGrid.daysInMonth).toBe(31);
      expect(decGrid.firstDayIndex).toBe(2); // 1 Dec 2026 was Tuesday
    });
  });

  describe('6. Timezone-Safe Date String Formatting', () => {
    it('preserves exact date string without off-by-one shifts', () => {
      const parsed = parseFromDateString('2026-09-28');
      expect(formatToDateString(parsed)).toBe('2026-09-28');
      expect(formatHumanReadableDate('2026-09-28')).toBe('Mon, Sep 28, 2026');
    });
  });
});
