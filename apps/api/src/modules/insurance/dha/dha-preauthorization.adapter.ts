import { AppError } from '../../../shared/errors/app-error.js';

export interface DhaPreauthRequest {
  patientId: string;
  clientRegistryId?: string | null;
  authorizationId: string;
  encounterId?: string | null;
  interventionCode?: string | null;
  requestedDate: string;
  correlationId: string;
  lines: {
    serviceId: string;
    serviceCode: string;
    requestedQuantity: number;
    requestedAmount?: number | null;
  }[];
  consentReference?: string;
}

export interface DhaPreauthDecisionLine {
  serviceId: string;
  serviceCode?: string;
  approvedQuantity?: number;
  approvedAmount?: number;
  rejectedQuantity?: number;
}

export interface DhaPreauthDecision {
  success: boolean;
  status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'FAILED';
  externalReference: string;
  approvedAmount?: number;
  denialReason?: string;
  decisionDate: Date;
  reasonCode?: string;
  source: 'MOCK' | 'REAL';
  lines: DhaPreauthDecisionLine[];
}

export interface DhaPreauthorizationAdapter {
  readonly mode: 'MOCK' | 'REAL';
  submitPreauthorization(request: DhaPreauthRequest): Promise<DhaPreauthDecision>;
}

/**
 * Real DHA Preauthorization Adapter placeholder.
 * Fails closed when the confirmed DHA preauthorization submission contract is not available.
 */
export class UnavailableDhaPreauthorizationAdapter implements DhaPreauthorizationAdapter {
  readonly mode = 'REAL';

  async submitPreauthorization(): Promise<DhaPreauthDecision> {
    throw new AppError(
      'Real DHA preauthorization contract is unconfirmed',
      503,
      'DHA_PREAUTHORIZATION_CONTRACT_UNCONFIRMED',
    );
  }
}

/**
 * Isolated Mock DHA Preauthorization Adapter.
 * Simulates deterministic approval, partial approval, or rejection for development/testing.
 * NEVER calls the network, never claims real DHA approval, and marks responses with source = MOCK.
 */
export class MockDhaPreauthorizationAdapter implements DhaPreauthorizationAdapter {
  readonly mode = 'MOCK';

  constructor(
    private readonly outcome: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' = 'APPROVED',
  ) {}

  async submitPreauthorization(request: DhaPreauthRequest): Promise<DhaPreauthDecision> {
    const extRef = `MOCK-PREAUTH-${request.authorizationId.slice(-8).toUpperCase()}`;

    if (this.outcome === 'REJECTED') {
      return {
        success: false,
        status: 'REJECTED',
        externalReference: extRef,
        approvedAmount: 0,
        denialReason: 'MOCK_PREAUTH_REJECTED_BY_CONFIG',
        decisionDate: new Date(),
        reasonCode: 'MOCK_PREAUTH_REJECTED_BY_CONFIG',
        source: 'MOCK',
        lines: request.lines.map((line) => ({
          serviceId: line.serviceId,
          serviceCode: line.serviceCode,
          approvedQuantity: 0,
          approvedAmount: 0,
          rejectedQuantity: line.requestedQuantity,
        })),
      };
    }

    if (this.outcome === 'PARTIALLY_APPROVED') {
      const lines = request.lines.map((line) => {
        const approved = Math.max(1, Math.floor(line.requestedQuantity / 2));
        const rejected = line.requestedQuantity - approved;
        const reqAmt = line.requestedAmount || 2500 * line.requestedQuantity;
        const appAmt = reqAmt * 0.5;
        return {
          serviceId: line.serviceId,
          serviceCode: line.serviceCode,
          approvedQuantity: approved,
          approvedAmount: appAmt,
          rejectedQuantity: rejected,
        };
      });
      const totalApproved = lines.reduce((acc, l) => acc + (l.approvedAmount ?? 0), 0);
      return {
        success: true,
        status: 'PARTIALLY_APPROVED',
        externalReference: extRef,
        approvedAmount: totalApproved,
        decisionDate: new Date(),
        reasonCode: 'DHA_MOCK_PARTIAL_APPROVAL',
        source: 'MOCK',
        lines,
      };
    }

    // Default: APPROVED
    const lines = request.lines.map((line) => {
      const reqAmt = line.requestedAmount || 2500 * line.requestedQuantity;
      return {
        serviceId: line.serviceId,
        serviceCode: line.serviceCode,
        approvedQuantity: line.requestedQuantity,
        approvedAmount: reqAmt,
        rejectedQuantity: 0,
      };
    });
    const totalApproved = lines.reduce((acc, l) => acc + (l.approvedAmount ?? 0), 0);

    return {
      success: true,
      status: 'APPROVED',
      externalReference: extRef,
      approvedAmount: totalApproved,
      decisionDate: new Date(),
      reasonCode: 'DHA_MOCK_APPROVED',
      source: 'MOCK',
      lines,
    };
  }
}
