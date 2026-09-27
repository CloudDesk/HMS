import { describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '../auth/session-manager';
import { PrescriptionsApi } from './prescriptions-api';

describe('PrescriptionsApi', () => {
  const samplePrescriptionsResponse = {
    prescriptions: [
      {
        id: 'rx-01',
        doctor_name: 'Dr. Jane Smith',
        status: 'SUBMITTED',
        submitted_at: '2026-09-21T09:00:00.000Z',
        follow_up_date: null,
        doctor_instructions: null,
        patient_instructions: 'Take with food',
        items: [
          {
            id: 'med-01',
            medicine_name: 'Metformin',
            strength: '500mg',
            dosage: '1 tablet',
            route: 'Oral',
            frequency: 'BD',
            duration: '30 days',
            quantity: 60,
            instructions: 'After breakfast and dinner',
          },
        ],
      },
    ],
    purchased_medicines: [
      {
        id: 'purch-01',
        medicine_name: 'Metformin 500mg',
        quantity: 60,
        unit_price: 2.5,
        total_amount: 150.0,
        purchased_at: '2026-09-21T10:00:00.000Z',
        invoice_number: 'INV-2026-0099',
        payment_status: 'PAID',
        branch: {
          id: 'branch-1',
          name: 'Central Pharmacy',
          city: 'City Center',
        },
      },
    ],
  };

  it('getPrescriptions calls /patient-portal/overview without query when patientId is omitted', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(samplePrescriptionsResponse),
    } as unknown as SessionManager;

    const api = new PrescriptionsApi(mockSessionManager);
    const result = await api.getPrescriptions();

    expect(result).toEqual(samplePrescriptionsResponse);
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/patient-portal/overview',
      expect.anything(),
      undefined
    );
  });

  it('getPrescriptions calls /patient-portal/overview with query patient_id when provided', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(samplePrescriptionsResponse),
    } as unknown as SessionManager;

    const api = new PrescriptionsApi(mockSessionManager);
    const result = await api.getPrescriptions('dep-456');

    expect(result).toEqual(samplePrescriptionsResponse);
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/patient-portal/overview',
      expect.anything(),
      { query: { patient_id: 'dep-456' } }
    );
  });

  it('throws when the server response contains invalid schema', async () => {
    const invalidResponse = {
      prescriptions: [{ id: 'rx-01' }], // missing required fields
      purchased_medicines: [],
    };

    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(invalidResponse),
    } as unknown as SessionManager;

    const api = new PrescriptionsApi(mockSessionManager);
    await expect(api.getPrescriptions('pat-1')).rejects.toThrow();
  });
});
