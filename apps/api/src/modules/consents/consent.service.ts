import { AppError } from '../../shared/errors/app-error.js';
import type { ConsentRepository } from './consent.repository.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { ConsentRequestMetadata, ConsentRequirementQuery, ConsentTemplateListQuery, SaveConsentTemplateDTO } from './consent.types.js';

export class ConsentService {
  constructor(private readonly repository: ConsentRepository, private readonly patients: PatientRepository) {}

  private async authorize(actor: string, branchId: string) {
    if (!await this.repository.hasBranchAccess(actor, branchId)) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
  }

  async list(query: ConsentTemplateListQuery, actor: string) {
    await this.authorize(actor, query.branch_id);
    return this.repository.list(query);
  }

  async get(id: string, branchId: string, actor: string) {
    await this.authorize(actor, branchId);
    const template = await this.repository.get(id, branchId);
    if (!template || template.status !== 'ACTIVE') throw new AppError('Active consent template not found', 404, 'CONSENT_TEMPLATE_NOT_FOUND');
    return template;
  }

  async requirements(query: ConsentRequirementQuery, actor: string) {
    await this.authorize(actor, query.branch_id);
    await this.patients.getById(query.patient_id, [query.branch_id]).then((patient) => {
      if (!patient) throw new AppError('Patient not found in selected branch', 404, 'PATIENT_NOT_FOUND');
    });
    const templates = await this.repository.list({ branch_id: query.branch_id, context_type: query.context_type, status: 'ACTIVE' });
    const statuses = await this.patients.consentStatuses(query.patient_id, templates.map((item) => item.id), query.context_type, query.context_id);
    return templates.map((template) => ({ ...template,
      consent_status: statuses.get(template.id) ?? (template.mandatory ? 'PENDING' as const : 'NOT_REQUIRED' as const),
      satisfied: !template.mandatory || statuses.get(template.id) === 'VERIFIED' }));
  }

  async assertMandatoryConsent(query: ConsentRequirementQuery, actor: string) {
    const requirements = await this.requirements(query, actor);
    const missing = requirements.filter((item) => item.mandatory && !item.satisfied);
    if (missing.length) throw new AppError('Mandatory verified consent is required before confirmation', 409, 'MANDATORY_CONSENT_REQUIRED', { templates: missing.map((item) => item.id) });
    return requirements;
  }

  async create(data: SaveConsentTemplateDTO, actor: string, metadata: ConsentRequestMetadata) {
    await this.authorize(actor, data.branch_id);
    try {
      const template = await this.repository.create(data, actor);
      await this.repository.audit('consent.template.created', actor, metadata, { templateId: template.id, branchId: data.branch_id, version: template.version });
      return template;
    } catch (error) {
      if (this.repository.isDuplicate(error)) throw new AppError('Consent template code already exists in this branch and version', 409, 'DUPLICATE_CONSENT_TEMPLATE');
      throw error;
    }
  }

  async update(id: string, data: SaveConsentTemplateDTO, actor: string, metadata: ConsentRequestMetadata) {
    await this.authorize(actor, data.branch_id);
    const existing = await this.repository.get(id, data.branch_id);
    if (!existing) throw new AppError('Consent template not found', 404, 'CONSENT_TEMPLATE_NOT_FOUND');
    if (existing.code !== data.code.trim().toUpperCase()) throw new AppError('Consent template code cannot be changed', 400, 'CONSENT_TEMPLATE_CODE_IMMUTABLE');
    const template = await this.repository.update(id, data, actor);
    if (!template) throw new AppError('Consent template not found', 404, 'CONSENT_TEMPLATE_NOT_FOUND');
    await this.repository.audit('consent.template.updated', actor, metadata, { templateId: id, branchId: data.branch_id, version: template.version, status: template.status });
    return template;
  }
}
