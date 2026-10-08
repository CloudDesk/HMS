import { AppError } from '../../shared/errors/app-error.js';
import type { InsuranceIntegrationRepository } from './insurance-integration.repository.js';
import type { InsuranceAuthorizationRepository } from './insurance-authorization.repository.js';
import type { InsuranceService } from './insurance.service.js';
import { shaMappingSchema, type ShaMappingInput } from './insurance-integration.schemas.js';
import type { RequestMetadata } from './insurance.types.js';
import { evaluatePatientIdentifierReadiness } from '../patients/patient-identifier.utils.js';


export class InsuranceIntegrationService {
  constructor(private readonly repository: InsuranceIntegrationRepository, private readonly access: InsuranceAuthorizationRepository, private readonly insurance: InsuranceService) {}
  private async resolve(id: string, type: string, actor: string) {
    if (type !== 'OPD') throw new AppError('Only OPD encounter integration is supported in Phase 6', 422, 'UNSUPPORTED_ENCOUNTER_TYPE');
    const encounter = await this.repository.encounter(id);
    if (!encounter) throw new AppError('Encounter not found', 404, 'ENCOUNTER_NOT_FOUND');
    if (!await this.access.hasBranchAccess(actor, encounter.branchId.toString())) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    if (!await this.repository.patient(encounter.patientId.toString())) throw new AppError('Encounter patient not found', 409, 'ENCOUNTER_PATIENT_INVALID');
    return encounter;
  }
  async context(id: string, type: string, actor: string) {
    const encounter = await this.resolve(id, type, actor);
    const patientId = encounter.patientId.toString();
    const branchId = encounter.branchId.toString();
    const date = encounter.visitDate.toISOString().slice(0, 10);
    const refs = await this.repository.references(id, patientId, branchId);
    if (refs.invoices.length > 100 || refs.items.length > 1000 || refs.orders.length > 100) throw new AppError('Encounter context exceeds supported size', 422, 'ENCOUNTER_CONTEXT_TOO_LARGE');
    const ids = [...new Set([...refs.items.map(row => row.serviceId.toString()), ...refs.orders.flatMap(row => row.items.map(item => item.serviceId.toString()))])];
    const [services, members, patientRecord] = await Promise.all([
      this.repository.services(ids),
      this.repository.members(patientId, date),
      this.repository.patientRecord(patientId),
    ]);
    const patientIdentifierReadiness = evaluatePatientIdentifierReadiness(patientRecord?.identifiers);
    const structuredDiagnoses = refs.consultation?.diagnoses ?? [];
    const icd11Diagnoses = structuredDiagnoses.filter(d => {
      const sys = (d.codingSystem ?? '').toUpperCase().trim();
      return sys === 'ICD-11' || sys === 'ICD11' || sys.includes('ICD/RELEASE/11') || sys.includes('ICD-11');
    });
    const hasIcd11 = icd11Diagnoses.length > 0;
    return {
      encounterId: id, encounterType: 'OPD', patientId, branchId, encounterDate: date,
      appointmentId: encounter.appointmentId?.toString() ?? null,
      doctorId: encounter.doctorId.toString(), departmentId: encounter.departmentId.toString(),
      services: services.map(row => ({ serviceId: row._id.toString(), serviceCode: row.code })),
      invoiceItems: refs.items.map(row => ({ invoiceId: row.invoiceId.toString(), invoiceItemId: row._id.toString(), serviceId: row.serviceId.toString() })),
      diagnosis: {
        consultationId: refs.consultation?._id.toString() ?? null,
        codingSystem: hasIcd11 ? (icd11Diagnoses[0]?.codingSystem ?? 'ICD-11') : (structuredDiagnoses.length > 0 ? structuredDiagnoses[0]?.codingSystem ?? null : null),
        codes: (hasIcd11 ? icd11Diagnoses : structuredDiagnoses).map(row => ({
          code: row.code,
          display: row.display,
          codingSystem: row.codingSystem,
          type: row.type,
        })),
        icd11Readiness: hasIcd11 ? ('AVAILABLE' as const) : ('NOT_AVAILABLE' as const),
        requiredForFutureClaims: true,
      },
      patientIdentifierReadiness,
      insurance: { memberId: members.length === 1 ? members[0]?._id.toString() : null, selectionRequired: members.length > 1, coverageVerified: false },
    };
  }

  async coverage(id: string, type: string, serviceId: string, input: { memberId?: string; quantity: number }, actor: string, metadata: RequestMetadata) {
    const context = await this.context(id, type, actor);
    if (!context.services.some(row => row.serviceId === serviceId)) throw new AppError('Service does not belong to encounter', 409, 'SERVICE_NOT_IN_ENCOUNTER');
    if (!await this.repository.service(serviceId)) throw new AppError('Service is inactive or unavailable', 409, 'SERVICE_UNAVAILABLE');
    const members = await this.repository.members(context.patientId, context.encounterDate, input.memberId);
    if (members.length !== 1) throw new AppError('Select one applicable patient insurance membership', 409, 'MEMBER_CONTEXT_REQUIRED');
    const member = members[0];
    if (!member) throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    const policy = await this.repository.policy(member.policyId.toString());
    if (!policy) throw new AppError('Policy not found', 409, 'POLICY_NOT_FOUND');
    const benefit = await this.insurance.verifyBenefit({ memberId: member._id.toString(), serviceId, requestedDate: context.encounterDate, quantity: input.quantity }, actor, metadata);
    const authorization = benefit.eligible && benefit.authorizationRequired ? await this.repository.authorization({
      encounterId: id, patientId: context.patientId, branchId: context.branchId, memberId: member._id.toString(),
      policyId: member.policyId.toString(), payerId: policy.payerId.toString(), schemeId: policy.schemeId?.toString() ?? null,
      serviceId, requestedDate: context.encounterDate, quantity: input.quantity,
    }) : null;
    const mapping = await this.repository.mapping(serviceId, context.encounterDate);
    return { ...benefit, encounterId: id, encounterType: 'OPD',
      authorization: authorization ? { authorizationId: authorization._id.toString(), status: authorization.status, externalReference: authorization.externalReference, validityBasis: 'LOCAL_STATUS_AND_ENCOUNTER_DATE', payerValidityConfirmed: false } : null,
      authorizationValidity: 'SHA_EXPIRY_CONTRACT_UNCONFIRMED',
      shaMapping: mapping ? { mappingId: mapping._id.toString(), interventionCode: mapping.interventionCode } : null,
      shaMappingReadiness: mapping ? 'CONFIGURED_NOT_SHA_VALIDATED' : 'MISSING',
    };
  }
  async createMapping(raw: ShaMappingInput, actor: string, metadata: RequestMetadata) {
    const input = shaMappingSchema.parse(raw);
    if (!await this.repository.service(input.serviceId)) throw new AppError('Active HMS service not found', 404, 'SERVICE_NOT_FOUND');
    try { return await this.repository.createMapping(input, actor, metadata); }
    catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) throw new AppError('An active SHA mapping already exists for this service', 409, 'SHA_MAPPING_CONFLICT');
      throw error;
    }
  }
  listMappings(query: { serviceId?: string; limit: number; offset: number }) { return this.repository.listMappings(query.serviceId, query.limit, query.offset); }
  async deactivateMapping(id: string, version: number, reason: string, actor: string, metadata: RequestMetadata) {
    const record = await this.repository.deactivateMapping(id, version, reason, actor, metadata);
    if (!record) throw new AppError('Mapping unavailable or changed; refresh', 409, 'STALE_SHA_MAPPING');
    return record;
  }
}
