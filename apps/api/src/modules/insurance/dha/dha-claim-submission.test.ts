import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { InsuranceClaimRepository } from '../insurance-claim.repository.js';
import { InsuranceClaimService } from '../insurance-claim.service.js';
import { InsuranceClaimModel } from '../insurance-claim.model.js';
import { InsuranceIntegrationRepository } from '../insurance-integration.repository.js';
import { InsuranceIntegrationService } from '../insurance-integration.service.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import { InsuranceService } from '../insurance.service.js';
import { InsuranceRepository } from '../insurance.repository.js';
import { InsuranceAuthorizationModel } from '../insurance-authorization.model.js';
import { ShaServiceMappingModel } from '../insurance-integration.model.js';
import { InsuranceMemberModel, InsurancePolicyModel } from '../insurance.model.js';
import { OpdVisitModel } from '../../opd/opd-visit.model.js';
import { OpdConsultationModel } from '../../opd/opd-consultation.model.js';
import { PatientModel } from '../../patients/patient.model.js';
import { ServiceModel } from '../../services/service.model.js';
import { BillingInvoiceModel, BillingInvoiceItemModel } from '../../billing/billing.model.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { DhaMockClaimSubmissionModel } from './dha-claim-submission.model.js';
import {
  type DhaClaimSubmissionRequest,
  MockDhaClaimSubmissionAdapter,
  UnavailableDhaClaimSubmissionAdapter,
  createDhaClaimSubmissionAdapter,
} from './dha-claim-submission.adapter.js';
import { DhaClaimSubmissionService } from './dha-claim-submission.service.js';

describe('HMS Insurance — Phase 9.1: Mock DHA Claim Submission Foundation', () => {
  let mongo: MongoMemoryReplSet;
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  const claimRepo = new InsuranceClaimRepository();
  const integrationRepo = new InsuranceIntegrationRepository();
  const access = new InsuranceAuthorizationRepository();
  const insuranceRepo = new InsuranceRepository();
  const insurance = new InsuranceService(insuranceRepo);
  const integration = new InsuranceIntegrationService(integrationRepo, access, insurance);
  const claims = new InsuranceClaimService(claimRepo, integrationRepo, integration, access, insurance);

  const actor = new Types.ObjectId().toString();
  const branchId = new Types.ObjectId();
  const patientId = new Types.ObjectId();
  const encounterId = new Types.ObjectId();
  const serviceId1 = new Types.ObjectId();
  const payerId = new Types.ObjectId();
  const policyId = new Types.ObjectId();
  const memberId = new Types.ObjectId();
  const invoiceId = new Types.ObjectId();
  const invoiceItemId1 = new Types.ObjectId();

  const standardBenefit = {
    eligible: true,
    benefitStatus: 'COVERED' as const,
    authorizationRequired: false,
    memberId: memberId.toString(),
    serviceId: serviceId1.toString(),
    reasonCode: 'BENEFIT_COVERED',
    message: 'Covered',
    verifiedAt: '2026-10-09',
  };

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());

    await InsuranceClaimModel.init();
    await DhaMockClaimSubmissionModel.init();
    await ShaServiceMappingModel.init();
    await InsuranceAuthorizationModel.init();
    await AuditLogModel.init();

    await PatientModel.collection.insertOne({
      _id: patientId,
      patientNumber: 'P-91',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    await OpdVisitModel.collection.insertOne({
      _id: encounterId,
      patientId,
      branchId,
      doctorId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(),
      visitDate: new Date('2026-10-09'),
      patientName: 'Jane Doe',
    });
    await ServiceModel.collection.insertOne({
      _id: serviceId1,
      code: 'SRV-01',
      status: 'ACTIVE',
    });
  });

  beforeEach(async () => {
    global.fetch = mockFetch;
    mockFetch.mockReset();

    await InsuranceClaimModel.deleteMany({});
    await DhaMockClaimSubmissionModel.deleteMany({});
    await InsuranceAuthorizationModel.deleteMany({});
    await ShaServiceMappingModel.deleteMany({});
    await InsuranceMemberModel.deleteMany({});
    await InsurancePolicyModel.deleteMany({});
    await BillingInvoiceModel.deleteMany({});
    await BillingInvoiceItemModel.deleteMany({});
    await OpdConsultationModel.deleteMany({});
    await AuditLogModel.deleteMany({});

    await InsurancePolicyModel.collection.insertOne({ _id: policyId, payerId, status: 'ACTIVE' });
    await InsuranceMemberModel.collection.insertOne({
      _id: memberId,
      patientId,
      policyId,
      memberNumber: 'MEM-91',
      status: 'ACTIVE',
      coverageStart: new Date('2026-01-01'),
    });

    await BillingInvoiceModel.collection.insertOne({
      _id: invoiceId,
      visitId: encounterId,
      patientId,
      branchId,
      sourceType: 'OPD',
      status: 'PENDING',
      totalAmount: 1000,
    });
    await BillingInvoiceItemModel.collection.insertOne({
      _id: invoiceItemId1,
      invoiceId,
      serviceId: serviceId1,
      quantity: 2,
      unitPrice: 500,
      lineTotal: 1000,
    });

    await ShaServiceMappingModel.collection.insertOne({
      serviceId: serviceId1,
      interventionCode: 'INT-01',
      effectiveFrom: '2026-01-01',
      status: 'ACTIVE',
      version: 0,
      createdBy: new Types.ObjectId(actor),
      updatedBy: new Types.ObjectId(actor),
    });

    vi.spyOn(access, 'hasBranchAccess').mockResolvedValue(true);
    vi.spyOn(insurance, 'checkCoverage').mockResolvedValue({
      valid: true,
      reasonCode: 'LOCAL_COVERAGE_VALID',
      message: 'Valid',
      shaEligibilityStatus: 'NOT_VERIFIED',
      checkedAt: '2026-10-09',
    });
    vi.spyOn(insurance, 'verifyBenefit').mockResolvedValue(standardBenefit);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await mongoose.disconnect();
    await mongo?.stop();
  });

  // Helper to create and validate a claim
  const createAndValidateClaim = async () => {
    const created = await claims.create(
      { invoiceId: invoiceId.toString(), memberId: memberId.toString() },
      actor,
      { ipAddress: '127.0.0.1' },
    );
    const validated = await claims.validate(
      created._id.toString(),
      created.version,
      actor,
      { ipAddress: '127.0.0.1' },
    );
    return validated;
  };

  describe('1. Adapter Unit Tests', () => {
    it('MockDhaClaimSubmissionAdapter produces deterministic synthetic references with source=MOCK', async () => {
      const adapter = new MockDhaClaimSubmissionAdapter();
      expect(adapter.mode).toBe('MOCK');

      const claimId = new Types.ObjectId().toString();
      const result = await adapter.submitClaim({
        claimId,
        sourceFingerprint: 'dummy-fp',
        version: 0,
        correlationId: 'test-corr',
        branchId: branchId.toString(),
        patientId: patientId.toString(),
        memberId: memberId.toString(),
        invoiceId: invoiceId.toString(),
        claimedTotal: 1000,
        lines: [],
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('MOCK');
      expect(result.status).toBe('SUBMITTED');
      expect(result.externalReference).toMatch(/^MOCK-CLAIM-[A-Z\d]{8}-[A-Z\d]{8}$/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('UnavailableDhaClaimSubmissionAdapter fails closed in REAL mode (503)', async () => {
      const adapter = new UnavailableDhaClaimSubmissionAdapter();
      expect(adapter.mode).toBe('REAL');

      await expect(
        adapter.submitClaim({} as unknown as DhaClaimSubmissionRequest),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_SUBMISSION_CONTRACT_UNCONFIRMED',
      });
    });

    it('createDhaClaimSubmissionAdapter respects DHA_INTEGRATION_MODE', () => {
      const mockAdapter = createDhaClaimSubmissionAdapter({ integrationMode: 'MOCK' } as unknown as Parameters<typeof createDhaClaimSubmissionAdapter>[0]);
      expect(mockAdapter.mode).toBe('MOCK');

      const realAdapter = createDhaClaimSubmissionAdapter({ integrationMode: 'REAL' } as unknown as Parameters<typeof createDhaClaimSubmissionAdapter>[0]);
      expect(realAdapter.mode).toBe('REAL');
    });
  });

  describe('2. Service Integration Tests', () => {
    it('Scenario 1: Valid claim readiness invokes mock adapter and stores submission', async () => {
      const claim = await createAndValidateClaim();
      expect(claim.status).toBe('VALIDATED');

      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      const result = await submissionService.mockSubmitClaim(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-001',
      });

      expect(result.success).toBe(true);
      expect(result.claimId).toBe(claim._id.toString());
      expect(result.source).toBe('MOCK');
      expect(result.status).toBe('SUBMITTED');
      expect(result.claimedTotal).toBe(1000);
      expect(result.idempotent).toBe(false);
      expect(result.externalReference).toMatch(/^MOCK-CLAIM-/);

      const record = await DhaMockClaimSubmissionModel.findOne({ claimId: claim._id }).lean();
      expect(record).not.toBeNull();
      expect(record?.sourceFingerprint).toBe(claim.sourceFingerprint);
      expect(record?.externalReference).toBe(result.externalReference);
      expect(record?.source).toBe('MOCK');

      // Audit log check
      const audit = await AuditLogModel.findOne({ eventType: 'INSURANCE_CLAIM_MOCK_SUBMITTED' }).lean();
      expect(audit).not.toBeNull();
      expect(audit?.actorUserId).toBe(actor);
    });

    it('Scenario 2: Failed readiness prevents adapter invocation', async () => {
      // Create a claim but leave it invalid (e.g. benefit not covered)
      vi.spyOn(insurance, 'verifyBenefit').mockResolvedValue({
        eligible: false,
        benefitStatus: 'NOT_COVERED',
        authorizationRequired: false,
        memberId: memberId.toString(),
        serviceId: serviceId1.toString(),
        reasonCode: 'BENEFIT_EXCLUDED',
        message: 'Excluded service',
        verifiedAt: '2026-10-09',
      });

      const draftClaim = await claims.create(
        { invoiceId: invoiceId.toString(), memberId: memberId.toString() },
        actor,
        { ipAddress: '127.0.0.1' },
      );
      expect(draftClaim.status).toBe('DRAFT');

      const mockAdapter = new MockDhaClaimSubmissionAdapter();
      const submitSpy = vi.spyOn(mockAdapter, 'submitClaim');
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access, mockAdapter);

      await expect(
        submissionService.mockSubmitClaim(draftClaim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'CLAIM_NOT_READY_FOR_SUBMISSION',
      });

      expect(submitSpy).not.toHaveBeenCalled();
      const count = await DhaMockClaimSubmissionModel.countDocuments();
      expect(count).toBe(0);
    });

    it('Scenario 3: Cancelled, non-existent, invalid ID, or unauthorized claims are rejected', async () => {
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);

      // Invalid ID format
      await expect(
        submissionService.mockSubmitClaim('invalid-id', { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });

      // Non-existent claim
      const randomId = new Types.ObjectId().toString();
      await expect(
        submissionService.mockSubmitClaim(randomId, { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'CLAIM_NOT_FOUND',
      });

      // Branch access denied
      const claim = await createAndValidateClaim();
      vi.spyOn(access, 'hasBranchAccess').mockResolvedValueOnce(false);
      await expect(
        submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'BRANCH_ACCESS_DENIED',
      });

      // Cancelled claim
      await InsuranceClaimModel.updateOne({ _id: claim._id }, { $set: { status: 'CANCELLED' } });
      await expect(
        submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CLAIM_CANCELLED',
      });
    });

    it('Scenario 4: Repeating same submission returns existing result (idempotent)', async () => {
      const claim = await createAndValidateClaim();
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);

      const first = await submissionService.mockSubmitClaim(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-idem',
      });
      expect(first.idempotent).toBe(false);

      const second = await submissionService.mockSubmitClaim(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-idem-2',
      });
      expect(second.idempotent).toBe(true);
      expect(second.externalReference).toBe(first.externalReference);
      expect(second.submittedAt.toISOString()).toBe(first.submittedAt.toISOString());

      const count = await DhaMockClaimSubmissionModel.countDocuments({ claimId: claim._id });
      expect(count).toBe(1);
    });

    it('Scenario 5: Changed claim fingerprint rejects stale submission and allows new submission after revalidation', async () => {
      const claim = await createAndValidateClaim();
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);

      const first = await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      expect(first.idempotent).toBe(false);

      // Modify the invoice item price to alter the invoice fingerprint
      await BillingInvoiceItemModel.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 600, lineTotal: 1200 } },
      );
      await BillingInvoiceModel.updateOne(
        { _id: invoiceId },
        { $set: { totalAmount: 1200 } },
      );

      // Submission with mismatched source fingerprint must throw 409 CLAIM_SOURCE_CHANGED
      await expect(
        submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CLAIM_SOURCE_CHANGED',
      });

      // Update and re-validate claim with the new source fingerprint
      const newSource = await claimRepo.source(invoiceId.toString());
      const updatedClaim = await InsuranceClaimModel.findOneAndUpdate(
        { _id: claim._id },
        { $set: { claimedTotal: 1200, sourceFingerprint: newSource.fingerprint } },
        { returnDocument: 'after' },
      ).lean();

      const revalidated = await claims.validate(
        claim._id.toString(),
        updatedClaim!.version,
        actor,
        { ipAddress: '127.0.0.1' },
      );
      expect(revalidated.status).toBe('VALIDATED');

      // Now submission succeeds with new submission and new externalReference
      const freshResult = await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      expect(freshResult.idempotent).toBe(false);
      expect(freshResult.externalReference).not.toBe(first.externalReference);

      const totalSubmissions = await DhaMockClaimSubmissionModel.countDocuments({ claimId: claim._id });
      expect(totalSubmissions).toBe(2);
    });

    it('Scenario 6: MOCK results explicitly labelled MOCK', async () => {
      const claim = await createAndValidateClaim();
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);

      const result = await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      expect(result.source).toBe('MOCK');
      expect(result.externalReference).toMatch(/^MOCK-CLAIM-/);

      const stored = await DhaMockClaimSubmissionModel.findOne({ claimId: claim._id }).lean();
      expect(stored?.source).toBe('MOCK');
    });

    it('Scenario 7: REAL mode with unavailable adapter fails closed (503)', async () => {
      const claim = await createAndValidateClaim();
      const unavailableAdapter = new UnavailableDhaClaimSubmissionAdapter();
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access, unavailableAdapter);

      await expect(
        submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_SUBMISSION_CONTRACT_UNCONFIRMED',
      });

      const count = await DhaMockClaimSubmissionModel.countDocuments();
      expect(count).toBe(0);
    });

    it('Scenario 8: MOCK mode makes no network calls (global.fetch not called)', async () => {
      const claim = await createAndValidateClaim();
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);

      await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('Scenario 9: Mock submission does NOT mark claim as genuinely submitted', async () => {
      const claim = await createAndValidateClaim();
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);

      await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });

      const claimAfter = await InsuranceClaimModel.findById(claim._id).lean();
      expect(claimAfter?.readyForShaSubmission).toBe(false);
      expect(claimAfter?.status).toBe('VALIDATED');
    });

    it('Scenario 10: No invoice, patient payment, or financial ledger mutations occur', async () => {
      const invoiceBefore = await BillingInvoiceModel.findById(invoiceId).lean();
      const claim = await createAndValidateClaim();
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);

      await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });

      const invoiceAfter = await BillingInvoiceModel.findById(invoiceId).lean();
      expect(invoiceAfter?.status).toBe(invoiceBefore?.status);
      expect(invoiceAfter?.totalAmount).toBe(invoiceBefore?.totalAmount);
      expect(invoiceAfter?.discountAmount).toBe(invoiceBefore?.discountAmount);
      expect(invoiceAfter?.paidAmount).toBe(invoiceBefore?.paidAmount);
    });

    it('Scenario 11: No raw DHA payloads or secrets persisted', async () => {
      const claim = await createAndValidateClaim();
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);

      await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });

      const stored = await DhaMockClaimSubmissionModel.findOne({ claimId: claim._id }).lean();
      const keys = Object.keys(stored || {});
      expect(keys).not.toContain('password');
      expect(keys).not.toContain('client_secret');
      expect(keys).not.toContain('token');
      expect(keys).not.toContain('payload');
      expect(keys).not.toContain('rawResponse');
    });

    it('Scenario 12: Existing claim creation and validation flow remains unmodified', async () => {
      const claim = await createAndValidateClaim();
      expect(claim).toBeDefined();
      expect(claim.status).toBe('VALIDATED');
      expect(claim.readyForShaSubmission).toBe(false);
      expect(claim.issues.length).toBeGreaterThan(0);
    });
  });
});
