import { describe, it, expect, vi, beforeEach } from 'vitest';
import { patientPortalApi } from './patient-portal';
import { appConfig } from '../config';

describe('patientPortalApi Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches patient portal context', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            account: {
              type: 'PATIENT',
              full_name: 'Jane Doe',
              email: 'jane@example.com',
              phone: '+919876543210',
              guardian_profile: null,
            },
            patients: [
              {
                id: 'pat-1',
                patient_number: 'P-001',
                full_name: 'Jane Doe',
                date_of_birth: '1995-05-15',
                gender: 'FEMALE',
                relationship: 'SELF',
                is_primary: true,
                preferred_branch: null,
              },
            ],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const result = await patientPortalApi.context();
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      `${appConfig.apiBaseUrl}/patient-portal/context`
    );
    expect(result.patients).toHaveLength(1);
    expect(result.patients[0]?.full_name).toBe('Jane Doe');
  });

  it('fetches public branches with pagination', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            data: [
              {
                id: 'b-1',
                code: 'BR-1',
                name: 'Main Hospital',
                short_name: 'Main',
                city: 'Nairobi',
              },
            ],
            meta: {
              page: 1,
              limit: 24,
              total: 1,
              totalPages: 1,
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const result = await patientPortalApi.publicBranches({ limit: 24 });
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      `${appConfig.apiBaseUrl}/patient-portal/public/branches?page=1&limit=24`
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.name).toBe('Main Hospital');
  });

  it('books an appointment through portal API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'apt-10',
            appointment_number: 'APT-2026-0001',
            patient_id: 'pat-1',
            doctor_id: 'doc-1',
            doctor_name: 'Dr. Sarah Connor',
            doctor_specialization: 'Cardiology',
            department_id: 'dept-1',
            appointment_date: '2026-09-01T00:00:00.000Z',
            start_time: '10:00',
            end_time: '10:30',
            duration_minutes: 30,
            visit_type: 'NEW_CONSULTATION',
            status: 'CONFIRMED',
            reason: 'General Checkup',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const appointment = await patientPortalApi.bookAppointment({
      patient_id: 'pat-1',
      doctor_id: 'doc-1',
      appointment_date: '2026-09-01',
      start_time: '10:00',
      visit_type: 'NEW_CONSULTATION',
      reason: 'General Checkup',
      duration_minutes: 30,
    });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      `${appConfig.apiBaseUrl}/patient-portal/appointments`
    );
    expect(
      JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)
    ).toEqual({
      patient_id: 'pat-1',
      doctor_id: 'doc-1',
      appointment_date: '2026-09-01',
      start_time: '10:00',
      visit_type: 'NEW_CONSULTATION',
      reason: 'General Checkup',
      duration_minutes: 30,
    });
    expect(appointment.appointment_number).toBe('APT-2026-0001');
    expect(appointment.status).toBe('CONFIRMED');
  });
});
