import { randomUUID, createHash } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { AppError } from '../../../shared/errors/app-error.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { InsuranceClaimRepository } from '../insurance-claim.repository.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import { DhaMockRemittanceAdviceModel } from './dha-remittance-advice.model.js';
import { DhaMockPaymentAllocationModel } from './dha-payment-allocation.model.js';
import {
  DhaMockPaymentReconciliationModel,
  type MockPaymentReconciliationStatus,
} from './dha-payment-reconciliation.model.js';
import {
  type DhaPaymentReconciliationAdapter,
  createDhaPaymentReconciliationAdapter,
} from './dha-payment-reconciliation.adapter.js';
import type { RequestMetadata } from '../insurance.types.js';

export interface DhaMockPaymentReconciliationInput {
  idempotencyKey?: string;
}

export interface DhaMockPaymentReconciliationResponse {
  success: boolean;
  source: 'MOCK';
  reconciliationId: string;
  claimId: string;
  remittanceAdviceId: string;
  externalRemittanceReference: string;
  externalReconciliationReference: string;
  status: MockPaymentReconciliationStatus;
  currency: string;
  remittedTotal: number;
  allocatedTotal: number;
  unallocatedAmount: number;
  allocationDifference: number;
  allocationCount: number;
  allocationIds: string[];
  discrepancyReasons?: string[];
  snapshotFingerprint: string;
  idempotent: boolean;
  reconciledAt: Date;
  correlationId: string;
}

export class DhaPaymentReconciliationService {
  private adapter?: DhaPaymentReconciliationAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaPaymentReconciliationAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaPaymentReconciliationAdapter {
    return this.adapter ?? createDhaPaymentReconciliationAdapter();
  }

  /**
   * Reconciles Phase 10.4 remittance advice with Phase 10.5 allocation records.
   * Compares remitted amount vs allocated amounts and produces a snapshot of:
   * - MOCK_RECONCILED: fully allocated (remittedTotal === allocatedTotal, unallocatedAmount === 0).
   * - MOCK_PARTIALLY_RECONCILED: partially allocated or no allocations yet (unallocatedAmount > 0).
   * - MOCK_DISCREPANCY: genuine inconsistency detected (e.g. over-allocation or line mismatch).
   *
   * Preconditions:
   * 1. Valid claim and remittance advice IDs.
   * 2. Branch access is verified.
   * 3. Claim is not cancelled.
   * 4. Remittance advice exists, matches claim, source is MOCK, and status is MOCK_REMITTED.
   * 5. Underlying invoice has not changed since claim creation.
   * 6. Allocation records match claim, remittance, currency, and have valid amounts.
   * 7. In REAL mode: fails closed with 503 DHA_PAYMENT_RECONCILIATION_CONTRACT_UNCONFIRMED.
   * 8. Safety Invariant: zero mutation to patient payments, invoices, or authoritative claim state.
   */
  async mockReconcilePayment(
    claimId: string,
    remittanceAdviceId: string,
    input?: DhaMockPaymentReconciliationInput,
    options?: {
      actorUserId?: string;
      correlationId?: string;
      metadata?: RequestMetadata;
    },
  ): Promise<DhaMockPaymentReconciliationResponse> {
    if (!Types.ObjectId.isValid(claimId)) {
      throw new AppError('Invalid claim ID format', 400, 'VALIDATION_ERROR');
    }

    if (!Types.ObjectId.isValid(remittanceAdviceId)) {
      throw new AppError(
        'Invalid remittance advice ID format',
        400,
        'VALIDATION_ERROR',
      );
    }

    const claim = await this.claimRepository.get(claimId);
    if (!claim) {
      throw new AppError('Insurance claim not found', 404, 'CLAIM_NOT_FOUND');
    }

    const actor = options?.actorUserId ?? 'system';
    const hasAccess = await this.access.hasBranchAccess(
      actor,
      claim.branchId.toString(),
    );
    if (!hasAccess) {
      throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    }

    if (claim.status === 'CANCELLED') {
      throw new AppError(
        'Cannot reconcile remittance for a cancelled claim',
        409,
        'CLAIM_CANCELLED',
      );
    }

    const remittanceAdvice =
      await DhaMockRemittanceAdviceModel.findById(remittanceAdviceId).lean();
    if (!remittanceAdvice) {
      throw new AppError(
        'Completed Phase 10.4 remittance advice record not found',
        404,
        'DHA_MOCK_REMITTANCE_ADVICE_NOT_FOUND',
      );
    }

    if (remittanceAdvice.claimId.toString() !== claim._id.toString()) {
      throw new AppError(
        'Remittance advice does not belong to this claim',
        409,
        'REMITTANCE_CLAIM_MISMATCH',
      );
    }

    if (remittanceAdvice.sourceFingerprint !== claim.sourceFingerprint) {
      throw new AppError(
        'Remittance advice source fingerprint does not match claim',
        409,
        'REMITTANCE_STALE_FINGERPRINT',
      );
    }

    if (remittanceAdvice.source !== 'MOCK') {
      throw new AppError(
        'Only mock remittance advice is supported in mock reconciliation',
        422,
        'INVALID_REMITTANCE_SOURCE',
      );
    }

    if (remittanceAdvice.status !== 'MOCK_REMITTED') {
      throw new AppError(
        'Remittance advice status is not MOCK_REMITTED',
        422,
        'REMITTANCE_NOT_ELIGIBLE_FOR_RECONCILIATION',
      );
    }

    // Check underlying invoice source fingerprint
    const source = await this.claimRepository.source(claim.invoiceId.toString());
    if (source.fingerprint !== claim.sourceFingerprint) {
      throw new AppError(
        'Underlying invoice has changed since claim creation',
        409,
        'CLAIM_SOURCE_CHANGED',
      );
    }

    const correlationId = options?.correlationId ?? randomUUID();

    // Fast idempotency check if caller provided an idempotencyKey
    const idempotencyKey = input?.idempotencyKey?.trim();
    if (idempotencyKey) {
      const existing = await DhaMockPaymentReconciliationModel.findOne({
        claimId: claim._id,
        remittanceAdviceId: remittanceAdvice._id,
        idempotencyKey,
      }).lean();

      if (existing) {
        return {
          success: true,
          source: 'MOCK',
          reconciliationId: existing._id.toString(),
          claimId: claim._id.toString(),
          remittanceAdviceId: remittanceAdvice._id.toString(),
          externalRemittanceReference: existing.externalRemittanceReference,
          externalReconciliationReference: existing.externalReconciliationReference,
          status: existing.status,
          currency: existing.currency,
          remittedTotal: existing.remittedTotal,
          allocatedTotal: existing.allocatedTotal,
          unallocatedAmount: existing.unallocatedAmount,
          allocationDifference: existing.allocationDifference,
          allocationCount: existing.allocationCount,
          allocationIds: existing.allocationIds.map((id) => id.toString()),
          discrepancyReasons: existing.discrepancyReasons,
          snapshotFingerprint: existing.snapshotFingerprint,
          idempotent: true,
          reconciledAt: existing.reconciledAt,
          correlationId: existing.correlationId,
        };
      }
    }

    // Fail closed in REAL mode before database transaction
    const adapter = this.getAdapter();
    if (adapter.mode === 'REAL') {
      await adapter.reconcilePayment({
        claimId: claim._id.toString(),
        remittanceAdviceId: remittanceAdvice._id.toString(),
        externalRemittanceReference: remittanceAdvice.externalRemittanceReference,
        sourceFingerprint: claim.sourceFingerprint,
        currency: remittanceAdvice.currency,
        remittedTotal: remittanceAdvice.remittedTotal,
        allocatedTotal: 0,
        unallocatedAmount: remittanceAdvice.remittedTotal,
        allocationDifference: 0,
        allocationCount: 0,
        reconciliationStatus: 'MOCK_PARTIALLY_RECONCILED',
        snapshotFingerprint: '',
        idempotencyKey,
        correlationId,
      });
    }

    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const allocations = await DhaMockPaymentAllocationModel.find({
          remittanceAdviceId: remittanceAdvice._id,
        })
          .session(session)
          .sort({ createdAt: 1 })
          .lean();

        // Validate allocations integrity
        for (const alloc of allocations) {
          if (alloc.claimId.toString() !== claim._id.toString()) {
            throw new AppError(
              'Allocation record does not belong to this claim',
              409,
              'ALLOCATION_CLAIM_MISMATCH',
            );
          }
          if (alloc.sourceFingerprint !== claim.sourceFingerprint) {
            throw new AppError(
              'Allocation record source fingerprint does not match claim',
              409,
              'ALLOCATION_STALE_FINGERPRINT',
            );
          }
          if (
            alloc.currency.toUpperCase() !==
            remittanceAdvice.currency.toUpperCase()
          ) {
            throw new AppError(
              'Allocation currency does not match remittance advice currency',
              422,
              'CURRENCY_MISMATCH',
            );
          }
          if (
            typeof alloc.allocatedAmount !== 'number' ||
            !Number.isFinite(alloc.allocatedAmount) ||
            alloc.allocatedAmount <= 0
          ) {
            throw new AppError(
              'Allocation record has invalid non-positive allocated amount',
              422,
              'INVALID_ALLOCATION_DATA',
            );
          }
        }

        // Build deterministic snapshot fingerprint
        const snapshotRaw = [
          claim._id.toString(),
          remittanceAdvice._id.toString(),
          claim.sourceFingerprint,
          remittanceAdvice.remittedTotal.toFixed(2),
          remittanceAdvice.currency.toUpperCase(),
          ...allocations.map(
            (a) => `${a._id.toString()}:${a.allocatedAmount.toFixed(2)}`,
          ),
        ].join('|');
        const snapshotFingerprint = createHash('sha256')
          .update(snapshotRaw)
          .digest('hex');

        // Check if an identical snapshot reconciliation already exists
        const existingSnapshot =
          await DhaMockPaymentReconciliationModel.findOne({
            claimId: claim._id,
            remittanceAdviceId: remittanceAdvice._id,
            snapshotFingerprint,
          })
            .session(session)
            .lean();

        if (existingSnapshot) {
          return {
            success: true,
            source: 'MOCK' as const,
            reconciliationId: existingSnapshot._id.toString(),
            claimId: claim._id.toString(),
            remittanceAdviceId: remittanceAdvice._id.toString(),
            externalRemittanceReference:
              existingSnapshot.externalRemittanceReference,
            externalReconciliationReference:
              existingSnapshot.externalReconciliationReference,
            status: existingSnapshot.status,
            currency: existingSnapshot.currency,
            remittedTotal: existingSnapshot.remittedTotal,
            allocatedTotal: existingSnapshot.allocatedTotal,
            unallocatedAmount: existingSnapshot.unallocatedAmount,
            allocationDifference: existingSnapshot.allocationDifference,
            allocationCount: existingSnapshot.allocationCount,
            allocationIds: existingSnapshot.allocationIds.map((id) =>
              id.toString(),
            ),
            discrepancyReasons: existingSnapshot.discrepancyReasons,
            snapshotFingerprint: existingSnapshot.snapshotFingerprint,
            idempotent: true,
            reconciledAt: existingSnapshot.reconciledAt,
            correlationId: existingSnapshot.correlationId,
          };
        }

        // Decimal-safe calculations
        const remittedTotal =
          Math.round((remittanceAdvice.remittedTotal + Number.EPSILON) * 100) / 100;
        const allocatedTotal =
          Math.round(
            (allocations.reduce((sum, a) => sum + a.allocatedAmount, 0) +
              Number.EPSILON) *
              100,
          ) / 100;

        let unallocatedAmount: number;
        let allocationDifference = 0;
        const discrepancyReasons: string[] = [];

        // Check internal allocation line consistency if lines exist
        for (const alloc of allocations) {
          if (alloc.lines && alloc.lines.length > 0) {
            const lineTotal =
              Math.round(
                (alloc.lines.reduce((s, l) => s + l.allocatedAmount, 0) +
                  Number.EPSILON) *
                  100,
              ) / 100;
            if (Math.abs(lineTotal - alloc.allocatedAmount) > 0.001) {
              discrepancyReasons.push(
                `Allocation ${alloc._id.toString()} line total (${lineTotal}) does not match allocatedAmount (${alloc.allocatedAmount})`,
              );
            }
          }
        }

        // Check over-allocation or excess
        if (allocatedTotal > remittedTotal) {
          allocationDifference =
            Math.round((allocatedTotal - remittedTotal + Number.EPSILON) * 100) / 100;
          unallocatedAmount = 0;
          discrepancyReasons.push(
            `Allocated total (${allocatedTotal}) exceeds remitted total (${remittedTotal}) by ${allocationDifference}`,
          );
        } else {
          unallocatedAmount =
            Math.round((remittedTotal - allocatedTotal + Number.EPSILON) * 100) / 100;
        }

        let reconciliationStatus: MockPaymentReconciliationStatus;
        if (discrepancyReasons.length > 0) {
          reconciliationStatus = 'MOCK_DISCREPANCY';
        } else if (allocatedTotal === remittedTotal) {
          reconciliationStatus = 'MOCK_RECONCILED';
        } else {
          reconciliationStatus = 'MOCK_PARTIALLY_RECONCILED';
        }

        const adapterResult = await adapter.reconcilePayment({
          claimId: claim._id.toString(),
          remittanceAdviceId: remittanceAdvice._id.toString(),
          externalRemittanceReference:
            remittanceAdvice.externalRemittanceReference,
          sourceFingerprint: claim.sourceFingerprint,
          currency: remittanceAdvice.currency,
          remittedTotal,
          allocatedTotal,
          unallocatedAmount,
          allocationDifference,
          allocationCount: allocations.length,
          reconciliationStatus,
          discrepancyReasons:
            discrepancyReasons.length > 0 ? discrepancyReasons : undefined,
          snapshotFingerprint,
          idempotencyKey,
          correlationId,
        });

        const [doc] = await DhaMockPaymentReconciliationModel.create(
          [
            {
              claimId: claim._id,
              remittanceAdviceId: remittanceAdvice._id,
              sourceFingerprint: claim.sourceFingerprint,
              externalRemittanceReference:
                remittanceAdvice.externalRemittanceReference,
              externalReconciliationReference:
                adapterResult.externalReconciliationReference,
              source: 'MOCK',
              status: reconciliationStatus,
              currency: remittanceAdvice.currency,
              remittedTotal,
              allocatedTotal,
              unallocatedAmount,
              allocationDifference,
              allocationCount: allocations.length,
              allocationIds: allocations.map((a) => a._id),
              discrepancyReasons:
                discrepancyReasons.length > 0 ? discrepancyReasons : undefined,
              snapshotFingerprint,
              idempotencyKey,
              reconciledAt: adapterResult.reconciledAt,
              correlationId,
              actorUserId: actor,
              version: 0,
            },
          ],
          { session },
        );

        if (!doc) {
          throw new AppError(
            'Failed to record mock payment reconciliation',
            500,
            'INTERNAL_ERROR',
          );
        }

        try {
          await AuditLogModel.create(
            [
              {
                eventType: 'DHA_MOCK_REMITTANCE_RECONCILED',
                actorUserId: options?.actorUserId,
                ...options?.metadata,
                metadataJson: {
                  claimId: claim._id.toString(),
                  remittanceAdviceId: remittanceAdvice._id.toString(),
                  reconciliationId: doc._id.toString(),
                  externalRemittanceReference:
                    remittanceAdvice.externalRemittanceReference,
                  externalReconciliationReference:
                    doc.externalReconciliationReference,
                  status: reconciliationStatus,
                  remittedTotal,
                  allocatedTotal,
                  unallocatedAmount,
                  allocationDifference,
                  allocationCount: allocations.length,
                  snapshotFingerprint,
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
          reconciliationId: doc._id.toString(),
          claimId: claim._id.toString(),
          remittanceAdviceId: remittanceAdvice._id.toString(),
          externalRemittanceReference: doc.externalRemittanceReference,
          externalReconciliationReference: doc.externalReconciliationReference,
          status: doc.status,
          currency: doc.currency,
          remittedTotal: doc.remittedTotal,
          allocatedTotal: doc.allocatedTotal,
          unallocatedAmount: doc.unallocatedAmount,
          allocationDifference: doc.allocationDifference,
          allocationCount: doc.allocationCount,
          allocationIds: doc.allocationIds.map((id) => id.toString()),
          discrepancyReasons: doc.discrepancyReasons,
          snapshotFingerprint: doc.snapshotFingerprint,
          idempotent: false,
          reconciledAt: doc.reconciledAt,
          correlationId: doc.correlationId,
        };
      });

      return result;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Retrieves historical reconciliation snapshots for a remittance advice in chronological order.
   */
  async getReconciliations(
    claimId: string,
    remittanceAdviceId: string,
    options?: { actorUserId?: string },
  ): Promise<DhaMockPaymentReconciliationResponse[]> {
    if (!Types.ObjectId.isValid(claimId)) {
      throw new AppError('Invalid claim ID format', 400, 'VALIDATION_ERROR');
    }
    if (!Types.ObjectId.isValid(remittanceAdviceId)) {
      throw new AppError(
        'Invalid remittance advice ID format',
        400,
        'VALIDATION_ERROR',
      );
    }

    const claim = await this.claimRepository.get(claimId);
    if (!claim) {
      throw new AppError('Insurance claim not found', 404, 'CLAIM_NOT_FOUND');
    }

    const actor = options?.actorUserId ?? 'system';
    const hasAccess = await this.access.hasBranchAccess(
      actor,
      claim.branchId.toString(),
    );
    if (!hasAccess) {
      throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    }

    const docs = await DhaMockPaymentReconciliationModel.find({
      claimId: claim._id,
      remittanceAdviceId: new Types.ObjectId(remittanceAdviceId),
    })
      .sort({ createdAt: 1 })
      .lean();

    return docs.map((doc) => ({
      success: true,
      source: 'MOCK',
      reconciliationId: doc._id.toString(),
      claimId: doc.claimId.toString(),
      remittanceAdviceId: doc.remittanceAdviceId.toString(),
      externalRemittanceReference: doc.externalRemittanceReference,
      externalReconciliationReference: doc.externalReconciliationReference,
      status: doc.status,
      currency: doc.currency,
      remittedTotal: doc.remittedTotal,
      allocatedTotal: doc.allocatedTotal,
      unallocatedAmount: doc.unallocatedAmount,
      allocationDifference: doc.allocationDifference,
      allocationCount: doc.allocationCount,
      allocationIds: doc.allocationIds.map((id) => id.toString()),
      discrepancyReasons: doc.discrepancyReasons,
      snapshotFingerprint: doc.snapshotFingerprint,
      idempotent: true,
      reconciledAt: doc.reconciledAt,
      correlationId: doc.correlationId,
    }));
  }
}
