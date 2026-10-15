import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { AppError } from '../../../shared/errors/app-error.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { InsuranceClaimRepository } from '../insurance-claim.repository.js';
import { InsuranceClaimService, externalReadinessCodes } from '../insurance-claim.service.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import {
  DhaMockClaimAdjudicationModel,
  type MockAdjudicationStatus,
} from './dha-claim-adjudication.model.js';
import { DhaMockClaimDischargeModel } from './dha-claim-discharge.model.js';
import {
  type DhaClaimAdjudicationAdapter,
  type DhaClaimAdjudicationRequest,
  type DhaClaimAdjudicationLineResult,
  createDhaClaimAdjudicationAdapter,
} from './dha-claim-adjudication.adapter.js';
import type { RequestMetadata } from '../insurance.types.js';

export interface DhaMockClaimAdjudicationResponse {
  success: boolean;
  source: 'MOCK';
  claimId: string;
  mockDischargeReference: string;
  externalAdjudicationReference: string;
  status: MockAdjudicationStatus;
  claimedTotal: number;
  adjudicatedTotal: number;
  lines: DhaClaimAdjudicationLineResult[];
  idempotent: boolean;
  adjudicatedAt: Date;
  correlationId: string;
}

export class DhaClaimAdjudicationService {
  private adapter?: DhaClaimAdjudicationAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimAdjudicationAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimAdjudicationAdapter {
    return this.adapter ?? createDhaClaimAdjudicationAdapter();
  }

  /**
   * Records a deterministic mock claim adjudication result for development/testing.
   * Preconditions:
   * 1. Valid claim exists and is not cancelled.
   * 2. Matching Phase 9.3 mock discharge exists for the claim and matches current source fingerprint.
   * 3. Underlying invoice source fingerprint matches claim.
   * 4. Claim satisfies internal validation / integrity requirements.
   * 5. In REAL mode: fails closed with 503 DHA_CLAIM_ADJUDICATION_CONTRACT_UNCONFIRMED.
   * 6. Safety Invariant: InsuranceClaimModel.status remains VALIDATED; readyForShaSubmission remains false.
   * 7. Safety Invariant: No mutation of invoices, line items, patient payments, or financial ledgers.
   */
  async mockAdjudicateClaim(
    claimId: string,
    options?: {
      decision?: MockAdjudicationStatus;
      actorUserId?: string;
      correlationId?: string;
      metadata?: RequestMetadata;
    },
  ): Promise<DhaMockClaimAdjudicationResponse> {
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

    // 1. Resolve Phase 9.3 mock discharge record
    const discharge = await DhaMockClaimDischargeModel.findOne({
      claimId: claim._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!discharge) {
      throw new AppError(
        'No DHA mock discharge found for this claim',
        404,
        'DHA_MOCK_DISCHARGE_NOT_FOUND',
      );
    }

    if (discharge.claimId.toString() !== claim._id.toString()) {
      throw new AppError('Mock discharge belongs to another claim', 409, 'CLAIM_DISCHARGE_MISMATCH');
    }

    if (discharge.sourceFingerprint !== claim.sourceFingerprint) {
      throw new AppError(
        'Claim source fingerprint does not match discharge fingerprint',
        409,
        'STALE_MOCK_DISCHARGE',
      );
    }

    // 2. Check underlying invoice source fingerprint
    const source = await this.claimRepository.source(claim.invoiceId.toString());
    if (source.fingerprint !== claim.sourceFingerprint) {
      throw new AppError('Underlying invoice has changed since claim creation', 409, 'CLAIM_SOURCE_CHANGED');
    }

    // 3. Claim validation / readiness check
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
        throw new AppError('Claim validation failed', 422, 'CLAIM_NOT_READY_FOR_ADJUDICATION');
      }
    }

    if (currentClaim.status !== 'VALIDATED') {
      throw new AppError('Claim validation blockers prevent adjudication', 422, 'CLAIM_NOT_READY_FOR_ADJUDICATION');
    }

    const hasInternalErrors = currentClaim.issues?.some(
      (issue) => issue.severity === 'ERROR' && !externalReadinessCodes.has(issue.code),
    );
    if (hasInternalErrors) {
      throw new AppError('Claim has internal validation errors', 422, 'CLAIM_NOT_READY_FOR_ADJUDICATION');
    }

    // 4. Check for existing mock adjudication with identical sourceFingerprint (idempotent)
    const existingAdjudication = await DhaMockClaimAdjudicationModel.findOne({
      claimId: currentClaim._id,
      sourceFingerprint: currentClaim.sourceFingerprint,
    }).lean();

    if (existingAdjudication) {
      return {
        success: true,
        source: 'MOCK',
        claimId: currentClaim._id.toString(),
        mockDischargeReference: existingAdjudication.mockDischargeReference,
        externalAdjudicationReference: existingAdjudication.externalAdjudicationReference,
        status: existingAdjudication.status,
        claimedTotal: existingAdjudication.claimedTotal,
        adjudicatedTotal: existingAdjudication.adjudicatedTotal,
        lines: existingAdjudication.lines.map((l) => ({
          invoiceItemId: l.invoiceItemId.toString(),
          serviceId: l.serviceId.toString(),
          serviceCode: l.serviceCode,
          quantity: l.quantity,
          claimedAmount: l.claimedAmount,
          adjudicatedAmount: l.adjudicatedAmount,
          status: l.status,
          reason: l.reason,
        })),
        idempotent: true,
        adjudicatedAt: existingAdjudication.adjudicatedAt,
        correlationId: existingAdjudication.correlationId,
      };
    }

    const correlationId = options?.correlationId ?? randomUUID();
    const adapter = this.getAdapter();

    const adapterRequest: DhaClaimAdjudicationRequest = {
      claimId: currentClaim._id.toString(),
      sourceFingerprint: currentClaim.sourceFingerprint,
      mockDischargeReference: discharge.externalDischargeReference,
      claimedTotal: currentClaim.claimedTotal,
      lines:
        currentClaim.lines?.map((l) => ({
          invoiceItemId: l.invoiceItemId.toString(),
          serviceId: l.serviceId.toString(),
          serviceCode: l.serviceCode,
          quantity: l.quantity,
          claimedAmount: l.claimedAmount,
        })) ?? [],
      decision: options?.decision,
      correlationId,
      version: currentClaim.version,
    };

    const decision = await adapter.adjudicateClaim(adapterRequest);

    let adjudicationRecord;
    try {
      adjudicationRecord = await DhaMockClaimAdjudicationModel.create({
        claimId: currentClaim._id,
        sourceFingerprint: currentClaim.sourceFingerprint,
        mockDischargeReference: discharge.externalDischargeReference,
        externalAdjudicationReference: decision.externalAdjudicationReference,
        source: 'MOCK',
        status: decision.status,
        claimedTotal: currentClaim.claimedTotal,
        adjudicatedTotal: decision.adjudicatedTotal,
        lines: decision.lines.map((l) => ({
          invoiceItemId: new Types.ObjectId(l.invoiceItemId),
          serviceId: new Types.ObjectId(l.serviceId),
          serviceCode: l.serviceCode,
          quantity: l.quantity,
          claimedAmount: l.claimedAmount,
          adjudicatedAmount: l.adjudicatedAmount,
          status: l.status,
          reason: l.reason,
        })),
        adjudicatedAt: decision.adjudicatedAt ?? new Date(),
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
        const existing = await DhaMockClaimAdjudicationModel.findOne({
          claimId: currentClaim._id,
          sourceFingerprint: currentClaim.sourceFingerprint,
        }).lean();
        if (existing) {
          return {
            success: true,
            source: 'MOCK',
            claimId: currentClaim._id.toString(),
            mockDischargeReference: existing.mockDischargeReference,
            externalAdjudicationReference: existing.externalAdjudicationReference,
            status: existing.status,
            claimedTotal: existing.claimedTotal,
            adjudicatedTotal: existing.adjudicatedTotal,
            lines: existing.lines.map((l) => ({
              invoiceItemId: l.invoiceItemId.toString(),
              serviceId: l.serviceId.toString(),
              serviceCode: l.serviceCode,
              quantity: l.quantity,
              claimedAmount: l.claimedAmount,
              adjudicatedAmount: l.adjudicatedAmount,
              status: l.status,
              reason: l.reason,
            })),
            idempotent: true,
            adjudicatedAt: existing.adjudicatedAt,
            correlationId: existing.correlationId,
          };
        }
      }
      throw error;
    }

    try {
      await AuditLogModel.create([
        {
          eventType: 'DHA_MOCK_CLAIM_ADJUDICATED',
          actorUserId: options?.actorUserId,
          ...options?.metadata,
          metadataJson: {
            claimId: currentClaim._id.toString(),
            mockDischargeReference: discharge.externalDischargeReference,
            externalAdjudicationReference: decision.externalAdjudicationReference,
            status: decision.status,
            source: 'MOCK',
            claimedTotal: currentClaim.claimedTotal,
            adjudicatedTotal: decision.adjudicatedTotal,
          },
        },
      ]);
    } catch {
      // Audit failure must not fail the primary business operation
    }

    return {
      success: true,
      source: 'MOCK',
      claimId: currentClaim._id.toString(),
      mockDischargeReference: adjudicationRecord.mockDischargeReference,
      externalAdjudicationReference: adjudicationRecord.externalAdjudicationReference,
      status: adjudicationRecord.status,
      claimedTotal: adjudicationRecord.claimedTotal,
      adjudicatedTotal: adjudicationRecord.adjudicatedTotal,
      lines: decision.lines,
      idempotent: false,
      adjudicatedAt: adjudicationRecord.adjudicatedAt,
      correlationId,
    };
  }
}
