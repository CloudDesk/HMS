import { describe, expect, it } from 'vitest';
import {
  billingOverviewDataSchema,
  formatCurrency,
  formatInvoiceDate,
  getInvoiceStatusLabel,
  getInvoiceStatusStyle,
  invoiceLineItemSchema,
  invoicePaymentRecordSchema,
  portalInvoiceDetailsSchema,
  portalInvoiceSummaryItemSchema,
} from './contracts';

describe('Billing Contracts & Schemas', () => {
  it('parses portal invoice summary items correctly', () => {
    const raw = {
      id: 'inv-123',
      invoice_number: 'INV-2026-0001',
      invoice_date: '2026-09-24T10:00:00.000Z',
      status: 'PARTIALLY_PAID',
      total_amount: 5000,
      paid_amount: 2000,
      balance_amount: 3000,
    };

    const parsed = portalInvoiceSummaryItemSchema.parse(raw);
    expect(parsed.id).toBe('inv-123');
    expect(parsed.invoice_number).toBe('INV-2026-0001');
    expect(parsed.status).toBe('PARTIALLY_PAID');
    expect(parsed.total_amount).toBe(5000);
    expect(parsed.paid_amount).toBe(2000);
    expect(parsed.balance_amount).toBe(3000);
  });

  it('parses invoice line items and payment records correctly', () => {
    const itemRaw = {
      id: 'item-1',
      service_name: 'General Consultation',
      service_type: 'CONSULTATION',
      quantity: 1,
      unit_price: 800,
      line_total: 800,
    };
    const parsedItem = invoiceLineItemSchema.parse(itemRaw);
    expect(parsedItem.service_name).toBe('General Consultation');
    expect(parsedItem.line_total).toBe(800);

    const paymentRaw = {
      id: 'pmt-1',
      payment_number: 'REC-2026-001',
      payment_date: '2026-09-24T12:00:00.000Z',
      amount: 800,
      payment_method: 'UPI',
      reference_number: 'UPI/1234567890',
    };
    const parsedPayment = invoicePaymentRecordSchema.parse(paymentRaw);
    expect(parsedPayment.payment_number).toBe('REC-2026-001');
    expect(parsedPayment.reference_number).toBe('UPI/1234567890');
  });

  it('parses complete invoice details with nested patient and branch', () => {
    const detailsRaw = {
      id: 'inv-detail-1',
      invoice_number: 'INV-2026-0099',
      invoice_date: '2026-09-20',
      status: 'PAID',
      subtotal: 1000,
      discount_amount: 100,
      tax_amount: 50,
      total_amount: 950,
      paid_amount: 950,
      balance_amount: 0,
      patient: {
        id: 'pat-1',
        patient_number: 'MRN-1001',
        name: 'John Doe',
        phone: '+919876543210',
        email: 'john@example.com',
        address: { city: 'Mumbai' },
      },
      branch: {
        id: 'br-1',
        name: 'Downtown Hospital Branch',
        phone: '+9122334455',
        city: 'Mumbai',
      },
      items: [
        {
          id: 'item-1',
          service_name: 'CBC Blood Test',
          service_type: 'LAB_TEST',
          quantity: 1,
          unit_price: 500,
          line_total: 500,
        },
      ],
      payments: [
        {
          id: 'pmt-1',
          payment_number: 'PAY-001',
          payment_date: '2026-09-20',
          amount: 950,
          payment_method: 'CARD',
          reference_number: 'TXN-9999',
        },
      ],
    };

    const parsed = portalInvoiceDetailsSchema.parse(detailsRaw);
    expect(parsed.invoice_number).toBe('INV-2026-0099');
    expect(parsed.status).toBe('PAID');
    expect(parsed.patient?.name).toBe('John Doe');
    expect(parsed.branch?.name).toBe('Downtown Hospital Branch');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.payments).toHaveLength(1);
  });

  it('parses billing overview response', () => {
    const overviewRaw = {
      invoices: [
        {
          id: 'inv-1',
          invoice_number: 'INV-1',
          invoice_date: '2026-09-25',
          status: 'PENDING',
          total_amount: 1200,
          paid_amount: 0,
          balance_amount: 1200,
        },
      ],
      summary: {
        outstanding_invoices: 1,
      },
    };

    const parsed = billingOverviewDataSchema.parse(overviewRaw);
    expect(parsed.invoices).toHaveLength(1);
    expect(parsed.summary?.outstanding_invoices).toBe(1);
  });

  describe('formatters and helper utilities', () => {
    it('formats currency in Indian Rupees style', () => {
      expect(formatCurrency(0)).toBe('₹0.00');
      expect(formatCurrency(1500)).toBe('₹1,500.00');
      expect(formatCurrency(250000.5)).toBe('₹2,50,000.50');
      expect(formatCurrency(NaN)).toBe('₹0.00');
    });

    it('formats invoice date properly', () => {
      expect(formatInvoiceDate('2026-09-24T00:00:00.000Z')).toBe('24 Sept 2026');
      expect(formatInvoiceDate('')).toBe('-');
    });

    it('returns appropriate labels and styles for invoice statuses', () => {
      expect(getInvoiceStatusLabel('PAID')).toBe('Paid in Full');
      expect(getInvoiceStatusLabel('PARTIALLY_PAID')).toBe('Partially Paid');
      expect(getInvoiceStatusLabel('PENDING')).toBe('Pending Payment');
      expect(getInvoiceStatusLabel('CANCELLED')).toBe('Cancelled');

      const paidStyle = getInvoiceStatusStyle('PAID');
      expect(paidStyle.bg).toBe('#DCFCE7');

      const pendingStyle = getInvoiceStatusStyle('PENDING');
      expect(pendingStyle.bg).toBe('#FEE2E2');
    });
  });
});
