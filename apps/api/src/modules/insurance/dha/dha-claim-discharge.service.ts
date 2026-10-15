import { randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors/app-error.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { InsuranceClaimRepository } from '../insurance-claim.repository.js';
import { InsuranceClaimService, externalReadinessCodes } from '../insurance-claim.service.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import { DhaMockClaimSubmissionModel } from './dha-claim-submission.model.js';
import { DhaMockClaimPreviewModel } from './dha-claim-preview.model.js';
import { DhaMockClaimDischargeModel } from './dha-claim-discharge.model.js';
import {
  type DhaClaimDischargeAdapter,
  type DhaClaimDischargeRequest,
  createDhaClaimDischargeAdapter,
} from './dha-claim-discharge.adapter.js';
import type { RequestMetadata } from '../insurance.types.js';

export interface DhaMockClaimDischargeResponse {
  success: boolean;
  source: 'MOCK';
  claimId: string;
  mockSubmissionReference: string;
  externalDischargeReference: string;
  status: 'MOCK_DISCHARGED';
  claimedTotal: number;
  lineCount: number;
  idempotent: boolean;
  dischargedAt: Date;
  correlationId: string;
}

export class DhaClaimDischargeService {
  private adapter?: DhaClaimDischargeAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimDischargeAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimDischargeAdapter {
    return this.adapter ?? createDhaClaimDischargeAdapter();
  }

  /**
   * Generates a deterministic mock claim discharge / final submission for development/testing.
   * Preconditions:
   * 1. Valid claim exists and is not cancelled.
   * 2. Matching Phase 9.1 mock submission exists and matches claim and source fingerprint.
   * 3. Underlying invoice source fingerprint matches claim.
   * 4. Phase 9.2 preview exists, matches submission, and status is PREVIEW_AVAILABLE.
   * 5. Claim validation passes without internal blockers.
   * 6. In REAL mode: fails closed with 503 DHA_CLAIM_DISCHARGE_CONTRACT_UNCONFIRMED.
   * 7. Safety Invariant: readyForShaSubmission remains false; no mutation to invoices, payments, or claims.
   */
  async mockDischargeClaim(
    claimId: string,
    options?: {
      actorUserId?: string;
      correlationId?: string;
      metadata?: RequestMetadata;
    },
  ): Promise<DhaMockClaimDischargeResponse> {
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

    // 1. Resolve Phase 9.1 mock submission record
    const submission = await DhaMockClaimSubmissionModel.findOne({
      claimId: claim._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!submission) {
      throw new AppError('No DHA mock submission found for this claim', 404, 'DHA_MOCK_SUBMISSION_NOT_FOUND');
    }

    if (submission.claimId.toString() !== claim._id.toString()) {
      throw new AppError('Mock submission belongs to another claim', 409, 'CLAIM_SUBMISSION_MISMATCH');
    }

    if (submission.sourceFingerprint !== claim.sourceFingerprint) {
      throw new AppError(
        'Claim source fingerprint does not match submission fingerprint',
        409,
        'STALE_MOCK_SUBMISSION',
      );
    }

    // 2. Check underlying invoice source fingerprint
    const source = await this.claimRepository.source(claim.invoiceId.toString());
    if (source.fingerprint !== claim.sourceFingerprint) {
      throw new AppError('Underlying invoice has changed since claim creation', 409, 'CLAIM_SOURCE_CHANGED');
    }

    // 3. Resolve Phase 9.2 mock preview record
    const preview = await DhaMockClaimPreviewModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
    }).lean();

    if (!preview) {
      throw new AppError('No DHA mock preview found for this claim and source fingerprint', 404, 'DHA_MOCK_PREVIEW_NOT_FOUND');
    }

    if (preview.mockSubmissionReference !== submission.externalReference) {
      throw new AppError('Preview references different submission', 409, 'PREVIEW_SUBMISSION_MISMATCH');
    }

    if (preview.status !== 'PREVIEW_AVAILABLE') {
      throw new AppError('Mock preview status does not permit discharge', 422, 'CLAIM_PREVIEW_BLOCKED');
    }

    // 4. Claim validation / readiness check
    let currentClaim = claim;
    if (currentClaim.status === 'DRAFT') {
      try {
        currentClaim = await this.claimService.validate(
          claimId,
          currentClaim.version,
          actor,
          options?.metadata ?? {},
        );
      } catch (error) {
        if (
          error instanceof AppError &&
          (error.code === 'STALE_CLAIM' ||
            error.code === 'CLAIM_CANCELLED' ||
            error.code === 'BRANCH_ACCESS_DENIED')
        ) {
          throw error;
        }
        throw new AppError('Claim validation failed', 422, 'CLAIM_NOT_READY_FOR_DISCHARGE');
      }
    }

    if (currentClaim.status !== 'VALIDATED') {
      throw new AppError('Claim validation blockers prevent discharge', 422, 'CLAIM_NOT_READY_FOR_DISCHARGE');
    }

    const hasInternalErrors = currentClaim.issues?.some(
      (issue) => issue.severity === 'ERROR' && !externalReadinessCodes.has(issue.code),
    );
    if (hasInternalErrors) {
      throw new AppError('Claim has internal validation errors', 422, 'CLAIM_NOT_READY_FOR_DISCHARGE');
    }

    // 5. Check for existing mock discharge with identical sourceFingerprint (idempotent)
    const existingDischarge = await DhaMockClaimDischargeModel.findOne({
      claimId: currentClaim._id,
      sourceFingerprint: currentClaim.sourceFingerprint,
    }).lean();

    if (existingDischarge) {
      return {
        success: true,
        source: 'MOCK',
        claimId: currentClaim._id.toString(),
        mockSubmissionReference: existingDischarge.mockSubmissionReference,
        externalDischargeReference: existingDischarge.externalDischargeReference,
        status: existingDischarge.status,
        claimedTotal: existingDischarge.claimedTotal,
        lineCount: existingDischarge.lineCount,
        idempotent: true,
        dischargedAt: existingDischarge.dischargedAt,
        correlationId: existingDischarge.correlationId,
      };
    }

    const correlationId = options?.correlationId ?? randomUUID();
    const adapter = this.getAdapter();

    const adapterRequest: DhaClaimDischargeRequest = {
      claimId: currentClaim._id.toString(),
      sourceFingerprint: currentClaim.sourceFingerprint,
      mockSubmissionReference: submission.externalReference,
      mockPreviewStatus: preview.status,
      version: currentClaim.version,
      correlationId,
      claimedTotal: currentClaim.claimedTotal,
      lineCount: currentClaim.lines?.length ?? 0,
    };

    const decision = await adapter.dischargeClaim(adapterRequest);

    let dischargeRecord;
    try {
      dischargeRecord = await DhaMockClaimDischargeModel.create({
        claimId: currentClaim._id,
        sourceFingerprint: currentClaim.sourceFingerprint,
        mockSubmissionReference: submission.externalReference,
        externalDischargeReference: decision.externalDischargeReference,
        source: 'MOCK',
        status: 'MOCK_DISCHARGED',
        claimedTotal: currentClaim.claimedTotal,
        lineCount: currentClaim.lines?.length ?? 0,
        dischargedAt: decision.dischargedAt ?? new Date(),
        correlationId,
        actorUserId: options?.actorUserId,
        version: currentClaim.version,
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        const existing = await DhaMockClaimDischargeModel.findOne({
          claimId: currentClaim._id,
          sourceFingerprint: currentClaim.sourceFingerprint,
        }).lean();
        if (existing) {
          return {
            success: true,
            source: 'MOCK',
            claimId: currentClaim._id.toString(),
            mockSubmissionReference: existing.mockSubmissionReference,
            externalDischargeReference: existing.externalDischargeReference,
            status: existing.status,
            claimedTotal: existing.claimedTotal,
            lineCount: existing.lineCount,
            idempotent: true,
            dischargedAt: existing.dischargedAt,
            correlationId: existing.correlationId,
          };
        }
      }
      throw error;
    }

    await AuditLogModel.create({
      eventType: 'INSURANCE_CLAIM_MOCK_DISCHARGED',
      actorUserId: options?.actorUserId,
      ...(options?.metadata ?? {}),
      metadataJson: {
        claimId: currentClaim._id.toString(),
        mockSubmissionReference: submission.externalReference,
        externalDischargeReference: decision.externalDischargeReference,
        source: 'MOCK',
        status: decision.status,
        claimedTotal: currentClaim.claimedTotal,
        lineCount: currentClaim.lines?.length ?? 0,
        readyForShaSubmission: false,
        correlationId,
      },
    });

    return {
      success: true,
      source: 'MOCK',
      claimId: currentClaim._id.toString(),
      mockSubmissionReference: submission.externalReference,
      externalDischargeReference: decision.externalDischargeReference,
      status: decision.status,
      claimedTotal: currentClaim.claimedTotal,
      lineCount: currentClaim.lines?.length ?? 0,
      idempotent: false,
      dischargedAt: dischargeRecord.dischargedAt,
      correlationId,
    };
  }
}
