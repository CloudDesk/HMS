import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';

export type ShaEligibilityRequest = {
  memberNumber: string;
  patientNumber: string;
  subscriberId?: string | null;
  policyNumber: string;
  schemeCode?: string | null;
  payerCode: string;
  requestedDate: string;
  facilityCode?: string;
  correlationId: string;
};

const SENSITIVE_KEY_REGEX =
  /auth|token|secret|key|password|credential|bearer|national|idnumber|id_number|identifier|dob|birth|gender|phone|email|address|diagnosis|clinical|ssn/i;

export const sanitizeDetails = (
  details?: Record<string, unknown> | null
): Record<string, unknown> | undefined => {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        sanitized[key] = value.filter(
          (item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
        );
      } else {
        const nested = sanitizeDetails(value as Record<string, unknown>);
        if (nested && Object.keys(nested).length > 0) {
          sanitized[key] = nested;
        }
      }
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

export type ShaEligibilityResponse = {
  status: 'ELIGIBLE' | 'INELIGIBLE' | 'PENDING' | 'FAILED';
  externalReferenceId?: string | null;
  reasonCode: string;
  message: string;
  details?: Record<string, unknown>;
};

export interface IShaEligibilityAdapter {
  verifyEligibility(request: ShaEligibilityRequest): Promise<ShaEligibilityResponse>;
}

export class MockShaEligibilityAdapter implements IShaEligibilityAdapter {
  async verifyEligibility(request: ShaEligibilityRequest): Promise<ShaEligibilityResponse> {
    const memUpper = request.memberNumber.toUpperCase();

    // Deterministic simulation rules for dev & test
    if (memUpper.includes('FAIL') || memUpper.includes('ERROR')) {
      return {
        status: 'FAILED',
        externalReferenceId: null,
        reasonCode: 'SHA_TRANSPORT_ERROR',
        message: 'Simulated communication failure with SHA gateway',
      };
    }

    if (memUpper.includes('INELIGIBLE') || memUpper.includes('INEL')) {
      return {
        status: 'INELIGIBLE',
        externalReferenceId: `SHA-REF-${randomUUID().slice(0, 8).toUpperCase()}`,
        reasonCode: 'SHA_MEMBER_NOT_ELIGIBLE',
        message: 'SHA confirmed member is not currently eligible for benefits',
      };
    }

    if (memUpper.includes('PENDING')) {
      return {
        status: 'PENDING',
        externalReferenceId: `SHA-REF-${randomUUID().slice(0, 8).toUpperCase()}`,
        reasonCode: 'SHA_VERIFICATION_PENDING',
        message: 'SHA eligibility request accepted and pending manual review',
      };
    }

    // Default success
    return {
      status: 'ELIGIBLE',
      externalReferenceId: `SHA-REF-${randomUUID().slice(0, 8).toUpperCase()}`,
      reasonCode: 'SHA_CONFIRMED_ELIGIBLE',
      message: 'SHA confirmed active member eligibility',
      details: {
        schemeCode: request.schemeCode ?? 'SHIF',
        verifiedAsOf: request.requestedDate,
      },
    };
  }
}

export class HttpShaEligibilityAdapter implements IShaEligibilityAdapter {
  constructor(
    private readonly baseUrl: string = env.sha.baseUrl,
    private readonly apiKey: string = env.sha.apiKey,
    private readonly facilityCode: string = env.sha.facilityCode,
    private readonly timeoutMs: number = env.sha.timeoutMs
  ) {}

  async verifyEligibility(request: ShaEligibilityRequest): Promise<ShaEligibilityResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/eligibility/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'X-Facility-Code': this.facilityCode || request.facilityCode || '',
          'X-Correlation-Id': request.correlationId,
        },
        body: JSON.stringify({
          memberNumber: request.memberNumber,
          patientNumber: request.patientNumber,
          subscriberId: request.subscriberId,
          policyNumber: request.policyNumber,
          schemeCode: request.schemeCode,
          evaluationDate: request.requestedDate,
        }),
        signal: controller.signal,
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        return {
          status: 'FAILED',
          externalReferenceId: (data.referenceId as string) ?? null,
          reasonCode: 'SHA_HTTP_ERROR',
          message: (data.message as string) ?? `SHA gateway returned HTTP ${response.status}`,
          details: sanitizeDetails(data.details as Record<string, unknown>),
        };
      }

      // Map SHA upstream status
      const upstreamStatus = String(data.eligibilityStatus ?? data.status ?? '').toUpperCase();
      let status: 'ELIGIBLE' | 'INELIGIBLE' | 'PENDING' | 'FAILED' = 'FAILED';

      if (upstreamStatus === 'ELIGIBLE' || upstreamStatus === 'ACTIVE') {
        status = 'ELIGIBLE';
      } else if (upstreamStatus === 'INELIGIBLE' || upstreamStatus === 'INACTIVE' || upstreamStatus === 'SUSPENDED') {
        status = 'INELIGIBLE';
      } else if (upstreamStatus === 'PENDING' || upstreamStatus === 'PROCESSING') {
        status = 'PENDING';
      }

      return {
        status,
        externalReferenceId: (data.referenceId as string) ?? (data.shaReference as string) ?? null,
        reasonCode: status === 'ELIGIBLE' ? 'SHA_CONFIRMED_ELIGIBLE' : 'SHA_STATUS_RECEIVED',
        message: (data.message as string) ?? `SHA eligibility evaluated as ${status}`,
        details: sanitizeDetails(data.details as Record<string, unknown>),
      };
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      return {
        status: 'FAILED',
        externalReferenceId: null,
        reasonCode: isAbort ? 'SHA_TIMEOUT' : 'SHA_COMMUNICATION_ERROR',
        message: isAbort ? 'SHA eligibility request timed out' : (error as Error).message,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const createShaEligibilityAdapter = (customAdapter?: IShaEligibilityAdapter): IShaEligibilityAdapter => {
  if (customAdapter) return customAdapter;
  if (env.sha.enabled && env.sha.baseUrl) {
    return new HttpShaEligibilityAdapter();
  }
  return new MockShaEligibilityAdapter();
};
