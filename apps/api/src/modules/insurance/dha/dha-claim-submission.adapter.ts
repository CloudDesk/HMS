import { randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors/app-error.js';
import { env } from '../../../config/env.js';

export interface DhaClaimSubmissionLine {
  serviceId: string;
  serviceCode?: string;
  quantity: number;
  claimedUnitAmount: number;
  claimedAmount: number;
  interventionCode?: string;
  authorizationId?: string;
}

export interface DhaClaimSubmissionRequest {
  claimId: string;
  sourceFingerprint: string;
  version: number;
  correlationId: string;
  branchId: string;
  patientId: string;
  memberId: string;
  invoiceId: string;
  claimedTotal: number;
  lines: DhaClaimSubmissionLine[];
  preauthorizationNumber?: string;
  consentReference?: string;
}

export interface DhaClaimSubmissionResult {
  success: boolean;
  externalReference: string;
  source: 'MOCK' | 'REAL';
  status: 'SUBMITTED';
  submittedAt: Date;
}

export interface DhaClaimSubmissionAdapter {
  readonly mode: 'MOCK' | 'REAL';
  submitClaim(request: DhaClaimSubmissionRequest): Promise<DhaClaimSubmissionResult>;
}

/**
 * Real DHA Claim Submission Adapter placeholder.
 * Fails closed when the confirmed DHA claim submission contract is not available.
 */
export class UnavailableDhaClaimSubmissionAdapter implements DhaClaimSubmissionAdapter {
  readonly mode = 'REAL';

  async submitClaim(): Promise<DhaClaimSubmissionResult> {
    throw new AppError(
      'Real DHA claim submission contract is unconfirmed',
      503,
      'DHA_CLAIM_SUBMISSION_CONTRACT_UNCONFIRMED',
    );
  }
}

/**
 * Isolated Mock DHA Claim Submission Adapter.
 * Simulates deterministic claim submission for development/testing.
 * NEVER calls the network, never claims real SHA/DHA submission, and marks responses with source = MOCK.
 */
export class MockDhaClaimSubmissionAdapter implements DhaClaimSubmissionAdapter {
  readonly mode = 'MOCK';

  async submitClaim(request: DhaClaimSubmissionRequest): Promise<DhaClaimSubmissionResult> {
    const uniqueSuffix = randomUUID().slice(0, 8).toUpperCase();
    const externalReference = `MOCK-CLAIM-${request.claimId.slice(-8).toUpperCase()}-${uniqueSuffix}`;

    return {
      success: true,
      externalReference,
      source: 'MOCK',
      status: 'SUBMITTED',
      submittedAt: new Date(),
    };
  }
}

export const createDhaClaimSubmissionAdapter = (
  envConfig = env.dha,
): DhaClaimSubmissionAdapter => {
  if (envConfig.integrationMode === 'MOCK') {
    return new MockDhaClaimSubmissionAdapter();
  }
  return new UnavailableDhaClaimSubmissionAdapter();
};
