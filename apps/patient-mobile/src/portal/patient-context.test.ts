import { describe, expect, it } from 'vitest';
import {
  patientPortalContextSchema,
  patientPortalOverviewSchema,
} from './contracts';

describe('Portal Contracts & Schema Validation', () => {
  it('validates a valid patient portal context response for SELF account', () => {
    const raw = {
      account: {
        type: 'PATIENT',
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+919876543210',
        guardian_profile: null,
      },
      patients: [
        {
          id: '507f1f77bcf86cd799439011',
          patient_number: 'HMS-2026-000001',
          full_name: 'Jane Doe',
          date_of_birth: '1990-05-15',
          gender: 'FEMALE',
          relationship: 'SELF',
          is_primary: true,
          preferred_branch: {
            id: 'b1',
            name: 'Main Hospital',
            city: 'Nairobi',
          },
        },
      ],
    };

    const parsed = patientPortalContextSchema.parse(raw);
    expect(parsed.account.full_name).toBe('Jane Doe');
    expect(parsed.patients).toHaveLength(1);
    expect(parsed.patients[0]?.relationship).toBe('SELF');
    expect(parsed.patients[0]?.is_primary).toBe(true);
  });

  it('validates a GUARDIAN account with multiple dependent patients', () => {
    const raw = {
      account: {
        type: 'GUARDIAN',
        full_name: 'Mary Doe',
        email: 'mary@example.com',
        phone: '+919876543211',
        guardian_profile: {
          relationship: 'PARENT',
          legal_consent_accepted: true,
          legal_consent_accepted_at: '2026-01-01T00:00:00.000Z',
          address: { line1: '123 Hospital Way', city: 'Nairobi' },
          identification: { type: 'NATIONAL_ID', number: 'ID123456' },
        },
      },
      patients: [
        {
          id: '507f1f77bcf86cd799439011',
          patient_number: 'HMS-2026-000001',
          full_name: 'Mary Doe',
          date_of_birth: '1985-02-20',
          gender: 'FEMALE',
          relationship: 'SELF',
          is_primary: true,
          preferred_branch: null,
        },
        {
          id: '507f1f77bcf86cd799439012',
          patient_number: 'HMS-2026-000002',
          full_name: 'Tommy Doe',
          date_of_birth: '2018-09-10',
          gender: 'MALE',
          relationship: 'PARENT',
          is_primary: false,
          preferred_branch: { id: 'b1', name: 'Pediatric Wing', city: 'Nairobi' },
        },
      ],
    };

    const parsed = patientPortalContextSchema.parse(raw);
    expect(parsed.account.type).toBe('GUARDIAN');
    expect(parsed.patients).toHaveLength(2);
    expect(parsed.patients[1]?.full_name).toBe('Tommy Doe');
    expect(parsed.patients[1]?.relationship).toBe('PARENT');
  });

  it('validates a complete patient overview response', () => {
    const raw = {
      patient: {
        id: '507f1f77bcf86cd799439011',
        patient_number: 'HMS-2026-000001',
        first_name: 'Jane',
        middle_name: 'Ann',
        last_name: 'Doe',
        date_of_birth: '1990-05-15',
        gender: 'FEMALE',
        phone: '+919876543210',
        email: 'jane@example.com',
        blood_group: 'O+',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        address: {
          line1: '456 Avenue',
          city: 'Nairobi',
          country: 'Kenya',
        },
        emergency_contact: {
          name: 'John Doe',
          relationship: 'Spouse',
          phone: '+919876543299',
        },
      },
      summary: {
        upcoming_appointments: 2,
        outstanding_invoices: 1,
        verified_lab_results: 5,
        verified_imaging_reports: 1,
      },
      appointments: [],
      invoices: [],
      laboratory_results: [],
      imaging_reports: [],
      prescriptions: [],
      purchased_medicines: [],
    };

    const parsed = patientPortalOverviewSchema.parse(raw);
    expect(parsed.patient.first_name).toBe('Jane');
    expect(parsed.patient.middle_name).toBe('Ann');
    expect(parsed.patient.blood_group).toBe('O+');
    expect(parsed.summary.upcoming_appointments).toBe(2);
    expect(parsed.summary.outstanding_invoices).toBe(1);
  });

  it('rejects overview data if required patient identifiers are missing', () => {
    const invalidRaw = {
      patient: {
        id: '507f1f77bcf86cd799439011',
        // missing patient_number and names
      },
      summary: {
        upcoming_appointments: 0,
      },
    };

    const result = patientPortalOverviewSchema.safeParse(invalidRaw);
    expect(result.success).toBe(false);
  });
});
