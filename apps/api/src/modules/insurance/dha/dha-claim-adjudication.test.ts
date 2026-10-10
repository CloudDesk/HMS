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
import { DhaMockClaimAdjudicationModel } from './dha-claim-adjudication.model.js';
import {
  type DhaClaimAdjudicationRequest,
  MockDhaClaimAdjudicationAdapter,
  UnavailableDhaClaimAdjudicationAdapter,
  createDhaClaimAdjudicationAdapter,
} from './dha-claim-adjudication.adapter.js';
import { DhaClaimSubmissionService } from './dha-claim-submission.service.js';
import { DhaClaimPreviewService } from './dha-claim-preview.service.js';
import { DhaClaimDischargeService } from './dha-claim-discharge.service.js';
import { DhaClaimAdjudicationService } from './dha-claim-adjudication.service.js';

describe('HMS Insurance — Phase 10.1: Mock DHA Claim Adjudication Foundation', () => {
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
    await DhaMockClaimAdjudicationModel.init();
    await ShaServiceMappingModel.init();
    await InsuranceAuthorizationModel.init();
    await AuditLogModel.init();

    await PatientModel.collection.insertOne({
      _id: patientId,
      patientNumber: 'P-101',
      firstName: 'Charlie',
      lastName: 'Adjudication',
    });
    await OpdVisitModel.collection.insertOne({
      _id: encounterId,
      patientId,
      branchId,
      doctorId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(),
      visitDate: new Date('2026-10-09'),
      patientName: 'Charlie Adjudication',
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
    await DhaMockClaimAdjudicationModel.deleteMany({});
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
      memberNumber: 'MEM-101',
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

  const setupDischargedClaim = async () => {
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
    const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
    const discharge = await dischargeService.mockDischargeClaim(validated._id.toString(), {
      actorUserId: actor,
      correlationId: 'corr-init-disc',
    });
    return { claim: validated, submission, preview, discharge };
  };

  describe('1. Adapter Unit Tests', () => {
    it('MockDhaClaimAdjudicationAdapter produces deterministic synthetic references with source=MOCK', async () => {
      const adapter = new MockDhaClaimAdjudicationAdapter();
      expect(adapter.mode).toBe('MOCK');

      const claimId = new Types.ObjectId().toString();
      const result = await adapter.adjudicateClaim({
        claimId,
        sourceFingerprint: 'dummy-fp',
        mockDischargeReference: 'MOCK-DISCHARGE-TEST',
        claimedTotal: 1500,
        lines: [
          {
            invoiceItemId: new Types.ObjectId().toString(),
            serviceId: new Types.ObjectId().toString(),
            serviceCode: 'SRV-01',
            quantity: 1,
            claimedAmount: 1000,
          },
        ],
        decision: 'MOCK_APPROVED',
        correlationId: 'test-corr',
        version: 0,
      });

      expect(result.source).toBe('MOCK');
      expect(result.status).toBe('MOCK_APPROVED');
      expect(result.externalAdjudicationReference).toMatch(/^MOCK-ADJUDICATION-[A-Z\d]{8}-[A-Z\d]{8}$/);
      expect(result.adjudicatedTotal).toBe(1000);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('UnavailableDhaClaimAdjudicationAdapter fails closed in REAL mode (503)', async () => {
      const adapter = new UnavailableDhaClaimAdjudicationAdapter();
      expect(adapter.mode).toBe('REAL');

      await expect(
        adapter.adjudicateClaim({} as unknown as DhaClaimAdjudicationRequest),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_ADJUDICATION_CONTRACT_UNCONFIRMED',
      });
    });

    it('createDhaClaimAdjudicationAdapter respects DHA_INTEGRATION_MODE', () => {
      const mockAdapter = createDhaClaimAdjudicationAdapter({
        integrationMode: 'MOCK',
      } as unknown as Parameters<typeof createDhaClaimAdjudicationAdapter>[0]);
      expect(mockAdapter.mode).toBe('MOCK');

      const realAdapter = createDhaClaimAdjudicationAdapter({
        integrationMode: 'REAL',
      } as unknown as Parameters<typeof createDhaClaimAdjudicationAdapter>[0]);
      expect(realAdapter.mode).toBe('REAL');
    });
  });

  describe('2. Precondition Validation & Error Scenarios', () => {
    it('1. Invalid claim ID format is rejected (400)', async () => {
      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await expect(
        adjudicationService.mockAdjudicateClaim('invalid-id', { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('2. Missing claim is rejected (404)', async () => {
      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      const nonExistentId = new Types.ObjectId().toString();
      await expect(
        adjudicationService.mockAdjudicateClaim(nonExistentId, { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'CLAIM_NOT_FOUND',
      });
    });

    it('3. Branch-access denial returns 403', async () => {
      const { claim } = await setupDischargedClaim();
      vi.spyOn(access, 'hasBranchAccess').mockResolvedValue(false);

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await expect(
        adjudicationService.mockAdjudicateClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'BRANCH_ACCESS_DENIED',
      });
    });

    it('Cancelled claim is rejected (409)', async () => {
      const { claim } = await setupDischargedClaim();
      await InsuranceClaimModel.updateOne({ _id: claim._id }, { $set: { status: 'CANCELLED' } });

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await expect(
        adjudicationService.mockAdjudicateClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CLAIM_CANCELLED',
      });
    });

    it('4. Missing discharge record is rejected (404)', async () => {
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

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await expect(
        adjudicationService.mockAdjudicateClaim(validated._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DHA_MOCK_DISCHARGE_NOT_FOUND',
      });
    });

    it('5. Discharge belonging to another claim is rejected (404/409)', async () => {
      const { claim } = await setupDischargedClaim();
      const otherClaimId = new Types.ObjectId();

      await DhaMockClaimDischargeModel.updateOne(
        { claimId: claim._id },
        { $set: { claimId: otherClaimId } },
      );

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await expect(
        adjudicationService.mockAdjudicateClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DHA_MOCK_DISCHARGE_NOT_FOUND',
      });
    });

    it('6. Stale source fingerprint on discharge is rejected (409)', async () => {
      const { claim } = await setupDischargedClaim();

      await DhaMockClaimDischargeModel.updateOne(
        { claimId: claim._id },
        { $set: { sourceFingerprint: 'outdated-fp' } },
      );

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await expect(
        adjudicationService.mockAdjudicateClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'STALE_MOCK_DISCHARGE',
      });
    });

    it('7. Changed underlying invoice source is rejected (409)', async () => {
      const { claim } = await setupDischargedClaim();

      await BillingInvoiceItemModel.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 750, lineTotal: 1500 } },
      );

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await expect(
        adjudicationService.mockAdjudicateClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CLAIM_SOURCE_CHANGED',
      });
    });

    it('Internal validation blocker prevents adjudication (422)', async () => {
      const { claim } = await setupDischargedClaim();

      await ShaServiceMappingModel.updateOne(
        { serviceId: serviceId1 },
        { $set: { status: 'INACTIVE' } },
      );

      // Force draft status to trigger re-validation with blocker
      await InsuranceClaimModel.updateOne(
        { _id: claim._id },
        { $set: { status: 'DRAFT' } },
      );

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await expect(
        adjudicationService.mockAdjudicateClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'CLAIM_NOT_READY_FOR_ADJUDICATION',
      });
    });
  });

  describe('3. Successful Mock Adjudication & Supported Outcomes', () => {
    it('8. Successful mock adjudication with default decision (MOCK_APPROVED) and audit log', async () => {
      const { claim, discharge } = await setupDischargedClaim();
      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);

      const result = await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-adj-01',
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('MOCK');
      expect(result.status).toBe('MOCK_APPROVED');
      expect(result.claimId).toBe(claim._id.toString());
      expect(result.mockDischargeReference).toBe(discharge.externalDischargeReference);
      expect(result.externalAdjudicationReference).toMatch(/^MOCK-ADJUDICATION-[A-Z\d]{8}-[A-Z\d]{8}$/);
      expect(result.claimedTotal).toBe(1500);
      expect(result.adjudicatedTotal).toBe(1500);
      expect(result.lines).toHaveLength(2);
      expect(result.lines[0].status).toBe('APPROVED');
      expect(result.lines[1].status).toBe('APPROVED');
      expect(result.idempotent).toBe(false);

      // Verify persistence
      const doc = await DhaMockClaimAdjudicationModel.findOne({ claimId: claim._id });
      expect(doc).not.toBeNull();
      expect(doc?.sourceFingerprint).toBe(claim.sourceFingerprint);
      expect(doc?.status).toBe('MOCK_APPROVED');
      expect(doc?.adjudicatedTotal).toBe(1500);

      // Verify audit log
      const audit = await AuditLogModel.findOne({ eventType: 'DHA_MOCK_CLAIM_ADJUDICATED' });
      expect(audit).not.toBeNull();
      expect(audit?.actorUserId).toBe(actor);
    });

    it('9. Each supported mock outcome generates consistent synthetic data', async () => {
      const { claim } = await setupDischargedClaim();
      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      const outcomes = [
        'MOCK_PARTIALLY_APPROVED',
        'MOCK_REJECTED',
        'MOCK_PENDING',
        'MOCK_QUERY',
      ] as const;

      for (const outcome of outcomes) {
        await DhaMockClaimAdjudicationModel.deleteMany({});

        const result = await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
          decision: outcome,
          actorUserId: actor,
          correlationId: `corr-outcome-${outcome}`,
        });

        expect(result.status).toBe(outcome);
        expect(result.source).toBe('MOCK');

        if (outcome === 'MOCK_PARTIALLY_APPROVED') {
          expect(result.adjudicatedTotal).toBeGreaterThan(0);
          expect(result.adjudicatedTotal).toBeLessThan(result.claimedTotal);
        } else if (outcome === 'MOCK_REJECTED' || outcome === 'MOCK_PENDING' || outcome === 'MOCK_QUERY') {
          expect(result.adjudicatedTotal).toBe(0);
          expect(result.lines.every((l) => l.status === 'REJECTED')).toBe(true);
        }
      }
    });

    it('10. Repeated adjudication request is idempotent', async () => {
      const { claim } = await setupDischargedClaim();
      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);

      const first = await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        decision: 'MOCK_APPROVED',
        actorUserId: actor,
        correlationId: 'corr-idemp',
      });
      expect(first.idempotent).toBe(false);

      const second = await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        decision: 'MOCK_APPROVED',
        actorUserId: actor,
        correlationId: 'corr-idemp-2',
      });
      expect(second.idempotent).toBe(true);
      expect(second.externalAdjudicationReference).toBe(first.externalAdjudicationReference);
      expect(second.status).toBe(first.status);

      const count = await DhaMockClaimAdjudicationModel.countDocuments({ claimId: claim._id });
      expect(count).toBe(1);
    });

    it('11. Historical record preservation: Changed claim requires new sequence without deleting history', async () => {
      const { claim } = await setupDischargedClaim();
      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);

      const firstAdj = await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        actorUserId: actor,
      });
      expect(firstAdj.idempotent).toBe(false);

      // Modify invoice
      await BillingInvoiceItemModel.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 1500, lineTotal: 1500 } },
      );
      await BillingInvoiceModel.updateOne(
        { _id: invoiceId },
        { $set: { totalAmount: 2000 } },
      );

      // Update claim to match new fingerprint
      const newSource = await claimRepo.source(invoiceId.toString());
      const updatedClaim = await InsuranceClaimModel.findOneAndUpdate(
        { _id: claim._id },
        { $set: { claimedTotal: 2000, sourceFingerprint: newSource.fingerprint } },
        { returnDocument: 'after' },
      ).lean();

      // Revalidate claim
      await claims.validate(claim._id.toString(), updatedClaim!.version, actor, {
        ipAddress: '127.0.0.1',
      });

      // Run new submission, preview, and discharge
      const subService = new DhaClaimSubmissionService(claimRepo, claims, access);
      await subService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      const prevService = new DhaClaimPreviewService(claimRepo, claims, access);
      await prevService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      const discService = new DhaClaimDischargeService(claimRepo, claims, access);
      await discService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor });

      // Run adjudication for updated claim
      const secondAdj = await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        actorUserId: actor,
      });
      expect(secondAdj.idempotent).toBe(false);
      expect(secondAdj.externalAdjudicationReference).not.toBe(firstAdj.externalAdjudicationReference);

      // History preserved: 2 records exist in database
      const totalAdjudications = await DhaMockClaimAdjudicationModel.countDocuments({
        claimId: claim._id,
      });
      expect(totalAdjudications).toBe(2);
    });
  });

  describe('4. Safety Invariants & REAL Mode Fail-Closed', () => {
    it('12. REAL mode fails closed (503) without network calls', async () => {
      const { claim } = await setupDischargedClaim();
      const unavailableAdapter = new UnavailableDhaClaimAdjudicationAdapter();
      const adjudicationService = new DhaClaimAdjudicationService(
        claimRepo,
        claims,
        access,
        unavailableAdapter,
      );

      await expect(
        adjudicationService.mockAdjudicateClaim(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_ADJUDICATION_CONTRACT_UNCONFIRMED',
      });

      expect(mockFetch).not.toHaveBeenCalled();
      const count = await DhaMockClaimAdjudicationModel.countDocuments();
      expect(count).toBe(0);
    });

    it('13. No claim-status, invoice, payment, or financial-ledger mutation', async () => {
      const invoiceBefore = await BillingInvoiceModel.findById(invoiceId).lean();
      const itemsBefore = await BillingInvoiceItemModel.find({ invoiceId }).sort({ _id: 1 }).lean();

      const { claim } = await setupDischargedClaim();
      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);

      await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        decision: 'MOCK_APPROVED',
        actorUserId: actor,
      });

      const claimAfter = await InsuranceClaimModel.findById(claim._id).lean();
      expect(claimAfter?.status).toBe('VALIDATED');
      expect(claimAfter?.readyForShaSubmission).toBe(false);

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

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
