import { randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors/app-error.js';
import { env } from '../../../config/env.js';
import type { MockRemittancePayableBasis, MockRemittanceStatus } from './dha-remittance-advice.model.js';

export interface DhaRemittanceAdviceLineRequest {
  invoiceItemId: string;
  serviceId: string;
  serviceCode?: string;
  quantity: number;
  claimedAmount: number;
  adjudicatedAmount?: number;
  status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
  reason?: string;
}

export interface DhaRemittanceAdviceRequest {
  claimId: string;
  sourceFingerprint: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  mockAppealReference?: string;
  payableBasis: MockRemittancePayableBasis;
  claimedTotal: number;
  lines: DhaRemittanceAdviceLineRequest[];
  currency?: string;
  correlationId: string;
  version: number;
}

export interface DhaRemittanceAdviceLineResult {
  invoiceItemId: string;
  serviceId: string;
  serviceCode?: string;
  quantity: number;
  claimedAmount: number;
  remittedAmount: number;
  disallowedAmount: number;
  status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'DENIED';
  denialReason?: string;
}

export interface DhaRemittanceAdviceResult {
  source: 'MOCK' | 'REAL';
  externalRemittanceReference: string;
  status: MockRemittanceStatus;
  payableBasis: MockRemittancePayableBasis;
  claimedTotal: number;
  remittedTotal: number;
  disallowedTotal: number;
  currency: string;
  lines: DhaRemittanceAdviceLineResult[];
  remittedAt: Date;
  correlationId: string;
}

export interface DhaRemittanceAdviceAdapter {
  readonly mode: 'MOCK' | 'REAL';
  generateRemittanceAdvice(
    request: DhaRemittanceAdviceRequest,
  ): Promise<DhaRemittanceAdviceResult>;
}

/**
 * Real DHA Remittance Advice Adapter placeholder.
 * Fails closed when the confirmed DHA remittance advice contract is not available.
 */
export class UnavailableDhaRemittanceAdviceAdapter implements DhaRemittanceAdviceAdapter {
  readonly mode = 'REAL';

  async generateRemittanceAdvice(): Promise<DhaRemittanceAdviceResult> {
    throw new AppError(
      'Real DHA remittance advice contract is unconfirmed',
      503,
      'DHA_REMITTANCE_ADVICE_CONTRACT_UNCONFIRMED',
    );
  }
}

/**
 * Isolated Mock DHA Remittance Advice Adapter.
 * Simulates deterministic remittance advice calculation based on payable basis.
 * NEVER moves funds, never modifies patient payments, and explicitly marks source = MOCK.
 */
export class MockDhaRemittanceAdviceAdapter implements DhaRemittanceAdviceAdapter {
  readonly mode = 'MOCK';

  async generateRemittanceAdvice(
    request: DhaRemittanceAdviceRequest,
  ): Promise<DhaRemittanceAdviceResult> {
    const uniqueSuffix = randomUUID().slice(0, 8).toUpperCase();
    const externalRemittanceReference = `MOCK-REM-${request.claimId.slice(-8).toUpperCase()}-${uniqueSuffix}`;
    const currency = request.currency ?? 'KES';

    let remittedTotal = 0;
    const lines: DhaRemittanceAdviceLineResult[] = request.lines.map((line) => {
      let remittedAmount = 0;
      let status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'DENIED' = 'DENIED';
      let denialReason = line.reason;

      if (
        request.payableBasis === 'ADJUDICATION_APPROVED' ||
        request.payableBasis === 'APPEAL_OVERTURNED'
      ) {
        remittedAmount = line.claimedAmount;
        status = 'APPROVED';
        denialReason = undefined;
      } else if (request.payableBasis === 'ADJUDICATION_PARTIAL') {
        remittedAmount =
          line.adjudicatedAmount !== undefined
            ? line.adjudicatedAmount
            : Math.round(line.claimedAmount * 0.7 * 100) / 100;
        if (remittedAmount >= line.claimedAmount) {
          status = 'APPROVED';
          denialReason = undefined;
        } else if (remittedAmount > 0) {
          status = 'PARTIALLY_APPROVED';
          denialReason = line.reason ?? 'Tariff ceiling applied';
        } else {
          status = 'DENIED';
          denialReason = line.reason ?? 'Service non-covered';
        }
      }

      remittedTotal += remittedAmount;
      const disallowedAmount = Math.max(0, line.claimedAmount - remittedAmount);

      return {
        invoiceItemId: line.invoiceItemId,
        serviceId: line.serviceId,
        serviceCode: line.serviceCode,
        quantity: line.quantity,
        claimedAmount: line.claimedAmount,
        remittedAmount,
        disallowedAmount,
        status,
        denialReason,
      };
    });

    const disallowedTotal = Math.max(0, request.claimedTotal - remittedTotal);

    return {
      source: 'MOCK',
      externalRemittanceReference,
      status: 'MOCK_REMITTED',
      payableBasis: request.payableBasis,
      claimedTotal: request.claimedTotal,
      remittedTotal,
      disallowedTotal,
      currency,
      lines,
      remittedAt: new Date(),
      correlationId: request.correlationId,
    };
  }
}

export const createDhaRemittanceAdviceAdapter = (
  envConfig = env.dha,
): DhaRemittanceAdviceAdapter => {
  if (envConfig.integrationMode === 'MOCK') {
    return new MockDhaRemittanceAdviceAdapter();
  }
  return new UnavailableDhaRemittanceAdviceAdapter();
};
