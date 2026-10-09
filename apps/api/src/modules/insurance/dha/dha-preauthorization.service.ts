import { randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors/app-error.js';
import { env } from '../../../config/env.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import { DhaPreauthorizationReadinessService } from './dha-preauthorization-readiness.service.js';
import {
  type DhaConsentAdapter,
  type DhaConsentResult,
  MockDhaConsentAdapter,
  UnavailableDhaConsentAdapter,
} from './dha-consent.adapter.js';
import {
  type DhaPreauthorizationAdapter,
  type DhaPreauthDecisionLine,
  MockDhaPreauthorizationAdapter,
  UnavailableDhaPreauthorizationAdapter,
} from './dha-preauthorization.adapter.js';
import type { RequestMetadata } from '../insurance.types.js';

export interface DhaPreauthSubmissionResult {
  success: boolean;
  authorizationId: string;
  status: string;
  externalReference: string;
  approvedAmount?: number;
  denialReason?: string;
  decisionDate: Date;
  reasonCode?: string;
  source: 'MOCK' | 'REAL';
  lines: DhaPreauthDecisionLine[];
  idempotent?: boolean;
}

export const createDhaConsentAdapter = (envConfig = env.dha): DhaConsentAdapter => {
  if (envConfig.integrationMode === 'MOCK') {
    return new MockDhaConsentAdapter(envConfig.mockConsentMode);
  }
  return new UnavailableDhaConsentAdapter();
};

export const createDhaPreauthorizationAdapter = (
  envConfig = env.dha,
): DhaPreauthorizationAdapter => {
  if (envConfig.integrationMode === 'MOCK') {
    return new MockDhaPreauthorizationAdapter(envConfig.mockPreauthDecision);
  }
  return new UnavailableDhaPreauthorizationAdapter();
};

export class DhaPreauthorizationService {
  private consentAdapter?: DhaConsentAdapter;
  private preauthAdapter?: DhaPreauthorizationAdapter;

  constructor(
    private readonly authorizationRepository: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    private readonly readinessService: DhaPreauthorizationReadinessService = new DhaPreauthorizationReadinessService(),
    consentAdapter?: DhaConsentAdapter,
    preauthAdapter?: DhaPreauthorizationAdapter,
  ) {
    this.consentAdapter = consentAdapter;
    this.preauthAdapter = preauthAdapter;
  }

  private getConsentAdapter(): DhaConsentAdapter {
    return this.consentAdapter ?? createDhaConsentAdapter();
  }

  private getPreauthAdapter(): DhaPreauthorizationAdapter {
    return this.preauthAdapter ?? createDhaPreauthorizationAdapter();
  }

  /**
   * Processes DHA patient consent using the configured consent adapter.
   * In MOCK mode: returns deterministic synthetic consent without sending SMS or storing real OTPs.
   * In REAL mode: fails closed until real DHA consent contract is confirmed.
   */
  async processConsent(
    authorizationId: string,
    options?: {
      otp?: string;
      actorUserId?: string;
      correlationId?: string;
    },
  ): Promise<DhaConsentResult & { authorizationId: string }> {
    const isIdValid = /^[a-f\d]{24}$/i.test(authorizationId);
    if (!isIdValid) {
      throw new AppError('Invalid authorization ID format', 400, 'VALIDATION_ERROR');
    }

    const authorization = await this.authorizationRepository.get(authorizationId);
    if (!authorization) {
      throw new AppError('Authorization not found', 404, 'AUTHORIZATION_NOT_FOUND');
    }

    const readiness = await this.readinessService.getReadiness(authorizationId, {
      contractConfirmed: true,
      needsPreauth: true,
      actorUserId: options?.actorUserId,
      correlationId: options?.correlationId,
    });

    if (
      readiness.reasonCodes.includes('PATIENT_NOT_FOUND') ||
      readiness.reasonCodes.includes('DHA_PATIENT_MAPPING_REQUIRED') ||
      readiness.reasonCodes.includes('DHA_ELIGIBILITY_REQUIRED')
    ) {
      throw new AppError(
        `Preauthorization prerequisite failed: ${readiness.reasonCodes.join(', ')}`,
        400,
        'PREAUTH_PREREQUISITE_FAILED',
        { reasonCodes: readiness.reasonCodes },
      );
    }

    const adapter = this.getConsentAdapter();
    const correlationId = options?.correlationId || authorization.correlationId || randomUUID();
    const result = options?.otp
      ? await adapter.verifyConsent({
          patientId: authorization.patientId.toString(),
          clientRegistryId: readiness.clientRegistryId,
          authorizationId,
          correlationId,
          otp: options.otp,
        })
      : await adapter.requestConsent({
          patientId: authorization.patientId.toString(),
          clientRegistryId: readiness.clientRegistryId,
          authorizationId,
          correlationId,
        });

    await AuditLogModel.create({
      actorUserId: options?.actorUserId || undefined,
      eventType: 'insurance.dha.consent_processed',
      metadataJson: {
        authorizationId,
        patientId: authorization.patientId.toString(),
        operation: 'DHA_CONSENT',
        source: adapter.mode,
        consentStatus: result.consentStatus,
        verified: result.verified,
        correlationId,
      },
    });

    return {
      authorizationId,
      ...result,
    };
  }

  /**
   * Submits preauthorization for an existing HMS InsuranceAuthorization document.
   *
   * Flow:
   * 1. Check idempotency (if already decided, return existing result without re-submitting).
   * 2. Evaluate 9A preauthorization readiness (fails if prerequisites unmet).
   * 3. Verify consent if intervention requires preauthorization.
   * 4. Transition authorization DRAFT -> SUBMITTED.
   * 5. Call preauthorization adapter (MOCK or REAL).
   * 6. Transition authorization SUBMITTED -> decision.status.
   * 7. Audit operation with source = MOCK | REAL.
   */
  async submitPreauthorization(
    authorizationId: string,
    options?: {
      otp?: string;
      consentReference?: string;
      actorUserId?: string;
      correlationId?: string;
      metadata?: RequestMetadata;
      subBenefitCode?: string;
      interventionCode?: string;
      needsPreauth?: boolean;
    },
  ): Promise<DhaPreauthSubmissionResult> {
    const isIdValid = /^[a-f\d]{24}$/i.test(authorizationId);
    if (!isIdValid) {
      throw new AppError('Invalid authorization ID format', 400, 'VALIDATION_ERROR');
    }

    const authorization = await this.authorizationRepository.get(authorizationId);
    if (!authorization) {
      throw new AppError('Authorization not found', 404, 'AUTHORIZATION_NOT_FOUND');
    }

    // 1. Idempotency Check: if already decided, return existing record
    const alreadyDecidedStatuses = ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'];
    if (alreadyDecidedStatuses.includes(authorization.status)) {
      const approvedAmount = authorization.lines.reduce(
        (acc, l) => acc + (l.approvedAmount ?? 0),
        0,
      );
      return {
        success: authorization.status === 'APPROVED' || authorization.status === 'PARTIALLY_APPROVED',
        authorizationId: authorization._id.toString(),
        status: authorization.status,
        externalReference: authorization.externalReference ?? '',
        approvedAmount,
        denialReason: authorization.reasonCode,
        decisionDate: authorization.decisionDate ?? authorization.updatedAt,
        reasonCode: authorization.reasonCode,
        source: (authorization.integrationMode === 'LIVE' ? 'REAL' : authorization.integrationMode) as 'MOCK' | 'REAL',
        lines: authorization.lines.map((l) => ({
          serviceId: l.serviceId.toString(),
          serviceCode: l.serviceCode,
          approvedQuantity: l.approvedQuantity ?? undefined,
          approvedAmount: l.approvedAmount ?? undefined,
          rejectedQuantity: l.rejectedQuantity ?? undefined,
        })),
        idempotent: true,
      };
    }

    if (authorization.status !== 'DRAFT' && authorization.status !== 'SUBMITTED') {
      throw new AppError(
        `Cannot submit authorization with status ${authorization.status}`,
        409,
        'INVALID_AUTHORIZATION_STATUS',
      );
    }

    const correlationId = options?.correlationId || authorization.correlationId || randomUUID();
    const actorUserId = options?.actorUserId || authorization.history[0]?.actorId?.toString() || 'SYSTEM';
    const metadata: RequestMetadata = options?.metadata || {};

    // 2. Evaluate 9A Readiness
    const readiness = await this.readinessService.getReadiness(authorizationId, {
      subBenefitCode: options?.subBenefitCode,
      interventionCode: options?.interventionCode,
      needsPreauth: options?.needsPreauth !== undefined ? options.needsPreauth : true,
      contractConfirmed: true,
      actorUserId,
      correlationId,
    });

    if (!readiness.ready) {
      throw new AppError(
        `Preauthorization readiness check failed: ${readiness.reasonCodes.join(', ')}`,
        422,
        'PREAUTHORIZATION_READINESS_FAILED',
        {
          reasonCodes: readiness.reasonCodes,
          checks: readiness.checks,
        },
      );
    }

    // 3. Consent check if preauthorization is required
    let consentRef = options?.consentReference;
    if (!consentRef && readiness.needsPreauth) {
      const consentAdapter = this.getConsentAdapter();
      const consentResult = await consentAdapter.verifyConsent({
        patientId: authorization.patientId.toString(),
        clientRegistryId: readiness.clientRegistryId,
        authorizationId,
        correlationId,
        otp: options?.otp,
      });

      if (!consentResult.success || !consentResult.verified || consentResult.consentStatus !== 'GRANTED') {
        throw new AppError(
          'Patient consent is required for DHA preauthorization',
          422,
          'PREAUTHORIZATION_CONSENT_REQUIRED',
        );
      }
      consentRef = consentResult.consentReference;
    }

    const preauthAdapter = this.getPreauthAdapter();

    // 4. Lifecycle Transition: DRAFT -> SUBMITTED
    let activeRecord = authorization;
    if (activeRecord.status === 'DRAFT') {
      const submitted = await this.authorizationRepository.transition(
        activeRecord,
        'SUBMITTED',
        actorUserId,
        metadata,
        'INSURANCE_AUTHORIZATION_SUBMITTED',
        {
          integrationMode: preauthAdapter.mode === 'REAL' ? 'LIVE' : 'MOCK',
          correlationId,
        },
      );
      if (!submitted) {
        throw new AppError('Authorization changed; refresh and retry', 409, 'STALE_AUTHORIZATION');
      }
      activeRecord = submitted;
    }

    // 5. Call Preauthorization Adapter
    let decision;
    try {
      decision = await preauthAdapter.submitPreauthorization({
        patientId: authorization.patientId.toString(),
        clientRegistryId: readiness.clientRegistryId,
        authorizationId,
        encounterId: authorization.encounterId?.toString(),
        interventionCode: readiness.interventionCode,
        requestedDate: authorization.requestedDate,
        correlationId,
        consentReference: consentRef,
        lines: authorization.lines.map((l) => ({
          serviceId: l.serviceId.toString(),
          serviceCode: l.serviceCode,
          requestedQuantity: l.requestedQuantity,
          requestedAmount: l.requestedAmount ?? undefined,
        })),
      });
    } catch (adapterError) {
      await this.authorizationRepository.transition(
        activeRecord,
        'FAILED',
        actorUserId,
        metadata,
        'INSURANCE_AUTHORIZATION_FAILED',
        { reasonCode: 'DHA_PREAUTH_ADAPTER_FAILURE' },
      );
      throw adapterError;
    }

    // 6. Lifecycle Transition: SUBMITTED -> decision.status
    const updated = await this.authorizationRepository.transition(
      activeRecord,
      decision.status,
      actorUserId,
      metadata,
      'INSURANCE_AUTHORIZATION_DECISION_RECEIVED',
      {
        externalReference: decision.externalReference,
        decisionDate: decision.decisionDate,
        reasonCode: decision.reasonCode || decision.denialReason,
        lines: activeRecord.lines.map((l) => {
          const dLine = decision.lines.find((dl) => dl.serviceId === l.serviceId.toString());
          return {
            serviceId: l.serviceId,
            serviceCode: l.serviceCode,
            requestedQuantity: l.requestedQuantity,
            approvedQuantity: dLine?.approvedQuantity ?? (decision.status === 'APPROVED' ? l.requestedQuantity : 0),
            approvedAmount: dLine?.approvedAmount,
            rejectedQuantity: dLine?.rejectedQuantity ?? (decision.status === 'REJECTED' ? l.requestedQuantity : 0),
          };
        }),
      },
    );

    if (!updated) {
      throw new AppError('Failed to record authorization decision', 500, 'TRANSITION_FAILED');
    }

    // 7. Safe Audit Logging
    await AuditLogModel.create({
      actorUserId,
      eventType: 'INSURANCE_PREAUTHORIZATION_SUBMITTED',
      metadataJson: {
        authorizationId,
        patientId: authorization.patientId.toString(),
        operation: 'DHA_PREAUTHORIZATION',
        source: preauthAdapter.mode,
        externalReference: decision.externalReference,
        status: decision.status,
        correlationId,
      },
    });

    return {
      success: decision.success,
      authorizationId,
      status: decision.status,
      externalReference: decision.externalReference,
      approvedAmount: decision.approvedAmount,
      denialReason: decision.denialReason,
      decisionDate: decision.decisionDate,
      reasonCode: decision.reasonCode,
      source: preauthAdapter.mode,
      lines: decision.lines,
      idempotent: false,
    };
  }
}
