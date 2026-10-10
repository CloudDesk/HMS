import { randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors/app-error.js';
import { env } from '../../../config/env.js';
import type { MockAdjudicationStatus } from './dha-claim-adjudication.model.js';

export interface DhaClaimAdjudicationLine {
  invoiceItemId: string;
  serviceId: string;
  serviceCode?: string;
  quantity: number;
  claimedAmount: number;
}

export interface DhaClaimAdjudicationRequest {
  claimId: string;
  sourceFingerprint: string;
  mockDischargeReference: string;
  claimedTotal: number;
  lines: DhaClaimAdjudicationLine[];
  decision?: MockAdjudicationStatus;
  correlationId: string;
  version: number;
}

export interface DhaClaimAdjudicationLineResult {
  invoiceItemId: string;
  serviceId: string;
  serviceCode?: string;
  quantity: number;
  claimedAmount: number;
  adjudicatedAmount: number;
  status: 'APPROVED' | 'REJECTED';
  reason?: string;
}

export interface DhaClaimAdjudicationResult {
  source: 'MOCK' | 'REAL';
  claimId: string;
  mockDischargeReference: string;
  externalAdjudicationReference: string;
  status: MockAdjudicationStatus;
  claimedTotal: number;
  adjudicatedTotal: number;
  lines: DhaClaimAdjudicationLineResult[];
  adjudicatedAt: Date;
  correlationId: string;
}

export interface DhaClaimAdjudicationAdapter {
  readonly mode: 'MOCK' | 'REAL';
  adjudicateClaim(request: DhaClaimAdjudicationRequest): Promise<DhaClaimAdjudicationResult>;
}

/**
 * Real DHA Claim Adjudication Adapter placeholder.
 * Fails closed when the confirmed DHA claim adjudication contract is not available.
 */
export class UnavailableDhaClaimAdjudicationAdapter implements DhaClaimAdjudicationAdapter {
  readonly mode = 'REAL';

  async adjudicateClaim(): Promise<DhaClaimAdjudicationResult> {
    throw new AppError(
      'Real DHA claim adjudication contract is unconfirmed',
      503,
      'DHA_CLAIM_ADJUDICATION_CONTRACT_UNCONFIRMED',
    );
  }
}

/**
 * Isolated Mock DHA Claim Adjudication Adapter.
 * Simulates deterministic post-claim adjudication for development/testing.
 * NEVER calls the external network, never claims real SHA approval/settlement,
 * and explicitly marks all responses with source = MOCK.
 */
export class MockDhaClaimAdjudicationAdapter implements DhaClaimAdjudicationAdapter {
  readonly mode = 'MOCK';

  async adjudicateClaim(request: DhaClaimAdjudicationRequest): Promise<DhaClaimAdjudicationResult> {
    const decision: MockAdjudicationStatus = request.decision ?? 'MOCK_APPROVED';
    const uniqueSuffix = randomUUID().slice(0, 8).toUpperCase();
    const externalAdjudicationReference = `MOCK-ADJUDICATION-${request.claimId.slice(-8).toUpperCase()}-${uniqueSuffix}`;

    let lines: DhaClaimAdjudicationLineResult[] = [];

    switch (decision) {
      case 'MOCK_APPROVED':
        lines = request.lines.map((l) => ({
          invoiceItemId: l.invoiceItemId,
          serviceId: l.serviceId,
          serviceCode: l.serviceCode,
          quantity: l.quantity,
          claimedAmount: l.claimedAmount,
          adjudicatedAmount: l.claimedAmount,
          status: 'APPROVED',
          reason: 'Approved per mock rules',
        }));
        break;

      case 'MOCK_PARTIALLY_APPROVED':
        lines = request.lines.map((l, index) => {
          const isFirst = index === 0;
          const adjAmount = isFirst
            ? l.claimedAmount
            : Math.round(l.claimedAmount * 0.5 * 100) / 100;
          return {
            invoiceItemId: l.invoiceItemId,
            serviceId: l.serviceId,
            serviceCode: l.serviceCode,
            quantity: l.quantity,
            claimedAmount: l.claimedAmount,
            adjudicatedAmount: adjAmount,
            status: isFirst ? 'APPROVED' : 'APPROVED',
            reason: isFirst
              ? 'Full reimbursement approved'
              : 'Partial tariff ceiling adjustment applied',
          };
        });
        break;

      case 'MOCK_REJECTED':
        lines = request.lines.map((l) => ({
          invoiceItemId: l.invoiceItemId,
          serviceId: l.serviceId,
          serviceCode: l.serviceCode,
          quantity: l.quantity,
          claimedAmount: l.claimedAmount,
          adjudicatedAmount: 0,
          status: 'REJECTED',
          reason: 'Service denied per mock adjudication policy',
        }));
        break;

      case 'MOCK_PENDING':
        lines = request.lines.map((l) => ({
          invoiceItemId: l.invoiceItemId,
          serviceId: l.serviceId,
          serviceCode: l.serviceCode,
          quantity: l.quantity,
          claimedAmount: l.claimedAmount,
          adjudicatedAmount: 0,
          status: 'REJECTED',
          reason: 'Awaiting secondary clinical audit review',
        }));
        break;

      case 'MOCK_QUERY':
        lines = request.lines.map((l) => ({
          invoiceItemId: l.invoiceItemId,
          serviceId: l.serviceId,
          serviceCode: l.serviceCode,
          quantity: l.quantity,
          claimedAmount: l.claimedAmount,
          adjudicatedAmount: 0,
          status: 'REJECTED',
          reason: 'Clinical query issued: discharge summary and operative notes requested',
        }));
        break;
    }

    const calculatedTotal = lines.reduce((acc, l) => acc + l.adjudicatedAmount, 0);
    const adjudicatedTotal = Math.round(calculatedTotal * 100) / 100;

    return {
      source: 'MOCK',
      claimId: request.claimId,
      mockDischargeReference: request.mockDischargeReference,
      externalAdjudicationReference,
      status: decision,
      claimedTotal: request.claimedTotal,
      adjudicatedTotal,
      lines,
      adjudicatedAt: new Date(),
      correlationId: request.correlationId,
    };
  }
}

export const createDhaClaimAdjudicationAdapter = (
  envConfig = env.dha,
): DhaClaimAdjudicationAdapter => {
  if (envConfig.integrationMode === 'MOCK') {
    return new MockDhaClaimAdjudicationAdapter();
  }
  return new UnavailableDhaClaimAdjudicationAdapter();
};
