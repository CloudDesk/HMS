import { Types, type ClientSession } from 'mongoose';
import { DentalTreatmentStageModel, type DentalTreatmentStageFields } from './dental-stage.model.js';
import type { DentalStageStatus, DentalTreatmentStage } from './dental-stage.types.js';

type DentalTreatmentStageLean = DentalTreatmentStageFields & { _id: Types.ObjectId };

const requiredObjectId = (value: string) => new Types.ObjectId(value);

const toDomainStage = (doc: DentalTreatmentStageLean): DentalTreatmentStage => ({
  id: doc._id.toString(),
  episode_id: doc.episodeId.toString(),
  plan_item_id: doc.planItemId,
  tooth_number: doc.toothNumber ?? null,
  service_id: doc.serviceId ? doc.serviceId.toString() : null,
  stage_name: doc.stageName,
  sequence: doc.sequence,
  assigned_doctor_id: doc.assignedDoctorId.toString(),
  assigned_doctor_name: doc.assignedDoctorName,
  status: doc.status,
  planned_date: doc.plannedDate ?? null,
  completed_at: doc.completedAt ?? null,
  completed_by_doctor_id: doc.completedByDoctorId ? doc.completedByDoctorId.toString() : null,
  completed_by_doctor_name: doc.completedByDoctorName ?? null,
  appointment_id: doc.appointmentId ? doc.appointmentId.toString() : null,
  prosthetic_lab_order_id: doc.prostheticLabOrderId ? doc.prostheticLabOrderId.toString() : null,
  notes: doc.notes ?? null,
  branch_id: doc.branchId.toString(),
  department_id: doc.departmentId.toString(),
  patient_id: doc.patientId.toString(),
  created_by: doc.createdBy?.toString() ?? null,
  updated_by: doc.updatedBy?.toString() ?? null,
  created_at: doc.createdAt,
  updated_at: doc.updatedAt,
});

export class DentalStageRepository {
  async create(
    record: Omit<DentalTreatmentStageFields, 'createdAt' | 'updatedAt'>,
    session?: ClientSession,
  ): Promise<DentalTreatmentStage> {
    const [created] = await DentalTreatmentStageModel.create([record], { session });
    if (!created) {
      throw new Error('Failed to create dental treatment stage');
    }
    return toDomainStage(created.toObject() as DentalTreatmentStageLean);
  }

  async getById(id: string, session?: ClientSession): Promise<DentalTreatmentStage | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await DentalTreatmentStageModel.findOne({
      _id: requiredObjectId(id),
      deletedAt: null,
    })
      .session(session ?? null)
      .lean();
    return doc ? toDomainStage(doc as DentalTreatmentStageLean) : null;
  }

  async updateProstheticLabOrder(
    id: string,
    labOrderId: string | null,
    session?: ClientSession,
  ): Promise<DentalTreatmentStage | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await DentalTreatmentStageModel.findOneAndUpdate(
      { _id: requiredObjectId(id), deletedAt: null },
      {
        $set: {
          prostheticLabOrderId: labOrderId ? requiredObjectId(labOrderId) : null,
        },
      },
      { new: true, session: session ?? null },
    ).lean();
    return doc ? toDomainStage(doc as DentalTreatmentStageLean) : null;
  }

  async listByEpisode(
    episodeId: string,
    planItemId?: string,
    session?: ClientSession,
  ): Promise<DentalTreatmentStage[]> {
    if (!Types.ObjectId.isValid(episodeId)) return [];
    const query: Record<string, unknown> = {
      episodeId: requiredObjectId(episodeId),
      deletedAt: null,
    };
    if (planItemId) {
      query.planItemId = planItemId;
    }

    const docs = await DentalTreatmentStageModel.find(query)
      .sort({ planItemId: 1, sequence: 1, createdAt: 1 })
      .session(session ?? null)
      .lean();

    return docs.map((d) => toDomainStage(d as DentalTreatmentStageLean));
  }

  async listByPlanItem(
    episodeId: string,
    planItemId: string,
    session?: ClientSession,
  ): Promise<DentalTreatmentStage[]> {
    return this.listByEpisode(episodeId, planItemId, session);
  }

  async getMaxSequence(
    episodeId: string,
    planItemId: string,
    session?: ClientSession,
  ): Promise<number> {
    if (!Types.ObjectId.isValid(episodeId)) return 0;
    const doc = await DentalTreatmentStageModel.findOne({
      episodeId: requiredObjectId(episodeId),
      planItemId,
      deletedAt: null,
    })
      .sort({ sequence: -1 })
      .session(session ?? null)
      .lean();

    return doc ? doc.sequence : 0;
  }

  async updateStatus(
    stageId: string,
    data: {
      status: DentalStageStatus;
      completedAt?: Date | null;
      completedByDoctorId?: Types.ObjectId | null;
      completedByDoctorName?: string | null;
      notes?: string | null;
      updatedBy: string;
    },
    session?: ClientSession,
  ): Promise<DentalTreatmentStage | null> {
    if (!Types.ObjectId.isValid(stageId)) return null;
    const updateOps: Record<string, unknown> = {
      status: data.status,
      updatedBy: requiredObjectId(data.updatedBy),
    };
    if (data.completedAt !== undefined) {
      updateOps.completedAt = data.completedAt;
    }
    if (data.completedByDoctorId !== undefined) {
      updateOps.completedByDoctorId = data.completedByDoctorId;
    }
    if (data.completedByDoctorName !== undefined) {
      updateOps.completedByDoctorName = data.completedByDoctorName;
    }
    if (data.notes !== undefined) {
      updateOps.notes = data.notes;
    }

    const updated = await DentalTreatmentStageModel.findOneAndUpdate(
      { _id: requiredObjectId(stageId), deletedAt: null },
      { $set: updateOps },
      { new: true, session: session ?? null },
    ).lean();

    return updated ? toDomainStage(updated as DentalTreatmentStageLean) : null;
  }

  async assignDoctor(
    stageId: string,
    data: {
      doctorId: string;
      doctorName: string;
      notes?: string | null;
      updatedBy: string;
    },
    session?: ClientSession,
  ): Promise<DentalTreatmentStage | null> {
    if (!Types.ObjectId.isValid(stageId)) return null;
    const updateOps: Record<string, unknown> = {
      assignedDoctorId: requiredObjectId(data.doctorId),
      assignedDoctorName: data.doctorName,
      updatedBy: requiredObjectId(data.updatedBy),
    };
    if (data.notes !== undefined) {
      updateOps.notes = data.notes;
    }

    const updated = await DentalTreatmentStageModel.findOneAndUpdate(
      { _id: requiredObjectId(stageId), deletedAt: null },
      { $set: updateOps },
      { new: true, session: session ?? null },
    ).lean();

    return updated ? toDomainStage(updated as DentalTreatmentStageLean) : null;
  }

  async deleteStage(
    stageId: string,
    deletedBy: string,
    session?: ClientSession,
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(stageId)) return false;
    const res = await DentalTreatmentStageModel.updateOne(
      { _id: requiredObjectId(stageId), deletedAt: null },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: requiredObjectId(deletedBy),
        },
      },
      session ? { session } : undefined,
    );
    return res.modifiedCount > 0;
  }

  async linkAppointment(
    stageId: string,
    appointmentId: string,
    status: DentalStageStatus,
    doctorId?: string,
    doctorName?: string,
    updatedBy?: string,
    session?: ClientSession,
  ): Promise<DentalTreatmentStage | null> {
    if (!Types.ObjectId.isValid(stageId)) return null;
    const updateOps: Record<string, unknown> = {
      appointmentId: requiredObjectId(appointmentId),
      status,
    };
    if (doctorId && doctorName) {
      updateOps.assignedDoctorId = requiredObjectId(doctorId);
      updateOps.assignedDoctorName = doctorName;
    }
    if (updatedBy) {
      updateOps.updatedBy = requiredObjectId(updatedBy);
    }
    const updated = await DentalTreatmentStageModel.findOneAndUpdate(
      { _id: requiredObjectId(stageId), deletedAt: null },
      { $set: updateOps },
      { returnDocument: 'after', session: session ?? null },
    ).lean();
    return updated ? toDomainStage(updated as DentalTreatmentStageLean) : null;
  }

  async clearAppointment(
    stageId: string,
    revertStatus: DentalStageStatus = 'PLANNED',
    updatedBy?: string,
    session?: ClientSession,
  ): Promise<DentalTreatmentStage | null> {
    if (!Types.ObjectId.isValid(stageId)) return null;
    const updateOps: Record<string, unknown> = {
      appointmentId: null,
      status: revertStatus,
    };
    if (updatedBy) {
      updateOps.updatedBy = requiredObjectId(updatedBy);
    }
    const updated = await DentalTreatmentStageModel.findOneAndUpdate(
      { _id: requiredObjectId(stageId), deletedAt: null },
      { $set: updateOps },
      { returnDocument: 'after', session: session ?? null },
    ).lean();
    return updated ? toDomainStage(updated as DentalTreatmentStageLean) : null;
  }
}
