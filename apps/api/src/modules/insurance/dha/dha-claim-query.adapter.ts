import { randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors/app-error.js';
import { env } from '../../../config/env.js';
import type { MockClaimQueryStatus } from './dha-claim-query.model.js';

export interface DhaClaimQueryCreateRequest {
  claimId: string;
  sourceFingerprint: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  queryReason?: string;
  correlationId: string;
  version: number;
}

export interface DhaClaimQueryResult {
  source: 'MOCK' | 'REAL';
  claimId: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  externalQueryReference: string;
  queryReason: string;
  status: 'OPEN';
  createdAt: Date;
  correlationId: string;
}

export interface DhaClaimQueryRespondRequest {
  claimId: string;
  queryId: string;
  externalQueryReference: string;
  responseNote: string;
  documentIds?: string[];
  resolveImmediately?: boolean;
  correlationId: string;
}

export interface DhaClaimQueryRespondResult {
  source: 'MOCK' | 'REAL';
  responseReference: string;
  externalQueryReference: string;
  status: 'RESPONSE_SUBMITTED' | 'MOCK_RESOLVED';
  respondedAt: Date;
  correlationId: string;
}

export interface DhaClaimQueryAdapter {
  readonly mode: 'MOCK' | 'REAL';
  createQuery(request: DhaClaimQueryCreateRequest): Promise<DhaClaimQueryResult>;
  respondToQuery(request: DhaClaimQueryRespondRequest): Promise<DhaClaimQueryRespondResult>;
}

/**
 * Real DHA Claim Query Adapter placeholder.
 * Fails closed when the confirmed DHA claim query / response contract is not available.
 */
export class UnavailableDhaClaimQueryAdapter implements DhaClaimQueryAdapter {
  readonly mode = 'REAL';

  async createQuery(): Promise<DhaClaimQueryResult> {
    throw new AppError(
      'Real DHA claim query contract is unconfirmed',
      503,
      'DHA_CLAIM_QUERY_CONTRACT_UNCONFIRMED',
    );
  }

  async respondToQuery(): Promise<DhaClaimQueryRespondResult> {
    throw new AppError(
      'Real DHA claim query response contract is unconfirmed',
      503,
      'DHA_CLAIM_QUERY_CONTRACT_UNCONFIRMED',
    );
  }
}

/**
 * Isolated Mock DHA Claim Query Adapter.
 * Simulates deterministic query management and response processing for development/testing.
 * NEVER calls the external network, never claims genuine payer acceptance/resolution,
 * and explicitly marks all responses with source = MOCK.
 */
export class MockDhaClaimQueryAdapter implements DhaClaimQueryAdapter {
  readonly mode = 'MOCK';

  async createQuery(request: DhaClaimQueryCreateRequest): Promise<DhaClaimQueryResult> {
    const uniqueSuffix = randomUUID().slice(0, 8).toUpperCase();
    const externalQueryReference = `MOCK-QUERY-${request.claimId.slice(-8).toUpperCase()}-${uniqueSuffix}`;
    const queryReason =
      request.queryReason ??
      'Payer requested operative notes and full discharge summary for itemized services';

    return {
      source: 'MOCK',
      claimId: request.claimId,
      mockDischargeReference: request.mockDischargeReference,
      mockAdjudicationReference: request.mockAdjudicationReference,
      externalQueryReference,
      queryReason,
      status: 'OPEN',
      createdAt: new Date(),
      correlationId: request.correlationId,
    };
  }

  async respondToQuery(
    request: DhaClaimQueryRespondRequest,
  ): Promise<DhaClaimQueryRespondResult> {
    const uniqueSuffix = randomUUID().slice(0, 8).toUpperCase();
    const responseReference = `MOCK-QUERY-RESP-${request.queryId.slice(-8).toUpperCase()}-${uniqueSuffix}`;
    const status: MockClaimQueryStatus = request.resolveImmediately
      ? 'MOCK_RESOLVED'
      : 'RESPONSE_SUBMITTED';

    return {
      source: 'MOCK',
      responseReference,
      externalQueryReference: request.externalQueryReference,
      status,
      respondedAt: new Date(),
      correlationId: request.correlationId,
    };
  }
}

export const createDhaClaimQueryAdapter = (
  envConfig = env.dha,
): DhaClaimQueryAdapter => {
  if (envConfig.integrationMode === 'MOCK') {
    return new MockDhaClaimQueryAdapter();
  }
  return new UnavailableDhaClaimQueryAdapter();
};
