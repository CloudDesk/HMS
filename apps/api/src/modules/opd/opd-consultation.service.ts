import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { executeRequiredTransaction } from '../../shared/database/transaction.js';
import type { AppointmentRepository } from '../appointments/appointment.repository.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { OpdConsultationRepository } from './opd-consultation.repository.js';
import type { SaveOpdConsultationDTO } from './opd-consultation.types.js';
import type { OpdVitalsRepository } from './opd-vitals.repository.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';

const terminalVisitStatuses: OpdVisit['status'][] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

const isObjectId = (value: string | null | undefined) => Boolean(value && Types.ObjectId.isValid(value));

export class OpdConsultationService {
  constructor(
    private readonly repository: OpdConsultationRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly vitalsRepository: OpdVitalsRepository,
    private readonly patientRepository: PatientRepository,
    private readonly appointmentRepository: AppointmentRepository,
  ) {}

  async getByVisit(visitId: string, userId: string) {
    await this.getVisit(visitId, userId);
    return this.repository.getByVisit(visitId);
  }

  async saveDraft(visitId: string, data: SaveOpdConsultationDTO, userId: string) {
    const visit = await this.getVisit(visitId, userId);
    this.ensureOpenVisit(visit);
    this.ensureConsultationReady(visit);
    const current = await this.repository.getByVisit(visitId);
    this.ensureDraftEditable(current?.status);
    this.assertExpectedState(data, current?.version ?? 0, current?.status ?? 'DRAFT');
    const scope = await this.visitRepository.resolveBranchScope(userId);

    return executeRequiredTransaction(this.visitRepository, async (session) => {
      const transactionalVisit = await this.visitRepository.getById(visitId, scope, session);
      if (!transactionalVisit) throw new AppError('OPD visit not found', 404, 'NOT_FOUND');
      this.ensureOpenVisit(transactionalVisit);
      this.ensureConsultationReady(transactionalVisit);
      const transactionalCurrent = await this.repository.getByVisit(visitId, session);
      this.ensureDraftEditable(transactionalCurrent?.status);
      this.assertExpectedState(data, transactionalCurrent?.version ?? 0, transactionalCurrent?.status ?? 'DRAFT');

      const consultation = await this.repository.saveForVisit({
        ...data,
        status: 'DRAFT',
        visit: transactionalVisit,
        currentVersion: transactionalCurrent?.version ?? 0,
        currentStatus: transactionalCurrent?.status,
      }, userId, session);

      if (transactionalVisit.status === 'READY_FOR_CONSULTATION') {
        const updated = await this.visitRepository.updateStatusIf(
          transactionalVisit.id,
          ['READY_FOR_CONSULTATION'],
          { notes: 'Doctor consultation started.', status: 'IN_CONSULTATION' },
          userId,
          session,
          transactionalVisit.version,
        );
        if (!updated) throw new AppError('The OPD visit status changed after it was loaded', 409, 'OPD_VISIT_STATUS_CONFLICT');
      }
      return consultation;
    });
  }

  async complete(visitId: string, data: SaveOpdConsultationDTO, userId: string) {
    const visit = await this.getVisit(visitId, userId);
    this.ensureOpenVisit(visit);
    this.ensureConsultationReady(visit);
    await this.ensureVitalsRecorded(visit.id);
    const current = await this.repository.getByVisit(visitId);
    this.assertExpectedState(data, current?.version ?? 0, current?.status ?? 'DRAFT');
    const scope = await this.visitRepository.resolveBranchScope(userId);

    return executeRequiredTransaction(this.visitRepository, async (session) => {
      const transactionalVisit = await this.visitRepository.getById(visitId, scope, session);
      if (!transactionalVisit) throw new AppError('OPD visit not found', 404, 'NOT_FOUND');
      this.ensureOpenVisit(transactionalVisit);
      this.ensureConsultationReady(transactionalVisit);
      const transactionalCurrent = await this.repository.getByVisit(visitId, session);
      this.assertExpectedState(
        data,
        transactionalCurrent?.version ?? 0,
        transactionalCurrent?.status ?? 'DRAFT',
      );

      const consultation = await this.repository.saveForVisit({
        ...data,
        completedAt: new Date(),
        status: 'COMPLETED',
        visit: transactionalVisit,
        currentVersion: transactionalCurrent?.version ?? 0,
        currentStatus: transactionalCurrent?.status,
      }, userId, session);

      const completedVisit = await this.visitRepository.updateStatusIf(
        transactionalVisit.id,
        [transactionalVisit.status],
        { notes: data.assessment ?? 'Doctor consultation completed.', status: 'COMPLETED' },
        userId,
        session,
        transactionalVisit.version,
      );
      if (!completedVisit) throw new AppError('The OPD visit status changed after it was loaded', 409, 'OPD_VISIT_STATUS_CONFLICT');

      if (transactionalVisit.appointment_id) {
        const completedAppointment = await this.appointmentRepository.updateStatus(
          transactionalVisit.appointment_id,
          { status: 'COMPLETED', notes: 'Consultation completed by doctor.' },
          userId,
          undefined,
          session,
        );
        if (!completedAppointment) {
          throw new AppError('Linked appointment not found', 409, 'OPD_APPOINTMENT_CONFLICT');
        }
      }

      await this.patientRepository.addTimelineEvent(
        transactionalVisit.patient_id,
        {
          event_type: 'OPD_CONSULTATION_COMPLETED',
          title: 'OPD consultation completed',
          description: `${transactionalVisit.visit_number}: ${data.assessment?.trim() ?? 'Clinical assessment recorded'}.`,
        },
        userId,
        session,
      );

      await this.patientRepository.auditClinicalEvent('opd.consultation.completed', userId, {
        consultationId: consultation.id,
        patientId: transactionalVisit.patient_id,
        visitId: transactionalVisit.id,
        visitNumber: transactionalVisit.visit_number,
        previousStatus: transactionalCurrent?.status ?? null,
        previousVersion: transactionalCurrent?.version ?? 0,
        resultingStatus: consultation.status,
        resultingVersion: consultation.version,
      }, session);
      return consultation;
    });
  }

  private assertExpectedState(
    data: SaveOpdConsultationDTO,
    currentVersion: number,
    currentStatus: 'DRAFT' | 'COMPLETED',
  ) {
    if (data.expected_version !== undefined && data.expected_version !== currentVersion) {
      throw new AppError('The consultation changed after it was loaded', 409, 'OPD_CONSULTATION_VERSION_CONFLICT');
    }
    if (data.expected_status !== undefined && data.expected_status !== currentStatus) {
      throw new AppError('The consultation status changed after it was loaded', 409, 'OPD_CONSULTATION_STATUS_CONFLICT');
    }
  }

  private ensureDraftEditable(status?: 'DRAFT' | 'COMPLETED') {
    if (status === 'COMPLETED') {
      throw new AppError('A completed consultation cannot be edited', 409, 'OPD_CONSULTATION_STATUS_CONFLICT');
    }
  }

  private async getVisit(visitId: string, userId: string) {
    this.validateId(visitId, 'OPD visit id is invalid');
    const scope = await this.visitRepository.resolveBranchScope(userId);
    const visit = await this.visitRepository.getById(visitId, scope);

    if (!visit) {
      throw new AppError('OPD visit not found', 404, 'NOT_FOUND');
    }

    return visit;
  }

  private ensureOpenVisit(visit: OpdVisit) {
    if (terminalVisitStatuses.includes(visit.status)) {
      throw new AppError('Consultation cannot be updated for a closed OPD visit', 400, 'VISIT_CLOSED');
    }
  }

  private ensureConsultationReady(visit: OpdVisit) {
    if (!['READY_FOR_CONSULTATION', 'IN_CONSULTATION'].includes(visit.status)) {
      throw new AppError('Patient must complete the vitals handoff before consultation', 400, 'VISIT_NOT_READY_FOR_CONSULTATION');
    }
  }

  private async ensureVitalsRecorded(visitId: string) {
    const latestVitals = await this.vitalsRepository.getLatestByVisit(visitId);

    if (!latestVitals) {
      throw new AppError('Vitals must be recorded before completing consultation', 400, 'VITALS_REQUIRED');
    }
  }

  private validateId(id: string | null | undefined, message: string) {
    if (!isObjectId(id)) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }
}
