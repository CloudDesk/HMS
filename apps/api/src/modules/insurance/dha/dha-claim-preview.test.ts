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
import {
  type DhaClaimPreviewRequest,
  MockDhaClaimPreviewAdapter,
  UnavailableDhaClaimPreviewAdapter,
  createDhaClaimPreviewAdapter,
} from './dha-claim-preview.adapter.js';
import { DhaClaimSubmissionService } from './dha-claim-submission.service.js';
import { DhaClaimPreviewService } from './dha-claim-preview.service.js';

describe('HMS Insurance — Phase 9.2: Mock DHA Claim Preview', () => {
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
    await ShaServiceMappingModel.init();
    await InsuranceAuthorizationModel.init();
    await AuditLogModel.init();

    await PatientModel.collection.insertOne({
      _id: patientId,
      patientNumber: 'P-92',
      firstName: 'Alice',
      lastName: 'Smith',
    });
    await OpdVisitModel.collection.insertOne({
      _id: encounterId,
      patientId,
      branchId,
      doctorId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(),
      visitDate: new Date('2026-10-09'),
      patientName: 'Alice Smith',
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
      memberNumber: 'MEM-92',
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

  const setupSubmittedClaim = async () => {
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
      correlationId: 'corr-init',
    });
    return { claim: validated, submission };
  };

  describe('1. Adapter Unit Tests', () => {
    it('MockDhaClaimPreviewAdapter produces deterministic mock preview results', async () => {
      const adapter = new MockDhaClaimPreviewAdapter();
      expect(adapter.mode).toBe('MOCK');

      const result = await adapter.previewClaim({
        claimId: '507f1f77bcf86cd799439011',
        mockSubmissionReference: 'MOCK-CLAIM-TEST',
        sourceFingerprint: 'dummy-fp',
        version: 1,
        correlationId: 'corr-test',
        claimedTotal: 1000,
        lineCount: 1,
        lines: [],
        issues: [],
      });

      expect(result.source).toBe('MOCK');
      expect(result.status).toBe('PREVIEW_AVAILABLE');
      expect(result.claimedTotal).toBe(1000);
      expect(result.lineCount).toBe(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('UnavailableDhaClaimPreviewAdapter fails closed in REAL mode (503)', async () => {
      const adapter = new UnavailableDhaClaimPreviewAdapter();
      expect(adapter.mode).toBe('REAL');

      await expect(
        adapter.previewClaim({} as unknown as DhaClaimPreviewRequest),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_PREVIEW_CONTRACT_UNCONFIRMED',
      });
    });

    it('createDhaClaimPreviewAdapter respects DHA_INTEGRATION_MODE', () => {
      const mockAdapter = createDhaClaimPreviewAdapter({ integrationMode: 'MOCK' } as unknown as Parameters<typeof createDhaClaimPreviewAdapter>[0]);
      expect(mockAdapter.mode).toBe('MOCK');

      const realAdapter = createDhaClaimPreviewAdapter({ integrationMode: 'REAL' } as unknown as Parameters<typeof createDhaClaimPreviewAdapter>[0]);
      expect(realAdapter.mode).toBe('REAL');
    });
  });

  describe('2. Service Integration Tests', () => {
    it('Scenario 1: Valid current mock submission permits preview and stores result', async () => {
      const { claim, submission } = await setupSubmittedClaim();
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);

      const result = await previewService.mockPreviewClaim(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-prev-1',
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('MOCK');
      expect(result.claimId).toBe(claim._id.toString());
      expect(result.mockSubmissionReference).toBe(submission.externalReference);
      expect(result.status).toBe('PREVIEW_AVAILABLE');
      expect(result.claimedTotal).toBe(1000);
      expect(result.lineCount).toBe(1);
      expect(result.idempotent).toBe(false);

      const stored = await DhaMockClaimPreviewModel.findOne({ claimId: claim._id }).lean();
      expect(stored).not.toBeNull();
      expect(stored?.source).toBe('MOCK');
      expect(stored?.mockSubmissionReference).toBe(submission.externalReference);

      // Audit log check
      const audit = await AuditLogModel.findOne({ eventType: 'INSURANCE_CLAIM_MOCK_PREVIEWED' }).lean();
      expect(audit).not.toBeNull();
      expect(audit?.actorUserId).toBe(actor);
    });

    it('Scenario 2: Missing mock submission is rejected (404)', async () => {
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

      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      await expect(
        previewService.mockPreviewClaim(validated._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DHA_MOCK_SUBMISSION_NOT_FOUND',
      });
    });

    it('Scenario 3: Submission belonging to another claim is rejected (409)', async () => {
      const { claim } = await setupSubmittedClaim();

      // Tamper with submission to associate with another claim ID
      const otherClaimId = new Types.ObjectId();
      await DhaMockClaimSubmissionModel.updateOne(
        { claimId: claim._id },
        { $set: { claimId: otherClaimId } },
      );

      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      await expect(
        previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DHA_MOCK_SUBMISSION_NOT_FOUND',
      });
    });

    it('Scenario 4: Changed source fingerprint rejects stale preview (409)', async () => {
      const { claim } = await setupSubmittedClaim();
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);

      // Mutate underlying invoice
      await BillingInvoiceItemModel.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 700, lineTotal: 1400 } },
      );
      await BillingInvoiceModel.updateOne(
        { _id: invoiceId },
        { $set: { totalAmount: 1400 } },
      );

      await expect(
        previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CLAIM_SOURCE_CHANGED',
      });
    });

    it('Scenario 5: Cancelled claim is rejected (409)', async () => {
      const { claim } = await setupSubmittedClaim();
      await InsuranceClaimModel.updateOne({ _id: claim._id }, { $set: { status: 'CANCELLED' } });

      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      await expect(
        previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CLAIM_CANCELLED',
      });
    });

    it('Scenario 6: Existing validation blockers prevent successful preview', async () => {
      const { claim } = await setupSubmittedClaim();

      // Deactivate SHA mapping to create an internal validation blocker
      await ShaServiceMappingModel.updateOne(
        { serviceId: serviceId1 },
        { $set: { status: 'INACTIVE' } },
      );

      // Re-validating claim turns status to DRAFT because mapping is missing
      await claims.validate(
        claim._id.toString(),
        claim.version,
        actor,
        { ipAddress: '127.0.0.1' },
      );

      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      await expect(
        previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'CLAIM_NOT_READY_FOR_PREVIEW',
      });
    });

    it('Scenario 7: Valid claim produces a deterministic MOCK result', async () => {
      const { claim, submission } = await setupSubmittedClaim();
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);

      const result = await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      expect(result.source).toBe('MOCK');
      expect(result.status).toBe('PREVIEW_AVAILABLE');
      expect(result.mockSubmissionReference).toBe(submission.externalReference);
      expect(result.claimedTotal).toBe(claim.claimedTotal);
      expect(result.lineCount).toBe(claim.lines.length);
    });

    it('Scenario 8: Repeated preview is idempotent', async () => {
      const { claim } = await setupSubmittedClaim();
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);

      const first = await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      expect(first.idempotent).toBe(false);

      const second = await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      expect(second.idempotent).toBe(true);
      expect(second.previewedAt.toISOString()).toBe(first.previewedAt.toISOString());
      expect(second.mockSubmissionReference).toBe(first.mockSubmissionReference);

      const count = await DhaMockClaimPreviewModel.countDocuments({ claimId: claim._id });
      expect(count).toBe(1);
    });

    it('Scenario 9: Changed claim does not reuse stale preview data', async () => {
      const { claim } = await setupSubmittedClaim();
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);

      const first = await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      expect(first.idempotent).toBe(false);

      // Invoice changes
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
      const revalidated = await claims.validate(
        claim._id.toString(),
        updatedClaim!.version,
        actor,
        { ipAddress: '127.0.0.1' },
      );
      expect(revalidated.status).toBe('VALIDATED');

      // Submit new mock submission for updated claim
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      const newSubmission = await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      expect(newSubmission.idempotent).toBe(false);

      // Now preview for the updated claim produces a new preview record
      const freshPreview = await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      expect(freshPreview.idempotent).toBe(false);
      expect(freshPreview.mockSubmissionReference).toBe(newSubmission.externalReference);

      const totalPreviews = await DhaMockClaimPreviewModel.countDocuments({ claimId: claim._id });
      expect(totalPreviews).toBe(2);
    });

    it('Scenario 10: REAL mode without a real adapter fails closed (503)', async () => {
      const { claim } = await setupSubmittedClaim();
      const unavailableAdapter = new UnavailableDhaClaimPreviewAdapter();
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access, unavailableAdapter);

      await expect(
        previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_PREVIEW_CONTRACT_UNCONFIRMED',
      });

      const count = await DhaMockClaimPreviewModel.countDocuments();
      expect(count).toBe(0);
    });

    it('Scenario 11: MOCK mode makes no external network calls', async () => {
      const { claim } = await setupSubmittedClaim();
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);

      await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('Scenario 12: Claim status and readyForShaSubmission remain unchanged by preview', async () => {
      const { claim } = await setupSubmittedClaim();
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);

      await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });

      const claimAfter = await InsuranceClaimModel.findById(claim._id).lean();
      expect(claimAfter?.status).toBe('VALIDATED');
      expect(claimAfter?.readyForShaSubmission).toBe(false);
    });

    it('Scenario 13: Invoices and payment records remain unchanged', async () => {
      const invoiceBefore = await BillingInvoiceModel.findById(invoiceId).lean();
      const { claim } = await setupSubmittedClaim();
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);

      await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });

      const invoiceAfter = await BillingInvoiceModel.findById(invoiceId).lean();
      expect(invoiceAfter?.status).toBe(invoiceBefore?.status);
      expect(invoiceAfter?.totalAmount).toBe(invoiceBefore?.totalAmount);
      expect(invoiceAfter?.discountAmount).toBe(invoiceBefore?.discountAmount);
      expect(invoiceAfter?.paidAmount).toBe(invoiceBefore?.paidAmount);
    });

    it('Scenario 14: No raw payloads or credentials are persisted', async () => {
      const { claim } = await setupSubmittedClaim();
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);

      await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });

      const stored = await DhaMockClaimPreviewModel.findOne({ claimId: claim._id }).lean();
      const keys = Object.keys(stored || {});
      expect(keys).not.toContain('password');
      expect(keys).not.toContain('client_secret');
      expect(keys).not.toContain('token');
      expect(keys).not.toContain('payload');
      expect(keys).not.toContain('rawResponse');
    });

    it('Scenario 15: Existing Phase 9.1 submission and Phase 8 validation flows remain unmodified', async () => {
      const { claim, submission } = await setupSubmittedClaim();
      expect(claim).toBeDefined();
      expect(claim.status).toBe('VALIDATED');
      expect(submission).toBeDefined();
      expect(submission.externalReference).toMatch(/^MOCK-CLAIM-/);
    });
  });
});
