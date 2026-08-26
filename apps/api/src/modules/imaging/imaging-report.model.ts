import mongoose, { Schema, Types } from 'mongoose';
import type { ClinicalOrderSourceType } from '../opd/opd-clinical-order.types.js';

export type ImagingReportFields = {
  orderId: Types.ObjectId;
  sourceType?: ClinicalOrderSourceType;
  encounterId?: Types.ObjectId | null;
  admissionId?: Types.ObjectId | null;
  procedureId?: Types.ObjectId | null;
  patientId: Types.ObjectId;
  visitId?: Types.ObjectId | null;
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
  sourceType: { type: String, enum: ['OPD_VISIT', 'EMERGENCY_ENCOUNTER', 'INPATIENT_ADMISSION', 'PROCEDURE_BOOKING'] },
  encounterId: { type: Schema.Types.ObjectId, default: null },
  admissionId: { type: Schema.Types.ObjectId, ref: 'InpatientAdmission', default: null },
  procedureId: { type: Schema.Types.ObjectId, default: null },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', default: null },
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
