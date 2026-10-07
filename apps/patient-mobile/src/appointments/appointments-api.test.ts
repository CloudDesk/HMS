import { describe, expect, it, vi } from 'vitest';
import { ApiFailure } from '../api/errors';
import type { SessionManager } from '../auth/session-manager';
import { AppointmentsApi } from './appointments-api';

describe('AppointmentsApi & Appointments Module Verification', () => {
  const mockAppointmentsResponse = {
    data: [
      {
        id: 'apt-1',
        appointment_number: 'APT-001',
        patient_id: 'pat-1',
        doctor_id: 'doc-1',
        doctor_name: 'Dr. Smith',
        doctor_specialization: 'Cardiology',
        appointment_date: '2026-10-15',
        start_time: '10:00',
        end_time: '10:15',
        duration_minutes: 15,
        visit_type: 'NEW_CONSULTATION',
        status: 'SCHEDULED' as const,
        branch: {
          id: 'branch-1',
          name: 'Main Branch',
        },
      },
    ],
    meta: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      total_pages: 1,
    },
  };

  const emptyAppointmentsResponse = {
    data: [],
    meta: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
      total_pages: 1,
    },
  };

  describe('1. Appointment List API', () => {
    it('queries upcoming appointments successfully', async () => {
      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockResolvedValue(mockAppointmentsResponse),
      } as unknown as SessionManager;

      const api = new AppointmentsApi(mockSessionManager);
      const result = await api.listAppointments('pat-1', {
        scope: 'upcoming',
        limit: 20,
      });

      expect(result).toEqual(mockAppointmentsResponse);
      expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
        '/patient-portal/appointments',
        expect.anything(),
        {
          query: {
            patient_id: 'pat-1',
            scope: 'upcoming',
            status: undefined,
            page: 1,
            limit: 20,
          },
        }
      );
    });

    it('queries past appointments successfully', async () => {
      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockResolvedValue(mockAppointmentsResponse),
      } as unknown as SessionManager;

      const api = new AppointmentsApi(mockSessionManager);
      const result = await api.listAppointments('pat-1', {
        scope: 'past',
        limit: 50,
      });

      expect(result.data).toHaveLength(1);
      expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
        '/patient-portal/appointments',
        expect.anything(),
        {
          query: {
            patient_id: 'pat-1',
            scope: 'past',
            status: undefined,
            page: 1,
            limit: 50,
          },
        }
      );
    });

    it('handles empty upcoming and past states cleanly', async () => {
      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockResolvedValue(emptyAppointmentsResponse),
      } as unknown as SessionManager;

      const api = new AppointmentsApi(mockSessionManager);
      const result = await api.listAppointments('pat-1', { scope: 'upcoming' });
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('classifies backend HTTP 5xx error properly and preserves diagnostic details', async () => {
      const serverFailure = new ApiFailure({
        category: 'HTTP_5XX',
        status: 500,
        code: 'INTERNAL_ERROR',
        requestId: 'req-srv-500',
        endpoint: '/patient-portal/appointments',
        method: 'GET',
      });

      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockRejectedValue(serverFailure),
      } as unknown as SessionManager;

      const api = new AppointmentsApi(mockSessionManager);
      try {
        await api.listAppointments('pat-1');
        expect.fail('Should have thrown ApiFailure');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiFailure);
        const failure = err as ApiFailure;
        expect(failure.category).toBe('HTTP_5XX');
        expect(failure.status).toBe(500);
        expect(failure.requestId).toBe('req-srv-500');
        expect(failure.retryable).toBe(true);
      }
    });
  });

  describe('2. Catalogues & Filtered Lookups', () => {
    it('getBranches fetches branch list', async () => {
      const branches = [{ id: 'b-1', code: 'MAIN', name: 'Main Branch' }];
      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockResolvedValue({ data: branches }),
      } as unknown as SessionManager;

      const api = new AppointmentsApi(mockSessionManager);
      const result = await api.getBranches();

      expect(result).toEqual(branches);
    });

    it('getDepartments fetches departments filtered by branchId', async () => {
      const departments = [{ id: 'dep-1', code: 'CARD', name: 'Cardiology' }];
      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockResolvedValue({ data: departments }),
      } as unknown as SessionManager;

      const api = new AppointmentsApi(mockSessionManager);
      const result = await api.getDepartments('branch-1');

      expect(result).toEqual(departments);
      expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
        '/patient-portal/public/departments',
        expect.anything(),
        { query: { branch_id: 'branch-1', limit: 50 } }
      );
    });

    it('getDoctors fetches doctors filtered by branch and department', async () => {
      const doctors = [
        { id: 'doc-1', display_name: 'Dr. John', specialization: 'Cardiology', available_days: [] },
      ];
      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockResolvedValue({ data: doctors }),
      } as unknown as SessionManager;

      const api = new AppointmentsApi(mockSessionManager);
      const result = await api.getDoctors('branch-1', 'dep-1');

      expect(result).toEqual(doctors);
      expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
        '/patient-portal/public/doctors',
        expect.anything(),
        { query: { branch_id: 'branch-1', department_id: 'dep-1', limit: 50 } }
      );
    });

    it('getDoctorSlots fetches slots for doctor and date', async () => {
      const slotsData = {
        doctor_id: 'doc-1',
        date: '2026-10-15',
        is_available: true,
        slots: [{ start_time: '10:00', end_time: '10:15', is_available: true }],
      };
      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockResolvedValue(slotsData),
      } as unknown as SessionManager;

      const api = new AppointmentsApi(mockSessionManager);
      const result = await api.getDoctorSlots('doc-1', '2026-10-15');

      expect(result).toEqual(slotsData);
      expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
        '/patient-portal/public/doctors/doc-1/slots',
        expect.anything(),
        { query: { date: '2026-10-15' } }
      );
    });
  });

  describe('3. Booking & Rescheduling Mutations', () => {
    it('bookAppointment validates and posts appointment creation payload', async () => {
      const bookingPayload = {
        patient_id: 'pat-1',
        doctor_id: 'doc-1',
        appointment_date: '2026-10-15',
        start_time: '10:00',
        duration_minutes: 15,
        visit_type: 'NEW_CONSULTATION' as const,
        reason: 'General consultation checkup',
      };
      const createdResponse = {
        id: 'apt-created-1',
        appointment_number: 'APT-2026-000001',
        status: 'SCHEDULED',
      };

      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockResolvedValue(createdResponse),
      } as unknown as SessionManager;

      const api = new AppointmentsApi(mockSessionManager);
      const result = await api.bookAppointment(bookingPayload);

      expect(result).toEqual(createdResponse);
      expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
        '/patient-portal/appointments',
        expect.anything(),
        {
          method: 'POST',
          body: bookingPayload,
        }
      );
    });

    it('handles booking slot conflict (HTTP 409) safely', async () => {
      const conflictFailure = new ApiFailure({
        category: 'HTTP_409',
        status: 409,
        code: 'SLOT_ALREADY_BOOKED',
        requestId: 'req-conflict-1',
      });

      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockRejectedValue(conflictFailure),
      } as unknown as SessionManager;

      const api = new AppointmentsApi(mockSessionManager);
      try {
        await api.bookAppointment({
          patient_id: 'pat-1',
          doctor_id: 'doc-1',
          appointment_date: '2026-10-15',
          start_time: '10:00',
          duration_minutes: 15,
          visit_type: 'NEW_CONSULTATION',
          reason: 'General consultation',
        });
        expect.fail('Should have thrown conflict');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiFailure);
        expect((err as ApiFailure).userMessage).toBe(
          'This appointment slot is no longer available. Please select another time.'
        );
      }
    });

    it('checkRescheduleEligibility checks if appointment can be rescheduled', async () => {
      const eligibility = { eligible: true, minimum_notice_hours: 2 };
      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockResolvedValue(eligibility),
      } as unknown as SessionManager;

      const api = new AppointmentsApi(mockSessionManager);
      const result = await api.checkRescheduleEligibility('apt-1');

      expect(result).toEqual(eligibility);
    });

    it('rescheduleAppointment submits PATCH request with new slot', async () => {
      const rescheduleInput = {
        doctor_id: 'doc-1',
        appointment_date: '2026-10-18',
        start_time: '11:00',
        duration_minutes: 15,
      };
      const rescheduleResponse = {
        id: 'apt-rescheduled-1',
        appointment_number: 'APT-2026-000001',
        status: 'SCHEDULED',
      };

      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockResolvedValue(rescheduleResponse),
      } as unknown as SessionManager;

      const api = new AppointmentsApi(mockSessionManager);
      const result = await api.rescheduleAppointment('apt-1', rescheduleInput);

      expect(result).toEqual(rescheduleResponse);
    });

    it('checkInAppointment calls POST /patient-portal/appointments/:id/check-in', async () => {
      const checkInResponse = {
        id: 'visit-1',
        visit_number: 'OPD-0001',
        queue_token_number: 1,
        appointment_id: 'apt-1',
        status: 'CHECKED_IN',
      };

      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockResolvedValue(checkInResponse),
      } as unknown as SessionManager;

      const api = new AppointmentsApi(mockSessionManager);
      const result = await api.checkInAppointment('apt-1');

      expect(result).toEqual(checkInResponse);
      expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
        '/patient-portal/appointments/apt-1/check-in',
        expect.anything(),
        { method: 'POST' }
      );
    });
  });
});
