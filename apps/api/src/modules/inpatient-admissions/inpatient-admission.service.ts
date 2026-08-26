import type { ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { AdmissionsConfigurationService } from '../admissions-configuration/admissions-configuration.service.js';
import type { BillingService } from '../billing/billing.service.js';
import type { EmergencyRepository } from '../emergency/emergency.repository.js';
import type { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import type { PatientService } from '../patients/patient.service.js';
import type { OpdClinicalOrderService } from '../opd/opd-clinical-order.service.js';
import type { ClinicalOrderType, SaveOpdClinicalOrderDTO } from '../opd/opd-clinical-order.types.js';
import type { OpdPrescriptionService } from '../opd/opd-prescription.service.js';
import type { SaveOpdPrescriptionDTO } from '../opd/opd-prescription.types.js';
import type { InpatientAdmissionRepository } from './inpatient-admission.repository.js';
import type { AdmissionRequestListQuery, AdmissionRequestMetadata, AdmissionPrerequisiteSnapshot, CancelAdmissionRequestDTO, ConfirmAdmissionRequestDTO, CreateAdmissionRequestDTO, CreateInpatientAdmissionDTO, InpatientAdmissionListQuery, ValidateAdmissionRequestDTO } from './inpatient-admission.types.js';

const rethrowDuplicate = (error: unknown): never => {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) throw new AppError('An active admission request or admission already exists for this patient or source', 409, 'ACTIVE_ADMISSION_CONFLICT');
  throw error;
};

import type { AdvancePaymentService } from '../advance-payment/advance-payment.service.js';
async function executeWithOptionalTransaction<T>(
  repository: InpatientAdmissionRepository,
  operation: (session: ClientSession) => Promise<T>,
): Promise<T> {
  let session: ClientSession | null = null;
  try {
    const activeSession = await repository.session();
    session = activeSession;
    let result: T | undefined;
    await activeSession.withTransaction(async () => {
      result = await operation(activeSession);
    });
    if (result === undefined) {
      throw new Error('Operation completed without a result');
    }
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      msg.includes('transaction') ||
      msg.includes('replica set') ||
      msg.includes('sharded cluster') ||
      msg.includes('standalone') ||
      msg.includes('active transaction number')
    ) {
      if (!session) {
        throw error;
      }
      return operation(session);
    }
    throw error;
  } finally {
    if (session) {
      await session.endSession().catch(() => {});
    }
  }
}

export class InpatientAdmissionService {
  constructor(private readonly repository: InpatientAdmissionRepository, private readonly beds: AdmissionsConfigurationService, private readonly patients: PatientService, private readonly billing: BillingService, private readonly opdVisits: OpdVisitRepository, private readonly emergencies: EmergencyRepository, private readonly advancePayment: AdvancePaymentService, private readonly prescriptions: OpdPrescriptionService, private readonly clinicalOrders: OpdClinicalOrderService) {}

  async list(query: InpatientAdmissionListQuery, actor: string) { await this.authorize(actor, query.branch_id); const scope = await this.repository.departmentScope(actor); return this.repository.list(query, scope); }
  async get(id: string, branchId: string, actor: string) { await this.authorize(actor, branchId); const item = await this.repository.getById(id, branchId); if (!item) throw new AppError('Inpatient admission not found', 404, 'ADMISSION_NOT_FOUND'); await this.authorizeDepartment(actor, item.department_id); return item; }

  async getRequestStatusCounts(actor: string, branchId: string) {
    await this.authorize(actor, branchId);
    const deptScope = await this.repository.departmentScope(actor);
    return this.repository.getRequestStatusCounts(branchId, deptScope);
  }

  async listRequests(query: AdmissionRequestListQuery, actor: string) { await this.authorize(actor, query.branch_id); const scope = await this.repository.departmentScope(actor); return this.repository.listRequests(query, scope); }
  async getRequest(id: string, branchId: string, actor: string) { await this.authorize(actor, branchId); const item = await this.repository.getRequest(id, branchId); if (!item) throw new AppError('Admission request not found', 404, 'ADMISSION_REQUEST_NOT_FOUND'); await this.authorizeDepartment(actor, item.department_id); return item; }

  async getPrescription(id: string, branchId: string, actor: string) {
    await this.requireActiveAdmission(id, branchId, actor);
    return this.prescriptions.getForContext({ source_type: 'INPATIENT_ADMISSION', source_id: id });
  }

  async submitPrescription(id: string, branchId: string, data: SaveOpdPrescriptionDTO, actor: string, metadata: AdmissionRequestMetadata) {
    await this.authorize(actor, branchId); const session = await this.repository.session();
    try { let result; await session.withTransaction(async () => {
      const admission = await this.repository.getRecord(id, branchId, session);
      if (!admission || admission.status !== 'ADMITTED') throw new AppError('Inpatient admission is not active', 409, 'INPATIENT_CONTEXT_NOT_ACTIVE');
      const context = { source_type: 'INPATIENT_ADMISSION' as const, source_id: id, encounter_id: admission.sourceId?.toString() ?? null, admission_id: id, procedure_id: null, patient_id: admission.patientId.toString(), patient_number: admission.patientNumber, patient_name: admission.patientName, doctor_id: admission.admittingDoctorId.toString(), doctor_name: admission.admittingDoctorName, branch_id: branchId };
      const existing = await this.prescriptions.getForContext(context, session);
      result = await this.prescriptions.submitForContext(context, data, actor, session);
      if (!existing) { await this.patients.addDownstreamTimeline(context.patient_id, 'INPATIENT_PRESCRIPTION_SUBMITTED', 'Inpatient prescription submitted', `Prescription submitted for ${admission.admissionNumber}.`, actor, session); await this.repository.audit('admissions.downstream.prescription_submitted', actor, metadata, { admissionId: id, patientId: context.patient_id, branchId, prescriptionId: result.id }, session); }
    }); return result; } finally { await session.endSession(); }
  }

  async getClinicalOrder(id: string, branchId: string, orderType: ClinicalOrderType, actor: string) {
    await this.requireActiveAdmission(id, branchId, actor);
    return this.clinicalOrders.getForContext({ source_type: 'INPATIENT_ADMISSION', source_id: id }, orderType);
  }

  async submitClinicalOrder(id: string, branchId: string, orderType: ClinicalOrderType, data: SaveOpdClinicalOrderDTO, actor: string, metadata: AdmissionRequestMetadata) {
    await this.authorize(actor, branchId); const session = await this.repository.session();
    try { let result; await session.withTransaction(async () => {
      const admission = await this.repository.getRecord(id, branchId, session);
      if (!admission || admission.status !== 'ADMITTED') throw new AppError('Inpatient admission is not active', 409, 'INPATIENT_CONTEXT_NOT_ACTIVE');
      const context = { source_type: 'INPATIENT_ADMISSION' as const, source_id: id, encounter_id: admission.sourceId?.toString() ?? null, admission_id: id, procedure_id: null, patient_id: admission.patientId.toString(), patient_number: admission.patientNumber, patient_name: admission.patientName, doctor_id: admission.admittingDoctorId.toString(), doctor_name: admission.admittingDoctorName, branch_id: branchId };
      const existing = await this.clinicalOrders.getForContext(context, orderType, session);
      result = await this.clinicalOrders.submitForContext(context, orderType, data, actor, session);
      if (!existing) { const label = orderType === 'LABORATORY' ? 'laboratory' : 'imaging'; const event = orderType === 'LABORATORY' ? 'INPATIENT_LAB_ORDER_SUBMITTED' : 'INPATIENT_IMAGING_ORDER_SUBMITTED'; await this.patients.addDownstreamTimeline(context.patient_id, event, `Inpatient ${label} order submitted`, `${label} order submitted for ${admission.admissionNumber}.`, actor, session); await this.repository.audit(`admissions.downstream.${label}_order_submitted`, actor, metadata, { admissionId: id, patientId: context.patient_id, branchId, orderId: result.id }, session); }
    }); return result; } finally { await session.endSession(); }
  }

  async createRequest(data: CreateAdmissionRequestDTO, actor: string, metadata: AdmissionRequestMetadata) {
    await this.authorize(actor, data.branch_id);
    await this.authorizeDepartment(actor, data.department_id);
    if (data.source_type !== 'DIRECT' && !data.source_id) throw new AppError('Source id is required', 400, 'VALIDATION_ERROR');
    if (data.source_type === 'DIRECT' && data.source_id) throw new AppError('Direct requests cannot include a source id', 400, 'VALIDATION_ERROR');
    try {
      return await executeWithOptionalTransaction(this.repository, async (session) => {
        const refs = await this.repository.requestReferences(data, session);
        if (!refs.patient) throw new AppError('Active patient not found', 404, 'PATIENT_NOT_FOUND');
        if (!refs.doctor) throw new AppError('Active recommending doctor is not available in this branch', 404, 'DOCTOR_NOT_FOUND');
        if (!refs.department) throw new AppError('Active department is not available in this branch', 404, 'DEPARTMENT_NOT_FOUND');
        let sourceReference: string | null = null;
        if (data.source_type === 'OPD_VISIT' && data.source_id) {
          const visit = await this.opdVisits.getAdmissionSource(data.source_id, session);
          if (!visit || visit.patientId.toString() !== data.patient_id || visit.branchId.toString() !== data.branch_id || visit.departmentId.toString() !== data.department_id || visit.doctorId.toString() !== data.recommending_doctor_id) throw new AppError('OPD source context does not match the request', 409, 'ADMISSION_SOURCE_MISMATCH');
          if (visit.inpatientAdmissionId) throw new AppError('This OPD visit has already been converted to an admission', 409, 'SOURCE_ALREADY_CONVERTED');
          sourceReference = visit.visitNumber;
        }
        if (data.source_type === 'EMERGENCY_ENCOUNTER' && data.source_id) {
          const encounter = await this.validateEmergencySource(data, session);
          sourceReference = encounter.encounterNumber;
        }
        const result = await this.repository.createRequest(data, { patientNumber: refs.patient.patientNumber, patientName: [refs.patient.firstName, refs.patient.middleName, refs.patient.lastName].filter(Boolean).join(' '), doctorName: refs.doctor.displayName, departmentName: refs.department.name, sourceReference }, actor, session);
        await this.patients.addAdmissionTimeline(data.patient_id, 'ADMISSION_REQUEST_CREATED', 'Admission requested', `${result.request_number} was created from ${data.source_type.replace('_', ' ').toLowerCase()}.`, actor, session);
        await this.repository.audit('admissions.request.created', actor, metadata, { requestId: result.id, patientId: data.patient_id, branchId: data.branch_id, sourceType: data.source_type, sourceId: data.source_id ?? null }, session);
        return result;
      });
    } catch (error) { return rethrowDuplicate(error); }
  }

  async validateRequest(id: string, branchId: string, data: ValidateAdmissionRequestDTO, actor: string, metadata: AdmissionRequestMetadata) {
    await this.authorize(actor, branchId);
    return executeWithOptionalTransaction(this.repository, async (session) => {
      const request = await this.repository.getRequest(id, branchId, session);
      if (!request || !['PENDING_VALIDATION', 'READY_FOR_CONFIRMATION'].includes(request.status)) throw new AppError('Admission request cannot be validated in its current state', 409, 'ADMISSION_REQUEST_STATE_CONFLICT');
      if (await this.repository.hasActiveAdmission(request.patient_id, session)) throw new AppError('Patient already has an active inpatient admission', 409, 'ACTIVE_ADMISSION_EXISTS');
      const result = await this.repository.validateRequest(id, branchId, data, actor, session);
      if (!result) throw new AppError('Admission request changed before validation', 409, 'ADMISSION_REQUEST_STATE_CONFLICT');
      await this.repository.audit('admissions.request.validated', actor, metadata, { requestId: id, branchId, bedId: data.bed_id, holdId: data.hold_id ?? null }, session);
      return result;
    });
  }

  async confirmRequest(id: string, branchId: string, data: ConfirmAdmissionRequestDTO, actor: string, metadata: AdmissionRequestMetadata) {
    await this.authorize(actor, branchId);
    try {
      return await executeWithOptionalTransaction(this.repository, async (session) => {
        const request = await this.repository.getRequest(id, branchId, session);
        if (!request) throw new AppError('Admission request not found', 404, 'ADMISSION_REQUEST_NOT_FOUND');
        await this.authorizeDepartment(actor, request.department_id);
        if (request.status === 'CONFIRMED' && request.admission_id) return request;
        if (request.status !== 'READY_FOR_CONFIRMATION') throw new AppError('Validate this request before confirmation', 409, 'ADMISSION_REQUEST_NOT_READY');
        if (await this.repository.hasActiveAdmission(request.patient_id, session)) throw new AppError('Patient already has an active inpatient admission', 409, 'ACTIVE_ADMISSION_EXISTS');
        if (request.source_type === 'EMERGENCY_ENCOUNTER' && request.source_id) await this.validateEmergencySource({ patient_id: request.patient_id, branch_id: branchId, department_id: request.department_id, recommending_doctor_id: request.recommending_doctor_id, source_type: 'EMERGENCY_ENCOUNTER', source_id: request.source_id, admission_type: request.admission_type, priority: request.priority, reason: request.reason, notes: request.notes }, session);
        const validated = await this.repository.validateRequest(id, branchId, data, actor, session); if (!validated) throw new AppError('Admission request changed before confirmation', 409, 'ADMISSION_REQUEST_STATE_CONFLICT');
        const policy = await this.beds.getPolicyForConfirmation(branchId, session);
        const consent = await this.patients.verifyContextConsent(request.patient_id, data.consent_document_id ?? null, 'INPATIENT_ADMISSION', id, policy.admission_consent_required, session);
        const deposit = policy.admission_advance_deposit_required ? await this.billing.verifyAdmissionDeposit(request.patient_id, branchId, id, data.deposit_invoice_id ?? null, policy.admission_minimum_deposit_amount, actor, session) : { required_amount: policy.admission_minimum_deposit_amount, paid_amount: 0, remaining_amount: 0, satisfied: true, invoice_id: data.deposit_invoice_id ?? null, payment_ids: [], verified_at: new Date() };
        if (!deposit.satisfied) throw new AppError(`An advance deposit of ${deposit.required_amount} is required before confirmation`, 409, 'ADVANCE_DEPOSIT_REQUIRED');
        const payload: CreateInpatientAdmissionDTO = { patient_id: request.patient_id, branch_id: branchId, ward_id: data.ward_id, bed_id: data.bed_id, hold_id: data.hold_id ?? null, admitting_doctor_id: request.recommending_doctor_id, department_id: request.department_id, admission_date: data.admission_date, admission_type: request.admission_type, reason: request.reason, notes: request.notes };
        const refs = await this.repository.references(payload, session); if (!refs.patient || !refs.doctor || !refs.department || !refs.ward) throw new AppError('Admission references are no longer active', 409, 'ADMISSION_CONTEXT_INVALID');
        const admission = await this.repository.create(payload, { patientNumber: request.patient_number, patientName: request.patient_name, doctorName: request.recommending_doctor_name, departmentName: request.department_name }, actor, session, { requestId: id, sourceType: request.source_type, sourceId: request.source_id });
        const record = await this.repository.getRecord(admission.id, branchId, session); if (!record) throw new AppError('Admission could not be reloaded for bed allotment', 500, 'ADMISSION_CREATE_FAILED');
        await this.beds.allotAdmission(record, data.bed_id, branchId, data.hold_id ?? null, actor, metadata, session);
        if (request.source_type === 'OPD_VISIT' && request.source_id) { const converted = await this.opdVisits.markAdmissionConverted(request.source_id, admission.id, actor, session); if (!converted) throw new AppError('The OPD visit was already converted', 409, 'SOURCE_ALREADY_CONVERTED'); }
        if (request.source_type === 'EMERGENCY_ENCOUNTER' && request.source_id) {
          const converted = await this.emergencies.markAdmissionConverted(request.source_id, branchId, admission.id, actor, session);
          if (!converted) throw new AppError('The Emergency encounter was changed or already converted', 409, 'ADMISSION_SOURCE_ALREADY_CONVERTED');
          await this.emergencies.audit('emergency.encounter.converted_to_ip', actor, metadata, { encounterId: request.source_id, admissionId: admission.id, requestId: id, patientId: request.patient_id, branchId, bedId: data.bed_id }, session);
          await this.repository.audit('admissions.source.converted', actor, metadata, { sourceType: request.source_type, sourceId: request.source_id, admissionId: admission.id, requestId: id, patientId: request.patient_id, branchId, bedId: data.bed_id }, session);
          await this.patients.addEmergencyTimeline(request.patient_id, 'EMERGENCY_CONVERTED_TO_IP', 'Emergency converted to inpatient admission', `${request.source_reference ?? 'Emergency encounter'} was converted to ${admission.admission_number}.`, actor, session);
        }
        const snapshot: AdmissionPrerequisiteSnapshot = { consent_required: policy.admission_consent_required, consent_satisfied: !policy.admission_consent_required || Boolean(consent), consent_document_id: consent?.id ?? null, consent_kind: consent?.consent_kind ?? null, consent_signed_at: consent?.signed_at ?? null, deposit_required: policy.admission_advance_deposit_required, deposit_satisfied: deposit.satisfied, deposit_required_amount: deposit.required_amount, deposit_paid_amount: deposit.paid_amount, deposit_invoice_id: deposit.invoice_id, deposit_payment_ids: deposit.payment_ids, verified_at: deposit.verified_at };
        const result = await this.repository.confirmRequest(id, admission.id, snapshot, actor, session); if (!result) throw new AppError('Admission request changed before confirmation', 409, 'ADMISSION_REQUEST_STATE_CONFLICT');
        await this.patients.addAdmissionTimeline(request.patient_id, 'INPATIENT_ADMISSION_CONFIRMED', 'Inpatient admission confirmed', `${admission.admission_number} was confirmed from ${request.request_number}.`, actor, session);
        await this.repository.audit('admissions.request.confirmed', actor, metadata, { requestId: id, admissionId: admission.id, patientId: request.patient_id, branchId, sourceType: request.source_type, sourceId: request.source_id, bedId: data.bed_id, prerequisiteSnapshot: snapshot }, session);
        return result;
      });
    } catch (error) { return rethrowDuplicate(error); }
  }

  async cancelRequest(id: string, branchId: string, data: CancelAdmissionRequestDTO, actor: string, metadata: AdmissionRequestMetadata) {
    await this.authorize(actor, branchId);
    return executeWithOptionalTransaction(this.repository, async (session) => {
      const request = await this.repository.getRequest(id, branchId, session);
      if (!request || !['PENDING_VALIDATION', 'READY_FOR_CONFIRMATION'].includes(request.status)) throw new AppError('Only a draft admission request can be cancelled', 409, 'ADMISSION_REQUEST_STATE_CONFLICT');
      if (request.hold_id) await this.beds.cancelAdmissionRequestHold(request.hold_id, branchId, data.reason, actor, metadata, session);
      const result = await this.repository.cancelRequest(id, branchId, data.reason, actor, session);
      if (!result) throw new AppError('Admission request changed before cancellation', 409, 'ADMISSION_REQUEST_STATE_CONFLICT');
      await this.patients.addAdmissionTimeline(request.patient_id, 'ADMISSION_REQUEST_CANCELLED', 'Admission request cancelled', `${request.request_number} was cancelled: ${data.reason}`, actor, session);
      await this.repository.audit('admissions.request.cancelled', actor, metadata, { requestId: id, branchId, patientId: request.patient_id, reason: data.reason, releasedHoldId: request.hold_id }, session);
      return result;
    });
  }

  private async authorize(actor: string, branchId: string) { if (!await this.repository.hasBranchAccess(actor, branchId)) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED'); }

  private async authorizeDepartment(actor: string, departmentId: string) {
    const scope = await this.repository.departmentScope(actor);
    if (scope && !scope.includes(departmentId)) {
      throw new AppError('Department access denied', 403, 'DEPARTMENT_ACCESS_DENIED');
    }
  }

  private async requireActiveAdmission(id: string, branchId: string, actor: string) { await this.authorize(actor, branchId); const admission = await this.repository.getById(id, branchId); if (!admission) throw new AppError('Inpatient admission not found', 404, 'ADMISSION_NOT_FOUND'); await this.authorizeDepartment(actor, admission.department_id); if (admission.status !== 'ADMITTED') throw new AppError('Inpatient admission is not active', 409, 'INPATIENT_CONTEXT_NOT_ACTIVE'); return admission; }

  private async validateEmergencySource(data: CreateAdmissionRequestDTO, session: ClientSession) {
    const encounter = data.source_id ? await this.emergencies.getRecord(data.source_id, data.branch_id, session) : null;
    if (!encounter) throw new AppError('Emergency source encounter was not found in this branch', 404, 'ADMISSION_SOURCE_NOT_FOUND');
    if (encounter.inpatientAdmissionId || encounter.status === 'CONVERTED_TO_IP') throw new AppError('This Emergency encounter has already been converted', 409, 'ADMISSION_SOURCE_ALREADY_CONVERTED');
    if (!encounter.patientId) throw new AppError('Link the Emergency encounter to a registered patient before admission', 409, 'EMERGENCY_PATIENT_LINK_REQUIRED');
    if (encounter.status !== 'READY_FOR_DISPOSITION' || encounter.disposition?.decision !== 'ADMIT') throw new AppError('The Emergency encounter is not ready for inpatient conversion', 409, 'ADMISSION_SOURCE_NOT_READY');
    if (!encounter.assignedDoctorId || encounter.patientId.toString() !== data.patient_id || encounter.branchId.toString() !== data.branch_id || encounter.departmentId.toString() !== data.department_id || encounter.assignedDoctorId.toString() !== data.recommending_doctor_id) throw new AppError('Emergency source context does not match the admission request', 409, 'ADMISSION_SOURCE_MISMATCH');
    return encounter;
  }
}
