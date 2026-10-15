import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { InsuranceAuthorizationModel } from './insurance-authorization.model.js';
import { InsuranceAuthorizationRepository } from './insurance-authorization.repository.js';
import { InsuranceAuthorizationService } from './insurance-authorization.service.js';
import { InsuranceRepository } from './insurance.repository.js';
import { InsuranceService } from './insurance.service.js';
import { InsuranceMemberModel, InsurancePolicyModel } from './insurance.model.js';
import { MockShaPreauthorizationAdapter } from './sha-preauthorization.adapter.js';
import { authorizationRequestSchema, type AuthorizationDecision } from './insurance-authorization.schemas.js';
import { AuditLogModel } from '../auth/auth.model.js';

describe('Insurance Phase 5 authorization', () => {
  let mongo: MongoMemoryReplSet;
  const repository = new InsuranceAuthorizationRepository();
  const insurance = new InsuranceService(new InsuranceRepository());
  const actor = new Types.ObjectId().toString();
  const memberId = new Types.ObjectId();
  const policyId = new Types.ObjectId();
  const input = { memberId: memberId.toString(), branchId: new Types.ObjectId().toString(), requestedDate: '2026-10-08', authorizationContext: 'procedure-request', lines: [{ serviceId: new Types.ObjectId().toString(), requestedQuantity: 2 }] };
  const metadata = {};
  const benefit = { eligible: true, benefitStatus: 'AUTHORIZATION_REQUIRED' as const, authorizationRequired: true, memberId: input.memberId, serviceId: input.lines[0]!.serviceId, serviceCode: 'TEST', reasonCode: 'PREAUTHORIZATION_REQUIRED', message: 'Authorization required', verifiedAt: '2026-10-08' };
  const make = (status: AuthorizationDecision['status'] = 'APPROVED') => new InsuranceAuthorizationService(repository, insurance, new MockShaPreauthorizationAdapter(status));
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await InsuranceAuthorizationModel.init();
    await InsurancePolicyModel.collection.insertOne({ _id: policyId, payerId: new Types.ObjectId() });
    await InsuranceMemberModel.collection.insertOne({ _id: memberId, policyId, patientId: new Types.ObjectId() });
  });
  beforeEach(async () => {
    await InsuranceAuthorizationModel.deleteMany({});
    await AuditLogModel.deleteMany({});
    vi.spyOn(repository, 'hasBranchAccess').mockResolvedValue(true);
    vi.spyOn(repository, 'references').mockResolvedValue(true);
    vi.spyOn(insurance, 'verifyBenefit').mockResolvedValue(benefit);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  it('creates a persisted draft with service references, correlation and atomic audit', async () => {
    const result = await make().requestPreauthorization(input, actor, metadata);
    expect(result.status).toBe('DRAFT');
    expect(result.correlationId).toMatch(/^[a-f0-9-]{36}$/);
    expect(result.lines[0]?.serviceId.toString()).toBe(input.lines[0]?.serviceId);
    expect(await AuditLogModel.countDocuments({ eventType: 'INSURANCE_AUTHORIZATION_CREATED' })).toBe(1);
  });
  it.each(['MEMBER_INACTIVE', 'ELIGIBILITY_VERIFICATION_REQUIRED', 'NO_BENEFIT_CONFIGURED'])('blocks prerequisite %s', async reasonCode => {
    vi.mocked(insurance.verifyBenefit).mockResolvedValue({ ...benefit, eligible: false, benefitStatus: 'NOT_COVERED', authorizationRequired: false, reasonCode });
    await expect(make().requestPreauthorization(input, actor, metadata)).rejects.toMatchObject({ code: 'PREAUTH_PREREQUISITE_FAILED' });
    expect(await InsuranceAuthorizationModel.countDocuments()).toBe(0);
  });
  it('blocks covered benefits that do not require authorization', async () => {
    vi.mocked(insurance.verifyBenefit).mockResolvedValue({ ...benefit, benefitStatus: 'COVERED', authorizationRequired: false });
    await expect(make().requestPreauthorization(input, actor, metadata)).rejects.toMatchObject({ code: 'PREAUTH_PREREQUISITE_FAILED' });
  });
  it.each([0, -1, 0.5])('rejects invalid quantity %s', quantity => {
    expect(authorizationRequestSchema.safeParse({ ...input, lines: [{ ...input.lines[0], requestedQuantity: quantity }] }).success).toBe(false);
  });
  it.each(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'PENDING', 'FAILED'] as const)('persists deterministic mock %s and history', async status => {
    const service = make(status);
    const draft = await service.requestPreauthorization(input, actor, metadata);
    const result = await service.submit(draft._id.toString(), draft.version, actor, metadata);
    expect(result.status).toBe(status);
    expect(result.integrationMode).toBe('MOCK');
    expect(result.externalReference).toBe(`MOCK-${draft.correlationId}`);
    expect(result.history.map(row => row.to)).toEqual(['DRAFT', 'SUBMITTED', status]);
    expect(await AuditLogModel.countDocuments()).toBe(3);
  });
  it('treats technical exceptions as failure without persisting credentials or raw errors', async () => {
    const adapter = new MockShaPreauthorizationAdapter();
    vi.spyOn(adapter, 'submit').mockRejectedValue(new Error('Authorization: Bearer secret-token rawPayload'));
    const service = new InsuranceAuthorizationService(repository, insurance, adapter);
    const draft = await service.requestPreauthorization(input, actor, metadata);
    const result = await service.submit(draft._id.toString(), 0, actor, metadata);
    expect(result.status).toBe('FAILED');
    expect(JSON.stringify(result)).not.toContain('secret-token');
    expect(JSON.stringify(await AuditLogModel.find().lean())).not.toContain('secret-token');
  });
  it('strips unexpected raw payload and credential keys from normalized results', async () => {
    const adapter = new MockShaPreauthorizationAdapter();
    vi.spyOn(adapter, 'submit').mockImplementation(async () => ({ status: 'APPROVED', lines: [], rawPayload: 'secret', authorization: 'Bearer secret' }));
    const service = new InsuranceAuthorizationService(repository, insurance, adapter);
    const draft = await service.requestPreauthorization(input, actor, metadata);
    const result = await service.submit(draft._id.toString(), 0, actor, metadata);
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('prevents concurrent duplicate creation and rejects changed quantities', async () => {
    const service = make();
    const results = await Promise.all([service.requestPreauthorization(input, actor, metadata), service.requestPreauthorization(input, actor, metadata)]);
    expect(results[0]?._id.toString()).toBe(results[1]?._id.toString());
    expect(await InsuranceAuthorizationModel.countDocuments()).toBe(1);
    await expect(service.requestPreauthorization({ ...input, lines: [{ serviceId: benefit.serviceId, requestedQuantity: 3 }] }, actor, metadata)).rejects.toMatchObject({ code: 'AUTHORIZATION_REQUEST_CONFLICT' });
  });
  it('blocks production submission when the live contract is missing', async () => {
    const service = new InsuranceAuthorizationService(repository, insurance);
    const draft = await service.requestPreauthorization(input, actor, metadata);
    await expect(service.submit(draft._id.toString(), 0, actor, metadata)).rejects.toMatchObject({ code: 'SHA_PREAUTH_CONTRACT_UNAVAILABLE' });
    expect((await repository.get(draft._id.toString()))?.status).toBe('DRAFT');
  });
  it('enforces branch scope', async () => {
    vi.mocked(repository.hasBranchAccess).mockResolvedValue(false);
    await expect(make().requestPreauthorization(input, actor, metadata)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('cancels drafts with history and rejects stale versions', async () => {
    const service = make();
    const draft = await service.requestPreauthorization(input, actor, metadata);
    await expect(service.cancel(draft._id.toString(), 1, 'Correction', actor, metadata)).rejects.toMatchObject({ code: 'STALE_AUTHORIZATION' });
    expect((await service.cancel(draft._id.toString(), 0, 'Correction', actor, metadata)).status).toBe('CANCELLED');
  });
});
