import type { AuthorizationDecision, AuthorizationRequest } from './insurance-authorization.schemas.js';

export interface ShaPreauthorizationAdapter {
  readonly mode: 'UNAVAILABLE' | 'MOCK' | 'LIVE';
  submit(request: AuthorizationRequest & { correlationId: string }): Promise<AuthorizationDecision>;
}

/** No confirmed SHA contract: fail closed, never send guessed payloads. */
export class UnavailableShaPreauthorizationAdapter implements ShaPreauthorizationAdapter {
  readonly mode = 'UNAVAILABLE';
  async submit(): Promise<AuthorizationDecision> { throw new Error('SHA_PREAUTH_CONTRACT_UNAVAILABLE'); }
}

/** Dependency injection for automated tests only; never selected by production configuration. */
export class MockShaPreauthorizationAdapter implements ShaPreauthorizationAdapter {
  readonly mode = 'MOCK';
  constructor(private readonly outcome: AuthorizationDecision['status'] = 'PENDING') {}
  async submit(request: AuthorizationRequest & { correlationId: string }): Promise<AuthorizationDecision> {
    return {
      status: this.outcome,
      externalReference: `MOCK-${request.correlationId}`,
      lines: request.lines.map(line => ({
        serviceId: line.serviceId,
        approvedQuantity: this.outcome === 'APPROVED' ? line.requestedQuantity : this.outcome === 'PARTIALLY_APPROVED' ? line.requestedQuantity / 2 : 0,
      })),
    };
  }
}
