import { describe, expect, it } from 'vitest';
import {
  formatHumanReadableDate,
  formatToDateString,
  getQuickDateOptions,
  parseFromDateString,
} from './date-utils';

describe('Appointment Date Utilities', () => {
  it('formats Date object to YYYY-MM-DD string timezone-safely', () => {
    const d = new Date(2026, 8, 28, 14, 30); // Month index 8 = September
    expect(formatToDateString(d)).toBe('2026-09-28');
  });

  it('parses YYYY-MM-DD string to Date at noon preventing timezone shift', () => {
    const d = parseFromDateString('2026-09-28');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(28);
    expect(d.getHours()).toBe(12);
  });

  it('formats human readable date correctly', () => {
    const readable = formatHumanReadableDate('2026-09-28');
    expect(readable).toBe('Mon, Sep 28, 2026');
  });

  it('generates 5 quick date options starting with Today and Tomorrow', () => {
    const options = getQuickDateOptions('2026-09-28');
    expect(options).toHaveLength(5);
    expect(options[0]).toEqual({ label: 'Today', date: '2026-09-28' });
    expect(options[1]).toEqual({ label: 'Tomorrow', date: '2026-09-29' });
    expect(options[2]?.date).toBe('2026-09-30');
    expect(options[3]?.date).toBe('2026-10-01');
    expect(options[4]?.date).toBe('2026-10-02');
  });

  it('handles month boundaries without off-by-one errors', () => {
    const endOfMonth = parseFromDateString('2026-09-30');
    const nextDay = new Date(endOfMonth);
    nextDay.setDate(endOfMonth.getDate() + 1);
    expect(formatToDateString(nextDay)).toBe('2026-10-01');
  });
});
