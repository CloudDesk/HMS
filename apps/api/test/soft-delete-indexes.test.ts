import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PatientModel } from '../src/modules/patients/patient.model.js';
import { PatientRepository } from '../src/modules/patients/patient.repository.js';
import { BillingInvoiceModel } from '../src/modules/billing/billing.model.js';
import { BillingRepository } from '../src/modules/billing/billing.repository.js';

const names = ['patients_branch_live_created', 'patients_live_created', 'invoices_branch_live_created'];
const branch = new Types.ObjectId();
const otherBranch = new Types.ObjectId();
const patientId = new Types.ObjectId();
let mongo: MongoMemoryServer;

describe('H13 soft-delete list indexes', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false });
    // Build the pre-H13 declared indexes only, in this disposable database.
    for (const model of [PatientModel, BillingInvoiceModel]) {
      for (const [key, options] of model.schema.indexes()) {
        if (!names.includes(options.name ?? '')) await model.collection.createIndex(key, options);
      }
    }
    const patients = Array.from({ length: 3000 }, (_, i) => ({
      patientNumber: `H13-${i}`, firstName: 'Synthetic', lastName: 'Patient',
      dateOfBirth: new Date('2000-01-01'), gender: 'UNKNOWN', status: i % 3 ? 'ACTIVE' : 'INACTIVE',
      registrationBranchId: i % 2 ? branch : otherBranch,
      ...(i % 5 === 0 ? {} : { deletedAt: i % 5 === 1 ? new Date() : null }),
      createdAt: new Date(1700000000000 + i * 1000), updatedAt: new Date(),
    }));
    await PatientModel.collection.insertMany(patients);
    await BillingInvoiceModel.collection.insertMany(patients.map((p, i) => ({
      invoiceNumber: `H13-${i}`, patientId: i % 3 ? patientId : new Types.ObjectId(),
      visitId: new Types.ObjectId(), branchId: p.registrationBranchId,
      invoiceDate: new Date('2026-10-13'), status: i % 3 ? 'PENDING' : 'PAID',
      subtotal: 100, totalAmount: 100, paidAmount: 0, balanceAmount: 100,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
      ...('deletedAt' in p ? { deletedAt: p.deletedAt } : {}),
    })));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('declares non-unique, non-partial indexes and measures unhinted plans before/after', async () => {
    const cases = [
      { model: PatientModel, name: names[0], key: { registrationBranchId: 1, deletedAt: 1, createdAt: -1 }, filter: { registrationBranchId: { $in: [branch] }, deletedAt: null }, sort: { createdAt: -1 as const } },
      { model: PatientModel, name: names[1], key: { deletedAt: 1, createdAt: -1 }, filter: { deletedAt: null }, sort: { createdAt: -1 as const } },
      { model: BillingInvoiceModel, name: names[2], key: { branchId: 1, deletedAt: 1, createdAt: -1, _id: -1 }, filter: { branchId: { $in: [branch] }, deletedAt: null }, sort: { createdAt: -1 as const, _id: -1 as const } },
    ];
    for (const entry of cases) {
      const definition = entry.model.schema.indexes().find(([, options]) => options.name === entry.name);
      expect(definition?.[0]).toEqual(entry.key);
      expect(definition?.[1].unique).toBeUndefined();
      expect(definition?.[1].partialFilterExpression).toBeUndefined();
      const collection = entry.model.collection;
      const beforeRows = await collection.find(entry.filter).sort(entry.sort).limit(20).toArray();
      const before = await collection.find(entry.filter).sort(entry.sort).limit(20).explain('executionStats');
      await collection.createIndex(entry.key, { name: entry.name });
      const after = await collection.find(entry.filter).sort(entry.sort).limit(20).explain('executionStats');
      const afterRows = await collection.find(entry.filter).sort(entry.sort).limit(20).toArray();
      expect(afterRows.map(row => String(row._id))).toEqual(beforeRows.map(row => String(row._id)));
      expect(JSON.stringify(after.queryPlanner.winningPlan)).toContain(entry.name);
      expect(after.executionStats.totalDocsExamined).toBeLessThan(before.executionStats.totalDocsExamined);
      process.stdout.write(`${JSON.stringify({ name: entry.name, before: { plan: before.queryPlanner.winningPlan, docs: before.executionStats.totalDocsExamined, keys: before.executionStats.totalKeysExamined }, after: { plan: after.queryPlanner.winningPlan, docs: after.executionStats.totalDocsExamined, keys: after.executionStats.totalKeysExamined } })}\n`);
    }
  });

  it('preserves patient null/missing visibility, deletion exclusion, scope and optional filters', async () => {
    const repo = new PatientRepository();
    const query = { status: 'ACTIVE' as const, gender: 'UNKNOWN' as const, search: 'Synthetic', limit: 100 };
    const expected = await PatientModel.find({ registrationBranchId: branch, deletedAt: null, status: 'ACTIVE', gender: 'UNKNOWN' }).sort({ createdAt: -1 }).limit(100).lean();
    const result = await repo.list(query, [String(branch)]);
    expect(result.data.map(p => p.id)).toEqual(expected.map(p => String(p._id)));
    expect(result.meta.total).toBe(800);
    expect((await repo.list({}, [])).data).toEqual([]);
    const missing = await PatientModel.findOne({ registrationBranchId: branch, deletedAt: { $exists: false } }).lean();
    expect(missing).toBeTruthy();
    expect(await repo.getById(String(missing?._id), [String(branch)])).toBeDefined();
    expect(await repo.getById(String(missing?._id), [String(otherBranch)])).toBeUndefined();
    const deleted = await PatientModel.findOne({ deletedAt: { $type: 'date' } }).lean();
    expect(await repo.getById(String(deleted?._id))).toBeUndefined();
  });

  it('preserves invoice patient/branch/status/date filters and missing deletedAt visibility', async () => {
    const repo = new BillingRepository();
    const result = await repo.list({ patient_id: String(patientId), status: 'PENDING', date_from: '2026-10-13', date_to: '2026-10-13', limit: 100 }, [String(branch)]);
    const expected = await BillingInvoiceModel.find({ patientId, branchId: branch, status: 'PENDING', deletedAt: null }).sort({ createdAt: -1, _id: -1 }).limit(100).lean();
    expect(result.data.map(i => i.id)).toEqual(expected.map(i => String(i._id)));
    expect(result.meta.total).toBe(800);
    expect((await repo.list({}, [])).data).toEqual([]);
    expect((await repo.list({ date_from: '2026-10-14' }, [String(branch)])).data).toEqual([]);
    const missing = await BillingInvoiceModel.findOne({ branchId: branch, deletedAt: { $exists: false } }).lean();
    const visible = await repo.list({ invoice_number: `^${missing?.invoiceNumber}$` }, [String(branch)]);
    // Search escapes regex syntax; exact invoice lookup is checked through getById instead.
    expect(visible.data).toEqual([]);
    expect(await repo.getById(String(missing?._id), [String(branch)])).toBeTruthy();
    expect(await repo.getById(String(missing?._id), [String(otherBranch)])).toBeNull();
    const deleted = await BillingInvoiceModel.findOne({ deletedAt: { $type: 'date' } }).lean();
    expect(await repo.getById(String(deleted?._id))).toBeNull();
  });
});
