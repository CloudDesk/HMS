import { describe, expect, it } from 'vitest';
import {
  dentalQuotationItemSchema,
  dentalQuotationSchema,
  dentalQuotationsListSchema,
  formatDentalCurrency,
  formatToothDescription,
  getDentalStatusLabel,
  getDentalStatusStyle,
} from './contracts';

describe('Dental Contracts & Schemas', () => {
  it('parses dental quotation item with tooth number', () => {
    const raw = {
      id: 'item-1',
      procedure_name: 'Composite Restoration',
      tooth_number: 16,
      quantity: 1,
      unit_price: 3500,
      discount_amount: 500,
      tax_amount: 0,
      line_total: 3000,
      notes: 'Occlusal surface caries',
    };

    const parsed = dentalQuotationItemSchema.parse(raw);
    expect(parsed.procedure_name).toBe('Composite Restoration');
    expect(parsed.tooth_number).toBe(16);
    expect(parsed.line_total).toBe(3000);
  });

  it('parses complete dental quotation with options and status', () => {
    const raw = {
      id: 'quote-001',
      quotation_number: 'DQ-2026-0012',
      patient_id: 'pat-10',
      patient_number: 'MRN-100',
      patient_name: 'Jane Doe',
      doctor_name: 'Dr. Sarah Connor',
      status: 'SENT',
      currency: 'KES',
      subtotal: 12000,
      discount_amount: 2000,
      tax_amount: 0,
      total: 10000,
      items: [
        {
          procedure_name: 'Root Canal Treatment',
          tooth_number: 21,
          quantity: 1,
          unit_price: 12000,
          discount_amount: 2000,
          tax_amount: 0,
          line_total: 10000,
        },
      ],
      options: [
        {
          id: 'opt-1',
          name: 'Standard Option',
          sequence: 1,
          items: [],
          subtotal: 12000,
          discount_amount: 2000,
          tax_amount: 0,
          total: 10000,
        },
      ],
      selected_option_id: null,
      selected_option_name: null,
      valid_until: '2026-10-30',
      created_at: '2026-09-20T08:00:00.000Z',
    };

    const parsed = dentalQuotationSchema.parse(raw);
    expect(parsed.quotation_number).toBe('DQ-2026-0012');
    expect(parsed.status).toBe('SENT');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.options).toHaveLength(1);
    expect(parsed.total).toBe(10000);
  });

  it('parses list of dental quotations', () => {
    const listRaw = [
      {
        id: 'quote-1',
        quotation_number: 'DQ-1',
        patient_id: 'p1',
        patient_number: 'MRN-1',
        patient_name: 'Patient One',
        doctor_name: 'Dentist',
        status: 'ACCEPTED',
        currency: 'KES',
        subtotal: 5000,
        discount_amount: 0,
        tax_amount: 0,
        total: 5000,
        items: [],
        options: [],
        created_at: '2026-09-24',
      },
    ];

    const parsed = dentalQuotationsListSchema.parse(listRaw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.status).toBe('ACCEPTED');
  });

  describe('Dental Formatters', () => {
    it('formats dental currencies', () => {
      expect(formatDentalCurrency(5000, 'KES')).toBe('KES 5,000.00');
      expect(formatDentalCurrency(2500, 'INR')).toBe('₹2,500.00');
      expect(formatDentalCurrency(0)).toBe('KES 0.00');
    });

    it('formats tooth description correctly', () => {
      expect(formatToothDescription(16)).toBe('Tooth #16');
      expect(formatToothDescription(null)).toBe('General Dental');
    });

    it('returns dental status labels and styles', () => {
      expect(getDentalStatusLabel('SENT')).toBe('Pending Your Decision');
      expect(getDentalStatusLabel('ACCEPTED')).toBe('Accepted');
      expect(getDentalStatusLabel('REJECTED')).toBe('Declined');
      expect(getDentalStatusLabel('POSTPONED')).toBe('Decision Postponed');

      const acceptedStyle = getDentalStatusStyle('ACCEPTED');
      expect(acceptedStyle.bg).toBe('#DCFCE7');

      const sentStyle = getDentalStatusStyle('SENT');
      expect(sentStyle.bg).toBe('#E0F2FE');
    });
  });
});
