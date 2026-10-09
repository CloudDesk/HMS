import { AppError } from '../../../shared/errors/app-error.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { PatientRepository } from '../../patients/patient.repository.js';
import { DhaHttpClient } from './dha-http.client.js';
import type { DhaRequestOptions } from './dha.types.js';

export type DhaTariffInfo = {
  amount?: number | null;
  currency?: string | null;
  effectiveDate?: string | null;
};

export type DhaInterventionItem = {
  interventionCode: string;
  name?: string | null;
  paymentMechanism?: string | null;
  needsPreauth: boolean;
  tariff?: DhaTariffInfo | null;
};

export type DhaInterventionCoverageResult = {
  patientId: string;
  externalSystem: 'DHA';
  clientRegistryId: string;
  subBenefitCode: string;
  total: number;
  interventions: DhaInterventionItem[];
};

export class DhaInterventionCoverageService {
  constructor(
    private readonly dhaClient: DhaHttpClient = new DhaHttpClient(),
    private readonly patientRepository: PatientRepository = new PatientRepository(),
  ) {}

  /**
   * Retrieves intervention-level coverage information for a patient and sub-benefit
   * from the DHA HIE endpoint (GET /patients/benefits/interventions).
   * Validates that the patient exists and has an active DHA Client Registry mapping before calling upstream.
   */
  async getInterventions(
    patientId: string,
    subBenefitCode: string,
    options?: DhaRequestOptions & { actorUserId?: string },
  ): Promise<DhaInterventionCoverageResult> {
    const isPatientOid = /^[a-f\d]{24}$/i.test(patientId);
    if (!isPatientOid) {
      throw new AppError('Invalid patient id format', 400, 'VALIDATION_ERROR');
    }

    if (!subBenefitCode || !subBenefitCode.trim()) {
      throw new AppError('subBenefitCode is required', 400, 'VALIDATION_ERROR');
    }
    const trimmedSubBenefitCode = subBenefitCode.trim();

    // 1. Confirm HMS patient exists
    const patient = await this.patientRepository.getById(patientId);
    if (!patient) {
      throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
    }

    // 2. Resolve patient's active DHA Client Registry ID
    const identifiers = await this.patientRepository.getIdentifiers(patientId);
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

    const clientRegistryId = dhaMapping.value.trim();

    // 3. Call GET /patients/benefits/interventions?patient_id=<DHA Client Registry ID>&sub_benefit_code=<subBenefitCode>
    const query = new URLSearchParams({
      patient_id: clientRegistryId,
      sub_benefit_code: trimmedSubBenefitCode,
    });
    const path = `patients/benefits/interventions?${query.toString()}`;

    const response = await this.dhaClient.get<unknown>(path, options);

    // 4. Safely normalize response without inventing unconfirmed fields
    const raw = response.data;
    let items: unknown[] = [];
    if (Array.isArray(raw)) {
      items = raw;
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.interventions)) {
        items = obj.interventions;
      } else if (Array.isArray(obj.data)) {
        items = obj.data;
      } else if (Array.isArray(obj.items)) {
        items = obj.items;
      }
    }

    const interventions: DhaInterventionItem[] = items
      .filter((it): it is Record<string, unknown> => typeof it === 'object' && it !== null)
      .map((it) => {
        const interventionCode = String(
          it.intervention_code || it.code || it.id || '',
        ).trim();

        const name =
          typeof it.name === 'string'
            ? it.name.trim()
            : typeof it.title === 'string'
              ? it.title.trim()
              : typeof it.description === 'string'
                ? it.description.trim()
                : typeof it.intervention_name === 'string'
                  ? it.intervention_name.trim()
                  : null;

        const paymentMechanism =
          typeof it.payment_mechanism === 'string'
            ? it.payment_mechanism.trim()
            : typeof it.paymentMechanism === 'string'
              ? it.paymentMechanism.trim()
              : typeof it.mechanism === 'string'
                ? it.mechanism.trim()
                : null;

        const needsPreauth = Boolean(
          it.needs_preauth ?? it.needsPreauth ?? it.requires_preauth ?? false,
        );

        let tariff: DhaTariffInfo | null = null;
        if (it.tariff && typeof it.tariff === 'object') {
          const t = it.tariff as Record<string, unknown>;
          tariff = {
            amount:
              typeof t.amount === 'number'
                ? t.amount
                : typeof t.amount === 'string' && !isNaN(Number(t.amount))
                  ? Number(t.amount)
                  : null,
            currency: typeof t.currency === 'string' ? t.currency.trim() : null,
            effectiveDate:
              typeof t.effective_date === 'string'
                ? t.effective_date.trim()
                : typeof t.effectiveDate === 'string'
                  ? t.effectiveDate.trim()
                  : null,
          };
        } else if (typeof it.tariff === 'number') {
          tariff = {
            amount: it.tariff,
            currency: null,
            effectiveDate: null,
          };
        }

        return {
          interventionCode,
          name,
          paymentMechanism,
          needsPreauth,
          tariff,
        };
      });

    // 5. Safe audit logging
    await AuditLogModel.create({
      actorUserId: options?.actorUserId || undefined,
      eventType: 'patient.dha.interventions_queried',
      metadataJson: {
        patientId,
        externalSystem: 'DHA',
        correlationId: options?.correlationId,
        subBenefitCode: trimmedSubBenefitCode,
        totalCount: interventions.length,
      },
    });

    return {
      patientId,
      externalSystem: 'DHA',
      clientRegistryId,
      subBenefitCode: trimmedSubBenefitCode,
      total: interventions.length,
      interventions,
    };
  }
}
