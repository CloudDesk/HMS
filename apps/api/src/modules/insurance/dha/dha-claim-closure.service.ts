import { randomUUID, createHash } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { AppError } from '../../../shared/errors/app-error.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { InsuranceClaimRepository } from '../insurance-claim.repository.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import { DhaMockClaimDischargeModel } from './dha-claim-discharge.model.js';
import { DhaMockClaimAdjudicationModel } from './dha-claim-adjudication.model.js';
import { DhaMockClaimQueryModel } from './dha-claim-query.model.js';
import { DhaMockClaimAppealModel } from './dha-claim-appeal.model.js';
import {
  DhaMockRemittanceAdviceModel,
  type DhaMockRemittanceAdviceFields,
} from './dha-remittance-advice.model.js';
import {
  DhaMockPaymentReconciliationModel,
  type DhaMockPaymentReconciliationFields,
} from './dha-payment-reconciliation.model.js';
import {
  DhaMockClaimClosureModel,
  type MockClaimClosureStatus,
  type MockClaimClosurePath,
} from './dha-claim-closure.model.js';
import {
  type DhaClaimClosureAdapter,
  createDhaClaimClosureAdapter,
} from './dha-claim-closure.adapter.js';
import type { RequestMetadata } from '../insurance.types.js';

export interface DhaMockClaimClosureInput {
  reason?: string;
  idempotencyKey?: string;
}

export interface DhaClaimClosureReadinessResult {
  claimId: string;
  ready: boolean;
  closurePath: MockClaimClosurePath | 'NOT_ELIGIBLE';
  blockers: string[];
  reasons: string[];
  sourceFingerprint: string;
  summary: {
    hasDischarge: boolean;
    adjudicationStatus?: string;
    openQueriesCount: number;
    hasOpenAppeal: boolean;
    appealStatus?: string;
    hasRemittanceAdvice: boolean;
    reconciliationStatus?: string;
  };
}

export interface DhaMockClaimClosureResponse {
  success: boolean;
  source: 'MOCK';
  closureId: string;
  claimId: string;
  externalClosureReference: string;
  status: MockClaimClosureStatus;
  closurePath: MockClaimClosurePath;
  closureReason: string;
  claimedTotal: number;
  remittedTotal: number;
  allocatedTotal: number;
  reconciledTotal: number;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  mockAppealReference?: string | null;
  mockRemittanceReference?: string | null;
  mockReconciliationReference?: string | null;
  closureSnapshotFingerprint: string;
  idempotent: boolean;
  closedAt: Date;
  correlationId: string;
}

export class DhaClaimClosureService {
  private adapter?: DhaClaimClosureAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimClosureAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimClosureAdapter {
    return this.adapter ?? createDhaClaimClosureAdapter();
  }

  /**
   * Evaluates whether a claim has satisfied all lifecycle obligations and is eligible for mock closure.
   */
  async evaluateClosureReadiness(
    claimId: string,
    options?: { actorUserId?: string },
  ): Promise<DhaClaimClosureReadinessResult> {
    if (!Types.ObjectId.isValid(claimId)) {
      throw new AppError('Invalid claim ID format', 400, 'VALIDATION_ERROR');
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

    const blockers: string[] = [];
    const reasons: string[] = [];

    if (claim.status === 'CANCELLED') {
      blockers.push('CLAIM_CANCELLED');
      reasons.push('Cannot close a cancelled claim');
    }

    // Check underlying invoice source fingerprint
    const source = await this.claimRepository.source(claim.invoiceId.toString());
    if (source.fingerprint !== claim.sourceFingerprint) {
      blockers.push('CLAIM_SOURCE_CHANGED');
      reasons.push('Underlying invoice has changed since claim validation');
    }

    // Check mock discharge
    const discharge = await DhaMockClaimDischargeModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
    }).lean();

    if (!discharge) {
      blockers.push('MISSING_DISCHARGE');
      reasons.push('Completed mock discharge record not found for current claim source');
    }

    // Check mock adjudication
    const adjudication = await DhaMockClaimAdjudicationModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!adjudication) {
      blockers.push('MISSING_ADJUDICATION');
      reasons.push('Completed mock adjudication record not found for current claim source');
    } else if (adjudication.status === 'MOCK_PENDING') {
      blockers.push('ADJUDICATION_PENDING');
      reasons.push('Claim adjudication is still pending');
    }

    // Check open queries
    const queries = await DhaMockClaimQueryModel.find({ claimId: claim._id }).lean();
    const openQueries = queries.filter(
      (q) => q.status === 'OPEN' || q.status === 'RESPONSE_SUBMITTED',
    );
    if (openQueries.length > 0) {
      blockers.push('OPEN_QUERY_EXISTS');
      reasons.push(`${openQueries.length} mock claim query/queries remain unresolved`);
    }

    // Check open appeals
    const appeals = await DhaMockClaimAppealModel.find({ claimId: claim._id }).lean();
    const openAppeals = appeals.filter(
      (a) => a.status === 'OPEN' || a.status === 'SUBMITTED',
    );
    if (openAppeals.length > 0) {
      blockers.push('OPEN_APPEAL_EXISTS');
      reasons.push('Claim has an open or pending appeal under review');
    }

    const latestAppeal = appeals.length > 0 ? appeals[appeals.length - 1] : undefined;

    // Determine payable vs no-settlement path
    let isPayable = false;
    let isNoSettlement = false;

    if (adjudication) {
      if (
        adjudication.status === 'MOCK_APPROVED' ||
        adjudication.status === 'MOCK_PARTIALLY_APPROVED'
      ) {
        isPayable = true;
      } else if (adjudication.status === 'MOCK_REJECTED') {
        if (latestAppeal?.status === 'MOCK_OVERTURNED') {
          isPayable = true;
        } else if (!latestAppeal || latestAppeal.status === 'MOCK_UPHELD') {
          isNoSettlement = true;
        }
      } else if (adjudication.status === 'MOCK_QUERY') {
        if (openQueries.length === 0) {
          isPayable = adjudication.adjudicatedTotal > 0;
          if (!isPayable) isNoSettlement = true;
        }
      }
    }

    let remittanceAdvice: (DhaMockRemittanceAdviceFields & { _id: Types.ObjectId }) | null = null;
    let latestReconciliation: (DhaMockPaymentReconciliationFields & { _id: Types.ObjectId }) | null = null;

    if (isPayable) {
      remittanceAdvice = await DhaMockRemittanceAdviceModel.findOne({
        claimId: claim._id,
        sourceFingerprint: claim.sourceFingerprint,
      })
        .sort({ createdAt: -1 })
        .lean() as (DhaMockRemittanceAdviceFields & { _id: Types.ObjectId }) | null;

      if (!remittanceAdvice) {
        blockers.push('MISSING_REMITTANCE_ADVICE');
        reasons.push('Remittance advice is required for payable claims');
      } else {
        latestReconciliation = await DhaMockPaymentReconciliationModel.findOne({
          claimId: claim._id,
          remittanceAdviceId: remittanceAdvice._id,
        })
          .sort({ createdAt: -1 })
          .lean() as (DhaMockPaymentReconciliationFields & { _id: Types.ObjectId }) | null;

        if (!latestReconciliation) {
          blockers.push('RECONCILIATION_REQUIRED');
          reasons.push('Reconciliation record is required before closing a remitted claim');
        } else if (latestReconciliation.status === 'MOCK_DISCREPANCY') {
          blockers.push('RECONCILIATION_DISCREPANCY');
          reasons.push('Payment reconciliation has unresolved discrepancies');
        } else if (latestReconciliation.status === 'MOCK_PARTIALLY_RECONCILED') {
          blockers.push('RECONCILIATION_INCOMPLETE');
          reasons.push('Payment reconciliation is incomplete; remaining unallocated balance exists');
        }
      }
    }

    let closurePath: MockClaimClosurePath | 'NOT_ELIGIBLE' = 'NOT_ELIGIBLE';
    if (blockers.length === 0) {
      if (isPayable) {
        closurePath = 'SETTLEMENT_RECONCILED';
      } else if (isNoSettlement) {
        closurePath = 'NO_SETTLEMENT_REJECTED';
      }
    }

    return {
      claimId: claim._id.toString(),
      ready: blockers.length === 0,
      closurePath,
      blockers,
      reasons,
      sourceFingerprint: claim.sourceFingerprint,
      summary: {
        hasDischarge: Boolean(discharge),
        adjudicationStatus: adjudication?.status,
        openQueriesCount: openQueries.length,
        hasOpenAppeal: openAppeals.length > 0,
        appealStatus: latestAppeal?.status,
        hasRemittanceAdvice: Boolean(remittanceAdvice),
        reconciliationStatus: latestReconciliation?.status,
      },
    };
  }

  /**
   * Records a mock claim closure record if the claim satisfies all lifecycle consistency rules.
   */
  async mockCloseClaim(
    claimId: string,
    input?: DhaMockClaimClosureInput,
    options?: {
      actorUserId?: string;
      correlationId?: string;
      metadata?: RequestMetadata;
    },
  ): Promise<DhaMockClaimClosureResponse> {
    const readiness = await this.evaluateClosureReadiness(claimId, options);
    if (!readiness.ready) {
      throw new AppError(
        `Claim is not ready for mock closure: ${readiness.blockers.join(', ')}`,
        422,
        'CLAIM_NOT_READY_FOR_CLOSURE',
      );
    }

    const claim = await this.claimRepository.get(claimId);
    if (!claim) {
      throw new AppError('Insurance claim not found', 404, 'CLAIM_NOT_FOUND');
    }

    const actor = options?.actorUserId ?? 'system';
    const correlationId = options?.correlationId ?? randomUUID();

    // Fast idempotency check if caller supplied idempotencyKey
    const idempotencyKey = input?.idempotencyKey?.trim();
    if (idempotencyKey) {
      const existing = await DhaMockClaimClosureModel.findOne({
        claimId: claim._id,
        idempotencyKey,
      }).lean();

      if (existing) {
        return {
          success: true,
          source: 'MOCK',
          closureId: existing._id.toString(),
          claimId: existing.claimId.toString(),
          externalClosureReference: existing.externalClosureReference,
          status: existing.status,
          closurePath: existing.closurePath,
          closureReason: existing.closureReason,
          claimedTotal: existing.claimedTotal,
          remittedTotal: existing.remittedTotal,
          allocatedTotal: existing.allocatedTotal,
          reconciledTotal: existing.reconciledTotal,
          mockDischargeReference: existing.mockDischargeReference,
          mockAdjudicationReference: existing.mockAdjudicationReference,
          mockAppealReference: existing.mockAppealReference,
          mockRemittanceReference: existing.mockRemittanceReference,
          mockReconciliationReference: existing.mockReconciliationReference,
          closureSnapshotFingerprint: existing.closureSnapshotFingerprint,
          idempotent: true,
          closedAt: existing.closedAt,
          correlationId: existing.correlationId,
        };
      }
    }

    // Fail closed in REAL mode before database session
    const adapter = this.getAdapter();
    if (adapter.mode === 'REAL') {
      await adapter.closeClaim();
    }

    // Retrieve references for snapshot fingerprint
    const discharge = await DhaMockClaimDischargeModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
    }).lean();

    const adjudication = await DhaMockClaimAdjudicationModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
    })
      .sort({ createdAt: -1 })
      .lean();

    const latestAppeal = await DhaMockClaimAppealModel.findOne({
      claimId: claim._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    const remittance = await DhaMockRemittanceAdviceModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
    })
      .sort({ createdAt: -1 })
      .lean();

    const reconciliation = remittance
      ? await DhaMockPaymentReconciliationModel.findOne({
          claimId: claim._id,
          remittanceAdviceId: remittance._id,
        })
          .sort({ createdAt: -1 })
          .lean()
      : null;

    const closurePath = readiness.closurePath as MockClaimClosurePath;
    const closureStatus: MockClaimClosureStatus =
      closurePath === 'SETTLEMENT_RECONCILED'
        ? 'MOCK_CLOSED_RECONCILED'
        : 'MOCK_CLOSED_NO_SETTLEMENT';

    const snapshotRaw = [
      claim._id.toString(),
      claim.sourceFingerprint,
      discharge?.externalDischargeReference ?? 'NONE',
      adjudication?.externalAdjudicationReference ?? 'NONE',
      latestAppeal?.status ?? 'NONE',
      remittance?.externalRemittanceReference ?? 'NONE',
      reconciliation?.externalReconciliationReference ?? 'NONE',
      closurePath,
    ].join('|');

    const closureSnapshotFingerprint = createHash('sha256')
      .update(snapshotRaw)
      .digest('hex');

    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(async () => {
        // Check if identical snapshot already exists
        const existingSnapshot = await DhaMockClaimClosureModel.findOne({
          claimId: claim._id,
          closureSnapshotFingerprint,
        })
          .session(session)
          .lean();

        if (existingSnapshot) {
          return {
            success: true,
            source: 'MOCK' as const,
            closureId: existingSnapshot._id.toString(),
            claimId: existingSnapshot.claimId.toString(),
            externalClosureReference: existingSnapshot.externalClosureReference,
            status: existingSnapshot.status,
            closurePath: existingSnapshot.closurePath,
            closureReason: existingSnapshot.closureReason,
            claimedTotal: existingSnapshot.claimedTotal,
            remittedTotal: existingSnapshot.remittedTotal,
            allocatedTotal: existingSnapshot.allocatedTotal,
            reconciledTotal: existingSnapshot.reconciledTotal,
            mockDischargeReference: existingSnapshot.mockDischargeReference,
            mockAdjudicationReference: existingSnapshot.mockAdjudicationReference,
            mockAppealReference: existingSnapshot.mockAppealReference,
            mockRemittanceReference: existingSnapshot.mockRemittanceReference,
            mockReconciliationReference: existingSnapshot.mockReconciliationReference,
            closureSnapshotFingerprint: existingSnapshot.closureSnapshotFingerprint,
            idempotent: true,
            closedAt: existingSnapshot.closedAt,
            correlationId: existingSnapshot.correlationId,
          };
        }

        const closureReason =
          input?.reason?.trim() ||
          (closurePath === 'SETTLEMENT_RECONCILED'
            ? 'Claim post-adjudication remittance fully allocated and reconciled'
            : 'Claim terminal rejection with zero settlement');

        const claimedTotal = claim.claimedTotal ?? 0;
        const remittedTotal = remittance?.remittedTotal ?? 0;
        const allocatedTotal = reconciliation?.allocatedTotal ?? 0;
        const reconciledTotal = reconciliation?.allocatedTotal ?? 0;

        const adapterResult = await adapter.closeClaim({
          claimId: claim._id.toString(),
          sourceFingerprint: claim.sourceFingerprint,
          status: closureStatus,
          closurePath,
          closureReason,
          claimedTotal,
          remittedTotal,
          allocatedTotal,
          reconciledTotal,
          closureSnapshotFingerprint,
          idempotencyKey,
          correlationId,
        });

        const [doc] = await DhaMockClaimClosureModel.create(
          [
            {
              claimId: claim._id,
              sourceFingerprint: claim.sourceFingerprint,
              mockDischargeReference: discharge!.externalDischargeReference,
              mockAdjudicationReference: adjudication!.externalAdjudicationReference,
              mockAppealReference: latestAppeal?.externalAppealReference,
              mockRemittanceReference: remittance?.externalRemittanceReference,
              mockReconciliationReference: reconciliation?.externalReconciliationReference,
              externalClosureReference: adapterResult.externalClosureReference,
              source: 'MOCK',
              status: closureStatus,
              closurePath,
              closureReason,
              claimedTotal,
              remittedTotal,
              allocatedTotal,
              reconciledTotal,
              closureSnapshotFingerprint,
              idempotencyKey,
              closedAt: adapterResult.closedAt,
              correlationId,
              actorUserId: actor,
              version: 0,
            },
          ],
          { session },
        );

        if (!doc) {
          throw new AppError(
            'Failed to record mock claim closure',
            500,
            'INTERNAL_ERROR',
          );
        }

        try {
          await AuditLogModel.create(
            [
              {
                eventType: 'DHA_MOCK_CLAIM_CLOSED',
                actorUserId: options?.actorUserId,
                ...options?.metadata,
                metadataJson: {
                  claimId: claim._id.toString(),
                  closureId: doc._id.toString(),
                  externalClosureReference: doc.externalClosureReference,
                  status: closureStatus,
                  closurePath,
                  closureReason,
                  claimedTotal,
                  remittedTotal,
                  allocatedTotal,
                  reconciledTotal,
                  closureSnapshotFingerprint,
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
          closureId: doc._id.toString(),
          claimId: doc.claimId.toString(),
          externalClosureReference: doc.externalClosureReference,
          status: doc.status,
          closurePath: doc.closurePath,
          closureReason: doc.closureReason,
          claimedTotal: doc.claimedTotal,
          remittedTotal: doc.remittedTotal,
          allocatedTotal: doc.allocatedTotal,
          reconciledTotal: doc.reconciledTotal,
          mockDischargeReference: doc.mockDischargeReference,
          mockAdjudicationReference: doc.mockAdjudicationReference,
          mockAppealReference: doc.mockAppealReference,
          mockRemittanceReference: doc.mockRemittanceReference,
          mockReconciliationReference: doc.mockReconciliationReference,
          closureSnapshotFingerprint: doc.closureSnapshotFingerprint,
          idempotent: false,
          closedAt: doc.closedAt,
          correlationId: doc.correlationId,
        };
      });

      return result;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Retrieves all historical closure snapshots for a claim in chronological order.
   */
  async getClosures(
    claimId: string,
    options?: { actorUserId?: string },
  ): Promise<DhaMockClaimClosureResponse[]> {
    if (!Types.ObjectId.isValid(claimId)) {
      throw new AppError('Invalid claim ID format', 400, 'VALIDATION_ERROR');
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

    const docs = await DhaMockClaimClosureModel.find({ claimId: claim._id })
      .sort({ createdAt: 1 })
      .lean();

    return docs.map((doc) => ({
      success: true,
      source: 'MOCK',
      closureId: doc._id.toString(),
      claimId: doc.claimId.toString(),
      externalClosureReference: doc.externalClosureReference,
      status: doc.status,
      closurePath: doc.closurePath,
      closureReason: doc.closureReason,
      claimedTotal: doc.claimedTotal,
      remittedTotal: doc.remittedTotal,
      allocatedTotal: doc.allocatedTotal,
      reconciledTotal: doc.reconciledTotal,
      mockDischargeReference: doc.mockDischargeReference,
      mockAdjudicationReference: doc.mockAdjudicationReference,
      mockAppealReference: doc.mockAppealReference,
      mockRemittanceReference: doc.mockRemittanceReference,
      mockReconciliationReference: doc.mockReconciliationReference,
      closureSnapshotFingerprint: doc.closureSnapshotFingerprint,
      idempotent: true,
      closedAt: doc.closedAt,
      correlationId: doc.correlationId,
    }));
  }
}
