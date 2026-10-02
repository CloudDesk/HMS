import { describe, it, expect, vi } from 'vitest';
import { downloadInvoicePdf } from './invoice-pdf.service';
import type { PortalInvoiceDetails } from '../api/patient-portal';

const mocks = vi.hoisted(() => ({
  savedFilename: '',
}));

vi.mock('jspdf', () => {
  class MockJsPDF {
    setFontSize = vi.fn();
    setFont = vi.fn();
    setTextColor = vi.fn();
    setDrawColor = vi.fn();
    setLineWidth = vi.fn();
    text = vi.fn();
    setFillColor = vi.fn();
    rect = vi.fn();
    roundedRect = vi.fn();
    line = vi.fn();
    getTextWidth = vi.fn().mockReturnValue(50);
    splitTextToSize = vi.fn((str: string) => [str]);
    addPage = vi.fn();
    save = vi.fn((filename: string) => {
      mocks.savedFilename = filename;
    });
  }
  return { jsPDF: MockJsPDF, default: MockJsPDF };
});

describe('invoice-pdf.service', () => {
  it('generates a PDF for a valid hospital invoice without throwing', async () => {
    const mockInvoice: PortalInvoiceDetails = {
      id: 'inv-1',
      invoice_number: 'INV-2026-0001',
      invoice_date: '2026-08-20T00:00:00.000Z',
      status: 'PAID',
      subtotal: 1000,
      discount_amount: 100,
      tax_amount: 180,
      total_amount: 1080,
      paid_amount: 1080,
      balance_amount: 0,
      branch: {
        id: 'b-1',
        name: 'HMS Central Hospital',
        phone: null,
        email: null,
        city: 'Nairobi',
        address: '100 Health Way',
        state: null,
        country: 'Kenya',
        postal_code: '00100',
      },
      patient: {
        id: 'pat-1',
        patient_number: 'P-100',
        name: 'John Doe',
        phone: null,
        email: null,
        address: {
          line1: '12 Green Avenue',
          city: 'Nairobi',
          state: null,
          country: 'Kenya',
          postal_code: '00100',
        },
      },
      items: [
        {
          id: 'item-1',
          service_name: 'Specialist Consultation Fee',
          service_type: 'CONSULTATION',
          quantity: 1,
          unit_price: 1000,
          line_total: 1000,
        },
      ],
      payments: [
        {
          id: 'pay-1',
          payment_number: 'PAY-2026-0001',
          amount: 1080,
          payment_method: 'CARD',
          payment_date: '2026-08-20T10:00:00.000Z',
          reference_number: 'TXN-998877',
        },
      ],
    };

    await downloadInvoicePdf(mockInvoice);
    expect(mocks.savedFilename).toBe('INV-2026-0001.pdf');
  });
});
