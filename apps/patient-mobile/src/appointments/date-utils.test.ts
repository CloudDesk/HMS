import { describe, expect, it } from 'vitest';
import {
  formatAppointmentDate,
  formatHumanReadableDate,
  formatToDateString,
  getQuickDateOptions,
  getSlotStatusLabel,
  isSlotExpired,
  isSlotSelectable,
  parseFromDateString,
} from './date-utils';
import { formatDateOfBirth } from '../portal/formatters';

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

  it('formats human readable date correctly for YYYY-MM-DD and ISO strings', () => {
    expect(formatHumanReadableDate('2026-09-28')).toBe('Mon, Sep 28, 2026');
    expect(formatHumanReadableDate('2026-09-28T00:00:00.000Z')).toBe('Mon, Sep 28, 2026');
    expect(formatHumanReadableDate('  2026-09-28  ')).toBe('Mon, Sep 28, 2026');
    expect(formatHumanReadableDate('')).toBe('');
    expect(formatHumanReadableDate('invalid')).toBe('invalid');
  });

  describe('formatAppointmentDate', () => {
    it('formats plain YYYY-MM-DD date string to patient-friendly D Mon YYYY', () => {
      expect(formatAppointmentDate('2026-09-17')).toBe('17 Sep 2026');
      expect(formatAppointmentDate('2026-01-05')).toBe('5 Jan 2026');
      expect(formatAppointmentDate('2026-12-31')).toBe('31 Dec 2026');
    });

    it('formats ISO datetime strings with UTC timestamps without timezone day shift', () => {
      expect(formatAppointmentDate('2026-09-17T00:00:00.000Z')).toBe('17 Sep 2026');
      expect(formatAppointmentDate('2026-09-17T10:30:00.000Z')).toBe('17 Sep 2026');
      expect(formatAppointmentDate('2026-09-17T23:59:59.999Z')).toBe('17 Sep 2026');
    });

    it('handles leading and trailing whitespace safely', () => {
      expect(formatAppointmentDate('  2026-09-17  ')).toBe('17 Sep 2026');
      expect(formatAppointmentDate('  2026-09-17T00:00:00.000Z  ')).toBe('17 Sep 2026');
    });

    it('safely handles null, undefined, and empty string inputs', () => {
      expect(formatAppointmentDate(null)).toBe('-');
      expect(formatAppointmentDate(undefined)).toBe('-');
      expect(formatAppointmentDate('')).toBe('-');
      expect(formatAppointmentDate('   ')).toBe('-');
    });

    it('returns raw string as fallback for invalid non-date values', () => {
      expect(formatAppointmentDate('invalid-date')).toBe('invalid-date');
    });

    it('preserves distinct semantics from formatDateOfBirth (DD-MM-YYYY)', () => {
      const rawDate = '2026-09-17T00:00:00.000Z';
      // Appointment date: 17 Sep 2026
      expect(formatAppointmentDate(rawDate)).toBe('17 Sep 2026');
      // DOB format: 17-09-2026
      expect(formatDateOfBirth(rawDate)).toBe('17-09-2026');
    });
  });

  describe('isSlotExpired & isSlotSelectable & getSlotStatusLabel', () => {
    // Reference base time: 2026-09-28 at 15:45:00
    const mockNow = new Date(2026, 8, 28, 15, 45, 0);

    it('marks past slots earlier today as expired and non-selectable', () => {
      expect(isSlotExpired('2026-09-28', '08:00', mockNow)).toBe(true);
      expect(isSlotExpired('2026-09-28', '14:30', mockNow)).toBe(true);
      expect(isSlotExpired('2026-09-28', '15:45', mockNow)).toBe(true);

      expect(isSlotSelectable({ start_time: '08:00', available: true }, '2026-09-28', mockNow)).toBe(false);
      expect(getSlotStatusLabel({ start_time: '08:00', available: true }, '2026-09-28', mockNow)).toEqual({
        label: 'Passed',
        isSelectable: false,
        isExpired: true,
      });
    });

    it('keeps future slots today as active and selectable', () => {
      expect(isSlotExpired('2026-09-28', '16:00', mockNow)).toBe(false);
      expect(isSlotExpired('2026-09-28', '16:30', mockNow)).toBe(false);

      expect(isSlotSelectable({ start_time: '16:30', available: true }, '2026-09-28', mockNow)).toBe(true);
      expect(getSlotStatusLabel({ start_time: '16:30', available: true }, '2026-09-28', mockNow)).toEqual({
        label: 'Open',
        isSelectable: true,
        isExpired: false,
      });
    });

    it('does NOT mark early morning slots on tomorrow as expired', () => {
      // Tomorrow 08:00 should be open even though 08:00 is less than today 15:45
      expect(isSlotExpired('2026-09-29', '08:00', mockNow)).toBe(false);
      expect(isSlotSelectable({ start_time: '08:00', available: true }, '2026-09-29', mockNow)).toBe(true);
      expect(getSlotStatusLabel({ start_time: '08:00', available: true }, '2026-09-29', mockNow)).toEqual({
        label: 'Open',
        isSelectable: true,
        isExpired: false,
      });
    });

    it('marks all slots on yesterday as expired', () => {
      expect(isSlotExpired('2026-09-27', '18:00', mockNow)).toBe(true);
      expect(isSlotSelectable({ start_time: '18:00', available: true }, '2026-09-27', mockNow)).toBe(false);
      expect(getSlotStatusLabel({ start_time: '18:00', available: true }, '2026-09-27', mockNow)).toEqual({
        label: 'Passed',
        isSelectable: false,
        isExpired: true,
      });
    });

    it('marks booked/unavailable future slots as non-selectable with appropriate label', () => {
      expect(isSlotSelectable({ start_time: '16:30', available: false }, '2026-09-28', mockNow)).toBe(false);
      expect(getSlotStatusLabel({ start_time: '16:30', available: false }, '2026-09-28', mockNow)).toEqual({
        label: 'Booked',
        isSelectable: false,
        isExpired: false,
      });
      expect(getSlotStatusLabel({ start_time: '16:30', available: false, reason: 'Reserved' }, '2026-09-28', mockNow)).toEqual({
        label: 'Reserved',
        isSelectable: false,
        isExpired: false,
      });
    });
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
