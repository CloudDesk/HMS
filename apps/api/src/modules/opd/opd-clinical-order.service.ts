import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { OpdClinicalOrderRepository } from './opd-clinical-order.repository.js';
import type { ClinicalOrderType, SaveOpdClinicalOrderDTO } from './opd-clinical-order.types.js';
import type { OpdConsultationRepository } from './opd-consultation.repository.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';

const terminalVisitStatuses: OpdVisit['status'][] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

export class OpdClinicalOrderService {
  constructor(
    private readonly repository: OpdClinicalOrderRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly consultationRepository: OpdConsultationRepository,
    private readonly patientRepository: PatientRepository,
  ) {}

  async getByVisitAndType(visitId: string, orderType: ClinicalOrderType) {
    await this.getVisit(visitId);
    return this.repository.getByVisitAndType(visitId, orderType);
  }

  async saveDraft(visitId: string, orderType: ClinicalOrderType, data: SaveOpdClinicalOrderDTO, userId: string) {
    const visit = await this.getVisit(visitId);
    this.ensureOpenVisit(visit);
    const consultation = await this.getConsultation(visitId);
    const current = await this.repository.getByVisitAndType(visitId, orderType);

    if (current?.status === 'SUBMITTED') {
      throw new AppError('A submitted clinical order cannot be edited', 400, 'CLINICAL_ORDER_SUBMITTED');
    }

    this.validateLaboratoryFields(orderType, data);
    return this.repository.saveForVisit({ ...data, consultation, orderType, status: 'DRAFT', visit }, userId);
  }

  async submit(visitId: string, orderType: ClinicalOrderType, data: SaveOpdClinicalOrderDTO, userId: string) {
    const visit = await this.getVisit(visitId);
    this.ensureOpenVisit(visit);
    const consultation = await this.getConsultation(visitId);
    const current = await this.repository.getByVisitAndType(visitId, orderType);

    if (current?.status === 'SUBMITTED') {
      throw new AppError('Clinical order has already been submitted', 400, 'CLINICAL_ORDER_SUBMITTED');
    }

    if (consultation.status !== 'COMPLETED') {
      throw new AppError(
        'Complete the consultation before submitting clinical orders',
        400,
        'CONSULTATION_NOT_COMPLETED',
      );
    }

    if (data.items.length === 0) {
      throw new AppError('Add at least one investigation before submitting', 400, 'INVESTIGATION_REQUIRED');
    }

    this.validateLaboratoryFields(orderType, data);
    const order = await this.repository.saveForVisit(
      { ...data, consultation, orderType, status: 'SUBMITTED', submittedAt: new Date(), visit },
      userId,
    );

    const isLaboratory = orderType === 'LABORATORY';
    await this.patientRepository.addTimelineEvent(
      visit.patient_id,
      {
        event_type: isLaboratory ? 'OPD_LAB_ORDER_SUBMITTED' : 'OPD_IMAGING_ORDER_SUBMITTED',
        title: isLaboratory ? 'Laboratory order submitted' : 'Imaging order submitted',
        description: `${visit.visit_number}: ${data.items.length} ${isLaboratory ? 'laboratory' : 'imaging'} investigation${data.items.length === 1 ? '' : 's'} ordered by ${visit.doctor_name}.`,
      },
      userId,
    );

    await this.patientRepository.auditClinicalEvent('opd.clinical_order.submitted', userId, {
      itemCount: data.items.length,
      orderId: order.id,
      orderType,
      patientId: visit.patient_id,
      visitId: visit.id,
    });

    return order;
  }

  private async getVisit(visitId: string) {
    if (!Types.ObjectId.isValid(visitId)) {
      throw new AppError('OPD visit id is invalid', 400, 'VALIDATION_ERROR');
    }
    const visit = await this.visitRepository.getById(visitId);
    if (!visit) throw new AppError('OPD visit not found', 404, 'NOT_FOUND');
    return visit;
  }

  private async getConsultation(visitId: string) {
    const consultation = await this.consultationRepository.getByVisit(visitId);
    if (!consultation) {
      throw new AppError('Start the consultation before creating clinical orders', 400, 'CONSULTATION_REQUIRED');
    }
    return consultation;
  }

  private ensureOpenVisit(visit: OpdVisit) {
    if (terminalVisitStatuses.includes(visit.status)) {
      throw new AppError('Clinical orders cannot be updated for a closed OPD visit', 400, 'VISIT_CLOSED');
    }
  }

  private validateLaboratoryFields(orderType: ClinicalOrderType, data: SaveOpdClinicalOrderDTO) {
    if (orderType === 'LABORATORY' && data.items.length > 0 && !data.specimen_type?.trim()) {
      throw new AppError('Specimen type is required for laboratory orders', 400, 'SPECIMEN_TYPE_REQUIRED');
    }
  }
}
