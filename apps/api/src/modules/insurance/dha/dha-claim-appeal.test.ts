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
import {
  MockDhaClaimAppealAdapter,
  UnavailableDhaClaimAppealAdapter,
  createDhaClaimAppealAdapter,
} from './dha-claim-appeal.adapter.js';
import { DhaClaimSubmissionService } from './dha-claim-submission.service.js';
import { DhaClaimPreviewService } from './dha-claim-preview.service.js';
import { DhaClaimDischargeService } from './dha-claim-discharge.service.js';
import { DhaClaimAdjudicationService } from './dha-claim-adjudication.service.js';
import { DhaClaimAppealService } from './dha-claim-appeal.service.js';

describe('HMS Insurance — Phase 10.3: Mock DHA Claim Appeal Foundation', () => {
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
  const otherPatientId = new Types.ObjectId();
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
  const documentIdOtherPatient = new Types.ObjectId();
  const documentIdInactive = new Types.ObjectId();

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
    await ShaServiceMappingModel.init();
    await InsuranceAuthorizationModel.init();
    await AuditLogModel.init();

    await PatientModel.collection.insertOne({
      _id: patientId,
      patientNumber: 'P-103',
      firstName: 'Evan',
      lastName: 'Appeal',
    });
    await PatientModel.collection.insertOne({
      _id: otherPatientId,
      patientNumber: 'P-999',
      firstName: 'Foreign',
      lastName: 'Patient',
    });
    await OpdVisitModel.collection.insertOne({
      _id: encounterId,
      patientId,
      branchId,
      doctorId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(),
      visitDate: new Date('2026-10-09'),
      patientName: 'Evan Appeal',
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
      memberNumber: 'MEM-103',
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

    // Seed patient documents
    await PatientDocumentModel.collection.insertOne({
      _id: documentId1,
      patientId,
      documentType: 'CLINICAL',
      title: 'Physician Appeal Justification',
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
    await PatientDocumentModel.collection.insertOne({
      _id: documentIdOtherPatient,
      patientId: otherPatientId,
      documentType: 'CLINICAL',
      title: 'Foreign Patient Justification',
      fileName: 'foreign.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
      storageKey: 'patients/docs/foreign.pdf',
      source: 'HOSPITAL',
      reviewStatus: 'NOT_REQUIRED',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await PatientDocumentModel.collection.insertOne({
      _id: documentIdInactive,
      patientId,
      documentType: 'CLINICAL',
      title: 'Archived Letter',
      fileName: 'archived.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 512,
      storageKey: 'patients/docs/archived.pdf',
      source: 'HOSPITAL',
      reviewStatus: 'NOT_REQUIRED',
      status: 'DELETED',
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
    decision: 'MOCK_REJECTED' | 'MOCK_PARTIALLY_APPROVED' | 'MOCK_APPROVED' | 'MOCK_QUERY' = 'MOCK_REJECTED',
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
    it('MockDhaClaimAppealAdapter produces deterministic appeal creation with source=MOCK', async () => {
      const adapter = new MockDhaClaimAppealAdapter();
      expect(adapter.mode).toBe('MOCK');

      const claimId = new Types.ObjectId().toString();
      const result = await adapter.createAppeal({
        claimId,
        sourceFingerprint: 'fp-appeal-01',
        mockDischargeReference: 'MOCK-DISCHARGE-001',
        mockAdjudicationReference: 'MOCK-ADJ-001',
        appealReason: 'Provider disputed denial of critical intervention',
        correlationId: 'corr-adapter-create',
        version: 1,
      });

      expect(result.source).toBe('MOCK');
      expect(result.claimId).toBe(claimId);
      expect(result.status).toBe('OPEN');
      expect(result.externalAppealReference).toMatch(/^MOCK-APPEAL-/);
      expect(result.appealReason).toBe('Provider disputed denial of critical intervention');
      expect(result.correlationId).toBe('corr-adapter-create');
    });

    it('MockDhaClaimAppealAdapter produces deterministic submission with requested decision outcome', async () => {
      const adapter = new MockDhaClaimAppealAdapter();

      const normalSub = await adapter.submitAppeal({
        claimId: new Types.ObjectId().toString(),
        appealId: new Types.ObjectId().toString(),
        externalAppealReference: 'MOCK-APPEAL-123',
        appealNote: 'Submitted clinical documents for review',
        decision: 'SUBMITTED',
        correlationId: 'corr-sub-normal',
      });
      expect(normalSub.source).toBe('MOCK');
      expect(normalSub.submissionReference).toMatch(/^MOCK-APPEAL-SUB-/);
      expect(normalSub.status).toBe('SUBMITTED');

      const overturnedSub = await adapter.submitAppeal({
        claimId: new Types.ObjectId().toString(),
        appealId: new Types.ObjectId().toString(),
        externalAppealReference: 'MOCK-APPEAL-123',
        appealNote: 'Payer granted appeal on secondary review',
        decision: 'MOCK_OVERTURNED',
        correlationId: 'corr-sub-overturned',
      });
      expect(overturnedSub.source).toBe('MOCK');
      expect(overturnedSub.status).toBe('MOCK_OVERTURNED');
      expect(overturnedSub.decisionReason).toBeDefined();

      const upheldSub = await adapter.submitAppeal({
        claimId: new Types.ObjectId().toString(),
        appealId: new Types.ObjectId().toString(),
        externalAppealReference: 'MOCK-APPEAL-123',
        appealNote: 'Payer upheld original denial',
        decision: 'MOCK_UPHELD',
        decisionReason: 'Lack of preauthorization documentation',
        correlationId: 'corr-sub-upheld',
      });
      expect(upheldSub.source).toBe('MOCK');
      expect(upheldSub.status).toBe('MOCK_UPHELD');
      expect(upheldSub.decisionReason).toBe('Lack of preauthorization documentation');
    });

    it('UnavailableDhaClaimAppealAdapter throws 503 for all appeal operations in REAL mode', async () => {
      const adapter = new UnavailableDhaClaimAppealAdapter();
      expect(adapter.mode).toBe('REAL');

      await expect(
        adapter.createAppeal({
          claimId: 'claim-1',
          sourceFingerprint: 'fp',
          mockDischargeReference: 'disc',
          mockAdjudicationReference: 'adj',
          correlationId: 'c',
          version: 1,
        }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_APPEAL_CONTRACT_UNCONFIRMED',
      });

      await expect(
        adapter.submitAppeal({
          claimId: 'claim-1',
          appealId: 'app-1',
          externalAppealReference: 'ref',
          appealNote: 'note',
          correlationId: 'c',
        }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_APPEAL_CONTRACT_UNCONFIRMED',
      });
    });

    it('createDhaClaimAppealAdapter factory returns expected adapter based on environment', () => {
      const mockAdapter = createDhaClaimAppealAdapter({
        integrationMode: 'MOCK',
      } as unknown as Parameters<typeof createDhaClaimAppealAdapter>[0]);
      expect(mockAdapter).toBeInstanceOf(MockDhaClaimAppealAdapter);

      const realAdapter = createDhaClaimAppealAdapter({
        integrationMode: 'REAL',
      } as unknown as Parameters<typeof createDhaClaimAppealAdapter>[0]);
      expect(realAdapter).toBeInstanceOf(UnavailableDhaClaimAppealAdapter);
    });
  });

  describe('2. Service Validation & Appeal Preconditions', () => {
    it('1. Rejects invalid claimId format with 400', async () => {
      const service = new DhaClaimAppealService(claimRepo, claims, access);
      await expect(
        service.mockCreateAppeal('invalid-id', { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    });

    it('2. Rejects non-existent claim with 404', async () => {
      const service = new DhaClaimAppealService(claimRepo, claims, access);
      const missingId = new Types.ObjectId().toString();
      await expect(
        service.mockCreateAppeal(missingId, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'CLAIM_NOT_FOUND' });
    });

    it('3. Rejects access when user lacks branch permission with 403', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');
      vi.spyOn(access, 'hasBranchAccess').mockResolvedValue(false);

      const service = new DhaClaimAppealService(claimRepo, claims, access);
      await expect(
        service.mockCreateAppeal(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });
    });

    it('4. Rejects if claim is CANCELLED with 409', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');
      await InsuranceClaimModel.updateOne({ _id: claim._id }, { $set: { status: 'CANCELLED' } });

      const service = new DhaClaimAppealService(claimRepo, claims, access);
      await expect(
        service.mockCreateAppeal(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CLAIM_CANCELLED' });
    });

    it('5. Rejects if claim has no adjudication record with 404 DHA_MOCK_ADJUDICATION_NOT_FOUND', async () => {
      const created = await claims.create(
        { invoiceId: invoiceId.toString(), memberId: memberId.toString() },
        actor,
        { ipAddress: '127.0.0.1' },
      );
      const validated = await claims.validate(created._id.toString(), created.version, actor, {
        ipAddress: '127.0.0.1',
      });

      const service = new DhaClaimAppealService(claimRepo, claims, access);
      await expect(
        service.mockCreateAppeal(validated._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'DHA_MOCK_ADJUDICATION_NOT_FOUND' });
    });

    it('6a. Rejects MOCK_APPROVED adjudication outcome with 422 CLAIM_ADJUDICATION_NOT_APPEALABLE', async () => {
      const approvedSetup = await setupClaimWithAdjudication('MOCK_APPROVED');
      const service = new DhaClaimAppealService(claimRepo, claims, access);

      await expect(
        service.mockCreateAppeal(approvedSetup.claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 422, code: 'CLAIM_ADJUDICATION_NOT_APPEALABLE' });
    });

    it('6b. Rejects MOCK_QUERY adjudication outcome with 422 CLAIM_ADJUDICATION_NOT_APPEALABLE', async () => {
      const querySetup = await setupClaimWithAdjudication('MOCK_QUERY');
      const service = new DhaClaimAppealService(claimRepo, claims, access);

      await expect(
        service.mockCreateAppeal(querySetup.claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 422, code: 'CLAIM_ADJUDICATION_NOT_APPEALABLE' });
    });

    it('7. Rejects if invoice items changed after adjudication with 409 CLAIM_SOURCE_CHANGED', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');

      // Mutate invoice
      await BillingInvoiceItemModel.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 1200, lineTotal: 1200 } },
      );
      await BillingInvoiceModel.updateOne({ _id: invoiceId }, { $set: { totalAmount: 1700 } });

      const service = new DhaClaimAppealService(claimRepo, claims, access);
      await expect(
        service.mockCreateAppeal(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CLAIM_SOURCE_CHANGED' });
    });

    it('8. Rejects appeal creation when an unresolved Phase 10.2 query exists with 409 CLAIM_QUERY_UNRESOLVED', async () => {
      const { claim, adjudication } = await setupClaimWithAdjudication('MOCK_REJECTED');

      // Insert an open Phase 10.2 query for this adjudication
      await DhaMockClaimQueryModel.collection.insertOne({
        claimId: claim._id,
        sourceFingerprint: claim.sourceFingerprint,
        mockDischargeReference: adjudication.mockDischargeReference,
        mockAdjudicationReference: adjudication.externalAdjudicationReference,
        externalQueryReference: 'MOCK-QUERY-TEST',
        queryReason: 'Pending physician documentation',
        source: 'MOCK',
        status: 'OPEN',
        responses: [],
        correlationId: 'corr-query',
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const service = new DhaClaimAppealService(claimRepo, claims, access);
      await expect(
        service.mockCreateAppeal(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CLAIM_QUERY_UNRESOLVED' });

      // Mark the query as MOCK_RESOLVED; appeal creation should now succeed
      await DhaMockClaimQueryModel.updateOne(
        { externalQueryReference: 'MOCK-QUERY-TEST' },
        { $set: { status: 'MOCK_RESOLVED' } },
      );

      const appeal = await service.mockCreateAppeal(claim._id.toString(), { actorUserId: actor });
      expect(appeal.success).toBe(true);
      expect(appeal.status).toBe('OPEN');
    });
  });

  describe('3. Appeal Creation & Idempotency', () => {
    it('Creates a mock appeal for MOCK_PARTIALLY_APPROVED and records audit log', async () => {
      const { claim, adjudication } = await setupClaimWithAdjudication('MOCK_PARTIALLY_APPROVED');
      const service = new DhaClaimAppealService(claimRepo, claims, access);

      const result = await service.mockCreateAppeal(claim._id.toString(), {
        appealReason: 'Requesting reconsideration of partially denied surgical trays',
        actorUserId: actor,
        correlationId: 'corr-appeal-create',
      });

      expect(result.idempotent).toBe(false);
      expect(result.status).toBe('OPEN');
      expect(result.externalAppealReference).toMatch(/^MOCK-APPEAL-/);
      expect(result.mockAdjudicationReference).toBe(adjudication.externalAdjudicationReference);
      expect(result.appealReason).toBe('Requesting reconsideration of partially denied surgical trays');

      const appealDoc = await DhaMockClaimAppealModel.findById(result.appealId);
      expect(appealDoc).not.toBeNull();
      expect(appealDoc?.status).toBe('OPEN');
      expect(appealDoc?.submissions).toHaveLength(0);

      // Verify audit log
      const audit = await AuditLogModel.findOne({
        eventType: 'DHA_MOCK_CLAIM_APPEAL_CREATED',
        'metadataJson.claimId': claim._id.toString(),
      });
      expect(audit).not.toBeNull();
      expect(audit?.metadataJson?.externalAppealReference).toBe(result.externalAppealReference);
    });

    it('Repeated appeal creation request is idempotent and returns existing appeal', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');
      const service = new DhaClaimAppealService(claimRepo, claims, access);

      const first = await service.mockCreateAppeal(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-app-1',
      });
      expect(first.idempotent).toBe(false);

      const second = await service.mockCreateAppeal(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-app-2',
      });
      expect(second.idempotent).toBe(true);
      expect(second.appealId).toBe(first.appealId);
      expect(second.externalAppealReference).toBe(first.externalAppealReference);

      const count = await DhaMockClaimAppealModel.countDocuments({ claimId: claim._id });
      expect(count).toBe(1);
    });
  });

  describe('4. Appeal Submission & Outcome Determination', () => {
    it('Rejects submission with invalid appealId or missing appeal with 404', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');
      const service = new DhaClaimAppealService(claimRepo, claims, access);

      await expect(
        service.mockSubmitAppeal(claim._id.toString(), new Types.ObjectId().toString(), {
          appealNote: 'Valid note for missing appeal',
        }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'DHA_MOCK_APPEAL_NOT_FOUND' });
    });

    it('Rejects appeal notes shorter than 3 or longer than 2000 chars with 400', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');
      const service = new DhaClaimAppealService(claimRepo, claims, access);
      const created = await service.mockCreateAppeal(claim._id.toString(), { actorUserId: actor });

      await expect(
        service.mockSubmitAppeal(claim._id.toString(), created.appealId, {
          appealNote: 'no',
        }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });

      await expect(
        service.mockSubmitAppeal(claim._id.toString(), created.appealId, {
          appealNote: 'x'.repeat(2001),
        }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    });

    it('Rejects submission with documentId not belonging to patient with 404', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');
      const service = new DhaClaimAppealService(claimRepo, claims, access);
      const created = await service.mockCreateAppeal(claim._id.toString(), { actorUserId: actor });

      await expect(
        service.mockSubmitAppeal(claim._id.toString(), created.appealId, {
          appealNote: 'Attaching foreign document',
          documentIds: [documentIdOtherPatient.toString()],
        }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'PATIENT_DOCUMENT_NOT_FOUND' });

      await expect(
        service.mockSubmitAppeal(claim._id.toString(), created.appealId, {
          appealNote: 'Attaching deleted document',
          documentIds: [documentIdInactive.toString()],
        }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'PATIENT_DOCUMENT_NOT_FOUND' });
    });

    it('Submits appeal with valid document reference and transitions status to SUBMITTED', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');
      const service = new DhaClaimAppealService(claimRepo, claims, access);
      const created = await service.mockCreateAppeal(claim._id.toString(), { actorUserId: actor });

      const submitResult = await service.mockSubmitAppeal(claim._id.toString(), created.appealId, {
        appealNote: 'Detailed physician justification attached showing emergency indication',
        documentIds: [documentId1.toString()],
        decision: 'SUBMITTED',
      }, { actorUserId: actor, correlationId: 'corr-sub-1' });

      expect(submitResult.status).toBe('SUBMITTED');
      expect(submitResult.submissionReference).toMatch(/^MOCK-APPEAL-SUB-/);

      const doc = await DhaMockClaimAppealModel.findById(created.appealId);
      expect(doc?.status).toBe('SUBMITTED');
      expect(doc?.submissions).toHaveLength(1);
      expect(doc?.submissions[0].appealNote).toBe('Detailed physician justification attached showing emergency indication');
      expect(doc?.submissions[0].documentIds).toEqual([documentId1]);

      const audit = await AuditLogModel.findOne({
        eventType: 'DHA_MOCK_CLAIM_APPEAL_SUBMITTED',
        'metadataJson.appealId': created.appealId,
      });
      expect(audit).not.toBeNull();
      expect(audit?.metadataJson?.status).toBe('SUBMITTED');
    });

    it('Supports simulated MOCK_OVERTURNED decision outcome', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');
      const service = new DhaClaimAppealService(claimRepo, claims, access);
      const created = await service.mockCreateAppeal(claim._id.toString(), { actorUserId: actor });

      const result = await service.mockSubmitAppeal(claim._id.toString(), created.appealId, {
        appealNote: 'Dispute validated by medical panel review',
        decision: 'MOCK_OVERTURNED',
        decisionReason: 'Secondary audit confirmed clinical necessity',
      }, { actorUserId: actor });

      expect(result.status).toBe('MOCK_OVERTURNED');

      const doc = await DhaMockClaimAppealModel.findById(created.appealId);
      expect(doc?.status).toBe('MOCK_OVERTURNED');
      expect(doc?.submissions[0].simulatedOutcome).toBe('MOCK_OVERTURNED');
      expect(doc?.submissions[0].decisionReason).toBe('Secondary audit confirmed clinical necessity');
    });

    it('Supports simulated MOCK_UPHELD decision outcome', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');
      const service = new DhaClaimAppealService(claimRepo, claims, access);
      const created = await service.mockCreateAppeal(claim._id.toString(), { actorUserId: actor });

      const result = await service.mockSubmitAppeal(claim._id.toString(), created.appealId, {
        appealNote: 'Appeal rejected upon secondary review',
        decision: 'MOCK_UPHELD',
        decisionReason: 'Intervention not covered under selected tier',
      }, { actorUserId: actor });

      expect(result.status).toBe('MOCK_UPHELD');

      const doc = await DhaMockClaimAppealModel.findById(created.appealId);
      expect(doc?.status).toBe('MOCK_UPHELD');
      expect(doc?.submissions[0].simulatedOutcome).toBe('MOCK_UPHELD');
    });

    it('Rejects modifying an appeal that has already reached final decision (MOCK_UPHELD or MOCK_OVERTURNED) with 409', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');
      const service = new DhaClaimAppealService(claimRepo, claims, access);
      const created = await service.mockCreateAppeal(claim._id.toString(), { actorUserId: actor });

      await service.mockSubmitAppeal(claim._id.toString(), created.appealId, {
        appealNote: 'First submission grants overturn',
        decision: 'MOCK_OVERTURNED',
      }, { actorUserId: actor });

      await expect(
        service.mockSubmitAppeal(claim._id.toString(), created.appealId, {
          appealNote: 'Attempt to submit after decision is finalized',
        }, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'APPEAL_ALREADY_DECIDED' });
    });
  });

  describe('5. Safety Invariants & REAL Mode Fail-Closed', () => {
    it('REAL mode fails closed (503) without network calls', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');
      const unavailableAdapter = new UnavailableDhaClaimAppealAdapter();
      const service = new DhaClaimAppealService(claimRepo, claims, access, unavailableAdapter);

      await expect(
        service.mockCreateAppeal(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_APPEAL_CONTRACT_UNCONFIRMED',
      });

      expect(mockFetch).not.toHaveBeenCalled();
      const count = await DhaMockClaimAppealModel.countDocuments();
      expect(count).toBe(0);
    });

    it('Guarantees zero mutation to claim status, readyForShaSubmission, invoices, or payments', async () => {
      const invoiceBefore = await BillingInvoiceModel.findById(invoiceId).lean();
      const itemsBefore = await BillingInvoiceItemModel.find({ invoiceId }).sort({ _id: 1 }).lean();

      const { claim } = await setupClaimWithAdjudication('MOCK_REJECTED');
      const service = new DhaClaimAppealService(claimRepo, claims, access);

      const created = await service.mockCreateAppeal(claim._id.toString(), { actorUserId: actor });
      await service.mockSubmitAppeal(claim._id.toString(), created.appealId, {
        appealNote: 'Appeal granted in developer simulation',
        decision: 'MOCK_OVERTURNED',
      }, { actorUserId: actor });

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
