import mongoose, { Types, type ClientSession } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ClinicalSourceContext } from './clinical-context.types.js';
import { OpdClinicalOrderModel } from './opd-clinical-order.model.js';
import { OpdClinicalOrderRepository } from './opd-clinical-order.repository.js';
import { OpdPrescriptionModel } from './opd-prescription.model.js';
import { OpdPrescriptionRepository } from './opd-prescription.repository.js';

let mongodb: MongoMemoryReplSet;

const context = (
  sourceType: ClinicalSourceContext['source_type'],
  sourceId = new Types.ObjectId().toString(),
): ClinicalSourceContext => ({
  source_type: sourceType,
  source_id: sourceId,
  encounter_id: sourceType === 'EMERGENCY_ENCOUNTER' ? sourceId : null,
  admission_id: sourceType === 'INPATIENT_ADMISSION' ? sourceId : null,
  procedure_id: sourceType === 'PROCEDURE_BOOKING' ? sourceId : null,
  patient_id: new Types.ObjectId().toString(),
  patient_number: `HMS-${new Types.ObjectId().toString().slice(-8)}`,
  patient_name: 'Clinical Context Patient',
  doctor_id: new Types.ObjectId().toString(),
  doctor_name: 'Dr. Context',
  branch_id: new Types.ObjectId().toString(),
});

const inTransaction = async <T>(operation: (session: ClientSession) => Promise<T>) => {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => operation(session));
  } finally {
    await session.endSession();
  }
};

beforeAll(async () => {
  mongodb = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongodb.getUri());
  await OpdPrescriptionModel.syncIndexes();
  await OpdClinicalOrderModel.syncIndexes();
});

beforeEach(async () => {
  await Promise.all([
    OpdPrescriptionModel.deleteMany({}),
    OpdClinicalOrderModel.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongodb.stop();
});

describe('clinical-context visit indexes', () => {
  it('allows multiple Emergency encounters to create prescriptions without visitId', async () => {
    const repository = new OpdPrescriptionRepository();

    await inTransaction((session) => repository.submitForContext(context('EMERGENCY_ENCOUNTER'), {
      items: [{
        medicine_name: 'Emergency Medicine A',
        strength: null,
        dosage: '1 tablet',
        route: 'Oral',
        frequency: 'STAT',
        duration: 'Stat',
        quantity: 1,
      }],
    }, new Types.ObjectId().toString(), session));
    await inTransaction((session) => repository.submitForContext(context('EMERGENCY_ENCOUNTER'), {
      items: [{
        medicine_name: 'Emergency Medicine B',
        strength: null,
        dosage: '500mg',
        route: 'IV',
        frequency: 'STAT',
        duration: 'Stat',
        quantity: 1,
      }],
    }, new Types.ObjectId().toString(), session));

    const records = await OpdPrescriptionModel.collection.find({}).toArray();
    expect(records).toHaveLength(2);
    expect(records.every((record) => !('visitId' in record))).toBe(true);
  });

  it('allows multiple Emergency encounters to create laboratory and imaging orders', async () => {
    const repository = new OpdClinicalOrderRepository();

    for (const orderType of ['LABORATORY', 'IMAGING'] as const) {
      for (let encounter = 0; encounter < 2; encounter += 1) {
        await inTransaction((session) => repository.submitForContext(
          context('EMERGENCY_ENCOUNTER'),
          orderType,
          {
            priority: 'STAT',
            items: [{
              service_id: new Types.ObjectId().toString(),
              investigation_name: `${orderType} investigation ${encounter}`,
              category: 'Emergency',
            }],
          },
          new Types.ObjectId().toString(),
          session,
        ));
      }
    }

    const records = await OpdClinicalOrderModel.collection.find({}).toArray();
    expect(records).toHaveLength(4);
    expect(records.every((record) => !('visitId' in record))).toBe(true);
  });

  it('preserves one prescription per real OPD visit', async () => {
    const repository = new OpdPrescriptionRepository();
    const visitId = new Types.ObjectId();
    const opdContext = context('OPD_VISIT', visitId.toString());

    await inTransaction((session) => repository.submitForContext(opdContext, {
      items: [{
        medicine_name: 'OPD Medicine',
        strength: null,
        dosage: '1 tablet',
        route: 'Oral',
        frequency: 'OD',
        duration: '5 days',
        quantity: 5,
      }],
    }, new Types.ObjectId().toString(), session));

    await expect(OpdPrescriptionModel.create({
      sourceType: 'OPD_VISIT',
      sourceId: new Types.ObjectId(),
      visitId,
      branchId: new Types.ObjectId(),
      patientId: new Types.ObjectId(),
      patientNumber: 'HMS-DUPLICATE-OPD',
      patientName: 'Duplicate OPD Patient',
      doctorId: new Types.ObjectId(),
      doctorName: 'Dr. Duplicate',
      status: 'SUBMITTED',
      items: [],
    })).rejects.toMatchObject({ code: 11000 });
  });
});
