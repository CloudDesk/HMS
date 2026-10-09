import { AppError } from '../../../shared/errors/app-error.js';
import {
  evaluatePatientIdentifierReadiness,
  resolveActiveShaPatientIdentifier,
} from '../../patients/patient-identifier.utils.js';
import { PatientRepository } from '../../patients/patient.repository.js';
import { sanitizeDetails } from '../sha-eligibility.adapter.js';
import { DhaHttpClient } from './dha-http.client.js';
import { DhaError } from './dha.errors.js';
import type { DhaRequestOptions } from './dha.types.js';

export type DhaEligibilityResult = {
  status: 'ELIGIBLE' | 'INELIGIBLE' | 'PENDING' | 'FAILED';
  externalReferenceId: string | null;
  reasonCode: string;
  message: string;
  details?: Record<string, unknown>;
};

export type DhaEligibilityCheckParams = {
  patientId: string;
  clientRegistryId?: string;
  identificationNumber?: string;
  identificationType?: string;
  policyNumber?: string;
  schemeCode?: string;
  correlationId?: string;
};

export class DhaEligibilityService {
  constructor(
    private readonly dhaClient: DhaHttpClient = new DhaHttpClient(),
    private readonly patientRepository: PatientRepository = new PatientRepository(),
  ) {}

  /**
   * Evaluates patient eligibility against the DHA Eligibility API (GET /patients/eligibility).
   * Validates HMS patient existence, configured SHA/DHA identifier, and DHA Client Registry mapping before making any outbound call.
   */
  async checkEligibility(
    params: DhaEligibilityCheckParams,
    options?: DhaRequestOptions,
  ): Promise<DhaEligibilityResult> {
    const isPatientOid = /^[a-f\d]{24}$/i.test(params.patientId);
    if (!isPatientOid) {
      throw new AppError('Invalid patient id format', 400, 'VALIDATION_ERROR');
    }

    // 1. Confirm HMS patient exists
    const patient = await this.patientRepository.getById(params.patientId);
    if (!patient) {
      throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
    }

    // 2. Validate active configured SHA/DHA identifier
    const identifiers = await this.patientRepository.getIdentifiers(params.patientId);
    const readiness = evaluatePatientIdentifierReadiness(identifiers);
    if (!readiness.identifierAvailable) {
      throw new AppError(
        'Patient does not have an active national/SHA identifier configured',
        400,
        'PATIENT_IDENTIFIER_NOT_AVAILABLE',
      );
    }

    const activeShaId = resolveActiveShaPatientIdentifier(identifiers);
    if (!activeShaId || !activeShaId.value?.trim()) {
      throw new AppError(
        'Patient does not have an active national/SHA identifier configured',
        400,
        'PATIENT_IDENTIFIER_NOT_AVAILABLE',
      );
    }

    // 3. Validate DHA Client Registry mapping exists from Prerequisite 5
    const dhaMapping = (identifiers ?? []).find(
      (id) =>
        id.issuing_authority?.trim().toUpperCase() === 'DHA' &&
        id.identifier_type?.trim().toUpperCase() === 'CLIENT_REGISTRY_ID' &&
        id.status === 'ACTIVE',
    );

    if (!dhaMapping || !dhaMapping.value?.trim()) {
      throw new AppError(
        'Patient has not been verified against DHA Patient Registry',
        400,
        'DHA_PATIENT_MAPPING_REQUIRED',
      );
    }

    // 4. Construct outbound request
    const clientRegId = params.clientRegistryId || dhaMapping.value;
    const idNumber = params.identificationNumber || activeShaId.value;
    const idType = params.identificationType || activeShaId.identifierType;

    const query = new URLSearchParams({
      client_registry_id: clientRegId.trim(),
      identification_number: idNumber.trim(),
      identification_type: idType.trim(),
    });

    if (params.policyNumber?.trim()) {
      query.set('policy_number', params.policyNumber.trim());
    }
    if (params.schemeCode?.trim()) {
      query.set('scheme_code', params.schemeCode.trim());
    }

    const path = `patients/eligibility?${query.toString()}`;
    const correlationId = params.correlationId || options?.correlationId;

    try {
      const response = await this.dhaClient.get<Record<string, unknown>>(path, {
        ...options,
        correlationId,
      });

      const raw = response.data || {};
      const upstreamStatus = String(
        raw.status || raw.eligibility_status || raw.eligibilityStatus || '',
      )
        .toUpperCase()
        .trim();

      let status: 'ELIGIBLE' | 'INELIGIBLE' | 'PENDING' | 'FAILED' = 'FAILED';
      if (['ELIGIBLE', 'ACTIVE', 'VALID'].includes(upstreamStatus)) {
        status = 'ELIGIBLE';
      } else if (['INELIGIBLE', 'INACTIVE', 'EXPIRED', 'SUSPENDED'].includes(upstreamStatus)) {
        status = 'INELIGIBLE';
      } else if (['PENDING', 'PROCESSING'].includes(upstreamStatus)) {
        status = 'PENDING';
      } else {
        status = 'FAILED'; // NEVER convert unknown DHA response into ELIGIBLE
      }

      const externalReferenceId =
        typeof raw.external_reference_id === 'string' && raw.external_reference_id.trim()
          ? raw.external_reference_id.trim()
          : typeof raw.reference_id === 'string' && raw.reference_id.trim()
            ? raw.reference_id.trim()
            : typeof raw.id === 'string' && raw.id.trim()
              ? raw.id.trim()
              : typeof raw.sha_reference === 'string' && raw.sha_reference.trim()
                ? raw.sha_reference.trim()
                : null;

      const reasonCode =
        typeof raw.reason_code === 'string' && raw.reason_code.trim()
          ? raw.reason_code.trim()
          : status === 'ELIGIBLE'
            ? 'DHA_CONFIRMED_ELIGIBLE'
            : status === 'INELIGIBLE'
              ? 'DHA_CONFIRMED_INELIGIBLE'
              : status === 'PENDING'
                ? 'DHA_VERIFICATION_PENDING'
                : 'DHA_UNKNOWN_STATUS';

      const message =
        typeof raw.message === 'string' && raw.message.trim()
          ? raw.message.trim()
          : `DHA eligibility evaluated as ${status}`;

      return {
        status,
        externalReferenceId,
        reasonCode,
        message,
        details: sanitizeDetails(raw.details as Record<string, unknown>),
      };
    } catch (error) {
      if (error instanceof DhaError) {
        if (error.statusCode === 404) {
          return {
            status: 'INELIGIBLE',
            externalReferenceId: null,
            reasonCode: 'DHA_PATIENT_NOT_FOUND',
            message: 'Patient not found or not eligible in DHA registry',
          };
        }
        if (error.statusCode === 401 || error.code === 'DHA_AUTHENTICATION_FAILED') {
          return {
            status: 'FAILED',
            externalReferenceId: null,
            reasonCode: 'DHA_AUTHENTICATION_FAILED',
            message: error.message || 'DHA authentication failed',
          };
        }
        if (error.statusCode === 504 || error.code === 'DHA_REQUEST_TIMEOUT') {
          return {
            status: 'FAILED',
            externalReferenceId: null,
            reasonCode: 'DHA_TIMEOUT',
            message: 'DHA eligibility request timed out',
          };
        }
        return {
          status: 'FAILED',
          externalReferenceId: null,
          reasonCode: 'DHA_NETWORK_FAILURE',
          message: error.message || 'DHA request failed',
        };
      }

      const isAbort = error instanceof Error && error.name === 'AbortError';
      return {
        status: 'FAILED',
        externalReferenceId: null,
        reasonCode: isAbort ? 'DHA_TIMEOUT' : 'DHA_NETWORK_FAILURE',
        message: isAbort ? 'DHA eligibility request timed out' : 'DHA communication error',
      };
    }
  }
}
