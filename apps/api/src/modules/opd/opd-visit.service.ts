import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { AppointmentRepository } from '../appointments/appointment.repository.js';
import type { Appointment } from '../appointments/appointment.types.js';
import type { DoctorRepository } from '../doctors/doctor.repository.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { Patient } from '../patients/patient.types.js';
import type { CreateOpdVisitDTO, OpdVisit, OpdVisitListQuery, UpdateOpdVisitStatusDTO } from './opd-visit.types.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdConsultationRepository } from './opd-consultation.repository.js';
import type { SequenceService } from '../../shared/sequence/sequence.service.js';
import type { NotificationService } from '../notifications/notification.service.js';

const terminalAppointmentStatuses = ['CANCELLED', 'RESCHEDULED', 'NO_SHOW', 'COMPLETED'];

const allowedVisitStatusTransitions: Record<OpdVisit['status'], OpdVisit['status'][]> = {
  CHECKED_IN: ['WAITING_FOR_VITALS', 'SKIPPED', 'CANCELLED', 'NO_SHOW'],
  WAITING_FOR_VITALS: ['READY_FOR_CONSULTATION', 'SKIPPED', 'CANCELLED', 'NO_SHOW'],
  READY_FOR_CONSULTATION: ['IN_CONSULTATION', 'SKIPPED', 'CANCELLED', 'NO_SHOW'],
  SKIPPED: ['IN_CONSULTATION', 'CANCELLED', 'NO_SHOW'],
  IN_CONSULTATION: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const isObjectId = (value: string | null | undefined) => Boolean(value && Types.ObjectId.isValid(value));

const parseDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date;
};

const todayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const patientName = (patient: Patient) =>
  [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ');


const appointmentVisitType = (appointment: Appointment) => {
  if (appointment.visit_type === 'NEW_CONSULTATION') return 'NEW_CONSULTATION';
  if (appointment.visit_type === 'FOLLOW_UP') return 'FOLLOW_UP';
  if (appointment.visit_type === 'PROCEDURE') return 'PROCEDURE';
  if (appointment.visit_type === 'EMERGENCY') return 'EMERGENCY';
  return 'NEW_CONSULTATION';
};

export class OpdVisitService {
  constructor(
    private readonly repository: OpdVisitRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly patientRepository: PatientRepository,
    private readonly doctorRepository: DoctorRepository,
    private readonly consultationRepository: OpdConsultationRepository,
    private readonly sequenceService: SequenceService,
    private readonly notificationService: NotificationService,
  ) {}

  async list(query: OpdVisitListQuery, userId?: string) {
    this.validateListQuery(query);
    await this.repository.reconcileStaleVisits().catch(() => 0);
    const scope = userId ? await this.repository.resolveBranchScope(userId, query.branch_id) : undefined;
    return this.repository.list(this.normalizeListDates(query), scope);
  }

  async getById(id: string, userId?: string) {
    this.validateId(id, 'OPD visit id is invalid');
    const scope = userId ? await this.repository.resolveBranchScope(userId) : undefined;
    const visit = await this.repository.getById(id, scope);
    if (!visit) {
      throw new AppError('OPD visit not found', 404, 'NOT_FOUND');
    }

    return visit;
  }

  async create(data: CreateOpdVisitDTO, userId: string) {
    if (data.appointment_id) {
      return this.createFromAppointment(data, userId);
    }

    return this.createWalkInVisit(data, userId);
  }

  async updateStatus(id: string, data: UpdateOpdVisitStatusDTO, userId: string) {
    const existing = await this.getById(id, userId);
    const scope = await this.repository.resolveBranchScope(userId, existing.branch_id);

    if (!this.isStatusTransitionAllowed(existing.status, data.status)) {
      throw new AppError('OPD visit status transition is not allowed', 400, 'INVALID_STATUS_TRANSITION');
    }

    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(data.status) && !data.notes?.trim()) {
      throw new AppError('A reason is required for this OPD visit status', 400, 'STATUS_REASON_REQUIRED');
    }

    if (data.status === 'COMPLETED') {
      const consultation = await this.consultationRepository.getByVisit(existing.id);
      if (consultation?.status !== 'COMPLETED') {
        throw new AppError('Complete the clinical consultation before closing the OPD visit', 400, 'CONSULTATION_NOT_COMPLETED');
      }
    }

    const visit = await this.repository.updateStatus(id, data, userId, scope);
    if (!visit) {
      throw new AppError('OPD visit not found', 404, 'NOT_FOUND');
    }

    if (existing.status !== visit.status) {
      await this.repository.auditStatusTransition(visit, existing.status, userId);
    }

    await this.patientRepository.addTimelineEvent(
      visit.patient_id,
      {
        event_type: 'OPD_VISIT_STATUS_UPDATED',
        title: 'OPD visit status updated',
        description: `${visit.visit_number} moved to ${visit.status.replaceAll('_', ' ').toLowerCase()}.`,
      },
      userId,
    );

    if ((data.status === 'COMPLETED' || data.status === 'NO_SHOW') && visit.appointment_id) {
      const previousAppointment = await this.appointmentRepository.getById(visit.appointment_id, scope);
      const updatedAppointment = await this.appointmentRepository.updateStatus(
        visit.appointment_id,
        { status: data.status, notes: data.notes },
        userId,
        scope,
      );
      if (previousAppointment && updatedAppointment && previousAppointment.status !== updatedAppointment.status) {
        await this.appointmentRepository.auditStatusTransition(updatedAppointment, previousAppointment.status, userId);
      }
    }

    return visit;
  }

  async callNextPatient(id: string, userId: string) {
    const current = await this.getById(id, userId);
    if (current.status !== 'COMPLETED') {
      throw new AppError('Complete the current consultation before calling the next patient', 409, 'CURRENT_VISIT_NOT_COMPLETED');
    }

    const session = await this.repository.session();
    let nextVisit: OpdVisit | undefined;
    try {
      await session.withTransaction(async () => {
        nextVisit = await this.repository.startNextReadyVisit(current, userId, session);
        if (!nextVisit) {
          throw new AppError('No patient is ready for consultation in this doctor queue', 404, 'NO_READY_PATIENT');
        }
        const claimed = await this.repository.claimNextPatientCall(current.id, nextVisit.id, userId, session);
        if (!claimed) {
          throw new AppError('The next patient has already been called for this consultation', 409, 'NEXT_PATIENT_ALREADY_CALLED');
        }

        await this.repository.auditStatusTransition(nextVisit, 'READY_FOR_CONSULTATION', userId, session);
        await this.patientRepository.addTimelineEvent(
          nextVisit.patient_id,
          {
            event_type: 'OPD_VISIT_STATUS_UPDATED',
            title: 'Patient called for consultation',
            description: `${nextVisit.visit_number} was called for consultation with ${nextVisit.doctor_name}.`,
          },
          userId,
          session,
        );
        const message = `${nextVisit.patient_name} (${nextVisit.visit_number}) is called for consultation with ${nextVisit.doctor_name}.`;
        await this.notificationService.createNotification({
          recipient_role: 'RECEPTIONIST',
          recipient_branch_id: nextVisit.branch_id,
          title: 'Call Next OPD Patient',
          message,
          type: 'CALL_NEXT_PATIENT',
          related_entity_id: nextVisit.id,
        }, session);
        await this.notificationService.createNotification({
          recipient_role: 'NURSE',
          recipient_branch_id: nextVisit.branch_id,
          title: 'Call Next OPD Patient',
          message,
          type: 'CALL_NEXT_PATIENT',
          related_entity_id: nextVisit.id,
        }, session);
      });
    } finally {
      await session.endSession();
    }

    if (!nextVisit) {
      throw new AppError('No patient is ready for consultation in this doctor queue', 404, 'NO_READY_PATIENT');
    }
    return nextVisit;
  }

  private async createFromAppointment(data: CreateOpdVisitDTO, userId: string) {
    this.validateId(data.appointment_id, 'Appointment id is invalid');
    const scope = await this.appointmentRepository.resolveBranchScope(userId);
    const appointment = await this.appointmentRepository.getById(data.appointment_id!, scope);

    if (!appointment) {
      throw new AppError('Appointment not found', 404, 'NOT_FOUND');
    }

    if (terminalAppointmentStatuses.includes(appointment.status)) {
      throw new AppError('Only active appointments can be checked in to OPD', 400, 'APPOINTMENT_NOT_ACTIVE');
    }

    const duplicateAppointmentVisit = await this.repository.findByAppointmentId(appointment.id);
    if (duplicateAppointmentVisit) {
      throw new AppError('OPD visit already exists for this appointment', 409, 'DUPLICATE_OPD_VISIT', {
        visit_id: duplicateAppointmentVisit.id,
      });
    }

    await this.ensureNoActiveVisit(appointment.patient_id);
    const sequence = await this.sequenceService.getNextSequence('opd_visit');
    const visit = await this.repository.create(
      {
        appointmentId: appointment.id,
        visitNumber: this.sequenceService.formatStandardSequence('OPD', sequence),
        queueTokenNumber: sequence + 1,
        patientId: appointment.patient_id,
        patientNumber: appointment.patient_number,
        patientName: appointment.patient_name,
        doctorId: appointment.doctor_id,
        doctorName: appointment.doctor_name,
        doctorSpecialization: appointment.doctor_specialization,
        branchId: appointment.branch_id,
        departmentId: appointment.department_id,
        visitDate: todayUtc(),
        checkInTime: new Date(),
        visit_type: appointmentVisitType(appointment),
        priority: data.priority ?? appointment.priority,
        reason: data.reason ?? appointment.reason,
        notes: data.notes,
      },
      userId,
    );

    const checkedInAppointment = await this.appointmentRepository.updateStatus(
      appointment.id,
      { status: 'CHECKED_IN', notes: data.notes },
      userId,
      scope,
    );
    if (checkedInAppointment && appointment.status !== checkedInAppointment.status) {
      await this.appointmentRepository.auditStatusTransition(checkedInAppointment, appointment.status, userId);
    }
    await this.addVisitCreatedTimeline(visit, userId);
    await this.repository.auditCreated(visit, userId);
    return visit;
  }

  private async createWalkInVisit(data: CreateOpdVisitDTO, userId: string) {
    if (!data.patient_id) {
      throw new AppError('Patient is required for OPD check-in', 400, 'VALIDATION_ERROR');
    }
    if (!data.doctor_id) {
      throw new AppError('Doctor is required for OPD check-in', 400, 'VALIDATION_ERROR');
    }

    const [patient, doctor] = await Promise.all([
      this.getActivePatient(data.patient_id),
      this.getActiveDoctor(data.doctor_id),
    ]);
    await this.repository.resolveBranchScope(userId, doctor.branch_id);

    await this.ensureNoActiveVisit(patient.id);
    const sequence = await this.sequenceService.getNextSequence('opd_visit');
    const visit = await this.repository.create(
      {
        visitNumber: this.sequenceService.formatStandardSequence('OPD', sequence),
        queueTokenNumber: sequence + 1,
        patientId: patient.id,
        patientNumber: patient.patient_number,
        patientName: patientName(patient),
        doctorId: doctor.id,
        doctorName: doctor.display_name,
        doctorSpecialization: doctor.specialization,
        branchId: doctor.branch_id,
        departmentId: doctor.department_id,
        visitDate: todayUtc(),
        checkInTime: new Date(),
        visit_type: data.visit_type ?? 'WALK_IN',
        priority: data.priority ?? 'ROUTINE',
        reason: data.reason,
        notes: data.notes,
      },
      userId,
    );

    await this.addVisitCreatedTimeline(visit, userId);
    await this.repository.auditCreated(visit, userId);
    return visit;
  }

  private async getActivePatient(id: string) {
    this.validateId(id, 'Patient id is invalid');
    const patient = await this.patientRepository.getById(id);

    if (!patient || patient.status !== 'ACTIVE') {
      throw new AppError('Active patient is required for OPD check-in', 400, 'INVALID_PATIENT');
    }

    return patient;
  }

  private async getActiveDoctor(id: string) {
    this.validateId(id, 'Doctor id is invalid');
    const doctor = await this.doctorRepository.getById(id);

    if (!doctor || doctor.status !== 'ACTIVE') {
      throw new AppError('Active doctor is required for OPD check-in', 400, 'INVALID_DOCTOR');
    }

    return doctor;
  }

  private async ensureNoActiveVisit(patientId: string) {
    const activeVisit = await this.repository.findActiveByPatient(patientId);
    if (activeVisit) {
      throw new AppError('Patient already has an active OPD visit', 409, 'ACTIVE_OPD_VISIT_EXISTS', {
        visit_id: activeVisit.id,
      });
    }
  }

  private async addVisitCreatedTimeline(visit: OpdVisit, userId: string) {
    await this.patientRepository.addTimelineEvent(
      visit.patient_id,
      {
        event_type: 'OPD_VISIT_CREATED',
        title: 'OPD visit created',
        description: `${visit.visit_number} checked in for ${visit.doctor_name}.`,
      },
      userId,
    );
  }

  private validateListQuery(query: OpdVisitListQuery) {
    const idFields: Array<[string, string | undefined]> = [
      ['Doctor id is invalid', query.doctor_id],
      ['Patient id is invalid', query.patient_id],
      ['Branch id is invalid', query.branch_id],
      ['Department id is invalid', query.department_id],
    ];

    for (const [message, value] of idFields) {
      if (value && !isObjectId(value)) {
        throw new AppError(message, 400, 'VALIDATION_ERROR');
      }
    }

    if (query.date_from && !parseDateOnly(query.date_from)) {
      throw new AppError('OPD visit from date is invalid', 400, 'VALIDATION_ERROR');
    }

    if (query.date_to && !parseDateOnly(query.date_to)) {
      throw new AppError('OPD visit to date is invalid', 400, 'VALIDATION_ERROR');
    }

    if (query.date_from && query.date_to) {
      const fromDate = parseDateOnly(query.date_from);
      const toDate = parseDateOnly(query.date_to);
      if (fromDate && toDate && fromDate > toDate) {
        throw new AppError('OPD visit from date must be before to date', 400, 'VALIDATION_ERROR');
      }
    }
  }

  private normalizeListDates(query: OpdVisitListQuery): OpdVisitListQuery {
    return {
      ...query,
      ...(query.date_from ? { date_from: parseDateOnly(query.date_from)?.toISOString() } : {}),
      ...(query.date_to ? { date_to: parseDateOnly(query.date_to)?.toISOString() } : {}),
    };
  }

  private validateId(id: string | null | undefined, message: string) {
    if (!isObjectId(id)) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }

  private isStatusTransitionAllowed(current: OpdVisit['status'], next: OpdVisit['status']) {
    if (current === next) {
      return true;
    }

    return allowedVisitStatusTransitions[current].includes(next);
  }
}
