import { describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '../auth/session-manager';
import { DentalApi } from './dental-api';

describe('DentalApi', () => {
  const sampleQuotation = {
    id: 'quote-001',
    quotation_number: 'DQ-2026-001',
    patient_id: 'pat-1',
    patient_number: 'MRN-101',
    patient_name: 'Patient Name',
    doctor_name: 'Dr. Smith',
    status: 'SENT',
    currency: 'KES',
    subtotal: 5000,
    discount_amount: 0,
    tax_amount: 0,
    total: 5000,
    items: [
      {
        procedure_name: 'Scaling & Polishing',
        tooth_number: null,
        quantity: 1,
        unit_price: 5000,
        discount_amount: 0,
        tax_amount: 0,
        line_total: 5000,
        notes: null,
      },
    ],
    options: [],
    created_at: '2026-09-24T00:00:00.000Z',
  };

  it('listQuotations fetches quotations for patient', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue([sampleQuotation]),
    } as unknown as SessionManager;

    const api = new DentalApi(mockSessionManager);
    const result = await api.listQuotations('pat-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.quotation_number).toBe('DQ-2026-001');
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/opd/dental/quotations/patient/pat-1',
      expect.anything()
    );
  });

  it('getQuotation fetches single quotation details', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(sampleQuotation),
    } as unknown as SessionManager;

    const api = new DentalApi(mockSessionManager);
    const result = await api.getQuotation('quote-001');

    expect(result.id).toBe('quote-001');
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/opd/dental/quotations/quote-001',
      expect.anything()
    );
  });

  it('acceptQuotation posts acceptance payload', async () => {
    const acceptedQuote = { ...sampleQuotation, status: 'ACCEPTED' };
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(acceptedQuote),
    } as unknown as SessionManager;

    const api = new DentalApi(mockSessionManager);
    const result = await api.acceptQuotation('quote-001', {
      selected_option_id: 'opt-1',
      notes: 'Ready to proceed',
    });

    expect(result.status).toBe('ACCEPTED');
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/opd/dental/quotations/quote-001/accept',
      expect.anything(),
      {
        method: 'POST',
        body: {
          selected_option_id: 'opt-1',
          notes: 'Ready to proceed',
        },
      }
    );
  });

  it('rejectQuotation posts decline payload', async () => {
    const rejectedQuote = { ...sampleQuotation, status: 'REJECTED' };
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(rejectedQuote),
    } as unknown as SessionManager;

    const api = new DentalApi(mockSessionManager);
    const result = await api.rejectQuotation('quote-001', {
      reason: 'Too expensive',
    });

    expect(result.status).toBe('REJECTED');
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/opd/dental/quotations/quote-001/reject',
      expect.anything(),
      {
        method: 'POST',
        body: {
          reason: 'Too expensive',
        },
      }
    );
  });

  it('postponeQuotation posts postpone payload', async () => {
    const postponedQuote = { ...sampleQuotation, status: 'POSTPONED' };
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(postponedQuote),
    } as unknown as SessionManager;

    const api = new DentalApi(mockSessionManager);
    const result = await api.postponeQuotation('quote-001', {
      reason: 'Will decide next month',
    });

    expect(result.status).toBe('POSTPONED');
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/opd/dental/quotations/quote-001/postpone',
      expect.anything(),
      {
        method: 'POST',
        body: {
          reason: 'Will decide next month',
        },
      }
    );
  });

  it('listPatientStages fetches treatment stages for patient', async () => {
    const mockStages = [
      {
        id: 'stg-1',
        patient_id: 'pat-1',
        procedure_name: 'Root Canal Phase 1 - Access',
        stage_number: 1,
        total_stages: 2,
        status: 'COMPLETED',
        lab_order_status: null,
        appointment_status: 'COMPLETED',
        is_blocked_by_prerequisite: false,
        created_at: '2026-09-24T00:00:00.000Z',
      },
      {
        id: 'stg-2',
        patient_id: 'pat-1',
        procedure_name: 'Root Canal Phase 2 - Obturation & Crown',
        stage_number: 2,
        total_stages: 2,
        status: 'PLANNED',
        lab_order_status: 'READY',
        appointment_status: null,
        is_blocked_by_prerequisite: false,
        created_at: '2026-09-24T00:00:00.000Z',
      },
    ];

    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(mockStages),
    } as unknown as SessionManager;

    const api = new DentalApi(mockSessionManager);
    const result = await api.listPatientStages('pat-1');

    expect(result).toHaveLength(2);
    expect(result[0]?.procedure_name).toBe('Root Canal Phase 1 - Access');
    expect(result[0]?.status).toBe('COMPLETED');
    expect(result[1]?.lab_order_status).toBe('READY');
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/opd/dental/patients/pat-1/stages',
      expect.anything()
    );
  });
});
