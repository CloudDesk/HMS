import { Types, type ClientSession } from 'mongoose';
import { LaboratoryResultModel, type LaboratoryResultFields } from './laboratory-result.model.js';
import type { SaveLaboratoryResultDTO } from './laboratory.types.js';
import type { OpdClinicalOrder } from '../opd/opd-clinical-order.types.js';

type LaboratoryResultLean = LaboratoryResultFields & { _id: Types.ObjectId };
type LaboratoryOrderContext = Pick<OpdClinicalOrder,
  'id' | 'patient_id' | 'visit_id' | 'source_type' | 'source_id'> & { encounter_id: string | null; admission_id: string | null; procedure_id: string | null; };
const objectId = (value: string) => new Types.ObjectId(value);
const nullable = (value?: string | null) => value?.trim() || null;

const toResult = (record: LaboratoryResultLean) => ({
  id: record._id.toString(),
  order_id: record.orderId.toString(),
  source_type: record.sourceType ?? 'OPD_VISIT',
  encounter_id: record.encounterId?.toString() ?? record.visitId?.toString() ?? null,
  admission_id: record.admissionId?.toString() ?? null,
  procedure_id: record.procedureId?.toString() ?? null,
  patient_id: record.patientId.toString(),
  visit_id: record.visitId?.toString() ?? null,
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
    order: LaboratoryOrderContext,
    data: SaveLaboratoryResultDTO,
    actorUserId: string,
    session: ClientSession,
  ) {
    const now = new Date();
    const record = new LaboratoryResultModel({
      orderId: objectId(order.id), patientId: objectId(order.patient_id), visitId: order.visit_id ? objectId(order.visit_id) : null,
      sourceType: order.source_type,
      encounterId: order.encounter_id ? objectId(order.encounter_id) : null,
      admissionId: order.admission_id ? objectId(order.admission_id) : null,
      procedureId: order.procedure_id ? objectId(order.procedure_id) : null,
      resultItems: resultItems(data), remarks: nullable(data.remarks), enteredBy: objectId(actorUserId), enteredAt: now,
      createdBy: objectId(actorUserId), updatedBy: objectId(actorUserId),
    });
    await record.save({ session });
    return toResult(record.toObject() as LaboratoryResultLean);
  }

  async updateResult(order: LaboratoryOrderContext, data: SaveLaboratoryResultDTO, actorUserId: string, session: ClientSession) {
    const record = await LaboratoryResultModel.findOneAndUpdate(
      { orderId: objectId(order.id), deletedAt: null, verifiedAt: null },
      { $set: {
        sourceType: order.source_type,
        encounterId: order.encounter_id ? objectId(order.encounter_id) : null,
        admissionId: order.admission_id ? objectId(order.admission_id) : null,
        procedureId: order.procedure_id ? objectId(order.procedure_id) : null,
        resultItems: resultItems(data), remarks: nullable(data.remarks), updatedBy: objectId(actorUserId),
      } },
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
