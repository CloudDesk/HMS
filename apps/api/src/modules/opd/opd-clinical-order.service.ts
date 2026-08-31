import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { OpdClinicalOrderRepository } from './opd-clinical-order.repository.js';
import type { ClinicalOrderType, SaveOpdClinicalOrderDTO } from './opd-clinical-order.types.js';
import type { OpdConsultationRepository } from './opd-consultation.repository.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';
import type { ServiceRepository } from '../services/service.repository.js';
import type { ClinicalSourceContext } from './clinical-context.types.js';
import type { OpdClinicalOrder } from './opd-clinical-order.types.js';

const terminalVisitStatuses: OpdVisit['status'][] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

export class OpdClinicalOrderService {
  constructor(
    private readonly repository: OpdClinicalOrderRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly consultationRepository: OpdConsultationRepository,
    private readonly patientRepository: PatientRepository,
    private readonly serviceRepository: ServiceRepository,
  ) {}

  async getByVisitAndType(visitId: string, orderType: ClinicalOrderType, userId: string) {
    await this.getVisit(visitId, userId);
    return this.repository.getByVisitAndType(visitId, orderType);
  }

  async saveDraft(visitId: string, orderType: ClinicalOrderType, data: SaveOpdClinicalOrderDTO, userId: string) {
    const visit = await this.getVisit(visitId, userId);
    this.ensureOpenVisit(visit);
    const consultation = await this.getConsultation(visitId);
    const current = await this.repository.getByVisitAndType(visitId, orderType);

    if (current && current.status !== 'DRAFT') {
      throw new AppError('A submitted clinical order cannot be edited', 400, 'CLINICAL_ORDER_SUBMITTED');
    }

    this.validateLaboratoryFields(orderType, data);
    const items = await this.normalizeServices(orderType, data);
    return this.repository.saveForVisit({ ...data, items, consultation, orderType, status: 'DRAFT', visit }, userId);
  }

  async submit(visitId: string, orderType: ClinicalOrderType, data: SaveOpdClinicalOrderDTO, userId: string) {
    const visit = await this.getVisit(visitId, userId);
    this.ensureOpenVisit(visit, true);
    const consultation = await this.getConsultation(visitId);
    const current = await this.repository.getByVisitAndType(visitId, orderType);

    if (current && current.status !== 'DRAFT') {
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
    const items = await this.normalizeServices(orderType, data);
    const order = await this.repository.saveForVisit(
      { ...data, items, consultation, orderType, status: 'SUBMITTED', submittedAt: new Date(), visit },
      userId,
    );

    const isLaboratory = orderType === 'LABORATORY';
    const sourceLabel = order.source_type === 'EMERGENCY_ENCOUNTER'
      ? 'Emergency encounter'
      : 'OPD encounter';
    await this.patientRepository.addTimelineEvent(
      visit.patient_id,
      {
        event_type: isLaboratory ? 'OPD_LAB_ORDER_SUBMITTED' : 'OPD_IMAGING_ORDER_SUBMITTED',
        title: isLaboratory ? 'Laboratory order submitted' : 'Imaging order submitted',
        description: `${sourceLabel} ${visit.visit_number}: ${data.items.length} ${isLaboratory ? 'laboratory' : 'imaging'} investigation${data.items.length === 1 ? '' : 's'} ordered by ${visit.doctor_name}.`,
      },
      userId,
    );

    await this.patientRepository.auditClinicalEvent('opd.clinical_order.submitted', userId, {
      itemCount: data.items.length,
      orderId: order.id,
      orderType,
      patientId: visit.patient_id,
      visitId: visit.id,
      sourceType: order.source_type,
      encounterId: order.visit_id ?? order.source_id,
      admissionId: null,
      procedureId: null,
    });

    return order;
  }

  async getForContext(
    context: Pick<ClinicalSourceContext, 'source_type' | 'source_id'>,
    orderType: ClinicalOrderType,
    session?: ClientSession,
  ) {
    return this.repository.getBySourceAndType(context.source_type, context.source_id, orderType, session);
  }

  async submitForContext(
    context: ClinicalSourceContext,
    orderType: ClinicalOrderType,
    data: SaveOpdClinicalOrderDTO,
    actor: string,
    session: ClientSession,
  ) {
    if (data.items.length === 0) throw new AppError('Add at least one investigation before submitting', 400, 'INVESTIGATION_REQUIRED');
    this.validateLaboratoryFields(orderType, data);
    const items = await this.normalizeServices(orderType, data);
    const normalized = { ...data, items };
    const current = await this.repository.getBySourceAndType(context.source_type, context.source_id, orderType, session);
    if (current) {
      if (current.status === 'SUBMITTED' && this.sameClinicalOrder(current, normalized)) return current;
      throw new AppError('A different clinical order already exists for this source and department', 409, 'CONTEXT_CLINICAL_ORDER_CONFLICT');
    }
    return this.repository.submitForContext(context, orderType, normalized, actor, session);
  }

  private async getVisit(visitId: string, userId: string) {
    if (!Types.ObjectId.isValid(visitId)) {
      throw new AppError('OPD visit id is invalid', 400, 'VALIDATION_ERROR');
    }
    const scope = await this.visitRepository.resolveBranchScope(userId);
    const visit = await this.visitRepository.getById(visitId, scope);
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

  private ensureOpenVisit(visit: OpdVisit, allowCompleted = false) {
    const closed = allowCompleted
      ? (['CANCELLED', 'NO_SHOW'] as OpdVisit['status'][])
      : terminalVisitStatuses;
    if (closed.includes(visit.status)) {
      throw new AppError('Clinical orders cannot be updated for a closed OPD visit', 400, 'VISIT_CLOSED');
    }
  }

  private validateLaboratoryFields(orderType: ClinicalOrderType, data: SaveOpdClinicalOrderDTO) {
    if (orderType === 'LABORATORY' && data.items.length > 0 && !data.specimen_type?.trim()) {
      throw new AppError('Specimen type is required for laboratory orders', 400, 'SPECIMEN_TYPE_REQUIRED');
    }
  }

  private async normalizeServices(orderType: ClinicalOrderType, data: SaveOpdClinicalOrderDTO) {
    const ids = [...new Set(data.items.map((item) => item.service_id))];
    if (ids.length !== data.items.length) {
      throw new AppError('A service can only be added once to an order', 400, 'DUPLICATE_SERVICE');
    }
    const serviceType = orderType === 'LABORATORY' ? 'LAB_TEST' : 'IMAGING_SERVICE';
    const services = await this.serviceRepository.getActiveClinicalOrderServices(ids, serviceType);
    if (services.length !== ids.length) {
      throw new AppError(
        `All order items must reference active ${serviceType === 'LAB_TEST' ? 'laboratory' : 'imaging'} services`,
        400,
        'INVALID_CLINICAL_ORDER_SERVICE',
      );
    }
    const names = new Map(services.map((service) => [String(service._id), service.name]));
    return data.items.map((item) => ({ ...item, investigation_name: names.get(item.service_id)! }));
  }

  private sameClinicalOrder(current: OpdClinicalOrder, data: SaveOpdClinicalOrderDTO) {
    const normalize = (value?: string | null) => value?.trim() || null;
    if (current.items.length !== data.items.length) return false;
    const itemsMatch = current.items.every((item, index) => {
      const requested = data.items[index];
      return requested != null && item.service_id === requested.service_id
        && item.investigation_name === requested.investigation_name.trim()
        && item.category === requested.category.trim();
    });
    return itemsMatch && current.priority === data.priority && current.destination === normalize(data.destination)
      && current.specimen_type === normalize(data.specimen_type)
      && current.clinical_notes === normalize(data.clinical_notes)
      && current.instructions === normalize(data.instructions);
  }
}
