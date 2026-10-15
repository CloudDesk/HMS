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
import { DhaMockClaimQueryModel } from './dha-claim-query.model.js';
import { DhaMockClaimAppealModel } from './dha-claim-appeal.model.js';
import { DhaMockRemittanceAdviceModel } from './dha-remittance-advice.model.js';
import { DhaMockPaymentAllocationModel } from './dha-payment-allocation.model.js';
import { DhaMockPaymentReconciliationModel } from './dha-payment-reconciliation.model.js';
import {
  MockDhaPaymentReconciliationAdapter,
  UnavailableDhaPaymentReconciliationAdapter,
  createDhaPaymentReconciliationAdapter,
} from './dha-payment-reconciliation.adapter.js';
import { DhaClaimSubmissionService } from './dha-claim-submission.service.js';
import { DhaClaimPreviewService } from './dha-claim-preview.service.js';
import { DhaClaimDischargeService } from './dha-claim-discharge.service.js';
import { DhaClaimAdjudicationService } from './dha-claim-adjudication.service.js';
import { DhaRemittanceAdviceService } from './dha-remittance-advice.service.js';
import { DhaPaymentAllocationService } from './dha-payment-allocation.service.js';
import { DhaPaymentReconciliationService } from './dha-payment-reconciliation.service.js';

describe('HMS Insurance — Phase 10.6: Mock Payer Remittance Reconciliation Foundation', () => {
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
    await DhaMockPaymentReconciliationModel.init();
    await ShaServiceMappingModel.init();
    await InsuranceAuthorizationModel.init();
    await AuditLogModel.init();

    await PatientModel.collection.insertOne({
      _id: patientId,
      patientNumber: 'P-106',
      firstName: 'Rachel',
      lastName: 'Reconcile',
    });

    await ServiceModel.collection.insertOne({
      _id: serviceId1,
      name: 'Reconciliation Consultation',
      code: 'SRV-REC-01',
      price: 1000,
      status: 'ACTIVE',
      category: 'CONSULTATION',
    });
    await ServiceModel.collection.insertOne({
      _id: serviceId2,
      name: 'Reconciliation Lab',
      code: 'SRV-REC-02',
      price: 500,
      status: 'ACTIVE',
      category: 'LAB',
    });

    await OpdVisitModel.collection.insertOne({
      _id: encounterId,
      patientId,
      branchId,
      doctorId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(),
      visitDate: new Date('2026-10-09'),
      patientName: 'Rachel Reconcile',
      status: 'COMPLETED',
      visitType: 'CONSULTATION',
    });

    await OpdConsultationModel.collection.insertOne({
      _id: new Types.ObjectId(),
      visitId: encounterId,
      patientId,
      doctorId: new Types.ObjectId(),
      diagnoses: [{ code: 'Z00.0', description: 'General Exam', isPrimary: true }],
      status: 'FINALIZED',
    });

    await InsurancePolicyModel.collection.insertOne({
      _id: policyId,
      payerId,
      name: 'Comprehensive Health Plan',
      policyNumber: 'POL-106',
      status: 'ACTIVE',
      coverageType: 'COMPREHENSIVE',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    });

    await InsuranceMemberModel.collection.insertOne({
      _id: memberId,
      patientId,
      policyId,
      memberNumber: 'MEM-106',
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
      interventionCode: 'INT-REC-01',
      effectiveFrom: '2026-01-01',
      status: 'ACTIVE',
      version: 0,
      createdBy: new Types.ObjectId(actor),
      updatedBy: new Types.ObjectId(actor),
    });
    await ShaServiceMappingModel.collection.insertOne({
      serviceId: serviceId2,
      interventionCode: 'INT-REC-02',
      effectiveFrom: '2026-01-01',
      status: 'ACTIVE',
      version: 0,
      createdBy: new Types.ObjectId(actor),
      updatedBy: new Types.ObjectId(actor),
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
    await DhaMockPaymentReconciliationModel.deleteMany({});
    await AuditLogModel.deleteMany({});

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
    it('MockDhaPaymentReconciliationAdapter reconciles deterministically with source=MOCK', async () => {
      const adapter = new MockDhaPaymentReconciliationAdapter();
      expect(adapter.mode).toBe('MOCK');

      const claimId = new Types.ObjectId().toString();
      const remittanceAdviceId = new Types.ObjectId().toString();
      const result = await adapter.reconcilePayment({
        claimId,
        remittanceAdviceId,
        externalRemittanceReference: 'MOCK-REM-001',
        sourceFingerprint: 'fp-rec-01',
        currency: 'KES',
        remittedTotal: 1500,
        allocatedTotal: 1500,
        unallocatedAmount: 0,
        allocationDifference: 0,
        allocationCount: 1,
        reconciliationStatus: 'MOCK_RECONCILED',
        snapshotFingerprint: 'snap-001',
        correlationId: 'corr-001',
      });

      expect(result.source).toBe('MOCK');
      expect(result.externalReconciliationReference).toMatch(/^MOCK-REC-/);
      expect(result.currency).toBe('KES');
      expect(result.status).toBe('MOCK_RECONCILED');
      expect(result.remittedTotal).toBe(1500);
      expect(result.allocatedTotal).toBe(1500);
      expect(result.unallocatedAmount).toBe(0);
      expect(result.allocationDifference).toBe(0);
      expect(result.allocationCount).toBe(1);
    });

    it('UnavailableDhaPaymentReconciliationAdapter fails closed in REAL mode (503)', async () => {
      const adapter = new UnavailableDhaPaymentReconciliationAdapter();
      expect(adapter.mode).toBe('REAL');

      await expect(
        adapter.reconcilePayment({
          claimId: new Types.ObjectId().toString(),
          remittanceAdviceId: new Types.ObjectId().toString(),
          externalRemittanceReference: 'MOCK-REM-001',
          sourceFingerprint: 'fp-rec-01',
          currency: 'KES',
          remittedTotal: 1500,
          allocatedTotal: 1500,
          unallocatedAmount: 0,
          allocationDifference: 0,
          allocationCount: 1,
          reconciliationStatus: 'MOCK_RECONCILED',
          snapshotFingerprint: 'snap-001',
          correlationId: 'corr-001',
        }),
      ).rejects.toThrow('Real DHA payment remittance reconciliation is unconfirmed');
    });

    it('createDhaPaymentReconciliationAdapter returns expected adapter according to mode', () => {
      const mockAdapter = createDhaPaymentReconciliationAdapter('MOCK');
      expect(mockAdapter.mode).toBe('MOCK');

      const realAdapter = createDhaPaymentReconciliationAdapter('REAL');
      expect(realAdapter.mode).toBe('REAL');
    });
  });

  describe('2. Precondition & Security Validations', () => {
    it('rejects invalid claim or remittance IDs with 400 VALIDATION_ERROR', async () => {
      const service = new DhaPaymentReconciliationService(claimRepo, access);

      await expect(
        service.mockReconcilePayment('invalid-id', new Types.ObjectId().toString()),
      ).rejects.toThrow('Invalid claim ID format');

      await expect(
        service.mockReconcilePayment(new Types.ObjectId().toString(), 'invalid-rem-id'),
      ).rejects.toThrow('Invalid remittance advice ID format');
    });

    it('rejects non-existent claim with 404 CLAIM_NOT_FOUND', async () => {
      const service = new DhaPaymentReconciliationService(claimRepo, access);
      await expect(
        service.mockReconcilePayment(
          new Types.ObjectId().toString(),
          new Types.ObjectId().toString(),
        ),
      ).rejects.toThrow('Insurance claim not found');
    });

    it('rejects caller without branch access with 403 BRANCH_ACCESS_DENIED', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      vi.spyOn(access, 'hasBranchAccess').mockResolvedValueOnce(false);

      const service = new DhaPaymentReconciliationService(claimRepo, access);
      await expect(
        service.mockReconcilePayment(claim._id.toString(), remittance.remittanceAdviceId, undefined, {
          actorUserId: 'unauthorized-user',
        }),
      ).rejects.toThrow('Branch access denied');
    });

    it('rejects cancelled claim with 409 CLAIM_CANCELLED', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      await InsuranceClaimModel.updateOne(
        { _id: claim._id },
        { status: 'CANCELLED' },
      );

      const service = new DhaPaymentReconciliationService(claimRepo, access);
      await expect(
        service.mockReconcilePayment(claim._id.toString(), remittance.remittanceAdviceId),
      ).rejects.toThrow('Cannot reconcile remittance for a cancelled claim');
    });

    it('rejects non-existent remittance advice with 404 DHA_MOCK_REMITTANCE_ADVICE_NOT_FOUND', async () => {
      const { claim } = await setupClaimWithRemittance();
      const service = new DhaPaymentReconciliationService(claimRepo, access);

      await expect(
        service.mockReconcilePayment(claim._id.toString(), new Types.ObjectId().toString()),
      ).rejects.toThrow('Completed Phase 10.4 remittance advice record not found');
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

      const service = new DhaPaymentReconciliationService(claimRepo, access);
      await expect(
        service.mockReconcilePayment(otherClaimId.toString(), remittance.remittanceAdviceId),
      ).rejects.toThrow('Remittance advice does not belong to this claim');
    });


    it('rejects remittance advice with stale source fingerprint with 409 REMITTANCE_STALE_FINGERPRINT', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      await DhaMockRemittanceAdviceModel.updateOne(
        { _id: new Types.ObjectId(remittance.remittanceAdviceId) },
        { sourceFingerprint: 'tampered-fingerprint' },
      );

      const service = new DhaPaymentReconciliationService(claimRepo, access);
      await expect(
        service.mockReconcilePayment(claim._id.toString(), remittance.remittanceAdviceId),
      ).rejects.toThrow('Remittance advice source fingerprint does not match claim');
    });

    it('rejects reconciliation when underlying invoice items changed with 409 CLAIM_SOURCE_CHANGED', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      await BillingInvoiceItemModel.collection.insertOne({
        _id: new Types.ObjectId(),
        invoiceId,
        serviceId: serviceId1,
        quantity: 1,
        unitPrice: 200,
        lineTotal: 200,
      });

      const service = new DhaPaymentReconciliationService(claimRepo, access);
      await expect(
        service.mockReconcilePayment(claim._id.toString(), remittance.remittanceAdviceId),
      ).rejects.toThrow('Underlying invoice has changed since claim creation');

      // Cleanup extra item
      await BillingInvoiceItemModel.deleteOne({ unitPrice: 200 });
    });
  });

  describe('3. Allocation Invariant Validations', () => {
    it('rejects allocation belonging to a different claim with 409 ALLOCATION_CLAIM_MISMATCH', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const allocationService = new DhaPaymentAllocationService(claimRepo, access);
      const alloc = await allocationService.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 500 },
      );

      // Tamper allocation to have a mismatched claimId
      await DhaMockPaymentAllocationModel.updateOne(
        { _id: new Types.ObjectId(alloc.allocationId) },
        { claimId: new Types.ObjectId() },
      );

      const service = new DhaPaymentReconciliationService(claimRepo, access);
      await expect(
        service.mockReconcilePayment(claim._id.toString(), remittance.remittanceAdviceId),
      ).rejects.toThrow('Allocation record does not belong to this claim');
    });

    it('rejects allocation with currency mismatch with 422 CURRENCY_MISMATCH', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const allocationService = new DhaPaymentAllocationService(claimRepo, access);
      const alloc = await allocationService.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 500 },
      );

      // Tamper allocation currency
      await DhaMockPaymentAllocationModel.updateOne(
        { _id: new Types.ObjectId(alloc.allocationId) },
        { currency: 'USD' },
      );

      const service = new DhaPaymentReconciliationService(claimRepo, access);
      await expect(
        service.mockReconcilePayment(claim._id.toString(), remittance.remittanceAdviceId),
      ).rejects.toThrow('Allocation currency does not match remittance advice currency');
    });

    it('rejects allocation with invalid non-positive allocated amount with 422 INVALID_ALLOCATION_DATA', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const allocationService = new DhaPaymentAllocationService(claimRepo, access);
      const alloc = await allocationService.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 500 },
      );

      // Tamper allocation amount to 0
      await DhaMockPaymentAllocationModel.updateOne(
        { _id: new Types.ObjectId(alloc.allocationId) },
        { allocatedAmount: 0 },
      );

      const service = new DhaPaymentReconciliationService(claimRepo, access);
      await expect(
        service.mockReconcilePayment(claim._id.toString(), remittance.remittanceAdviceId),
      ).rejects.toThrow('Allocation record has invalid non-positive allocated amount');
    });
  });

  describe('4. Reconciliation Calculations & Statuses', () => {
    it('produces MOCK_PARTIALLY_RECONCILED when no allocations exist yet', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentReconciliationService(claimRepo, access);

      const result = await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        undefined,
        { actorUserId: actor, correlationId: 'corr-rec-0' },
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('MOCK');
      expect(result.status).toBe('MOCK_PARTIALLY_RECONCILED');
      expect(result.remittedTotal).toBe(1500);
      expect(result.allocatedTotal).toBe(0);
      expect(result.unallocatedAmount).toBe(1500);
      expect(result.allocationDifference).toBe(0);
      expect(result.allocationCount).toBe(0);
      expect(result.allocationIds).toEqual([]);
      expect(result.idempotent).toBe(false);
      expect(result.externalReconciliationReference).toMatch(/^MOCK-REC-/);
    });

    it('produces MOCK_PARTIALLY_RECONCILED when partially allocated', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const allocationService = new DhaPaymentAllocationService(claimRepo, access);
      const alloc = await allocationService.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 500 },
        { actorUserId: actor },
      );

      const service = new DhaPaymentReconciliationService(claimRepo, access);
      const result = await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        undefined,
        { actorUserId: actor, correlationId: 'corr-rec-part' },
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('MOCK_PARTIALLY_RECONCILED');
      expect(result.remittedTotal).toBe(1500);
      expect(result.allocatedTotal).toBe(500);
      expect(result.unallocatedAmount).toBe(1000);
      expect(result.allocationDifference).toBe(0);
      expect(result.allocationCount).toBe(1);
      expect(result.allocationIds).toEqual([alloc.allocationId]);
    });

    it('produces MOCK_RECONCILED when 100% of remittance is allocated', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const allocationService = new DhaPaymentAllocationService(claimRepo, access);

      // Allocate full 1500 in two steps: 1000 + 500
      const alloc1 = await allocationService.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 1000 },
        { actorUserId: actor },
      );
      const alloc2 = await allocationService.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 500 },
        { actorUserId: actor },
      );

      const service = new DhaPaymentReconciliationService(claimRepo, access);
      const result = await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        undefined,
        { actorUserId: actor, correlationId: 'corr-rec-full' },
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('MOCK_RECONCILED');
      expect(result.remittedTotal).toBe(1500);
      expect(result.allocatedTotal).toBe(1500);
      expect(result.unallocatedAmount).toBe(0);
      expect(result.allocationDifference).toBe(0);
      expect(result.allocationCount).toBe(2);
      expect(result.allocationIds).toEqual([alloc1.allocationId, alloc2.allocationId]);
      expect(result.discrepancyReasons).toBeUndefined();
    });

    it('produces MOCK_DISCREPANCY when over-allocated (allocatedTotal > remittedTotal)', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const allocationService = new DhaPaymentAllocationService(claimRepo, access);

      // Insert allocation doc with amount higher than remittedTotal
      const alloc = await allocationService.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 1000 },
        { actorUserId: actor },
      );
      // Simulate database over-allocation state
      await DhaMockPaymentAllocationModel.updateOne(
        { _id: new Types.ObjectId(alloc.allocationId) },
        { allocatedAmount: 2000 },
      );

      const service = new DhaPaymentReconciliationService(claimRepo, access);
      const result = await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        undefined,
        { actorUserId: actor, correlationId: 'corr-rec-disc' },
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('MOCK_DISCREPANCY');
      expect(result.remittedTotal).toBe(1500);
      expect(result.allocatedTotal).toBe(2000);
      expect(result.unallocatedAmount).toBe(0);
      expect(result.allocationDifference).toBe(500);
      expect(result.discrepancyReasons).toBeDefined();
      expect(result.discrepancyReasons?.[0]).toContain('exceeds remitted total (1500) by 500');
    });

    it('produces MOCK_DISCREPANCY when allocation lines sum differs from allocatedAmount', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const allocationService = new DhaPaymentAllocationService(claimRepo, access);

      const alloc = await allocationService.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 1000 },
        { actorUserId: actor },
      );

      // Tamper lines to have a sum different from allocatedAmount
      await DhaMockPaymentAllocationModel.updateOne(
        { _id: new Types.ObjectId(alloc.allocationId) },
        {
          lines: [
            {
              invoiceItemId: invoiceItemId1,
              serviceId: serviceId1,
              claimedAmount: 1000,
              remittedAmount: 1000,
              allocatedAmount: 800, // Line sum 800 != doc allocatedAmount 1000
            },
          ],
        },
      );

      const service = new DhaPaymentReconciliationService(claimRepo, access);
      const result = await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
      );

      expect(result.status).toBe('MOCK_DISCREPANCY');
      expect(result.discrepancyReasons).toBeDefined();
      expect(result.discrepancyReasons?.[0]).toContain('line total (800) does not match allocatedAmount (1000)');
    });
  });

  describe('5. Idempotency, Snapshots & History Preservation', () => {
    it('returns existing record with idempotent=true when repeated for the same unchanged source snapshot', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const allocationService = new DhaPaymentAllocationService(claimRepo, access);
      await allocationService.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 700 },
      );

      const service = new DhaPaymentReconciliationService(claimRepo, access);
      const first = await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
      );
      expect(first.idempotent).toBe(false);

      const second = await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
      );
      expect(second.idempotent).toBe(true);
      expect(second.reconciliationId).toBe(first.reconciliationId);
      expect(second.externalReconciliationReference).toBe(first.externalReconciliationReference);
      expect(second.snapshotFingerprint).toBe(first.snapshotFingerprint);

      // Verify no duplicate document was inserted
      const count = await DhaMockPaymentReconciliationModel.countDocuments({
        claimId: claim._id,
        remittanceAdviceId: remittance.remittanceAdviceId,
      });
      expect(count).toBe(1);
    });

    it('returns existing record with idempotent=true when matching idempotencyKey is supplied', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentReconciliationService(claimRepo, access);

      const first = await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { idempotencyKey: 'rec-key-106' },
      );
      expect(first.idempotent).toBe(false);

      const second = await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { idempotencyKey: 'rec-key-106' },
      );
      expect(second.idempotent).toBe(true);
      expect(second.reconciliationId).toBe(first.reconciliationId);
    });

    it('creates a new snapshot when allocations change, preserving historical snapshot records', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const allocationService = new DhaPaymentAllocationService(claimRepo, access);
      const service = new DhaPaymentReconciliationService(claimRepo, access);

      // Snapshot 1: 0 allocations
      const snap1 = await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
      );
      expect(snap1.status).toBe('MOCK_PARTIALLY_RECONCILED');
      expect(snap1.allocatedTotal).toBe(0);

      // Add first partial allocation
      await allocationService.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 600 },
      );

      // Snapshot 2: 1 allocation
      const snap2 = await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
      );
      expect(snap2.status).toBe('MOCK_PARTIALLY_RECONCILED');
      expect(snap2.allocatedTotal).toBe(600);
      expect(snap2.snapshotFingerprint).not.toBe(snap1.snapshotFingerprint);
      expect(snap2.reconciliationId).not.toBe(snap1.reconciliationId);

      // Add second allocation completing 1500
      await allocationService.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 900 },
      );

      // Snapshot 3: full allocation
      const snap3 = await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
      );
      expect(snap3.status).toBe('MOCK_RECONCILED');
      expect(snap3.allocatedTotal).toBe(1500);
      expect(snap3.snapshotFingerprint).not.toBe(snap2.snapshotFingerprint);

      // Verify all 3 historical snapshots are preserved
      const history = await service.getReconciliations(
        claim._id.toString(),
        remittance.remittanceAdviceId,
      );
      expect(history.length).toBe(3);
      expect(history[0]?.allocatedTotal).toBe(0);
      expect(history[1]?.allocatedTotal).toBe(600);
      expect(history[2]?.allocatedTotal).toBe(1500);
      expect(history[2]?.status).toBe('MOCK_RECONCILED');
    });
  });

  describe('6. Security, Safety Invariants & REAL Mode Guard', () => {
    it('executes zero external network requests in MOCK mode', async () => {
      global.fetch = mockFetch;
      mockFetch.mockReset();

      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentReconciliationService(claimRepo, access);

      await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
      );

      expect(mockFetch).not.toHaveBeenCalled();
      global.fetch = originalFetch;
    });

    it('fails closed in REAL mode with 503 DHA_PAYMENT_RECONCILIATION_CONTRACT_UNCONFIRMED', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const realAdapter = new UnavailableDhaPaymentReconciliationAdapter();
      const service = new DhaPaymentReconciliationService(claimRepo, access, realAdapter);

      await expect(
        service.mockReconcilePayment(claim._id.toString(), remittance.remittanceAdviceId),
      ).rejects.toThrow('Real DHA payment remittance reconciliation is unconfirmed');
    });

    it('records DHA_MOCK_REMITTANCE_RECONCILED audit log', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentReconciliationService(claimRepo, access);

      await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        undefined,
        { actorUserId: actor, correlationId: 'audit-test-corr' },
      );


      const audit = await AuditLogModel.findOne({
        eventType: 'DHA_MOCK_REMITTANCE_RECONCILED',
        actorUserId: actor,
      }).lean();

      expect(audit).not.toBeNull();
      expect(audit?.actorUserId).toBe(actor);
      const metadata = audit?.metadataJson as Record<string, unknown> | undefined;
      expect(metadata?.status).toBe('MOCK_PARTIALLY_RECONCILED');
      expect(metadata?.remittedTotal).toBe(1500);
      expect(metadata?.unallocatedAmount).toBe(1500);
    });


    it('guarantees zero mutation to InsuranceClaim status (remains VALIDATED) and readyForShaSubmission remains false', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentReconciliationService(claimRepo, access);

      await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
      );

      const after = await InsuranceClaimModel.findById(claim._id).lean();
      expect(after?.status).toBe('VALIDATED');
      expect(after?.readyForShaSubmission).toBe(false);
    });

    it('guarantees zero mutation to BillingInvoice or BillingInvoiceItem totals, balances, or statuses', async () => {
      const { claim, remittance } = await setupClaimWithRemittance();
      const service = new DhaPaymentReconciliationService(claimRepo, access);

      const invoiceBefore = await BillingInvoiceModel.findById(invoiceId).lean();
      const itemsBefore = await BillingInvoiceItemModel.find({ invoiceId }).lean();

      await service.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
      );

      const invoiceAfter = await BillingInvoiceModel.findById(invoiceId).lean();
      const itemsAfter = await BillingInvoiceItemModel.find({ invoiceId }).lean();

      expect(invoiceAfter?.totalAmount).toBe(invoiceBefore?.totalAmount);
      expect(invoiceAfter?.status).toBe(invoiceBefore?.status);
      expect(itemsAfter.length).toBe(itemsBefore.length);
      expect(itemsAfter[0]?.lineTotal).toBe(itemsBefore[0]?.lineTotal);
    });
  });
});
