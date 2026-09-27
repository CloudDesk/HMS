import { describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '../auth/session-manager';
import { PortalApi } from './portal-api';

describe('PortalApi', () => {
  const sampleContext = {
    account: {
      type: 'PATIENT' as const,
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+919876543210',
    },
    patients: [
      {
        id: 'patient-1',
        patient_number: 'HMS-2026-000001',
        full_name: 'Jane Doe',
        date_of_birth: '1990-05-15',
        gender: 'FEMALE',
        relationship: 'SELF' as const,
        is_primary: true,
      },
    ],
  };

  const sampleOverview = {
    patient: {
      id: 'patient-1',
      patient_number: 'HMS-2026-000001',
      first_name: 'Jane',
      last_name: 'Doe',
      date_of_birth: '1990-05-15',
      gender: 'FEMALE',
      phone: '+919876543210',
      email: 'jane@example.com',
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    summary: {
      upcoming_appointments: 1,
      outstanding_invoices: 0,
      verified_lab_results: 2,
      verified_imaging_reports: 0,
    },
    appointments: [],
    invoices: [],
    laboratory_results: [],
    imaging_reports: [],
    prescriptions: [],
    purchased_medicines: [],
  };

  it('getContext calls /patient-portal/context with schema validation', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(sampleContext),
    } as unknown as SessionManager;

    const api = new PortalApi(mockSessionManager);
    const result = await api.getContext();

    expect(result).toEqual(sampleContext);
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/patient-portal/context',
      expect.anything()
    );
  });

  it('getOverview calls /patient-portal/overview without query when patientId is omitted', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(sampleOverview),
    } as unknown as SessionManager;

    const api = new PortalApi(mockSessionManager);
    const result = await api.getOverview();

    expect(result).toEqual(sampleOverview);
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/patient-portal/overview',
      expect.anything(),
      undefined
    );
  });

  it('getOverview calls /patient-portal/overview with query when patientId is provided', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(sampleOverview),
    } as unknown as SessionManager;

    const api = new PortalApi(mockSessionManager);
    const result = await api.getOverview('dep-123');

    expect(result).toEqual(sampleOverview);
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/patient-portal/overview',
      expect.anything(),
      { query: { patient_id: 'dep-123' } }
    );
  });
});
