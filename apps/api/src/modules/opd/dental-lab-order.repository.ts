import { Types, type ClientSession } from 'mongoose';
import {
  DentalProstheticLabOrderModel,
  type DentalProstheticLabOrderFields,
} from './dental-lab-order.model.js';
import type { DentalProstheticLabOrder } from './dental-lab-order.types.js';

type DentalProstheticLabOrderLean = DentalProstheticLabOrderFields & { _id: Types.ObjectId };

const requiredObjectId = (value: string) => new Types.ObjectId(value);

const toDomainLabOrder = (doc: DentalProstheticLabOrderLean): DentalProstheticLabOrder => ({
  id: doc._id.toString(),
  order_number: doc.orderNumber,
  patient_id: doc.patientId.toString(),
  treatment_episode_id: doc.treatmentEpisodeId.toString(),
  treatment_stage_id: doc.treatmentStageId.toString(),
  treatment_plan_item_id: doc.treatmentPlanItemId ?? null,
  tooth_number: doc.toothNumber ?? null,
  prosthetic_type: doc.prostheticType,
  description: doc.description,
  assigned_lab_id: doc.assignedLabId ? doc.assignedLabId.toString() : null,
  requested_by: doc.requestedBy.toString(),
  requested_by_name: doc.requestedByName ?? null,
  requested_at: doc.requestedAt,
  status: doc.status,
  received_at: doc.receivedAt ?? null,
  in_progress_at: doc.inProgressAt ?? null,
  quality_check_at: doc.qualityCheckAt ?? null,
  ready_at: doc.readyAt ?? null,
  cancelled_at: doc.cancelledAt ?? null,
  status_remarks: doc.statusRemarks ?? null,
  cancellation_reason: doc.cancellationReason ?? null,
  branch_id: doc.branchId.toString(),
  department_id: doc.departmentId.toString(),
  created_by: doc.createdBy?.toString() ?? null,
  updated_by: doc.updatedBy?.toString() ?? null,
  created_at: doc.createdAt,
  updated_at: doc.updatedAt,
});

export class DentalLabOrderRepository {
  async create(
    record: Omit<DentalProstheticLabOrderFields, 'createdAt' | 'updatedAt'>,
    session?: ClientSession,
  ): Promise<DentalProstheticLabOrder> {
    const [created] = await DentalProstheticLabOrderModel.create([record], { session });
    if (!created) {
      throw new Error('Failed to create dental prosthetic lab order');
    }
    return toDomainLabOrder(created.toObject() as DentalProstheticLabOrderLean);
  }

  async getById(id: string, session?: ClientSession): Promise<DentalProstheticLabOrder | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await DentalProstheticLabOrderModel.findOne({
      _id: requiredObjectId(id),
      deletedAt: null,
    })
      .session(session ?? null)
      .lean();
    return doc ? toDomainLabOrder(doc as DentalProstheticLabOrderLean) : null;
  }

  async updateStatus(
    id: string,
    updates: Partial<DentalProstheticLabOrderFields>,
    session?: ClientSession,
  ): Promise<DentalProstheticLabOrder | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await DentalProstheticLabOrderModel.findOneAndUpdate(
      {
        _id: requiredObjectId(id),
        deletedAt: null,
      },
      {
        $set: updates,
      },
      {
        new: true,
        session: session ?? null,
      },
    ).lean();
    return doc ? toDomainLabOrder(doc as DentalProstheticLabOrderLean) : null;
  }

  async listByEpisode(
    episodeId: string,
    session?: ClientSession,
  ): Promise<DentalProstheticLabOrder[]> {
    if (!Types.ObjectId.isValid(episodeId)) return [];
    const docs = await DentalProstheticLabOrderModel.find({
      treatmentEpisodeId: requiredObjectId(episodeId),
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .session(session ?? null)
      .lean();
    return docs.map((d) => toDomainLabOrder(d as DentalProstheticLabOrderLean));
  }

  async listByStage(
    stageId: string,
    session?: ClientSession,
  ): Promise<DentalProstheticLabOrder[]> {
    if (!Types.ObjectId.isValid(stageId)) return [];
    const docs = await DentalProstheticLabOrderModel.find({
      treatmentStageId: requiredObjectId(stageId),
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .session(session ?? null)
      .lean();
    return docs.map((d) => toDomainLabOrder(d as DentalProstheticLabOrderLean));
  }
}
