import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import {
  evaluatePatientIdentifierReadiness,
  resolveActiveShaPatientIdentifier,
} from '../../patients/patient-identifier.utils.js';
import { PatientRepository } from '../../patients/patient.repository.js';
import type { DhaPatientVerificationResult } from '../../patients/patient.types.js';
import { DhaHttpClient } from './dha-http.client.js';
import { DhaError } from './dha.errors.js';
import type { DhaRequestOptions } from './dha.types.js';

export type DhaPatientSearchParams = {
  identification_number: string;
  identification_type: string;
};

export type DhaPatientSearchResult = {
  matched: boolean;
  clientRegistryId: string | null;
  status?: string | null;
};

export class DhaPatientRegistryService {
  constructor(
    private readonly dhaClient: DhaHttpClient = new DhaHttpClient(),
    private readonly patientRepository: PatientRepository = new PatientRepository(),
  ) {}

  /**
   * Performs an outbound query to the DHA Client Registry API using identification_number and identification_type.
   * Deterministically handles 404 (patient not found) without throwing a system error.
   */
  async searchPatient(
    params: DhaPatientSearchParams,
    options?: DhaRequestOptions,
  ): Promise<DhaPatientSearchResult> {
    const idNumber = params.identification_number?.trim();
    const idType = params.identification_type?.trim();

    if (!idNumber || !idType) {
      throw new AppError(
        'identification_number and identification_type are required for DHA lookup',
        400,
        'VALIDATION_ERROR',
      );
    }

    const query = new URLSearchParams({
      identification_number: idNumber,
      identification_type: idType,
    });

    const path = `patients?${query.toString()}`;

    try {
      const response = await this.dhaClient.get<unknown>(path, options);

      const raw = response.data;
      let record: Record<string, unknown> | null = null;

      if (Array.isArray(raw)) {
        record = (raw[0] as Record<string, unknown>) ?? null;
      } else if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.data)) {
          record = (obj.data[0] as Record<string, unknown>) ?? null;
        } else if (obj.data && typeof obj.data === 'object') {
          record = obj.data as Record<string, unknown>;
        } else {
          record = obj;
        }
      }

      if (!record) {
        return { matched: false, clientRegistryId: null };
      }

      const clientRegistryId =
        typeof record.client_registry_id === 'string' && record.client_registry_id.trim()
          ? record.client_registry_id.trim()
          : typeof record.id === 'string' && record.id.trim()
            ? record.id.trim()
            : typeof record.clientRegistryId === 'string' && record.clientRegistryId.trim()
              ? record.clientRegistryId.trim()
              : null;

      if (!clientRegistryId) {
        return { matched: false, clientRegistryId: null };
      }

      return {
        matched: true,
        clientRegistryId,
        status: typeof record.status === 'string' ? record.status : undefined,
      };
    } catch (error) {
      if (error instanceof DhaError && error.statusCode === 404) {
        return { matched: false, clientRegistryId: null };
      }
      throw error;
    }
  }

  /**
   * Verifies an HMS patient against the DHA Patient Registry.
   * - Loads patient and validates configured SHA/DHA identifier.
   * - Resolves client registry ID via DhaHttpClient.
   * - Saves minimal external identifier mapping idempotently with conflict detection.
   * - Returns safe readiness/mapping status without leaking raw credentials or identifiers.
   */
  async verifyPatient(
    patientId: string,
    actorUserId: string,
    branchIds?: string[],
  ): Promise<DhaPatientVerificationResult> {
    const isPatientOid = /^[a-f\d]{24}$/i.test(patientId);
    if (!isPatientOid) {
      throw new AppError('Invalid patient id', 400, 'VALIDATION_ERROR');
    }

    const patient = await this.patientRepository.getById(patientId, branchIds);
    if (!patient) {
      throw new AppError('Patient not found', 404, 'NOT_FOUND');
    }

    const identifiers = await this.patientRepository.getIdentifiers(patientId);
    const readiness = evaluatePatientIdentifierReadiness(identifiers);

    if (!readiness.identifierAvailable) {
      throw new AppError(
        'Patient does not have an active national/SHA identifier configured',
        400,
        'PATIENT_IDENTIFIER_NOT_AVAILABLE',
      );
    }

    const activeIdentifier = resolveActiveShaPatientIdentifier(identifiers);
    if (!activeIdentifier || !activeIdentifier.value?.trim()) {
      throw new AppError(
        'Patient does not have an active national/SHA identifier configured',
        400,
        'PATIENT_IDENTIFIER_NOT_AVAILABLE',
      );
    }

    const searchResult = await this.searchPatient({
      identification_number: activeIdentifier.value.trim(),
      identification_type: activeIdentifier.identifierType.trim(),
    });

    if (!searchResult.matched || !searchResult.clientRegistryId) {
      return {
        matched: false,
        externalSystem: 'DHA',
        externalIdentifierType: 'CLIENT_REGISTRY_ID',
        mappingAvailable: false,
        message: 'Patient not found in DHA registry',
      };
    }

    // Check existing DHA mappings for this patient
    const existingDhaMapping = identifiers.find(
      (id) =>
        id.issuing_authority.trim().toUpperCase() === 'DHA' &&
        id.identifier_type.trim().toUpperCase() === 'CLIENT_REGISTRY_ID',
    );

    if (existingDhaMapping) {
      if (existingDhaMapping.value === searchResult.clientRegistryId) {
        // Idempotent reuse: mapping already exists and matches exactly
        await AuditLogModel.create({
          actorUserId: actorUserId || undefined,
          eventType: 'patient.dha.verified',
          metadataJson: {
            patientId,
            externalSystem: 'DHA',
            externalIdentifierType: 'CLIENT_REGISTRY_ID',
            matched: true,
            reused: true,
          },
        });

        return {
          matched: true,
          externalSystem: 'DHA',
          externalIdentifierType: 'CLIENT_REGISTRY_ID',
          mappingAvailable: true,
          reused: true,
        };
      }

      // Conflict: DHA returned a different client ID than what is already registered
      throw new AppError(
        'DHA returned a conflicting client registry identifier for this patient',
        409,
        'DHA_IDENTIFIER_CONFLICT',
      );
    }

    // Persist new DHA mapping
    const envSource = (env.app.environment || 'dev').toUpperCase();
    await this.patientRepository.addIdentifier(
      patientId,
      {
        identifier_type: 'CLIENT_REGISTRY_ID',
        issuing_authority: 'DHA',
        value: searchResult.clientRegistryId,
        status: 'ACTIVE',
        source_environment: envSource,
        verified_at: new Date(),
        verified_by: actorUserId,
      },
      actorUserId,
    );

    // Audit log - strictly avoid storing raw identifiers or credentials
    await AuditLogModel.create({
      actorUserId: actorUserId || undefined,
      eventType: 'patient.dha.verified',
      metadataJson: {
        patientId,
        externalSystem: 'DHA',
        externalIdentifierType: 'CLIENT_REGISTRY_ID',
        matched: true,
        reused: false,
      },
    });

    return {
      matched: true,
      externalSystem: 'DHA',
      externalIdentifierType: 'CLIENT_REGISTRY_ID',
      mappingAvailable: true,
      reused: false,
    };
  }
}
