import mongoose, { Schema, Types } from 'mongoose';

export type ImagingReportFields = {
  orderId: Types.ObjectId;
  patientId: Types.ObjectId;
  visitId: Types.ObjectId;
  findings: string;
  impression: string;
  recommendations?: string | null;
  enteredBy: Types.ObjectId;
  enteredAt: Date;
  verifiedBy?: Types.ObjectId | null;
  verifiedAt?: Date | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  deletedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const imagingReportSchema = new Schema<ImagingReportFields>({
  orderId: { type: Schema.Types.ObjectId, ref: 'OpdClinicalOrder', required: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true },
  findings: { type: String, required: true, trim: true },
  impression: { type: String, required: true, trim: true },
  recommendations: { type: String, default: null, trim: true },
  enteredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  enteredAt: { type: Date, required: true },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deletedAt: { type: Date, default: null },
}, { collection: 'imaging_reports', timestamps: true });

imagingReportSchema.index({ orderId: 1 }, { unique: true });
imagingReportSchema.index({ patientId: 1, createdAt: -1 });
imagingReportSchema.index({ visitId: 1, createdAt: -1 });
imagingReportSchema.index({ createdAt: -1 });

export const ImagingReportModel = mongoose.model<ImagingReportFields>('ImagingReport', imagingReportSchema);
