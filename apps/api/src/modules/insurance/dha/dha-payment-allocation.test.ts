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
import { PatientModel, PatientDocumentModel } from '../../patients/patient.model.js';
import { ServiceModel } from '../../services/service.model.js';
import { BillingInvoiceModel, BillingInvoiceItemModel } from '../../billing/billing.model.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { DhaMockClaimSubmissionModel } from './dha-claim-submission.model.js';
import { DhaMockClaimPreviewModel } from './dha-claim-preview.model.js';
import { DhaMockClaimDischargeModel } from './dha-claim-discharge.model.js';
import { DhaMockClaimAdjudicationModel } from './dha-claim-adjudication.model.js';
import { DhaMockClaimQueryModel } from './dha-claim-query.model.js';
import { DhaMockClaimAppealModel } from './dha-claim-appeal.model.js';
import { DhaMockRemittanceAdviceModel } from './dha-remittance-advice.model.js';
import { DhaMockPaymentAllocationModel } from './dha-payment-allocation.model.js';
import {
  MockDhaPaymentAllocationAdapter,
  UnavailableDhaPaymentAllocationAdapter,
  createDhaPaymentAllocationAdapter,
} from './dha-payment-allocation.adapter.js';
import { DhaClaimSubmissionService } from './dha-claim-submission.service.js';
import { DhaClaimPreviewService } from './dha-claim-preview.service.js';
import { DhaClaimDischargeService } from './dha-claim-discharge.service.js';
import { DhaClaimAdjudicationService } from './dha-claim-adjudication.service.js';
import { DhaRemittanceAdviceService } from './dha-remittance-advice.service.js';
import { DhaPaymentAllocationService } from './dha-payment-allocation.service.js';

describe('HMS Insurance — Phase 10.5: Mock Payer Payment Allocation Foundation', () => {
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
    await DhaMockClaimQueryModel.init();
    await DhaMockClaimAppealModel.init();
    await DhaMockRemittanceAdviceModel.init();
    await DhaMockPaymentAllocationModel.init();
    await ShaServiceMappingModel.init();
    await InsuranceAuthorizationModel.init();
    await AuditLogModel.init();

    await PatientModel.collection.insertOne({
      _id: patientId,
      patientNumber: 'P-105',
      firstName: 'Alice',
      lastName: 'Allocation',
    });
    await OpdVisitModel.collection.insertOne({
      _id: encounterId,
      patientId,
      branchId,
      doctorId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(),
      visitDate: new Date('2026-10-09'),
      patientName: 'Alice Allocation',
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
    await DhaMockClaimQueryModel.deleteMany({});
    await DhaMockClaimAppealModel.deleteMany({});
    await DhaMockRemittanceAdviceModel.deleteMany({});
    await DhaMockPaymentAllocationModel.deleteMany({});
    await InsuranceAuthorizationModel.deleteMany({});
    await ShaServiceMappingModel.deleteMany({});
    await InsuranceMemberModel.deleteMany({});
    await InsurancePolicyModel.deleteMany({});
    await BillingInvoiceModel.deleteMany({});
    await BillingInvoiceItemModel.deleteMany({});
    await OpdConsultationModel.deleteMany({});
    await AuditLogModel.deleteMany({});
    await PatientDocumentModel.deleteMany({});

    await InsurancePolicyModel.collection.insertOne({ _id: policyId, payerId, status: 'ACTIVE' });
    await InsuranceMemberModel.collection.insertOne({
      _id: memberId,
      patientId,
      policyId,
      memberNumber: 'MEM-105',
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

  /**
   * Helper to set up a claim through Submission -> Preview -> Discharge -> Adjudication -> Remittance Advice
   */
  const setupClaimWithRemittance = async () => {
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
    await submissionService.mockSubmitClaim(validated._id.toString(), {
      actorUserId: actor,
      correlationId: 'corr-sub',
    });
    const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
    await previewService.mockPreviewClaim(validated._id.toString(), {
      actorUserId: actor,
      correlationId: 'corr-prev',
    });
    const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
    await dischargeService.mockDischargeClaim(validated._id.toString(), {
      actorUserId: actor,
      correlationId: 'corr-disc',
    });
    const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
    await adjudicationService.mockAdjudicateClaim(validated._id.toString(), {
      decision: 'MOCK_APPROVED',
      actorUserId: actor,
      correlationId: 'corr-adj',
    });
    const remittanceService = new DhaRemittanceAdviceService(claimRepo, claims, access);
    const remittance = await remittanceService.mockGenerateRemittanceAdvice(validated._id.toString(), {
      actorUserId: actor,
      correlationId: 'corr-rem',
    });

    return { claim: validated, remittance };
  };

  describe('1. Adapter Unit Tests', () => {
    it('MockDhaPaymentAllocationAdapter calculates allocations deterministically with source=MOCK', async () => {
      const adapter = new MockDhaPaymentAllocationAdapter();
      expect(adapter.mode).toBe('MOCK');

      const claimId = new Types.ObjectId().toString();
      const result = await adapter.allocatePayment({
        claimId,
        remittanceAdviceId: new Types.ObjectId().toString(),
        externalRemittanceReference: 'MOCK-REM-001',
        sourceFingerprint: 'fp-alloc-01',
        currency: 'KES',
        allocatedAmount: 500,
        previouslyAllocatedTotal: 0,
        remittedTotal: 1500,
      });

      expect(result.source).toBe('MOCK');
      expect(result.externalAllocationReference).toMatch(/^MOCK-ALLOC-/);
      expect(result.currency).toBe('KES');
      expect(result.allocatedAmount).toBe(500);
      expect(result.previouslyAllocatedTotal).toBe(0);
      expect(result.newlyAllocatedTotal).toBe(500);
      expect(result.remainingAllocatableAmount).toBe(1000);
    });

    it('UnavailableDhaPaymentAllocationAdapter fails closed in REAL mode (503)', async () => {
      const adapter = new UnavailableDhaPaymentAllocationAdapter();
      expect(adapter.mode).toBe('REAL');

      await expect(
        adapter.allocatePayment(),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_PAYMENT_ALLOCATION_CONTRACT_UNCONFIRMED',
      });
    });

    it('createDhaPaymentAllocationAdapter factory respects environment configuration', () => {
      const mockAdapter = createDhaPaymentAllocationAdapter({
        integrationMode: 'MOCK',
      } as unknown as Parameters<typeof createDhaPaymentAllocationAdapter>[0]);
      expect(mockAdapter.mode).toBe('MOCK');
      expect(mockAdapter).toBeInstanceOf(MockDhaPaymentAllocationAdapter);

      const realAdapter = createDhaPaymentAllocationAdapter({
        integrationMode: 'REAL',
      } as unknown as Parameters<typeof createDhaPaymentAllocationAdapter>[0]);
      expect(realAdapter.mode).toBe('REAL');
      expect(realAdapter).toBeInstanceOf(UnavailableDhaPaymentAllocationAdapter);
    });
  });

  describe('2. Validation & Security Checks', () => {
    it('rejects invalid claimId format with 400 VALIDATION_ERROR', async () => {
      const service = new DhaPaymentAllocationService(claimRepo, access);
      await expect(
        service.mockAllocatePayment('invalid-id', new Types.ObjectId().toString(), { amount: 100 }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    });

    it('rejects invalid remittanceAdviceId format with 400 VALIDATION_ERROR', async () => {
      const service = new DhaPaymentAllocationService(claimRepo, access);
      await expect(
        service.mockAllocatePayment(new Types.ObjectId().toString(), 'invalid-rem-id', { amount: 100 }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    });

    it('rejects non-existent claim with 404 CLAIM_NOT_FOUND', async () => {
      const service = new DhaPaymentAllocationService(claimRepo, access);
      const fakeClaimId = new Types.ObjectId().toString();
      const fakeRemId = new Types.ObjectId().toString();
      await expect(
        service.mockAllocatePayment(fakeClaimId, fakeRemId, { amount: 100 }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'CLAIM_NOT_FOUND' });
    });

    it('rejects caller without branch access with 403 BRANCH_ACCESS_DENIED', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      vi.spyOn(access, 'hasBranchAccess').mockResolvedValueOnce(false);

      const service = new DhaPaymentAllocationService(claimRepo, access);
      await expect(
        service.mockAllocatePayment(claim._id.toString(), remittance.remittanceAdviceId, { amount: 100 }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });
    });

    it('rejects cancelled claim with 409 CLAIM_CANCELLED', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      await InsuranceClaimModel.updateOne({ _id: claim._id }, { $set: { status: 'CANCELLED' } });

      const service = new DhaPaymentAllocationService(claimRepo, access);
      await expect(
        service.mockAllocatePayment(claim._id.toString(), remittance.remittanceAdviceId, { amount: 100 }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CLAIM_CANCELLED' });
    });

    it('rejects non-existent remittance advice with 404 DHA_MOCK_REMITTANCE_ADVICE_NOT_FOUND', async () => {
      const { claim } = await setupClaimWithRemittance();
      const fakeRemId = new Types.ObjectId().toString();

      const service = new DhaPaymentAllocationService(claimRepo, access);
      await expect(
        service.mockAllocatePayment(claim._id.toString(), fakeRemId, { amount: 100 }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'DHA_MOCK_REMITTANCE_ADVICE_NOT_FOUND' });
    });

    it('rejects remittance advice belonging to a different claim with 409 REMITTANCE_CLAIM_MISMATCH', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const otherClaimId = new Types.ObjectId();
      await InsuranceClaimModel.collection.insertOne({
        _id: otherClaimId,
        invoiceId,
        patientId,
        branchId,
        status: 'VALIDATED',
        sourceFingerprint: claim.sourceFingerprint,
        version: 1,
      });

      const service = new DhaPaymentAllocationService(claimRepo, access);
      await expect(
        service.mockAllocatePayment(otherClaimId.toString(), remittance.remittanceAdviceId, { amount: 100 }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'REMITTANCE_CLAIM_MISMATCH' });
    });

    it('rejects allocation when underlying invoice items changed with 409 CLAIM_SOURCE_CHANGED', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();

      // Mutate invoice item behind claim's back
      await BillingInvoiceItemModel.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 2000, lineTotal: 2000 } },
      );

      const service = new DhaPaymentAllocationService(claimRepo, access);
      await expect(
        service.mockAllocatePayment(claim._id.toString(), remittance.remittanceAdviceId, { amount: 100 }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CLAIM_SOURCE_CHANGED' });
    });

    it('rejects invalid or non-positive allocation amounts with 400 INVALID_ALLOCATION_AMOUNT', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentAllocationService(claimRepo, access);

      await expect(
        service.mockAllocatePayment(claim._id.toString(), remittance.remittanceAdviceId, { amount: 0 }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_ALLOCATION_AMOUNT' });

      await expect(
        service.mockAllocatePayment(claim._id.toString(), remittance.remittanceAdviceId, { amount: -50 }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_ALLOCATION_AMOUNT' });

      await expect(
        service.mockAllocatePayment(claim._id.toString(), remittance.remittanceAdviceId, { amount: NaN }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_ALLOCATION_AMOUNT' });
    });

    it('rejects currency mismatch with 422 CURRENCY_MISMATCH', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentAllocationService(claimRepo, access);

      await expect(
        service.mockAllocatePayment(claim._id.toString(), remittance.remittanceAdviceId, { amount: 500, currency: 'USD' }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 422, code: 'CURRENCY_MISMATCH' });
    });
  });

  describe('3. Allocation Lifecycle, Over-Allocation & Concurrency', () => {
    it('successfully creates full allocation matching 100% of remittedTotal and logs audit entry', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentAllocationService(claimRepo, access);

      const res = await service.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 1500, currency: 'KES', idempotencyKey: 'alloc-full-1' },
        { actorUserId: actor, correlationId: 'corr-alloc-full' },
      );

      expect(res.success).toBe(true);
      expect(res.source).toBe('MOCK');
      expect(res.claimId).toBe(claim._id.toString());
      expect(res.remittanceAdviceId).toBe(remittance.remittanceAdviceId);
      expect(res.externalRemittanceReference).toBe(remittance.externalRemittanceReference);
      expect(res.externalAllocationReference).toMatch(/^MOCK-ALLOC-/);
      expect(res.allocatedAmount).toBe(1500);
      expect(res.previouslyAllocatedTotal).toBe(0);
      expect(res.newlyAllocatedTotal).toBe(1500);
      expect(res.remainingAllocatableAmount).toBe(0);
      expect(res.idempotent).toBe(false);

      // Verify in DB
      const persisted = await DhaMockPaymentAllocationModel.findById(res.allocationId);
      expect(persisted).not.toBeNull();
      expect(persisted!.allocatedAmount).toBe(1500);
      expect(persisted!.remainingAllocatableAmount).toBe(0);

      // Verify Audit Log
      const audit = await AuditLogModel.findOne({
        eventType: 'DHA_MOCK_PAYMENT_ALLOCATED',
      });
      expect(audit).not.toBeNull();
      expect(audit!.actorUserId).toBe(actor);
    });

    it('supports partial allocation leaving correct remaining allocatable balance', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentAllocationService(claimRepo, access);

      const res = await service.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 600, currency: 'KES' },
        { actorUserId: actor },
      );

      expect(res.success).toBe(true);
      expect(res.allocatedAmount).toBe(600);
      expect(res.previouslyAllocatedTotal).toBe(0);
      expect(res.newlyAllocatedTotal).toBe(600);
      expect(res.remainingAllocatableAmount).toBe(900); // 1500 - 600
    });

    it('supports multiple incremental partial allocations against one remittance advice', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentAllocationService(claimRepo, access);

      const first = await service.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 500, currency: 'KES', idempotencyKey: 'inc-1' },
        { actorUserId: actor },
      );
      expect(first.newlyAllocatedTotal).toBe(500);
      expect(first.remainingAllocatableAmount).toBe(1000);

      const second = await service.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 700, currency: 'KES', idempotencyKey: 'inc-2' },
        { actorUserId: actor },
      );
      expect(second.previouslyAllocatedTotal).toBe(500);
      expect(second.allocatedAmount).toBe(700);
      expect(second.newlyAllocatedTotal).toBe(1200);
      expect(second.remainingAllocatableAmount).toBe(300);

      const third = await service.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 300, currency: 'KES', idempotencyKey: 'inc-3' },
        { actorUserId: actor },
      );
      expect(third.previouslyAllocatedTotal).toBe(1200);
      expect(third.allocatedAmount).toBe(300);
      expect(third.newlyAllocatedTotal).toBe(1500);
      expect(third.remainingAllocatableAmount).toBe(0);

      // History preserved: 3 distinct allocation records
      const count = await DhaMockPaymentAllocationModel.countDocuments({
        remittanceAdviceId: remittance.remittanceAdviceId,
      });
      expect(count).toBe(3);
    });

    it('prevents over-allocation when requested amount exceeds remaining balance (422)', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentAllocationService(claimRepo, access);

      // First allocate 1000 out of 1500
      await service.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 1000, currency: 'KES' },
        { actorUserId: actor },
      );

      // Request 600 when only 500 remains
      await expect(
        service.mockAllocatePayment(
          claim._id.toString(),
          remittance.remittanceAdviceId,
          { amount: 600, currency: 'KES' },
          { actorUserId: actor },
        ),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'ALLOCATION_EXCEEDS_REMAINING_BALANCE',
      });
    });

    it('rejects additional allocations when remittance advice is already fully allocated (409)', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentAllocationService(claimRepo, access);

      // Allocate full 1500
      await service.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 1500, currency: 'KES' },
        { actorUserId: actor },
      );

      // Subsequent attempt fails with 409
      await expect(
        service.mockAllocatePayment(
          claim._id.toString(),
          remittance.remittanceAdviceId,
          { amount: 100, currency: 'KES' },
          { actorUserId: actor },
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'REMITTANCE_ALREADY_FULLY_ALLOCATED',
      });
    });

    it('handles duplicate request idempotently when idempotencyKey is supplied', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentAllocationService(claimRepo, access);

      const first = await service.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 750, currency: 'KES', idempotencyKey: 'idem-key-750' },
        { actorUserId: actor },
      );
      expect(first.idempotent).toBe(false);

      const second = await service.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 750, currency: 'KES', idempotencyKey: 'idem-key-750' },
        { actorUserId: actor },
      );
      expect(second.idempotent).toBe(true);
      expect(second.allocationId).toBe(first.allocationId);
      expect(second.externalAllocationReference).toBe(first.externalAllocationReference);
      expect(second.newlyAllocatedTotal).toBe(750);
      expect(second.remainingAllocatableAmount).toBe(750);

      // Verify only 1 record created in database
      const count = await DhaMockPaymentAllocationModel.countDocuments({
        remittanceAdviceId: remittance.remittanceAdviceId,
      });
      expect(count).toBe(1);
    });
  });

  describe('4. Safety & Invariants', () => {
    it('executes zero external network requests in MOCK mode', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentAllocationService(claimRepo, access);

      await service.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 500 },
        { actorUserId: actor },
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fails closed in REAL mode with 503 DHA_PAYMENT_ALLOCATION_CONTRACT_UNCONFIRMED', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const unavailableAdapter = new UnavailableDhaPaymentAllocationAdapter();
      const service = new DhaPaymentAllocationService(claimRepo, access, unavailableAdapter);

      await expect(
        service.mockAllocatePayment(
          claim._id.toString(),
          remittance.remittanceAdviceId,
          { amount: 500 },
          { actorUserId: actor },
        ),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_PAYMENT_ALLOCATION_CONTRACT_UNCONFIRMED',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('guarantees zero mutation to InsuranceClaim status (remains VALIDATED) and readyForShaSubmission remains false', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentAllocationService(claimRepo, access);

      await service.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 1500 },
        { actorUserId: actor },
      );

      const claimAfter = await InsuranceClaimModel.findById(claim._id);
      expect(claimAfter).not.toBeNull();
      expect(claimAfter!.status).toBe('VALIDATED');
      expect(claimAfter!.readyForShaSubmission).toBe(false);
    });

    it('guarantees zero mutation to BillingInvoice or BillingInvoiceItem totals, balances, or statuses', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();

      const invoiceBefore = await BillingInvoiceModel.findById(invoiceId);
      const itemsBefore = await BillingInvoiceItemModel.find({ invoiceId });

      const service = new DhaPaymentAllocationService(claimRepo, access);
      await service.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 1500 },
        { actorUserId: actor },
      );

      const invoiceAfter = await BillingInvoiceModel.findById(invoiceId);
      const itemsAfter = await BillingInvoiceItemModel.find({ invoiceId });

      expect(invoiceAfter!.status).toBe(invoiceBefore!.status);
      expect(invoiceAfter!.totalAmount).toBe(invoiceBefore!.totalAmount);
      expect(itemsAfter).toHaveLength(itemsBefore.length);
      for (let i = 0; i < itemsBefore.length; i++) {
        expect(itemsAfter[i].lineTotal).toBe(itemsBefore[i].lineTotal);
        expect(itemsAfter[i].unitPrice).toBe(itemsBefore[i].unitPrice);
      }
    });
  });
});
