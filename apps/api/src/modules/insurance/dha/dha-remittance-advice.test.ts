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
import {
  MockDhaRemittanceAdviceAdapter,
  UnavailableDhaRemittanceAdviceAdapter,
  createDhaRemittanceAdviceAdapter,
} from './dha-remittance-advice.adapter.js';
import { DhaClaimSubmissionService } from './dha-claim-submission.service.js';
import { DhaClaimPreviewService } from './dha-claim-preview.service.js';
import { DhaClaimDischargeService } from './dha-claim-discharge.service.js';
import { DhaClaimAdjudicationService } from './dha-claim-adjudication.service.js';
import { DhaClaimQueryService } from './dha-claim-query.service.js';
import { DhaClaimAppealService } from './dha-claim-appeal.service.js';
import { DhaRemittanceAdviceService } from './dha-remittance-advice.service.js';

describe('HMS Insurance — Phase 10.4: Mock DHA Remittance Advice Foundation', () => {
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
  const documentId1 = new Types.ObjectId();

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
    await ShaServiceMappingModel.init();
    await InsuranceAuthorizationModel.init();
    await AuditLogModel.init();

    await PatientModel.collection.insertOne({
      _id: patientId,
      patientNumber: 'P-104',
      firstName: 'Rachel',
      lastName: 'Remittance',
    });
    await OpdVisitModel.collection.insertOne({
      _id: encounterId,
      patientId,
      branchId,
      doctorId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(),
      visitDate: new Date('2026-10-09'),
      patientName: 'Rachel Remittance',
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
      memberNumber: 'MEM-104',
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

    await PatientDocumentModel.collection.insertOne({
      _id: documentId1,
      patientId,
      documentType: 'CLINICAL',
      title: 'Remittance Justification',
      fileName: 'justification.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 2048,
      storageKey: 'patients/docs/justification.pdf',
      source: 'HOSPITAL',
      reviewStatus: 'NOT_REQUIRED',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
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
   * Helper to set up a claim through Submission -> Preview -> Discharge -> Adjudication
   */
  const setupClaimWithAdjudication = async (
    decision: 'MOCK_APPROVED' | 'MOCK_PARTIALLY_APPROVED' | 'MOCK_REJECTED' | 'MOCK_PENDING' | 'MOCK_QUERY' = 'MOCK_APPROVED',
  ) => {
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
    const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
    const adjudication = await adjudicationService.mockAdjudicateClaim(validated._id.toString(), {
      decision,
      actorUserId: actor,
      correlationId: 'corr-adj',
    });

    return { claim: validated, discharge, adjudication };
  };

  describe('1. Adapter Unit Tests', () => {
    it('MockDhaRemittanceAdviceAdapter produces deterministic 100% remittance on ADJUDICATION_APPROVED', async () => {
      const adapter = new MockDhaRemittanceAdviceAdapter();
      expect(adapter.mode).toBe('MOCK');

      const claimId = new Types.ObjectId().toString();
      const result = await adapter.generateRemittanceAdvice({
        claimId,
        externalClaimReference: 'MOCK-CLAIM-001',
        mockDischargeReference: 'MOCK-DISCHARGE-001',
        mockAdjudicationReference: 'MOCK-ADJ-001',
        payableBasis: 'ADJUDICATION_APPROVED',
        claimedTotal: 1500,
        currency: 'AED',
        sourceFingerprint: 'fp-rem-01',
        lines: [
          {
            invoiceItemId: invoiceItemId1.toString(),
            serviceId: serviceId1.toString(),
            quantity: 1,
            claimedAmount: 1000,
          },
          {
            invoiceItemId: invoiceItemId2.toString(),
            serviceId: serviceId2.toString(),
            quantity: 1,
            claimedAmount: 500,
          },
        ],
      });

      expect(result.source).toBe('MOCK');
      expect(result.externalRemittanceReference).toMatch(/^MOCK-REM-/);
      expect(result.payableBasis).toBe('ADJUDICATION_APPROVED');
      expect(result.claimedTotal).toBe(1500);
      expect(result.remittedTotal).toBe(1500);
      expect(result.disallowedTotal).toBe(0);
      expect(result.lines).toHaveLength(2);
      expect(result.lines[0].status).toBe('APPROVED');
      expect(result.lines[0].remittedAmount).toBe(1000);
      expect(result.lines[0].disallowedAmount).toBe(0);
      expect(result.lines[1].status).toBe('APPROVED');
      expect(result.lines[1].remittedAmount).toBe(500);
      expect(result.lines[1].disallowedAmount).toBe(0);
    });

    it('MockDhaRemittanceAdviceAdapter produces partial breakdown on ADJUDICATION_PARTIAL', async () => {
      const adapter = new MockDhaRemittanceAdviceAdapter();

      const claimId = new Types.ObjectId().toString();
      const result = await adapter.generateRemittanceAdvice({
        claimId,
        externalClaimReference: 'MOCK-CLAIM-001',
        mockDischargeReference: 'MOCK-DISCHARGE-001',
        mockAdjudicationReference: 'MOCK-ADJ-001',
        payableBasis: 'ADJUDICATION_PARTIAL',
        claimedTotal: 1500,
        currency: 'AED',
        sourceFingerprint: 'fp-rem-02',
        lines: [
          {
            invoiceItemId: invoiceItemId1.toString(),
            serviceId: serviceId1.toString(),
            quantity: 1,
            claimedAmount: 1000,
            adjudicatedAmount: 1000,
          },
          {
            invoiceItemId: invoiceItemId2.toString(),
            serviceId: serviceId2.toString(),
            quantity: 1,
            claimedAmount: 500,
            adjudicatedAmount: 350,
          },
        ],
      });

      expect(result.source).toBe('MOCK');
      expect(result.payableBasis).toBe('ADJUDICATION_PARTIAL');
      expect(result.claimedTotal).toBe(1500);
      expect(result.remittedTotal).toBe(1350);
      expect(result.disallowedTotal).toBe(150);
      expect(result.remittedTotal + result.disallowedTotal).toBe(result.claimedTotal);
      expect(result.lines[0].status).toBe('APPROVED');
      expect(result.lines[1].status).toBe('PARTIALLY_APPROVED');
      expect(result.lines[1].denialReason).toBe('Tariff ceiling applied');
    });

    it('MockDhaRemittanceAdviceAdapter produces 100% remittance on APPEAL_OVERTURNED', async () => {
      const adapter = new MockDhaRemittanceAdviceAdapter();

      const claimId = new Types.ObjectId().toString();
      const result = await adapter.generateRemittanceAdvice({
        claimId,
        externalClaimReference: 'MOCK-CLAIM-001',
        mockDischargeReference: 'MOCK-DISCHARGE-001',
        mockAdjudicationReference: 'MOCK-ADJ-001',
        mockAppealReference: 'MOCK-APPEAL-001',
        payableBasis: 'APPEAL_OVERTURNED',
        claimedTotal: 1500,
        currency: 'AED',
        sourceFingerprint: 'fp-rem-03',
        lines: [
          {
            invoiceItemId: invoiceItemId1.toString(),
            serviceId: serviceId1.toString(),
            quantity: 1,
            claimedAmount: 1000,
          },
          {
            invoiceItemId: invoiceItemId2.toString(),
            serviceId: serviceId2.toString(),
            quantity: 1,
            claimedAmount: 500,
          },
        ],
      });

      expect(result.payableBasis).toBe('APPEAL_OVERTURNED');
      expect(result.remittedTotal).toBe(1500);
      expect(result.disallowedTotal).toBe(0);
      expect(result.lines.every(l => l.status === 'APPROVED')).toBe(true);
    });

    it('UnavailableDhaRemittanceAdviceAdapter fails closed with 503 DHA_REMITTANCE_ADVICE_CONTRACT_UNCONFIRMED', async () => {
      const adapter = new UnavailableDhaRemittanceAdviceAdapter();
      expect(adapter.mode).toBe('REAL');

      await expect(
        adapter.generateRemittanceAdvice({
          claimId: 'c1',
          externalClaimReference: 'cr1',
          mockDischargeReference: 'dr1',
          mockAdjudicationReference: 'ar1',
          payableBasis: 'ADJUDICATION_APPROVED',
          claimedTotal: 100,
          currency: 'AED',
          sourceFingerprint: 'fp1',
          lines: [],
        }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_REMITTANCE_ADVICE_CONTRACT_UNCONFIRMED',
      });
    });

    it('createDhaRemittanceAdviceAdapter returns MockDhaRemittanceAdviceAdapter in MOCK mode', () => {
      const adapter = createDhaRemittanceAdviceAdapter();
      expect(adapter.mode).toBe('MOCK');
      expect(adapter).toBeInstanceOf(MockDhaRemittanceAdviceAdapter);
    });
  });

  describe('2. Validation & Security Checks', () => {
    it('rejects invalid claim ID format with 400 VALIDATION_ERROR', async () => {
      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await expect(service.mockGenerateRemittanceAdvice('invalid-id')).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('rejects non-existent claim with 404 CLAIM_NOT_FOUND', async () => {
      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      const nonExistent = new Types.ObjectId().toString();
      await expect(service.mockGenerateRemittanceAdvice(nonExistent)).rejects.toMatchObject({
        statusCode: 404,
        code: 'CLAIM_NOT_FOUND',
      });
    });

    it('rejects when caller lacks branch access with 403 BRANCH_ACCESS_DENIED', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_APPROVED');
      vi.spyOn(access, 'hasBranchAccess').mockResolvedValueOnce(false);

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await expect(
        service.mockGenerateRemittanceAdvice(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'BRANCH_ACCESS_DENIED',
      });
    });

    it('rejects cancelled claim with 409 CLAIM_CANCELLED', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_APPROVED');
      await InsuranceClaimModel.updateOne({ _id: claim._id }, { $set: { status: 'CANCELLED' } });

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await expect(
        service.mockGenerateRemittanceAdvice(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CLAIM_CANCELLED',
      });
    });
  });

  describe('3. Lifecycle Preconditions', () => {
    it('rejects when claim is not discharged with 404 DHA_MOCK_DISCHARGE_NOT_FOUND', async () => {
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

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await expect(
        service.mockGenerateRemittanceAdvice(validated._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DHA_MOCK_DISCHARGE_NOT_FOUND',
      });
    });

    it('rejects when claim has no adjudication with 404 DHA_MOCK_ADJUDICATION_NOT_FOUND', async () => {
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
      await submissionService.mockSubmitClaim(validated._id.toString(), { actorUserId: actor });
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      await previewService.mockPreviewClaim(validated._id.toString(), { actorUserId: actor });
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      await dischargeService.mockDischargeClaim(validated._id.toString(), { actorUserId: actor });

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await expect(
        service.mockGenerateRemittanceAdvice(validated._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DHA_MOCK_ADJUDICATION_NOT_FOUND',
      });
    });

    it('rejects MOCK_PENDING adjudication with 422 CLAIM_ADJUDICATION_NOT_PAYABLE', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_PENDING');

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await expect(
        service.mockGenerateRemittanceAdvice(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'CLAIM_ADJUDICATION_NOT_PAYABLE',
      });
    });

    it('rejects MOCK_QUERY adjudication with 422 CLAIM_ADJUDICATION_NOT_PAYABLE', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await expect(
        service.mockGenerateRemittanceAdvice(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'CLAIM_ADJUDICATION_NOT_PAYABLE',
      });
    });

    it('rejects MOCK_REJECTED adjudication when no appeal exists with 422 CLAIM_ADJUDICATION_NOT_PAYABLE', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await expect(
        service.mockGenerateRemittanceAdvice(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'CLAIM_ADJUDICATION_NOT_PAYABLE',
      });
    });

    it('blocks remittance advice when an unresolved query exists with 409 CLAIM_QUERY_UNRESOLVED', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      const queryService = new DhaClaimQueryService(claimRepo, claims, access);
      await queryService.mockCreateQuery(claim._id.toString(), {
        queryReason: 'Clarification on medication prescription dosage',
        actorUserId: actor,
      });

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await expect(
        service.mockGenerateRemittanceAdvice(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CLAIM_QUERY_UNRESOLVED',
      });
    });

    it('allows remittance advice once the query is resolved (MOCK_RESOLVED)', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      const queryService = new DhaClaimQueryService(claimRepo, claims, access);
      const query = await queryService.mockCreateQuery(claim._id.toString(), {
        queryReason: 'Clarification on clinical note',
        actorUserId: actor,
      });
      await queryService.mockRespondToQuery(
        claim._id.toString(),
        query.queryId,
        {
          responseNote: 'Prescription dosage verified with physician notes',
          resolveImmediately: true,
        },
        { actorUserId: actor },
      );

      // Simulate payer updating adjudication to MOCK_APPROVED post-query resolution
      await DhaMockClaimAdjudicationModel.updateOne(
        { claimId: claim._id },
        { $set: { status: 'MOCK_APPROVED' } },
      );

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      const res = await service.mockGenerateRemittanceAdvice(claim._id.toString(), { actorUserId: actor });

      expect(res.success).toBe(true);
      expect(res.status).toBe('MOCK_REMITTED');
      expect(res.payableBasis).toBe('ADJUDICATION_APPROVED');
    });
  });

  describe('4. Remittance Generation Workflows', () => {
    it('generates 100% remittance on ADJUDICATION_APPROVED and logs audit entry', async () => {
      const { claim, discharge, adjudication } = await setupClaimWithAdjudication('MOCK_APPROVED');

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      const res = await service.mockGenerateRemittanceAdvice(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-rem-01',
      });

      expect(res.success).toBe(true);
      expect(res.source).toBe('MOCK');
      expect(res.claimId).toBe(claim._id.toString());
      expect(res.mockDischargeReference).toBe(discharge.externalDischargeReference);
      expect(res.mockAdjudicationReference).toBe(adjudication.externalAdjudicationReference);
      expect(res.mockAppealReference).toBeUndefined();
      expect(res.payableBasis).toBe('ADJUDICATION_APPROVED');
      expect(res.status).toBe('MOCK_REMITTED');
      expect(res.claimedTotal).toBe(1500);
      expect(res.remittedTotal).toBe(1500);
      expect(res.disallowedTotal).toBe(0);
      expect(res.idempotent).toBe(false);
      expect(res.lines).toHaveLength(2);

      // Verify persisted in DB
      const persisted = await DhaMockRemittanceAdviceModel.findById(res.remittanceAdviceId);
      expect(persisted).not.toBeNull();
      expect(persisted!.status).toBe('MOCK_REMITTED');
      expect(persisted!.payableBasis).toBe('ADJUDICATION_APPROVED');
      expect(persisted!.remittedTotal).toBe(1500);

      // Verify audit log
      const audit = await AuditLogModel.findOne({
        eventType: 'DHA_MOCK_REMITTANCE_ADVICE_GENERATED',
      });
      expect(audit).not.toBeNull();
      expect(audit!.actorUserId).toBe(actor);
    });

    it('generates itemized partial remittance on ADJUDICATION_PARTIAL', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_PARTIALLY_APPROVED');

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      const res = await service.mockGenerateRemittanceAdvice(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-rem-02',
      });

      expect(res.success).toBe(true);
      expect(res.payableBasis).toBe('ADJUDICATION_PARTIAL');
      expect(res.claimedTotal).toBe(1500);
      expect(res.remittedTotal).toBe(1250);
      expect(res.disallowedTotal).toBe(250);
      expect(res.remittedTotal + res.disallowedTotal).toBe(res.claimedTotal);
      expect(res.lines[0].status).toBe('APPROVED');
      expect(res.lines[1].status).toBe('PARTIALLY_APPROVED');
      expect(res.lines[1].remittedAmount).toBe(250);
      expect(res.lines[1].disallowedAmount).toBe(250);
    });

    it('generates remittance when MOCK_REJECTED adjudication is overturned via MOCK_OVERTURNED appeal', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');

      // Create and submit appeal with simulated OVERTURN outcome
      const appealService = new DhaClaimAppealService(claimRepo, claims, access);
      const appeal = await appealService.mockCreateAppeal(claim._id.toString(), {
        appealReason: 'Provider disputed denial of critical intervention with supplementary records',
        actorUserId: actor,
      });
      const submittedAppeal = await appealService.mockSubmitAppeal(
        claim._id.toString(),
        appeal.appealId,
        {
          supportingDocumentIds: [documentId1.toString()],
          appealNote: 'Physician letter confirms medical necessity',
          decision: 'MOCK_OVERTURNED',
        },
        { actorUserId: actor },
      );
      expect(submittedAppeal.status).toBe('MOCK_OVERTURNED');

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      const res = await service.mockGenerateRemittanceAdvice(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-rem-overturn',
      });

      expect(res.success).toBe(true);
      expect(res.payableBasis).toBe('APPEAL_OVERTURNED');
      expect(res.mockAppealReference).toBe(submittedAppeal.externalAppealReference);
      expect(res.claimedTotal).toBe(1500);
      expect(res.remittedTotal).toBe(1500);
      expect(res.disallowedTotal).toBe(0);
      expect(res.lines.every(l => l.status === 'APPROVED')).toBe(true);
    });

    it('rejects remittance when appeal is MOCK_UPHELD with 422 CLAIM_ADJUDICATION_NOT_PAYABLE', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');

      const appealService = new DhaClaimAppealService(claimRepo, claims, access);
      const appeal = await appealService.mockCreateAppeal(claim._id.toString(), {
        appealReason: 'Disputing rejection',
        actorUserId: actor,
      });
      await appealService.mockSubmitAppeal(
        claim._id.toString(),
        appeal.appealId,
        {
          supportingDocumentIds: [documentId1.toString()],
          appealNote: 'Physician notes supporting reconsideration',
          decision: 'MOCK_UPHELD',
        },
        { actorUserId: actor },
      );

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await expect(
        service.mockGenerateRemittanceAdvice(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'CLAIM_ADJUDICATION_NOT_PAYABLE',
      });
    });
  });

  describe('5. Source Fingerprint & Idempotency', () => {
    it('rejects with 409 CLAIM_SOURCE_CHANGED if invoice is mutated without revalidation', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_APPROVED');

      // Mutate invoice items directly behind claim's back
      await BillingInvoiceItemModel.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 2000, lineTotal: 2000 } },
      );

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await expect(
        service.mockGenerateRemittanceAdvice(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CLAIM_SOURCE_CHANGED',
      });
    });

    it('returns existing remittance idempotently without creating duplicate records', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_APPROVED');

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      const first = await service.mockGenerateRemittanceAdvice(claim._id.toString(), {
        actorUserId: actor,
      });
      expect(first.idempotent).toBe(false);

      const second = await service.mockGenerateRemittanceAdvice(claim._id.toString(), {
        actorUserId: actor,
      });
      expect(second.idempotent).toBe(true);
      expect(second.remittanceAdviceId).toBe(first.remittanceAdviceId);
      expect(second.externalRemittanceReference).toBe(first.externalRemittanceReference);

      // Verify exactly one record in DB
      const count = await DhaMockRemittanceAdviceModel.countDocuments({ claimId: claim._id });
      expect(count).toBe(1);
    });

    it('preserves history when claim is revalidated and goes through new lifecycle run', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_APPROVED');
      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      const firstRemittance = await service.mockGenerateRemittanceAdvice(claim._id.toString(), {
        actorUserId: actor,
      });
      expect(firstRemittance.idempotent).toBe(false);

      // Mutate invoice item price legally
      await BillingInvoiceItemModel.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 1200, lineTotal: 1200 } },
      );
      await BillingInvoiceModel.updateOne(
        { _id: invoiceId },
        { $set: { totalAmount: 1700 } },
      );

      // Update claim to match new fingerprint
      const newSource = await claimRepo.source(invoiceId.toString());
      const updatedClaim = await InsuranceClaimModel.findOneAndUpdate(
        { _id: claim._id },
        { $set: { claimedTotal: 1700, sourceFingerprint: newSource.fingerprint } },
        { returnDocument: 'after' },
      ).lean();

      // Revalidate claim
      await claims.validate(
        claim._id.toString(),
        updatedClaim!.version,
        actor,
        { ipAddress: '127.0.0.1' },
      );

      // Re-run mock submission -> preview -> discharge -> adjudication
      const submissionService = new DhaClaimSubmissionService(claimRepo, claims, access);
      await submissionService.mockSubmitClaim(claim._id.toString(), { actorUserId: actor });
      const previewService = new DhaClaimPreviewService(claimRepo, claims, access);
      await previewService.mockPreviewClaim(claim._id.toString(), { actorUserId: actor });
      const dischargeService = new DhaClaimDischargeService(claimRepo, claims, access);
      await dischargeService.mockDischargeClaim(claim._id.toString(), { actorUserId: actor });
      const adjudicationService = new DhaClaimAdjudicationService(claimRepo, claims, access);
      await adjudicationService.mockAdjudicateClaim(claim._id.toString(), {
        decision: 'MOCK_APPROVED',
        actorUserId: actor,
      });

      // Generate second remittance advice
      const secondRemittance = await service.mockGenerateRemittanceAdvice(claim._id.toString(), {
        actorUserId: actor,
      });

      expect(secondRemittance.idempotent).toBe(false);
      expect(secondRemittance.remittanceAdviceId).not.toBe(firstRemittance.remittanceAdviceId);
      expect(secondRemittance.claimedTotal).toBe(1700);
      expect(secondRemittance.remittedTotal).toBe(1700);

      // Verify both records exist in DB
      const records = await DhaMockRemittanceAdviceModel.find({ claimId: claim._id }).sort({ createdAt: 1 });
      expect(records).toHaveLength(2);
      expect(records[0].claimedTotal).toBe(1500);
      expect(records[1].claimedTotal).toBe(1700);
    });
  });

  describe('6. Safety & Non-Mutation Invariants', () => {
    it('executes zero external network requests during mock remittance generation', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_APPROVED');

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await service.mockGenerateRemittanceAdvice(claim._id.toString(), { actorUserId: actor });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fails closed in REAL mode with 503 DHA_REMITTANCE_ADVICE_CONTRACT_UNCONFIRMED', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_APPROVED');

      const unavailableAdapter = new UnavailableDhaRemittanceAdviceAdapter();
      const service = new DhaRemittanceAdviceService(claimRepo, claims, access, unavailableAdapter);

      await expect(
        service.mockGenerateRemittanceAdvice(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_REMITTANCE_ADVICE_CONTRACT_UNCONFIRMED',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not mutate InsuranceClaim status (remains VALIDATED) and readyForShaSubmission remains false', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_APPROVED');

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await service.mockGenerateRemittanceAdvice(claim._id.toString(), { actorUserId: actor });

      const after = await InsuranceClaimModel.findById(claim._id);
      expect(after).not.toBeNull();
      expect(after!.status).toBe('VALIDATED');
      expect(after!.readyForShaSubmission).toBe(false);
    });

    it('does not mutate BillingInvoice or BillingInvoiceItem amounts or statuses', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_APPROVED');

      const invoiceBefore = await BillingInvoiceModel.findById(invoiceId);
      const itemsBefore = await BillingInvoiceItemModel.find({ invoiceId });

      const service = new DhaRemittanceAdviceService(claimRepo, claims, access);
      await service.mockGenerateRemittanceAdvice(claim._id.toString(), { actorUserId: actor });

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
