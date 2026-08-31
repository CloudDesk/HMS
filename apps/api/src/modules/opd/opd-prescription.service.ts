import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { OpdConsultationRepository } from './opd-consultation.repository.js';
import type { OpdPrescriptionRepository } from './opd-prescription.repository.js';
import type { SaveOpdPrescriptionDTO } from './opd-prescription.types.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';
import type { ClinicalSourceContext } from './clinical-context.types.js';
import type { OpdPrescription } from './opd-prescription.types.js';

const terminalVisitStatuses: OpdVisit['status'][] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

export class OpdPrescriptionService {
  constructor(
    private readonly repository: OpdPrescriptionRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly consultationRepository: OpdConsultationRepository,
    private readonly patientRepository: PatientRepository,
  ) {}

  async getByVisit(visitId: string, userId: string) {
    await this.getVisit(visitId, userId);
    return this.repository.getByVisit(visitId);
  }

  async saveDraft(visitId: string, data: SaveOpdPrescriptionDTO, userId: string) {
    const visit = await this.getVisit(visitId, userId);
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
    const visit = await this.getVisit(visitId, userId);
    this.ensureOpenVisit(visit, true);
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

  async list(params: import('./opd-prescription.types.js').ListPrescriptionsParams, userId: string) {
    const scope = await this.visitRepository.resolveBranchScope(userId);
    return this.repository.list(params, scope);
  }

  async getForContext(context: Pick<ClinicalSourceContext, 'source_type' | 'source_id'>, session?: ClientSession) {
    return this.repository.getBySource(context.source_type, context.source_id, session);
  }

  async submitForContext(context: ClinicalSourceContext, data: SaveOpdPrescriptionDTO, actor: string, session: ClientSession) {
    if (data.items.length === 0) throw new AppError('Add at least one medication before submitting', 400, 'MEDICATION_REQUIRED');
    this.validateFollowUpDate(data.follow_up_date);
    const current = await this.repository.getBySource(context.source_type, context.source_id, session);
    if (current) {
      if (current.status === 'SUBMITTED' && this.samePrescription(current, data)) return current;
      throw new AppError('A different prescription already exists for this clinical context', 409, 'CONTEXT_PRESCRIPTION_CONFLICT');
    }
    return this.repository.submitForContext(context, data, actor, session);
  }

  async updateStatusIf(id: string, currentStatus: import('./opd-prescription.types.js').OpdPrescriptionStatus, newStatus: import('./opd-prescription.types.js').OpdPrescriptionStatus, actor: string, session?: import('mongoose').ClientSession) {
    const prescription = await this.repository.getById(id);
    if (!prescription) throw new AppError('Prescription not found', 404, 'PRESCRIPTION_NOT_FOUND');
    if (prescription.visit_id) await this.getVisit(prescription.visit_id, actor);
    else {
      const scope = await this.visitRepository.resolveBranchScope(actor, prescription.branch_id);
      if (scope && !scope.includes(prescription.branch_id)) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    }
    return this.repository.updateStatusIf(id, currentStatus, newStatus, actor, session);
  }

  private async getVisit(visitId: string, userId: string) {
    if (!Types.ObjectId.isValid(visitId)) {
      throw new AppError('OPD visit id is invalid', 400, 'VALIDATION_ERROR');
    }

    const scope = await this.visitRepository.resolveBranchScope(userId);
    const visit = await this.visitRepository.getById(visitId, scope);
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

  private ensureOpenVisit(visit: OpdVisit, allowCompleted = false) {
    const closed = allowCompleted
      ? (['CANCELLED', 'NO_SHOW'] as OpdVisit['status'][])
      : terminalVisitStatuses;
    if (closed.includes(visit.status)) {
      throw new AppError('Prescription cannot be updated for a closed OPD visit', 400, 'VISIT_CLOSED');
    }
  }

  private validateFollowUpDate(value: string | null | undefined) {
    if (value && Number.isNaN(Date.parse(value))) {
      throw new AppError('Follow-up date is invalid', 400, 'VALIDATION_ERROR');
    }
  }

  private samePrescription(current: OpdPrescription, data: SaveOpdPrescriptionDTO) {
    const normalize = (value?: string | null) => value?.trim() || null;
    if (current.items.length !== data.items.length) return false;
    const itemsMatch = current.items.every((item, index) => {
      const requested = data.items[index];
      return requested != null && item.medicine_name === requested.medicine_name.trim()
        && item.strength === normalize(requested.strength) && item.dosage === requested.dosage.trim()
        && item.route === requested.route.trim() && item.frequency === requested.frequency.trim()
        && item.duration === requested.duration.trim() && item.quantity === (requested.quantity ?? null)
        && item.intake_time === normalize(requested.intake_time)
        && item.instructions === normalize(requested.instructions);
    });
    const followUp = data.follow_up_date ? new Date(data.follow_up_date).getTime() : null;
    return itemsMatch && (current.follow_up_date?.getTime() ?? null) === followUp
      && current.doctor_instructions === normalize(data.doctor_instructions)
      && current.patient_instructions === normalize(data.patient_instructions);
  }
}
