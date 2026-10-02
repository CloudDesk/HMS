import mongoose, { Schema, Types } from 'mongoose';
import type { ClinicalOrderSourceType } from '../opd/opd-clinical-order.types.js';

export type ImagingAttachmentFields = {
  _id: Types.ObjectId;
  fileName: string;
  fileSizeBytes?: number | null;
  mimeType: string;
  storageKey: string;
  fileUrl?: string | null;
  uploadedAt: Date;
  uploadedBy?: Types.ObjectId | null;
};

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
  attachments?: ImagingAttachmentFields[];
  dentalContext?: {
    treatmentEpisodeId?: Types.ObjectId | null;
    treatmentStageId?: Types.ObjectId | null;
    toothNumber?: number | null;
  } | null;
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

const imagingAttachmentSchema = new Schema<ImagingAttachmentFields>(
  {
    fileName: { type: String, required: true, trim: true },
    fileSizeBytes: { type: Number, default: null },
    mimeType: { type: String, required: true, trim: true },
    storageKey: { type: String, required: true, trim: true },
    fileUrl: { type: String, default: null, trim: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: true },
);

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
  attachments: { type: [imagingAttachmentSchema], default: [] },
  dentalContext: {
    treatmentEpisodeId: { type: Schema.Types.ObjectId, ref: 'DentalTreatmentEpisode', default: null },
    treatmentStageId: { type: Schema.Types.ObjectId, ref: 'DentalTreatmentStage', default: null },
    toothNumber: { type: Number, default: null },
  },
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
imagingReportSchema.index({ 'dentalContext.treatmentEpisodeId': 1 }, { sparse: true });

export const ImagingReportModel = mongoose.model<ImagingReportFields>('ImagingReport', imagingReportSchema);
