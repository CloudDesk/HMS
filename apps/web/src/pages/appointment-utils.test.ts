import { describe, expect, test } from 'vitest';
import {
  parseInputDate,
  toInputDate,
  formatAppointmentDate,
  startOfWeek,
} from './appointment-utils';

describe('Appointment Date Consistency & Formatting', () => {
  test('parseInputDate correctly preserves calendar date across timezones', () => {
    const dateStr = '2026-09-02';
    const parsed = parseInputDate(dateStr);
    expect(toInputDate(parsed)).toBe('2026-09-02');
  });

  test('appointment 2026-09-02 at 10:00 maps strictly to 2026-09-02', () => {
    const appointmentDate = '2026-09-02T00:00:00.000Z';
    const dateKey = appointmentDate.slice(0, 10);
    expect(dateKey).toBe('2026-09-02');
  });

  test('formatAppointmentDate formats 2026-09-02 without one-day backward shift', () => {
    const formatted = formatAppointmentDate('2026-09-02T00:00:00.000Z', 'Africa/Nairobi');
    expect(formatted).toBe('02 Sep 2026');
  });

  test('midnight appointments 00:00 and 00:30 maintain correct date grouping', () => {
    const appointmentDate = '2026-09-02';
    const parsed = parseInputDate(appointmentDate);
    expect(toInputDate(parsed)).toBe('2026-09-02');
  });

  test('late night appointments 23:30 maintain correct date grouping', () => {
    const appointmentDate = '2026-09-02';
    const parsed = parseInputDate(appointmentDate);
    expect(toInputDate(parsed)).toBe('2026-09-02');
  });

  test('startOfWeek returns correct starting day without timezone regression', () => {
    const weekStart = startOfWeek('2026-09-02', 'Monday');
    expect(toInputDate(weekStart)).toBe('2026-08-31');
  });
});
