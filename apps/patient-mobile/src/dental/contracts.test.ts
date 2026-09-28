import { describe, expect, it } from 'vitest';
import {
  dentalQuotationItemSchema,
  dentalQuotationSchema,
  dentalQuotationsListSchema,
  formatDentalCurrency,
  formatToothDescription,
  getDentalStatusLabel,
  getDentalStatusStyle,
  getStageBadgeVariant,
  getStageStatusLabel,
  patientDentalStageSchema,
  patientDentalStagesListSchema,
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

  it('parses patient dental treatment stage with lab and video info', () => {
    const stageRaw = {
      id: 'stg-101',
      patient_id: 'pat-10',
      procedure_name: 'Porcelain Crown Fitting',
      stage_number: 2,
      total_stages: 3,
      stage_name: 'Crown Placement',
      status: 'IN_PROGRESS',
      description: 'Permanent crown bonding',
      doctor_name: 'Dr. Sarah Connor',
      lab_order_status: 'READY',
      appointment_status: 'SCHEDULED',
      appointment_scheduled_at: '2026-10-01T10:00:00.000Z',
      is_blocked_by_prerequisite: false,
      reference_video_url: 'https://youtube.com/watch?v=crown123',
      reference_video_title: 'Crown Placement Procedure',
      created_at: '2026-09-25T08:00:00.000Z',
    };

    const parsed = patientDentalStageSchema.parse(stageRaw);
    expect(parsed.stage_name).toBe('Crown Placement');
    expect(parsed.lab_order_status).toBe('READY');
    expect(parsed.is_blocked_by_prerequisite).toBe(false);
    expect(parsed.reference_video_url).toBe('https://youtube.com/watch?v=crown123');
  });

  it('parses list of patient dental treatment stages', () => {
    const listRaw = [
      {
        id: 'stg-1',
        patient_id: 'pat-1',
        procedure_name: 'Scaling',
        stage_number: 1,
        total_stages: 1,
        status: 'COMPLETED',
        lab_order_status: null,
        appointment_status: null,
        is_blocked_by_prerequisite: false,
        created_at: '2026-09-20',
      },
    ];

    const parsed = patientDentalStagesListSchema.parse(listRaw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.status).toBe('COMPLETED');
  });

  describe('Dental Formatters & Helpers', () => {
    it('formats dental currencies', () => {
      expect(formatDentalCurrency(5000, 'KES')).toBe('KES 5,000.00');
      expect(formatDentalCurrency(2500, 'INR')).toBe('₹2,500.00');
      expect(formatDentalCurrency(0)).toBe('KES 0.00');
    });

    it('formats tooth description correctly', () => {
      expect(formatToothDescription(16)).toBe('Tooth #16');
      expect(formatToothDescription(null)).toBe('General Dental');
    });

    it('returns dental quotation status labels and styles', () => {
      expect(getDentalStatusLabel('SENT')).toBe('Pending Your Decision');
      expect(getDentalStatusLabel('ACCEPTED')).toBe('Accepted');
      expect(getDentalStatusLabel('REJECTED')).toBe('Declined');
      expect(getDentalStatusLabel('POSTPONED')).toBe('Decision Postponed');

      const acceptedStyle = getDentalStatusStyle('ACCEPTED');
      expect(acceptedStyle.bg).toBe('#DCFCE7');

      const sentStyle = getDentalStatusStyle('SENT');
      expect(sentStyle.bg).toBe('#E0F2FE');
    });

    it('returns stage status labels and badge variants', () => {
      expect(getStageStatusLabel('COMPLETED')).toBe('Completed');
      expect(getStageStatusLabel('IN_PROGRESS')).toBe('In Progress');
      expect(getStageStatusLabel('SCHEDULED')).toBe('Scheduled');
      expect(getStageStatusLabel('PLANNED')).toBe('Planned');
      expect(getStageStatusLabel('ON_HOLD')).toBe('On Hold');
      expect(getStageStatusLabel('CANCELLED')).toBe('Cancelled');

      expect(getStageBadgeVariant('COMPLETED')).toBe('success');
      expect(getStageBadgeVariant('IN_PROGRESS')).toBe('info');
      expect(getStageBadgeVariant('SCHEDULED')).toBe('info');
      expect(getStageBadgeVariant('PLANNED')).toBe('neutral');
      expect(getStageBadgeVariant('ON_HOLD')).toBe('warning');
      expect(getStageBadgeVariant('CANCELLED')).toBe('danger');
    });
  });
});
