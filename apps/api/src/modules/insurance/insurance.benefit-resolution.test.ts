import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BenefitConfigModel } from './insurance.model.js';
import { InsuranceRepository } from './insurance.repository.js';

describe('Phase 4 benefit repository resolution', () => {
  let mongo: MongoMemoryServer;
  const repository = new InsuranceRepository();
  const payerId = new Types.ObjectId();
  const schemeId = new Types.ObjectId();
  const policyId = new Types.ObjectId();
  const serviceId = new Types.ObjectId();
  const actor = new Types.ObjectId();
  const query = {
    payerId: payerId.toString(), schemeId: schemeId.toString(), policyId: policyId.toString(),
    serviceId: serviceId.toString(), serviceCode: 'CONS-GEN', category: 'CONSULTATION',
    asOfDate: new Date('2026-06-15'),
  };
  const base = {
    payerId, coverageRule: 'COVERED', startDate: new Date('2026-01-01'),
    serviceId, createdBy: actor, updatedBy: actor,
  };
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });
  beforeEach(async () => { await BenefitConfigModel.deleteMany({}); });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('only admits the member policy and scheme plus unscoped fallbacks', async () => {
    const own = await BenefitConfigModel.create({ ...base, policyId, schemeId });
    const scheme = await BenefitConfigModel.create({ ...base, schemeId });
    const payer = await BenefitConfigModel.create(base);
    await BenefitConfigModel.create({ ...base, policyId: new Types.ObjectId(), schemeId });
    await BenefitConfigModel.create({ ...base, schemeId: new Types.ObjectId() });
    await BenefitConfigModel.create({ ...base, payerId: new Types.ObjectId() });
    const results = await repository.findMatchingBenefitConfigs(query);
    expect(results.map((row) => row._id.toString()).sort()).toEqual(
      [own, scheme, payer].map((row) => row._id.toString()).sort()
    );
    const withoutPolicy = await repository.findMatchingBenefitConfigs({ ...query, policyId: null });
    expect(withoutPolicy).toHaveLength(2);
  });

  it('resolves historical effective periods inclusively and excludes inactive/future/expired configurations', async () => {
    const historical = await BenefitConfigModel.create({ ...base, policyId, endDate: new Date('2026-06-15') });
    const current = await BenefitConfigModel.create({ ...base, policyId, startDate: new Date('2026-06-16') });
    await BenefitConfigModel.create({ ...base, status: 'INACTIVE' });
    expect((await repository.findMatchingBenefitConfigs(query)).map((row) => row._id.toString()))
      .toEqual([historical._id.toString()]);
    expect((await repository.findMatchingBenefitConfigs({ ...query, asOfDate: new Date('2026-10-08') }))
      .map((row) => row._id.toString())).toEqual([current._id.toString()]);
  });

  it('does not apply a different service-specific record through its category or service code', async () => {
    await BenefitConfigModel.create({ ...base, serviceId: new Types.ObjectId(), category: 'CONSULTATION', serviceCode: 'CONS-GEN' });
    await BenefitConfigModel.create({ ...base, serviceId: null, serviceCode: 'OTHER', category: 'CONSULTATION' });
    expect(await repository.findMatchingBenefitConfigs(query)).toEqual([]);
  });

  it('keeps overlap conflicts within the same policy scope and retains historical non-overlap', async () => {
    await BenefitConfigModel.create({ ...base, policyId, endDate: new Date('2026-06-15') });
    const conflictQuery = {
      payerId: payerId.toString(), policyId: policyId.toString(), serviceId: serviceId.toString(),
      startDate: '2026-06-15',
    };
    expect(await repository.findConflictingBenefitConfig(conflictQuery)).not.toBeNull();
    expect(await repository.findConflictingBenefitConfig({ ...conflictQuery, policyId: null })).toBeNull();
    expect(await repository.findConflictingBenefitConfig({ ...conflictQuery, policyId: new Types.ObjectId().toString() })).toBeNull();
    expect(await repository.findConflictingBenefitConfig({ ...conflictQuery, startDate: '2026-06-16' })).toBeNull();
  });
});
