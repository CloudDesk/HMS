import { describe, expect, it } from 'vitest';
import {
  isAppointmentCheckInEligible,
} from './date-utils';

describe('isAppointmentCheckInEligible', () => {
  const baseAppointment = {
    id: 'apt-1',
    appointment_number: 'APT-001',
    doctor_name: 'Dr. Jane Smith',
    status: 'SCHEDULED',
    appointment_date: '2026-10-15',
    start_time: '14:00',
    end_time: '14:30',
    duration_minutes: 30,
  };

  it('rejects appointments when status is already CHECKED_IN', () => {
    const result = isAppointmentCheckInEligible(
      { ...baseAppointment, status: 'CHECKED_IN' },
      new Date('2026-10-15T13:30:00')
    );
    expect(result.eligible).toBe(false);
    expect(result.canCheckIn).toBe(false);
    expect(result.windowState).toBe('ineligible_status');
    expect(result.reason).toContain('already checked in');
  });

  it('rejects appointments when status is CANCELLED or COMPLETED', () => {
    const cancelled = isAppointmentCheckInEligible(
      { ...baseAppointment, status: 'CANCELLED' },
      new Date('2026-10-15T13:30:00')
    );
    expect(cancelled.canCheckIn).toBe(false);

    const completed = isAppointmentCheckInEligible(
      { ...baseAppointment, status: 'COMPLETED' },
      new Date('2026-10-15T13:30:00')
    );
    expect(completed.canCheckIn).toBe(false);
  });

  it('rejects appointments when scheduled for a different date', () => {
    // Appointment is on Oct 15, current date is Oct 14 (tomorrow)
    const future = isAppointmentCheckInEligible(
      baseAppointment,
      new Date('2026-10-14T14:00:00')
    );
    expect(future.canCheckIn).toBe(false);
    expect(future.windowState).toBe('not_today');
    expect(future.reason).toContain('only available on the day of your appointment');

    // Appointment is on Oct 15, current date is Oct 16 (past)
    const past = isAppointmentCheckInEligible(
      baseAppointment,
      new Date('2026-10-16T14:00:00')
    );
    expect(past.canCheckIn).toBe(false);
    expect(past.windowState).toBe('not_today');
    expect(past.reason).toContain('already passed');
  });

  it('rejects check-in before the allowed check-in window (e.g., > 60 minutes before start)', () => {
    // Appointment is at 14:00, current time is 12:30 (90 minutes before)
    const early = isAppointmentCheckInEligible(
      baseAppointment,
      new Date('2026-10-15T12:30:00'),
      60
    );
    expect(early.canCheckIn).toBe(false);
    expect(early.windowState).toBe('before_window');
    expect(early.reason).toContain('Check-in opens 60 minutes before your appointment');
  });

  it('allows check-in within the 60-minute window before start time', () => {
    // Appointment is at 14:00, current time is 13:30 (30 minutes before)
    const eligible = isAppointmentCheckInEligible(
      baseAppointment,
      new Date('2026-10-15T13:30:00'),
      60
    );
    expect(eligible.canCheckIn).toBe(true);
    expect(eligible.eligible).toBe(true);
    expect(eligible.windowState).toBe('within_window');
    expect(eligible.reason).toBeNull();
  });

  it('allows check-in during the appointment slot up to end_time', () => {
    // Appointment is 14:00 - 14:30, current time is 14:15
    const eligible = isAppointmentCheckInEligible(
      baseAppointment,
      new Date('2026-10-15T14:15:00'),
      60
    );
    expect(eligible.canCheckIn).toBe(true);
    expect(eligible.eligible).toBe(true);
  });

  it('rejects check-in after the appointment end_time has passed', () => {
    // Appointment is 14:00 - 14:30, current time is 14:45
    const expired = isAppointmentCheckInEligible(
      baseAppointment,
      new Date('2026-10-15T14:45:00'),
      60
    );
    expect(expired.canCheckIn).toBe(false);
    expect(expired.windowState).toBe('after_window');
    expect(expired.reason).toContain('closed');
  });

  it('supports CONFIRMED appointment status', () => {
    const confirmed = isAppointmentCheckInEligible(
      { ...baseAppointment, status: 'CONFIRMED' },
      new Date('2026-10-15T13:45:00'),
      60
    );
    expect(confirmed.canCheckIn).toBe(true);
  });
});
