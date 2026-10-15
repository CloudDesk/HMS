import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { OpdConsultationModel } from './opd-consultation.model.js';
import { OpdConsultationRepository } from './opd-consultation.repository.js';
import type { OpdVisit } from './opd-visit.types.js';

describe('OPD Consultation Structured Diagnosis (ICD-11 Readiness)', () => {
  let mongo: MongoMemoryReplSet;
  const repository = new OpdConsultationRepository();
  const userId = new Types.ObjectId().toString();

  const mockVisit: OpdVisit = {
    id: new Types.ObjectId().toString(),
    visit_number: 'OPD-2026-0001',
    patient_id: new Types.ObjectId().toString(),
    patient_number: 'P-1001',
    patient_name: 'Jane Doe',
    doctor_id: new Types.ObjectId().toString(),
    doctor_name: 'Dr. Smith',
    department_id: new Types.ObjectId().toString(),
    department_name: 'Internal Medicine',
    branch_id: new Types.ObjectId().toString(),
    branch_name: 'Main Hospital',
    visit_date: '2026-10-08',
    status: 'READY_FOR_CONSULTATION',
    priority: 'NORMAL',
    visit_type: 'NEW',
    consultation_room: null,
    queue_number: 'Q-01',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await OpdConsultationModel.init();
  });

  beforeEach(async () => {
    await OpdConsultationModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('1. Persists consultation with structured ICD-11 diagnosis and retrieves it cleanly', async () => {
    const consultation = await repository.saveForVisit(
      {
        visit: mockVisit,
        assessment: 'Clinical acute nasopharyngitis',
        diagnoses: [
          {
            code: 'CA40.0',
            display: 'Acute nasopharyngitis',
            codingSystem: 'ICD-11',
            type: 'PRIMARY',
            notes: 'Common cold symptoms for 3 days',
          },
        ],
      },
      userId,
    );

    expect(consultation.diagnoses).toHaveLength(1);
    expect(consultation.diagnoses[0]).toEqual({
      code: 'CA40.0',
      display: 'Acute nasopharyngitis',
      codingSystem: 'ICD-11',
      type: 'PRIMARY',
      notes: 'Common cold symptoms for 3 days',
    });
    expect(consultation.assessment).toBe('Clinical acute nasopharyngitis');

    const fetched = await repository.getByVisit(mockVisit.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.diagnoses).toHaveLength(1);
    expect(fetched?.diagnoses[0]?.code).toBe('CA40.0');
    expect(fetched?.diagnoses[0]?.codingSystem).toBe('ICD-11');
  });

  it('2. Supports multiple structured diagnoses with PRIMARY and SECONDARY types', async () => {
    const consultation = await repository.saveForVisit(
      {
        visit: mockVisit,
        diagnoses: [
          {
            code: 'BA00',
            display: 'Essential hypertension',
            codingSystem: 'ICD-11',
            type: 'PRIMARY',
          },
          {
            code: '5A11',
            display: 'Type 2 diabetes mellitus',
            codingSystem: 'ICD-11',
            type: 'SECONDARY',
            notes: 'Well controlled on metformin',
          },
        ],
      },
      userId,
    );

    expect(consultation.diagnoses).toHaveLength(2);
    expect(consultation.diagnoses[0]?.type).toBe('PRIMARY');
    expect(consultation.diagnoses[1]?.type).toBe('SECONDARY');
    expect(consultation.diagnoses[1]?.notes).toBe('Well controlled on metformin');
  });

  it('3. Backward compatibility: Saves and retrieves consultation without diagnoses without error', async () => {
    const consultation = await repository.saveForVisit(
      {
        visit: mockVisit,
        assessment: 'Free text assessment only',
      },
      userId,
    );

    expect(consultation.assessment).toBe('Free text assessment only');
    expect(consultation.diagnoses).toEqual([]);

    const fetched = await repository.getByVisit(mockVisit.id);
    expect(fetched?.assessment).toBe('Free text assessment only');
    expect(fetched?.diagnoses).toEqual([]);
  });

  it('4. Defaults codingSystem to ICD-11 if omitted or empty', async () => {
    const consultation = await repository.saveForVisit(
      {
        visit: mockVisit,
        diagnoses: [
          {
            code: '1B10',
            display: 'Tuberculosis',
            codingSystem: '',
            type: 'PRIMARY',
          },
        ],
      },
      userId,
    );

    expect(consultation.diagnoses[0]?.codingSystem).toBe('ICD-11');
  });
});
