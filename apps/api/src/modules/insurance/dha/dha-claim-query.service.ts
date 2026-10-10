import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { AppError } from '../../../shared/errors/app-error.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { PatientDocumentModel } from '../../patients/patient.model.js';
import { InsuranceClaimRepository } from '../insurance-claim.repository.js';
import { InsuranceClaimService } from '../insurance-claim.service.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import { DhaMockClaimAdjudicationModel } from './dha-claim-adjudication.model.js';
import { DhaMockClaimDischargeModel } from './dha-claim-discharge.model.js';
import {
  DhaMockClaimQueryModel,
  type MockClaimQueryStatus,
  type DhaMockClaimQueryResponseItem,
} from './dha-claim-query.model.js';
import {
  type DhaClaimQueryAdapter,
  type DhaClaimQueryCreateRequest,
  type DhaClaimQueryRespondRequest,
  createDhaClaimQueryAdapter,
} from './dha-claim-query.adapter.js';
import type { RequestMetadata } from '../insurance.types.js';

export interface DhaMockClaimQueryCreateResponse {
  success: boolean;
  source: 'MOCK';
  queryId: string;
  claimId: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  externalQueryReference: string;
  queryReason: string;
  status: MockClaimQueryStatus;
  responses: Array<{
    responseReference: string;
    responseNote: string;
    documentIds?: string[];
    respondedAt: Date;
    simulatedOutcome: 'RESPONSE_SUBMITTED' | 'MOCK_RESOLVED';
  }>;
  idempotent: boolean;
  createdAt: Date;
  correlationId: string;
}

export interface DhaMockClaimQueryRespondResponse {
  success: boolean;
  source: 'MOCK';
  queryId: string;
  claimId: string;
  externalQueryReference: string;
  responseReference: string;
  status: MockClaimQueryStatus;
  responses: Array<{
    responseReference: string;
    responseNote: string;
    documentIds?: string[];
    respondedAt: Date;
    simulatedOutcome: 'RESPONSE_SUBMITTED' | 'MOCK_RESOLVED';
  }>;
  idempotent: boolean;
  respondedAt: Date;
  correlationId: string;
}

export class DhaClaimQueryService {
  private adapter?: DhaClaimQueryAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimQueryAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimQueryAdapter {
    return this.adapter ?? createDhaClaimQueryAdapter();
  }

  /**
   * Records a mock claim query following Phase 10.1 adjudication.
   * Preconditions:
   * 1. Valid claim exists and is not cancelled.
   * 2. Matching Phase 10.1 adjudication exists and has outcome MOCK_QUERY.
   * 3. Adjudication links to current Phase 9.3 mock discharge.
   * 4. Underlying invoice source fingerprint matches claim.
   * 5. In REAL mode: fails closed with 503 DHA_CLAIM_QUERY_CONTRACT_UNCONFIRMED.
   * 6. Safety Invariant: InsuranceClaimModel.status remains VALIDATED; readyForShaSubmission remains false.
   */
  async mockCreateQuery(
    claimId: string,
    options?: {
      queryReason?: string;
      actorUserId?: string;
      correlationId?: string;
      metadata?: RequestMetadata;
    },
  ): Promise<DhaMockClaimQueryCreateResponse> {
    const isIdValid = /^[a-f\d]{24}$/i.test(claimId);
    if (!isIdValid) {
      throw new AppError('Invalid claim ID format', 400, 'VALIDATION_ERROR');
    }

    const claim = await this.claimRepository.get(claimId);
    if (!claim) {
      throw new AppError('Claim not found', 404, 'CLAIM_NOT_FOUND');
    }

    const actor = options?.actorUserId ?? '';
    if (actor && !(await this.access.hasBranchAccess(actor, claim.branchId.toString()))) {
      throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    }

    if (claim.status === 'CANCELLED') {
      throw new AppError('Claim is cancelled', 409, 'CLAIM_CANCELLED');
    }

    // 1. Resolve Phase 10.1 adjudication record
    const adjudication = await DhaMockClaimAdjudicationModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
    }).lean();

    if (!adjudication) {
      throw new AppError(
        'No DHA mock adjudication found for this claim',
        404,
        'DHA_MOCK_ADJUDICATION_NOT_FOUND',
      );
    }

    if (adjudication.status !== 'MOCK_QUERY') {
      throw new AppError(
        'Claim adjudication status is not MOCK_QUERY',
        422,
        'CLAIM_ADJUDICATION_NOT_A_QUERY',
      );
    }

    // 2. Resolve Phase 9.3 mock discharge record
    const discharge = await DhaMockClaimDischargeModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
    }).lean();

    if (
      !discharge ||
      discharge.externalDischargeReference !== adjudication.mockDischargeReference
    ) {
      throw new AppError(
        'Adjudication does not match active discharge reference',
        409,
        'DISCHARGE_ADJUDICATION_MISMATCH',
      );
    }

    // 3. Check underlying invoice source fingerprint
    const source = await this.claimRepository.source(claim.invoiceId.toString());
    if (source.fingerprint !== claim.sourceFingerprint) {
      throw new AppError('Underlying invoice has changed since claim creation', 409, 'CLAIM_SOURCE_CHANGED');
    }

    // 4. Check for existing mock query (idempotent)
    const existingQuery = await DhaMockClaimQueryModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
      mockAdjudicationReference: adjudication.externalAdjudicationReference,
    }).lean();

    if (existingQuery) {
      return {
        success: true,
        source: 'MOCK',
        queryId: existingQuery._id.toString(),
        claimId: claim._id.toString(),
        mockDischargeReference: existingQuery.mockDischargeReference,
        mockAdjudicationReference: existingQuery.mockAdjudicationReference,
        externalQueryReference: existingQuery.externalQueryReference,
        queryReason: existingQuery.queryReason,
        status: existingQuery.status,
        responses: existingQuery.responses.map((r) => ({
          responseReference: r.responseReference,
          responseNote: r.responseNote,
          documentIds: r.documentIds?.map((id) => id.toString()),
          respondedAt: r.respondedAt,
          simulatedOutcome: r.simulatedOutcome,
        })),
        idempotent: true,
        createdAt: existingQuery.createdAt,
        correlationId: existingQuery.correlationId,
      };
    }

    const correlationId = options?.correlationId ?? randomUUID();
    const adapter = this.getAdapter();

    const adapterRequest: DhaClaimQueryCreateRequest = {
      claimId: claim._id.toString(),
      sourceFingerprint: claim.sourceFingerprint,
      mockDischargeReference: discharge.externalDischargeReference,
      mockAdjudicationReference: adjudication.externalAdjudicationReference,
      queryReason: options?.queryReason,
      correlationId,
      version: claim.version,
    };

    const result = await adapter.createQuery(adapterRequest);

    let queryRecord;
    try {
      queryRecord = await DhaMockClaimQueryModel.create({
        claimId: claim._id,
        sourceFingerprint: claim.sourceFingerprint,
        mockDischargeReference: discharge.externalDischargeReference,
        mockAdjudicationReference: adjudication.externalAdjudicationReference,
        externalQueryReference: result.externalQueryReference,
        queryReason: result.queryReason,
        source: 'MOCK',
        status: 'OPEN',
        responses: [],
        correlationId,
        actorUserId: options?.actorUserId,
        version: claim.version,
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        const existing = await DhaMockClaimQueryModel.findOne({
          claimId: claim._id,
          sourceFingerprint: claim.sourceFingerprint,
          mockAdjudicationReference: adjudication.externalAdjudicationReference,
        }).lean();
        if (existing) {
          return {
            success: true,
            source: 'MOCK',
            queryId: existing._id.toString(),
            claimId: claim._id.toString(),
            mockDischargeReference: existing.mockDischargeReference,
            mockAdjudicationReference: existing.mockAdjudicationReference,
            externalQueryReference: existing.externalQueryReference,
            queryReason: existing.queryReason,
            status: existing.status,
            responses: existing.responses.map((r) => ({
              responseReference: r.responseReference,
              responseNote: r.responseNote,
              documentIds: r.documentIds?.map((id) => id.toString()),
              respondedAt: r.respondedAt,
              simulatedOutcome: r.simulatedOutcome,
            })),
            idempotent: true,
            createdAt: existing.createdAt,
            correlationId: existing.correlationId,
          };
        }
      }
      throw error;
    }

    try {
      await AuditLogModel.create([
        {
          eventType: 'DHA_MOCK_CLAIM_QUERY_CREATED',
          actorUserId: options?.actorUserId,
          ...options?.metadata,
          metadataJson: {
            claimId: claim._id.toString(),
            queryId: queryRecord._id.toString(),
            externalQueryReference: queryRecord.externalQueryReference,
            mockAdjudicationReference: adjudication.externalAdjudicationReference,
            status: queryRecord.status,
            source: 'MOCK',
          },
        },
      ]);
    } catch {
      // Audit failure must not block business logic
    }

    return {
      success: true,
      source: 'MOCK',
      queryId: queryRecord._id.toString(),
      claimId: claim._id.toString(),
      mockDischargeReference: queryRecord.mockDischargeReference,
      mockAdjudicationReference: queryRecord.mockAdjudicationReference,
      externalQueryReference: queryRecord.externalQueryReference,
      queryReason: queryRecord.queryReason,
      status: queryRecord.status,
      responses: [],
      idempotent: false,
      createdAt: queryRecord.createdAt,
      correlationId,
    };
  }

  /**
   * Records a response to an existing open mock claim query.
   */
  async mockRespondToQuery(
    claimId: string,
    queryId: string,
    input: {
      responseNote: string;
      documentIds?: string[];
      resolveImmediately?: boolean;
    },
    options?: {
      actorUserId?: string;
      correlationId?: string;
      metadata?: RequestMetadata;
    },
  ): Promise<DhaMockClaimQueryRespondResponse> {
    const isClaimIdValid = /^[a-f\d]{24}$/i.test(claimId);
    const isQueryIdValid = /^[a-f\d]{24}$/i.test(queryId);
    if (!isClaimIdValid || !isQueryIdValid) {
      throw new AppError('Invalid ID format', 400, 'VALIDATION_ERROR');
    }

    const claim = await this.claimRepository.get(claimId);
    if (!claim) {
      throw new AppError('Claim not found', 404, 'CLAIM_NOT_FOUND');
    }

    const actor = options?.actorUserId ?? '';
    if (actor && !(await this.access.hasBranchAccess(actor, claim.branchId.toString()))) {
      throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    }

    if (claim.status === 'CANCELLED') {
      throw new AppError('Claim is cancelled', 409, 'CLAIM_CANCELLED');
    }

    const query = await DhaMockClaimQueryModel.findOne({
      _id: queryId,
      claimId: claim._id,
    });

    if (!query) {
      throw new AppError('No DHA mock query found for this claim', 404, 'DHA_MOCK_QUERY_NOT_FOUND');
    }

    if (query.status === 'MOCK_RESOLVED') {
      throw new AppError('Query is already resolved', 409, 'QUERY_ALREADY_RESOLVED');
    }

    // Check underlying invoice source fingerprint
    const source = await this.claimRepository.source(claim.invoiceId.toString());
    if (source.fingerprint !== claim.sourceFingerprint) {
      throw new AppError('Underlying invoice has changed since claim creation', 409, 'CLAIM_SOURCE_CHANGED');
    }

    // Validate response note
    const trimmedNote = input.responseNote?.trim() ?? '';
    if (trimmedNote.length < 3 || trimmedNote.length > 2000) {
      throw new AppError(
        'Response note must be between 3 and 2000 characters',
        400,
        'VALIDATION_ERROR',
      );
    }

    // Validate document references if provided
    let validDocObjectIds: Types.ObjectId[] = [];
    if (input.documentIds && input.documentIds.length > 0) {
      for (const docId of input.documentIds) {
        if (!/^[a-f\d]{24}$/i.test(docId)) {
          throw new AppError('Invalid document ID format', 400, 'VALIDATION_ERROR');
        }
      }
      validDocObjectIds = input.documentIds.map((id) => new Types.ObjectId(id));
      const docCount = await PatientDocumentModel.countDocuments({
        _id: { $in: validDocObjectIds },
        patientId: claim.patientId,
        status: 'ACTIVE',
      });
      if (docCount !== validDocObjectIds.length) {
        throw new AppError(
          'Referenced patient document not found or belongs to another patient',
          404,
          'PATIENT_DOCUMENT_NOT_FOUND',
        );
      }
    }

    const correlationId = options?.correlationId ?? randomUUID();

    // Check for exact idempotent repeated response
    const existingResponse = query.responses.find(
      (r) => r.responseNote === trimmedNote && r.correlationId === correlationId,
    );
    if (existingResponse) {
      return {
        success: true,
        source: 'MOCK',
        queryId: query._id.toString(),
        claimId: claim._id.toString(),
        externalQueryReference: query.externalQueryReference,
        responseReference: existingResponse.responseReference,
        status: query.status,
        responses: query.responses.map((r) => ({
          responseReference: r.responseReference,
          responseNote: r.responseNote,
          documentIds: r.documentIds?.map((id) => id.toString()),
          respondedAt: r.respondedAt,
          simulatedOutcome: r.simulatedOutcome,
        })),
        idempotent: true,
        respondedAt: existingResponse.respondedAt,
        correlationId,
      };
    }

    const adapter = this.getAdapter();
    const adapterRequest: DhaClaimQueryRespondRequest = {
      claimId: claim._id.toString(),
      queryId: query._id.toString(),
      externalQueryReference: query.externalQueryReference,
      responseNote: trimmedNote,
      documentIds: input.documentIds,
      resolveImmediately: input.resolveImmediately,
      correlationId,
    };

    const result = await adapter.respondToQuery(adapterRequest);

    const newResponseItem: DhaMockClaimQueryResponseItem = {
      responseReference: result.responseReference,
      responseNote: trimmedNote,
      documentIds: validDocObjectIds,
      respondedAt: result.respondedAt ?? new Date(),
      respondedBy: options?.actorUserId,
      correlationId,
      simulatedOutcome: result.status,
    };

    query.responses.push(newResponseItem);
    query.status = result.status;
    query.version += 1;
    await query.save();

    try {
      await AuditLogModel.create([
        {
          eventType: 'DHA_MOCK_CLAIM_QUERY_RESPONDED',
          actorUserId: options?.actorUserId,
          ...options?.metadata,
          metadataJson: {
            claimId: claim._id.toString(),
            queryId: query._id.toString(),
            externalQueryReference: query.externalQueryReference,
            responseReference: result.responseReference,
            status: query.status,
            source: 'MOCK',
          },
        },
      ]);
    } catch {
      // Audit failure must not block business logic
    }

    return {
      success: true,
      source: 'MOCK',
      queryId: query._id.toString(),
      claimId: claim._id.toString(),
      externalQueryReference: query.externalQueryReference,
      responseReference: result.responseReference,
      status: query.status,
      responses: query.responses.map((r) => ({
        responseReference: r.responseReference,
        responseNote: r.responseNote,
        documentIds: r.documentIds?.map((id) => id.toString()),
        respondedAt: r.respondedAt,
        simulatedOutcome: r.simulatedOutcome,
      })),
      idempotent: false,
      respondedAt: result.respondedAt,
      correlationId,
    };
  }
}
