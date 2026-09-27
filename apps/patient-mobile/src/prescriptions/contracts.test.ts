import { describe, expect, it } from 'vitest';
import {
  prescriptionItemSchema,
  prescriptionRecordSchema,
  prescriptionsDataSchema,
  purchasedMedicineSchema,
} from './contracts';

describe('Prescriptions Contracts & Schemas', () => {
  it('validates a prescription item schema', () => {
    const validItem = {
      id: 'med-001',
      medicine_name: 'Amoxicillin 500mg',
      strength: '500mg',
      dosage: '1 capsule',
      route: 'Oral',
      frequency: 'Three times daily (TDS)',
      duration: '5 days',
      quantity: 15,
      instructions: 'Take after meals with water',
    };

    const parsed = prescriptionItemSchema.parse(validItem);
    expect(parsed.medicine_name).toBe('Amoxicillin 500mg');
    expect(parsed.strength).toBe('500mg');
    expect(parsed.quantity).toBe(15);
  });

  it('validates a prescription record schema with multiple medicines', () => {
    const validRecord = {
      id: 'rx-001',
      doctor_name: 'Dr. John Smith',
      status: 'SUBMITTED',
      submitted_at: '2026-09-20T10:00:00.000Z',
      follow_up_date: '2026-09-27T00:00:00.000Z',
      doctor_instructions: 'Complete full course of antibiotics',
      patient_instructions: 'Drink plenty of fluids',
      items: [
        {
          id: 'med-001',
          medicine_name: 'Amoxicillin',
          dosage: '500mg',
          route: 'Oral',
          frequency: 'TDS',
          duration: '5 days',
        },
        {
          id: 'med-002',
          medicine_name: 'Paracetamol',
          dosage: '650mg',
          route: 'Oral',
          frequency: 'SOS',
          duration: '3 days',
          instructions: 'Take only if fever > 100 F',
        },
      ],
    };

    const parsed = prescriptionRecordSchema.parse(validRecord);
    expect(parsed.id).toBe('rx-001');
    expect(parsed.doctor_name).toBe('Dr. John Smith');
    expect(parsed.items).toHaveLength(2);
    expect(parsed.patient_instructions).toBe('Drink plenty of fluids');
  });

  it('validates a pharmacy purchased medicine schema', () => {
    const validPurchase = {
      id: 'item-101',
      medicine_name: 'Cetirizine 10mg',
      quantity: 10,
      unit_price: 5.5,
      total_amount: 55.0,
      purchased_at: '2026-09-18T14:30:00.000Z',
      invoice_number: 'INV-PHARM-2026-00042',
      payment_status: 'PAID',
      branch: {
        id: 'b-1',
        name: 'Main Hospital Pharmacy',
        city: 'Metropolis',
      },
    };

    const parsed = purchasedMedicineSchema.parse(validPurchase);
    expect(parsed.medicine_name).toBe('Cetirizine 10mg');
    expect(parsed.total_amount).toBe(55.0);
    expect(parsed.branch?.name).toBe('Main Hospital Pharmacy');
  });

  it('validates combined prescriptions data schema', () => {
    const emptyData = {
      prescriptions: [],
      purchased_medicines: [],
    };

    const parsed = prescriptionsDataSchema.parse(emptyData);
    expect(parsed.prescriptions).toEqual([]);
    expect(parsed.purchased_medicines).toEqual([]);
  });
});
