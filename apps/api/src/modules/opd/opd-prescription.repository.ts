import { Types, type ClientSession, type PipelineStage } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import {
  OpdPrescriptionModel,
  type OpdPrescriptionFields,
  type OpdPrescriptionItemFields,
} from './opd-prescription.model.js';
import type {
  OpdPrescription,
  SaveOpdPrescriptionDTO,
  SaveOpdPrescriptionItemDTO,
} from './opd-prescription.types.js';
import type { OpdConsultation } from './opd-consultation.types.js';
import type { OpdVisit } from './opd-visit.types.js';
import { OpdVisitModel } from './opd-visit.model.js';

type OpdPrescriptionLean = OpdPrescriptionFields & { _id: Types.ObjectId };

type SaveOpdPrescriptionRecord = SaveOpdPrescriptionDTO & {
  consultation: OpdConsultation;
  status: OpdPrescription['status'];
  submittedAt?: Date | null;
  visit: OpdVisit;
};

const objectId = (value: string) => new Types.ObjectId(value);

const nullableString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const toItem = (item: OpdPrescriptionItemFields) => ({
  id: item._id.toString(),
  medicine_name: item.medicineName,
  strength: item.strength ?? null,
  dosage: item.dosage,
  route: item.route,
  frequency: item.frequency,
  duration: item.duration,
  quantity: item.quantity ?? null,
  instructions: item.instructions ?? null,
});

const toPrescription = (record: OpdPrescriptionLean): OpdPrescription => ({
  id: record._id.toString(),
  source_type: record.sourceType,
  source_id: record.sourceId.toString(),
  visit_id: record.visitId?.toString() ?? null,
  consultation_id: record.consultationId?.toString() ?? null,
  branch_id: record.branchId.toString(),
  patient_id: record.patientId.toString(),
  patient_number: record.patientNumber,
  patient_name: record.patientName,
  doctor_id: record.doctorId.toString(),
  doctor_name: record.doctorName,
  status: record.status,
  items: record.items.map(toItem),
  follow_up_date: record.followUpDate ?? null,
  doctor_instructions: record.doctorInstructions ?? null,
  patient_instructions: record.patientInstructions ?? null,
  submitted_at: record.submittedAt ?? null,
  created_by: record.createdBy?.toString() ?? null,
  updated_by: record.updatedBy?.toString() ?? null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const toItemFields = (item: SaveOpdPrescriptionItemDTO) => ({
  medicineName: item.medicine_name.trim(),
  strength: nullableString(item.strength),
  dosage: item.dosage.trim(),
  route: item.route.trim(),
  frequency: item.frequency.trim(),
  duration: item.duration.trim(),
  quantity: item.quantity ?? null,
  instructions: nullableString(item.instructions),
});

export class OpdPrescriptionRepository {
  async getById(id: string): Promise<OpdPrescription | null> {
    const record = await OpdPrescriptionModel.findOne({
      _id: objectId(id),
      deletedAt: null,
    }).lean<OpdPrescriptionLean>();

    return record ? toPrescription(record) : null;
  }

  async getByVisit(visitId: string): Promise<OpdPrescription | null> {
    const record = await OpdPrescriptionModel.findOne({
      visitId: objectId(visitId),
      deletedAt: null,
    }).lean<OpdPrescriptionLean>();

    return record ? toPrescription(record) : null;
  }

  async saveForVisit(data: SaveOpdPrescriptionRecord, userId: string): Promise<OpdPrescription> {
    const record = await OpdPrescriptionModel.findOneAndUpdate(
      { visitId: objectId(data.visit.id), deletedAt: null },
      {
        $set: {
          consultationId: objectId(data.consultation.id),
          status: data.status,
          items: data.items.map(toItemFields),
          followUpDate: data.follow_up_date ? new Date(data.follow_up_date) : null,
          doctorInstructions: nullableString(data.doctor_instructions),
          patientInstructions: nullableString(data.patient_instructions),
          submittedAt: data.submittedAt ?? null,
          updatedBy: objectId(userId),
        },
        $setOnInsert: {
          sourceType: 'OPD_VISIT',
          sourceId: objectId(data.visit.id),
          branchId: objectId(data.visit.branch_id),
          visitId: objectId(data.visit.id),
          patientId: objectId(data.visit.patient_id),
          patientNumber: data.visit.patient_number,
          patientName: data.visit.patient_name,
          doctorId: objectId(data.visit.doctor_id),
          doctorName: data.visit.doctor_name,
          createdBy: objectId(userId),
        },
      },
      { lean: true, returnDocument: 'after', upsert: true },
    ).lean<OpdPrescriptionLean>();

    if (!record) {
      throw new AppError('Prescription could not be saved', 500, 'PRESCRIPTION_SAVE_FAILED');
    }

    return toPrescription(record);
  }

  async submitForEmergency(data: {
    encounterId: string; patientId: string; patientNumber: string; patientName: string; doctorId: string; doctorName: string; branchId: string;
    items: SaveOpdPrescriptionItemDTO[]; doctorInstructions?: string | null; patientInstructions?: string | null;
  }, userId: string, session: ClientSession) {
    const record = await OpdPrescriptionModel.findOneAndUpdate(
      { sourceType: 'EMERGENCY_ENCOUNTER', sourceId: objectId(data.encounterId), deletedAt: null },
      { $set: { status: 'SUBMITTED', items: data.items.map(toItemFields), doctorInstructions: nullableString(data.doctorInstructions), patientInstructions: nullableString(data.patientInstructions), submittedAt: new Date(), updatedBy: objectId(userId) }, $setOnInsert: { sourceType: 'EMERGENCY_ENCOUNTER', sourceId: objectId(data.encounterId), visitId: null, consultationId: null, branchId: objectId(data.branchId), patientId: objectId(data.patientId), patientNumber: data.patientNumber, patientName: data.patientName, doctorId: objectId(data.doctorId), doctorName: data.doctorName, createdBy: objectId(userId) } },
      { new: true, upsert: true, runValidators: true, session },
    ).lean<OpdPrescriptionLean>();
    if (!record) throw new AppError('Emergency prescription could not be submitted', 500, 'PRESCRIPTION_SAVE_FAILED');
    return toPrescription(record);
  }
  async list(
    params: import('./opd-prescription.types.js').ListPrescriptionsParams,
    branchIds?: string[],
  ): Promise<{ data: OpdPrescription[]; total: number }> {
    const { status, limit = 50, skip = 0, search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const filter: any = { deletedAt: null };

    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: 'DRAFT' }; // by default, don't show drafts in queue
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { patientName: searchRegex },
        { patientNumber: searchRegex },
        { doctorName: searchRegex },
      ];
    }

    const sortConfig = { [sortBy]: sortOrder === 'asc' ? 1 : -1 } as Record<string, 1 | -1>;
    const scopePipeline: PipelineStage[] = branchIds
      ? [
          {
            $lookup: {
              from: OpdVisitModel.collection.name,
              localField: 'visitId',
              foreignField: '_id',
              pipeline: [
                {
                  $match: {
                    branchId: { $in: branchIds.map(objectId) },
                    deletedAt: null,
                  },
                },
              ],
              as: 'scopedVisit',
            },
          },
          { $match: { $or: [{ branchId: { $in: branchIds.map(objectId) } }, { 'scopedVisit.0': { $exists: true } }] } },
          { $unset: 'scopedVisit' },
        ]
      : [];

    const [records, countRows] = await Promise.all([
      OpdPrescriptionModel.aggregate<OpdPrescriptionLean>([
        { $match: filter },
        ...scopePipeline,
        { $sort: sortConfig },
        { $skip: skip },
        { $limit: limit },
      ]),
      OpdPrescriptionModel.aggregate<{ total: number }>([
        { $match: filter },
        ...scopePipeline,
        { $count: 'total' },
      ]),
    ]);

    return {
      data: records.map(toPrescription),
      total: countRows[0]?.total ?? 0,
    };
  }

  async updateStatus(id: string, status: import('./opd-prescription.types.js').OpdPrescriptionStatus, userId: string): Promise<OpdPrescription> {
    const record = await OpdPrescriptionModel.findOneAndUpdate(
      { _id: objectId(id), deletedAt: null },
      {
        $set: {
          status,
          updatedBy: objectId(userId),
        },
      },
      { lean: true, returnDocument: 'after' },
    ).lean<OpdPrescriptionLean>();

    if (!record) {
      throw new AppError('Prescription not found', 404, 'PRESCRIPTION_NOT_FOUND');
    }

    return toPrescription(record);
  }

  async updateStatusIf(
    id: string,
    currentStatus: import('./opd-prescription.types.js').OpdPrescriptionStatus,
    status: import('./opd-prescription.types.js').OpdPrescriptionStatus,
    userId: string,
    session: ClientSession,
  ) {
    return OpdPrescriptionModel.findOneAndUpdate(
      { _id: objectId(id), status: currentStatus, deletedAt: null },
      { $set: { status, updatedBy: objectId(userId) } },
      { returnDocument: 'after', lean: true, session },
    ).lean<OpdPrescriptionLean>();
  }
}
