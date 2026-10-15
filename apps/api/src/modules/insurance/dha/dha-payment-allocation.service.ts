import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { AppError } from '../../../shared/errors/app-error.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { InsuranceClaimRepository } from '../insurance-claim.repository.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import { DhaMockRemittanceAdviceModel } from './dha-remittance-advice.model.js';
import {
  DhaMockPaymentAllocationModel,
  type MockPaymentAllocationStatus,
} from './dha-payment-allocation.model.js';
import {
  type DhaPaymentAllocationAdapter,
  createDhaPaymentAllocationAdapter,
} from './dha-payment-allocation.adapter.js';
import type { RequestMetadata } from '../insurance.types.js';

export interface DhaMockPaymentAllocationInput {
  amount: number;
  currency?: string;
  idempotencyKey?: string;
}

export interface DhaMockPaymentAllocationResponse {
  success: boolean;
  source: 'MOCK';
  allocationId: string;
  claimId: string;
  remittanceAdviceId: string;
  externalRemittanceReference: string;
  externalAllocationReference: string;
  status: MockPaymentAllocationStatus;
  currency: string;
  allocatedAmount: number;
  previouslyAllocatedTotal: number;
  newlyAllocatedTotal: number;
  remainingAllocatableAmount: number;
  idempotent: boolean;
  allocatedAt: Date;
  correlationId: string;
}

export class DhaPaymentAllocationService {
  private adapter?: DhaPaymentAllocationAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaPaymentAllocationAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaPaymentAllocationAdapter {
    return this.adapter ?? createDhaPaymentAllocationAdapter();
  }

  /**
   * Allocates a simulated remitted amount against an existing Phase 10.4 remittance advice.
   * Preconditions:
   * 1. Valid claim and remittance advice IDs exist.
   * 2. Branch access is verified.
   * 3. Claim is not cancelled.
   * 4. Remittance advice exists, matches current claim fingerprint, source is MOCK, and status is MOCK_REMITTED.
   * 5. Underlying invoice has not changed since claim creation.
   * 6. Requested amount is valid (> 0) and does not exceed remaining allocatable amount.
   * 7. Requested currency matches remittance advice currency.
   * 8. In REAL mode: fails closed with 503 DHA_PAYMENT_ALLOCATION_CONTRACT_UNCONFIRMED.
   * 9. Safety Invariant: zero mutation to patient payments, invoices, or authoritative claim state.
   */
  async mockAllocatePayment(
    claimId: string,
    remittanceAdviceId: string,
    input: DhaMockPaymentAllocationInput,
    options?: {
      actorUserId?: string;
      correlationId?: string;
      metadata?: RequestMetadata;
    },
  ): Promise<DhaMockPaymentAllocationResponse> {
    if (!Types.ObjectId.isValid(claimId)) {
      throw new AppError('Invalid claim ID format', 400, 'VALIDATION_ERROR');
    }

    if (!Types.ObjectId.isValid(remittanceAdviceId)) {
      throw new AppError('Invalid remittance advice ID format', 400, 'VALIDATION_ERROR');
    }

    const claim = await this.claimRepository.get(claimId);
    if (!claim) {
      throw new AppError('Insurance claim not found', 404, 'CLAIM_NOT_FOUND');
    }

    const actor = options?.actorUserId ?? 'system';
    const hasAccess = await this.access.hasBranchAccess(actor, claim.branchId.toString());
    if (!hasAccess) {
      throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    }

    if (claim.status === 'CANCELLED') {
      throw new AppError('Cannot allocate remittance for a cancelled claim', 409, 'CLAIM_CANCELLED');
    }

    const remittanceAdvice = await DhaMockRemittanceAdviceModel.findById(remittanceAdviceId).lean();
    if (!remittanceAdvice) {
      throw new AppError(
        'Completed Phase 10.4 remittance advice record not found',
        404,
        'DHA_MOCK_REMITTANCE_ADVICE_NOT_FOUND',
      );
    }

    if (remittanceAdvice.claimId.toString() !== claim._id.toString()) {
      throw new AppError('Remittance advice does not belong to this claim', 409, 'REMITTANCE_CLAIM_MISMATCH');
    }

    if (remittanceAdvice.sourceFingerprint !== claim.sourceFingerprint) {
      throw new AppError('Remittance advice source fingerprint does not match claim', 409, 'REMITTANCE_STALE_FINGERPRINT');
    }

    if (remittanceAdvice.source !== 'MOCK') {
      throw new AppError('Only mock remittance advice is supported in mock allocation', 422, 'INVALID_REMITTANCE_SOURCE');
    }

    if (remittanceAdvice.status !== 'MOCK_REMITTED') {
      throw new AppError('Remittance advice status is not MOCK_REMITTED', 422, 'REMITTANCE_NOT_ELIGIBLE_FOR_ALLOCATION');
    }

    // Check underlying invoice source fingerprint
    const source = await this.claimRepository.source(claim.invoiceId.toString());
    if (source.fingerprint !== claim.sourceFingerprint) {
      throw new AppError('Underlying invoice has changed since claim creation', 409, 'CLAIM_SOURCE_CHANGED');
    }

    // Amount validation
    if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
      throw new AppError('Allocation amount must be a positive finite number', 400, 'INVALID_ALLOCATION_AMOUNT');
    }
    const requestedAmount = Math.round((input.amount + Number.EPSILON) * 100) / 100;
    if (requestedAmount <= 0) {
      throw new AppError('Allocation amount must be greater than zero', 400, 'INVALID_ALLOCATION_AMOUNT');
    }

    // Currency validation
    const currency = input.currency?.toUpperCase() ?? remittanceAdvice.currency;
    if (input.currency && input.currency.toUpperCase() !== remittanceAdvice.currency.toUpperCase()) {
      throw new AppError('Allocation currency does not match remittance advice currency', 422, 'CURRENCY_MISMATCH');
    }

    const correlationId = options?.correlationId ?? randomUUID();

    // Idempotency check: if key provided, check existing allocation
    const idempotencyKey = input.idempotencyKey?.trim();
    if (idempotencyKey) {
      const existing = await DhaMockPaymentAllocationModel.findOne({
        claimId: claim._id,
        remittanceAdviceId: remittanceAdvice._id,
        idempotencyKey,
      }).lean();

      if (existing) {
        return {
          success: true,
          source: 'MOCK',
          allocationId: existing._id.toString(),
          claimId: claim._id.toString(),
          remittanceAdviceId: remittanceAdvice._id.toString(),
          externalRemittanceReference: existing.externalRemittanceReference,
          externalAllocationReference: existing.externalAllocationReference,
          status: existing.status,
          currency: existing.currency,
          allocatedAmount: existing.allocatedAmount,
          previouslyAllocatedTotal: existing.previouslyAllocatedTotal,
          newlyAllocatedTotal: existing.newlyAllocatedTotal,
          remainingAllocatableAmount: existing.remainingAllocatableAmount,
          idempotent: true,
          allocatedAt: existing.allocatedAt,
          correlationId: existing.correlationId,
        };
      }
    }

    // Check REAL mode failure before entering transaction
    const adapter = this.getAdapter();
    if (adapter.mode === 'REAL') {
      await adapter.allocatePayment({
        claimId: claim._id.toString(),
        remittanceAdviceId: remittanceAdvice._id.toString(),
        externalRemittanceReference: remittanceAdvice.externalRemittanceReference,
        sourceFingerprint: claim.sourceFingerprint,
        currency,
        allocatedAmount: requestedAmount,
        previouslyAllocatedTotal: 0,
        remittedTotal: remittanceAdvice.remittedTotal,
        idempotencyKey,
        correlationId,
      });
    }

    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const priorAllocations = await DhaMockPaymentAllocationModel.find({
          remittanceAdviceId: remittanceAdvice._id,
        })
          .session(session)
          .lean();

        const previouslyAllocatedTotal =
          Math.round(priorAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0) * 100) / 100;
        const remittedTotal = remittanceAdvice.remittedTotal;
        const remainingAllocatableAmount = Math.max(
          0,
          Math.round((remittedTotal - previouslyAllocatedTotal) * 100) / 100,
        );

        if (remainingAllocatableAmount <= 0) {
          throw new AppError(
            'Remittance advice is already fully allocated',
            409,
            'REMITTANCE_ALREADY_FULLY_ALLOCATED',
          );
        }

        if (requestedAmount > remainingAllocatableAmount) {
          throw new AppError(
            `Requested allocation amount (${requestedAmount}) exceeds remaining remitted balance (${remainingAllocatableAmount})`,
            422,
            'ALLOCATION_EXCEEDS_REMAINING_BALANCE',
          );
        }

        const adapterResult = await adapter.allocatePayment({
          claimId: claim._id.toString(),
          remittanceAdviceId: remittanceAdvice._id.toString(),
          externalRemittanceReference: remittanceAdvice.externalRemittanceReference,
          sourceFingerprint: claim.sourceFingerprint,
          currency,
          allocatedAmount: requestedAmount,
          previouslyAllocatedTotal,
          remittedTotal,
          idempotencyKey,
          correlationId,
        });

        let createdDoc: InstanceType<typeof DhaMockPaymentAllocationModel>;
        try {
          const [doc] = await DhaMockPaymentAllocationModel.create(
            [
              {
                claimId: claim._id,
                remittanceAdviceId: remittanceAdvice._id,
                sourceFingerprint: claim.sourceFingerprint,
                externalRemittanceReference: remittanceAdvice.externalRemittanceReference,
                externalAllocationReference: adapterResult.externalAllocationReference,
                source: 'MOCK',
                status: 'MOCK_ALLOCATED',
                currency,
                allocatedAmount: requestedAmount,
                previouslyAllocatedTotal,
                newlyAllocatedTotal: adapterResult.newlyAllocatedTotal,
                remainingAllocatableAmount: adapterResult.remainingAllocatableAmount,
                idempotencyKey: idempotencyKey ?? null,
                allocatedAt: adapterResult.allocatedAt,
                correlationId,
                actorUserId: options?.actorUserId,
                version: claim.version,
              },
            ],
            { session },
          );
          if (!doc) {
            throw new AppError('Failed to persist payment allocation', 500, 'ALLOCATION_FAILED');
          }
          createdDoc = doc;
        } catch (error: unknown) {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: number }).code === 11000 &&
            idempotencyKey
          ) {
            const duplicate = await DhaMockPaymentAllocationModel.findOne({
              claimId: claim._id,
              remittanceAdviceId: remittanceAdvice._id,
              idempotencyKey,
            })
              .session(session)
              .lean();
            if (duplicate) {
              return {
                success: true,
                source: 'MOCK' as const,
                allocationId: duplicate._id.toString(),
                claimId: claim._id.toString(),
                remittanceAdviceId: remittanceAdvice._id.toString(),
                externalRemittanceReference: duplicate.externalRemittanceReference,
                externalAllocationReference: duplicate.externalAllocationReference,
                status: duplicate.status,
                currency: duplicate.currency,
                allocatedAmount: duplicate.allocatedAmount,
                previouslyAllocatedTotal: duplicate.previouslyAllocatedTotal,
                newlyAllocatedTotal: duplicate.newlyAllocatedTotal,
                remainingAllocatableAmount: duplicate.remainingAllocatableAmount,
                idempotent: true,
                allocatedAt: duplicate.allocatedAt,
                correlationId: duplicate.correlationId,
              };
            }
          }
          throw error;
        }

        try {
          await AuditLogModel.create(
            [
              {
                eventType: 'DHA_MOCK_PAYMENT_ALLOCATED',
                actorUserId: options?.actorUserId,
                ...options?.metadata,
                metadataJson: {
                  claimId: claim._id.toString(),
                  remittanceAdviceId: remittanceAdvice._id.toString(),
                  allocationId: createdDoc._id.toString(),
                  externalAllocationReference: createdDoc.externalAllocationReference,
                  allocatedAmount: requestedAmount,
                  remainingAllocatableAmount: createdDoc.remainingAllocatableAmount,
                  currency,
                  source: 'MOCK',
                },
              },
            ],
            { session },
          );
        } catch {
          // Audit failure must not block business logic
        }

        return {
          success: true,
          source: 'MOCK' as const,
          allocationId: createdDoc._id.toString(),
          claimId: claim._id.toString(),
          remittanceAdviceId: remittanceAdvice._id.toString(),
          externalRemittanceReference: remittanceAdvice.externalRemittanceReference,
          externalAllocationReference: createdDoc.externalAllocationReference,
          status: createdDoc.status,
          currency: createdDoc.currency,
          allocatedAmount: createdDoc.allocatedAmount,
          previouslyAllocatedTotal: createdDoc.previouslyAllocatedTotal,
          newlyAllocatedTotal: createdDoc.newlyAllocatedTotal,
          remainingAllocatableAmount: createdDoc.remainingAllocatableAmount,
          idempotent: false,
          allocatedAt: createdDoc.allocatedAt,
          correlationId,
        };
      });

      return result;
    } finally {
      await session.endSession();
    }
  }
}
