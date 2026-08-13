import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { AppointmentService } from '../appointments/appointment.service.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { OpdConsultationRepository } from './opd-consultation.repository.js';
import type { OpdFollowUpRepository } from './opd-follow-up.repository.js';
import type { SaveOpdFollowUpDTO } from './opd-follow-up.types.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';

const terminalVisitStatuses: OpdVisit['status'][] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

export class OpdFollowUpService {
  constructor(
    private readonly repository: OpdFollowUpRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly consultationRepository: OpdConsultationRepository,
    private readonly appointmentService: AppointmentService,
    private readonly patientRepository: PatientRepository,
  ) {}

  async getByVisit(visitId: string) {
    await this.getVisit(visitId);
    return this.repository.getByVisit(visitId);
  }

  async saveDraft(visitId: string, data: SaveOpdFollowUpDTO, userId: string) {
    const visit = await this.getVisit(visitId);
    this.ensureOpenVisit(visit);
    const consultation = await this.getConsultation(visitId);
    const current = await this.repository.getByVisit(visitId);
    if (current?.status === 'SCHEDULED') {
      throw new AppError('A scheduled follow-up cannot be edited here', 400, 'FOLLOW_UP_SCHEDULED');
    }
    return this.repository.saveForVisit({ ...data, consultation, status: 'DRAFT', visit }, userId);
  }

  async schedule(visitId: string, data: SaveOpdFollowUpDTO, userId: string) {
    const visit = await this.getVisit(visitId);
    this.ensureOpenVisit(visit);
    const consultation = await this.getConsultation(visitId);
    if (consultation.status !== 'COMPLETED') {
      throw new AppError('Complete the consultation before scheduling follow-up', 400, 'CONSULTATION_NOT_COMPLETED');
    }
    const current = await this.repository.getByVisit(visitId);
    if (current?.status === 'SCHEDULED') {
      throw new AppError('Follow-up has already been scheduled', 400, 'FOLLOW_UP_SCHEDULED');
    }
    this.validateSchedule(data);

    const appointment = await this.appointmentService.create(
      {
        patient_id: visit.patient_id,
        doctor_id: data.assigned_doctor_id!,
        appointment_date: data.next_visit_date!,
        start_time: data.start_time!,
        duration_minutes: data.duration_minutes!,
        visit_type: 'FOLLOW_UP',
        priority: 'ROUTINE',
        reason: data.reason,
        notes: `Follow-up generated from OPD visit ${visit.visit_number}. ${data.notes?.trim() ?? ''}`.trim(),
      },
      userId,
    );

    const followUp = await this.repository.saveForVisit(
      {
        ...data,
        appointment,
        assignedDoctorName: appointment.doctor_name,
        consultation,
        scheduledAt: new Date(),
        status: 'SCHEDULED',
        visit,
      },
      userId,
    );

    await this.patientRepository.addTimelineEvent(
      visit.patient_id,
      {
        event_type: 'OPD_FOLLOW_UP_SCHEDULED',
        title: 'OPD follow-up scheduled',
        description: `${appointment.appointment_number}: follow-up with ${appointment.doctor_name} on ${data.next_visit_date} at ${data.start_time}.`,
      },
      userId,
    );
    await this.patientRepository.auditClinicalEvent('opd.follow_up.scheduled', userId, {
      appointmentId: appointment.id,
      followUpId: followUp.id,
      patientId: visit.patient_id,
      visitId: visit.id,
    });
    return followUp;
  }

  private validateSchedule(data: SaveOpdFollowUpDTO) {
    if (!data.follow_up_type || !data.next_visit_date || !data.start_time || !data.duration_minutes || !data.assigned_doctor_id) {
      throw new AppError('Follow-up type, date, time, duration and doctor are required', 400, 'VALIDATION_ERROR');
    }
    if (!data.reason?.trim()) {
      throw new AppError('Follow-up reason is required', 400, 'VALIDATION_ERROR');
    }
  }

  private async getVisit(visitId: string) {
    if (!Types.ObjectId.isValid(visitId)) throw new AppError('OPD visit id is invalid', 400, 'VALIDATION_ERROR');
    const visit = await this.visitRepository.getById(visitId);
    if (!visit) throw new AppError('OPD visit not found', 404, 'NOT_FOUND');
    return visit;
  }

  private async getConsultation(visitId: string) {
    const consultation = await this.consultationRepository.getByVisit(visitId);
    if (!consultation) throw new AppError('Start the consultation before planning follow-up', 400, 'CONSULTATION_REQUIRED');
    return consultation;
  }

  private ensureOpenVisit(visit: OpdVisit) {
    if (terminalVisitStatuses.includes(visit.status)) {
      throw new AppError('Follow-up cannot be changed for a closed OPD visit', 400, 'VISIT_CLOSED');
    }
  }
}
