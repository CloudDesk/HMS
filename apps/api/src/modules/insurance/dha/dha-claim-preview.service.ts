import { randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors/app-error.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { InsuranceClaimRepository } from '../insurance-claim.repository.js';
import { InsuranceClaimService, externalReadinessCodes } from '../insurance-claim.service.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import { DhaMockClaimSubmissionModel } from './dha-claim-submission.model.js';
import { DhaMockClaimPreviewModel } from './dha-claim-preview.model.js';
import {
  type DhaClaimPreviewAdapter,
  type DhaClaimPreviewRequest,
  createDhaClaimPreviewAdapter,
} from './dha-claim-preview.adapter.js';
import type { RequestMetadata } from '../insurance.types.js';

export interface DhaMockClaimPreviewResponse {
  success: boolean;
  source: 'MOCK';
  claimId: string;
  mockSubmissionReference: string;
  status: 'PREVIEW_AVAILABLE' | 'PREVIEW_BLOCKED';
  lineCount: number;
  claimedTotal: number;
  issues: Array<{
    code: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
    message?: string;
    invoiceItemId?: string;
  }>;
  idempotent: boolean;
  previewedAt: Date;
  correlationId: string;
}

export class DhaClaimPreviewService {
  private adapter?: DhaClaimPreviewAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimPreviewAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimPreviewAdapter {
    return this.adapter ?? createDhaClaimPreviewAdapter();
  }

  /**
   * Generates a deterministic mock claim preview for development/testing.
   * Preconditions:
   * 1. Valid claim exists and is not cancelled.
   * 2. Phase 9.1 mock submission exists and matches current claim and source fingerprint.
   * 3. Underlying invoice source fingerprint matches claim.
   * 4. Claim validation passes without internal blockers.
   * 5. In REAL mode: fails closed with 503 DHA_CLAIM_PREVIEW_CONTRACT_UNCONFIRMED.
   * 6. Safety Invariant: readyForShaSubmission remains false; no mutation to invoices, payments, or claims.
   */
  async mockPreviewClaim(
    claimId: string,
    options?: {
      actorUserId?: string;
      correlationId?: string;
      metadata?: RequestMetadata;
    },
  ): Promise<DhaMockClaimPreviewResponse> {
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

    // Resolve Phase 9.1 mock submission record
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

    // Check underlying invoice source fingerprint
    const source = await this.claimRepository.source(claim.invoiceId.toString());
    if (source.fingerprint !== claim.sourceFingerprint) {
      throw new AppError('Underlying invoice has changed since claim creation', 409, 'CLAIM_SOURCE_CHANGED');
    }

    // Claim validation / readiness check
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
        throw new AppError('Claim validation failed', 422, 'CLAIM_NOT_READY_FOR_PREVIEW');
      }
    }

    if (currentClaim.status !== 'VALIDATED') {
      throw new AppError('Claim validation blockers prevent preview', 422, 'CLAIM_NOT_READY_FOR_PREVIEW');
    }

    const hasInternalErrors = currentClaim.issues?.some(
      (issue) => issue.severity === 'ERROR' && !externalReadinessCodes.has(issue.code),
    );
    if (hasInternalErrors) {
      throw new AppError('Claim has internal validation errors', 422, 'CLAIM_NOT_READY_FOR_PREVIEW');
    }

    // Check for existing mock preview with identical sourceFingerprint (idempotent)
    const existingPreview = await DhaMockClaimPreviewModel.findOne({
      claimId: currentClaim._id,
      sourceFingerprint: currentClaim.sourceFingerprint,
    }).lean();

    if (existingPreview) {
      return {
        success: true,
        source: 'MOCK',
        claimId: currentClaim._id.toString(),
        mockSubmissionReference: existingPreview.mockSubmissionReference,
        status: existingPreview.status,
        lineCount: existingPreview.lineCount,
        claimedTotal: existingPreview.claimedTotal,
        issues: existingPreview.issues,
        idempotent: true,
        previewedAt: existingPreview.previewedAt,
        correlationId: existingPreview.correlationId,
      };
    }

    const correlationId = options?.correlationId ?? randomUUID();
    const adapter = this.getAdapter();

    const adapterRequest: DhaClaimPreviewRequest = {
      claimId: currentClaim._id.toString(),
      mockSubmissionReference: submission.externalReference,
      sourceFingerprint: currentClaim.sourceFingerprint,
      version: currentClaim.version,
      correlationId,
      claimedTotal: currentClaim.claimedTotal,
      lineCount: currentClaim.lines?.length ?? 0,
      lines: (currentClaim.lines ?? []).map((line) => ({
        serviceId: line.serviceId.toString(),
        serviceCode: line.serviceCode,
        quantity: line.quantity,
        claimedAmount: line.claimedAmount,
        interventionCode: line.interventionCode,
      })),
      issues: currentClaim.issues ?? [],
    };

    const decision = await adapter.previewClaim(adapterRequest);

    let previewRecord;
    try {
      previewRecord = await DhaMockClaimPreviewModel.create({
        claimId: currentClaim._id,
        sourceFingerprint: currentClaim.sourceFingerprint,
        mockSubmissionReference: submission.externalReference,
        source: 'MOCK',
        status: decision.status,
        claimedTotal: currentClaim.claimedTotal,
        lineCount: currentClaim.lines?.length ?? 0,
        issues: currentClaim.issues ?? [],
        previewedAt: decision.previewedAt ?? new Date(),
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
        const existing = await DhaMockClaimPreviewModel.findOne({
          claimId: currentClaim._id,
          sourceFingerprint: currentClaim.sourceFingerprint,
        }).lean();
        if (existing) {
          return {
            success: true,
            source: 'MOCK',
            claimId: currentClaim._id.toString(),
            mockSubmissionReference: existing.mockSubmissionReference,
            status: existing.status,
            lineCount: existing.lineCount,
            claimedTotal: existing.claimedTotal,
            issues: existing.issues,
            idempotent: true,
            previewedAt: existing.previewedAt,
            correlationId: existing.correlationId,
          };
        }
      }
      throw error;
    }

    await AuditLogModel.create({
      eventType: 'INSURANCE_CLAIM_MOCK_PREVIEWED',
      actorUserId: options?.actorUserId,
      ...(options?.metadata ?? {}),
      metadataJson: {
        claimId: currentClaim._id.toString(),
        mockSubmissionReference: submission.externalReference,
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
      status: decision.status,
      lineCount: currentClaim.lines?.length ?? 0,
      claimedTotal: currentClaim.claimedTotal,
      issues: currentClaim.issues ?? [],
      idempotent: false,
      previewedAt: previewRecord.previewedAt,
      correlationId,
    };
  }
}
