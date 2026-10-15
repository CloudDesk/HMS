import { randomUUID } from 'node:crypto';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface DhaPaymentAllocationLineRequest {
  invoiceItemId: string;
  serviceId: string;
  serviceCode?: string;
  claimedAmount: number;
  remittedAmount: number;
  allocatedAmount: number;
}

export interface DhaPaymentAllocationRequest {
  claimId: string;
  remittanceAdviceId: string;
  externalRemittanceReference: string;
  sourceFingerprint: string;
  currency: string;
  allocatedAmount: number;
  previouslyAllocatedTotal: number;
  remittedTotal: number;
  idempotencyKey?: string;
  lines?: DhaPaymentAllocationLineRequest[];
  correlationId?: string;
}

export interface DhaPaymentAllocationLineResult {
  invoiceItemId: string;
  serviceId: string;
  serviceCode?: string;
  claimedAmount: number;
  remittedAmount: number;
  allocatedAmount: number;
}

export interface DhaPaymentAllocationResult {
  source: 'MOCK' | 'REAL';
  externalAllocationReference: string;
  currency: string;
  allocatedAmount: number;
  previouslyAllocatedTotal: number;
  newlyAllocatedTotal: number;
  remainingAllocatableAmount: number;
  lines?: DhaPaymentAllocationLineResult[];
  allocatedAt: Date;
  correlationId: string;
}

export interface DhaPaymentAllocationAdapter {
  readonly mode: 'MOCK' | 'REAL';
  allocatePayment(request: DhaPaymentAllocationRequest): Promise<DhaPaymentAllocationResult>;
}

/**
 * Isolated Mock DHA Payment Allocation Adapter.
 * Computes deterministic allocation references and remaining balances.
 * NEVER moves funds, never modifies patient payments, and explicitly marks source = MOCK.
 */
export class MockDhaPaymentAllocationAdapter implements DhaPaymentAllocationAdapter {
  readonly mode = 'MOCK';

  async allocatePayment(
    request: DhaPaymentAllocationRequest,
  ): Promise<DhaPaymentAllocationResult> {
    const uniqueSuffix = randomUUID().slice(0, 8).toUpperCase();
    const externalAllocationReference = `MOCK-ALLOC-${request.claimId.slice(-8).toUpperCase()}-${uniqueSuffix}`;
    const newlyAllocatedTotal =
      Math.round((request.previouslyAllocatedTotal + request.allocatedAmount) * 100) / 100;
    const remainingAllocatableAmount = Math.max(
      0,
      Math.round((request.remittedTotal - newlyAllocatedTotal) * 100) / 100,
    );

    return {
      source: 'MOCK',
      externalAllocationReference,
      currency: request.currency,
      allocatedAmount: request.allocatedAmount,
      previouslyAllocatedTotal: request.previouslyAllocatedTotal,
      newlyAllocatedTotal,
      remainingAllocatableAmount,
      lines: request.lines?.map((l) => ({ ...l })),
      allocatedAt: new Date(),
      correlationId: request.correlationId ?? randomUUID(),
    };
  }
}

/**
 * Live DHA Payment Allocation Adapter stub.
 * Fails closed in REAL mode until official DHA/AfyaConnect remittance settlement contract is confirmed.
 */
export class UnavailableDhaPaymentAllocationAdapter implements DhaPaymentAllocationAdapter {
  readonly mode = 'REAL';

  async allocatePayment(): Promise<DhaPaymentAllocationResult> {
    throw new AppError(
      'DHA live payment allocation / remittance settlement contract is unconfirmed',
      503,
      'DHA_PAYMENT_ALLOCATION_CONTRACT_UNCONFIRMED',
    );
  }
}

export const createDhaPaymentAllocationAdapter = (
  envConfig = env.dha,
): DhaPaymentAllocationAdapter => {
  if (envConfig.integrationMode === 'MOCK') {
    return new MockDhaPaymentAllocationAdapter();
  }
  return new UnavailableDhaPaymentAllocationAdapter();
};
