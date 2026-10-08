import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { InsuranceIntegrationRepository } from './insurance-integration.repository.js';
import { InsuranceIntegrationService } from './insurance-integration.service.js';
import { InsuranceAuthorizationRepository } from './insurance-authorization.repository.js';
import { InsuranceService } from './insurance.service.js';
import { InsuranceRepository } from './insurance.repository.js';
import { InsuranceAuthorizationModel } from './insurance-authorization.model.js';
import { ShaServiceMappingModel } from './insurance-integration.model.js';
import { InsuranceMemberModel, InsurancePolicyModel } from './insurance.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { OpdClinicalOrderModel } from '../opd/opd-clinical-order.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { ServiceModel } from '../services/service.model.js';
import { BillingInvoiceModel, BillingInvoiceItemModel } from '../billing/billing.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { InsuranceClaimRepository } from './insurance-claim.repository.js';
import { InsuranceClaimService } from './insurance-claim.service.js';
import { InsuranceClaimModel } from './insurance-claim.model.js';
import { createClaimSchema } from './insurance-claim.schemas.js';

describe('Insurance Phase 6 encounter integration', () => {
  let mongo: MongoMemoryReplSet;
  const repo = new InsuranceIntegrationRepository();
  const access = new InsuranceAuthorizationRepository();
  const insurance = new InsuranceService(new InsuranceRepository());
  const integration = new InsuranceIntegrationService(repo, access, insurance);
  const claims = new InsuranceClaimService(new InsuranceClaimRepository(), repo, integration, access, insurance);
  const encounterId = new Types.ObjectId(); const patientId = new Types.ObjectId();
  const branchId = new Types.ObjectId(); const serviceId = new Types.ObjectId();
  const memberId = new Types.ObjectId(); const policyId = new Types.ObjectId(); const payerId = new Types.ObjectId();
  const invoiceId = new Types.ObjectId(); const actor = new Types.ObjectId().toString();
  const benefit = { eligible: true, benefitStatus: 'AUTHORIZATION_REQUIRED' as const, authorizationRequired: true, memberId: memberId.toString(), serviceId: serviceId.toString(), reasonCode: 'PREAUTHORIZATION_REQUIRED', message: 'Configured coverage', verifiedAt: '2026-10-08' };
  const coverage = () => integration.coverage(encounterId.toString(), 'OPD', serviceId.toString(), { quantity: 1 }, actor, {});
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await ShaServiceMappingModel.init();
    await InsuranceClaimModel.init();
    await PatientModel.collection.insertOne({ _id: patientId, patientNumber: 'TEST-P6', firstName: 'Sensitive name' });
    await OpdVisitModel.collection.insertOne({ _id: encounterId, patientId, branchId, doctorId: new Types.ObjectId(), departmentId: new Types.ObjectId(), visitDate: new Date('2026-10-08'), patientName: 'Sensitive name' });
    await ServiceModel.collection.insertOne({ _id: serviceId, code: 'HMS-P6', status: 'ACTIVE' });
    await InsurancePolicyModel.collection.insertOne({ _id: policyId, payerId });
    await InsuranceMemberModel.collection.insertOne({ _id: memberId, patientId, policyId, status: 'ACTIVE', coverageStart: new Date('2026-01-01') });
    await BillingInvoiceModel.collection.insertOne({ _id: invoiceId, visitId: encounterId, patientId, branchId, sourceType: 'OPD', status: 'PENDING', totalAmount: 1000 });
    await BillingInvoiceItemModel.collection.insertOne({ invoiceId, serviceId, quantity: 2, unitPrice: 500, lineTotal: 1000 });
  });
  beforeEach(async () => {
    await InsuranceAuthorizationModel.deleteMany({});
    await ShaServiceMappingModel.deleteMany({});
    await InsuranceClaimModel.deleteMany({});
    vi.spyOn(access, 'hasBranchAccess').mockResolvedValue(true);
    vi.spyOn(insurance, 'verifyBenefit').mockResolvedValue(benefit);
    vi.spyOn(insurance, 'checkCoverage').mockResolvedValue({ valid: true, reasonCode: 'LOCAL_COVERAGE_VALID', message: 'Valid', shaEligibilityStatus: 'NOT_VERIFIED', checkedAt: '2026-10-08' });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  it('returns minimal encounter/service/invoice references and explicit ICD-11 gap', async () => {
    const result = await integration.context(encounterId.toString(), 'OPD', actor);
    expect(result.patientId).toBe(patientId.toString());
    expect(result.services).toEqual([{ serviceId: serviceId.toString(), serviceCode: 'HMS-P6' }]);
    expect(result.invoiceItems[0]?.invoiceId).toBe(invoiceId.toString());
    expect(result.diagnosis.icd11Readiness).toBe('NOT_AVAILABLE');
    expect(result.diagnosis.codes).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('Sensitive name');
    expect(JSON.stringify(result)).not.toContain('totalAmount');
  });
  it('rejects missing encounters', async () => {
    await expect(integration.context(new Types.ObjectId().toString(), 'OPD', actor)).rejects.toMatchObject({ code: 'ENCOUNTER_NOT_FOUND' });
  });
  it.each(['IPD', 'EMERGENCY'])('rejects unsupported %s explicitly', async type => {
    await expect(integration.context(encounterId.toString(), type, actor)).rejects.toMatchObject({ code: 'UNSUPPORTED_ENCOUNTER_TYPE' });
  });
  it('enforces branch access before querying context', async () => {
    vi.mocked(access.hasBranchAccess).mockResolvedValue(false);
    const refs = vi.spyOn(repo, 'references');
    await expect(coverage()).rejects.toMatchObject({ statusCode: 403 });
    expect(refs).not.toHaveBeenCalled();
  });
  it('rejects services unrelated to the encounter', async () => {
    await expect(integration.coverage(encounterId.toString(), 'OPD', new Types.ObjectId().toString(), { quantity: 1 }, actor, {})).rejects.toMatchObject({ code: 'SERVICE_NOT_IN_ENCOUNTER' });
    expect(insurance.verifyBenefit).not.toHaveBeenCalled();
  });
  it('reuses Phase 4 and retains configured-only financial semantics', async () => {
    const result = await coverage();
    expect(result.authorizationRequired).toBe(true);
    expect(insurance.verifyBenefit).toHaveBeenCalledWith({ memberId: memberId.toString(), serviceId: serviceId.toString(), requestedDate: '2026-10-08', quantity: 1 }, actor, {});
    expect(result.shaMappingReadiness).toBe('MISSING');
    expect((await BillingInvoiceModel.findById(invoiceId).lean())?.totalAmount).toBe(1000);
  });
  it('rejects a member belonging to another patient', async () => {
    await expect(integration.coverage(encounterId.toString(), 'OPD', serviceId.toString(), { quantity: 1, memberId: new Types.ObjectId().toString() }, actor, {})).rejects.toMatchObject({ code: 'MEMBER_CONTEXT_REQUIRED' });
  });
  const auth = { encounterId, patientId, branchId, memberId, policyId, payerId, requestedDate: '2026-10-08', status: 'APPROVED', integrationMode: 'LIVE', lines: [{ serviceId, approvedQuantity: 2 }] };
  it('links same-context live approved authorization conservatively', async () => {
    const inserted = await InsuranceAuthorizationModel.collection.insertOne(auth);
    const result = await coverage();
    expect(result.authorization?.authorizationId).toBe(inserted.insertedId.toString());
    expect(result.authorization?.payerValidityConfirmed).toBe(false);
  });
  it.each(['EXPIRED', 'REJECTED', 'PENDING', 'CANCELLED', 'PARTIALLY_APPROVED'])('does not treat %s as approved', async status => {
    await InsuranceAuthorizationModel.collection.insertOne({ ...auth, status });
    expect((await coverage()).authorization).toBeNull();
  });
  it.each(['patientId', 'policyId', 'payerId', 'memberId', 'branchId', 'encounterId'])('rejects authorization with mismatched %s', async field => {
    await InsuranceAuthorizationModel.collection.insertOne({ ...auth, [field]: new Types.ObjectId() });
    expect((await coverage()).authorization).toBeNull();
  });
  it('never accepts mock authorization as live payer approval', async () => {
    await InsuranceAuthorizationModel.collection.insertOne({ ...auth, integrationMode: 'MOCK' });
    expect((await coverage()).authorization).toBeNull();
  });
  it('does not link authorization for a different encounter date', async () => {
    await InsuranceAuthorizationModel.collection.insertOne({ ...auth, requestedDate: '2026-10-07' });
    expect((await coverage()).authorization).toBeNull();
  });
  it('does not link a different service or insufficient approved quantity', async () => {
    await InsuranceAuthorizationModel.collection.insertOne({ ...auth, lines: [{ serviceId: new Types.ObjectId(), approvedQuantity: 10 }, { serviceId, approvedQuantity: 0 }] });
    expect((await coverage()).authorization).toBeNull();
  });
  it('does not let an authorization bypass a rejected benefit decision', async () => {
    await InsuranceAuthorizationModel.collection.insertOne(auth);
    vi.mocked(insurance.verifyBenefit).mockResolvedValue({ ...benefit, eligible: false, benefitStatus: 'NOT_COVERED', authorizationRequired: false });
    const result = await coverage();
    expect(result.eligible).toBe(false);
    expect(result.authorization).toBeNull();
  });
  it('creates and looks up an effective mapping with audit, without seeding real codes', async () => {
    const mapping = await integration.createMapping({ serviceId: serviceId.toString(), interventionCode: 'TEST-ONLY-NOT-SHA', effectiveFrom: '2026-01-01' }, actor, {});
    expect((await repo.mapping(serviceId.toString(), '2026-10-08'))?._id.toString()).toBe(mapping._id.toString());
    expect(await AuditLogModel.countDocuments({ eventType: 'INSURANCE_SHA_MAPPING_CREATED' })).toBeGreaterThan(0);
    expect((await coverage()).shaMappingReadiness).toBe('CONFIGURED_NOT_SHA_VALIDATED');
  });
  it('prevents duplicate active mappings and supports version-checked deactivation', async () => {
    const input = { serviceId: serviceId.toString(), interventionCode: 'TEST-ONLY', effectiveFrom: '2026-01-01' };
    const mapping = await integration.createMapping(input, actor, {});
    await expect(integration.createMapping(input, actor, {})).rejects.toMatchObject({ code: 'SHA_MAPPING_CONFLICT' });
    await expect(integration.deactivateMapping(mapping._id.toString(), 9, 'Correction', actor, {})).rejects.toMatchObject({ code: 'STALE_SHA_MAPPING' });
    await integration.deactivateMapping(mapping._id.toString(), 0, 'Correction', actor, {});
    expect(await repo.mapping(serviceId.toString(), '2026-10-08')).toBeNull();
  });
  it('rejects raw payload fields at mapping boundary', async () => {
    const input = { serviceId: serviceId.toString(), interventionCode: 'TEST', effectiveFrom: '2026-01-01', rawShaResponse: { token: 'secret' } };
    await expect(integration.createMapping(input, actor, {})).rejects.toThrow();
    expect(await ShaServiceMappingModel.countDocuments()).toBe(0);
  });
  it('supports clinical-order service linkage without an invoice', async () => {
    const other = new Types.ObjectId();
    await ServiceModel.collection.insertOne({ _id: other, code: 'HMS-ORDER-P6', status: 'ACTIVE' });
    await OpdClinicalOrderModel.collection.insertOne({ sourceType: 'OPD_VISIT', sourceId: encounterId, patientId, branchId, items: [{ serviceId: other }] });
    const context = await integration.context(encounterId.toString(), 'OPD', actor);
    expect(context.services.some(row => row.serviceId === other.toString())).toBe(true);
  });
  it('Phase 7 creates a draft from invoice amounts with explicit readiness gaps', async () => {
    const record = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
    expect(record.status).toBe('DRAFT');
    expect(record.claimedTotal).toBe(1000);
    expect(record.lines[0]?.claimedUnitAmount).toBe(500);
    expect(record.readyForShaSubmission).toBe(false);
    expect(record.issues.map(row => row.code)).toEqual(expect.arrayContaining(['ICD11_NOT_AVAILABLE', 'SHA_SERVICE_MAPPING_MISSING', 'AUTHORIZATION_REQUIRED_MISSING_OR_INSUFFICIENT']));
    expect(record.lines[0]?.authorizationId).toBeUndefined();
    expect(await AuditLogModel.countDocuments({ eventType: 'INSURANCE_CLAIM_CREATED' })).toBeGreaterThan(0);
  });
  it('Phase 7 uses covered benefits and configured mapping without certifying SHA validity', async () => {
    vi.mocked(insurance.verifyBenefit).mockResolvedValue({ ...benefit, benefitStatus: 'COVERED', authorizationRequired: false });
    await integration.createMapping({ serviceId: serviceId.toString(), interventionCode: 'TEST-CLAIM', effectiveFrom: '2026-01-01' }, actor, {});
    const record = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
    expect(record.lines[0]?.interventionCode).toBe('TEST-CLAIM');
    expect(record.issues.map(row => row.code)).toContain('CONFIGURED_NOT_SHA_VALIDATED');
  });
  it('Phase 7 links only applicable authorization', async () => {
    const inserted = await InsuranceAuthorizationModel.collection.insertOne(auth);
    const record = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
    expect(record.lines[0]?.authorizationId?.toString()).toBe(inserted.insertedId.toString());
    expect(record.issues.map(row => row.code)).toContain('SHA_AUTHORIZATION_VALIDITY_UNCONFIRMED');
  });
  it.each(['EXPIRED', 'REJECTED'])('Phase 7 rejects %s authorization linkage', async status => {
    await InsuranceAuthorizationModel.collection.insertOne({ ...auth, status });
    const record = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
    expect(record.lines[0]?.authorizationId).toBeUndefined();
  });
  it('Phase 7 rejects nonexistent invoice', async () => {
    await expect(claims.create({ invoiceId: new Types.ObjectId().toString() }, actor, {})).rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND' });
  });
  it('Phase 7 cannot accept client supplied amounts', () => {
    expect(createClaimSchema.safeParse({ invoiceId: invoiceId.toString(), claimedTotal: 1 }).success).toBe(false);
  });
  it('Phase 7 prevents duplicates and preserves draft validation snapshots', async () => {
    const first = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
    const second = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
    expect(second._id.toString()).toBe(first._id.toString());
    const validated = await claims.validate(first._id.toString(), 0, actor, {});
    expect(validated.status).toBe('DRAFT');
    expect(validated.version).toBe(1);
    expect(validated.lines).toEqual(first.lines);
    await expect(claims.validate(first._id.toString(), 0, actor, {})).rejects.toMatchObject({ code: 'STALE_CLAIM' });
  });
  it('Phase 7 rejects unauthorized branch access', async () => {
    vi.mocked(access.hasBranchAccess).mockResolvedValue(false);
    await expect(claims.create({ invoiceId: invoiceId.toString() }, actor, {})).rejects.toMatchObject({ statusCode: 403 });
  });
  it.each(['POLICY_EXPIRED', 'POLICY_INACTIVE', 'MEMBER_COVERAGE_EXPIRED'] as const)('Phase 7 blocks invalid coverage: %s', async reasonCode => {
    vi.mocked(insurance.checkCoverage).mockResolvedValue({ valid: false, reasonCode, message: 'Invalid', shaEligibilityStatus: 'NOT_VERIFIED', checkedAt: '2026-10-08' });
    await expect(claims.create({ invoiceId: invoiceId.toString() }, actor, {})).rejects.toMatchObject({ code: reasonCode });
  });
  it('Phase 7 rejects member selection belonging to another patient', async () => {
    await expect(claims.create({ invoiceId: invoiceId.toString(), memberId: new Types.ObjectId().toString() }, actor, {})).rejects.toMatchObject({ code: 'MEMBER_CONTEXT_REQUIRED' });
  });
});
