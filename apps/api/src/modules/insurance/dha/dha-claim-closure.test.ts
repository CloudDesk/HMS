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
import {
  MockDhaClaimClosureAdapter,
  UnavailableDhaClaimClosureAdapter,
  createDhaClaimClosureAdapter,
} from './dha-claim-closure.adapter.js';
import { DhaClaimSubmissionService } from './dha-claim-submission.service.js';
import { DhaClaimPreviewService } from './dha-claim-preview.service.js';
import { DhaClaimDischargeService } from './dha-claim-discharge.service.js';
import { DhaClaimAdjudicationService } from './dha-claim-adjudication.service.js';
import { DhaClaimQueryService } from './dha-claim-query.service.js';
import { DhaClaimAppealService } from './dha-claim-appeal.service.js';
import { DhaRemittanceAdviceService } from './dha-remittance-advice.service.js';
import { DhaPaymentAllocationService } from './dha-payment-allocation.service.js';
import { DhaPaymentReconciliationService } from './dha-payment-reconciliation.service.js';
import { DhaClaimClosureService } from './dha-claim-closure.service.js';

describe('HMS Insurance — Phase 10.7: Mock Claim Closure & Lifecycle Consistency Foundation', () => {
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
    await DhaMockClaimClosureModel.init();
    await ShaServiceMappingModel.init();
    await InsuranceAuthorizationModel.init();
    await AuditLogModel.init();

    await PatientModel.collection.insertOne({
      _id: patientId,
      patientNumber: 'P-107',
      firstName: 'Clara',
      lastName: 'Closure',
    });

    await ServiceModel.collection.insertOne({
      _id: serviceId1,
      name: 'Closure Consultation',
      code: 'SRV-CLS-01',
      price: 1000,
      status: 'ACTIVE',
      category: 'CONSULTATION',
    });
    await ServiceModel.collection.insertOne({
      _id: serviceId2,
      name: 'Closure Lab',
      code: 'SRV-CLS-02',
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
      patientName: 'Clara Closure',
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
      name: 'Closure Health Plan',
      policyNumber: 'POL-107',
      status: 'ACTIVE',
      coverageType: 'COMPREHENSIVE',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    });

    await InsuranceMemberModel.collection.insertOne({
      _id: memberId,
      patientId,
      policyId,
      memberNumber: 'MEM-107',
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
      interventionCode: 'INT-CLS-01',
      effectiveFrom: '2026-01-01',
      status: 'ACTIVE',
      version: 0,
      createdBy: new Types.ObjectId(actor),
      updatedBy: new Types.ObjectId(actor),
    });
    await ShaServiceMappingModel.collection.insertOne({
      serviceId: serviceId2,
      interventionCode: 'INT-CLS-02',
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
   * Helper to set up a claim through Submission -> Preview -> Discharge
   */
  const setupClaimDischarged = async () => {
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
    const discharge = await dischargeService.mockDischargeClaim(validated._id.toString(), {
      actorUserId: actor,
      correlationId: 'corr-disc',
    });

    return { claim: validated, discharge };
  };

  /**
   * Helper to set up a fully reconciled claim through Phase 10.6
   */
  const setupFullyReconciledClaim = async () => {
    const { claim, discharge } = await setupClaimDischarged();

    const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
    const adjudication = await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
      decision: 'MOCK_APPROVED',
      actorUserId: actor,
      correlationId: 'corr-adj',
    });

    const remittanceService = new DhaRemittanceAdviceService(claimRepo, claims, access);
    const remittance = await remittanceService.mockGenerateRemittanceAdvice(claim._id.toString(), {
      actorUserId: actor,
      correlationId: 'corr-rem',
    });

    const allocationService = new DhaPaymentAllocationService(claimRepo, access);
    const allocation = await allocationService.mockAllocatePayment(
      claim._id.toString(),
      remittance.remittanceAdviceId,
      { amount: 1500 },
      {
        actorUserId: actor,
        correlationId: 'corr-alloc',
      },
    );

    const reconciliationService = new DhaPaymentReconciliationService(claimRepo, access);
    const reconciliation = await reconciliationService.mockReconcilePayment(
      claim._id.toString(),
      remittance.remittanceAdviceId,
      {},
      {
        actorUserId: actor,
        correlationId: 'corr-recon',
      },
    );

    return { claim, discharge, adjudication, remittance, allocation, reconciliation };
  };

  describe('1. Adapter Unit Tests', () => {
    it('MockDhaClaimClosureAdapter generates deterministic reference with source=MOCK', async () => {
      const adapter = new MockDhaClaimClosureAdapter();
      expect(adapter.mode).toBe('MOCK');

      const result = await adapter.closeClaim({
        claimId: 'claim-1',
        sourceFingerprint: 'fp-1',
        status: 'MOCK_CLOSED_RECONCILED',
        closurePath: 'SETTLEMENT_RECONCILED',
        closureReason: 'Fully reconciled',
        claimedTotal: 1500,
        remittedTotal: 1500,
        allocatedTotal: 1500,
        reconciledTotal: 1500,
        closureSnapshotFingerprint: 'snap-1',
        correlationId: 'corr-cls',
      });

      expect(result.source).toBe('MOCK');
      expect(result.externalClosureReference).toMatch(/^MOCK-CLS-[A-F0-9]{8}-[A-Z0-9]+$/);
      expect(result.status).toBe('MOCK_CLOSED_RECONCILED');
      expect(result.closurePath).toBe('SETTLEMENT_RECONCILED');
      expect(result.correlationId).toBe('corr-cls');
      expect(result.closedAt).toBeInstanceOf(Date);
    });

    it('UnavailableDhaClaimClosureAdapter throws typed 503 error in REAL mode', async () => {
      const adapter = new UnavailableDhaClaimClosureAdapter();
      expect(adapter.mode).toBe('REAL');

      await expect(adapter.closeClaim()).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_CLOSURE_CONTRACT_UNCONFIRMED',
      });
    });

    it('createDhaClaimClosureAdapter creates appropriate adapter instance based on mode', () => {
      const mockAdapter = createDhaClaimClosureAdapter('MOCK');
      expect(mockAdapter).toBeInstanceOf(MockDhaClaimClosureAdapter);

      const realAdapter = createDhaClaimClosureAdapter('REAL');
      expect(realAdapter).toBeInstanceOf(UnavailableDhaClaimClosureAdapter);
    });
  });

  describe('2. Closure Readiness Evaluation Tests', () => {
    it('throws 400 for invalid claimId format', async () => {
      const closureService = new DhaClaimClosureService(claimRepo, access);
      await expect(
        closureService.evaluateClosureReadiness('invalid-id', { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('throws 404 if claim does not exist', async () => {
      const closureService = new DhaClaimClosureService(claimRepo, access);
      await expect(
        closureService.evaluateClosureReadiness(new Types.ObjectId().toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'CLAIM_NOT_FOUND',
      });
    });

    it('throws 403 if branch access is denied', async () => {
      const { claim } = await setupClaimDischarged();
      vi.spyOn(access, 'hasBranchAccess').mockResolvedValueOnce(false);

      const closureService = new DhaClaimClosureService(claimRepo, access);
      await expect(
        closureService.evaluateClosureReadiness(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'BRANCH_ACCESS_DENIED',
      });
    });

    it('reports MISSING_DISCHARGE if claim has not been discharged', async () => {
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

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const readiness = await closureService.evaluateClosureReadiness(validated._id.toString(), {
        actorUserId: actor,
      });

      expect(readiness.ready).toBe(false);
      expect(readiness.blockers).toContain('MISSING_DISCHARGE');
      expect(readiness.closurePath).toBe('NOT_ELIGIBLE');
      expect(readiness.summary.hasDischarge).toBe(false);
    });

    it('reports MISSING_ADJUDICATION if claim is discharged but has no adjudication', async () => {
      const { claim } = await setupClaimDischarged();

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const readiness = await closureService.evaluateClosureReadiness(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(readiness.ready).toBe(false);
      expect(readiness.blockers).toContain('MISSING_ADJUDICATION');
      expect(readiness.closurePath).toBe('NOT_ELIGIBLE');
      expect(readiness.summary.hasDischarge).toBe(true);
      expect(readiness.summary.adjudicationStatus).toBeUndefined();
    });

    it('reports ADJUDICATION_PENDING if claim adjudication is still pending', async () => {
      const { claim } = await setupClaimDischarged();

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        decision: 'MOCK_PENDING',
        actorUserId: actor,
      });

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const readiness = await closureService.evaluateClosureReadiness(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(readiness.ready).toBe(false);
      expect(readiness.blockers).toContain('ADJUDICATION_PENDING');
      expect(readiness.closurePath).toBe('NOT_ELIGIBLE');
      expect(readiness.summary.adjudicationStatus).toBe('MOCK_PENDING');
    });

    it('reports OPEN_QUERY_EXISTS if unresolved queries exist', async () => {
      const { claim } = await setupClaimDischarged();

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        decision: 'MOCK_QUERY',
        actorUserId: actor,
      });

      const queryService = new DhaClaimQueryService(claimRepo, claims, access);
      await queryService.mockCreateQuery(claim._id.toString(), {
        queryReason: 'Please provide lab diagnostic report',
        actorUserId: actor,
      });

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const readiness = await closureService.evaluateClosureReadiness(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(readiness.ready).toBe(false);
      expect(readiness.blockers).toContain('OPEN_QUERY_EXISTS');
      expect(readiness.summary.openQueriesCount).toBe(1);
    });

    it('reports OPEN_APPEAL_EXISTS if an open or submitted appeal is active', async () => {
      const { claim } = await setupClaimDischarged();

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        decision: 'MOCK_REJECTED',
        actorUserId: actor,
      });

      const appealService = new DhaClaimAppealService(claimRepo, claims, access);
      await appealService.mockCreateAppeal(claim._id.toString(), {
        appealReason: 'Medical necessity dispute',
        actorUserId: actor,
      });

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const readiness = await closureService.evaluateClosureReadiness(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(readiness.ready).toBe(false);
      expect(readiness.blockers).toContain('OPEN_APPEAL_EXISTS');
      expect(readiness.summary.hasOpenAppeal).toBe(true);
    });

    it('reports MISSING_REMITTANCE_ADVICE if payable claim lacks remittance advice', async () => {
      const { claim } = await setupClaimDischarged();

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        decision: 'MOCK_APPROVED',
        actorUserId: actor,
      });

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const readiness = await closureService.evaluateClosureReadiness(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(readiness.ready).toBe(false);
      expect(readiness.blockers).toContain('MISSING_REMITTANCE_ADVICE');
      expect(readiness.summary.hasRemittanceAdvice).toBe(false);
    });

    it('reports RECONCILIATION_REQUIRED if remittance exists but has no reconciliation record', async () => {
      const { claim } = await setupClaimDischarged();

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        decision: 'MOCK_APPROVED',
        actorUserId: actor,
      });

      const remittanceService = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await remittanceService.mockGenerateRemittanceAdvice(claim._id.toString(), {
        actorUserId: actor,
      });

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const readiness = await closureService.evaluateClosureReadiness(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(readiness.ready).toBe(false);
      expect(readiness.blockers).toContain('RECONCILIATION_REQUIRED');
      expect(readiness.summary.reconciliationStatus).toBeUndefined();
    });

    it('reports RECONCILIATION_INCOMPLETE if reconciliation is only partially reconciled', async () => {
      const { claim } = await setupClaimDischarged();

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        decision: 'MOCK_APPROVED',
        actorUserId: actor,
      });

      const remittanceService = new DhaRemittanceAdviceService(claimRepo, claims, access);
      const remittance = await remittanceService.mockGenerateRemittanceAdvice(claim._id.toString(), {
        actorUserId: actor,
      });

      // Partial allocation (e.g. 500 of 1500)
      const allocationService = new DhaPaymentAllocationService(claimRepo, access);
      await allocationService.mockAllocatePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        { amount: 500 },
        { actorUserId: actor },
      );

      const reconciliationService = new DhaPaymentReconciliationService(claimRepo, access);
      await reconciliationService.mockReconcilePayment(
        claim._id.toString(),
        remittance.remittanceAdviceId,
        {},
        { actorUserId: actor },
      );

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const readiness = await closureService.evaluateClosureReadiness(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(readiness.ready).toBe(false);
      expect(readiness.blockers).toContain('RECONCILIATION_INCOMPLETE');
      expect(readiness.summary.reconciliationStatus).toBe('MOCK_PARTIALLY_RECONCILED');
    });

    it('reports RECONCILIATION_DISCREPANCY if reconciliation has discrepancy status', async () => {
      const { claim } = await setupClaimDischarged();

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        decision: 'MOCK_APPROVED',
        actorUserId: actor,
      });

      const remittanceService = new DhaRemittanceAdviceService(claimRepo, claims, access);
      const remittance = await remittanceService.mockGenerateRemittanceAdvice(claim._id.toString(), {
        actorUserId: actor,
      });

      // Force discrepancy via manual reconciliation record
      await DhaMockPaymentReconciliationModel.create({
        claimId: claim._id,
        remittanceAdviceId: new Types.ObjectId(remittance.remittanceAdviceId),
        externalRemittanceReference: remittance.externalRemittanceReference,
        externalReconciliationReference: 'MOCK-REC-DISC',
        source: 'MOCK',
        status: 'MOCK_DISCREPANCY',
        discrepancyReasons: ['Payer allocated amount exceeds remitted total'],
        currency: 'KES',
        remittedTotal: 1500,
        allocatedTotal: 2000,
        unallocatedAmount: 0,
        allocationDifference: 500,
        allocationCount: 1,
        sourceFingerprint: claim.sourceFingerprint,
        snapshotFingerprint: 'snap-disc',
        reconciledAt: new Date(),
        correlationId: 'corr-disc-test',
        actorUserId: actor,
        version: 0,
      });

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const readiness = await closureService.evaluateClosureReadiness(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(readiness.ready).toBe(false);
      expect(readiness.blockers).toContain('RECONCILIATION_DISCREPANCY');
      expect(readiness.summary.reconciliationStatus).toBe('MOCK_DISCREPANCY');
    });

    it('evaluates ready=true with SETTLEMENT_RECONCILED for fully reconciled claim', async () => {
      const { claim } = await setupFullyReconciledClaim();

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const readiness = await closureService.evaluateClosureReadiness(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(readiness.ready).toBe(true);
      expect(readiness.blockers).toHaveLength(0);
      expect(readiness.closurePath).toBe('SETTLEMENT_RECONCILED');
      expect(readiness.summary.hasDischarge).toBe(true);
      expect(readiness.summary.adjudicationStatus).toBe('MOCK_APPROVED');
      expect(readiness.summary.openQueriesCount).toBe(0);
      expect(readiness.summary.hasOpenAppeal).toBe(false);
      expect(readiness.summary.hasRemittanceAdvice).toBe(true);
      expect(readiness.summary.reconciliationStatus).toBe('MOCK_RECONCILED');
    });

    it('evaluates ready=true with NO_SETTLEMENT_REJECTED for rejected claim with no open appeal', async () => {
      const { claim } = await setupClaimDischarged();

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        decision: 'MOCK_REJECTED',
        actorUserId: actor,
      });

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const readiness = await closureService.evaluateClosureReadiness(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(readiness.ready).toBe(true);
      expect(readiness.blockers).toHaveLength(0);
      expect(readiness.closurePath).toBe('NO_SETTLEMENT_REJECTED');
      expect(readiness.summary.hasDischarge).toBe(true);
      expect(readiness.summary.adjudicationStatus).toBe('MOCK_REJECTED');
      expect(readiness.summary.hasOpenAppeal).toBe(false);
      expect(readiness.summary.hasRemittanceAdvice).toBe(false);
    });
  });

  describe('3. Mock Claim Closure Execution & Idempotency Tests', () => {
    it('throws 422 if claim is not ready for mock closure', async () => {
      const { claim } = await setupClaimDischarged();

      const closureService = new DhaClaimClosureService(claimRepo, access);
      await expect(
        closureService.mockCloseClaim(claim._id.toString(), {}, { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'CLAIM_NOT_READY_FOR_CLOSURE',
      });
    });

    it('successfully closes fully reconciled claim with SETTLEMENT_RECONCILED', async () => {
      const { claim, discharge, adjudication, remittance, reconciliation } =
        await setupFullyReconciledClaim();

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const result = await closureService.mockCloseClaim(
        claim._id.toString(),
        { reason: 'Month-end batch reconciliation complete' },
        { actorUserId: actor, correlationId: 'corr-cls-test' },
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('MOCK');
      expect(result.status).toBe('MOCK_CLOSED_RECONCILED');
      expect(result.closurePath).toBe('SETTLEMENT_RECONCILED');
      expect(result.closureReason).toBe('Month-end batch reconciliation complete');
      expect(result.claimedTotal).toBe(1500);
      expect(result.remittedTotal).toBe(1500);
      expect(result.allocatedTotal).toBe(1500);
      expect(result.reconciledTotal).toBe(1500);
      expect(result.mockDischargeReference).toBe(discharge.externalDischargeReference);
      expect(result.mockAdjudicationReference).toBe(adjudication.externalAdjudicationReference);
      expect(result.mockRemittanceReference).toBe(remittance.externalRemittanceReference);
      expect(result.mockReconciliationReference).toBe(reconciliation.externalReconciliationReference);
      expect(result.idempotent).toBe(false);
      expect(result.correlationId).toBe('corr-cls-test');

      // Verify persistence in MongoDB
      const doc = await DhaMockClaimClosureModel.findById(result.closureId).lean();
      expect(doc).not.toBeNull();
      expect(doc?.status).toBe('MOCK_CLOSED_RECONCILED');
      expect(doc?.closurePath).toBe('SETTLEMENT_RECONCILED');
      expect(doc?.source).toBe('MOCK');

      // Verify audit log creation
      const audit = await AuditLogModel.findOne({
        eventType: 'DHA_MOCK_CLAIM_CLOSED',
        'metadataJson.closureId': result.closureId,
      }).lean();
      expect(audit).not.toBeNull();
    });

    it('successfully closes rejected claim with NO_SETTLEMENT_REJECTED', async () => {
      const { claim, discharge } = await setupClaimDischarged();

      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      const adjResult = await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        decision: 'MOCK_REJECTED',
        actorUserId: actor,
      });

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const result = await closureService.mockCloseClaim(
        claim._id.toString(),
        {},
        { actorUserId: actor, correlationId: 'corr-rej-close' },
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('MOCK');
      expect(result.status).toBe('MOCK_CLOSED_NO_SETTLEMENT');
      expect(result.closurePath).toBe('NO_SETTLEMENT_REJECTED');
      expect(result.closureReason).toBe('Claim terminal rejection with zero settlement');
      expect(result.claimedTotal).toBe(1500);
      expect(result.remittedTotal).toBe(0);
      expect(result.allocatedTotal).toBe(0);
      expect(result.reconciledTotal).toBe(0);
      expect(result.mockDischargeReference).toBe(discharge.externalDischargeReference);
      expect(result.mockAdjudicationReference).toBe(adjResult.externalAdjudicationReference);
      expect(result.mockRemittanceReference).toBeFalsy();
      expect(result.mockReconciliationReference).toBeFalsy();
      expect(result.idempotent).toBe(false);

      const doc = await DhaMockClaimClosureModel.findById(result.closureId).lean();
      expect(doc?.status).toBe('MOCK_CLOSED_NO_SETTLEMENT');
      expect(doc?.closurePath).toBe('NO_SETTLEMENT_REJECTED');
    });

    it('returns existing closure snapshot idempotently when identical closure is requested', async () => {
      const { claim } = await setupFullyReconciledClaim();

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const first = await closureService.mockCloseClaim(claim._id.toString(), {}, {
        actorUserId: actor,
      });
      expect(first.idempotent).toBe(false);

      const second = await closureService.mockCloseClaim(claim._id.toString(), {}, {
        actorUserId: actor,
      });
      expect(second.idempotent).toBe(true);
      expect(second.closureId).toBe(first.closureId);
      expect(second.externalClosureReference).toBe(first.externalClosureReference);
      expect(second.closureSnapshotFingerprint).toBe(first.closureSnapshotFingerprint);

      const count = await DhaMockClaimClosureModel.countDocuments({ claimId: claim._id });
      expect(count).toBe(1);
    });

    it('returns existing record idempotently when idempotencyKey matches', async () => {
      const { claim } = await setupFullyReconciledClaim();

      const closureService = new DhaClaimClosureService(claimRepo, access);
      const idempotencyKey = 'unique-key-closure-123';

      const first = await closureService.mockCloseClaim(
        claim._id.toString(),
        { idempotencyKey },
        { actorUserId: actor },
      );
      expect(first.idempotent).toBe(false);

      const second = await closureService.mockCloseClaim(
        claim._id.toString(),
        { idempotencyKey },
        { actorUserId: actor },
      );
      expect(second.idempotent).toBe(true);
      expect(second.closureId).toBe(first.closureId);
    });

    it('retrieves closure history via getClosures in chronological order', async () => {
      const { claim } = await setupFullyReconciledClaim();

      const closureService = new DhaClaimClosureService(claimRepo, access);
      await closureService.mockCloseClaim(claim._id.toString(), {}, { actorUserId: actor });

      const closures = await closureService.getClosures(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(closures).toHaveLength(1);
      expect(closures[0].status).toBe('MOCK_CLOSED_RECONCILED');
      expect(closures[0].closurePath).toBe('SETTLEMENT_RECONCILED');
    });
  });

  describe('4. Cross-Domain Safety Invariants', () => {
    it('does NOT mutate authoritative InsuranceClaim status (remains VALIDATED, readyForShaSubmission=false)', async () => {
      const { claim } = await setupFullyReconciledClaim();

      const closureService = new DhaClaimClosureService(claimRepo, access);
      await closureService.mockCloseClaim(claim._id.toString(), {}, { actorUserId: actor });

      const updatedClaim = await InsuranceClaimModel.findById(claim._id).lean();
      expect(updatedClaim?.status).toBe('VALIDATED');
      expect(updatedClaim?.readyForShaSubmission).toBe(false);
    });

    it('does NOT modify BillingInvoice total or status', async () => {
      const { claim } = await setupFullyReconciledClaim();

      const closureService = new DhaClaimClosureService(claimRepo, access);
      await closureService.mockCloseClaim(claim._id.toString(), {}, { actorUserId: actor });

      const invoice = await BillingInvoiceModel.findById(invoiceId).lean();
      expect(invoice?.status).toBe('PENDING');
      expect(invoice?.totalAmount).toBe(1500);
    });

    it('does NOT create patient payments (BillingPayment collection remains untouched)', async () => {
      const { claim } = await setupFullyReconciledClaim();

      const closureService = new DhaClaimClosureService(claimRepo, access);
      await closureService.mockCloseClaim(claim._id.toString(), {}, { actorUserId: actor });

      const paymentCount = await BillingPaymentModel.countDocuments();
      expect(paymentCount).toBe(0);
    });

    it('makes ZERO external network calls in MOCK mode', async () => {
      const { claim } = await setupFullyReconciledClaim();

      const closureService = new DhaClaimClosureService(claimRepo, access);
      await closureService.mockCloseClaim(claim._id.toString(), {}, { actorUserId: actor });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fails closed with typed 503 error in REAL mode without modifying database', async () => {
      const { claim } = await setupFullyReconciledClaim();

      const realAdapter = new UnavailableDhaClaimClosureAdapter();
      const closureService = new DhaClaimClosureService(claimRepo, access, realAdapter);

      await expect(
        closureService.mockCloseClaim(claim._id.toString(), {}, { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_CLOSURE_CONTRACT_UNCONFIRMED',
      });

      const closuresCount = await DhaMockClaimClosureModel.countDocuments({ claimId: claim._id });
      expect(closuresCount).toBe(0);
    });
  });
});
