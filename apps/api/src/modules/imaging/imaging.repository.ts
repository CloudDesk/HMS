import { Types, type ClientSession } from 'mongoose';
import { ImagingReportModel, type ImagingReportFields } from './imaging-report.model.js';
import type { SaveImagingReportDTO } from './imaging.types.js';

type ImagingReportLean = ImagingReportFields & { _id: Types.ObjectId };
const objectId = (value: string) => new Types.ObjectId(value);
const nullable = (value?: string | null) => value?.trim() || null;
const toReport = (record: ImagingReportLean) => ({
  id: record._id.toString(), order_id: record.orderId.toString(), patient_id: record.patientId.toString(),
  visit_id: record.visitId.toString(), findings: record.findings, impression: record.impression,
  recommendations: record.recommendations ?? null, entered_by: record.enteredBy.toString(), entered_at: record.enteredAt,
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
    order: { id: string; patient_id: string; visit_id: string }, data: SaveImagingReportDTO,
    actorUserId: string, session: ClientSession,
  ) {
    const now = new Date();
    const record = new ImagingReportModel({
      orderId: objectId(order.id), patientId: objectId(order.patient_id), visitId: objectId(order.visit_id),
      findings: data.findings.trim(), impression: data.impression.trim(), recommendations: nullable(data.recommendations),
      enteredBy: objectId(actorUserId), enteredAt: now, createdBy: objectId(actorUserId), updatedBy: objectId(actorUserId),
    });
    await record.save({ session });
    return toReport(record.toObject() as ImagingReportLean);
  }

  async updateReport(orderId: string, data: SaveImagingReportDTO, actorUserId: string, session: ClientSession) {
    const record = await ImagingReportModel.findOneAndUpdate(
      { orderId: objectId(orderId), deletedAt: null, verifiedAt: null },
      { $set: {
        findings: data.findings.trim(), impression: data.impression.trim(), recommendations: nullable(data.recommendations),
        updatedBy: objectId(actorUserId),
      } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<ImagingReportLean>();
    return record ? toReport(record) : null;
  }

  async verifyReport(orderId: string, actorUserId: string, session: ClientSession) {
    const record = await ImagingReportModel.findOneAndUpdate(
      { orderId: objectId(orderId), deletedAt: null, verifiedAt: null },
      { $set: { verifiedBy: objectId(actorUserId), verifiedAt: new Date(), updatedBy: objectId(actorUserId) } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<ImagingReportLean>();
    return record ? toReport(record) : null;
  }
}
