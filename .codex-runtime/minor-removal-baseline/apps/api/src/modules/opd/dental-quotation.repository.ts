import { Types, type ClientSession } from 'mongoose';
import {
  DentalTreatmentQuotationModel,
  type DentalQuotationItemFields,
  type DentalQuotationOptionFields,
  type DentalTreatmentQuotationFields,
} from './dental-quotation.model.js';
import type {
  DentalQuotationItem,
  DentalTreatmentQuotation,
} from './dental-quotation.types.js';

type DentalTreatmentQuotationLean = Omit<DentalTreatmentQuotationFields, 'items' | 'options'> & {
  _id: Types.ObjectId;
  items: (DentalQuotationItemFields & { _id?: Types.ObjectId })[];
  options?: (Omit<DentalQuotationOptionFields, 'items'> & {
    _id?: Types.ObjectId;
    items: (DentalQuotationItemFields & { _id?: Types.ObjectId })[];
  })[];
};

const requiredObjectId = (value: string) => new Types.ObjectId(value);

const mapItemToDomain = (it: DentalQuotationItemFields & { _id?: Types.ObjectId }): DentalQuotationItem => ({
  id: it._id?.toString(),
  treatment_plan_item_id: it.treatmentPlanItemId ?? null,
  service_id: it.serviceId?.toString() ?? null,
  procedure_name: it.procedureName,
  tooth_number: it.toothNumber ?? null,
  quantity: it.quantity,
  unit_price: it.unitPrice,
  discount_amount: it.discountAmount,
  tax_amount: it.taxAmount,
  line_total: it.lineTotal,
  notes: it.notes ?? null,
});

const toDomainQuotation = (doc: DentalTreatmentQuotationLean): DentalTreatmentQuotation => ({
  id: doc._id.toString(),
  quotation_number: doc.quotationNumber,
  patient_id: doc.patientId.toString(),
  patient_number: doc.patientNumber,
  patient_name: doc.patientName,
  treatment_episode_id: doc.treatmentEpisodeId.toString(),
  treatment_episode_number: doc.treatmentEpisodeNumber ?? null,
  doctor_id: doc.doctorId.toString(),
  doctor_name: doc.doctorName,
  branch_id: doc.branchId.toString(),
  department_id: doc.departmentId.toString(),
  status: doc.status,
  currency: doc.currency,
  subtotal: doc.subtotal,
  discount_amount: doc.discountAmount,
  tax_amount: doc.taxAmount,
  total: doc.total,
  notes: doc.notes ?? null,
  valid_until: doc.validUntil ?? null,
  items: (doc.items ?? []).map(mapItemToDomain),
  options: (doc.options ?? []).map((opt) => ({
    id: opt._id?.toString(),
    name: opt.name,
    description: opt.description ?? null,
    sequence: opt.sequence,
    items: (opt.items ?? []).map(mapItemToDomain),
    subtotal: opt.subtotal,
    discount_amount: opt.discountAmount,
    tax_amount: opt.taxAmount,
    total: opt.total,
  })),
  selected_option_id: doc.selectedOptionId?.toString() ?? null,
  selected_option_name: doc.selectedOptionName ?? null,
  accepted_at: doc.acceptedAt ?? null,
  accepted_by: doc.acceptedBy?.toString() ?? null,
  decision_reason: doc.decisionReason ?? null,
  decision_at: doc.decisionAt ?? null,
  sent_at: doc.sentAt ?? null,
  sent_by: doc.sentBy?.toString() ?? null,
  created_by: doc.createdBy?.toString() ?? null,
  updated_by: doc.updatedBy?.toString() ?? null,
  created_at: doc.createdAt,
  updated_at: doc.updatedAt,
});

export class DentalQuotationRepository {
  async create(
    record: Omit<DentalTreatmentQuotationFields, 'createdAt' | 'updatedAt'>,
    session?: ClientSession,
  ): Promise<DentalTreatmentQuotation> {
    const doc = new DentalTreatmentQuotationModel(record);
    if (session) {
      await doc.save({ session });
    } else {
      await doc.save();
    }
    return toDomainQuotation(doc.toObject() as DentalTreatmentQuotationLean);
  }

  async update(
    id: string,
    updateData: Partial<DentalTreatmentQuotationFields>,
    session?: ClientSession,
  ): Promise<DentalTreatmentQuotation | null> {
    const query = DentalTreatmentQuotationModel.findOneAndUpdate(
      { _id: requiredObjectId(id), deletedAt: null },
      { $set: updateData },
      { returnDocument: 'after', lean: true },
    );
    if (session) query.session(session);
    const doc = await query;
    return doc ? toDomainQuotation(doc as unknown as DentalTreatmentQuotationLean) : null;
  }

  async getById(id: string, session?: ClientSession): Promise<DentalTreatmentQuotation | null> {
    const query = DentalTreatmentQuotationModel.findOne({
      _id: requiredObjectId(id),
      deletedAt: null,
    }).lean<DentalTreatmentQuotationLean>();
    if (session) query.session(session);
    const doc = await query;
    return doc ? toDomainQuotation(doc) : null;
  }

  async getByQuotationNumber(
    quotationNumber: string,
    session?: ClientSession,
  ): Promise<DentalTreatmentQuotation | null> {
    const query = DentalTreatmentQuotationModel.findOne({
      quotationNumber: quotationNumber.trim(),
      deletedAt: null,
    }).lean<DentalTreatmentQuotationLean>();
    if (session) query.session(session);
    const doc = await query;
    return doc ? toDomainQuotation(doc) : null;
  }

  async listByEpisode(
    episodeId: string,
    session?: ClientSession,
  ): Promise<DentalTreatmentQuotation[]> {
    const query = DentalTreatmentQuotationModel.find({
      treatmentEpisodeId: requiredObjectId(episodeId),
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .lean<DentalTreatmentQuotationLean[]>();
    if (session) query.session(session);
    const docs = await query;
    return docs.map(toDomainQuotation);
  }

  async listByPatient(
    patientId: string,
    session?: ClientSession,
  ): Promise<DentalTreatmentQuotation[]> {
    const query = DentalTreatmentQuotationModel.find({
      patientId: requiredObjectId(patientId),
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .lean<DentalTreatmentQuotationLean[]>();
    if (session) query.session(session);
    const docs = await query;
    return docs.map(toDomainQuotation);
  }
}

