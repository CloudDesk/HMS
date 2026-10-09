import { AppError } from '../../../shared/errors/app-error.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { PatientRepository } from '../../patients/patient.repository.js';
import { DhaHttpClient } from './dha-http.client.js';
import type { DhaRequestOptions } from './dha.types.js';

export type DhaSubBenefitItem = {
  id: string;
  code: string;
  name: string;
  category?: string | null;
  status?: string | null;
};

export type DhaSubBenefitsResult = {
  patientId: string;
  externalSystem: 'DHA';
  clientRegistryId: string;
  total: number;
  subBenefits: DhaSubBenefitItem[];
};

export class DhaSubBenefitsService {
  constructor(
    private readonly dhaClient: DhaHttpClient = new DhaHttpClient(),
    private readonly patientRepository: PatientRepository = new PatientRepository(),
  ) {}

  /**
   * Retrieves sub-benefits for an HMS patient from the DHA HIE endpoint (GET /patients/sub-benefits).
   * Validates that the patient exists and has an active DHA Client Registry mapping before calling upstream.
   */
  async getSubBenefits(
    patientId: string,
    options?: DhaRequestOptions & { actorUserId?: string },
  ): Promise<DhaSubBenefitsResult> {
    const isPatientOid = /^[a-f\d]{24}$/i.test(patientId);
    if (!isPatientOid) {
      throw new AppError('Invalid patient id format', 400, 'VALIDATION_ERROR');
    }

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

    // 3. Call GET /patients/sub-benefits?patient_id=<DHA Client Registry ID>
    const query = new URLSearchParams({
      patient_id: clientRegistryId,
    });
    const path = `patients/sub-benefits?${query.toString()}`;

    const response = await this.dhaClient.get<unknown>(path, options);

    // 4. Safely normalize response without inventing unconfirmed fields
    const raw = response.data;
    let items: unknown[] = [];
    if (Array.isArray(raw)) {
      items = raw;
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.sub_benefits)) {
        items = obj.sub_benefits;
      } else if (Array.isArray(obj.subBenefits)) {
        items = obj.subBenefits;
      } else if (Array.isArray(obj.data)) {
        items = obj.data;
      } else if (Array.isArray(obj.items)) {
        items = obj.items;
      }
    }

    const subBenefits: DhaSubBenefitItem[] = items
      .filter((it): it is Record<string, unknown> => typeof it === 'object' && it !== null)
      .map((it) => {
        const id = String(it.id || it.sub_benefit_id || it.code || '').trim();
        const code = String(it.code || it.sub_benefit_code || it.id || '').trim();
        const name = String(it.name || it.title || it.sub_benefit_name || id || '').trim();
        const category =
          typeof it.category === 'string'
            ? it.category.trim()
            : typeof it.package_name === 'string'
              ? it.package_name.trim()
              : typeof it.benefit_package === 'string'
                ? it.benefit_package.trim()
                : null;
        const status = typeof it.status === 'string' ? it.status.trim() : null;

        return { id, code, name, category, status };
      });

    // 5. Safe audit logging
    await AuditLogModel.create({
      actorUserId: options?.actorUserId || undefined,
      eventType: 'patient.dha.sub_benefits_queried',
      metadataJson: {
        patientId,
        externalSystem: 'DHA',
        correlationId: options?.correlationId,
        totalCount: subBenefits.length,
      },
    });

    return {
      patientId,
      externalSystem: 'DHA',
      clientRegistryId,
      total: subBenefits.length,
      subBenefits,
    };
  }
}
