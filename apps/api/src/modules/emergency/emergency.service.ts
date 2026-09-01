import { AppError } from '../../shared/errors/app-error.js';
import type { OpdClinicalOrderRepository } from '../opd/opd-clinical-order.repository.js';
import type { OpdPrescriptionRepository } from '../opd/opd-prescription.repository.js';
import type { PatientService } from '../patients/patient.service.js';
import type { ServiceRepository } from '../services/service.repository.js';
import type { BillingService } from '../billing/billing.service.js';
import type { EmergencyRepository, EmergencyLean } from './emergency.repository.js';
import type {
  CreateEmergencyDTO,
  EmergencyConsultationDTO,
  EmergencyDispositionDTO,
  EmergencyListQuery,
  EmergencyMetadata,
  EmergencyOrderDTO,
  EmergencyReasonDTO,
  EmergencyTriageDTO,
  EmergencyTriageLevel,
} from './emergency.types.js';

const terminal = ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'];
const duplicate = (error: unknown): never => {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)
    throw new AppError(
      'Emergency request conflicts with an existing record',
      409,
      'EMERGENCY_STATE_CONFLICT',
    );
  throw error;
};
export class EmergencyService {
  constructor(
    private readonly repository: EmergencyRepository,
    private readonly patients: PatientService,
    private readonly clinicalOrders: OpdClinicalOrderRepository,
    private readonly prescriptions: OpdPrescriptionRepository,
    private readonly services: ServiceRepository,
    private readonly billing: BillingService,
  ) {}
  private async authorize(actor: string, branchId: string) {
    if (!(await this.repository.hasBranchAccess(actor, branchId)))
      throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
  }
  private async authorizeDepartment(actor: string, departmentId: string) {
    const scope = await this.repository.departmentScope(actor);
    if (scope && !scope.includes(departmentId))
      throw new AppError('Department access denied', 403, 'DEPARTMENT_ACCESS_DENIED');
  }
  async list(query: EmergencyListQuery, actor: string) {
    await this.authorize(actor, query.branch_id);
    if (query.department_id) await this.authorizeDepartment(actor, query.department_id);
    return this.repository.list(query, await this.repository.departmentScope(actor));
  }
  async summary(branchId: string, actor: string) {
    await this.authorize(actor, branchId);
    return this.repository.summary(branchId, await this.repository.departmentScope(actor));
  }
  async get(id: string, branchId: string, actor: string) {
    await this.authorize(actor, branchId);
    const row = await this.repository.get(id, branchId);
    if (!row)
      throw new AppError('Emergency encounter not found', 404, 'EMERGENCY_ENCOUNTER_NOT_FOUND');
    await this.authorizeDepartment(actor, row.department_id);
    return row;
  }
  async create(data: CreateEmergencyDTO, actor: string, metadata: EmergencyMetadata) {
    await this.authorize(actor, data.branch_id);
    await this.authorizeDepartment(actor, data.department_id);
    const session = await this.repository.session();
    try {
      let result;
      await session.withTransaction(async () => {
        const refs = await this.repository.references(data, session);
        if (!refs.branch) throw new AppError('Active branch not found', 404, 'BRANCH_NOT_FOUND');
        if (!refs.department)
          throw new AppError(
            'Active clinical department not found in branch',
            404,
            'DEPARTMENT_NOT_FOUND',
          );
        if (data.patient_id && !refs.patient)
          throw new AppError('Active patient not found', 404, 'PATIENT_NOT_FOUND');
        let patientId = refs.patient?._id ?? null;
        let patientNumber = refs.patient?.patientNumber ?? null;
        let name = refs.patient
          ? [refs.patient.firstName, refs.patient.middleName, refs.patient.lastName]
              .filter(Boolean)
              .join(' ')
          : data.provisional_identity!.display_name;

        if (!refs.patient && data.provisional_identity) {
          const provPatient = await this.repository.createProvisionalPatient(
            {
              displayName: data.provisional_identity.display_name,
              estimatedAge: data.provisional_identity.estimated_age,
              gender: data.provisional_identity.gender,
              contact: data.provisional_identity.contact,
              identityNotes: data.provisional_identity.identity_notes,
            },
            data.branch_id,
            actor,
            session,
          );
          patientId = provPatient._id;
          patientNumber = provPatient.patientNumber;
          name = [provPatient.firstName, provPatient.middleName, provPatient.lastName].filter(Boolean).join(' ') || data.provisional_identity.display_name;
        }

        result = await this.repository.create(
          data,
          {
            patientId,
            patientNumber,
            patientName: name,
          },
          actor,
          session,
        );
        if (patientId)
          await this.patients.addEmergencyTimeline(
            patientId.toString(),
            'EMERGENCY_ENCOUNTER_REGISTERED',
            'Emergency encounter registered',
            `${result.encounter_number} was registered for emergency care.`,
            actor,
            session,
          );
        await this.repository.audit(
          'emergency.encounter.registered',
          actor,
          metadata,
          {
            encounterId: result.id,
            patientId: data.patient_id ?? null,
            branchId: data.branch_id,
            departmentId: data.department_id,
            status: result.status,
          },
          session,
        );
      });
      if (!result)
        throw new AppError(
          'Emergency encounter could not be created',
          500,
          'EMERGENCY_CREATE_FAILED',
        );
      return result;
    } catch (error) {
      return duplicate(error);
    } finally {
      await session.endSession();
    }
  }
  async linkPatient(
    id: string,
    branchId: string,
    patientId: string,
    reason: string | undefined,
    correction: boolean,
    actor: string,
    metadata: EmergencyMetadata,
  ) {
    await this.authorize(actor, branchId);
    const session = await this.repository.session();
    try {
      let result;
      await session.withTransaction(async () => {
        const current = await this.requireRecord(id, branchId, actor, session);
        if (terminal.includes(current.status))
          throw new AppError(
            'Terminal encounter identity cannot be changed',
            409,
            'EMERGENCY_PATIENT_LINK_CONFLICT',
          );
        if (correction && !current.patientId)
          throw new AppError(
            'Use patient linking before correction',
            409,
            'EMERGENCY_PATIENT_LINK_CONFLICT',
          );
        if (correction && !reason)
          throw new AppError('Correction reason is required', 400, 'VALIDATION_ERROR');
        if (!correction && current.patientId)
          throw new AppError('Patient is already linked', 409, 'EMERGENCY_PATIENT_LINK_CONFLICT');
        if (correction && !(await this.repository.hasFinancialRecords(id)))
          throw new AppError(
            'Use ordinary linking when no downstream records exist',
            409,
            'EMERGENCY_PATIENT_LINK_CONFLICT',
          );
        const patient = await this.repository.patient(patientId, session);
        if (!patient) throw new AppError('Active patient not found', 404, 'PATIENT_NOT_FOUND');
        result = await this.repository.linkPatient(
          id,
          branchId,
          patient,
          actor,
          correction,
          session,
        );
        if (!result)
          throw new AppError(
            'Patient link changed before save',
            409,
            'EMERGENCY_PATIENT_LINK_CONFLICT',
          );
        await this.patients.addEmergencyTimeline(
          patientId,
          'EMERGENCY_PATIENT_LINKED',
          correction ? 'Emergency identity corrected' : 'Emergency encounter linked',
          `${current.encounterNumber} was linked to this patient.`,
          actor,
          session,
        );
        await this.repository.audit(
          correction ? 'emergency.patient.corrected' : 'emergency.patient.linked',
          actor,
          metadata,
          {
            encounterId: id,
            previousPatientId: current.patientId?.toString() ?? null,
            patientId,
            branchId,
            reason: reason ?? null,
          },
          session,
        );
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
  async triage(
    id: string,
    branchId: string,
    data: EmergencyTriageDTO,
    actor: string,
    metadata: EmergencyMetadata,
  ) {
    await this.authorize(actor, branchId);
    const session = await this.repository.session();
    try {
      let result;
      await session.withTransaction(async () => {
        const current = await this.requireRecord(id, branchId, actor, session);
        result = await this.repository.transition(
          id,
          branchId,
          ['REGISTERED', 'WAITING_FOR_TRIAGE'],
          'WAITING_FOR_DOCTOR',
          'TRIAGED',
          actor,
          {
            triage: {
              level: data.level,
              effectiveLevel: data.level,
              area: data.area,
              nurseUserId: actor,
              assessedAt: new Date(),
              painScore: data.pain_score ?? null,
              vitals: data.vitals,
              abcde: data.abcde,
              notes: data.notes ?? null,
            },
          },
          null,
          session,
        );
        if (!result)
          throw new AppError(
            'Encounter is no longer waiting for triage',
            409,
            'EMERGENCY_ENCOUNTER_NOT_ACTIONABLE',
          );
        if (current.patientId)
          await this.patients.addEmergencyTimeline(
            current.patientId.toString(),
            'EMERGENCY_TRIAGE_COMPLETED',
            'Emergency triage completed',
            `${current.encounterNumber} was triaged as ${data.level.replaceAll('_', ' ')}.`,
            actor,
            session,
          );
        await this.repository.audit(
          'emergency.triage.completed',
          actor,
          metadata,
          {
            encounterId: id,
            patientId: current.patientId?.toString() ?? null,
            branchId,
            previousStatus: current.status,
            status: 'WAITING_FOR_DOCTOR',
            triageLevel: data.level,
          },
          session,
        );
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
  async overridePriority(
    id: string,
    branchId: string,
    level: EmergencyTriageLevel,
    reason: string,
    actor: string,
    metadata: EmergencyMetadata,
  ) {
    await this.authorize(actor, branchId);
    const session = await this.repository.session();
    try {
      let result;
      await session.withTransaction(async () => {
        const current = await this.requireRecord(id, branchId, actor, session);
        if (!current.triage)
          throw new AppError(
            'Complete triage before overriding priority',
            409,
            'EMERGENCY_ENCOUNTER_NOT_ACTIONABLE',
          );
        result = await this.repository.overridePriority(
          id,
          branchId,
          current.triage.effectiveLevel,
          level,
          reason,
          actor,
          session,
        );
        if (!result)
          throw new AppError('Priority changed before save', 409, 'EMERGENCY_STATE_CONFLICT');
        await this.repository.audit(
          'emergency.priority.overridden',
          actor,
          metadata,
          {
            encounterId: id,
            branchId,
            previousLevel: current.triage.effectiveLevel,
            newLevel: level,
            reason,
          },
          session,
        );
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
  async call(id: string, branchId: string, actor: string, metadata: EmergencyMetadata) {
    return this.simpleTransition(
      id,
      branchId,
      'WAITING_FOR_DOCTOR',
      'IN_CONSULTATION',
      'CALLED',
      null,
      actor,
      metadata,
    );
  }
  async skip(
    id: string,
    branchId: string,
    data: EmergencyReasonDTO,
    actor: string,
    metadata: EmergencyMetadata,
  ) {
    return this.simpleTransition(
      id,
      branchId,
      'IN_CONSULTATION',
      'WAITING_FOR_DOCTOR',
      'SKIPPED',
      data.reason,
      actor,
      metadata,
    );
  }
  async consultation(
    id: string,
    branchId: string,
    data: EmergencyConsultationDTO,
    actor: string,
    metadata: EmergencyMetadata,
  ) {
    await this.authorize(actor, branchId);
    const session = await this.repository.session();
    try {
      let result;
      await session.withTransaction(async () => {
        let current = await this.requireRecord(id, branchId, actor, session);
        const doctor = await this.repository.doctor(
          data.doctor_id,
          branchId,
          current.departmentId.toString(),
          session,
        );
        if (!doctor)
          throw new AppError(
            'Active doctor not found in encounter department',
            404,
            'DOCTOR_NOT_FOUND',
          );
        const target = data.ready_for_disposition ? 'READY_FOR_DISPOSITION' : 'IN_CONSULTATION';
        result = await this.repository.transition(
          id,
          branchId,
          ['REGISTERED', 'WAITING_FOR_TRIAGE', 'TRIAGED', 'WAITING_FOR_DOCTOR', 'IN_CONSULTATION', 'IN_TREATMENT'],
          target,
          'CONSULTATION_UPDATED',
          actor,
          {
            assignedDoctorId: doctor._id,
            assignedDoctorName: doctor.displayName,
            consultation: {
              startedAt: current.consultation?.startedAt ?? new Date(),
              updatedAt: new Date(),
              chiefComplaint: data.chief_complaint,
              history: data.history,
              examination: data.examination,
              diagnosis: data.diagnosis,
              plan: data.plan,
              treatment: data.treatment ?? null,
              notes: data.notes ?? null,
            },
          },
          null,
          session,
        );
        if (!result)
          throw new AppError(
            'Encounter is not actionable for consultation',
            409,
            'EMERGENCY_ENCOUNTER_NOT_ACTIONABLE',
          );
        if (target === 'READY_FOR_DISPOSITION') {
          if (!current.patientId || !current.patientNumber) {
            if (current.provisionalIdentity) {
              const provPatient = await this.repository.createProvisionalPatient(
                current.provisionalIdentity,
                branchId,
                actor,
                session,
              );
              await this.repository.updatePatientIdentity(
                id,
                branchId,
                provPatient._id,
                provPatient.patientNumber,
                [provPatient.firstName, provPatient.lastName].filter(Boolean).join(' ') || current.patientName,
                session,
              );
              current = await this.requireRecord(id, branchId, actor, session);
            }
          }
          if (current.patientId) {
            await this.repository.createOrGetAdmissionRequest(
              current,
              data.chief_complaint || data.diagnosis,
              data.notes,
              actor,
              session,
            );
            await this.patients.addEmergencyTimeline(
              current.patientId.toString(),
              'EMERGENCY_CONSULTATION_UPDATED',
              'Inpatient Admission Requested',
              `${current.encounterNumber} is ready for admission. Admission request created and awaiting ward/bed allocation.`,
              actor,
              session,
            );
          }
        }
        if (current.patientId)
          await this.patients.addEmergencyTimeline(
            current.patientId.toString(),
            'EMERGENCY_CONSULTATION_UPDATED',
            'Emergency consultation updated',
            `${current.encounterNumber} doctor evaluation was updated.`,
            actor,
            session,
          );
        await this.repository.audit(
          'emergency.consultation.updated',
          actor,
          metadata,
          {
            encounterId: id,
            patientId: current.patientId?.toString() ?? null,
            doctorId: data.doctor_id,
            branchId,
            previousStatus: current.status,
            status: target,
          },
          session,
        );
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
  async order(
    id: string,
    branchId: string,
    data: EmergencyOrderDTO,
    actor: string,
    metadata: EmergencyMetadata,
  ) {
    await this.authorize(actor, branchId);
    const session = await this.repository.session();
    try {
      let result;
      await session.withTransaction(async () => {
        let current = await this.requireRecord(id, branchId, actor, session);
        if (terminal.includes(current.status)) {
          throw new AppError(
            `This emergency encounter has reached final disposition (${current.status.toLowerCase().replace(/_/g, ' ')}). New clinical orders cannot be placed.`,
            409,
            'EMERGENCY_ENCOUNTER_NOT_ACTIONABLE',
          );
        }
        if (!current.patientId || !current.patientNumber) {
          if (current.provisionalIdentity) {
            const provPatient = await this.repository.createProvisionalPatient(
              current.provisionalIdentity,
              branchId,
              actor,
              session,
            );
            await this.repository.updatePatientIdentity(
              id,
              branchId,
              provPatient._id,
              provPatient.patientNumber,
              [provPatient.firstName, provPatient.lastName].filter(Boolean).join(' ') || current.patientName,
              session,
            );
            current = await this.requireRecord(id, branchId, actor, session);
          } else {
            throw new AppError(
              'Link an existing patient before placing downstream orders',
              409,
              'EMERGENCY_SOURCE_CONTEXT_UNSUPPORTED',
            );
          }
        }
        if (!current.patientId || !current.patientNumber) {
          throw new AppError(
            'Patient record could not be attached',
            500,
            'EMERGENCY_PATIENT_LINK_CONFLICT',
          );
        }
        const patientIdStr = current.patientId.toString();
        const patientNumberStr = current.patientNumber;

        if (!current.assignedDoctorId || !current.assignedDoctorName || !current.consultation)
          throw new AppError(
            'Doctor evaluation is required before orders',
            409,
            'EMERGENCY_ENCOUNTER_NOT_ACTIONABLE',
          );
        let downstream;
        if (data.order_type === 'PHARMACY') {
          downstream = await this.prescriptions.submitForEmergency(
            {
              encounterId: id,
              patientId: patientIdStr,
              patientNumber: patientNumberStr,
              patientName: current.patientName,
              doctorId: current.assignedDoctorId.toString(),
              doctorName: current.assignedDoctorName,
              branchId,
              items: data.items.map((item) => ({
                medicine_name: item.medicine_name ?? item.name,
                strength: null,
                dosage: item.dosage ?? '',
                route: item.route ?? '',
                frequency: item.frequency ?? '',
                duration: item.duration ?? '',
                quantity: item.quantity ?? null,
                instructions: data.instructions ?? null,
              })),
              doctorInstructions: data.clinical_notes,
              patientInstructions: data.instructions,
            },
            actor,
            session,
          );
        } else {
          if (data.items.some((item) => !item.service_id))
            throw new AppError(
              'Catalogue service is required for laboratory and imaging orders',
              400,
              'VALIDATION_ERROR',
            );
          const serviceType = data.order_type === 'LABORATORY' ? 'LAB_TEST' : 'IMAGING_SERVICE';
          const requestedServiceIds = data.items.map((item) => item.service_id!);
          const catalogueServices = await this.services.getActiveClinicalOrderServices(
            requestedServiceIds,
            serviceType,
            session,
          );
          if (catalogueServices.length !== new Set(requestedServiceIds).size)
            throw new AppError(
              'One or more active catalogue services were not found',
              404,
              'CLINICAL_ORDER_SERVICE_NOT_FOUND',
            );
          const serviceById = new Map(catalogueServices.map((item) => [item._id.toString(), item]));
          downstream = await this.clinicalOrders.submitForEmergency(
            {
              encounterId: id,
              patientId: patientIdStr,
              patientNumber: patientNumberStr,
              patientName: current.patientName,
              doctorId: current.assignedDoctorId.toString(),
              doctorName: current.assignedDoctorName,
              branchId,
              orderType: data.order_type,
              priority: data.priority,
              destination: data.destination,
              specimenType: data.specimen_type,
              items: data.items.map((item) => {
                const service = serviceById.get(item.service_id!);
                if (!service)
                  throw new AppError(
                    'Active catalogue service not found',
                    404,
                    'CLINICAL_ORDER_SERVICE_NOT_FOUND',
                  );
                return {
                  service_id: item.service_id!,
                  investigation_name: service.name,
                  category: service.category ?? 'Emergency',
                };
              }),
              clinicalNotes: data.clinical_notes,
              instructions: data.instructions,
            },
            actor,
            session,
          );
        }
        result = await this.repository.addOrder(
          id,
          branchId,
          data.order_type,
          downstream.id,
          actor,
          session,
        );
        if (!result)
          throw new AppError(
            'Encounter changed before order submission',
            409,
            'EMERGENCY_STATE_CONFLICT',
          );
        await this.repository.audit(
          'emergency.order.created',
          actor,
          metadata,
          {
            encounterId: id,
            patientId: patientIdStr,
            downstreamId: downstream.id,
            orderType: data.order_type,
            sourceType: 'EMERGENCY_ENCOUNTER',
            sourceId: id,
            branchId,
          },
          session,
        );
      });
      return result;
    } catch (error) {
      return duplicate(error);
    } finally {
      await session.endSession();
    }
  }
  async disposition(
    id: string,
    branchId: string,
    data: EmergencyDispositionDTO,
    actor: string,
    metadata: EmergencyMetadata,
  ) {
    await this.authorize(actor, branchId);
    const session = await this.repository.session();
    try {
      let result;
      await session.withTransaction(async () => {
        let current = await this.requireRecord(id, branchId, actor, session);
        if (!current.consultation || !current.assignedDoctorId)
          throw new AppError(
            'Doctor evaluation is required before disposition',
            409,
            'EMERGENCY_DISPOSITION_NOT_ALLOWED',
          );
        const target =
          data.decision === 'DISCHARGE'
            ? 'DISCHARGED'
            : data.decision === 'TRANSFER'
              ? 'TRANSFERRED'
              : data.decision === 'LEFT'
                ? 'LEFT'
                : 'READY_FOR_DISPOSITION';
        if (data.decision === 'DISCHARGE') {
          const isFinanciallyClosed = await this.billing.isEncounterFinanciallyClosed(id, session);
          if (!isFinanciallyClosed) {
            throw new AppError(
              'Billing closure is unavailable while emergency charges remain unresolved',
              409,
              'EMERGENCY_BILLING_CLOSURE_REQUIRED',
            );
          }
        }
        result = await this.repository.transition(
          id,
          branchId,
          ['IN_CONSULTATION', 'IN_TREATMENT', 'READY_FOR_DISPOSITION'],
          target,
          'DISPOSITION_CONFIRMED',
          actor,
          {
            disposition: {
              decision: data.decision,
              reason: data.reason ?? null,
              summary: data.summary ?? null,
              instructions: data.instructions ?? null,
              transferDestination: data.transfer_destination ?? null,
              billingStatus: data.decision === 'DISCHARGE' ? 'NO_CHARGES_RECORDED' : null,
              confirmedAt: new Date(),
              confirmedBy: actor,
            },
          },
          data.reason ?? null,
          session,
        );
        if (!result)
          throw new AppError(
            'Disposition is not allowed from the current state',
            409,
            'EMERGENCY_DISPOSITION_NOT_ALLOWED',
          );
        if (target === 'READY_FOR_DISPOSITION' || data.decision === 'ADMIT') {
          if (!current.patientId || !current.patientNumber) {
            if (current.provisionalIdentity) {
              const provPatient = await this.repository.createProvisionalPatient(
                current.provisionalIdentity,
                branchId,
                actor,
                session,
              );
              await this.repository.updatePatientIdentity(
                id,
                branchId,
                provPatient._id,
                provPatient.patientNumber,
                [provPatient.firstName, provPatient.lastName].filter(Boolean).join(' ') || current.patientName,
                session,
              );
              current = await this.requireRecord(id, branchId, actor, session);
            }
          }
          if (current.patientId) {
            await this.repository.createOrGetAdmissionRequest(
              current,
              data.reason || data.summary || 'Emergency Inpatient Admission',
              data.instructions || data.summary,
              actor,
              session,
            );
            await this.patients.addEmergencyTimeline(
              current.patientId.toString(),
              'EMERGENCY_DISPOSITION_CONFIRMED',
              'Inpatient Admission Requested',
              `${current.encounterNumber} admission disposition confirmed. Admission request created and awaiting ward/bed allocation.`,
              actor,
              session,
            );
          }
        }
        if (current.patientId)
          await this.patients.addEmergencyTimeline(
            current.patientId.toString(),
            'EMERGENCY_DISPOSITION_CONFIRMED',
            'Emergency disposition confirmed',
            `${current.encounterNumber} disposition: ${data.decision}.`,
            actor,
            session,
          );
        const event =
          data.decision === 'DISCHARGE'
            ? 'emergency.encounter.discharged'
            : data.decision === 'TRANSFER'
              ? 'emergency.encounter.transferred'
              : data.decision === 'LEFT'
                ? 'emergency.encounter.left'
                : 'emergency.disposition.confirmed';
        await this.repository.audit(
          event,
          actor,
          metadata,
          {
            encounterId: id,
            patientId: current.patientId?.toString() ?? null,
            branchId,
            decision: data.decision,
            previousStatus: current.status,
            status: target,
            reason: data.reason ?? null,
          },
          session,
        );
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
  async markNoShow(
    id: string,
    branchId: string,
    data: EmergencyReasonDTO,
    actor: string,
    metadata: EmergencyMetadata,
  ) {
    return this.simpleTransition(
      id,
      branchId,
      ['WAITING_FOR_TRIAGE', 'WAITING_FOR_DOCTOR'],
      'NO_SHOW',
      'MARKED_NO_SHOW',
      data.reason,
      actor,
      metadata,
      'emergency.encounter.no_show',
    );
  }
  async markLeft(
    id: string,
    branchId: string,
    data: EmergencyReasonDTO,
    actor: string,
    metadata: EmergencyMetadata,
  ) {
    return this.simpleTransition(
      id,
      branchId,
      ['WAITING_FOR_TRIAGE', 'WAITING_FOR_DOCTOR', 'IN_CONSULTATION', 'IN_TREATMENT'],
      'LEFT',
      'MARKED_LEFT',
      data.reason,
      actor,
      metadata,
      'emergency.encounter.left',
    );
  }
  async cancel(
    id: string,
    branchId: string,
    data: EmergencyReasonDTO,
    actor: string,
    metadata: EmergencyMetadata,
  ) {
    return this.simpleTransition(
      id,
      branchId,
      ['REGISTERED', 'WAITING_FOR_TRIAGE', 'WAITING_FOR_DOCTOR'],
      'CANCELLED',
      'CANCELLED',
      data.reason,
      actor,
      metadata,
      'emergency.encounter.cancelled',
    );
  }
  private async simpleTransition(
    id: string,
    branchId: string,
    from:
      | import('./emergency.types.js').EmergencyStatus
      | import('./emergency.types.js').EmergencyStatus[],
    to: import('./emergency.types.js').EmergencyStatus,
    action: string,
    reason: string | null,
    actor: string,
    metadata: EmergencyMetadata,
    eventType = 'emergency.queue.updated',
  ) {
    await this.authorize(actor, branchId);
    const session = await this.repository.session();
    try {
      let result;
      await session.withTransaction(async () => {
        const current = await this.requireRecord(id, branchId, actor, session);
        result = await this.repository.transition(
          id,
          branchId,
          from,
          to,
          action,
          actor,
          {},
          reason,
          session,
        );
        if (!result)
          throw new AppError(
            'Encounter is not actionable from its current state',
            409,
            'EMERGENCY_ENCOUNTER_NOT_ACTIONABLE',
          );
        await this.repository.audit(
          eventType,
          actor,
          metadata,
          {
            encounterId: id,
            patientId: current.patientId?.toString() ?? null,
            branchId,
            previousStatus: current.status,
            status: to,
            reason,
          },
          session,
        );
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
  private async requireRecord(
    id: string,
    branchId: string,
    actor: string,
    session: import('mongoose').ClientSession,
  ): Promise<EmergencyLean> {
    const row = await this.repository.getRecord(id, branchId, session);
    if (!row)
      throw new AppError('Emergency encounter not found', 404, 'EMERGENCY_ENCOUNTER_NOT_FOUND');
    await this.authorizeDepartment(actor, row.departmentId.toString());
    return row;
  }
}
