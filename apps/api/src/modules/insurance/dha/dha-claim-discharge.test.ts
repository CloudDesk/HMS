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
import { DhaMockClaimPreviewModel } from './dha-claim-preview.model.js';
import { DhaMockClaimDischargeModel } from './dha-claim-discharge.model.js';
import {
  type DhaClaimDischargeRequest,
  MockDhaClaimDischargeAdapter,
  UnavailableDhaClaimDischargeAdapter,
  createDhaClaimDischargeAdapter,
} from './dha-claim-discharge.adapter.js';
import { DhaClaimSubmissionService } from './dha-claim-submission.service.js';
import { DhaClaimPreviewService } from './dha-claim-preview.service.js';
import { DhaClaimDischargeService } from './dha-claim-discharge.service.js';

describe('HMS Insurance — Phase 9.3: Mock DHA Discharge / Final Claim Submission', () => {
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
    await DhaMockClaimPreviewModel.init();
    await DhaMockClaimDischargeModel.init();
    await ShaServiceMappingModel.init();
    await InsuranceAuthorizationModel.init();
    await AuditLogModel.init();

    await PatientModel.collection.insertOne({
      _id: patientId,
      patientNumber: 'P-93',
      firstName: 'Bob',
      lastName: 'Brown',
    });
    await OpdVisitModel.collection.insertOne({
      _id: encounterId,
      patientId,
      branchId,
      doctorId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(),
      visitDate: new Date('2026-10-09'),
      patientName: 'Bob Brown',
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
    await DhaMockClaimPreviewModel.deleteMany({});
    await DhaMockClaimDischargeModel.deleteMany({});
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
      memberNumber: 'MEM-93',
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

  const setupPreviewedClaim = async () => {
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
    const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
    const submission = await submissionService.mockSubmitClaim(validated._id.toString(), {
      actorUserId: actor,
      correlationId: 'corr-init-sub',
    });
    const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
    const preview = await previewService.mockPreviewClaim(validated._id.toString(), {
      actorUserId: actor,
      correlationId: 'corr-init-prev',
    });
    return { claim: validated, submission, preview };
  };

  describe('1. Adapter Unit Tests', () => {
    it('MockDhaClaimDischargeAdapter produces deterministic synthetic references with source=MOCK', async () => {
      const adapter = new MockDhaClaimDischargeAdapter();
      expect(adapter.mode).toBe('MOCK');

      const claimId = new Types.ObjectId().toString();
      const result = await adapter.dischargeClaim({
        claimId,
        sourceFingerprint: 'dummy-fp',
        mockSubmissionReference: 'MOCK-CLAIM-TEST',
        mockPreviewStatus: 'PREVIEW_AVAILABLE',
        version: 0,
        correlationId: 'test-corr',
        claimedTotal: 1000,
        lineCount: 1,
      });

      expect(result.source).toBe('MOCK');
      expect(result.status).toBe('MOCK_DISCHARGED');
      expect(result.externalDischargeReference).toMatch(/^MOCK-DISCHARGE-[A-Z\d]{8}-[A-Z\d]{8}$/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('UnavailableDhaClaimDischargeAdapter fails closed in REAL mode (503)', async () => {
      const adapter = new UnavailableDhaClaimDischargeAdapter();
      expect(adapter.mode).toBe('REAL');

      await expect(
        adapter.dischargeClaim({} as unknown as DhaClaimDischargeRequest),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_DISCHARGE_CONTRACT_UNCONFIRMED',
      });
    });

    it('createDhaClaimDischargeAdapter respects DHA_INTEGRATION_MODE', () => {
      const mockAdapter = createDhaClaimDischargeAdapter({ integrationMode: 'MOCK' } as unknown as Parameters<typeof createDhaClaimDischargeAdapter>[0]);
      expect(mockAdapter.mode).toBe('MOCK');

      const realAdapter = createDhaClaimDischargeAdapter({ integrationMode: 'REAL' } as unknown as Parameters<typeof createDhaClaimDischargeAdapter>[0]);
      expect(realAdapter.mode).toBe('REAL');
    });
  });

  describe('2. Service Integration Tests (All Scenarios)', () => {
    it('Scenario 1: Invalid claim ID format is rejected (400)', async () => {
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      await expect(
        dischargeService.mockDischargeClaim('bad-id', { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('Scenario 2: Missing claim is rejected (404)', async () => {
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      const randomId = new Types.ObjectId().toString();
      await expect(
        dischargeService.mockDischargeClaim(randomId, { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'CLAIM_NOT_FOUND',
      });
    });

    it('Scenario 3: Branch-access denial returns 403', async () => {
      const { claim } = await setupPreviewedClaim();
      vi.spyOn(access, 'hasBranchAccess').mockResolvedValueOnce(false);

      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'BRANCH_ACCESS_DENIED',
      });
    });

    it('Scenario 4: Cancelled claim is rejected (409)', async () => {
      const { claim } = await setupPreviewedClaim();
      await InsuranceClaimModel.updateOne({ _id: claim._id }, { $set: { status: 'CANCELLED' } });

      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CLAIM_CANCELLED',
      });
    });

    it('Scenario 5: Missing mock submission is rejected (404)', async () => {
      const { claim } = await setupPreviewedClaim();
      await DhaMockClaimSubmissionModel.deleteMany({});

      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DHA_MOCK_SUBMISSION_NOT_FOUND',
      });
    });

    it('Scenario 6: Submission belonging to another claim is rejected (409)', async () => {
      const { claim } = await setupPreviewedClaim();
      const otherClaimId = new Types.ObjectId();
      await DhaMockClaimSubmissionModel.updateOne(
        { claimId: claim._id },
        { $set: { claimId: otherClaimId } },
      );

      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DHA_MOCK_SUBMISSION_NOT_FOUND',
      });
    });

    it('Scenario 7: Stale submission fingerprint is rejected (409)', async () => {
      const { claim } = await setupPreviewedClaim();
      await DhaMockClaimSubmissionModel.updateOne(
        { claimId: claim._id },
        { $set: { sourceFingerprint: 'outdated-fp' } },
      );

      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'STALE_MOCK_SUBMISSION',
      });
    });

    it('Scenario 8: Changed underlying invoice source is rejected (409)', async () => {
      const { claim } = await setupPreviewedClaim();
      await BillingInvoiceItemModel.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 750, lineTotal: 1500 } },
      );

      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CLAIM_SOURCE_CHANGED',
      });
    });

    it('Scenario 9: Missing preview is rejected (404)', async () => {
      const { claim } = await setupPreviewedClaim();
      await DhaMockClaimPreviewModel.deleteMany({});

      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DHA_MOCK_PREVIEW_NOT_FOUND',
      });
    });

    it('Scenario 10: Preview/submission mismatch is rejected (409)', async () => {
      const { claim } = await setupPreviewedClaim();
      await DhaMockClaimPreviewModel.updateOne(
        { claimId: claim._id },
        { $set: { mockSubmissionReference: 'DIFFERENT-REF' } },
      );

      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'PREVIEW_SUBMISSION_MISMATCH',
      });
    });

    it('Scenario 11: Blocked preview is rejected (422)', async () => {
      const { claim } = await setupPreviewedClaim();
      await DhaMockClaimPreviewModel.updateOne(
        { claimId: claim._id },
        { $set: { status: 'PREVIEW_BLOCKED' } },
      );

      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'CLAIM_PREVIEW_BLOCKED',
      });
    });

    it('Scenario 12: Internal validation blocker prevents discharge (422)', async () => {
      const { claim } = await setupPreviewedClaim();

      // Deactivate SHA mapping to inject an internal validation error
      await ShaServiceMappingModel.updateOne(
        { serviceId: serviceId1 },
        { $set: { status: 'INACTIVE' } },
      );

      await claims.validate(
        claim._id.toString(),
        claim.version,
        actor,
        { ipAddress: '127.0.0.1' },
      );

      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'CLAIM_NOT_READY_FOR_DISCHARGE',
      });
    });

    it('Scenario 13: Successful mock discharge with source=MOCK and audit logging', async () => {
      const { claim, submission } = await setupPreviewedClaim();
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);

      const result = await dischargeService.mockDischargeClaim(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-disch-1',
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('MOCK');
      expect(result.claimId).toBe(claim._id.toString());
      expect(result.mockSubmissionReference).toBe(submission.externalReference);
      expect(result.externalDischargeReference).toMatch(/^MOCK-DISCHARGE-/);
      expect(result.status).toBe('MOCK_DISCHARGED');
      expect(result.claimedTotal).toBe(1000);
      expect(result.lineCount).toBe(1);
      expect(result.idempotent).toBe(false);

      const stored = await DhaMockClaimDischargeModel.findOne({ claimId: claim._id }).lean();
      expect(stored).not.toBeNull();
      expect(stored?.source).toBe('MOCK');
      expect(stored?.externalDischargeReference).toBe(result.externalDischargeReference);

      const audit = await AuditLogModel.findOne({ eventType: 'INSURANCE_CLAIM_MOCK_DISCHARGED' }).lean();
      expect(audit).not.toBeNull();
      expect(audit?.actorUserId).toBe(actor);
    });

    it('Scenario 14: Repeated discharge is idempotent', async () => {
      const { claim } = await setupPreviewedClaim();
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);

      const first = await dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor });
      expect(first.idempotent).toBe(false);

      const second = await dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor });
      expect(second.idempotent).toBe(true);
      expect(second.externalDischargeReference).toBe(first.externalDischargeReference);
      expect(second.dischargedAt.toISOString()).toBe(first.dischargedAt.toISOString());

      const count = await DhaMockClaimDischargeModel.countDocuments({ claimId: claim._id });
      expect(count).toBe(1);
    });

    it('Scenario 15: REAL mode fails closed (503) without network calls', async () => {
      const { claim } = await setupPreviewedClaim();
      const unavailableAdapter = new UnavailableDhaClaimDischargeAdapter();
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access, unavailableAdapter);

      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_DISCHARGE_CONTRACT_UNCONFIRMED',
      });

      expect(mockFetch).not.toHaveBeenCalled();
      const count = await DhaMockClaimDischargeModel.countDocuments();
      expect(count).toBe(0);
    });

    it('Invariants: Claim status, readyForShaSubmission, and invoice state remain unchanged', async () => {
      const invoiceBefore = await BillingInvoiceModel.findById(invoiceId).lean();
      const { claim } = await setupPreviewedClaim();
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);

      await dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor });

      const claimAfter = await InsuranceClaimModel.findById(claim._id).lean();
      expect(claimAfter?.status).toBe('VALIDATED');
      expect(claimAfter?.readyForShaSubmission).toBe(false);

      const invoiceAfter = await BillingInvoiceModel.findById(invoiceId).lean();
      expect(invoiceAfter?.status).toBe(invoiceBefore?.status);
      expect(invoiceAfter?.totalAmount).toBe(invoiceBefore?.totalAmount);
      expect(invoiceAfter?.discountAmount).toBe(invoiceBefore?.discountAmount);
    });

    it('Historical record preservation: Changed claim requires new sequence without deleting history', async () => {
      const { claim } = await setupPreviewedClaim();
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);

      const firstDischarge = await dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor });
      expect(firstDischarge.idempotent).toBe(false);

      // Modify invoice
      await BillingInvoiceItemModel.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 600, lineTotal: 1200 } },
      );
      await BillingInvoiceModel.updateOne(
        { _id: invoiceId },
        { $set: { totalAmount: 1200 } },
      );

      // Update claim to match new fingerprint
      const newSource = await claimRepo.source(invoiceId.toString());
      const updatedClaim = await InsuranceClaimModel.findOneAndUpdate(
        { _id: claim._id },
        { $set: { claimedTotal: 1200, sourceFingerprint: newSource.fingerprint } },
        { returnDocument: 'after' },
      ).lean();

      // Revalidate claim
      await claims.validate(claim._id.toString(), updatedClaim!.version, actor, { ipAddress: '127.0.0.1' });

      // Run new submission and preview
      const subService = new DhaClaimSubmissionService(claimRepo, claims, access);
      await subService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      const prevService = new DhaClaimPreviewService(claimRepo, claims, access);
      await prevService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });

      // Now discharge succeeds for updated fingerprint
      const secondDischarge = await dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor });
      expect(secondDischarge.idempotent).toBe(false);
      expect(secondDischarge.externalDischargeReference).not.toBe(firstDischarge.externalDischargeReference);

      // Historical records preserved
      const totalDischarges = await DhaMockClaimDischargeModel.countDocuments({ claimId: claim._id });
      expect(totalDischarges).toBe(2);
    });
  });
});
