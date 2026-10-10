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
import { UnavailableDhaClaimSubmissionAdapter } from './dha-claim-submission.adapter.js';
import { UnavailableDhaClaimPreviewAdapter } from './dha-claim-preview.adapter.js';
import { UnavailableDhaClaimDischargeAdapter } from './dha-claim-discharge.adapter.js';
import { DhaClaimSubmissionService } from './dha-claim-submission.service.js';
import { DhaClaimPreviewService } from './dha-claim-preview.service.js';
import { DhaClaimDischargeService } from './dha-claim-discharge.service.js';

describe('HMS Insurance — Phase 9.4: End-to-End Mock Claim Lifecycle Verification', () => {
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
  const serviceId2 = new Types.ObjectId();
  const payerId = new Types.ObjectId();
  const policyId = new Types.ObjectId();
  const memberId = new Types.ObjectId();
  const invoiceId = new Types.ObjectId();
  const invoiceItemId1 = new Types.ObjectId();
  const invoiceItemId2 = new Types.ObjectId();

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
      patientNumber: 'P-94',
      firstName: 'Alice',
      lastName: 'Lifecycle',
    });
    await OpdVisitModel.collection.insertOne({
      _id: encounterId,
      patientId,
      branchId,
      doctorId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(),
      visitDate: new Date('2026-10-09'),
      patientName: 'Alice Lifecycle',
    });
    await ServiceModel.collection.insertOne({
      _id: serviceId1,
      code: 'SRV-01',
      status: 'ACTIVE',
    });
    await ServiceModel.collection.insertOne({
      _id: serviceId2,
      code: 'SRV-02',
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
      memberNumber: 'MEM-94',
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
      totalAmount: 1500,
    });
    await BillingInvoiceItemModel.collection.insertOne({
      _id: invoiceItemId1,
      invoiceId,
      serviceId: serviceId1,
      quantity: 1,
      unitPrice: 1000,
      lineTotal: 1000,
    });
    await BillingInvoiceItemModel.collection.insertOne({
      _id: invoiceItemId2,
      invoiceId,
      serviceId: serviceId2,
      quantity: 1,
      unitPrice: 500,
      lineTotal: 500,
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
    await ShaServiceMappingModel.collection.insertOne({
      serviceId: serviceId2,
      interventionCode: 'INT-02',
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
    vi.spyOn(insurance, 'verifyBenefit').mockImplementation(async (svcId: string) => ({
      ...standardBenefit,
      serviceId: svcId,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await mongoose.disconnect();
    await mongo?.stop();
  });

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

  describe('1. Complete Sequential End-to-End Mock Claim Lifecycle', () => {
    it('executes Submission (9.1) -> Preview (9.2) -> Discharge (9.3) with consistent linkage and mock markers', async () => {
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);

      // Step 1: Valid claim in VALIDATED status
      const claim = await createAndValidateClaim();
      expect(claim.status).toBe('VALIDATED');
      expect(claim.readyForShaSubmission).toBe(false);

      // Step 2: Phase 9.1 Mock Submission
      const submission = await submissionService.mockSubmitClaim(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-lifecycle-sub',
      });

      expect(submission.success).toBe(true);
      expect(submission.source).toBe('MOCK');
      expect(submission.status).toBe('SUBMITTED');
      expect(submission.externalReference).toMatch(/^MOCK-CLAIM-[A-Z\d]{8}-[A-Z\d]{8}$/);
      expect(submission.claimedTotal).toBe(1500);
      expect(submission.idempotent).toBe(false);

      const subDoc = await DhaMockClaimSubmissionModel.findOne({ claimId: claim._id });
      expect(subDoc).not.toBeNull();
      expect(subDoc?.sourceFingerprint).toBe(claim.sourceFingerprint);
      expect(subDoc?.externalReference).toBe(submission.externalReference);

      // Step 3: Phase 9.2 Mock Preview using submission reference
      const preview = await previewService.mockPreviewClaim(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-lifecycle-prev',
      });

      expect(preview.success).toBe(true);
      expect(preview.source).toBe('MOCK');
      expect(preview.status).toBe('PREVIEW_AVAILABLE');
      expect(preview.mockSubmissionReference).toBe(submission.externalReference);
      expect(preview.claimedTotal).toBe(1500);
      expect(preview.lineCount).toBe(2);
      expect(preview.idempotent).toBe(false);

      const prevDoc = await DhaMockClaimPreviewModel.findOne({ claimId: claim._id });
      expect(prevDoc).not.toBeNull();
      expect(prevDoc?.sourceFingerprint).toBe(claim.sourceFingerprint);
      expect(prevDoc?.mockSubmissionReference).toBe(submission.externalReference);

      // Step 4: Phase 9.3 Mock Discharge using preview and submission references
      const discharge = await dischargeService.mockDischargeClaim(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-lifecycle-disc',
      });

      expect(discharge.success).toBe(true);
      expect(discharge.source).toBe('MOCK');
      expect(discharge.status).toBe('MOCK_DISCHARGED');
      expect(discharge.mockSubmissionReference).toBe(submission.externalReference);
      expect(discharge.externalDischargeReference).toMatch(/^MOCK-DISCHARGE-[A-Z\d]{8}-[A-Z\d]{8}$/);
      expect(discharge.claimedTotal).toBe(1500);
      expect(discharge.lineCount).toBe(2);
      expect(discharge.idempotent).toBe(false);

      const discDoc = await DhaMockClaimDischargeModel.findOne({ claimId: claim._id });
      expect(discDoc).not.toBeNull();
      expect(discDoc?.sourceFingerprint).toBe(claim.sourceFingerprint);
      expect(discDoc?.mockSubmissionReference).toBe(submission.externalReference);
      expect(discDoc?.externalDischargeReference).toBe(discharge.externalDischargeReference);

      // Invariants Check:
      // 1. All three records share identical claimId and sourceFingerprint
      expect(subDoc?.claimId.toString()).toBe(claim._id.toString());
      expect(prevDoc?.claimId.toString()).toBe(claim._id.toString());
      expect(discDoc?.claimId.toString()).toBe(claim._id.toString());
      expect(subDoc?.sourceFingerprint).toBe(claim.sourceFingerprint);
      expect(prevDoc?.sourceFingerprint).toBe(claim.sourceFingerprint);
      expect(discDoc?.sourceFingerprint).toBe(claim.sourceFingerprint);

      // 2. Claim status remains VALIDATED and readyForShaSubmission remains false
      const refreshedClaim = await InsuranceClaimModel.findById(claim._id);
      expect(refreshedClaim?.status).toBe('VALIDATED');
      expect(refreshedClaim?.readyForShaSubmission).toBe(false);

      // 3. Zero external network calls were made
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('2. End-to-End Idempotency across All Stages', () => {
    it('returns idempotent: true and retains identical references when operations are repeated', async () => {
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);

      const claim = await createAndValidateClaim();

      // Initial pass
      const sub1 = await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      const prev1 = await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      const disc1 = await dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor });

      expect(sub1.idempotent).toBe(false);
      expect(prev1.idempotent).toBe(false);
      expect(disc1.idempotent).toBe(false);

      // Repeated pass
      const sub2 = await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      const prev2 = await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      const disc2 = await dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor });

      expect(sub2.idempotent).toBe(true);
      expect(sub2.externalReference).toBe(sub1.externalReference);

      expect(prev2.idempotent).toBe(true);
      expect(prev2.mockSubmissionReference).toBe(prev1.mockSubmissionReference);

      expect(disc2.idempotent).toBe(true);
      expect(disc2.externalDischargeReference).toBe(disc1.externalDischargeReference);
      expect(disc2.mockSubmissionReference).toBe(disc1.mockSubmissionReference);

      // Verify no duplicate documents in collections
      expect(await DhaMockClaimSubmissionModel.countDocuments({ claimId: claim._id })).toBe(1);
      expect(await DhaMockClaimPreviewModel.countDocuments({ claimId: claim._id })).toBe(1);
      expect(await DhaMockClaimDischargeModel.countDocuments({ claimId: claim._id })).toBe(1);
    });
  });

  describe('3. Failure Recovery, Missing Links & Out-of-Sequence Rejections', () => {
    it('rejects preview if mock submission has not occurred (404 DHA_MOCK_SUBMISSION_NOT_FOUND)', async () => {
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      const claim = await createAndValidateClaim();

      await expect(
        previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DHA_MOCK_SUBMISSION_NOT_FOUND',
      });

      expect(await DhaMockClaimPreviewModel.countDocuments({ claimId: claim._id })).toBe(0);
    });

    it('rejects discharge if mock submission has not occurred (404 DHA_MOCK_SUBMISSION_NOT_FOUND)', async () => {
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      const claim = await createAndValidateClaim();

      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DHA_MOCK_SUBMISSION_NOT_FOUND',
      });

      expect(await DhaMockClaimDischargeModel.countDocuments({ claimId: claim._id })).toBe(0);
    });

    it('rejects discharge if mock preview has not occurred (404 DHA_MOCK_PREVIEW_NOT_FOUND)', async () => {
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      const claim = await createAndValidateClaim();

      // Submit only
      await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });

      // Attempt discharge without preview
      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DHA_MOCK_PREVIEW_NOT_FOUND',
      });

      // Existing submission is intact, no discharge created
      expect(await DhaMockClaimSubmissionModel.countDocuments({ claimId: claim._id })).toBe(1);
      expect(await DhaMockClaimDischargeModel.countDocuments({ claimId: claim._id })).toBe(0);
    });

    it('rejects discharge if preview status is PREVIEW_BLOCKED (422 CLAIM_PREVIEW_BLOCKED)', async () => {
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      const claim = await createAndValidateClaim();

      const sub = await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });

      // Insert blocked preview record directly for this fingerprint
      await DhaMockClaimPreviewModel.create({
        claimId: claim._id,
        mockSubmissionReference: sub.externalReference,
        sourceFingerprint: claim.sourceFingerprint,
        status: 'PREVIEW_BLOCKED',
        source: 'MOCK',
        lineCount: 2,
        claimedTotal: 1500,
        issues: [{ code: 'INT_COVERAGE_EXPIRED', severity: 'ERROR', message: 'Coverage expired' }],
        correlationId: 'corr-blocked',
        previewedAt: new Date(),
        metadata: { actorUserId: actor },
      });

      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'CLAIM_PREVIEW_BLOCKED',
      });

      // Prior records remain undamaged
      expect(await DhaMockClaimSubmissionModel.countDocuments({ claimId: claim._id })).toBe(1);
      expect(await DhaMockClaimPreviewModel.countDocuments({ claimId: claim._id })).toBe(1);
      expect(await DhaMockClaimDischargeModel.countDocuments({ claimId: claim._id })).toBe(0);
    });
  });

  describe('4. Source Changes & Fingerprint Mismatches Between Lifecycle Steps', () => {
    it('rejects preview if invoice changes after submission (409 CLAIM_SOURCE_CHANGED)', async () => {
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      const claim = await createAndValidateClaim();

      await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });

      // Modify invoice item unitPrice/lineTotal after submission to change the source fingerprint
      await BillingInvoiceItemModel.collection.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 1500, lineTotal: 1500 } },
      );

      await expect(
        previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CLAIM_SOURCE_CHANGED',
      });

      // Submission record is uncorrupted
      expect(await DhaMockClaimSubmissionModel.countDocuments({ claimId: claim._id })).toBe(1);
      expect(await DhaMockClaimPreviewModel.countDocuments({ claimId: claim._id })).toBe(0);
    });

    it('rejects discharge if invoice changes after preview (409 CLAIM_SOURCE_CHANGED)', async () => {
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      const claim = await createAndValidateClaim();

      await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });

      // Modify invoice item lineTotal
      await BillingInvoiceItemModel.collection.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 1500, lineTotal: 1500 } },
      );

      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CLAIM_SOURCE_CHANGED',
      });

      // Submission and preview records remain preserved
      expect(await DhaMockClaimSubmissionModel.countDocuments({ claimId: claim._id })).toBe(1);
      expect(await DhaMockClaimPreviewModel.countDocuments({ claimId: claim._id })).toBe(1);
      expect(await DhaMockClaimDischargeModel.countDocuments({ claimId: claim._id })).toBe(0);
    });

    it('preserves historical records when invoice is revalidated and a new lifecycle sequence runs', async () => {
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      const claim = await createAndValidateClaim();

      // Cycle 1: complete submission -> preview -> discharge
      const sub1 = await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      const prev1 = await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      const disc1 = await dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor });
      expect(prev1.mockSubmissionReference).toBe(sub1.externalReference);

      // Underlying invoice item updated to produce different fingerprint
      await BillingInvoiceItemModel.collection.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 1500, lineTotal: 1500 } },
      );
      await BillingInvoiceModel.collection.updateOne(
        { _id: invoiceId },
        { $set: { totalAmount: 2000 } },
      );

      // Update claim to match new source fingerprint
      const newSource = await claimRepo.source(invoiceId.toString());
      const updatedClaim = await InsuranceClaimModel.findOneAndUpdate(
        { _id: claim._id },
        { $set: { claimedTotal: 2000, sourceFingerprint: newSource.fingerprint } },
        { returnDocument: 'after' },
      ).lean();

      // Revalidate claim: updates claim issues/lines and increments version
      const revalidatedClaim = await claims.validate(
        claim._id.toString(),
        updatedClaim!.version,
        actor,
        { ipAddress: '127.0.0.1' },
      );
      expect(revalidatedClaim.sourceFingerprint).not.toBe(claim.sourceFingerprint);

      // Cycle 2: complete submission -> preview -> discharge under new fingerprint
      const sub2 = await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      const prev2 = await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      const disc2 = await dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor });

      expect(sub2.externalReference).not.toBe(sub1.externalReference);
      expect(prev2.mockSubmissionReference).toBe(sub2.externalReference);
      expect(disc2.externalDischargeReference).not.toBe(disc1.externalDischargeReference);
      expect(disc2.mockSubmissionReference).toBe(sub2.externalReference);

      // History Verification: Both cycle 1 and cycle 2 records are preserved in MongoDB
      const subDocs = await DhaMockClaimSubmissionModel.find({ claimId: claim._id }).sort({ submittedAt: 1 });
      expect(subDocs).toHaveLength(2);
      expect(subDocs[0].sourceFingerprint).toBe(claim.sourceFingerprint);
      expect(subDocs[1].sourceFingerprint).toBe(revalidatedClaim.sourceFingerprint);

      const prevDocs = await DhaMockClaimPreviewModel.find({ claimId: claim._id }).sort({ previewedAt: 1 });
      expect(prevDocs).toHaveLength(2);
      expect(prevDocs[0].sourceFingerprint).toBe(claim.sourceFingerprint);
      expect(prevDocs[1].sourceFingerprint).toBe(revalidatedClaim.sourceFingerprint);

      const discDocs = await DhaMockClaimDischargeModel.find({ claimId: claim._id }).sort({ dischargedAt: 1 });
      expect(discDocs).toHaveLength(2);
      expect(discDocs[0].sourceFingerprint).toBe(claim.sourceFingerprint);
      expect(discDocs[1].sourceFingerprint).toBe(revalidatedClaim.sourceFingerprint);
    });
  });

  describe('5. Access Control, Cancellation & Internal Validation Blockers', () => {
    it('denies access across all steps when user lacks branch access (403)', async () => {
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      const claim = await createAndValidateClaim();

      // Submit while authorized
      await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });

      // Now revoke branch access
      vi.spyOn(access, 'hasBranchAccess').mockResolvedValue(false);

      await expect(
        submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });

      await expect(
        previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });

      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });
    });

    it('rejects operations when claim is cancelled (409)', async () => {
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      const claim = await createAndValidateClaim();

      await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });

      // Cancel claim directly
      await InsuranceClaimModel.collection.updateOne(
        { _id: claim._id },
        { $set: { status: 'CANCELLED' } },
      );

      await expect(
        submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CLAIM_CANCELLED' });

      await expect(
        previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CLAIM_CANCELLED' });

      await expect(
        dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CLAIM_CANCELLED' });
    });

    it('blocks lifecycle initiation when claim has internal validation errors (422)', async () => {
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);

      // Create claim
      const created = await claims.create(
        { invoiceId: invoiceId.toString(), memberId: memberId.toString() },
        actor,
        { ipAddress: '127.0.0.1' },
      );

      // Introduce an internal blocker by making benefit verification return ineligible
      vi.spyOn(insurance, 'verifyBenefit').mockResolvedValue({
        eligible: false,
        benefitStatus: 'NOT_COVERED',
        authorizationRequired: false,
        reasonCode: 'BENEFIT_NOT_COVERED',
        message: 'Not covered',
        verifiedAt: '2026-10-09',
      });

      await expect(
        submissionService.mockSubmitClaim(created._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'CLAIM_NOT_READY_FOR_SUBMISSION',
      });

      expect(await DhaMockClaimSubmissionModel.countDocuments({ claimId: created._id })).toBe(0);
    });
  });

  describe('6. Safety Invariants: Financial & Claim Immutability, Real-Mode Fail-Closed & Zero Network Calls', () => {
    it('guarantees that invoice totals, line items, and payment ledgers are completely untouched', async () => {
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);

      const invoiceBefore = await BillingInvoiceModel.findById(invoiceId).lean();
      const itemsBefore = await BillingInvoiceItemModel.find({ invoiceId }).sort({ _id: 1 }).lean();

      const claim = await createAndValidateClaim();
      await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      await dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor });

      const invoiceAfter = await BillingInvoiceModel.findById(invoiceId).lean();
      const itemsAfter = await BillingInvoiceItemModel.find({ invoiceId }).sort({ _id: 1 }).lean();

      expect(invoiceAfter?.totalAmount).toBe(invoiceBefore?.totalAmount);
      expect(invoiceAfter?.status).toBe(invoiceBefore?.status);
      expect(invoiceAfter?.paidAmount).toBe(invoiceBefore?.paidAmount);

      expect(itemsAfter).toHaveLength(itemsBefore.length);
      itemsAfter.forEach((item, idx) => {
        expect(item.lineTotal).toBe(itemsBefore[idx].lineTotal);
        expect(item.quantity).toBe(itemsBefore[idx].quantity);
        expect(item.unitPrice).toBe(itemsBefore[idx].unitPrice);
      });
    });

    it('guarantees that InsuranceClaimModel status remains VALIDATED and readyForShaSubmission remains false', async () => {
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);

      const claim = await createAndValidateClaim();
      await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      await dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor });

      const finalClaim = await InsuranceClaimModel.findById(claim._id);
      expect(finalClaim?.status).toBe('VALIDATED');
      expect(finalClaim?.readyForShaSubmission).toBe(false);
    });

    it('fails closed with typed 503 errors when adapters are in REAL mode and does not call fetch', async () => {
      const realSubmissionAdapter = new UnavailableDhaClaimSubmissionAdapter();
      const realPreviewAdapter = new UnavailableDhaClaimPreviewAdapter();
      const realDischargeAdapter = new UnavailableDhaClaimDischargeAdapter();

      const submissionServiceReal = new DhaClaimSubmissionService(claimRepo, claims, access, realSubmissionAdapter);
      const previewServiceReal = new DhaClaimPreviewService(claimRepo, claims, access, realPreviewAdapter);
      const dischargeServiceReal = new DhaClaimDischargeService(claimRepo, claims, access, realDischargeAdapter);

      const claim = await createAndValidateClaim();

      // 1. Submission in REAL mode fails closed with 503
      await expect(
        submissionServiceReal.mockSubmitClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_SUBMISSION_CONTRACT_UNCONFIRMED',
      });

      // Prepare submission for preview test
      const submissionServiceMock = new DhaClaimSubmissionService(claimRepo, claims, access);
      await submissionServiceMock.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });

      // 2. Preview in REAL mode fails closed with 503
      await expect(
        previewServiceReal.mockPreviewClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_PREVIEW_CONTRACT_UNCONFIRMED',
      });

      // Prepare preview for discharge test
      const previewServiceMock = new DhaClaimPreviewService(claimRepo, claims, access);
      await previewServiceMock.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });

      // 3. Discharge in REAL mode fails closed with 503
      await expect(
        dischargeServiceReal.mockDischargeClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_DISCHARGE_CONTRACT_UNCONFIRMED',
      });

      // Assert zero external network calls made
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
