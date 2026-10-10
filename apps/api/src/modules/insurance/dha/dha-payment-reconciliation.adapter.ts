import { randomUUID } from 'node:crypto';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { MockPaymentReconciliationStatus } from './dha-payment-reconciliation.model.js';

export interface DhaPaymentReconciliationRequest {
  claimId: string;
  remittanceAdviceId: string;
  externalRemittanceReference: string;
  sourceFingerprint: string;
  currency: string;
  remittedTotal: number;
  allocatedTotal: number;
  unallocatedAmount: number;
  allocationDifference: number;
  allocationCount: number;
  reconciliationStatus: MockPaymentReconciliationStatus;
  discrepancyReasons?: string[];
  snapshotFingerprint: string;
  idempotencyKey?: string;
  correlationId: string;
}

export interface DhaPaymentReconciliationResult {
  source: 'MOCK' | 'REAL';
  externalReconciliationReference: string;
  status: MockPaymentReconciliationStatus;
  currency: string;
  remittedTotal: number;
  allocatedTotal: number;
  unallocatedAmount: number;
  allocationDifference: number;
  allocationCount: number;
  reconciledAt: Date;
  correlationId: string;
}

export interface DhaPaymentReconciliationAdapter {
  readonly mode: 'MOCK' | 'REAL';
  reconcilePayment(
    request: DhaPaymentReconciliationRequest,
  ): Promise<DhaPaymentReconciliationResult>;
}

export class MockDhaPaymentReconciliationAdapter
  implements DhaPaymentReconciliationAdapter
{
  readonly mode = 'MOCK' as const;

  async reconcilePayment(
    request: DhaPaymentReconciliationRequest,
  ): Promise<DhaPaymentReconciliationResult> {
    const randomHex = randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
    const externalReconciliationReference = `MOCK-REC-${randomHex}-${Date.now().toString(36).toUpperCase()}`;

    return {
      source: 'MOCK',
      externalReconciliationReference,
      status: request.reconciliationStatus,
      currency: request.currency,
      remittedTotal: request.remittedTotal,
      allocatedTotal: request.allocatedTotal,
      unallocatedAmount: request.unallocatedAmount,
      allocationDifference: request.allocationDifference,
      allocationCount: request.allocationCount,
      reconciledAt: new Date(),
      correlationId: request.correlationId,
    };
  }
}

export class UnavailableDhaPaymentReconciliationAdapter
  implements DhaPaymentReconciliationAdapter
{
  readonly mode = 'REAL' as const;

  async reconcilePayment(
    request?: DhaPaymentReconciliationRequest,
  ): Promise<DhaPaymentReconciliationResult> {
    void request;
    throw new AppError(
      'Real DHA payment remittance reconciliation is unconfirmed; no contract or sandbox available',
      503,
      'DHA_PAYMENT_RECONCILIATION_CONTRACT_UNCONFIRMED',
    );
  }

}

export function createDhaPaymentReconciliationAdapter(
  integrationMode?: 'MOCK' | 'REAL',
): DhaPaymentReconciliationAdapter {
  const mode = integrationMode ?? env.dha.integrationMode;
  if (mode === 'REAL') {
    return new UnavailableDhaPaymentReconciliationAdapter();
  }
  return new MockDhaPaymentReconciliationAdapter();
}
