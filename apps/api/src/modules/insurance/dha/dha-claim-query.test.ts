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
import {
  MockDhaClaimQueryAdapter,
  UnavailableDhaClaimQueryAdapter,
  createDhaClaimQueryAdapter,
} from './dha-claim-query.adapter.js';
import { DhaClaimSubmissionService } from './dha-claim-submission.service.js';
import { DhaClaimPreviewService } from './dha-claim-preview.service.js';
import { DhaClaimDischargeService } from './dha-claim-discharge.service.js';
import { DhaClaimAdjudicationService } from './dha-claim-adjudication.service.js';
import { DhaClaimQueryService } from './dha-claim-query.service.js';

describe('HMS Insurance — Phase 10.2: Mock DHA Claim Query & Response Foundation', () => {
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
    await ShaServiceMappingModel.init();
    await InsuranceAuthorizationModel.init();
    await AuditLogModel.init();

    await PatientModel.collection.insertOne({
      _id: patientId,
      patientNumber: 'P-102',
      firstName: 'Diana',
      lastName: 'Query',
    });
    await PatientModel.collection.insertOne({
      _id: otherPatientId,
      patientNumber: 'P-999',
      firstName: 'Other',
      lastName: 'Patient',
    });
    await OpdVisitModel.collection.insertOne({
      _id: encounterId,
      patientId,
      branchId,
      doctorId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(),
      visitDate: new Date('2026-10-09'),
      patientName: 'Diana Query',
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
      memberNumber: 'MEM-102',
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

    // Seed patient documents for testing reference validation
    await PatientDocumentModel.collection.insertOne({
      _id: documentId1,
      patientId,
      documentType: 'CLINICAL',
      title: 'Operative Notes',
      fileName: 'op-notes.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 2048,
      storageKey: 'patients/docs/op-notes.pdf',
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
      title: 'Other Patient Report',
      fileName: 'other.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
      storageKey: 'patients/docs/other.pdf',
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
      title: 'Deleted Lab Report',
      fileName: 'lab-deleted.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 512,
      storageKey: 'patients/docs/lab-deleted.pdf',
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
   * Helper to set up a claim through Submission -> Preview -> Discharge -> Adjudication (MOCK_QUERY)
   */
  const setupClaimWithAdjudication = async (decision: 'MOCK_QUERY' | 'MOCK_APPROVED' = 'MOCK_QUERY') => {
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
    it('MockDhaClaimQueryAdapter produces deterministic query creation with source=MOCK', async () => {
      const adapter = new MockDhaClaimQueryAdapter();
      expect(adapter.mode).toBe('MOCK');

      const claimId = new Types.ObjectId().toString();
      const result = await adapter.createQuery({
        claimId,
        sourceFingerprint: 'fp-123',
        mockDischargeReference: 'MOCK-DISCHARGE-001',
        mockAdjudicationReference: 'MOCK-ADJ-001',
        queryReason: 'Clarification required on line items',
        correlationId: 'corr-adapter-create',
        version: 1,
      });

      expect(result.source).toBe('MOCK');
      expect(result.claimId).toBe(claimId);
      expect(result.status).toBe('OPEN');
      expect(result.externalQueryReference).toMatch(/^MOCK-QUERY-/);
      expect(result.queryReason).toBe('Clarification required on line items');
      expect(result.correlationId).toBe('corr-adapter-create');
    });

    it('MockDhaClaimQueryAdapter produces deterministic response with source=MOCK and requested status', async () => {
      const adapter = new MockDhaClaimQueryAdapter();

      const normalResp = await adapter.respondToQuery({
        claimId: new Types.ObjectId().toString(),
        queryId: new Types.ObjectId().toString(),
        externalQueryReference: 'MOCK-QUERY-123',
        responseNote: 'Here is the requested clinical documentation',
        resolveImmediately: false,
        correlationId: 'corr-resp-normal',
      });

      expect(normalResp.source).toBe('MOCK');
      expect(normalResp.responseReference).toMatch(/^MOCK-QUERY-RESP-/);
      expect(normalResp.status).toBe('RESPONSE_SUBMITTED');

      const resolvedResp = await adapter.respondToQuery({
        claimId: new Types.ObjectId().toString(),
        queryId: new Types.ObjectId().toString(),
        externalQueryReference: 'MOCK-QUERY-123',
        responseNote: 'Fully resolved after discussion with medical auditor',
        resolveImmediately: true,
        correlationId: 'corr-resp-resolved',
      });

      expect(resolvedResp.source).toBe('MOCK');
      expect(resolvedResp.status).toBe('MOCK_RESOLVED');
    });

    it('UnavailableDhaClaimQueryAdapter throws 503 for all query operations in REAL mode', async () => {
      const adapter = new UnavailableDhaClaimQueryAdapter();
      expect(adapter.mode).toBe('REAL');

      await expect(
        adapter.createQuery({
          claimId: 'claim-1',
          sourceFingerprint: 'fp',
          mockDischargeReference: 'disc',
          mockAdjudicationReference: 'adj',
          correlationId: 'c',
          version: 1,
        }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_QUERY_CONTRACT_UNCONFIRMED',
      });

      await expect(
        adapter.respondToQuery({
          claimId: 'claim-1',
          queryId: 'q-1',
          externalQueryReference: 'ref',
          responseNote: 'note',
          correlationId: 'c',
        }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_QUERY_CONTRACT_UNCONFIRMED',
      });
    });

    it('createDhaClaimQueryAdapter factory returns expected adapter based on environment', () => {
      const mockAdapter = createDhaClaimQueryAdapter({
        integrationMode: 'MOCK',
      } as unknown as Parameters<typeof createDhaClaimQueryAdapter>[0]);
      expect(mockAdapter).toBeInstanceOf(MockDhaClaimQueryAdapter);

      const realAdapter = createDhaClaimQueryAdapter({
        integrationMode: 'REAL',
      } as unknown as Parameters<typeof createDhaClaimQueryAdapter>[0]);
      expect(realAdapter).toBeInstanceOf(UnavailableDhaClaimQueryAdapter);
    });
  });

  describe('2. Service Validation & Prerequisites', () => {
    it('Rejects invalid claimId format with 400', async () => {
      const service = new DhaClaimQueryService(claimRepo, claims, access);
      await expect(
        service.mockCreateQuery('invalid-id', { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    });

    it('Rejects non-existent claim with 404', async () => {
      const service = new DhaClaimQueryService(claimRepo, claims, access);
      const missingId = new Types.ObjectId().toString();
      await expect(
        service.mockCreateQuery(missingId, { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'CLAIM_NOT_FOUND' });
    });

    it('Rejects access when user lacks branch permission with 403', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      vi.spyOn(access, 'hasBranchAccess').mockResolvedValue(false);

      const service = new DhaClaimQueryService(claimRepo, claims, access);
      await expect(
        service.mockCreateQuery(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });
    });

    it('Rejects if claim is CANCELLED with 409', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      await InsuranceClaimModel.updateOne({ _id: claim._id }, { $set: { status: 'CANCELLED' } });

      const service = new DhaClaimQueryService(claimRepo, claims, access);
      await expect(
        service.mockCreateQuery(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CLAIM_CANCELLED' });
    });

    it('Rejects if claim has no adjudication record with 404 DHA_MOCK_ADJUDICATION_NOT_FOUND', async () => {
      const created = await claims.create(
        { invoiceId: invoiceId.toString(), memberId: memberId.toString() },
        actor,
        { ipAddress: '127.0.0.1' },
      );
      const validated = await claims.validate(created._id.toString(), created.version, actor, {
        ipAddress: '127.0.0.1',
      });

      const service = new DhaClaimQueryService(claimRepo, claims, access);
      await expect(
        service.mockCreateQuery(validated._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'DHA_MOCK_ADJUDICATION_NOT_FOUND' });
    });

    it('Rejects if adjudication outcome is not MOCK_QUERY with 422 CLAIM_ADJUDICATION_NOT_A_QUERY', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_APPROVED');

      const service = new DhaClaimQueryService(claimRepo, claims, access);
      await expect(
        service.mockCreateQuery(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 422, code: 'CLAIM_ADJUDICATION_NOT_A_QUERY' });
    });

    it('Rejects if invoice items changed after adjudication with 409 CLAIM_SOURCE_FINGERPRINT_STALE', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');

      // Mutate invoice after adjudication
      await BillingInvoiceItemModel.updateOne(
        { _id: invoiceItemId1 },
        { $set: { unitPrice: 1200, lineTotal: 1200 } },
      );
      await BillingInvoiceModel.updateOne({ _id: invoiceId }, { $set: { totalAmount: 1700 } });

      const service = new DhaClaimQueryService(claimRepo, claims, access);
      await expect(
        service.mockCreateQuery(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CLAIM_SOURCE_CHANGED' });
    });
  });

  describe('3. Query Creation & Idempotency', () => {
    it('Creates a mock query with status OPEN and records audit log', async () => {
      const { claim, adjudication } = await setupClaimWithAdjudication('MOCK_QUERY');
      const service = new DhaClaimQueryService(claimRepo, claims, access);

      const result = await service.mockCreateQuery(claim._id.toString(), {
        queryReason: 'Please upload physician orders and nursing notes',
        actorUserId: actor,
        correlationId: 'corr-query-create',
      });

      expect(result.idempotent).toBe(false);
      expect(result.status).toBe('OPEN');
      expect(result.externalQueryReference).toMatch(/^MOCK-QUERY-/);
      expect(result.mockAdjudicationReference).toBe(adjudication.externalAdjudicationReference);
      expect(result.queryReason).toBe('Please upload physician orders and nursing notes');

      // Verify saved in DB
      const queryDoc = await DhaMockClaimQueryModel.findById(result.queryId);
      expect(queryDoc).not.toBeNull();
      expect(queryDoc?.status).toBe('OPEN');
      expect(queryDoc?.responses).toHaveLength(0);

      // Verify audit log
      const audit = await AuditLogModel.findOne({
        eventType: 'DHA_MOCK_CLAIM_QUERY_CREATED',
        'metadataJson.claimId': claim._id.toString(),
      });
      expect(audit).not.toBeNull();
      expect(audit?.metadataJson?.externalQueryReference).toBe(result.externalQueryReference);
    });

    it('Repeated query creation is idempotent and returns existing record', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      const service = new DhaClaimQueryService(claimRepo, claims, access);

      const first = await service.mockCreateQuery(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-q-1',
      });
      expect(first.idempotent).toBe(false);

      const second = await service.mockCreateQuery(claim._id.toString(), {
        actorUserId: actor,
        correlationId: 'corr-q-2',
      });
      expect(second.idempotent).toBe(true);
      expect(second.queryId).toBe(first.queryId);
      expect(second.externalQueryReference).toBe(first.externalQueryReference);
      expect(second.status).toBe(first.status);

      const count = await DhaMockClaimQueryModel.countDocuments({ claimId: claim._id });
      expect(count).toBe(1);
    });
  });

  describe('4. Responding to Queries', () => {
    it('Rejects response with invalid queryId format or missing query with 404', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      const service = new DhaClaimQueryService(claimRepo, claims, access);

      await expect(
        service.mockRespondToQuery(claim._id.toString(), new Types.ObjectId().toString(), {
          responseNote: 'Valid note for missing query',
          actorUserId: actor,
        }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'DHA_MOCK_QUERY_NOT_FOUND' });
    });

    it('Rejects response note that is too short or too long with 400', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      const service = new DhaClaimQueryService(claimRepo, claims, access);

      const created = await service.mockCreateQuery(claim._id.toString(), { actorUserId: actor });

      await expect(
        service.mockRespondToQuery(claim._id.toString(), created.queryId, {
          responseNote: 'ab', // < 3 characters
          actorUserId: actor,
        }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });

      await expect(
        service.mockRespondToQuery(claim._id.toString(), created.queryId, {
          responseNote: 'a'.repeat(2001), // > 2000 characters
          actorUserId: actor,
        }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    });

    it('Rejects response with invalid documentId format with 400', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      const service = new DhaClaimQueryService(claimRepo, claims, access);
      const created = await service.mockCreateQuery(claim._id.toString(), { actorUserId: actor });

      await expect(
        service.mockRespondToQuery(claim._id.toString(), created.queryId, {
          responseNote: 'Here are the documents',
          documentIds: ['not-an-objectid'],
          actorUserId: actor,
        }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    });

    it('Rejects response with documentId that does not exist or belongs to another patient with 404', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      const service = new DhaClaimQueryService(claimRepo, claims, access);
      const created = await service.mockCreateQuery(claim._id.toString(), { actorUserId: actor });

      // Document belonging to other patient
      await expect(
        service.mockRespondToQuery(claim._id.toString(), created.queryId, {
          responseNote: 'Document belonging to another patient',
          documentIds: [documentIdOtherPatient.toString()],
          actorUserId: actor,
        }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'PATIENT_DOCUMENT_NOT_FOUND' });

      // Inactive (DELETED) document
      await expect(
        service.mockRespondToQuery(claim._id.toString(), created.queryId, {
          responseNote: 'Deleted document reference',
          documentIds: [documentIdInactive.toString()],
          actorUserId: actor,
        }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'PATIENT_DOCUMENT_NOT_FOUND' });
    });

    it('Submits response with valid document reference and transitions status to RESPONSE_SUBMITTED', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      const service = new DhaClaimQueryService(claimRepo, claims, access);
      const created = await service.mockCreateQuery(claim._id.toString(), { actorUserId: actor });

      const responseResult = await service.mockRespondToQuery(claim._id.toString(), created.queryId, {
        responseNote: 'Attached the operative notes requested by medical director',
        documentIds: [documentId1.toString()],
        resolveImmediately: false,
        actorUserId: actor,
        correlationId: 'corr-resp-1',
      });

      expect(responseResult.status).toBe('RESPONSE_SUBMITTED');
      expect(responseResult.responseReference).toMatch(/^MOCK-QUERY-RESP-/);

      // Verify DB update
      const updatedDoc = await DhaMockClaimQueryModel.findById(created.queryId);
      expect(updatedDoc?.status).toBe('RESPONSE_SUBMITTED');
      expect(updatedDoc?.responses).toHaveLength(1);
      expect(updatedDoc?.responses[0].responseNote).toBe('Attached the operative notes requested by medical director');
      expect(updatedDoc?.responses[0].documentIds).toEqual([documentId1]);
      expect(updatedDoc?.responses[0].simulatedOutcome).toBe('RESPONSE_SUBMITTED');

      // Verify audit log
      const audit = await AuditLogModel.findOne({
        eventType: 'DHA_MOCK_CLAIM_QUERY_RESPONDED',
        'metadataJson.queryId': created.queryId,
      });
      expect(audit).not.toBeNull();
      expect(audit?.metadataJson?.status).toBe('RESPONSE_SUBMITTED');
    });

    it('Supports multiple responses, preserving full history in responses array', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      const service = new DhaClaimQueryService(claimRepo, claims, access);
      const created = await service.mockCreateQuery(claim._id.toString(), { actorUserId: actor });

      // First response
      await service.mockRespondToQuery(claim._id.toString(), created.queryId, {
        responseNote: 'First round of notes submitted',
        actorUserId: actor,
      });

      // Second response
      await service.mockRespondToQuery(claim._id.toString(), created.queryId, {
        responseNote: 'Second round: attached additional clarification',
        documentIds: [documentId1.toString()],
        actorUserId: actor,
      });

      const updatedDoc = await DhaMockClaimQueryModel.findById(created.queryId);
      expect(updatedDoc?.responses).toHaveLength(2);
      expect(updatedDoc?.responses[0].responseNote).toBe('First round of notes submitted');
      expect(updatedDoc?.responses[1].responseNote).toBe('Second round: attached additional clarification');
    });

    it('Resolves query when resolveImmediately is true and sets status to MOCK_RESOLVED', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      const service = new DhaClaimQueryService(claimRepo, claims, access);
      const created = await service.mockCreateQuery(claim._id.toString(), { actorUserId: actor });

      const resolved = await service.mockRespondToQuery(claim._id.toString(), created.queryId, {
        responseNote: 'Clarification accepted by DHA auditor; resolving query',
        resolveImmediately: true,
        actorUserId: actor,
      });

      expect(resolved.status).toBe('MOCK_RESOLVED');

      const doc = await DhaMockClaimQueryModel.findById(created.queryId);
      expect(doc?.status).toBe('MOCK_RESOLVED');
    });

    it('Rejects responding to an already MOCK_RESOLVED query with 409 QUERY_ALREADY_RESOLVED', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      const service = new DhaClaimQueryService(claimRepo, claims, access);
      const created = await service.mockCreateQuery(claim._id.toString(), { actorUserId: actor });

      // Resolve query
      await service.mockRespondToQuery(claim._id.toString(), created.queryId, {
        responseNote: 'Resolving query now',
        resolveImmediately: true,
        actorUserId: actor,
      });

      // Attempt to respond again
      await expect(
        service.mockRespondToQuery(claim._id.toString(), created.queryId, {
          responseNote: 'Attempt to respond after resolution',
          actorUserId: actor,
        }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'QUERY_ALREADY_RESOLVED' });
    });
  });

  describe('5. Safety Invariants & REAL Mode Fail-Closed', () => {
    it('REAL mode fails closed (503) without network calls', async () => {
      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      const unavailableAdapter = new UnavailableDhaClaimQueryAdapter();
      const service = new DhaClaimQueryService(claimRepo, claims, access, unavailableAdapter);

      await expect(
        service.mockCreateQuery(claim._id.toString(), { actorUserId: actor }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DHA_CLAIM_QUERY_CONTRACT_UNCONFIRMED',
      });

      expect(mockFetch).not.toHaveBeenCalled();
      const count = await DhaMockClaimQueryModel.countDocuments();
      expect(count).toBe(0);
    });

    it('Guarantees zero mutation to claim status, readyForShaSubmission, invoices, or payments', async () => {
      const invoiceBefore = await BillingInvoiceModel.findById(invoiceId).lean();
      const itemsBefore = await BillingInvoiceItemModel.find({ invoiceId }).sort({ _id: 1 }).lean();

      const { claim } = await setupClaimWithAdjudication('MOCK_QUERY');
      const service = new DhaClaimQueryService(claimRepo, claims, access);

      const created = await service.mockCreateQuery(claim._id.toString(), { actorUserId: actor });
      await service.mockRespondToQuery(claim._id.toString(), created.queryId, {
        responseNote: 'Resolving test query completely',
        resolveImmediately: true,
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
