import { Types } from 'mongoose';
import { AppError } from '../../../shared/errors/app-error.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { PatientRepository } from '../../patients/patient.repository.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import { InsuranceRepository } from '../insurance.repository.js';
import { InsuranceService } from '../insurance.service.js';
import { InsuranceIntegrationRepository } from '../insurance-integration.repository.js';
import { DhaInterventionCoverageService } from './dha-intervention-coverage.service.js';
import { evaluateFacilityIdentifierReadiness, type BranchIdentifierLike } from '../../branches/branch-identifier.utils.js';
import { EligibilityVerificationModel } from '../insurance.model.js';

export type DhaPreauthReadinessCheck = {
  code: string;
  name: string;
  passed: boolean;
  message?: string;
};

export type DhaConsentReadiness =
  | 'NOT_REQUIRED'
  | 'REQUIRED'
  | 'READY'
  | 'NOT_READY'
  | 'CONTRACT_UNCONFIRMED';

export type DhaPreauthReadinessResult = {
  ready: boolean;
  authorizationId: string;
  patientId: string;
  clientRegistryId?: string | null;
  interventionCode?: string | null;
  needsPreauth?: boolean | null;
  consentReadiness: DhaConsentReadiness;
  checks: DhaPreauthReadinessCheck[];
  reasonCodes: string[];
};

export type DhaPreauthReadinessOptions = {
  subBenefitCode?: string;
  interventionCode?: string;
  needsPreauth?: boolean;
  contractConfirmed?: boolean;
  actorUserId?: string;
  correlationId?: string;
};

export class DhaPreauthorizationReadinessService {
  constructor(
    private readonly authorizationRepository: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    private readonly patientRepository: PatientRepository = new PatientRepository(),
    private readonly insuranceRepository: InsuranceRepository = new InsuranceRepository(),
    private readonly insuranceService: InsuranceService = new InsuranceService(new InsuranceRepository()),
    private readonly integrationRepository: InsuranceIntegrationRepository = new InsuranceIntegrationRepository(),
    private readonly interventionCoverageService: DhaInterventionCoverageService = new DhaInterventionCoverageService(),
  ) {}

  /**
   * Evaluates locally whether an existing HMS insurance authorization is ready for
   * a future DHA authorization operation.
   *
   * Invariant:
   * - Does NOT call any undocumented DHA preauthorization submission endpoint.
   * - Does NOT modify InsuranceAuthorization document or status.
   * - Does NOT execute or store OTPs or biometric credentials.
   */
  async getReadiness(
    authorizationId: string,
    options?: DhaPreauthReadinessOptions,
  ): Promise<DhaPreauthReadinessResult> {
    const isIdValid = /^[a-f\d]{24}$/i.test(authorizationId);
    if (!isIdValid) {
      throw new AppError('Invalid authorization ID format', 400, 'VALIDATION_ERROR');
    }

    const authorization = await this.authorizationRepository.get(authorizationId);
    if (!authorization) {
      throw new AppError('Authorization not found', 404, 'AUTHORIZATION_NOT_FOUND');
    }

    const patientId = authorization.patientId.toString();
    const memberId = authorization.memberId.toString();
    const branchId = authorization.branchId.toString();
    const encounterId = authorization.encounterId?.toString();
    const requestedDate = authorization.requestedDate;

    const checks: DhaPreauthReadinessCheck[] = [];
    const reasonCodes: string[] = [];
    let clientRegistryId: string | null = null;
    let interventionCode: string | null = options?.interventionCode ?? null;
    let needsPreauth: boolean | null = options?.needsPreauth ?? null;
    let consentReadiness: DhaConsentReadiness = 'NOT_REQUIRED';

    // 1. HMS Patient Exists
    const patient = await this.patientRepository.getById(patientId);
    if (!patient) {
      reasonCodes.push('PATIENT_NOT_FOUND');
      checks.push({
        code: 'PATIENT_NOT_FOUND',
        name: 'HMS Patient Record',
        passed: false,
        message: 'Patient record not found in HMS',
      });
    } else {
      checks.push({
        code: 'PATIENT_EXISTS',
        name: 'HMS Patient Record',
        passed: true,
        message: 'Patient record exists',
      });
    }

    // 2. DHA Client Registry ID Mapping
    if (patient) {
      const identifiers = await this.patientRepository.getIdentifiers(patientId);
      const dhaMapping = (identifiers ?? []).find(
        (id) =>
          id.issuing_authority?.trim().toUpperCase() === 'DHA' &&
          id.identifier_type?.trim().toUpperCase() === 'CLIENT_REGISTRY_ID' &&
          id.status === 'ACTIVE',
      );
      if (dhaMapping && dhaMapping.value?.trim()) {
        clientRegistryId = dhaMapping.value.trim();
        checks.push({
          code: 'DHA_PATIENT_MAPPING',
          name: 'DHA Client Registry Mapping',
          passed: true,
          message: 'Active DHA Client Registry ID is mapped',
        });
      } else {
        reasonCodes.push('DHA_PATIENT_MAPPING_REQUIRED');
        checks.push({
          code: 'DHA_PATIENT_MAPPING',
          name: 'DHA Client Registry Mapping',
          passed: false,
          message: 'Patient has not been verified against DHA Patient Registry',
        });
      }
    } else {
      reasonCodes.push('DHA_PATIENT_MAPPING_REQUIRED');
      checks.push({
        code: 'DHA_PATIENT_MAPPING',
        name: 'DHA Client Registry Mapping',
        passed: false,
        message: 'Patient has not been verified against DHA Patient Registry',
      });
    }

    // 3. Insurance Member and Policy Local Validity
    const member = await this.authorizationRepository.member(memberId);
    if (!member) {
      reasonCodes.push('MEMBER_NOT_VALID');
      checks.push({
        code: 'MEMBER_VALIDITY',
        name: 'Insurance Member Validity',
        passed: false,
        message: 'Insurance member not found',
      });
    } else {
      const coverage = await this.insuranceService.checkCoverage({
        memberId,
        asOfDate: requestedDate,
      });
      if (!coverage.valid) {
        if (coverage.reasonCode?.includes('POLICY')) {
          reasonCodes.push('POLICY_NOT_VALID');
          checks.push({
            code: 'POLICY_VALIDITY',
            name: 'Insurance Policy Validity',
            passed: false,
            message: coverage.message,
          });
        } else {
          reasonCodes.push('MEMBER_NOT_VALID');
          checks.push({
            code: 'MEMBER_VALIDITY',
            name: 'Insurance Member Validity',
            passed: false,
            message: coverage.message,
          });
        }
      } else {
        checks.push({
          code: 'MEMBER_AND_POLICY_VALIDITY',
          name: 'Insurance Member & Policy Validity',
          passed: true,
          message: 'Insurance member and policy are valid locally',
        });
      }
    }

    // 4. Usable Eligibility Verification
    const verification =
      (await this.insuranceRepository.findRecentEligibilityVerification(memberId, requestedDate, 1440)) ??
      (await EligibilityVerificationModel.findOne({
        memberId: new Types.ObjectId(memberId),
      })
        .sort({ createdAt: -1 })
        .lean());

    if (!verification) {
      reasonCodes.push('DHA_ELIGIBILITY_REQUIRED');
      checks.push({
        code: 'DHA_ELIGIBILITY',
        name: 'Eligibility Verification',
        passed: false,
        message: 'No eligibility verification record found for member',
      });
    } else if (verification.status !== 'ELIGIBLE') {
      reasonCodes.push('DHA_ELIGIBILITY_NOT_CONFIRMED');
      checks.push({
        code: 'DHA_ELIGIBILITY',
        name: 'Eligibility Verification',
        passed: false,
        message: `Eligibility verification status is ${verification.status}`,
      });
    } else {
      checks.push({
        code: 'DHA_ELIGIBILITY',
        name: 'Eligibility Verification',
        passed: true,
        message: 'Confirmed active eligibility verification exists',
      });
    }

    // 5. Encounter and Patient Relationship
    if (encounterId) {
      const encounter = await this.integrationRepository.encounter(encounterId);
      if (!encounter) {
        reasonCodes.push('ENCOUNTER_NOT_FOUND');
        checks.push({
          code: 'ENCOUNTER_VALIDITY',
          name: 'Encounter Verification',
          passed: false,
          message: 'Referenced encounter was not found',
        });
      } else if (encounter.patientId.toString() !== patientId) {
        reasonCodes.push('ENCOUNTER_PATIENT_MISMATCH');
        checks.push({
          code: 'ENCOUNTER_VALIDITY',
          name: 'Encounter Verification',
          passed: false,
          message: 'Encounter patient does not match authorization patient',
        });
      } else {
        checks.push({
          code: 'ENCOUNTER_VALIDITY',
          name: 'Encounter Verification',
          passed: true,
          message: 'Encounter belongs to patient',
        });
      }
    }

    // 6. Service Linking & Intervention Code Resolution
    const firstLine = authorization.lines?.[0];
    if (!firstLine) {
      reasonCodes.push('SERVICE_NOT_LINKED');
      checks.push({
        code: 'SERVICE_LINK',
        name: 'Service Linking',
        passed: false,
        message: 'Authorization has no service lines',
      });
    } else {
      if (!interventionCode && firstLine.serviceId) {
        const mapping = await this.integrationRepository.mapping(
          firstLine.serviceId.toString(),
          requestedDate,
        );
        if (mapping?.interventionCode) {
          interventionCode = mapping.interventionCode;
        }
      }

      if (!interventionCode) {
        reasonCodes.push('SERVICE_NOT_LINKED');
        checks.push({
          code: 'SERVICE_LINK',
          name: 'Service Linking',
          passed: false,
          message: `Service ${firstLine.serviceCode} has no linked DHA intervention code`,
        });
      } else {
        checks.push({
          code: 'SERVICE_LINK',
          name: 'Service Linking',
          passed: true,
          message: `Service linked to intervention code ${interventionCode}`,
        });
      }
    }

    // 7. Intervention Coverage & Preauthorization Requirement
    if (options?.needsPreauth !== undefined) {
      needsPreauth = options.needsPreauth;
      checks.push({
        code: 'INTERVENTION_COVERAGE',
        name: 'DHA Intervention Coverage',
        passed: true,
        message: `Intervention preauthorization requirement set (needsPreauth: ${needsPreauth})`,
      });
    } else if (options?.subBenefitCode && clientRegistryId && interventionCode) {
      try {
        const coverageResult = await this.interventionCoverageService.getInterventions(
          patientId,
          options.subBenefitCode,
          { correlationId: options?.correlationId },
        );
        const matched = coverageResult.interventions.find(
          (it) => it.interventionCode === interventionCode,
        );
        if (!matched) {
          reasonCodes.push('INTERVENTION_NOT_FOUND');
          checks.push({
            code: 'INTERVENTION_COVERAGE',
            name: 'DHA Intervention Coverage',
            passed: false,
            message: `Intervention ${interventionCode} not found under sub-benefit ${options.subBenefitCode}`,
          });
        } else {
          needsPreauth = matched.needsPreauth;
          checks.push({
            code: 'INTERVENTION_COVERAGE',
            name: 'DHA Intervention Coverage',
            passed: true,
            message: `Intervention found in DHA coverage (needsPreauth: ${needsPreauth})`,
          });
        }
      } catch {
        reasonCodes.push('INTERVENTION_NOT_FOUND');
        checks.push({
          code: 'INTERVENTION_COVERAGE',
          name: 'DHA Intervention Coverage',
          passed: false,
          message: 'Unable to retrieve DHA intervention coverage',
        });
      }
    } else {
      reasonCodes.push('INTERVENTION_NOT_FOUND');
      checks.push({
        code: 'INTERVENTION_COVERAGE',
        name: 'DHA Intervention Coverage',
        passed: false,
        message: 'Intervention coverage is not retrieved or configured',
      });
    }

    if (needsPreauth === false) {
      reasonCodes.push('PREAUTH_NOT_REQUIRED');
      consentReadiness = 'NOT_REQUIRED';
      checks.push({
        code: 'PREAUTH_REQUIREMENT',
        name: 'Preauthorization Requirement',
        passed: false,
        message: 'Intervention does not require preauthorization',
      });
    } else if (needsPreauth === true) {
      checks.push({
        code: 'PREAUTH_REQUIREMENT',
        name: 'Preauthorization Requirement',
        passed: true,
        message: 'Intervention requires preauthorization',
      });
    }

    // 8. Facility Identifier Readiness
    const branchRecord = await this.integrationRepository.branchRecord(branchId);
    const configuredSystem =
      process.env.DHA_FACILITY_IDENTIFIER_SYSTEM ||
      process.env.SHA_FACILITY_IDENTIFIER_SYSTEM ||
      'DHA';
    const facilityReadiness = evaluateFacilityIdentifierReadiness(
      branchRecord?.identifiers as unknown as BranchIdentifierLike[],
      configuredSystem,
    );
    if (!facilityReadiness.identifierAvailable) {
      reasonCodes.push('FACILITY_IDENTIFIER_REQUIRED');
      checks.push({
        code: 'FACILITY_IDENTIFIER',
        name: 'Facility External Identifier',
        passed: false,
        message: 'Branch has no active DHA/SHA facility identifier',
      });
    } else {
      checks.push({
        code: 'FACILITY_IDENTIFIER',
        name: 'Facility External Identifier',
        passed: true,
        message: 'Branch facility identifier is available',
      });
    }

    // 9. DHA Preauthorization Submission Contract & Consent Contract Readiness
    if (needsPreauth === true) {
      if (options?.contractConfirmed) {
        consentReadiness = 'READY';
        checks.push({
          code: 'DHA_PREAUTH_CONTRACT',
          name: 'DHA Preauthorization Submission Contract',
          passed: true,
          message: 'DHA preauthorization contract confirmed',
        });
        checks.push({
          code: 'DHA_CONSENT_CONTRACT',
          name: 'DHA Consent Contract',
          passed: true,
          message: 'DHA consent workflow ready',
        });
      } else {
        consentReadiness = 'CONTRACT_UNCONFIRMED';
        reasonCodes.push('DHA_PREAUTH_CONTRACT_UNCONFIRMED');
        reasonCodes.push('DHA_CONSENT_CONTRACT_UNCONFIRMED');
        checks.push({
          code: 'DHA_PREAUTH_CONTRACT',
          name: 'DHA Preauthorization Submission Contract',
          passed: false,
          message: 'DHA preauthorization submission endpoint and contract are unconfirmed',
        });
        checks.push({
          code: 'DHA_CONSENT_CONTRACT',
          name: 'DHA Consent Contract',
          passed: false,
          message: 'DHA consent execution contract is unconfirmed',
        });
      }
    }

    // Overall readiness calculation: all checks must pass and no failure reason codes
    const ready = reasonCodes.length === 0 && checks.every((c) => c.passed);

    // Safe audit logging (No secrets, tokens, OTPs, or raw clinical payloads)
    await AuditLogModel.create({
      actorUserId: options?.actorUserId || undefined,
      eventType: 'insurance.dha.preauthorization_readiness_evaluated',
      metadataJson: {
        authorizationId,
        patientId,
        operation: 'EVALUATE_PREAUTH_READINESS',
        ready,
        reasonCodes,
        correlationId: options?.correlationId,
      },
    });

    return {
      ready,
      authorizationId,
      patientId,
      clientRegistryId,
      interventionCode,
      needsPreauth,
      consentReadiness,
      checks,
      reasonCodes,
    };
  }
}
