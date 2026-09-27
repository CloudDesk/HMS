import { describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '../auth/session-manager';
import { BillingApi } from './billing-api';

describe('BillingApi', () => {
  const sampleOverviewResponse = {
    invoices: [
      {
        id: 'inv-01',
        invoice_number: 'INV-2026-0001',
        invoice_date: '2026-09-24T08:00:00.000Z',
        status: 'PARTIALLY_PAID',
        total_amount: 3500,
        paid_amount: 1500,
        balance_amount: 2000,
      },
    ],
    summary: {
      outstanding_invoices: 1,
    },
  };

  const sampleInvoiceDetailsResponse = {
    id: 'inv-01',
    invoice_number: 'INV-2026-0001',
    invoice_date: '2026-09-24T08:00:00.000Z',
    status: 'PARTIALLY_PAID',
    subtotal: 3500,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 3500,
    paid_amount: 1500,
    balance_amount: 2000,
    patient: {
      id: 'pat-1',
      patient_number: 'MRN-001',
      name: 'Alice Johnson',
      phone: '+919988776655',
      email: 'alice@example.com',
      address: null,
    },
    branch: {
      id: 'br-01',
      name: 'Central General Hospital',
      phone: '+9122334455',
      email: 'info@hms.local',
      address: '123 Health Ave',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postal_code: '400001',
    },
    items: [
      {
        id: 'item-01',
        service_name: 'Cardiology Consultation',
        service_type: 'CONSULTATION',
        quantity: 1,
        unit_price: 1500,
        line_total: 1500,
      },
      {
        id: 'item-02',
        service_name: '2D Echocardiogram',
        service_type: 'IMAGING_SERVICE',
        quantity: 1,
        unit_price: 2000,
        line_total: 2000,
      },
    ],
    payments: [
      {
        id: 'pmt-01',
        payment_number: 'REC-001',
        payment_date: '2026-09-24T08:30:00.000Z',
        amount: 1500,
        payment_method: 'CASH',
        reference_number: null,
      },
    ],
  };

  it('getBillingOverview calls /patient-portal/overview without query when patientId is omitted', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(sampleOverviewResponse),
    } as unknown as SessionManager;

    const api = new BillingApi(mockSessionManager);
    const result = await api.getBillingOverview();

    expect(result.invoices).toHaveLength(1);
    expect(result.invoices[0]?.invoice_number).toBe('INV-2026-0001');
    expect(result.outstandingCount).toBe(1);
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/patient-portal/overview',
      expect.anything(),
      undefined
    );
  });

  it('getBillingOverview calls /patient-portal/overview with query patient_id when provided', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(sampleOverviewResponse),
    } as unknown as SessionManager;

    const api = new BillingApi(mockSessionManager);
    const result = await api.getBillingOverview('patient-abc');

    expect(result.invoices).toHaveLength(1);
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/patient-portal/overview',
      expect.anything(),
      { query: { patient_id: 'patient-abc' } }
    );
  });

  it('getInvoiceDetails fetches and parses full invoice details', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(sampleInvoiceDetailsResponse),
    } as unknown as SessionManager;

    const api = new BillingApi(mockSessionManager);
    const result = await api.getInvoiceDetails('pat-1', 'inv-01');

    expect(result.id).toBe('inv-01');
    expect(result.invoice_number).toBe('INV-2026-0001');
    expect(result.items).toHaveLength(2);
    expect(result.payments).toHaveLength(1);
    expect(result.branch?.name).toBe('Central General Hospital');
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/patient-portal/patients/pat-1/invoices/inv-01',
      expect.anything()
    );
  });

  it('throws error if invoice response does not match the schema', async () => {
    const invalidResponse = {
      id: 'inv-01',
      // missing required fields like invoice_number, total_amount, etc.
    };

    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(invalidResponse),
    } as unknown as SessionManager;

    const api = new BillingApi(mockSessionManager);
    await expect(api.getInvoiceDetails('pat-1', 'inv-01')).rejects.toThrow();
  });
});
