import { randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors/app-error.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { InsuranceClaimRepository } from '../insurance-claim.repository.js';
import { InsuranceClaimService, externalReadinessCodes } from '../insurance-claim.service.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import { DhaMockClaimSubmissionModel } from './dha-claim-submission.model.js';
import {
  type DhaClaimSubmissionAdapter,
  type DhaClaimSubmissionRequest,
  createDhaClaimSubmissionAdapter,
} from './dha-claim-submission.adapter.js';
import type { RequestMetadata } from '../insurance.types.js';

export interface DhaMockClaimSubmissionResult {
  success: boolean;
  claimId: string;
  externalReference: string;
  source: 'MOCK';
  status: 'SUBMITTED';
  claimedTotal: number;
  idempotent: boolean;
  submittedAt: Date;
}

export class DhaClaimSubmissionService {
  private adapter?: DhaClaimSubmissionAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimSubmissionAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimSubmissionAdapter {
    return this.adapter ?? createDhaClaimSubmissionAdapter();
  }

  /**
   * Submits a claim using the mock DHA claim submission adapter.
   * - Validates claim exists, is not cancelled, and source invoice has not changed.
   * - Requires claim to be VALIDATED (or validates draft claim).
   * - In MOCK mode: returns deterministic synthetic reference, saves isolated mock submission record.
   * - In REAL mode: fails closed (503 DHA_CLAIM_SUBMISSION_CONTRACT_UNCONFIRMED).
   * - Invariant: readyForShaSubmission MUST remain false on the claim.
   * - Invariant: No mutation of invoices, line items, patient payments, or financial ledgers.
   */
  async mockSubmitClaim(
    claimId: string,
    options?: {
      actorUserId?: string;
      correlationId?: string;
      metadata?: RequestMetadata;
    },
  ): Promise<DhaMockClaimSubmissionResult> {
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
        throw new AppError('Claim validation failed', 422, 'CLAIM_NOT_READY_FOR_SUBMISSION');
      }
    }

    if (currentClaim.status !== 'VALIDATED') {
      throw new AppError('Claim is not ready for submission', 422, 'CLAIM_NOT_READY_FOR_SUBMISSION');
    }

    const hasInternalErrors = currentClaim.issues?.some(
      (issue) => issue.severity === 'ERROR' && !externalReadinessCodes.has(issue.code),
    );
    if (hasInternalErrors) {
      throw new AppError('Claim has internal validation errors', 422, 'CLAIM_NOT_READY_FOR_SUBMISSION');
    }

    // Check for existing mock submission with identical sourceFingerprint (idempotent)
    const existingSubmission = await DhaMockClaimSubmissionModel.findOne({
      claimId: currentClaim._id,
      sourceFingerprint: currentClaim.sourceFingerprint,
    }).lean();

    if (existingSubmission) {
      return {
        success: true,
        claimId: currentClaim._id.toString(),
        externalReference: existingSubmission.externalReference,
        source: 'MOCK',
        status: 'SUBMITTED',
        claimedTotal: existingSubmission.claimedTotal,
        idempotent: true,
        submittedAt: existingSubmission.submittedAt,
      };
    }

    const correlationId = options?.correlationId ?? randomUUID();
    const adapter = this.getAdapter();

    const adapterRequest: DhaClaimSubmissionRequest = {
      claimId: currentClaim._id.toString(),
      sourceFingerprint: currentClaim.sourceFingerprint,
      version: currentClaim.version,
      correlationId,
      branchId: currentClaim.branchId.toString(),
      patientId: currentClaim.patientId.toString(),
      memberId: currentClaim.memberId.toString(),
      invoiceId: currentClaim.invoiceId.toString(),
      claimedTotal: currentClaim.claimedTotal,
      lines: (currentClaim.lines ?? []).map((line) => ({
        serviceId: line.serviceId.toString(),
        serviceCode: line.serviceCode,
        quantity: line.quantity,
        claimedUnitAmount: line.claimedUnitAmount,
        claimedAmount: line.claimedAmount,
        interventionCode: line.interventionCode,
        authorizationId: line.authorizationId?.toString(),
      })),
    };

    const decision = await adapter.submitClaim(adapterRequest);

    let submission;
    try {
      submission = await DhaMockClaimSubmissionModel.create({
        claimId: currentClaim._id,
        sourceFingerprint: currentClaim.sourceFingerprint,
        externalReference: decision.externalReference,
        source: 'MOCK',
        status: 'SUBMITTED',
        claimedTotal: currentClaim.claimedTotal,
        submittedAt: decision.submittedAt ?? new Date(),
        correlationId,
        actorUserId: options?.actorUserId,
        version: currentClaim.version,
      });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000) {
        const existing = await DhaMockClaimSubmissionModel.findOne({
          claimId: currentClaim._id,
          sourceFingerprint: currentClaim.sourceFingerprint,
        }).lean();
        if (existing) {
          return {
            success: true,
            claimId: currentClaim._id.toString(),
            externalReference: existing.externalReference,
            source: 'MOCK',
            status: 'SUBMITTED',
            claimedTotal: existing.claimedTotal,
            idempotent: true,
            submittedAt: existing.submittedAt,
          };
        }
      }
      throw error;
    }

    await AuditLogModel.create({
      eventType: 'INSURANCE_CLAIM_MOCK_SUBMITTED',
      actorUserId: options?.actorUserId,
      ...(options?.metadata ?? {}),
      metadataJson: {
        claimId: currentClaim._id.toString(),
        externalReference: decision.externalReference,
        source: 'MOCK',
        status: 'SUBMITTED',
        claimedTotal: currentClaim.claimedTotal,
        readyForShaSubmission: false,
        correlationId,
      },
    });

    return {
      success: true,
      claimId: currentClaim._id.toString(),
      externalReference: decision.externalReference,
      source: 'MOCK',
      status: 'SUBMITTED',
      claimedTotal: currentClaim.claimedTotal,
      idempotent: false,
      submittedAt: submission.submittedAt,
    };
  }
}
