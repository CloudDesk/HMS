import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { DepartmentRepository } from '../departments/department.repository.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { OpdClinicalOrderRepository } from './opd-clinical-order.repository.js';
import type { ClinicalOrderType, SaveOpdClinicalOrderDTO } from './opd-clinical-order.types.js';
import type { OpdConsultationRepository } from './opd-consultation.repository.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';
import type { ServiceRepository } from '../services/service.repository.js';
import type { ClinicalSourceContext } from './clinical-context.types.js';
import type { OpdClinicalOrder } from './opd-clinical-order.types.js';
import { isDentalClinicalContext } from './opd-dental-examination.service.js';
import { isValidFdiTooth } from './opd-dental-examination.schemas.js';
import { dentalImagingDraftSchema } from './opd-clinical-order.schemas.js';

const terminalVisitStatuses: OpdVisit['status'][] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

export class OpdClinicalOrderService {
  constructor(
    private readonly repository: OpdClinicalOrderRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly consultationRepository: OpdConsultationRepository,
    private readonly patientRepository: PatientRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  async getByVisitAndType(visitId: string, orderType: ClinicalOrderType, userId: string) {
    await this.getVisit(visitId, userId, orderType);
    return this.repository.getByVisitAndType(visitId, orderType);
  }

  async saveDraft(visitId: string, orderType: ClinicalOrderType, data: SaveOpdClinicalOrderDTO, userId: string) {
    const visit = await this.getVisit(visitId, userId, orderType);
    this.ensureOpenVisit(visit);
    const consultation = await this.getOrCreateConsultation(visit, userId);
    const current = await this.repository.getByVisitAndType(visitId, orderType);
    this.assertVersion(current, data);

    if (current && current.status !== 'DRAFT') {
      throw new AppError('A submitted clinical order cannot be edited', 400, 'CLINICAL_ORDER_SUBMITTED');
    }

    this.validateLaboratoryFields(orderType, data);
    await this.validateToothAssociation(orderType, data, visit);
    const items = await this.normalizeServices(orderType, data, await this.isDental(visit));
    return this.repository.saveForVisit({ ...data, expected_updated_at: current?.updated_at.toISOString(), items, consultation, orderType, status: 'DRAFT', visit }, userId);
  }

  async submit(visitId: string, orderType: ClinicalOrderType, data: SaveOpdClinicalOrderDTO, userId: string) {
    const visit = await this.getVisit(visitId, userId, orderType);
    this.ensureOpenVisit(visit, true);
    const consultation = await this.getConsultation(visitId);
    const current = await this.repository.getByVisitAndType(visitId, orderType);

    if (current && current.status !== 'DRAFT') {
      return current;
    }
    this.assertVersion(current, data);

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
    await this.validateToothAssociation(orderType, data, visit);
    const items = await this.normalizeServices(orderType, data, await this.isDental(visit));
    const order = await this.repository.saveForVisit(
      { ...data, expected_updated_at: current?.updated_at.toISOString(), items, consultation, orderType, status: 'SUBMITTED', submittedAt: new Date(), visit },
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
        description: `${sourceLabel} ${visit.visit_number} · ${isLaboratory ? 'Tests' : 'Studies'}: ${items.map((item) =>
          `${item.investigation_name}${item.tooth_number ? ` (Tooth #${item.tooth_number})` : ''}`
        ).join(', ')} · Priority: ${data.priority} · Doctor: ${visit.doctor_name}`,
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
    session?: ClientSession,
  ) {
    if (data.items.length === 0) throw new AppError('Add at least one investigation before submitting', 400, 'INVESTIGATION_REQUIRED');
    this.validateLaboratoryFields(orderType, data);
    await this.validateToothAssociation(orderType, data);
    const items = await this.normalizeServices(orderType, data);
    const normalized = { ...data, items };
    const current = await this.repository.getBySourceAndType(context.source_type, context.source_id, orderType, session);
    if (current) {
      if (current.status === 'SUBMITTED' && this.sameClinicalOrder(current, normalized)) return current;
      throw new AppError('A different clinical order already exists for this source and department', 409, 'CONTEXT_CLINICAL_ORDER_CONFLICT');
    }
    return this.repository.submitForContext(context, orderType, normalized, actor, session);
  }

  async listByEpisode(episodeId: string, orderType: ClinicalOrderType = 'IMAGING') {
    return this.repository.listByEpisode(episodeId, orderType);
  }

  async authorizeDentalImagingReport(orderId: string, userId: string) {
    const scope = await this.repository.resolveBranchScope(userId);
    const order = await this.repository.getOperationalById(orderId, 'IMAGING', scope);
    if (!order) {
      throw new AppError('Dental imaging order not found', 404, 'IMAGING_ORDER_NOT_FOUND');
    }
    if (order.visit_id) {
      try {
        const visit = await this.getVisit(order.visit_id, userId, 'IMAGING');
        if ((await this.isDental(visit)) && order.patient_id === visit.patient_id &&
            order.branch_id === visit.branch_id && order.doctor_id === visit.doctor_id) {
          return;
        }
      } catch {
        // Fall through to episode check
      }
    }
    if (order.dental_context?.treatment_episode_id) {
      return;
    }
    throw new AppError('Dental imaging order not found', 404, 'IMAGING_ORDER_NOT_FOUND');
  }

  async authorizeDentalLaboratoryResult(orderId: string, userId: string) {
    const scope = await this.repository.resolveBranchScope(userId);
    const order = await this.repository.getOperationalById(orderId, 'LABORATORY', scope);
    if (!order?.visit_id || order.source_type !== 'OPD_VISIT') {
      throw new AppError('Dental laboratory order not found', 404, 'LABORATORY_ORDER_NOT_FOUND');
    }
    const visit = await this.getVisit(order.visit_id, userId, 'LABORATORY');
    if (!(await this.isDental(visit)) || order.patient_id !== visit.patient_id ||
        order.branch_id !== visit.branch_id || order.doctor_id !== visit.doctor_id) {
      throw new AppError('Dental laboratory order not found', 404, 'LABORATORY_ORDER_NOT_FOUND');
    }
  }

  private assertVersion(current: OpdClinicalOrder | null, data: SaveOpdClinicalOrderDTO) {
    if (data.expected_updated_at !== undefined && (current?.updated_at.toISOString() ?? null) !== data.expected_updated_at) {
      throw new AppError('Clinical order changed; refresh and retry', 409, 'CLINICAL_ORDER_CONFLICT');
    }
  }

  private async isDental(visit: OpdVisit) {
    const department = visit.department_id && Types.ObjectId.isValid(visit.department_id)
      ? await this.departmentRepository.getById(visit.department_id) : null;
    return isDentalClinicalContext(visit.doctor_specialization || '', department ?? undefined);
  }

  private async getVisit(visitId: string, userId: string, orderType: ClinicalOrderType) {
    if (!Types.ObjectId.isValid(visitId)) {
      throw new AppError('OPD visit id is invalid', 400, 'VALIDATION_ERROR');
    }
    const scope = await this.visitRepository.resolveBranchScope(userId);
    const visit = await this.visitRepository.getById(visitId, scope);
    if (!visit) throw new AppError('OPD visit not found', 404, 'NOT_FOUND');
    if (orderType === 'IMAGING' && await this.isDental(visit)) {
      const actor = await this.repository.getClinicalActor(userId);
      if (!actor.isSuperAdmin) {
        if (actor.departmentIds.length && !actor.departmentIds.includes(visit.department_id)) {
          throw new AppError('Department access denied', 403, 'DEPARTMENT_ACCESS_DENIED');
        }
        if (actor.doctor && (String(actor.doctor.departmentId) !== visit.department_id ||
            String(actor.doctor.branchId) !== visit.branch_id || String(actor.doctor._id) !== visit.doctor_id)) {
          throw new AppError('Doctor access denied for this visit', 403, 'DOCTOR_ACCESS_DENIED');
        }
      }
    }
    return visit;
  }

  private async getConsultation(visitId: string) {
    const consultation = await this.consultationRepository.getByVisit(visitId);
    if (!consultation) {
      throw new AppError('Start the consultation before creating clinical orders', 400, 'CONSULTATION_REQUIRED');
    }
    return consultation;
  }

  private async getOrCreateConsultation(visit: OpdVisit, userId: string) {
    let consultation = await this.consultationRepository.getByVisit(visit.id);
    if (!consultation) {
      if (['READY_FOR_CONSULTATION', 'IN_CONSULTATION'].includes(visit.status)) {
        consultation = await this.consultationRepository.saveForVisit(
          {
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
          visit.status = 'IN_CONSULTATION';
        }
      } else {
        throw new AppError('Start the consultation before creating clinical orders', 400, 'CONSULTATION_REQUIRED');
      }
    } else if (consultation.status === 'COMPLETED') {
      throw new AppError('Clinical orders cannot be modified after consultation is completed', 400, 'CONSULTATION_COMPLETED');
    } else if (visit.status === 'READY_FOR_CONSULTATION') {
      await this.visitRepository.updateStatus(
        visit.id,
        {
          notes: 'Doctor consultation started.',
          status: 'IN_CONSULTATION',
        },
        userId,
      );
      visit.status = 'IN_CONSULTATION';
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
      data.specimen_type = 'Blood';
    }
  }

  private async validateToothAssociation(orderType: ClinicalOrderType, data: SaveOpdClinicalOrderDTO, visit?: OpdVisit) {
    const hasTooth = data.items.some((item) => item.tooth_number !== undefined && item.tooth_number !== null);
    if (!hasTooth) return;

    if (orderType !== 'IMAGING') {
      throw new AppError('Tooth number is only applicable for imaging orders', 400, 'VALIDATION_ERROR');
    }

    if (!visit) {
      throw new AppError('Tooth number requires a verified dental OPD visit', 400, 'DENTAL_VISIT_REQUIRED');
    }

    if (visit) {
      let department: { code: string; name: string } | null = null;
      if (visit.department_id && Types.ObjectId.isValid(visit.department_id)) {
        department = (await this.departmentRepository.getById(visit.department_id)) ?? null;
      }
      const isDental = isDentalClinicalContext(visit.doctor_specialization || '', department || undefined);
      if (!isDental) {
        throw new AppError('Tooth number is only allowed for dental visits', 400, 'DENTAL_VISIT_REQUIRED');
      }
    }

    for (const item of data.items) {
      if (item.tooth_number !== undefined && item.tooth_number !== null) {
        if (!isValidFdiTooth(Number(item.tooth_number))) {
          throw new AppError('Imaging order contains an invalid FDI tooth number', 400, 'INVALID_FDI_TOOTH');
        }
      }
    }
  }

  private async normalizeServices(orderType: ClinicalOrderType, data: SaveOpdClinicalOrderDTO, dentalImaging = false) {
    if (dentalImaging) {
      const parsed = dentalImagingDraftSchema.safeParse(data);
      if (!parsed.success) throw new AppError('Imaging request validation failed', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const ids = [...new Set(data.items.map((item) => item.service_id))];
    if (ids.length !== data.items.length) {
      throw new AppError('A service can only be added once to an order', 400, 'DUPLICATE_SERVICE');
    }
    const serviceType = orderType === 'LABORATORY' ? 'LAB_TEST' : 'IMAGING_SERVICE';
    let services: Array<{ _id: unknown; name: string }> = await this.serviceRepository.getActiveClinicalOrderServices(ids, serviceType);
    if (services.length !== ids.length && !dentalImaging) {
      services = await this.serviceRepository.getActiveBillingServices(ids);
    }
    if (services.length !== ids.length) {
      throw new AppError(
        `All order items must reference active ${serviceType === 'LAB_TEST' ? 'laboratory' : 'imaging'} services`,
        400,
        'INVALID_CLINICAL_ORDER_SERVICE',
      );
    }
    const names = new Map(services.map((service) => [String(service._id), service.name]));
    return data.items.map((item) => ({
      ...item,
      investigation_name: names.get(item.service_id) || item.investigation_name,
    }));
  }

  private sameClinicalOrder(current: OpdClinicalOrder, data: SaveOpdClinicalOrderDTO) {
    const normalize = (value?: string | null) => value?.trim() || null;
    if (current.items.length !== data.items.length) return false;
    const itemsMatch = current.items.every((item, index) => {
      const requested = data.items[index];
      return requested != null && item.service_id === requested.service_id
        && item.investigation_name === requested.investigation_name.trim()
        && item.category === requested.category.trim()
        && (item.tooth_number ?? null) === (requested.tooth_number ?? null);
    });
    return itemsMatch && current.priority === data.priority && current.destination === normalize(data.destination)
      && current.specimen_type === normalize(data.specimen_type)
      && current.clinical_notes === normalize(data.clinical_notes)
      && current.instructions === normalize(data.instructions);
  }
}
