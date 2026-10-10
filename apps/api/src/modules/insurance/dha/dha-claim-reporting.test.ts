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
import {
  BillingInvoiceModel,
  BillingInvoiceItemModel,
  BillingPaymentModel,
} from '../../billing/billing.model.js';
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
import { DhaMockClaimClosureModel } from './dha-claim-closure.model.js';
import { DhaClaimSubmissionService } from './dha-claim-submission.service.js';
import { DhaClaimPreviewService } from './dha-claim-preview.service.js';
import { DhaClaimDischargeService } from './dha-claim-discharge.service.js';
import { DhaClaimAdjudicationService } from './dha-claim-adjudication.service.js';
import { DhaClaimQueryService } from './dha-claim-query.service.js';
import { DhaRemittanceAdviceService } from './dha-remittance-advice.service.js';
import { DhaPaymentAllocationService } from './dha-payment-allocation.service.js';
import { DhaPaymentReconciliationService } from './dha-payment-reconciliation.service.js';
import { DhaClaimClosureService } from './dha-claim-closure.service.js';
import { DhaClaimReportingService } from './dha-claim-reporting.service.js';

describe('HMS Insurance — Phase 10.8: Insurance Reporting, Audit Views & End-to-End Regression', () => {
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
  const invoiceId1 = new Types.ObjectId();
  const invoiceId2 = new Types.ObjectId();
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
    await DhaMockClaimClosureModel.init();
    await ShaServiceMappingModel.init();
    await InsuranceAuthorizationModel.init();
    await AuditLogModel.init();

    await PatientModel.collection.insertOne({
      _id: patientId,
      patientNumber: 'P-108',
      firstName: 'Rory',
      lastName: 'Report',
    });

    await ServiceModel.collection.insertOne({
      _id: serviceId1,
      name: 'Report Consultation',
      code: 'SRV-REP-01',
      price: 1000,
      status: 'ACTIVE',
      category: 'CONSULTATION',
    });
    await ServiceModel.collection.insertOne({
      _id: serviceId2,
      name: 'Report Lab',
      code: 'SRV-REP-02',
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
      patientName: 'Rory Report',
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
      name: 'Reporting Health Plan',
      policyNumber: 'POL-108',
      status: 'ACTIVE',
      coverageType: 'COMPREHENSIVE',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    });

    await InsuranceMemberModel.collection.insertOne({
      _id: memberId,
      patientId,
      policyId,
      memberNumber: 'MEM-108',
      status: 'ACTIVE',
      coverageStart: new Date('2026-01-01'),
    });

    await BillingInvoiceModel.collection.insertOne({
      _id: invoiceId1,
      invoiceNumber: 'INV-108-1',
      visitId: encounterId,
      patientId,
      branchId,
      sourceType: 'OPD',
      status: 'PENDING',
      totalAmount: 1500,
    });
    await BillingInvoiceItemModel.collection.insertOne({
      _id: invoiceItemId1,
      invoiceId: invoiceId1,
      serviceId: serviceId1,
      quantity: 1,
      unitPrice: 1000,
      lineTotal: 1000,
    });
    await BillingInvoiceItemModel.collection.insertOne({
      _id: invoiceItemId2,
      invoiceId: invoiceId1,
      serviceId: serviceId2,
      quantity: 1,
      unitPrice: 500,
      lineTotal: 500,
    });

    await BillingInvoiceModel.collection.insertOne({
      _id: invoiceId2,
      invoiceNumber: 'INV-108-2',
      visitId: encounterId,
      patientId,
      branchId,
      sourceType: 'OPD',
      status: 'PENDING',
      totalAmount: 1000,
    });

    await ShaServiceMappingModel.collection.insertOne({
      serviceId: serviceId1,
      interventionCode: 'INT-REP-01',
      effectiveFrom: '2026-01-01',
      status: 'ACTIVE',
      version: 0,
      createdBy: new Types.ObjectId(actor),
      updatedBy: new Types.ObjectId(actor),
    });
    await ShaServiceMappingModel.collection.insertOne({
      serviceId: serviceId2,
      interventionCode: 'INT-REP-02',
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
    await DhaMockClaimClosureModel.deleteMany({});
    await BillingPaymentModel.deleteMany({});
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
   * Helper to set up a fully closed reconciled claim
   */
  const setupClosedReconciledClaim = async () => {
    const created = await claims.create(
      { invoiceId: invoiceId1.toString(), memberId: memberId.toString() },
      actor,
      { ipAddress: '127.0.0.1' },
    );
    const validated = await claims.validate(
      created._id.toString(),
      created.version,
      actor,
      { ipAddress: '127.0.0.1' },
    );

    const subService = new DhaClaimSubmissionService(claimRepo, claims, access);
    await subService.mockSubmitClaim(validated._id.toString(), { actorUserId: actor });

    const prevService = new DhaClaimPreviewService(claimRepo, claims, access);
    await prevService.mockPreviewClaim(validated._id.toString(), { actorUserId: actor });

    const discService = new DhaClaimDischargeService(claimRepo, claims, access);
    await discService.mockDischargeClaim(validated._id.toString(), { actorUserId: actor });

    const adjService = new DhaClaimAdjudicationService(claimRepo, claims, access);
    await adjService.mockAdjudicateClaim(validated._id.toString(), {
      decision: 'MOCK_APPROVED',
      actorUserId: actor,
    });

    const remService = new DhaRemittanceAdviceService(claimRepo, claims, access);
    const remittance = await remService.mockGenerateRemittanceAdvice(validated._id.toString(), {
      actorUserId: actor,
    });

    const allocService = new DhaPaymentAllocationService(claimRepo, access);
    await allocService.mockAllocatePayment(
      validated._id.toString(),
      remittance.remittanceAdviceId,
      { amount: 1500 },
      { actorUserId: actor },
    );

    const reconService = new DhaPaymentReconciliationService(claimRepo, access);
    await reconService.mockReconcilePayment(
      validated._id.toString(),
      remittance.remittanceAdviceId,
      {},
      { actorUserId: actor },
    );

    const closeService = new DhaClaimClosureService(claimRepo, access);
    const closure = await closeService.mockCloseClaim(
      validated._id.toString(),
      {},
      { actorUserId: actor },
    );

    return { claim: validated, remittance, closure };
  };

  describe('1. Access Control & Validation Tests', () => {
    it('throws 400 for invalid branchId in lifecycle summary', async () => {
      const reportingService = new DhaClaimReportingService(claimRepo, access);
      await expect(
        reportingService.getClaimLifecycleSummary(
          { branchId: 'invalid-id' },
          { actorUserId: actor },
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('throws 403 when branch access is denied for lifecycle summary', async () => {
      vi.spyOn(access, 'hasBranchAccess').mockResolvedValueOnce(false);
      const reportingService = new DhaClaimReportingService(claimRepo, access);
      await expect(
        reportingService.getClaimLifecycleSummary(
          { branchId: branchId.toString() },
          { actorUserId: actor },
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'BRANCH_ACCESS_DENIED',
      });
    });

    it('throws 403 when branch access is denied for remittance reconciliation report', async () => {
      vi.spyOn(access, 'hasBranchAccess').mockResolvedValueOnce(false);
      const reportingService = new DhaClaimReportingService(claimRepo, access);
      await expect(
        reportingService.getRemittanceReconciliationSummary(
          { branchId: branchId.toString() },
          { actorUserId: actor },
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'BRANCH_ACCESS_DENIED',
      });
    });

    it('throws 403 when branch access is denied for outstanding work report', async () => {
      vi.spyOn(access, 'hasBranchAccess').mockResolvedValueOnce(false);
      const reportingService = new DhaClaimReportingService(claimRepo, access);
      await expect(
        reportingService.getOutstandingWorkSummary(
          { branchId: branchId.toString() },
          { actorUserId: actor },
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'BRANCH_ACCESS_DENIED',
      });
    });

    it('throws 404 if claim does not exist for claim history', async () => {
      const reportingService = new DhaClaimReportingService(claimRepo, access);
      await expect(
        reportingService.getClaimAuditHistory(new Types.ObjectId().toString(), {
          actorUserId: actor,
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'CLAIM_NOT_FOUND',
      });
    });
  });

  describe('2. Claim Lifecycle Summary Report Tests', () => {
    it('returns zero counts for branch with no claims', async () => {
      const reportingService = new DhaClaimReportingService(claimRepo, access);
      const summary = await reportingService.getClaimLifecycleSummary(
        { branchId: branchId.toString() },
        { actorUserId: actor },
      );

      expect(summary.branchId).toBe(branchId.toString());
      expect(summary.totalClaims).toBe(0);
      expect(summary.mockLifecycleOutcomeCounts.submitted).toBe(0);
      expect(summary.mockLifecycleOutcomeCounts.closure.closedReconciled).toBe(0);
    });

    it('accurately counts authoritative and mock lifecycle statuses for populated claims', async () => {
      await setupClosedReconciledClaim();

      const reportingService = new DhaClaimReportingService(claimRepo, access);
      const summary = await reportingService.getClaimLifecycleSummary(
        { branchId: branchId.toString() },
        { actorUserId: actor },
      );

      expect(summary.totalClaims).toBe(1);
      expect(summary.authoritativeStatusCounts.VALIDATED).toBe(1);
      expect(summary.mockLifecycleOutcomeCounts.submitted).toBe(1);
      expect(summary.mockLifecycleOutcomeCounts.previewAvailable).toBe(1);
      expect(summary.mockLifecycleOutcomeCounts.discharged).toBe(1);
      expect(summary.mockLifecycleOutcomeCounts.adjudication.approved).toBe(1);
      expect(summary.mockLifecycleOutcomeCounts.remittance.remitted).toBe(1);
      expect(summary.mockLifecycleOutcomeCounts.reconciliation.reconciled).toBe(1);
      expect(summary.mockLifecycleOutcomeCounts.closure.closedReconciled).toBe(1);
    });
  });

  describe('3. Remittance and Reconciliation Summary Report Tests', () => {
    it('groups by currency and separates totals strictly without implicit conversion', async () => {
      await setupClosedReconciledClaim();

      // Add a simulated second claim with a distinct currency (USD) directly to verify currency segregation
      const otherClaimId = new Types.ObjectId();
      await InsuranceClaimModel.collection.insertOne({
        _id: otherClaimId,
        patientId,
        memberId,
        policyId,
        payerId,
        branchId,
        encounterId,
        invoiceId: invoiceId2,
        serviceDate: '2026-10-09',
        status: 'VALIDATED',
        version: 0,
        sourceFingerprint: 'fp-usd',
        lines: [],
        claimedTotal: 100,
        readyForShaSubmission: false,
        issues: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await DhaMockRemittanceAdviceModel.create({
        claimId: otherClaimId,
        sourceFingerprint: 'fp-usd',
        mockDischargeReference: 'MOCK-DISC-USD',
        mockAdjudicationReference: 'MOCK-ADJ-USD',
        externalRemittanceReference: 'MOCK-REM-USD',
        source: 'MOCK',
        status: 'MOCK_REMITTED',
        payableBasis: 'ADJUDICATION_APPROVED',
        claimedTotal: 100,
        remittedTotal: 100,
        disallowedTotal: 0,
        currency: 'USD',
        lines: [],
        remittedAt: new Date(),
        correlationId: 'corr-usd',
        version: 0,
      });

      await DhaMockPaymentReconciliationModel.create({
        claimId: otherClaimId,
        remittanceAdviceId: new Types.ObjectId(),
        externalRemittanceReference: 'MOCK-REM-USD',
        externalReconciliationReference: 'MOCK-REC-USD',
        source: 'MOCK',
        status: 'MOCK_RECONCILED',
        currency: 'USD',
        remittedTotal: 100,
        allocatedTotal: 100,
        unallocatedAmount: 0,
        allocationDifference: 0,
        allocationCount: 1,
        allocationIds: [],
        sourceFingerprint: 'fp-usd',
        snapshotFingerprint: 'snap-usd',
        reconciledAt: new Date(),
        correlationId: 'corr-usd-rec',
        version: 0,
      });

      const reportingService = new DhaClaimReportingService(claimRepo, access);
      const summary = await reportingService.getRemittanceReconciliationSummary(
        { branchId: branchId.toString() },
        { actorUserId: actor },
      );

      expect(summary.totalClaimsWithRemittance).toBe(2);
      expect(summary.byCurrency).toHaveLength(2);

      const kesEntry = summary.byCurrency.find((c) => c.currency === 'KES');
      const usdEntry = summary.byCurrency.find((c) => c.currency === 'USD');

      expect(kesEntry).toBeDefined();
      expect(kesEntry?.remittedTotal).toBe(1500);
      expect(kesEntry?.allocatedTotal).toBe(1500);
      expect(kesEntry?.unallocatedTotal).toBe(0);
      expect(kesEntry?.reconciledClaimsCount).toBe(1);

      expect(usdEntry).toBeDefined();
      expect(usdEntry?.remittedTotal).toBe(100);
      expect(usdEntry?.allocatedTotal).toBe(100);
      expect(usdEntry?.unallocatedTotal).toBe(0);
      expect(usdEntry?.reconciledClaimsCount).toBe(1);
    });
  });

  describe('4. Outstanding-Work Summary Report Tests', () => {
    it('identifies unclosed claims and open items correctly', async () => {
      const created = await claims.create(
        { invoiceId: invoiceId1.toString(), memberId: memberId.toString() },
        actor,
        { ipAddress: '127.0.0.1' },
      );
      const validated = await claims.validate(
        created._id.toString(),
        created.version,
        actor,
        { ipAddress: '127.0.0.1' },
      );

      const subService = new DhaClaimSubmissionService(claimRepo, claims, access);
      await subService.mockSubmitClaim(validated._id.toString(), { actorUserId: actor });

      const prevService = new DhaClaimPreviewService(claimRepo, claims, access);
      await prevService.mockPreviewClaim(validated._id.toString(), { actorUserId: actor });

      const discService = new DhaClaimDischargeService(claimRepo, claims, access);
      await discService.mockDischargeClaim(validated._id.toString(), { actorUserId: actor });

      const adjService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await adjService.mockAdjudicateClaim(validated._id.toString(), {
        decision: 'MOCK_QUERY',
        actorUserId: actor,
      });

      const qService = new DhaClaimQueryService(claimRepo, claims, access);
      await qService.mockCreateQuery(validated._id.toString(), {
        queryReason: 'Please attach diagnostic imaging',
        actorUserId: actor,
      });

      const reportingService = new DhaClaimReportingService(claimRepo, access);
      const report = await reportingService.getOutstandingWorkSummary(
        { branchId: branchId.toString(), category: 'ALL' },
        { actorUserId: actor },
      );

      expect(report.items.length).toBeGreaterThan(0);
      const queryItem = report.items.find((i) => i.category === 'OPEN_QUERIES');
      expect(queryItem).toBeDefined();
      expect(queryItem?.issueDetails.queryStatus).toBe('OPEN');
    });

    it('filters outstanding work by category correctly', async () => {
      const reportingService = new DhaClaimReportingService(claimRepo, access);
      const report = await reportingService.getOutstandingWorkSummary(
        { branchId: branchId.toString(), category: 'OPEN_APPEALS' },
        { actorUserId: actor },
      );

      expect(report.categoryFilter).toBe('OPEN_APPEALS');
      for (const item of report.items) {
        expect(item.category).toBe('OPEN_APPEALS');
      }
    });
  });

  describe('5. Claim Audit History Timeline Tests', () => {
    it('assembles a strictly chronological timeline of all lifecycle stages', async () => {
      const { claim } = await setupClosedReconciledClaim();

      const reportingService = new DhaClaimReportingService(claimRepo, access);
      const history = await reportingService.getClaimAuditHistory(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(history.claimId).toBe(claim._id.toString());
      expect(history.timeline.length).toBeGreaterThanOrEqual(7);

      const stages = history.timeline.map((e) => e.stage);
      expect(stages).toContain('SUBMISSION');
      expect(stages).toContain('PREVIEW');
      expect(stages).toContain('DISCHARGE');
      expect(stages).toContain('ADJUDICATION');
      expect(stages).toContain('REMITTANCE');
      expect(stages).toContain('ALLOCATION');
      expect(stages).toContain('RECONCILIATION');
      expect(stages).toContain('CLOSURE');

      // Verify strictly chronological order
      for (let i = 0; i < history.timeline.length - 1; i++) {
        const curr = history.timeline[i].timestamp.getTime();
        const next = history.timeline[i + 1].timestamp.getTime();
        expect(curr).toBeLessThanOrEqual(next);
      }
    });
  });

  describe('6. Read-Only & Financial Safety Invariants', () => {
    it('makes zero database mutations during reporting calls', async () => {
      const { claim } = await setupClosedReconciledClaim();

      const initialClaimsCount = await InsuranceClaimModel.countDocuments();
      const initialClosuresCount = await DhaMockClaimClosureModel.countDocuments();

      const reportingService = new DhaClaimReportingService(claimRepo, access);
      await reportingService.getClaimLifecycleSummary(
        { branchId: branchId.toString() },
        { actorUserId: actor },
      );
      await reportingService.getRemittanceReconciliationSummary(
        { branchId: branchId.toString() },
        { actorUserId: actor },
      );
      await reportingService.getOutstandingWorkSummary(
        { branchId: branchId.toString() },
        { actorUserId: actor },
      );
      await reportingService.getClaimAuditHistory(claim._id.toString(), {
        actorUserId: actor,
      });

      const finalClaimsCount = await InsuranceClaimModel.countDocuments();
      const finalClosuresCount = await DhaMockClaimClosureModel.countDocuments();

      expect(finalClaimsCount).toBe(initialClaimsCount);
      expect(finalClosuresCount).toBe(initialClosuresCount);
    });

    it('does NOT create patient payments (BillingPaymentModel remains untouched)', async () => {
      await setupClosedReconciledClaim();

      const reportingService = new DhaClaimReportingService(claimRepo, access);
      await reportingService.getRemittanceReconciliationSummary(
        { branchId: branchId.toString() },
        { actorUserId: actor },
      );

      const paymentCount = await BillingPaymentModel.countDocuments();
      expect(paymentCount).toBe(0);
    });

    it('makes ZERO external network calls in MOCK mode', async () => {
      const { claim } = await setupClosedReconciledClaim();

      const reportingService = new DhaClaimReportingService(claimRepo, access);
      await reportingService.getClaimAuditHistory(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
