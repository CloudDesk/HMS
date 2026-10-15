import { randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors/app-error.js';
import { env } from '../../../config/env.js';

export interface DhaClaimDischargeRequest {
  claimId: string;
  sourceFingerprint: string;
  mockSubmissionReference: string;
  mockPreviewStatus: string;
  version: number;
  correlationId: string;
  claimedTotal: number;
  lineCount: number;
}

export interface DhaClaimDischargeResult {
  source: 'MOCK' | 'REAL';
  claimId: string;
  mockSubmissionReference: string;
  externalDischargeReference: string;
  status: 'MOCK_DISCHARGED';
  dischargedAt: Date;
  correlationId: string;
}

export interface DhaClaimDischargeAdapter {
  readonly mode: 'MOCK' | 'REAL';
  dischargeClaim(request: DhaClaimDischargeRequest): Promise<DhaClaimDischargeResult>;
}

/**
 * Real DHA Claim Discharge Adapter placeholder.
 * Fails closed when the confirmed DHA claim discharge contract is not available.
 */
export class UnavailableDhaClaimDischargeAdapter implements DhaClaimDischargeAdapter {
  readonly mode = 'REAL';

  async dischargeClaim(): Promise<DhaClaimDischargeResult> {
    throw new AppError(
      'Real DHA claim discharge contract is unconfirmed',
      503,
      'DHA_CLAIM_DISCHARGE_CONTRACT_UNCONFIRMED',
    );
  }
}

/**
 * Isolated Mock DHA Claim Discharge Adapter.
 * Simulates deterministic claim discharge / final submission for development/testing.
 * NEVER calls the network, never claims real DHA discharge, and marks responses with source = MOCK.
 */
export class MockDhaClaimDischargeAdapter implements DhaClaimDischargeAdapter {
  readonly mode = 'MOCK';

  async dischargeClaim(request: DhaClaimDischargeRequest): Promise<DhaClaimDischargeResult> {
    const uniqueSuffix = randomUUID().slice(0, 8).toUpperCase();
    const externalDischargeReference = `MOCK-DISCHARGE-${request.claimId.slice(-8).toUpperCase()}-${uniqueSuffix}`;

    return {
      source: 'MOCK',
      claimId: request.claimId,
      mockSubmissionReference: request.mockSubmissionReference,
      externalDischargeReference,
      status: 'MOCK_DISCHARGED',
      dischargedAt: new Date(),
      correlationId: request.correlationId,
    };
  }
}

export const createDhaClaimDischargeAdapter = (
  envConfig = env.dha,
): DhaClaimDischargeAdapter => {
  if (envConfig.integrationMode === 'MOCK') {
    return new MockDhaClaimDischargeAdapter();
  }
  return new UnavailableDhaClaimDischargeAdapter();
};
