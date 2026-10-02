import { Types, type ClientSession } from 'mongoose';
import { ImagingReportModel, type ImagingReportFields, type ImagingAttachmentFields } from './imaging-report.model.js';
import type { ImagingAttachment, SaveImagingAttachmentDTO, SaveImagingReportDTO } from './imaging.types.js';
import type { ClinicalOrderDentalContext, OpdClinicalOrder } from '../opd/opd-clinical-order.types.js';

type ImagingReportLean = ImagingReportFields & { _id: Types.ObjectId };
type ImagingOrderContext = Pick<OpdClinicalOrder, 'id' | 'patient_id' | 'visit_id' | 'source_type'> & {
  encounter_id: string | null;
  admission_id: string | null;
  procedure_id: string | null;
  dental_context?: ClinicalOrderDentalContext | null;
};
const objectId = (value: string) => new Types.ObjectId(value);
const nullable = (value?: string | null) => value?.trim() || null;

const toAttachment = (record: ImagingAttachmentFields): ImagingAttachment => ({
  id: record._id.toString(),
  file_name: record.fileName,
  file_size_bytes: record.fileSizeBytes ?? null,
  mime_type: record.mimeType,
  storage_key: record.storageKey,
  file_url: record.fileUrl ?? null,
  uploaded_at: record.uploadedAt,
  uploaded_by: record.uploadedBy?.toString() ?? null,
});

const toAttachmentFields = (att: SaveImagingAttachmentDTO, actorUserId?: string): ImagingAttachmentFields => ({
  _id: new Types.ObjectId(),
  fileName: att.file_name.trim(),
  fileSizeBytes: att.file_size_bytes ?? null,
  mimeType: att.mime_type.trim(),
  storageKey: att.storage_key.trim(),
  fileUrl: att.file_url?.trim() || null,
  uploadedAt: new Date(),
  uploadedBy: actorUserId ? objectId(actorUserId) : null,
});

const toDentalContextFields = (ctx?: ClinicalOrderDentalContext | null) => {
  if (!ctx) return null;
  return {
    treatmentEpisodeId: ctx.treatment_episode_id ? objectId(ctx.treatment_episode_id) : null,
    treatmentStageId: ctx.treatment_stage_id ? objectId(ctx.treatment_stage_id) : null,
    toothNumber: typeof ctx.tooth_number === 'number' ? ctx.tooth_number : null,
  };
};

const toReport = (record: ImagingReportLean) => ({
  id: record._id.toString(), order_id: record.orderId.toString(), patient_id: record.patientId.toString(),
  source_type: record.sourceType ?? 'OPD_VISIT', encounter_id: record.encounterId?.toString() ?? record.visitId?.toString() ?? null,
  admission_id: record.admissionId?.toString() ?? null, procedure_id: record.procedureId?.toString() ?? null,
  visit_id: record.visitId?.toString() ?? null, findings: record.findings, impression: record.impression,
  recommendations: record.recommendations ?? null,
  attachments: (record.attachments || []).map(toAttachment),
  dental_context: record.dentalContext ? {
    treatment_episode_id: record.dentalContext.treatmentEpisodeId?.toString() ?? null,
    treatment_stage_id: record.dentalContext.treatmentStageId?.toString() ?? null,
    tooth_number: record.dentalContext.toothNumber ?? null,
  } : null,
  entered_by: record.enteredBy.toString(), entered_at: record.enteredAt,
  verified_by: record.verifiedBy?.toString() ?? null, verified_at: record.verifiedAt ?? null,
  created_at: record.createdAt, updated_at: record.updatedAt,
});

export class ImagingRepository {
  async getReport(orderId: string, session?: ClientSession) {
    const query = ImagingReportModel.findOne({ orderId: objectId(orderId), deletedAt: null }).lean<ImagingReportLean>();
    if (session) query.session(session);
    const record = await query;
    return record ? toReport(record) : null;
  }

  async createReport(
    order: ImagingOrderContext, data: SaveImagingReportDTO,
    actorUserId: string, session?: ClientSession,
  ) {
    const now = new Date();
    const record = new ImagingReportModel({
      orderId: objectId(order.id), patientId: objectId(order.patient_id), visitId: order.visit_id ? objectId(order.visit_id) : null,
      sourceType: order.source_type, encounterId: order.encounter_id ? objectId(order.encounter_id) : null,
      admissionId: order.admission_id ? objectId(order.admission_id) : null,
      procedureId: order.procedure_id ? objectId(order.procedure_id) : null,
      findings: data.findings.trim(), impression: data.impression.trim(), recommendations: nullable(data.recommendations),
      attachments: (data.attachments ?? []).map((att) => toAttachmentFields(att, actorUserId)),
      dentalContext: toDentalContextFields(order.dental_context),
      enteredBy: objectId(actorUserId), enteredAt: now, createdBy: objectId(actorUserId), updatedBy: objectId(actorUserId),
    });
    await record.save({ session: session ?? undefined });
    return toReport(record.toObject() as ImagingReportLean);
  }

  async updateReport(order: ImagingOrderContext, data: SaveImagingReportDTO, actorUserId: string, session?: ClientSession) {
    const updateSet: Record<string, unknown> = {
      sourceType: order.source_type, encounterId: order.encounter_id ? objectId(order.encounter_id) : null,
      admissionId: order.admission_id ? objectId(order.admission_id) : null,
      procedureId: order.procedure_id ? objectId(order.procedure_id) : null,
      findings: data.findings.trim(), impression: data.impression.trim(), recommendations: nullable(data.recommendations),
      updatedBy: objectId(actorUserId),
    };
    if (order.dental_context !== undefined) {
      updateSet.dentalContext = toDentalContextFields(order.dental_context);
    }
    if (data.attachments !== undefined && data.attachments !== null) {
      updateSet.attachments = data.attachments.map((att) => toAttachmentFields(att, actorUserId));
    }
    const record = await ImagingReportModel.findOneAndUpdate(
      { orderId: objectId(order.id), deletedAt: null, verifiedAt: null },
      { $set: updateSet },
      { returnDocument: 'after', lean: true, runValidators: true, session: session ?? undefined },
    ).lean<ImagingReportLean>();
    return record ? toReport(record) : null;
  }

  async addAttachmentToReport(orderId: string, attachment: SaveImagingAttachmentDTO, actorUserId: string, session?: ClientSession) {
    const attField = toAttachmentFields(attachment, actorUserId);
    const record = await ImagingReportModel.findOneAndUpdate(
      { orderId: objectId(orderId), deletedAt: null },
      {
        $push: { attachments: attField },
        $set: { updatedBy: objectId(actorUserId) },
      },
      { returnDocument: 'after', lean: true, session: session ?? undefined },
    ).lean<ImagingReportLean>();
    return record ? toReport(record) : null;
  }

  async getAttachment(orderId: string, attachmentId: string) {
    const report = await ImagingReportModel.findOne(
      { orderId: objectId(orderId), deletedAt: null, 'attachments._id': objectId(attachmentId) },
      { 'attachments.$': 1 },
    ).lean<ImagingReportLean>();
    const att = report?.attachments?.[0];
    return att ? toAttachment(att) : null;
  }

  async verifyReport(orderId: string, actorUserId: string, session?: ClientSession) {
    const record = await ImagingReportModel.findOneAndUpdate(
      { orderId: objectId(orderId), deletedAt: null, verifiedAt: null },
      { $set: { verifiedBy: objectId(actorUserId), verifiedAt: new Date(), updatedBy: objectId(actorUserId) } },
      { returnDocument: 'after', lean: true, runValidators: true, session: session ?? undefined },
    ).lean<ImagingReportLean>();
    return record ? toReport(record) : null;
  }
}

