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
import { DhaMockClaimQueryModel } from './dha-claim-query.model.js';
import {
  DhaMockClaimAppealModel,
  type MockClaimAppealStatus,
  type DhaMockClaimAppealSubmissionItem,
} from './dha-claim-appeal.model.js';
import {
  type DhaClaimAppealAdapter,
  type DhaClaimAppealCreateRequest,
  type DhaClaimAppealSubmitRequest,
  createDhaClaimAppealAdapter,
} from './dha-claim-appeal.adapter.js';
import type { RequestMetadata } from '../insurance.types.js';

export interface DhaMockClaimAppealCreateResponse {
  success: boolean;
  source: 'MOCK';
  appealId: string;
  claimId: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  externalAppealReference: string;
  appealReason: string;
  status: MockClaimAppealStatus;
  submissions: Array<{
    submissionReference: string;
    appealNote: string;
    documentIds?: string[];
    submittedAt: Date;
    simulatedOutcome: MockClaimAppealStatus;
    decisionReason?: string;
  }>;
  idempotent: boolean;
  createdAt: Date;
  correlationId: string;
}

export interface DhaMockClaimAppealSubmitResponse {
  success: boolean;
  source: 'MOCK';
  appealId: string;
  claimId: string;
  externalAppealReference: string;
  submissionReference: string;
  status: MockClaimAppealStatus;
  submissions: Array<{
    submissionReference: string;
    appealNote: string;
    documentIds?: string[];
    submittedAt: Date;
    simulatedOutcome: MockClaimAppealStatus;
    decisionReason?: string;
  }>;
  idempotent: boolean;
  submittedAt: Date;
  correlationId: string;
}

export class DhaClaimAppealService {
  private adapter?: DhaClaimAppealAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimAppealAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimAppealAdapter {
    return this.adapter ?? createDhaClaimAppealAdapter();
  }

  /**
   * Records a mock claim appeal following Phase 10.1 adjudication and respecting Phase 10.2 queries.
   * Preconditions:
   * 1. Valid claim exists and is not cancelled.
   * 2. Matching Phase 10.1 adjudication exists and has outcome MOCK_REJECTED or MOCK_PARTIALLY_APPROVED.
   * 3. Adjudication links to current Phase 9.3 mock discharge.
   * 4. Underlying invoice source fingerprint matches claim.
   * 5. No unresolved Phase 10.2 queries exist for this adjudication.
   * 6. In REAL mode: fails closed with 503 DHA_CLAIM_APPEAL_CONTRACT_UNCONFIRMED.
   * 7. Safety Invariant: InsuranceClaimModel.status remains VALIDATED; readyForShaSubmission remains false.
   */
  async mockCreateAppeal(
    claimId: string,
    options?: {
      appealReason?: string;
      actorUserId?: string;
      correlationId?: string;
      metadata?: RequestMetadata;
    },
  ): Promise<DhaMockClaimAppealCreateResponse> {
    if (!Types.ObjectId.isValid(claimId)) {
      throw new AppError('Invalid claim ID format', 400, 'VALIDATION_ERROR');
    }

    const claim = await this.claimRepository.get(claimId);
    if (!claim) {
      throw new AppError('Insurance claim not found', 404, 'CLAIM_NOT_FOUND');
    }

    const actor = options?.actorUserId ?? '';
    if (actor && !(await this.access.hasBranchAccess(actor, claim.branchId.toString()))) {
      throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    }

    if (claim.status === 'CANCELLED') {
      throw new AppError('Cannot appeal a cancelled claim', 409, 'CLAIM_CANCELLED');
    }

    // 1. Resolve Phase 10.1 adjudication record
    const adjudication = await DhaMockClaimAdjudicationModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!adjudication) {
      throw new AppError(
        'Completed Phase 10.1 claim adjudication record required before appealing',
        404,
        'DHA_MOCK_ADJUDICATION_NOT_FOUND',
      );
    }

    // Only MOCK_REJECTED or MOCK_PARTIALLY_APPROVED can be appealed
    if (
      adjudication.status !== 'MOCK_REJECTED' &&
      adjudication.status !== 'MOCK_PARTIALLY_APPROVED'
    ) {
      throw new AppError(
        `Claim adjudication outcome '${adjudication.status}' is not eligible for appeal`,
        422,
        'CLAIM_ADJUDICATION_NOT_APPEALABLE',
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

    // 4. Verify Phase 10.2 query status: must not have an unresolved query
    const existingQuery = await DhaMockClaimQueryModel.findOne({
      claimId: claim._id,
      mockAdjudicationReference: adjudication.externalAdjudicationReference,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (existingQuery && existingQuery.status !== 'MOCK_RESOLVED') {
      throw new AppError(
        'Cannot appeal claim with an unresolved query. Please resolve open query first.',
        409,
        'CLAIM_QUERY_UNRESOLVED',
      );
    }

    // 5. Check for existing mock appeal (idempotency)
    const existingAppeal = await DhaMockClaimAppealModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
      mockAdjudicationReference: adjudication.externalAdjudicationReference,
    }).lean();

    if (existingAppeal) {
      return {
        success: true,
        source: 'MOCK',
        appealId: existingAppeal._id.toString(),
        claimId: claim._id.toString(),
        mockDischargeReference: existingAppeal.mockDischargeReference,
        mockAdjudicationReference: existingAppeal.mockAdjudicationReference,
        externalAppealReference: existingAppeal.externalAppealReference,
        appealReason: existingAppeal.appealReason,
        status: existingAppeal.status,
        submissions: existingAppeal.submissions.map((s) => ({
          submissionReference: s.submissionReference,
          appealNote: s.appealNote,
          documentIds: s.documentIds?.map((id) => id.toString()),
          submittedAt: s.submittedAt,
          simulatedOutcome: s.simulatedOutcome,
          decisionReason: s.decisionReason,
        })),
        idempotent: true,
        createdAt: existingAppeal.createdAt,
        correlationId: existingAppeal.correlationId,
      };
    }

    const correlationId = options?.correlationId ?? randomUUID();
    const adapter = this.getAdapter();

    const adapterRequest: DhaClaimAppealCreateRequest = {
      claimId: claim._id.toString(),
      sourceFingerprint: claim.sourceFingerprint,
      mockDischargeReference: discharge.externalDischargeReference,
      mockAdjudicationReference: adjudication.externalAdjudicationReference,
      appealReason: options?.appealReason,
      correlationId,
      version: claim.version,
    };

    const result = await adapter.createAppeal(adapterRequest);

    let appealRecord;
    try {
      appealRecord = await DhaMockClaimAppealModel.create({
        claimId: claim._id,
        sourceFingerprint: claim.sourceFingerprint,
        mockDischargeReference: discharge.externalDischargeReference,
        mockAdjudicationReference: adjudication.externalAdjudicationReference,
        externalAppealReference: result.externalAppealReference,
        appealReason: result.appealReason,
        source: 'MOCK',
        status: 'OPEN',
        submissions: [],
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
        const existing = await DhaMockClaimAppealModel.findOne({
          claimId: claim._id,
          sourceFingerprint: claim.sourceFingerprint,
          mockAdjudicationReference: adjudication.externalAdjudicationReference,
        }).lean();
        if (existing) {
          return {
            success: true,
            source: 'MOCK',
            appealId: existing._id.toString(),
            claimId: claim._id.toString(),
            mockDischargeReference: existing.mockDischargeReference,
            mockAdjudicationReference: existing.mockAdjudicationReference,
            externalAppealReference: existing.externalAppealReference,
            appealReason: existing.appealReason,
            status: existing.status,
            submissions: existing.submissions.map((s) => ({
              submissionReference: s.submissionReference,
              appealNote: s.appealNote,
              documentIds: s.documentIds?.map((id) => id.toString()),
              submittedAt: s.submittedAt,
              simulatedOutcome: s.simulatedOutcome,
              decisionReason: s.decisionReason,
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
          eventType: 'DHA_MOCK_CLAIM_APPEAL_CREATED',
          actorUserId: options?.actorUserId,
          ...options?.metadata,
          metadataJson: {
            claimId: claim._id.toString(),
            appealId: appealRecord._id.toString(),
            externalAppealReference: appealRecord.externalAppealReference,
            mockAdjudicationReference: adjudication.externalAdjudicationReference,
            status: appealRecord.status,
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
      appealId: appealRecord._id.toString(),
      claimId: claim._id.toString(),
      mockDischargeReference: appealRecord.mockDischargeReference,
      mockAdjudicationReference: appealRecord.mockAdjudicationReference,
      externalAppealReference: appealRecord.externalAppealReference,
      appealReason: appealRecord.appealReason,
      status: appealRecord.status,
      submissions: [],
      idempotent: false,
      createdAt: appealRecord.createdAt,
      correlationId: appealRecord.correlationId,
    };
  }

  /**
   * Submits a mock claim appeal with justification and optional documents, recording a simulated outcome.
   * Preconditions:
   * 1. Valid claim and existing mock appeal in OPEN or SUBMITTED status.
   * 2. Appeal is not already finalized (MOCK_UPHELD or MOCK_OVERTURNED).
   * 3. Underlying invoice source fingerprint remains unchanged.
   * 4. Referenced patient documents must exist and belong to the claim patient in ACTIVE status.
   * 5. In REAL mode: fails closed with 503 DHA_CLAIM_APPEAL_CONTRACT_UNCONFIRMED.
   * 6. Safety Invariant: Authoritative claim status remains VALIDATED; readyForShaSubmission remains false.
   */
  async mockSubmitAppeal(
    claimId: string,
    appealId: string,
    input: {
      appealNote: string;
      documentIds?: string[];
      decision?: 'MOCK_UPHELD' | 'MOCK_OVERTURNED' | 'SUBMITTED';
      decisionReason?: string;
    },
    options?: {
      actorUserId?: string;
      correlationId?: string;
      metadata?: RequestMetadata;
    },
  ): Promise<DhaMockClaimAppealSubmitResponse> {
    if (!Types.ObjectId.isValid(claimId) || !Types.ObjectId.isValid(appealId)) {
      throw new AppError('Invalid claim ID or appeal ID format', 400, 'VALIDATION_ERROR');
    }

    const claim = await this.claimRepository.get(claimId);
    if (!claim) {
      throw new AppError('Insurance claim not found', 404, 'CLAIM_NOT_FOUND');
    }

    const actor = options?.actorUserId ?? '';
    if (actor && !(await this.access.hasBranchAccess(actor, claim.branchId.toString()))) {
      throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    }

    if (claim.status === 'CANCELLED') {
      throw new AppError('Cannot appeal a cancelled claim', 409, 'CLAIM_CANCELLED');
    }

    const appeal = await DhaMockClaimAppealModel.findOne({
      _id: appealId,
      claimId: claim._id,
    });

    if (!appeal) {
      throw new AppError('Mock claim appeal record not found', 404, 'DHA_MOCK_APPEAL_NOT_FOUND');
    }

    if (appeal.status === 'MOCK_UPHELD' || appeal.status === 'MOCK_OVERTURNED') {
      throw new AppError('Appeal has already been decided and cannot be modified', 409, 'APPEAL_ALREADY_DECIDED');
    }

    // Check underlying invoice source fingerprint
    const source = await this.claimRepository.source(claim.invoiceId.toString());
    if (source.fingerprint !== appeal.sourceFingerprint) {
      throw new AppError('Underlying invoice has changed since appeal creation', 409, 'CLAIM_SOURCE_CHANGED');
    }

    // Check for unresolved mandatory query
    const existingQuery = await DhaMockClaimQueryModel.findOne({
      claimId: claim._id,
      mockAdjudicationReference: appeal.mockAdjudicationReference,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (existingQuery && existingQuery.status !== 'MOCK_RESOLVED') {
      throw new AppError(
        'Cannot submit appeal while an unresolved query exists. Please resolve query first.',
        409,
        'CLAIM_QUERY_UNRESOLVED',
      );
    }

    // Validate appealNote
    const trimmedNote = input.appealNote?.trim();
    if (!trimmedNote || trimmedNote.length < 3 || trimmedNote.length > 2000) {
      throw new AppError(
        'Appeal note must be between 3 and 2000 characters',
        400,
        'VALIDATION_ERROR',
      );
    }

    // Validate documentIds against PatientDocumentModel
    const validDocObjectIds: Types.ObjectId[] = [];
    if (input.documentIds && input.documentIds.length > 0) {
      for (const docId of input.documentIds) {
        if (!Types.ObjectId.isValid(docId)) {
          throw new AppError(`Invalid document ID format: ${docId}`, 400, 'VALIDATION_ERROR');
        }
        validDocObjectIds.push(new Types.ObjectId(docId));
      }

      const activeDocs = await PatientDocumentModel.find({
        _id: { $in: validDocObjectIds },
        patientId: claim.patientId,
        status: 'ACTIVE',
      }).lean();

      if (activeDocs.length !== input.documentIds.length) {
        throw new AppError(
          'One or more referenced patient documents were not found or do not belong to this patient',
          404,
          'PATIENT_DOCUMENT_NOT_FOUND',
        );
      }
    }

    const correlationId = options?.correlationId ?? randomUUID();
    const adapter = this.getAdapter();

    const adapterRequest: DhaClaimAppealSubmitRequest = {
      claimId: claim._id.toString(),
      appealId: appeal._id.toString(),
      externalAppealReference: appeal.externalAppealReference,
      appealNote: trimmedNote,
      documentIds: input.documentIds,
      decision: input.decision,
      decisionReason: input.decisionReason,
      correlationId,
    };

    const result = await adapter.submitAppeal(adapterRequest);

    const newSubmissionItem: DhaMockClaimAppealSubmissionItem = {
      submissionReference: result.submissionReference,
      appealNote: trimmedNote,
      documentIds: validDocObjectIds,
      submittedAt: result.submittedAt ?? new Date(),
      submittedBy: options?.actorUserId,
      correlationId,
      simulatedOutcome: result.status,
      decisionReason: result.decisionReason,
    };

    appeal.submissions.push(newSubmissionItem);
    appeal.status = result.status;
    appeal.version += 1;
    await appeal.save();

    try {
      await AuditLogModel.create([
        {
          eventType: 'DHA_MOCK_CLAIM_APPEAL_SUBMITTED',
          actorUserId: options?.actorUserId,
          ...options?.metadata,
          metadataJson: {
            claimId: claim._id.toString(),
            appealId: appeal._id.toString(),
            externalAppealReference: appeal.externalAppealReference,
            submissionReference: result.submissionReference,
            status: appeal.status,
            decisionReason: result.decisionReason,
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
      appealId: appeal._id.toString(),
      claimId: claim._id.toString(),
      externalAppealReference: appeal.externalAppealReference,
      submissionReference: result.submissionReference,
      status: appeal.status,
      submissions: appeal.submissions.map((s) => ({
        submissionReference: s.submissionReference,
        appealNote: s.appealNote,
        documentIds: s.documentIds?.map((id) => id.toString()),
        submittedAt: s.submittedAt,
        simulatedOutcome: s.simulatedOutcome,
        decisionReason: s.decisionReason,
      })),
      idempotent: false,
      submittedAt: newSubmissionItem.submittedAt,
      correlationId,
    };
  }
}
