import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BillingInvoiceModel } from './billing.model.js';

let mongodb: MongoMemoryServer;

const invoice = (context?: {
  contextType: 'ADMISSION_REQUEST' | 'PROCEDURE_BOOKING';
  contextId: Types.ObjectId;
}) => ({
  invoiceNumber: `INV-${new Types.ObjectId().toString()}`,
  patientId: new Types.ObjectId(),
  visitId: new Types.ObjectId(),
  sourceType: 'OPD',
  encounterId: new Types.ObjectId(),
  branchId: new Types.ObjectId(),
  ...(context ?? {}),
  invoiceDate: new Date(),
  status: 'DRAFT',
  subtotal: 100,
  discountAmount: 0,
  taxAmount: 0,
  totalAmount: 100,
  paidAmount: 0,
  balanceAmount: 100,
});

beforeAll(async () => {
  mongodb = await MongoMemoryServer.create();
  await mongoose.connect(mongodb.getUri());
  await BillingInvoiceModel.syncIndexes();
});

beforeEach(async () => {
  await BillingInvoiceModel.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongodb.stop();
});

describe('BillingInvoice context index', () => {
  it('allows multiple normal OPD invoices without storing null context fields', async () => {
    await BillingInvoiceModel.create(invoice());
    await BillingInvoiceModel.create(invoice());

    const records = await BillingInvoiceModel.collection.find({}).toArray();
    expect(records).toHaveLength(2);
    expect(records.every((record) => !('contextType' in record))).toBe(true);
    expect(records.every((record) => !('contextId' in record))).toBe(true);
  });

  it.each(['ADMISSION_REQUEST', 'PROCEDURE_BOOKING'] as const)(
    'rejects a duplicate real %s billing context',
    async (contextType) => {
      const contextId = new Types.ObjectId();
      await BillingInvoiceModel.create(invoice({ contextType, contextId }));

      await expect(
        BillingInvoiceModel.create(invoice({ contextType, contextId })),
      ).rejects.toMatchObject({ code: 11000 });
    },
  );

  it('allows distinct real billing context IDs', async () => {
    await BillingInvoiceModel.create(invoice({
      contextType: 'ADMISSION_REQUEST',
      contextId: new Types.ObjectId(),
    }));
    await BillingInvoiceModel.create(invoice({
      contextType: 'PROCEDURE_BOOKING',
      contextId: new Types.ObjectId(),
    }));

    expect(await BillingInvoiceModel.countDocuments()).toBe(2);
  });
});
