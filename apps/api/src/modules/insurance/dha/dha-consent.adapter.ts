import { AppError } from '../../../shared/errors/app-error.js';

export interface DhaConsentRequest {
  patientId: string;
  clientRegistryId?: string | null;
  authorizationId: string;
  correlationId?: string;
  otp?: string;
}

export interface DhaConsentResult {
  verified: boolean;
  success: boolean;
  consentStatus: 'GRANTED' | 'DENIED' | 'PENDING';
  consentReference?: string;
  failureReason?: string;
  source: 'MOCK' | 'REAL';
  verifiedAt: Date;
  message?: string;
}

export interface DhaConsentAdapter {
  readonly mode: 'MOCK' | 'REAL';
  requestConsent(request: DhaConsentRequest): Promise<DhaConsentResult>;
  verifyConsent(request: DhaConsentRequest): Promise<DhaConsentResult>;
}

/**
 * Real DHA Consent Adapter placeholder.
 * Fails closed when the confirmed DHA consent/OTP/biometric contract is not available.
 */
export class UnavailableDhaConsentAdapter implements DhaConsentAdapter {
  readonly mode = 'REAL';

  async requestConsent(): Promise<DhaConsentResult> {
    throw new AppError(
      'Real DHA consent contract is unconfirmed',
      503,
      'DHA_CONSENT_CONTRACT_UNCONFIRMED',
    );
  }

  async verifyConsent(): Promise<DhaConsentResult> {
    throw new AppError(
      'Real DHA consent contract is unconfirmed',
      503,
      'DHA_CONSENT_CONTRACT_UNCONFIRMED',
    );
  }
}

/**
 * Isolated Mock DHA Consent Adapter.
 * Simulates deterministic consent flow for local development and testing.
 * NEVER calls the network, never requires real credentials, and never stores OTP/biometric data.
 */
export class MockDhaConsentAdapter implements DhaConsentAdapter {
  readonly mode = 'MOCK';

  constructor(
    private readonly defaultStatus: 'VERIFIED' | 'DENIED' | 'FAILED' | 'PENDING' = 'VERIFIED',
  ) {}

  async requestConsent(request: DhaConsentRequest): Promise<DhaConsentResult> {
    if (this.defaultStatus === 'DENIED' || this.defaultStatus === 'FAILED') {
      return {
        verified: false,
        success: false,
        consentStatus: 'DENIED',
        failureReason: 'MOCK_CONSENT_VERIFICATION_FAILED',
        source: 'MOCK',
        verifiedAt: new Date(),
        message: 'Mock DHA consent was denied by patient',
      };
    }

    if (this.defaultStatus === 'PENDING') {
      return {
        verified: false,
        success: true,
        consentStatus: 'PENDING',
        consentReference: `MOCK-CONSENT-REQ-${request.authorizationId.slice(-6).toUpperCase()}`,
        source: 'MOCK',
        verifiedAt: new Date(),
        message: 'Mock OTP requested; pending verification',
      };
    }

    // Default: 'VERIFIED' -> automatically granted in mock verification
    return {
      verified: true,
      success: true,
      consentStatus: 'GRANTED',
      consentReference: `MOCK-CONSENT-${request.authorizationId.slice(-6).toUpperCase()}`,
      source: 'MOCK',
      verifiedAt: new Date(),
      message: 'Mock consent granted',
    };
  }

  async verifyConsent(request: DhaConsentRequest): Promise<DhaConsentResult> {
    if (this.defaultStatus === 'DENIED' || this.defaultStatus === 'FAILED') {
      return {
        verified: false,
        success: false,
        consentStatus: 'DENIED',
        failureReason: 'MOCK_CONSENT_VERIFICATION_FAILED',
        source: 'MOCK',
        verifiedAt: new Date(),
        message: 'Mock consent verification failed',
      };
    }

    if (request.otp === 'wrong' || request.otp === 'invalid' || request.otp === '000000') {
      return {
        verified: false,
        success: false,
        consentStatus: 'DENIED',
        failureReason: 'INVALID_SYNTHETIC_OTP',
        source: 'MOCK',
        verifiedAt: new Date(),
        message: 'Invalid synthetic test OTP',
      };
    }

    return {
      verified: true,
      success: true,
      consentStatus: 'GRANTED',
      consentReference: `MOCK-CONSENT-${request.authorizationId.slice(-6).toUpperCase()}`,
      source: 'MOCK',
      verifiedAt: new Date(),
      message: 'Mock consent verified',
    };
  }
}
