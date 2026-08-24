import mongoose, { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { OpdClinicalOrderRepository } from '../opd/opd-clinical-order.repository.js';
import type { ClinicalOrderRequestMetadata, OpdClinicalOrder } from '../opd/opd-clinical-order.types.js';
import type { ImagingRepository } from './imaging.repository.js';
import type { ImagingOrderListQuery, SaveImagingReportDTO, UpdateImagingStatusDTO } from './imaging.types.js';

const transitions: Partial<Record<OpdClinicalOrder['status'], UpdateImagingStatusDTO['status']>> = {
  SUBMITTED: 'RECEIVED', RECEIVED: 'IN_PROGRESS', REPORT_ENTERED: 'VERIFIED', VERIFIED: 'COMPLETED',
};
const auditEvents: Record<UpdateImagingStatusDTO['status'], string> = {
  RECEIVED: 'imaging.order.received', IN_PROGRESS: 'imaging.order.in_progress',
  VERIFIED: 'imaging.report.verified', COMPLETED: 'imaging.order.completed',
};

export class ImagingService {
  constructor(
    private readonly orderRepository: OpdClinicalOrderRepository,
    private readonly repository: ImagingRepository,
  ) {}

  async list(query: ImagingOrderListQuery, actorUserId: string) {
    const scope = await this.orderRepository.resolveBranchScope(actorUserId, query.branch_id);
    return this.orderRepository.listOperational('IMAGING', query, scope);
  }

  async getById(id: string, actorUserId: string) { return this.requireOrder(id, actorUserId); }

  async getReport(id: string, actorUserId: string) {
    const order = await this.requireOrder(id, actorUserId);
    const report = await this.repository.getReport(id);
    if (!report) throw new AppError('Imaging report not found', 404, 'IMAGING_REPORT_NOT_FOUND');
    return { ...report, source_type: order.source_type, encounter_id: order.visit_id ?? order.source_id,
      admission_id: null, procedure_id: null };
  }

  async summary(branchId: string | undefined, actorUserId: string) {
    const scope = await this.orderRepository.resolveBranchScope(actorUserId, branchId);
    const counts = await this.orderRepository.summaryOperational('IMAGING', scope);
    const statuses = ['SUBMITTED', 'RECEIVED', 'IN_PROGRESS', 'REPORT_ENTERED', 'VERIFIED', 'COMPLETED'];
    return {
      total: statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0),
      by_status: Object.fromEntries(statuses.map((status) => [status, counts[status] ?? 0])),
    };
  }

  async updateStatus(id: string, data: UpdateImagingStatusDTO, actorUserId: string, metadata: ClinicalOrderRequestMetadata) {
    const scope = await this.orderRepository.resolveBranchScope(actorUserId);
    const session = await mongoose.startSession();
    try {
      let updated: OpdClinicalOrder | null = null;
      await session.withTransaction(async () => {
        const order = await this.orderRepository.getOperationalById(id, 'IMAGING', scope, session);
        if (!order) throw new AppError('Imaging order not found', 404, 'IMAGING_ORDER_NOT_FOUND');
        this.assertMutable(order);
        if (transitions[order.status] !== data.status) {
          throw new AppError(`Cannot transition imaging order from ${order.status} to ${data.status}`, 409, 'INVALID_STATUS_TRANSITION');
        }
        if (data.status === 'VERIFIED') {
          if (!(await this.repository.getReport(id, session))) throw new AppError('Enter an imaging report before verification', 409, 'REPORT_REQUIRED');
          if (!(await this.repository.verifyReport(id, actorUserId, session))) {
            throw new AppError('Imaging report was already verified', 409, 'REPORT_ALREADY_VERIFIED');
          }
        }
        updated = await this.orderRepository.updateOperationalStatus(id, 'IMAGING', order.status, data.status, actorUserId, session);
        if (!updated) throw new AppError('Imaging order changed; refresh and retry', 409, 'ORDER_STATUS_CONFLICT');
        await this.orderRepository.audit(auditEvents[data.status], actorUserId, metadata, {
          orderId: id, patientId: order.patient_id, visitId: order.visit_id,
          sourceType: order.source_type, encounterId: order.visit_id ?? order.source_id,
          admissionId: null, procedureId: null,
          previousStatus: order.status, status: data.status,
        }, session);
      });
      if (!updated) throw new AppError('Imaging status update failed', 500, 'IMAGING_STATUS_UPDATE_FAILED');
      return updated;
    } finally { await session.endSession(); }
  }

  async enterReport(id: string, data: SaveImagingReportDTO, actorUserId: string, metadata: ClinicalOrderRequestMetadata) {
    const scope = await this.orderRepository.resolveBranchScope(actorUserId);
    const session = await mongoose.startSession();
    try {
      let saved: Awaited<ReturnType<ImagingRepository['createReport']>> | undefined;
      await session.withTransaction(async () => {
        const order = await this.orderRepository.getOperationalById(id, 'IMAGING', scope, session);
        if (!order) throw new AppError('Imaging order not found', 404, 'IMAGING_ORDER_NOT_FOUND');
        const visitId = order.visit_id;
        if (!visitId) throw new AppError('Emergency report storage adapter is not available in this phase', 409, 'EMERGENCY_SOURCE_CONTEXT_UNSUPPORTED');
        this.assertMutable(order);
        if (order.status !== 'IN_PROGRESS') throw new AppError('Reports can only be entered for an in-progress order', 409, 'REPORT_ENTRY_NOT_ALLOWED');
        if (await this.repository.getReport(id, session)) throw new AppError('Imaging report already exists', 409, 'IMAGING_REPORT_EXISTS');
        saved = await this.repository.createReport({ ...order, visit_id: visitId, encounter_id: visitId, admission_id: null, procedure_id: null }, data, actorUserId, session);
        const updated = await this.orderRepository.updateOperationalStatus(id, 'IMAGING', 'IN_PROGRESS', 'REPORT_ENTERED', actorUserId, session);
        if (!updated) throw new AppError('Imaging order changed; refresh and retry', 409, 'ORDER_STATUS_CONFLICT');
        await this.orderRepository.audit('imaging.report.entered', actorUserId, metadata, {
          orderId: id, patientId: order.patient_id, visitId: order.visit_id,
          sourceType: order.source_type, encounterId: order.visit_id ?? order.source_id,
          admissionId: null, procedureId: null,
        }, session);
      });
      if (!saved) throw new AppError('Imaging report entry failed', 500, 'IMAGING_REPORT_SAVE_FAILED');
      return saved;
    } finally { await session.endSession(); }
  }

  async updateReport(id: string, data: SaveImagingReportDTO, actorUserId: string, metadata: ClinicalOrderRequestMetadata) {
    const scope = await this.orderRepository.resolveBranchScope(actorUserId);
    const session = await mongoose.startSession();
    try {
      let saved: Awaited<ReturnType<ImagingRepository['updateReport']>> | null = null;
      await session.withTransaction(async () => {
        const order = await this.orderRepository.getOperationalById(id, 'IMAGING', scope, session);
        if (!order) throw new AppError('Imaging order not found', 404, 'IMAGING_ORDER_NOT_FOUND');
        this.assertMutable(order);
        if (order.status !== 'REPORT_ENTERED') throw new AppError('Only unverified reports can be updated', 409, 'REPORT_UPDATE_NOT_ALLOWED');
        saved = await this.repository.updateReport({ ...order, encounter_id: order.visit_id ?? order.source_id, admission_id: null, procedure_id: null }, data, actorUserId, session);
        if (!saved) throw new AppError('Imaging report not found or already verified', 409, 'REPORT_UPDATE_NOT_ALLOWED');
        await this.orderRepository.audit('imaging.report.updated', actorUserId, metadata, {
          orderId: id, patientId: order.patient_id, visitId: order.visit_id,
          sourceType: order.source_type, encounterId: order.visit_id ?? order.source_id,
          admissionId: null, procedureId: null,
        }, session);
      });
      return saved;
    } finally { await session.endSession(); }
  }

  private async requireOrder(id: string, actorUserId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError('Imaging order id is invalid', 400, 'VALIDATION_ERROR');
    const scope = await this.orderRepository.resolveBranchScope(actorUserId);
    const order = await this.orderRepository.getOperationalById(id, 'IMAGING', scope);
    if (!order) throw new AppError('Imaging order not found', 404, 'IMAGING_ORDER_NOT_FOUND');
    return order;
  }

  private assertMutable(order: OpdClinicalOrder) {
    if (order.status === 'COMPLETED') throw new AppError('Completed imaging orders are read-only', 409, 'ORDER_COMPLETED');
  }
}
