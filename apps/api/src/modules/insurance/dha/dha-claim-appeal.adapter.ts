import { randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors/app-error.js';
import { env } from '../../../config/env.js';
import type { MockClaimAppealStatus } from './dha-claim-appeal.model.js';

export interface DhaClaimAppealCreateRequest {
  claimId: string;
  sourceFingerprint: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  appealReason?: string;
  correlationId: string;
  version: number;
}

export interface DhaClaimAppealCreateResult {
  source: 'MOCK' | 'REAL';
  claimId: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  externalAppealReference: string;
  appealReason: string;
  status: 'OPEN';
  createdAt: Date;
  correlationId: string;
}

export interface DhaClaimAppealSubmitRequest {
  claimId: string;
  appealId: string;
  externalAppealReference: string;
  appealNote: string;
  documentIds?: string[];
  decision?: 'MOCK_UPHELD' | 'MOCK_OVERTURNED' | 'SUBMITTED';
  decisionReason?: string;
  correlationId: string;
}

export interface DhaClaimAppealSubmitResult {
  source: 'MOCK' | 'REAL';
  submissionReference: string;
  externalAppealReference: string;
  status: 'SUBMITTED' | 'MOCK_UPHELD' | 'MOCK_OVERTURNED';
  submittedAt: Date;
  decisionReason?: string;
  correlationId: string;
}

export interface DhaClaimAppealAdapter {
  readonly mode: 'MOCK' | 'REAL';
  createAppeal(request: DhaClaimAppealCreateRequest): Promise<DhaClaimAppealCreateResult>;
  submitAppeal(request: DhaClaimAppealSubmitRequest): Promise<DhaClaimAppealSubmitResult>;
}

/**
 * Real DHA Claim Appeal Adapter placeholder.
 * Fails closed when the confirmed DHA claim appeal contract is not available.
 */
export class UnavailableDhaClaimAppealAdapter implements DhaClaimAppealAdapter {
  readonly mode = 'REAL';

  async createAppeal(): Promise<DhaClaimAppealCreateResult> {
    throw new AppError(
      'Real DHA claim appeal contract is unconfirmed',
      503,
      'DHA_CLAIM_APPEAL_CONTRACT_UNCONFIRMED',
    );
  }

  async submitAppeal(): Promise<DhaClaimAppealSubmitResult> {
    throw new AppError(
      'Real DHA claim appeal submission contract is unconfirmed',
      503,
      'DHA_CLAIM_APPEAL_CONTRACT_UNCONFIRMED',
    );
  }
}

/**
 * Isolated Mock DHA Claim Appeal Adapter.
 * Simulates deterministic appeal processing for development/testing.
 * NEVER calls the external network, never claims genuine payer overturning/upholding,
 * and explicitly marks all responses with source = MOCK.
 */
export class MockDhaClaimAppealAdapter implements DhaClaimAppealAdapter {
  readonly mode = 'MOCK';

  async createAppeal(request: DhaClaimAppealCreateRequest): Promise<DhaClaimAppealCreateResult> {
    const uniqueSuffix = randomUUID().slice(0, 8).toUpperCase();
    const externalAppealReference = `MOCK-APPEAL-${request.claimId.slice(-8).toUpperCase()}-${uniqueSuffix}`;
    const appealReason =
      request.appealReason ??
      'Healthcare provider disputed partial denial based on clinical necessity justification';

    return {
      source: 'MOCK',
      claimId: request.claimId,
      mockDischargeReference: request.mockDischargeReference,
      mockAdjudicationReference: request.mockAdjudicationReference,
      externalAppealReference,
      appealReason,
      status: 'OPEN',
      createdAt: new Date(),
      correlationId: request.correlationId,
    };
  }

  async submitAppeal(request: DhaClaimAppealSubmitRequest): Promise<DhaClaimAppealSubmitResult> {
    const uniqueSuffix = randomUUID().slice(0, 8).toUpperCase();
    const submissionReference = `MOCK-APPEAL-SUB-${request.appealId.slice(-8).toUpperCase()}-${uniqueSuffix}`;
    const status: MockClaimAppealStatus = request.decision ?? 'SUBMITTED';

    return {
      source: 'MOCK',
      submissionReference,
      externalAppealReference: request.externalAppealReference,
      status,
      submittedAt: new Date(),
      decisionReason: request.decisionReason ?? (status === 'MOCK_OVERTURNED' ? 'Appeal granted after secondary medical review' : undefined),
      correlationId: request.correlationId,
    };
  }
}

export const createDhaClaimAppealAdapter = (
  envConfig = env.dha,
): DhaClaimAppealAdapter => {
  if (envConfig.integrationMode === 'MOCK') {
    return new MockDhaClaimAppealAdapter();
  }
  return new UnavailableDhaClaimAppealAdapter();
};
