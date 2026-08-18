import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { OpdConsultationRepository } from './opd-consultation.repository.js';
import type { OpdPrescriptionRepository } from './opd-prescription.repository.js';
import type { SaveOpdPrescriptionDTO } from './opd-prescription.types.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';

const terminalVisitStatuses: OpdVisit['status'][] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

export class OpdPrescriptionService {
  constructor(
    private readonly repository: OpdPrescriptionRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly consultationRepository: OpdConsultationRepository,
    private readonly patientRepository: PatientRepository,
  ) {}

  async getByVisit(visitId: string) {
    await this.getVisit(visitId);
    return this.repository.getByVisit(visitId);
  }

  async saveDraft(visitId: string, data: SaveOpdPrescriptionDTO, userId: string) {
    const visit = await this.getVisit(visitId);
    this.ensureOpenVisit(visit);
    const consultation = await this.getConsultation(visitId);
    const current = await this.repository.getByVisit(visitId);

    if (current?.status === 'SUBMITTED') {
      throw new AppError('A submitted prescription cannot be edited', 400, 'PRESCRIPTION_SUBMITTED');
    }

    this.validateFollowUpDate(data.follow_up_date);
    return this.repository.saveForVisit({ ...data, consultation, status: 'DRAFT', visit }, userId);
  }

  async submit(visitId: string, data: SaveOpdPrescriptionDTO, userId: string) {
    const visit = await this.getVisit(visitId);
    this.ensureOpenVisit(visit);
    const consultation = await this.getConsultation(visitId);
    const current = await this.repository.getByVisit(visitId);

    if (current?.status === 'SUBMITTED') {
      throw new AppError('Prescription has already been submitted', 400, 'PRESCRIPTION_SUBMITTED');
    }

    if (consultation.status !== 'COMPLETED') {
      throw new AppError(
        'Complete the consultation before submitting a prescription',
        400,
        'CONSULTATION_NOT_COMPLETED',
      );
    }

    if (data.items.length === 0) {
      throw new AppError('Add at least one medication before submitting', 400, 'MEDICATION_REQUIRED');
    }

    this.validateFollowUpDate(data.follow_up_date);
    const prescription = await this.repository.saveForVisit(
      { ...data, consultation, status: 'SUBMITTED', submittedAt: new Date(), visit },
      userId,
    );

    await this.patientRepository.addTimelineEvent(
      visit.patient_id,
      {
        event_type: 'OPD_PRESCRIPTION_SUBMITTED',
        title: 'OPD prescription submitted',
        description: `${visit.visit_number}: ${data.items.length} medication${data.items.length === 1 ? '' : 's'} prescribed by ${visit.doctor_name}.`,
      },
      userId,
    );

    await this.patientRepository.auditClinicalEvent('opd.prescription.submitted', userId, {
      itemCount: data.items.length,
      patientId: visit.patient_id,
      prescriptionId: prescription.id,
      visitId: visit.id,
    });

    return prescription;
  }

  async list(params: import('./opd-prescription.types.js').ListPrescriptionsParams) {
    return this.repository.list(params);
  }

  async updateStatus(id: string, status: import('./opd-prescription.types.js').OpdPrescriptionStatus, userId: string) {
    if (status === 'DISPENSED' || status === 'CANCELLED') {
      throw new AppError('Prescription dispensing status is managed by the pharmacy workflow', 409, 'PRESCRIPTION_STATUS_MANAGED_BY_WORKFLOW');
    }
    return this.repository.updateStatus(id, status, userId);
  }

  private async getVisit(visitId: string) {
    if (!Types.ObjectId.isValid(visitId)) {
      throw new AppError('OPD visit id is invalid', 400, 'VALIDATION_ERROR');
    }

    const visit = await this.visitRepository.getById(visitId);
    if (!visit) {
      throw new AppError('OPD visit not found', 404, 'NOT_FOUND');
    }
    return visit;
  }

  private async getConsultation(visitId: string) {
    const consultation = await this.consultationRepository.getByVisit(visitId);
    if (!consultation) {
      throw new AppError('Start the consultation before creating a prescription', 400, 'CONSULTATION_REQUIRED');
    }
    return consultation;
  }

  private ensureOpenVisit(visit: OpdVisit) {
    if (terminalVisitStatuses.includes(visit.status)) {
      throw new AppError('Prescription cannot be updated for a closed OPD visit', 400, 'VISIT_CLOSED');
    }
  }

  private validateFollowUpDate(value: string | null | undefined) {
    if (value && Number.isNaN(Date.parse(value))) {
      throw new AppError('Follow-up date is invalid', 400, 'VALIDATION_ERROR');
    }
  }
}
