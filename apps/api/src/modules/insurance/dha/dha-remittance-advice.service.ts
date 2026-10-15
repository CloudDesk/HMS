import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { AppError } from '../../../shared/errors/app-error.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { InsuranceClaimRepository } from '../insurance-claim.repository.js';
import { InsuranceClaimService } from '../insurance-claim.service.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import { DhaMockClaimDischargeModel } from './dha-claim-discharge.model.js';
import { DhaMockClaimAdjudicationModel } from './dha-claim-adjudication.model.js';
import { DhaMockClaimQueryModel } from './dha-claim-query.model.js';
import { DhaMockClaimAppealModel } from './dha-claim-appeal.model.js';
import {
  DhaMockRemittanceAdviceModel,
  type MockRemittancePayableBasis,
  type MockRemittanceStatus,
  type DhaMockRemittanceAdviceLineField,
} from './dha-remittance-advice.model.js';
import {
  type DhaRemittanceAdviceAdapter,
  type DhaRemittanceAdviceRequest,
  type DhaRemittanceAdviceLineRequest,
  createDhaRemittanceAdviceAdapter,
} from './dha-remittance-advice.adapter.js';
import type { RequestMetadata } from '../insurance.types.js';

export interface DhaMockRemittanceAdviceResponse {
  success: boolean;
  source: 'MOCK';
  remittanceAdviceId: string;
  claimId: string;
  externalRemittanceReference: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  mockAppealReference?: string;
  status: MockRemittanceStatus;
  payableBasis: MockRemittancePayableBasis;
  claimedTotal: number;
  remittedTotal: number;
  disallowedTotal: number;
  currency: string;
  lines: Array<{
    invoiceItemId: string;
    serviceId: string;
    serviceCode?: string;
    quantity: number;
    claimedAmount: number;
    remittedAmount: number;
    disallowedAmount: number;
    status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'DENIED';
    denialReason?: string;
  }>;
  idempotent: boolean;
  remittedAt: Date;
  correlationId: string;
}

export class DhaRemittanceAdviceService {
  private adapter?: DhaRemittanceAdviceAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaRemittanceAdviceAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaRemittanceAdviceAdapter {
    return this.adapter ?? createDhaRemittanceAdviceAdapter();
  }

  /**
   * Generates a deterministic mock remittance advice based on eligible Phase 10.1 adjudication or Phase 10.3 appeal.
   * Preconditions:
   * 1. Valid claim exists and is not cancelled.
   * 2. Matching Phase 9.3 mock discharge and Phase 10.1 adjudication exist.
   * 3. Adjudication outcome represents a payable state (MOCK_APPROVED, MOCK_PARTIALLY_APPROVED) OR a valid overturned appeal (MOCK_OVERTURNED) exists.
   * 4. No unresolved Phase 10.2 queries exist.
   * 5. Underlying invoice source fingerprint remains unchanged.
   * 6. In REAL mode: fails closed with 503 DHA_REMITTANCE_ADVICE_CONTRACT_UNCONFIRMED.
   * 7. Safety Invariant: InsuranceClaimModel.status remains VALIDATED; readyForShaSubmission remains false; no patient payment or invoice mutation.
   */
  async mockGenerateRemittanceAdvice(
    claimId: string,
    options?: {
      actorUserId?: string;
      correlationId?: string;
      metadata?: RequestMetadata;
    },
  ): Promise<DhaMockRemittanceAdviceResponse> {
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
      throw new AppError('Cannot generate remittance advice for a cancelled claim', 409, 'CLAIM_CANCELLED');
    }

    // 1. Resolve Phase 9.3 mock discharge
    const discharge = await DhaMockClaimDischargeModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
    }).lean();

    if (!discharge) {
      throw new AppError(
        'Completed Phase 9.3 claim discharge record required before remittance advice',
        404,
        'DHA_MOCK_DISCHARGE_NOT_FOUND',
      );
    }

    // 2. Resolve Phase 10.1 adjudication record
    const adjudication = await DhaMockClaimAdjudicationModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!adjudication) {
      throw new AppError(
        'Completed Phase 10.1 claim adjudication record required before remittance advice',
        404,
        'DHA_MOCK_ADJUDICATION_NOT_FOUND',
      );
    }

    if (discharge.externalDischargeReference !== adjudication.mockDischargeReference) {
      throw new AppError(
        'Adjudication does not match active discharge reference',
        409,
        'DISCHARGE_ADJUDICATION_MISMATCH',
      );
    }

    // 3. Verify Phase 10.2 queries are resolved
    const query = await DhaMockClaimQueryModel.findOne({
      claimId: claim._id,
      mockAdjudicationReference: adjudication.externalAdjudicationReference,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (query && query.status !== 'MOCK_RESOLVED') {
      throw new AppError(
        'Cannot generate remittance advice with an unresolved query. Please resolve open query first.',
        409,
        'CLAIM_QUERY_UNRESOLVED',
      );
    }

    // 4. Determine payable basis & check Phase 10.3 appeal
    let payableBasis: MockRemittancePayableBasis;
    let mockAppealReference: string | undefined = undefined;

    const appeal = await DhaMockClaimAppealModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
      mockAdjudicationReference: adjudication.externalAdjudicationReference,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (appeal && appeal.status === 'MOCK_OVERTURNED') {
      payableBasis = 'APPEAL_OVERTURNED';
      mockAppealReference = appeal.externalAppealReference;
    } else if (adjudication.status === 'MOCK_APPROVED') {
      payableBasis = 'ADJUDICATION_APPROVED';
    } else if (adjudication.status === 'MOCK_PARTIALLY_APPROVED') {
      payableBasis = 'ADJUDICATION_PARTIAL';
    } else {
      throw new AppError(
        `Claim adjudication outcome '${adjudication.status}' without an overturned appeal is not eligible for remittance`,
        422,
        'CLAIM_ADJUDICATION_NOT_PAYABLE',
      );
    }

    // 5. Check underlying invoice source fingerprint
    const source = await this.claimRepository.source(claim.invoiceId.toString());
    if (source.fingerprint !== claim.sourceFingerprint) {
      throw new AppError('Underlying invoice has changed since claim creation', 409, 'CLAIM_SOURCE_CHANGED');
    }

    // 6. Check for existing mock remittance advice (idempotency)
    const existingRemittance = await DhaMockRemittanceAdviceModel.findOne({
      claimId: claim._id,
      sourceFingerprint: claim.sourceFingerprint,
      mockAdjudicationReference: adjudication.externalAdjudicationReference,
      mockAppealReference: mockAppealReference ?? null,
    }).lean();

    if (existingRemittance) {
      return {
        success: true,
        source: 'MOCK',
        remittanceAdviceId: existingRemittance._id.toString(),
        claimId: claim._id.toString(),
        externalRemittanceReference: existingRemittance.externalRemittanceReference,
        mockDischargeReference: existingRemittance.mockDischargeReference,
        mockAdjudicationReference: existingRemittance.mockAdjudicationReference,
        mockAppealReference: existingRemittance.mockAppealReference ?? undefined,
        status: existingRemittance.status,
        payableBasis: existingRemittance.payableBasis,
        claimedTotal: existingRemittance.claimedTotal,
        remittedTotal: existingRemittance.remittedTotal,
        disallowedTotal: existingRemittance.disallowedTotal,
        currency: existingRemittance.currency,
        lines: existingRemittance.lines.map((l) => ({
          invoiceItemId: l.invoiceItemId.toString(),
          serviceId: l.serviceId.toString(),
          serviceCode: l.serviceCode,
          quantity: l.quantity,
          claimedAmount: l.claimedAmount,
          remittedAmount: l.remittedAmount,
          disallowedAmount: l.disallowedAmount,
          status: l.status,
          denialReason: l.denialReason,
        })),
        idempotent: true,
        remittedAt: existingRemittance.remittedAt,
        correlationId: existingRemittance.correlationId,
      };
    }

    const correlationId = options?.correlationId ?? randomUUID();
    const adapter = this.getAdapter();

    const lineRequests: DhaRemittanceAdviceLineRequest[] = adjudication.lines.map((l) => ({
      invoiceItemId: l.invoiceItemId.toString(),
      serviceId: l.serviceId.toString(),
      serviceCode: l.serviceCode,
      quantity: l.quantity,
      claimedAmount: l.claimedAmount,
      adjudicatedAmount: l.adjudicatedAmount,
      status: l.status,
      reason: l.reason,
    }));

    const adapterRequest: DhaRemittanceAdviceRequest = {
      claimId: claim._id.toString(),
      sourceFingerprint: claim.sourceFingerprint,
      mockDischargeReference: discharge.externalDischargeReference,
      mockAdjudicationReference: adjudication.externalAdjudicationReference,
      mockAppealReference,
      payableBasis,
      claimedTotal: claim.claimedTotal,
      lines: lineRequests,
      currency: 'KES',
      correlationId,
      version: claim.version,
    };

    const result = await adapter.generateRemittanceAdvice(adapterRequest);

    const docLines: DhaMockRemittanceAdviceLineField[] = result.lines.map((l) => ({
      invoiceItemId: new Types.ObjectId(l.invoiceItemId),
      serviceId: new Types.ObjectId(l.serviceId),
      serviceCode: l.serviceCode,
      quantity: l.quantity,
      claimedAmount: l.claimedAmount,
      remittedAmount: l.remittedAmount,
      disallowedAmount: l.disallowedAmount,
      status: l.status,
      denialReason: l.denialReason,
    }));

    let remittanceRecord: InstanceType<typeof DhaMockRemittanceAdviceModel>;
    try {
      remittanceRecord = await DhaMockRemittanceAdviceModel.create({
        claimId: claim._id,
        sourceFingerprint: claim.sourceFingerprint,
        mockDischargeReference: discharge.externalDischargeReference,
        mockAdjudicationReference: adjudication.externalAdjudicationReference,
        mockAppealReference: mockAppealReference ?? null,
        externalRemittanceReference: result.externalRemittanceReference,
        source: 'MOCK',
        status: result.status,
        payableBasis: result.payableBasis,
        claimedTotal: result.claimedTotal,
        remittedTotal: result.remittedTotal,
        disallowedTotal: result.disallowedTotal,
        currency: result.currency,
        lines: docLines,
        remittedAt: result.remittedAt,
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
        const existing = await DhaMockRemittanceAdviceModel.findOne({
          claimId: claim._id,
          sourceFingerprint: claim.sourceFingerprint,
          mockAdjudicationReference: adjudication.externalAdjudicationReference,
          mockAppealReference: mockAppealReference ?? null,
        }).lean();
        if (existing) {
          return {
            success: true,
            source: 'MOCK',
            remittanceAdviceId: existing._id.toString(),
            claimId: claim._id.toString(),
            externalRemittanceReference: existing.externalRemittanceReference,
            mockDischargeReference: existing.mockDischargeReference,
            mockAdjudicationReference: existing.mockAdjudicationReference,
            mockAppealReference: existing.mockAppealReference ?? undefined,
            status: existing.status,
            payableBasis: existing.payableBasis,
            claimedTotal: existing.claimedTotal,
            remittedTotal: existing.remittedTotal,
            disallowedTotal: existing.disallowedTotal,
            currency: existing.currency,
            lines: existing.lines.map((l) => ({
              invoiceItemId: l.invoiceItemId.toString(),
              serviceId: l.serviceId.toString(),
              serviceCode: l.serviceCode,
              quantity: l.quantity,
              claimedAmount: l.claimedAmount,
              remittedAmount: l.remittedAmount,
              disallowedAmount: l.disallowedAmount,
              status: l.status,
              denialReason: l.denialReason,
            })),
            idempotent: true,
            remittedAt: existing.remittedAt,
            correlationId: existing.correlationId,
          };
        }
      }
      throw error;
    }

    try {
      await AuditLogModel.create([
        {
          eventType: 'DHA_MOCK_REMITTANCE_ADVICE_GENERATED',
          actorUserId: options?.actorUserId,
          ...options?.metadata,
          metadataJson: {
            claimId: claim._id.toString(),
            remittanceAdviceId: remittanceRecord._id.toString(),
            externalRemittanceReference: remittanceRecord.externalRemittanceReference,
            payableBasis: remittanceRecord.payableBasis,
            claimedTotal: remittanceRecord.claimedTotal,
            remittedTotal: remittanceRecord.remittedTotal,
            disallowedTotal: remittanceRecord.disallowedTotal,
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
      remittanceAdviceId: remittanceRecord._id.toString(),
      claimId: claim._id.toString(),
      externalRemittanceReference: remittanceRecord.externalRemittanceReference,
      mockDischargeReference: remittanceRecord.mockDischargeReference,
      mockAdjudicationReference: remittanceRecord.mockAdjudicationReference,
      mockAppealReference: remittanceRecord.mockAppealReference ?? undefined,
      status: remittanceRecord.status,
      payableBasis: remittanceRecord.payableBasis,
      claimedTotal: remittanceRecord.claimedTotal,
      remittedTotal: remittanceRecord.remittedTotal,
      disallowedTotal: remittanceRecord.disallowedTotal,
      currency: remittanceRecord.currency,
      lines: remittanceRecord.lines.map((l) => ({
        invoiceItemId: l.invoiceItemId.toString(),
        serviceId: l.serviceId.toString(),
        serviceCode: l.serviceCode,
        quantity: l.quantity,
        claimedAmount: l.claimedAmount,
        remittedAmount: l.remittedAmount,
        disallowedAmount: l.disallowedAmount,
        status: l.status,
        denialReason: l.denialReason,
      })),
      idempotent: false,
      remittedAt: remittanceRecord.remittedAt,
      correlationId: remittanceRecord.correlationId,
    };
  }
}
