import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { AppointmentRepository } from '../appointments/appointment.repository.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { OpdConsultationRepository } from './opd-consultation.repository.js';
import type { SaveOpdConsultationDTO } from './opd-consultation.types.js';
import type { OpdVitalsRepository } from './opd-vitals.repository.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';

const terminalVisitStatuses: OpdVisit['status'][] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

const isObjectId = (value: string | null | undefined) => Boolean(value && Types.ObjectId.isValid(value));

const hasText = (value: string | null | undefined) => Boolean(value?.trim());

export class OpdConsultationService {
  constructor(
    private readonly repository: OpdConsultationRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly vitalsRepository: OpdVitalsRepository,
    private readonly patientRepository: PatientRepository,
    private readonly appointmentRepository: AppointmentRepository,
  ) {}

  async getByVisit(visitId: string) {
    await this.getVisit(visitId);
    return this.repository.getByVisit(visitId);
  }

  async saveDraft(visitId: string, data: SaveOpdConsultationDTO, userId: string) {
    const visit = await this.getVisit(visitId);
    this.ensureOpenVisit(visit);
    this.ensureConsultationReady(visit);

    const consultation = await this.repository.saveForVisit(
      {
        ...data,
        status: 'DRAFT',
        visit,
      },
      userId,
    );

    if (visit.status === 'READY_FOR_CONSULTATION') {
      await this.visitRepository.updateStatus(
        visit.id,
        {
          notes: 'Doctor consultation started.',
          status: 'IN_CONSULTATION',
        },
        userId,
      );
    }

    return consultation;
  }

  async complete(visitId: string, data: SaveOpdConsultationDTO, userId: string) {
    const visit = await this.getVisit(visitId);
    this.ensureOpenVisit(visit);
    this.ensureConsultationReady(visit);
    await this.ensureVitalsRecorded(visit.id);
    this.validateCompletion(data);

    const consultation = await this.repository.saveForVisit(
      {
        ...data,
        completedAt: new Date(),
        status: 'COMPLETED',
        visit,
      },
      userId,
    );



    await this.patientRepository.addTimelineEvent(
      visit.patient_id,
      {
        event_type: 'OPD_CONSULTATION_COMPLETED',
        title: 'OPD consultation completed',
        description: `${visit.visit_number}: ${data.assessment?.trim() ?? 'Clinical assessment recorded'}.`,
      },
      userId,
    );

    await this.patientRepository.auditClinicalEvent('opd.consultation.completed', userId, {
      consultationId: consultation.id,
      patientId: visit.patient_id,
      visitId: visit.id,
      visitNumber: visit.visit_number,
    });

    return consultation;
  }

  private async getVisit(visitId: string) {
    this.validateId(visitId, 'OPD visit id is invalid');
    const visit = await this.visitRepository.getById(visitId);

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

  private validateCompletion(_data: SaveOpdConsultationDTO) {
    // All consultation fields are optional
  }

  private validateId(id: string | null | undefined, message: string) {
    if (!isObjectId(id)) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }
}
