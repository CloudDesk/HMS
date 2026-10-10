import { randomUUID } from 'node:crypto';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type {
  MockClaimClosureStatus,
  MockClaimClosurePath,
} from './dha-claim-closure.model.js';

export interface DhaClaimClosureRequest {
  claimId: string;
  sourceFingerprint: string;
  status: MockClaimClosureStatus;
  closurePath: MockClaimClosurePath;
  closureReason: string;
  claimedTotal: number;
  remittedTotal: number;
  allocatedTotal: number;
  reconciledTotal: number;
  closureSnapshotFingerprint: string;
  idempotencyKey?: string;
  correlationId: string;
}

export interface DhaClaimClosureResult {
  source: 'MOCK' | 'REAL';
  externalClosureReference: string;
  status: MockClaimClosureStatus;
  closurePath: MockClaimClosurePath;
  closedAt: Date;
  correlationId: string;
}

export interface DhaClaimClosureAdapter {
  readonly mode: 'MOCK' | 'REAL';
  closeClaim(request?: DhaClaimClosureRequest): Promise<DhaClaimClosureResult>;
}

export class MockDhaClaimClosureAdapter implements DhaClaimClosureAdapter {
  readonly mode = 'MOCK' as const;

  async closeClaim(
    request?: DhaClaimClosureRequest,
  ): Promise<DhaClaimClosureResult> {
    const randomHex = randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
    const externalClosureReference = `MOCK-CLS-${randomHex}-${Date.now().toString(36).toUpperCase()}`;

    return {
      source: 'MOCK',
      externalClosureReference,
      status: request?.status ?? 'MOCK_CLOSED_RECONCILED',
      closurePath: request?.closurePath ?? 'SETTLEMENT_RECONCILED',
      closedAt: new Date(),
      correlationId: request?.correlationId ?? randomUUID(),
    };
  }
}

export class UnavailableDhaClaimClosureAdapter
  implements DhaClaimClosureAdapter
{
  readonly mode = 'REAL' as const;

  async closeClaim(
    request?: DhaClaimClosureRequest,
  ): Promise<DhaClaimClosureResult> {
    void request;
    throw new AppError(
      'Real DHA claim closure is unconfirmed; no contract or sandbox available',
      503,
      'DHA_CLAIM_CLOSURE_CONTRACT_UNCONFIRMED',
    );
  }
}

export function createDhaClaimClosureAdapter(
  integrationMode?: 'MOCK' | 'REAL',
): DhaClaimClosureAdapter {
  const mode = integrationMode ?? env.dha.integrationMode;
  if (mode === 'REAL') {
    return new UnavailableDhaClaimClosureAdapter();
  }
  return new MockDhaClaimClosureAdapter();
}
