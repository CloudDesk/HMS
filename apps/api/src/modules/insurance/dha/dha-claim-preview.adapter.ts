import { AppError } from '../../../shared/errors/app-error.js';
import { env } from '../../../config/env.js';
import { externalReadinessCodes } from '../insurance-claim.service.js';

export interface DhaClaimPreviewLine {
  serviceId: string;
  serviceCode?: string;
  quantity: number;
  claimedAmount: number;
  interventionCode?: string;
}

export interface DhaClaimPreviewIssue {
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message?: string;
  invoiceItemId?: string;
}

export interface DhaClaimPreviewRequest {
  claimId: string;
  mockSubmissionReference: string;
  sourceFingerprint: string;
  version: number;
  correlationId: string;
  claimedTotal: number;
  lineCount: number;
  lines: DhaClaimPreviewLine[];
  issues: DhaClaimPreviewIssue[];
}

export interface DhaClaimPreviewResult {
  source: 'MOCK' | 'REAL';
  claimId: string;
  mockSubmissionReference: string;
  status: 'PREVIEW_AVAILABLE' | 'PREVIEW_BLOCKED';
  lineCount: number;
  claimedTotal: number;
  issues: DhaClaimPreviewIssue[];
  correlationId: string;
  previewedAt: Date;
}

export interface DhaClaimPreviewAdapter {
  readonly mode: 'MOCK' | 'REAL';
  previewClaim(request: DhaClaimPreviewRequest): Promise<DhaClaimPreviewResult>;
}

/**
 * Real DHA Claim Preview Adapter placeholder.
 * Fails closed when the confirmed DHA claim preview contract is not available.
 */
export class UnavailableDhaClaimPreviewAdapter implements DhaClaimPreviewAdapter {
  readonly mode = 'REAL';

  async previewClaim(): Promise<DhaClaimPreviewResult> {
    throw new AppError(
      'Real DHA claim preview contract is unconfirmed',
      503,
      'DHA_CLAIM_PREVIEW_CONTRACT_UNCONFIRMED',
    );
  }
}

/**
 * Isolated Mock DHA Claim Preview Adapter.
 * Simulates deterministic claim preview for development/testing.
 * NEVER calls the network, never claims real DHA preview, and marks responses with source = MOCK.
 */
export class MockDhaClaimPreviewAdapter implements DhaClaimPreviewAdapter {
  readonly mode = 'MOCK';

  async previewClaim(request: DhaClaimPreviewRequest): Promise<DhaClaimPreviewResult> {
    const hasBlockingErrors = request.issues.some(
      (i) => i.severity === 'ERROR' && !externalReadinessCodes.has(i.code),
    );

    return {
      source: 'MOCK',
      claimId: request.claimId,
      mockSubmissionReference: request.mockSubmissionReference,
      status: hasBlockingErrors ? 'PREVIEW_BLOCKED' : 'PREVIEW_AVAILABLE',
      lineCount: request.lineCount,
      claimedTotal: request.claimedTotal,
      issues: request.issues,
      correlationId: request.correlationId,
      previewedAt: new Date(),
    };
  }
}

export const createDhaClaimPreviewAdapter = (
  envConfig = env.dha,
): DhaClaimPreviewAdapter => {
  if (envConfig.integrationMode === 'MOCK') {
    return new MockDhaClaimPreviewAdapter();
  }
  return new UnavailableDhaClaimPreviewAdapter();
};
