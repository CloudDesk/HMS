import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PharmacyDispensingModel } from './pharmacy-dispensing.model.js';

let mongodb: MongoMemoryServer;

const draft = (overrides: Record<string, unknown> = {}) => ({
  prescriptionId: new Types.ObjectId(),
  patientId: new Types.ObjectId(),
  branchId: new Types.ObjectId(),
  status: 'DRAFT',
  version: 0,
  items: [],
  createdBy: new Types.ObjectId(),
  updatedBy: new Types.ObjectId(),
  ...overrides,
});

beforeAll(async () => {
  mongodb = await MongoMemoryServer.create();
  await mongoose.connect(mongodb.getUri());
  await PharmacyDispensingModel.syncIndexes();
});

beforeEach(async () => {
  await PharmacyDispensingModel.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongodb.stop();
});

describe('PharmacyDispensingModel idempotency indexes', () => {
  it('allows multiple prescriptions to create coexisting DRAFT records without null keys', async () => {
    await PharmacyDispensingModel.create(draft());
    await PharmacyDispensingModel.create(draft());

    const records = await PharmacyDispensingModel.collection.find({}).toArray();
    expect(records).toHaveLength(2);
    expect(records.every((record) => !('confirmIdempotencyKey' in record))).toBe(true);
    expect(records.every((record) => !('reverseIdempotencyKey' in record))).toBe(true);
  });

  it('rejects a duplicate real confirmation idempotency key', async () => {
    await PharmacyDispensingModel.create(draft({ confirmIdempotencyKey: 'confirm-key' }));

    await expect(
      PharmacyDispensingModel.create(draft({ confirmIdempotencyKey: 'confirm-key' })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('rejects a duplicate real reversal idempotency key', async () => {
    await PharmacyDispensingModel.create(draft({ reverseIdempotencyKey: 'reverse-key' }));

    await expect(
      PharmacyDispensingModel.create(draft({ reverseIdempotencyKey: 'reverse-key' })),
    ).rejects.toMatchObject({ code: 11000 });
  });
});
