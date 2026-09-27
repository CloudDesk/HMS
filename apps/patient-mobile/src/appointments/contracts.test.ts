import { describe, expect, it } from 'vitest';
import {
  appointmentCreatedSchema,
  bookAppointmentInputSchema,
  portalAppointmentSchema,
  portalAppointmentsResponseSchema,
  publicBranchSchema,
  publicDepartmentSchema,
  publicDoctorSchema,
  publicDoctorSlotsSchema,
  rescheduleAppointmentInputSchema,
  rescheduleEligibilitySchema,
} from './contracts';

describe('Appointments Contracts & Schemas', () => {
  it('validates a valid portal appointment', () => {
    const validAppointment = {
      id: 'apt-001',
      appointment_number: 'APT-2026-000001',
      patient_id: 'pat-1',
      doctor_id: 'doc-1',
      doctor_name: 'Dr. John Smith',
      doctor_specialization: 'Cardiology',
      appointment_date: '2026-10-15',
      start_time: '10:00',
      end_time: '10:15',
      duration_minutes: 15,
      visit_type: 'NEW_CONSULTATION',
      status: 'CONFIRMED',
      reason: 'Routine checkup',
      branch: {
        id: 'branch-1',
        name: 'Main Hospital Branch',
        city: 'Metropolis',
        address: '123 Health Ave',
      },
    };

    const parsed = portalAppointmentSchema.parse(validAppointment);
    expect(parsed.id).toBe('apt-001');
    expect(parsed.status).toBe('CONFIRMED');
    expect(parsed.branch?.name).toBe('Main Hospital Branch');
  });

  it('validates portal appointment response with transformed pagination meta', () => {
    const responseData = {
      data: [
        {
          id: 'apt-001',
          appointment_number: 'APT-2026-000001',
          patient_id: 'pat-1',
          doctor_id: 'doc-1',
          doctor_name: 'Dr. John Smith',
          appointment_date: '2026-10-15',
          start_time: '10:00',
          end_time: '10:15',
          visit_type: 'FOLLOW_UP',
          status: 'SCHEDULED',
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    };

    const parsed = portalAppointmentsResponseSchema.parse(responseData);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.meta.totalPages).toBe(1);
  });

  it('validates public branch and department schemas', () => {
    const branch = publicBranchSchema.parse({
      id: 'b-1',
      code: 'MAIN',
      name: 'Main Campus',
      city: 'Metropolis',
    });
    expect(branch.name).toBe('Main Campus');

    const department = publicDepartmentSchema.parse({
      id: 'dep-1',
      code: 'CARD',
      name: 'Cardiology',
      branch: {
        id: 'b-1',
        name: 'Main Campus',
      },
    });
    expect(department.name).toBe('Cardiology');
    expect(department.branch?.name).toBe('Main Campus');
  });

  it('validates public doctor and slots schemas', () => {
    const doctor = publicDoctorSchema.parse({
      id: 'doc-1',
      display_name: 'Dr. Alice',
      specialization: 'Neurology',
      available_days: ['MONDAY', 'WEDNESDAY'],
    });
    expect(doctor.display_name).toBe('Dr. Alice');
    expect(doctor.available_days).toEqual(['MONDAY', 'WEDNESDAY']);

    const slots = publicDoctorSlotsSchema.parse({
      doctor_id: 'doc-1',
      date: '2026-10-20',
      is_available: true,
      slots: [
        { start_time: '09:00', end_time: '09:15', available: true },
        { start_time: '09:15', end_time: '09:30', is_available: false },
      ],
    });
    expect(slots.slots).toHaveLength(2);
  });

  it('validates book appointment input schema', () => {
    const validInput = {
      patient_id: 'pat-1',
      doctor_id: 'doc-1',
      appointment_date: '2026-10-15',
      start_time: '09:30',
      duration_minutes: 15,
      visit_type: 'NEW_CONSULTATION' as const,
      reason: 'General consultation for checkup',
    };

    const parsed = bookAppointmentInputSchema.parse(validInput);
    expect(parsed.patient_id).toBe('pat-1');

    // Reject invalid date format
    expect(() =>
      bookAppointmentInputSchema.parse({
        ...validInput,
        appointment_date: '15-10-2026',
      })
    ).toThrow();

    // Reject short reason
    expect(() =>
      bookAppointmentInputSchema.parse({
        ...validInput,
        reason: 'ab',
      })
    ).toThrow();
  });

  it('validates reschedule eligibility and input schemas', () => {
    const eligibility = rescheduleEligibilitySchema.parse({
      eligible: true,
      minimum_notice_hours: 2,
    });
    expect(eligibility.eligible).toBe(true);

    const rescheduleInput = rescheduleAppointmentInputSchema.parse({
      doctor_id: 'doc-1',
      appointment_date: '2026-10-16',
      start_time: '14:00',
      duration_minutes: 15,
    });
    expect(rescheduleInput.start_time).toBe('14:00');
  });

  it('validates appointment created response schema', () => {
    const created = appointmentCreatedSchema.parse({
      id: 'apt-created-1',
      appointment_number: 'APT-2026-000099',
      status: 'SCHEDULED',
    });
    expect(created.appointment_number).toBe('APT-2026-000099');
  });
});
