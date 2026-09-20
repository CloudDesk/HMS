import { Types } from 'mongoose';
import { fromZonedTime } from 'date-fns-tz';
import { AppError } from '../../shared/errors/app-error.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import type { DentalEpisodeRepository } from './dental-episode.repository.js';
import type { DentalStageRepository } from './dental-stage.repository.js';
import type { AppointmentService } from '../appointments/appointment.service.js';
import type { Appointment } from '../appointments/appointment.types.js';
import type { DoctorRepository } from '../doctors/doctor.repository.js';
import type { SettingsRepository } from '../settings/settings.repository.js';
import type { DentalLabOrderRepository } from './dental-lab-order.repository.js';
import type { DentalProstheticLabOrder } from './dental-lab-order.types.js';
import type {
  AssignDoctorStageDTO,
  CreateDentalStageDTO,
  DentalStageStatus,
  DentalTreatmentStage,
  RescheduleDentalStageDTO,
  ScheduleDentalStageDTO,
  UpdateDentalStageStatusDTO,
} from './dental-stage.types.js';

const isObjectId = (value: string | null | undefined) =>
  Boolean(value && Types.ObjectId.isValid(value));

const VALID_TRANSITIONS: Record<DentalStageStatus, DentalStageStatus[]> = {
  PLANNED: ['SCHEDULED', 'IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'PLANNED', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'ON_HOLD', 'CANCELLED'],
  ON_HOLD: ['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [], // terminal
  CANCELLED: [], // terminal
};

export class DentalStageService {
  constructor(
    private readonly repository: DentalStageRepository,
    private readonly episodeRepository: DentalEpisodeRepository,
    private readonly patientRepository: PatientRepository,
    private readonly appointmentService: AppointmentService,
    private readonly doctorRepository: DoctorRepository,
    private readonly settingsRepository?: SettingsRepository,
    private readonly dentalLabOrderRepository?: DentalLabOrderRepository,
  ) {}

  async createStage(
    episodeId: string,
    data: CreateDentalStageDTO,
    userId: string,
  ): Promise<DentalTreatmentStage> {
    this.validateId(episodeId, 'Episode id is invalid');
    this.validateId(data.assigned_doctor_id, 'Assigned doctor id is invalid');
    if (data.service_id) {
      this.validateId(data.service_id, 'Service id is invalid');
    }

    const episode = await this.episodeRepository.getById(episodeId);
    if (!episode) {
      throw new AppError('Dental treatment episode not found', 404, 'EPISODE_NOT_FOUND');
    }

    if (episode.status === 'COMPLETED' || episode.status === 'CANCELLED') {
      throw new AppError(
        `Cannot add treatment stages to an episode with status ${episode.status}`,
        400,
        'INVALID_EPISODE_STATUS',
      );
    }

    await this.ensureDepartmentAccess(episode.department_id, userId);

    const doctor = await DoctorModel.findOne({
      _id: new Types.ObjectId(data.assigned_doctor_id),
      deletedAt: null,
    }).lean();

    if (!doctor) {
      throw new AppError('Assigned doctor not found', 404, 'DOCTOR_NOT_FOUND');
    }

    if (doctor.status !== 'ACTIVE') {
      throw new AppError('Assigned doctor is not currently active', 400, 'DOCTOR_NOT_ACTIVE');
    }

    const doctorName = doctor.displayName || `${doctor.firstName} ${doctor.lastName}`.trim();

    // Sequence assignment
    let sequence = data.sequence;
    if (!sequence || sequence < 1) {
      const maxSeq = await this.repository.getMaxSequence(episodeId, data.plan_item_id);
      sequence = maxSeq + 1;
    } else {
      // If sequence was explicitly given, check for existing stage with same sequence
      const existing = await this.repository.listByPlanItem(episodeId, data.plan_item_id);
      if (existing.some((s) => s.sequence === sequence)) {
        throw new AppError(
          `A stage with sequence ${sequence} already exists for this treatment item`,
          409,
          'STAGE_SEQUENCE_CONFLICT',
        );
      }
    }

    let prostheticLabOrderId: Types.ObjectId | null = null;
    if (data.prosthetic_lab_order_id) {
      this.validateId(data.prosthetic_lab_order_id, 'Prosthetic lab order id is invalid');
      if (this.dentalLabOrderRepository) {
        const labOrder = await this.dentalLabOrderRepository.getById(data.prosthetic_lab_order_id);
        if (!labOrder) {
          throw new AppError('Dental prosthetic lab order not found', 404, 'LAB_ORDER_NOT_FOUND');
        }
        if (labOrder.treatment_episode_id !== episodeId || labOrder.patient_id !== episode.patient_id) {
          throw new AppError('Prosthetic lab order does not belong to this episode/patient', 400, 'VALIDATION_ERROR');
        }
        prostheticLabOrderId = new Types.ObjectId(data.prosthetic_lab_order_id);
      }
    } else if (this.dentalLabOrderRepository) {
      const episodeOrders = await this.dentalLabOrderRepository.listByEpisode(episodeId);
      const matchingOrder = episodeOrders.find(
        (lo) => lo.treatment_plan_item_id === data.plan_item_id.trim() && lo.status !== 'CANCELLED',
      );
      if (matchingOrder) {
        prostheticLabOrderId = new Types.ObjectId(matchingOrder.id);
      }
    }

    const stage = await this.repository.create({
      episodeId: new Types.ObjectId(episodeId),
      planItemId: data.plan_item_id.trim(),
      toothNumber: data.tooth_number ?? episode.primary_tooth_number ?? null,
      serviceId: data.service_id ? new Types.ObjectId(data.service_id) : null,
      stageName: data.stage_name.trim(),
      sequence,
      assignedDoctorId: new Types.ObjectId(data.assigned_doctor_id),
      assignedDoctorName: doctorName,
      status: 'PLANNED',
      plannedDate: data.planned_date ? new Date(data.planned_date) : null,
      prostheticLabOrderId,
      notes: data.notes?.trim() || null,
      branchId: new Types.ObjectId(episode.branch_id),
      departmentId: new Types.ObjectId(episode.department_id),
      patientId: new Types.ObjectId(episode.patient_id),
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_stage.created',
      userId,
      {
        stageId: stage.id,
        episodeId: stage.episode_id,
        planItemId: stage.plan_item_id,
        stageName: stage.stage_name,
        sequence: stage.sequence,
        assignedDoctorId: stage.assigned_doctor_id,
        assignedDoctorName: stage.assigned_doctor_name,
      },
    );

    return stage;
  }

  async listStages(
    episodeId: string,
    planItemId?: string,
    userId?: string,
  ): Promise<DentalTreatmentStage[]> {
    this.validateId(episodeId, 'Episode id is invalid');
    const episode = await this.episodeRepository.getById(episodeId);
    if (!episode) {
      throw new AppError('Dental treatment episode not found', 404, 'EPISODE_NOT_FOUND');
    }
    if (userId) {
      await this.ensureDepartmentAccess(episode.department_id, userId);
    }
    return this.repository.listByEpisode(episodeId, planItemId?.trim() || undefined);
  }

  async getStage(stageId: string, userId?: string): Promise<DentalTreatmentStage> {
    this.validateId(stageId, 'Stage id is invalid');
    const stage = await this.repository.getById(stageId);
    if (!stage) {
      throw new AppError('Dental treatment stage not found', 404, 'STAGE_NOT_FOUND');
    }
    if (userId) {
      await this.ensureDepartmentAccess(stage.department_id, userId);
    }
    return stage;
  }

  async assignDoctor(
    stageId: string,
    data: AssignDoctorStageDTO,
    userId: string,
  ): Promise<DentalTreatmentStage> {
    this.validateId(stageId, 'Stage id is invalid');
    this.validateId(data.doctor_id, 'Doctor id is invalid');

    const stage = await this.getStage(stageId, userId);

    if (stage.status === 'COMPLETED' || stage.status === 'CANCELLED') {
      throw new AppError(
        `Cannot reassign doctor to a ${stage.status.toLowerCase()} treatment stage`,
        400,
        'INVALID_STAGE_STATE',
      );
    }

    const doctor = await DoctorModel.findOne({
      _id: new Types.ObjectId(data.doctor_id),
      deletedAt: null,
    }).lean();

    if (!doctor) {
      throw new AppError('Assigned doctor not found', 404, 'DOCTOR_NOT_FOUND');
    }

    if (doctor.status !== 'ACTIVE') {
      throw new AppError('Assigned doctor is not currently active', 400, 'DOCTOR_NOT_ACTIVE');
    }

    const doctorName = doctor.displayName || `${doctor.firstName} ${doctor.lastName}`.trim();
    const previousDoctorId = stage.assigned_doctor_id;
    const previousDoctorName = stage.assigned_doctor_name;

    const updated = await this.repository.assignDoctor(stageId, {
      doctorId: data.doctor_id,
      doctorName,
      notes: data.notes?.trim() ?? stage.notes,
      updatedBy: userId,
    });

    if (!updated) {
      throw new AppError('Failed to update doctor assignment', 500, 'UPDATE_FAILED');
    }

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_stage.assigned',
      userId,
      {
        stageId: updated.id,
        episodeId: updated.episode_id,
        planItemId: updated.plan_item_id,
        previousDoctorId,
        previousDoctorName,
        assignedDoctorId: updated.assigned_doctor_id,
        assignedDoctorName: updated.assigned_doctor_name,
      },
    );

    return updated;
  }

  async updateStatus(
    stageId: string,
    data: UpdateDentalStageStatusDTO,
    userId: string,
  ): Promise<DentalTreatmentStage> {
    this.validateId(stageId, 'Stage id is invalid');
    const stage = await this.getStage(stageId, userId);

    if (stage.status === data.status) {
      return stage;
    }

    // Terminal status check
    if (stage.status === 'COMPLETED' || stage.status === 'CANCELLED') {
      throw new AppError(
        `Cannot modify status of a ${stage.status.toLowerCase()} stage`,
        400,
        'TERMINAL_STATUS',
      );
    }

    // State machine check
    const allowed = VALID_TRANSITIONS[stage.status];
    if (!allowed || !allowed.includes(data.status)) {
      throw new AppError(
        `Invalid stage status transition from ${stage.status} to ${data.status}`,
        400,
        'INVALID_STATE_TRANSITION',
      );
    }

    // Sequential Dependency Invariant (Rule 20):
    // Stage with sequence K cannot transition to SCHEDULED, IN_PROGRESS, or COMPLETED
    // unless all preceding stages (sequence < K) for the same plan item are COMPLETED (or CANCELLED).
    if (data.status === 'IN_PROGRESS' || data.status === 'COMPLETED' || data.status === 'SCHEDULED') {
      await this.validatePrerequisites(stage);
    }

    // Guard: If stage has a linked prosthetic lab order, it must be READY (or CANCELLED) before clinical progression (SCHEDULED, IN_PROGRESS, COMPLETED)
    if (
      (data.status === 'SCHEDULED' || data.status === 'IN_PROGRESS' || data.status === 'COMPLETED') &&
      this.dentalLabOrderRepository
    ) {
      await this.validateLabOrderReady(stage, data.status);
    }

    let completedAt: Date | null | undefined = undefined;
    let completedByDoctorId: Types.ObjectId | null | undefined = undefined;
    let completedByDoctorName: string | null | undefined = undefined;

    if (data.status === 'COMPLETED') {
      completedAt = new Date();
      completedByDoctorId = new Types.ObjectId(stage.assigned_doctor_id);
      completedByDoctorName = stage.assigned_doctor_name;
    }

    const updated = await this.repository.updateStatus(stageId, {
      status: data.status,
      completedAt,
      completedByDoctorId,
      completedByDoctorName,
      notes: data.notes?.trim() ?? stage.notes,
      updatedBy: userId,
    });

    if (!updated) {
      throw new AppError('Failed to update stage status', 500, 'UPDATE_FAILED');
    }

    if (data.status === 'COMPLETED') {
      await this.patientRepository.auditClinicalEvent(
        'opd.dental_stage.completed',
        userId,
        {
          stageId: updated.id,
          episodeId: updated.episode_id,
          planItemId: updated.plan_item_id,
          stageName: updated.stage_name,
          sequence: updated.sequence,
          completedByDoctorId: updated.completed_by_doctor_id,
          completedByDoctorName: updated.completed_by_doctor_name,
        },
      );

      await this.patientRepository.addTimelineEvent(
        updated.patient_id,
        {
          event_type: 'OPD_DENTAL_EXAMINATION_COMPLETED',
          title: `Dental Treatment Stage Completed: ${updated.stage_name}`,
          description: `Stage #${updated.sequence} (${updated.stage_name}) completed by Dr. ${updated.completed_by_doctor_name ?? updated.assigned_doctor_name}${
            updated.tooth_number ? ` for Tooth #${updated.tooth_number}` : ''
          }.`,
        },
        userId,
      );

      await this.evaluateEpisodeCompletion(updated.episode_id, userId);
    } else {
      await this.patientRepository.auditClinicalEvent(
        'opd.dental_stage.status_updated',
        userId,
        {
          stageId: updated.id,
          episodeId: updated.episode_id,
          planItemId: updated.plan_item_id,
          previousStatus: stage.status,
          newStatus: updated.status,
        },
      );
    }

    return updated;
  }

  async deleteStage(stageId: string, userId: string): Promise<boolean> {
    this.validateId(stageId, 'Stage id is invalid');
    const stage = await this.getStage(stageId, userId);

    if (stage.status !== 'PLANNED') {
      throw new AppError(
        `Only stages in PLANNED status can be deleted (current: ${stage.status})`,
        400,
        'STAGE_NOT_DELETABLE',
      );
    }

    const allStages = await this.repository.listByPlanItem(stage.episode_id, stage.plan_item_id);
    const subsequentStages = allStages.filter((s) => s.sequence > stage.sequence);
    const hasActiveSubsequent = subsequentStages.some(
      (s) => s.status === 'IN_PROGRESS' || s.status === 'COMPLETED',
    );
    if (hasActiveSubsequent) {
      throw new AppError(
        'Cannot delete stage because subsequent treatment stages are already in progress or completed',
        400,
        'SUBSEQUENT_STAGES_ACTIVE',
      );
    }

    const success = await this.repository.deleteStage(stageId, userId);
    if (success) {
      await this.patientRepository.auditClinicalEvent(
        'opd.dental_stage.deleted',
        userId,
        {
          stageId: stage.id,
          episodeId: stage.episode_id,
          planItemId: stage.plan_item_id,
          stageName: stage.stage_name,
        },
      );
    }
    return success;
  }

  async scheduleStage(
    stageId: string,
    data: ScheduleDentalStageDTO,
    userId: string,
  ): Promise<{ stage: DentalTreatmentStage; appointment: Appointment }> {
    this.validateId(stageId, 'Stage id is invalid');
    const stage = await this.getStage(stageId, userId);

    if (stage.status === 'COMPLETED' || stage.status === 'CANCELLED') {
      throw new AppError(
        `Cannot schedule a stage that is already ${stage.status.toLowerCase()}`,
        400,
        'TERMINAL_STATUS',
      );
    }

    // Enforce sequential stage prerequisites
    await this.validatePrerequisites(stage);

    // Enforce linked lab order READY status if stage is associated with a lab order
    if (this.dentalLabOrderRepository) {
      await this.validateLabOrderReady(stage, 'SCHEDULED');
    }

    const doctorId = data.doctor_id || stage.assigned_doctor_id;
    this.validateId(doctorId, 'Doctor id is invalid');
    const doctor = await this.doctorRepository.getById(doctorId);
    if (!doctor || doctor.status !== 'ACTIVE') {
      throw new AppError('Active doctor is required for scheduling', 400, 'INVALID_DOCTOR');
    }

    const durationMinutes = data.duration_minutes ?? 60;
    let utcDatetime = data.utc_datetime;
    if (!utcDatetime) {
      const settings = await this.settingsRepository?.get();
      const tz = settings?.localization?.timezone || 'Africa/Nairobi';
      utcDatetime = fromZonedTime(`${data.appointment_date}T${data.start_time}:00`, tz).toISOString();
    }

    // Create the appointment with dental_context
    const appointment = await this.appointmentService.create(
      {
        patient_id: stage.patient_id,
        doctor_id: doctor.id,
        appointment_date: data.appointment_date,
        start_time: data.start_time,
        utc_datetime: utcDatetime,
        duration_minutes: durationMinutes,
        visit_type: 'PROCEDURE',
        priority: data.priority ?? 'ROUTINE',
        reason: `Dental Stage: ${stage.stage_name}${stage.tooth_number ? ` (Tooth ${stage.tooth_number})` : ''}`,
        notes: data.notes?.trim() || null,
        dental_context: {
          treatment_episode_id: stage.episode_id,
          treatment_stage_id: stage.id,
          treatment_plan_item_id: stage.plan_item_id,
          tooth_number: stage.tooth_number ?? null,
          stage_sequence: stage.sequence,
          stage_name: stage.stage_name,
        },
      },
      userId,
    );

    // Link the created appointment to the stage
    const updatedStage = await this.repository.linkAppointment(
      stage.id,
      appointment.id,
      'SCHEDULED',
      doctor.id,
      doctor.display_name,
      userId,
    );

    if (!updatedStage) {
      throw new AppError('Failed to link appointment to stage', 500, 'UPDATE_FAILED');
    }

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_stage.scheduled',
      userId,
      {
        stageId: updatedStage.id,
        episodeId: updatedStage.episode_id,
        planItemId: updatedStage.plan_item_id,
        appointmentId: appointment.id,
        appointmentNumber: appointment.appointment_number,
        appointmentDate: data.appointment_date,
        startTime: data.start_time,
        durationMinutes,
        assignedDoctorId: doctor.id,
        assignedDoctorName: doctor.display_name,
      },
    );

    return { stage: updatedStage, appointment };
  }

  async rescheduleStage(
    stageId: string,
    data: RescheduleDentalStageDTO,
    userId: string,
  ): Promise<{ stage: DentalTreatmentStage; appointment: Appointment }> {
    this.validateId(stageId, 'Stage id is invalid');
    const stage = await this.getStage(stageId, userId);

    if (!stage.appointment_id) {
      throw new AppError('Stage has no active appointment to reschedule', 400, 'NO_APPOINTMENT_TO_RESCHEDULE');
    }

    if (stage.status !== 'SCHEDULED') {
      throw new AppError(`Cannot reschedule a stage with status ${stage.status}`, 400, 'INVALID_STAGE_STATUS');
    }

    // Enforce linked lab order READY status if stage is associated with a lab order
    if (this.dentalLabOrderRepository) {
      await this.validateLabOrderReady(stage, 'SCHEDULED');
    }

    let rescheduleUtc = data.utc_datetime;
    if (!rescheduleUtc) {
      const settings = await this.settingsRepository?.get();
      const tz = settings?.localization?.timezone || 'Africa/Nairobi';
      rescheduleUtc = fromZonedTime(`${data.appointment_date}T${data.start_time}:00`, tz).toISOString();
    }

    const updatedAppointment = await this.appointmentService.update(
      stage.appointment_id,
      {
        appointment_date: data.appointment_date,
        start_time: data.start_time,
        utc_datetime: rescheduleUtc,
        duration_minutes: data.duration_minutes,
        reschedule_reason: data.reschedule_reason || 'Dental stage reschedule',
      },
      userId,
    );

    if (!updatedAppointment) {
      throw new AppError('Appointment could not be updated', 500, 'UPDATE_FAILED');
    }

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_stage.rescheduled',
      userId,
      {
        stageId: stage.id,
        episodeId: stage.episode_id,
        planItemId: stage.plan_item_id,
        appointmentId: updatedAppointment.id,
        appointmentNumber: updatedAppointment.appointment_number,
        newDate: data.appointment_date,
        newStartTime: data.start_time,
      },
    );

    return { stage, appointment: updatedAppointment };
  }

  async cancelStageAppointment(
    stageId: string,
    data: { reason?: string | null },
    userId: string,
  ): Promise<DentalTreatmentStage> {
    this.validateId(stageId, 'Stage id is invalid');
    const stage = await this.getStage(stageId, userId);

    if (!stage.appointment_id) {
      throw new AppError('Stage has no active appointment to cancel', 400, 'NO_APPOINTMENT_TO_CANCEL');
    }

    const prevAppointmentId = stage.appointment_id;

    await this.appointmentService.updateStatus(
      stage.appointment_id,
      { status: 'CANCELLED', notes: data.reason?.trim() || 'Dental stage appointment cancelled' },
      userId,
    );

    const updatedStage = await this.repository.clearAppointment(stage.id, 'PLANNED', userId);

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_stage.appointment_cancelled',
      userId,
      {
        stageId: stage.id,
        episodeId: stage.episode_id,
        planItemId: stage.plan_item_id,
        cancelledAppointmentId: prevAppointmentId,
        reason: data.reason?.trim() || null,
      },
    );

    return updatedStage ?? stage;
  }

  async getStageAppointment(
    stageId: string,
    userId?: string,
  ): Promise<Appointment | null> {
    this.validateId(stageId, 'Stage id is invalid');
    const stage = await this.getStage(stageId, userId);
    if (!stage.appointment_id) return null;
    try {
      return await this.appointmentService.getById(stage.appointment_id, userId);
    } catch {
      return null;
    }
  }

  private async validatePrerequisites(stage: DentalTreatmentStage): Promise<void> {
    if (stage.sequence > 1) {
      const allStages = await this.repository.listByPlanItem(stage.episode_id, stage.plan_item_id);
      const priorStages = allStages.filter((s) => s.sequence < stage.sequence);

      for (const prior of priorStages) {
        if (prior.status !== 'COMPLETED' && prior.status !== 'CANCELLED') {
          throw new AppError(
            `Prerequisite stage (Stage ${prior.sequence}: ${prior.stage_name}) must be completed before Stage ${stage.sequence} can be scheduled, started, or completed`,
            400,
            'PREREQUISITE_STAGE_INCOMPLETE',
          );
        }
      }
    }
  }

  private async validateLabOrderReady(
    stage: DentalTreatmentStage,
    targetStatus: string,
  ): Promise<void> {
    if (!this.dentalLabOrderRepository) return;

    let linkedLabOrder: DentalProstheticLabOrder | null = null;
    if (stage.prosthetic_lab_order_id) {
      // Check if there is a subsequent stage in the plan item that acts as the fitting stage
      const allStages = await this.repository.listByPlanItem(stage.episode_id, stage.plan_item_id);
      const hasSubsequentFittingStage = allStages.some(
        (s) =>
          s.sequence > stage.sequence &&
          s.status !== 'CANCELLED' &&
          (s.prosthetic_lab_order_id === stage.prosthetic_lab_order_id || !s.prosthetic_lab_order_id),
      );
      if (!hasSubsequentFittingStage) {
        linkedLabOrder = await this.dentalLabOrderRepository.getById(stage.prosthetic_lab_order_id);
      }
    }

    if (!linkedLabOrder) {
      const stageOrders = await this.dentalLabOrderRepository.listByStage(stage.id);
      if (stageOrders.length > 0 && stageOrders[0]) {
        const order = stageOrders[0];
        const allStages = await this.repository.listByPlanItem(stage.episode_id, stage.plan_item_id);
        const hasSubsequentFittingStage = allStages.some(
          (s) => s.sequence > stage.sequence && s.status !== 'CANCELLED',
        );
        if (!hasSubsequentFittingStage) {
          linkedLabOrder = order;
        }
      }
    }

    if (!linkedLabOrder && stage.plan_item_id) {
      const allStages = await this.repository.listByPlanItem(stage.episode_id, stage.plan_item_id);
      const isLatestStageInPlan = !allStages.some(
        (s) => s.sequence > stage.sequence && s.status !== 'CANCELLED',
      );
      if (isLatestStageInPlan) {
        const episodeOrders = await this.dentalLabOrderRepository.listByEpisode(stage.episode_id);
        const matching = episodeOrders.find(
          (lo) => lo.treatment_plan_item_id === stage.plan_item_id && lo.status !== 'CANCELLED',
        );
        if (matching) {
          linkedLabOrder = matching;
        }
      }
    }

    if (linkedLabOrder && linkedLabOrder.status !== 'READY' && linkedLabOrder.status !== 'CANCELLED') {
      const actionText =
        targetStatus === 'COMPLETED'
          ? 'clinical completion'
          : targetStatus === 'SCHEDULED'
          ? 'scheduling'
          : 'starting clinical work';
      throw new AppError(
        `Cannot proceed with ${actionText} because linked dental prosthetic lab order (${linkedLabOrder.order_number}) is currently ${linkedLabOrder.status}. It must be READY before clinical progression.`,
        400,
        'LAB_ORDER_NOT_READY',
      );
    }
  }

  private validateId(value: string | null | undefined, message: string): void {
    if (!isObjectId(value)) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }

  private async ensureDepartmentAccess(departmentId: string, userId: string): Promise<void> {
    const user = await UserModel.findOne({
      _id: new Types.ObjectId(userId),
      deletedAt: null,
    })
      .select('branchIds departmentIds roleIds')
      .lean();

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const isSuperAdmin = Boolean(
      await RoleModel.exists({
        _id: { $in: user.roleIds ?? [] },
        code: 'SUPER_ADMIN',
        status: 'active',
        deletedAt: null,
      }),
    );
    if (isSuperAdmin) return;

    if (user.departmentIds && user.departmentIds.length > 0) {
      const allowedDeptIds = user.departmentIds.map((id) => id.toString());
      if (!allowedDeptIds.includes(departmentId)) {
        throw new AppError('Department access denied', 403, 'DEPARTMENT_ACCESS_DENIED');
      }
    }
  }

  private async evaluateEpisodeCompletion(episodeId: string, userId: string): Promise<void> {
    const episode = await this.episodeRepository.getById(episodeId);
    if (!episode) return;

    // Terminal states cannot be automatically modified
    if (episode.status === 'COMPLETED' || episode.status === 'CANCELLED') {
      return;
    }

    const allStages = await this.repository.listByEpisode(episodeId);
    if (allStages.length === 0) return;

    // Invariant: all stages must be in COMPLETED status (none PLANNED, SCHEDULED, IN_PROGRESS, ON_HOLD, CANCELLED)
    const allCompleted = allStages.every((s) => s.status === 'COMPLETED');
    if (!allCompleted) return;

    const previousStatus = episode.status;
    const updated = await this.episodeRepository.updateStatus(episodeId, 'COMPLETED', userId);
    if (!updated) return;

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_episode.status_updated',
      userId,
      {
        episodeId,
        previousStatus,
        newStatus: 'COMPLETED',
        triggeredBy: 'all_stages_completed',
      },
    );

    await this.patientRepository.addTimelineEvent(
      episode.patient_id,
      {
        event_type: 'OPD_DENTAL_EXAMINATION_COMPLETED',
        title: `Dental Treatment Episode Completed (${episode.episode_number})`,
        description: `All treatment stages completed for Episode ${episode.episode_number}${
          episode.primary_tooth_number ? ` on Tooth #${episode.primary_tooth_number}` : ''
        }.`,
      },
      userId,
    );
  }
}

