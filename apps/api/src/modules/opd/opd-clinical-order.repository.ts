import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import {
  OpdClinicalOrderModel,
  type ClinicalOrderItemFields,
  type OpdClinicalOrderFields,
} from './opd-clinical-order.model.js';
import type {
  ClinicalOrderType,
  OpdClinicalOrder,
  SaveClinicalOrderItemDTO,
  SaveOpdClinicalOrderDTO,
} from './opd-clinical-order.types.js';
import type { OpdConsultation } from './opd-consultation.types.js';
import type { OpdVisit } from './opd-visit.types.js';

type OpdClinicalOrderLean = OpdClinicalOrderFields & { _id: Types.ObjectId };

type SaveClinicalOrderRecord = SaveOpdClinicalOrderDTO & {
  consultation: OpdConsultation;
  orderType: ClinicalOrderType;
  status: OpdClinicalOrder['status'];
  submittedAt?: Date | null;
  visit: OpdVisit;
};

const objectId = (value: string) => new Types.ObjectId(value);

const nullableString = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const toItem = (item: ClinicalOrderItemFields) => ({
  id: item._id.toString(),
  investigation_name: item.investigationName,
  category: item.category,
});

const toOrder = (record: OpdClinicalOrderLean): OpdClinicalOrder => ({
  id: record._id.toString(),
  visit_id: record.visitId.toString(),
  consultation_id: record.consultationId.toString(),
  patient_id: record.patientId.toString(),
  patient_number: record.patientNumber,
  patient_name: record.patientName,
  doctor_id: record.doctorId.toString(),
  doctor_name: record.doctorName,
  order_type: record.orderType,
  status: record.status,
  priority: record.priority,
  destination: record.destination ?? null,
  specimen_type: record.specimenType ?? null,
  items: record.items.map(toItem),
  clinical_notes: record.clinicalNotes ?? null,
  instructions: record.instructions ?? null,
  submitted_at: record.submittedAt ?? null,
  created_by: record.createdBy?.toString() ?? null,
  updated_by: record.updatedBy?.toString() ?? null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const toItemFields = (item: SaveClinicalOrderItemDTO) => ({
  investigationName: item.investigation_name.trim(),
  category: item.category.trim(),
});

export class OpdClinicalOrderRepository {
  async getByVisitAndType(visitId: string, orderType: ClinicalOrderType): Promise<OpdClinicalOrder | null> {
    const record = await OpdClinicalOrderModel.findOne({
      visitId: objectId(visitId),
      orderType,
      deletedAt: null,
    }).lean<OpdClinicalOrderLean>();

    return record ? toOrder(record) : null;
  }

  async saveForVisit(data: SaveClinicalOrderRecord, userId: string): Promise<OpdClinicalOrder> {
    const record = await OpdClinicalOrderModel.findOneAndUpdate(
      { visitId: objectId(data.visit.id), orderType: data.orderType, deletedAt: null },
      {
        $set: {
          consultationId: objectId(data.consultation.id),
          status: data.status,
          priority: data.priority,
          destination: nullableString(data.destination),
          specimenType: data.orderType === 'LABORATORY' ? nullableString(data.specimen_type) : null,
          items: data.items.map(toItemFields),
          clinicalNotes: nullableString(data.clinical_notes),
          instructions: nullableString(data.instructions),
          submittedAt: data.submittedAt ?? null,
          updatedBy: objectId(userId),
        },
        $setOnInsert: {
          visitId: objectId(data.visit.id),
          patientId: objectId(data.visit.patient_id),
          patientNumber: data.visit.patient_number,
          patientName: data.visit.patient_name,
          doctorId: objectId(data.visit.doctor_id),
          doctorName: data.visit.doctor_name,
          orderType: data.orderType,
          createdBy: objectId(userId),
        },
      },
      { lean: true, returnDocument: 'after', upsert: true },
    ).lean<OpdClinicalOrderLean>();

    if (!record) {
      throw new AppError('Clinical order could not be saved', 500, 'CLINICAL_ORDER_SAVE_FAILED');
    }

    return toOrder(record);
  }
}
