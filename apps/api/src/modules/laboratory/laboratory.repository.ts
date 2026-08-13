import { Types, type ClientSession } from 'mongoose';
import { LaboratoryResultModel, type LaboratoryResultFields } from './laboratory-result.model.js';
import type { SaveLaboratoryResultDTO } from './laboratory.types.js';

type LaboratoryResultLean = LaboratoryResultFields & { _id: Types.ObjectId };
const objectId = (value: string) => new Types.ObjectId(value);
const nullable = (value?: string | null) => value?.trim() || null;

const toResult = (record: LaboratoryResultLean) => ({
  id: record._id.toString(),
  order_id: record.orderId.toString(),
  patient_id: record.patientId.toString(),
  visit_id: record.visitId.toString(),
  result_items: record.resultItems.map((item) => ({
    service_id: item.serviceId.toString(),
    service_name: item.serviceName,
    value: item.value,
    unit: item.unit ?? null,
    reference_range: item.referenceRange ?? null,
    comments: item.comments ?? null,
  })),
  remarks: record.remarks ?? null,
  entered_by: record.enteredBy.toString(),
  entered_at: record.enteredAt,
  verified_by: record.verifiedBy?.toString() ?? null,
  verified_at: record.verifiedAt ?? null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const resultItems = (data: SaveLaboratoryResultDTO) => data.result_items.map((item) => ({
  serviceId: objectId(item.service_id),
  serviceName: item.service_name.trim(),
  value: item.value.trim(),
  unit: nullable(item.unit),
  referenceRange: nullable(item.reference_range),
  comments: nullable(item.comments),
}));

export class LaboratoryRepository {
  async getResult(orderId: string, session?: ClientSession) {
    const query = LaboratoryResultModel.findOne({ orderId: objectId(orderId), deletedAt: null })
      .lean<LaboratoryResultLean>();
    if (session) query.session(session);
    const record = await query;
    return record ? toResult(record) : null;
  }

  async createResult(
    order: { id: string; patient_id: string; visit_id: string },
    data: SaveLaboratoryResultDTO,
    actorUserId: string,
    session: ClientSession,
  ) {
    const now = new Date();
    const record = new LaboratoryResultModel({
      orderId: objectId(order.id), patientId: objectId(order.patient_id), visitId: objectId(order.visit_id),
      resultItems: resultItems(data), remarks: nullable(data.remarks), enteredBy: objectId(actorUserId), enteredAt: now,
      createdBy: objectId(actorUserId), updatedBy: objectId(actorUserId),
    });
    await record.save({ session });
    return toResult(record.toObject() as LaboratoryResultLean);
  }

  async updateResult(orderId: string, data: SaveLaboratoryResultDTO, actorUserId: string, session: ClientSession) {
    const record = await LaboratoryResultModel.findOneAndUpdate(
      { orderId: objectId(orderId), deletedAt: null, verifiedAt: null },
      { $set: { resultItems: resultItems(data), remarks: nullable(data.remarks), updatedBy: objectId(actorUserId) } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<LaboratoryResultLean>();
    return record ? toResult(record) : null;
  }

  async verifyResult(orderId: string, actorUserId: string, session: ClientSession) {
    const record = await LaboratoryResultModel.findOneAndUpdate(
      { orderId: objectId(orderId), deletedAt: null, verifiedAt: null },
      { $set: { verifiedBy: objectId(actorUserId), verifiedAt: new Date(), updatedBy: objectId(actorUserId) } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<LaboratoryResultLean>();
    return record ? toResult(record) : null;
  }
}
