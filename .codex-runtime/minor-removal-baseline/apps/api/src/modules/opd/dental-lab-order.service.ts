import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { SequenceService } from '../../shared/sequence/sequence.service.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { NotificationService } from '../notifications/notification.service.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import type { DentalEpisodeRepository } from './dental-episode.repository.js';
import type { DentalStageRepository } from './dental-stage.repository.js';
import type { DentalLabOrderRepository } from './dental-lab-order.repository.js';
import type { DentalProstheticLabOrderFields } from './dental-lab-order.model.js';
import type {
  CreateDentalProstheticLabOrderDTO,
  DentalLabOrderStatus,
  DentalProstheticLabOrder,
  UpdateDentalLabOrderStatusDTO,
} from './dental-lab-order.types.js';
import { isValidFdiTooth } from './opd-dental-examination.schemas.js';

export const VALID_LAB_ORDER_TRANSITIONS: Record<
  DentalLabOrderStatus,
  DentalLabOrderStatus[]
> = {
  DRAFT: ['ORDERED', 'CANCELLED'],
  ORDERED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['QUALITY_CHECK', 'CANCELLED'],
  QUALITY_CHECK: ['READY'],
  READY: [],
  CANCELLED: [],
};

const isObjectId = (value: string | null | undefined) =>
  Boolean(value && Types.ObjectId.isValid(value));

export class DentalLabOrderService {
  constructor(
    private readonly repository: DentalLabOrderRepository,
    private readonly stageRepository: DentalStageRepository,
    private readonly episodeRepository: DentalEpisodeRepository,
    private readonly patientRepository: PatientRepository,
    private readonly sequenceService: SequenceService,
    private readonly notificationService?: NotificationService,
  ) {}

  async createOrder(
    data: CreateDentalProstheticLabOrderDTO,
    userId: string,
  ): Promise<DentalProstheticLabOrder> {
    this.validateId(data.patient_id, 'Patient id is invalid');
    this.validateId(data.treatment_episode_id, 'Treatment episode id is invalid');
    this.validateId(data.treatment_stage_id, 'Treatment stage id is invalid');
    if (data.assigned_lab_id) {
      this.validateId(data.assigned_lab_id, 'Assigned lab id is invalid');
    }

    // 1. Validate Patient exists
    const patient = await this.patientRepository.getById(data.patient_id);
    if (!patient) {
      throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
    }

    // 2. Validate Episode exists
    const episode = await this.episodeRepository.getById(data.treatment_episode_id);
    if (!episode) {
      throw new AppError('Dental treatment episode not found', 404, 'EPISODE_NOT_FOUND');
    }
    if (episode.patient_id !== data.patient_id) {
      throw new AppError('Episode does not belong to specified patient', 400, 'VALIDATION_ERROR');
    }
    if (episode.status === 'CANCELLED') {
      throw new AppError('Cannot create lab orders for a cancelled episode', 400, 'INVALID_EPISODE_STATUS');
    }

    // 3. Validate Stage exists and belongs to Episode
    const stage = await this.stageRepository.getById(data.treatment_stage_id);
    if (!stage) {
      throw new AppError('Dental treatment stage not found', 404, 'STAGE_NOT_FOUND');
    }
    if (stage.episode_id !== data.treatment_episode_id) {
      throw new AppError('Treatment stage does not belong to specified episode', 400, 'STAGE_EPISODE_MISMATCH');
    }
    if (stage.patient_id !== data.patient_id) {
      throw new AppError('Treatment stage does not belong to specified patient', 400, 'VALIDATION_ERROR');
    }

    // 4. Validate Plan Item if supplied
    if (data.treatment_plan_item_id && data.treatment_plan_item_id !== stage.plan_item_id) {
      throw new AppError('Treatment plan item does not match stage plan item', 400, 'PLAN_ITEM_MISMATCH');
    }

    // 5. Validate tooth number if supplied
    const effectiveTooth = data.tooth_number ?? stage.tooth_number ?? episode.primary_tooth_number ?? null;
    if (data.tooth_number !== undefined && data.tooth_number !== null) {
      if (!isValidFdiTooth(data.tooth_number)) {
        throw new AppError('Invalid FDI tooth number', 400, 'INVALID_TOOTH_NUMBER');
      }
    }

    // 6. Ensure department access
    await this.ensureDepartmentAccess(episode.department_id, userId);

    // 7. Get user details for requester display
    const user = await UserModel.findById(new Types.ObjectId(userId)).lean();
    const requesterName = user?.fullName ?? null;

    // 8. Generate sequence-based order number (e.g. DPL-2026-00001)
    const seq = await this.sequenceService.getNextSequence('DENTAL_PROSTHETIC_LAB_ORDER');
    const orderNumber = this.sequenceService.formatStandardSequence('DPL', seq, 5);

    // 9. Create Lab Order
    const order = await this.repository.create({
      orderNumber,
      patientId: new Types.ObjectId(data.patient_id),
      treatmentEpisodeId: new Types.ObjectId(data.treatment_episode_id),
      treatmentStageId: new Types.ObjectId(data.treatment_stage_id),
      treatmentPlanItemId: data.treatment_plan_item_id ?? stage.plan_item_id ?? null,
      toothNumber: effectiveTooth,
      prostheticType: data.prosthetic_type,
      description: data.description.trim(),
      assignedLabId: data.assigned_lab_id ? new Types.ObjectId(data.assigned_lab_id) : null,
      requestedBy: new Types.ObjectId(userId),
      requestedByName: requesterName,
      requestedAt: new Date(),
      status: data.status ?? 'ORDERED',
      branchId: new Types.ObjectId(episode.branch_id),
      departmentId: new Types.ObjectId(episode.department_id),
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    // 10. Link Lab Order to Stage
    await this.stageRepository.updateProstheticLabOrder(stage.id, order.id);

    // 11. Audit Event
    await this.patientRepository.auditClinicalEvent(
      'opd.dental_lab_order.created',
      userId,
      {
        labOrderId: order.id,
        orderNumber: order.order_number,
        patientId: order.patient_id,
        episodeId: order.treatment_episode_id,
        stageId: order.treatment_stage_id,
        planItemId: order.treatment_plan_item_id ?? null,
        toothNumber: order.tooth_number ?? null,
        prostheticType: order.prosthetic_type,
        status: order.status,
      },
    );

    return order;
  }

  async getOrder(id: string, userId: string): Promise<DentalProstheticLabOrder> {
    this.validateId(id, 'Order id is invalid');
    const order = await this.repository.getById(id);
    if (!order) {
      throw new AppError('Dental prosthetic lab order not found', 404, 'LAB_ORDER_NOT_FOUND');
    }
    await this.ensureDepartmentAccess(order.department_id, userId);
    return order;
  }

  async listOrdersByEpisode(episodeId: string, userId: string): Promise<DentalProstheticLabOrder[]> {
    this.validateId(episodeId, 'Episode id is invalid');
    const episode = await this.episodeRepository.getById(episodeId);
    if (!episode) {
      throw new AppError('Dental treatment episode not found', 404, 'EPISODE_NOT_FOUND');
    }
    await this.ensureDepartmentAccess(episode.department_id, userId);
    return this.repository.listByEpisode(episodeId);
  }

  async updateOrderStatus(
    id: string,
    payload: UpdateDentalLabOrderStatusDTO,
    userId: string,
  ): Promise<DentalProstheticLabOrder> {
    this.validateId(id, 'Order id is invalid');
    const order = await this.repository.getById(id);
    if (!order) {
      throw new AppError('Dental prosthetic lab order not found', 404, 'LAB_ORDER_NOT_FOUND');
    }

    await this.ensureDepartmentAccess(order.department_id, userId);

    const currentStatus = order.status;
    const nextStatus = payload.status;

    if (currentStatus === nextStatus) {
      return order;
    }

    const allowed = VALID_LAB_ORDER_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new AppError(
        `Invalid status transition from ${currentStatus} to ${nextStatus}`,
        400,
        'INVALID_STATUS_TRANSITION',
      );
    }

    if (nextStatus === 'CANCELLED') {
      if (!payload.cancellation_reason || !payload.cancellation_reason.trim()) {
        throw new AppError(
          'Cancellation reason is required when cancelling a lab order',
          400,
          'VALIDATION_ERROR',
        );
      }
    }

    const now = new Date();
    const updates: Partial<DentalProstheticLabOrderFields> = {
      status: nextStatus,
      statusRemarks: payload.remarks?.trim() ?? null,
      updatedBy: new Types.ObjectId(userId),
    };

    if (nextStatus === 'RECEIVED') {
      updates.receivedAt = now;
    } else if (nextStatus === 'IN_PROGRESS') {
      updates.inProgressAt = now;
    } else if (nextStatus === 'QUALITY_CHECK') {
      updates.qualityCheckAt = now;
    } else if (nextStatus === 'READY') {
      updates.readyAt = now;
    } else if (nextStatus === 'CANCELLED') {
      updates.cancelledAt = now;
      updates.cancellationReason = payload.cancellation_reason?.trim() ?? null;
    }

    const updated = await this.repository.updateStatus(id, updates);
    if (!updated) {
      throw new AppError(
        'Failed to update dental prosthetic lab order status',
        500,
        'INTERNAL_SERVER_ERROR',
      );
    }

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_lab_order.status_updated',
      userId,
      {
        labOrderId: updated.id,
        orderNumber: updated.order_number,
        patientId: updated.patient_id,
        previousStatus: currentStatus,
        newStatus: nextStatus,
        remarks: payload.remarks ?? null,
        cancellationReason: payload.cancellation_reason ?? null,
      },
    );

    // Phase 6A: Clinician notification & Phase 6B: Patient notification
    if (nextStatus === 'READY' && this.notificationService) {
      const toothText = updated.tooth_number ? ` for Tooth #${updated.tooth_number}` : '';
      const clinicianMessage = `The dental prosthetic (${updated.prosthetic_type}, ${updated.order_number})${toothText} is ready for clinical fitting.`;

      // 1. Notify ordering clinician (Phase 6A)
      await this.notificationService.createNotification({
        recipient_user_id: updated.requested_by,
        recipient_branch_id: updated.branch_id,
        title: 'Dental Prosthetic Ready',
        message: clinicianMessage,
        type: 'DENTAL_LAB_READY',
        related_entity_id: updated.id,
      });

      // 2. Notify patient (Phase 6B)
      let patientRecipientUserId = updated.patient_id;
      if (Types.ObjectId.isValid(updated.patient_id)) {
        const patientUser = await UserModel.findOne({
          patientId: new Types.ObjectId(updated.patient_id),
          deletedAt: null,
        })
          .select('_id')
          .lean();

        if (patientUser) {
          patientRecipientUserId = patientUser._id.toString();
        }
      }

      const patientToothText = updated.tooth_number ? ` (Tooth #${updated.tooth_number})` : '';
      const patientMessage = `Your dental prosthetic (${updated.prosthetic_type}${patientToothText}) is ready. Please contact the hospital or check your upcoming appointment for the next step.`;

      await this.notificationService.createNotification({
        recipient_user_id: patientRecipientUserId,
        recipient_branch_id: updated.branch_id,
        title: 'Dental Prosthetic Ready',
        message: patientMessage,
        type: 'DENTAL_LAB_READY',
        related_entity_id: updated.id,
      });
    }

    return updated;
  }

  private validateId(value: string, message: string): void {
    if (!isObjectId(value)) {
      throw new AppError(message, 400, 'INVALID_IDENTIFIER');
    }
  }

  private async ensureDepartmentAccess(departmentId: string, userId: string): Promise<void> {
    const user = await UserModel.findOne({
      _id: new Types.ObjectId(userId),
      deletedAt: null,
      status: 'active',
    }).lean();

    if (!user) {
      throw new AppError('User not found or inactive', 401, 'UNAUTHORIZED');
    }

    const roles = await RoleModel.find({
      _id: { $in: user.roleIds },
      deletedAt: null,
    }).lean();

    const isSuperAdmin = roles.some((r) => r.name === 'Super Admin');
    if (isSuperAdmin) return;

    const userDeptIds = (user.departmentIds ?? []).map((id) => id.toString());
    if (userDeptIds.length > 0 && !userDeptIds.includes(departmentId)) {
      throw new AppError(
        'User does not have access to this department',
        403,
        'FORBIDDEN_DEPARTMENT',
      );
    }
  }
}
