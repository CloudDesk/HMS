import mongoose, { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { OpdClinicalOrderRepository } from '../opd/opd-clinical-order.repository.js';
import type { ClinicalOrderRequestMetadata, OpdClinicalOrder } from '../opd/opd-clinical-order.types.js';
import type { ServiceRepository } from '../services/service.repository.js';
import type { LaboratoryRepository } from './laboratory.repository.js';
import type { LaboratoryOrderListQuery, SaveLaboratoryResultDTO, UpdateLaboratoryStatusDTO } from './laboratory.types.js';

const transitions: Partial<Record<OpdClinicalOrder['status'], UpdateLaboratoryStatusDTO['status']>> = {
  SUBMITTED: 'RECEIVED', RECEIVED: 'SAMPLE_COLLECTED', SAMPLE_COLLECTED: 'IN_PROGRESS',
  RESULT_ENTERED: 'VERIFIED', VERIFIED: 'COMPLETED',
};
const auditEvents: Record<UpdateLaboratoryStatusDTO['status'], string> = {
  RECEIVED: 'laboratory.order.received', SAMPLE_COLLECTED: 'laboratory.sample.collected',
  IN_PROGRESS: 'laboratory.order.in_progress', VERIFIED: 'laboratory.result.verified',
  COMPLETED: 'laboratory.order.completed',
};

export class LaboratoryService {
  constructor(
    private readonly orderRepository: OpdClinicalOrderRepository,
    private readonly repository: LaboratoryRepository,
    private readonly serviceRepository: ServiceRepository,
  ) {}

  async list(query: LaboratoryOrderListQuery, actorUserId: string) {
    const scope = await this.orderRepository.resolveBranchScope(actorUserId, query.branch_id);
    return this.orderRepository.listOperational('LABORATORY', query, scope);
  }

  async getById(id: string, actorUserId: string) {
    const order = await this.requireOrder(id, actorUserId);
    return order;
  }

  async getResult(id: string, actorUserId: string) {
    const order = await this.requireOrder(id, actorUserId);
    const result = await this.repository.getResult(id);
    if (!result) throw new AppError('Laboratory result not found', 404, 'LABORATORY_RESULT_NOT_FOUND');
    return { ...result, source_type: order.source_type, encounter_id: order.visit_id ?? order.source_id,
      admission_id: null, procedure_id: null };
  }

  async summary(branchId: string | undefined, actorUserId: string) {
    const scope = await this.orderRepository.resolveBranchScope(actorUserId, branchId);
    const counts = await this.orderRepository.summaryOperational('LABORATORY', scope);
    const statuses = ['SUBMITTED', 'RECEIVED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULT_ENTERED', 'VERIFIED', 'COMPLETED'];
    return {
      total: statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0),
      by_status: Object.fromEntries(statuses.map((status) => [status, counts[status] ?? 0])),
    };
  }

  async updateStatus(
    id: string,
    data: UpdateLaboratoryStatusDTO,
    actorUserId: string,
    metadata: ClinicalOrderRequestMetadata,
  ) {
    const scope = await this.orderRepository.resolveBranchScope(actorUserId);
    const session = await mongoose.startSession();
    try {
      let updated: OpdClinicalOrder | null = null;
      await session.withTransaction(async () => {
        const order = await this.orderRepository.getOperationalById(id, 'LABORATORY', scope, session);
        if (!order) throw new AppError('Laboratory order not found', 404, 'LABORATORY_ORDER_NOT_FOUND');
        this.assertMutable(order);
        if (transitions[order.status] !== data.status) {
          throw new AppError(`Cannot transition laboratory order from ${order.status} to ${data.status}`, 409, 'INVALID_STATUS_TRANSITION');
        }
        if (data.status === 'VERIFIED') {
          const result = await this.repository.getResult(id, session);
          if (!result) throw new AppError('Enter laboratory results before verification', 409, 'RESULT_REQUIRED');
          const verified = await this.repository.verifyResult(id, actorUserId, session);
          if (!verified) throw new AppError('Laboratory result was already verified', 409, 'RESULT_ALREADY_VERIFIED');
        }
        updated = await this.orderRepository.updateOperationalStatus(id, 'LABORATORY', order.status, data.status, actorUserId, session);
        if (!updated) throw new AppError('Laboratory order changed; refresh and retry', 409, 'ORDER_STATUS_CONFLICT');
        await this.orderRepository.audit(auditEvents[data.status], actorUserId, metadata, {
          orderId: id, patientId: order.patient_id, visitId: order.visit_id,
          sourceType: order.source_type, encounterId: order.visit_id ?? order.source_id,
          admissionId: null, procedureId: null,
          previousStatus: order.status, status: data.status,
        }, session);
      });
      if (!updated) throw new AppError('Laboratory status update failed', 500, 'LABORATORY_STATUS_UPDATE_FAILED');
      return updated;
    } finally {
      await session.endSession();
    }
  }

  async enterResult(id: string, data: SaveLaboratoryResultDTO, actorUserId: string, metadata: ClinicalOrderRequestMetadata) {
    const scope = await this.orderRepository.resolveBranchScope(actorUserId);
    const session = await mongoose.startSession();
    try {
      let saved: Awaited<ReturnType<LaboratoryRepository['createResult']>> | undefined;
      await session.withTransaction(async () => {
        const order = await this.orderRepository.getOperationalById(id, 'LABORATORY', scope, session);
        if (!order) throw new AppError('Laboratory order not found', 404, 'LABORATORY_ORDER_NOT_FOUND');
        const visitId = order.visit_id;
        if (!visitId) throw new AppError('Emergency result storage adapter is not available in this phase', 409, 'EMERGENCY_SOURCE_CONTEXT_UNSUPPORTED');
        this.assertMutable(order);
        if (order.status !== 'IN_PROGRESS') throw new AppError('Results can only be entered for an in-progress order', 409, 'RESULT_ENTRY_NOT_ALLOWED');
        const normalized = await this.validateAndNormalizeResults(order, data);
        if (await this.repository.getResult(id, session)) throw new AppError('Laboratory result already exists', 409, 'LABORATORY_RESULT_EXISTS');
        saved = await this.repository.createResult({ ...order, visit_id: visitId, encounter_id: order.visit_id ?? order.source_id, admission_id: null, procedure_id: null }, normalized, actorUserId, session);
        const updated = await this.orderRepository.updateOperationalStatus(id, 'LABORATORY', 'IN_PROGRESS', 'RESULT_ENTERED', actorUserId, session);
        if (!updated) throw new AppError('Laboratory order changed; refresh and retry', 409, 'ORDER_STATUS_CONFLICT');
        await this.orderRepository.audit('laboratory.result.entered', actorUserId, metadata, {
          orderId: id, patientId: order.patient_id, visitId: order.visit_id, resultItemCount: normalized.result_items.length,
          sourceType: order.source_type, encounterId: order.visit_id ?? order.source_id,
          admissionId: null, procedureId: null,
        }, session);
      });
      if (!saved) throw new AppError('Laboratory result entry failed', 500, 'LABORATORY_RESULT_SAVE_FAILED');
      return saved;
    } finally { await session.endSession(); }
  }

  async updateResult(id: string, data: SaveLaboratoryResultDTO, actorUserId: string, metadata: ClinicalOrderRequestMetadata) {
    const scope = await this.orderRepository.resolveBranchScope(actorUserId);
    const session = await mongoose.startSession();
    try {
      let saved: Awaited<ReturnType<LaboratoryRepository['updateResult']>> | null = null;
      await session.withTransaction(async () => {
        const order = await this.orderRepository.getOperationalById(id, 'LABORATORY', scope, session);
        if (!order) throw new AppError('Laboratory order not found', 404, 'LABORATORY_ORDER_NOT_FOUND');
        this.assertMutable(order);
        if (order.status !== 'RESULT_ENTERED') throw new AppError('Only unverified results can be updated', 409, 'RESULT_UPDATE_NOT_ALLOWED');
        const normalized = await this.validateAndNormalizeResults(order, data);
        saved = await this.repository.updateResult({ ...order, encounter_id: order.visit_id ?? order.source_id, admission_id: null, procedure_id: null }, normalized, actorUserId, session);
        if (!saved) throw new AppError('Laboratory result not found or already verified', 409, 'RESULT_UPDATE_NOT_ALLOWED');
        await this.orderRepository.audit('laboratory.result.updated', actorUserId, metadata, {
          orderId: id, patientId: order.patient_id, visitId: order.visit_id, resultItemCount: normalized.result_items.length,
          sourceType: order.source_type, encounterId: order.visit_id ?? order.source_id,
          admissionId: null, procedureId: null,
        }, session);
      });
      return saved;
    } finally { await session.endSession(); }
  }

  private async requireOrder(id: string, actorUserId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError('Laboratory order id is invalid', 400, 'VALIDATION_ERROR');
    const scope = await this.orderRepository.resolveBranchScope(actorUserId);
    const order = await this.orderRepository.getOperationalById(id, 'LABORATORY', scope);
    if (!order) throw new AppError('Laboratory order not found', 404, 'LABORATORY_ORDER_NOT_FOUND');
    return order;
  }

  private assertMutable(order: OpdClinicalOrder) {
    if (order.status === 'COMPLETED') throw new AppError('Completed laboratory orders are read-only', 409, 'ORDER_COMPLETED');
  }

  private async validateAndNormalizeResults(order: OpdClinicalOrder, data: SaveLaboratoryResultDTO) {
    const ordered = new Map(order.items.map((item) => [item.service_id, item]));
    if (data.result_items.length !== order.items.length || data.result_items.some((item) => !ordered.has(item.service_id))) {
      throw new AppError('Results must contain each ordered laboratory service exactly once', 400, 'RESULT_ITEMS_MISMATCH');
    }
    const services = await this.serviceRepository.getClinicalOrderServices([...ordered.keys()], 'LAB_TEST');
    if (services.length !== ordered.size) throw new AppError('A referenced laboratory service was deleted', 409, 'ORDER_SERVICE_DELETED');
    return {
      ...data,
      result_items: data.result_items.map((item) => ({ ...item, service_name: ordered.get(item.service_id)!.service_name })),
    };
  }
}
