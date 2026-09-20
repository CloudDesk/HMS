import mongoose, { Schema } from 'mongoose';
import type { DentalChairsideImageFields } from './dental-chairside-image.types.js';

const dentalChairsideImageSchema = new Schema<DentalChairsideImageFields>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    patientNumber: { type: String, required: true },
    patientName: { type: String, required: true },
    visitId: {
      type: Schema.Types.ObjectId,
      ref: 'OpdVisit',
      required: true,
      index: true,
    },
    visitNumber: { type: String, required: true },
    episodeId: {
      type: Schema.Types.ObjectId,
      ref: 'DentalTreatmentEpisode',
      default: null,
      index: true,
    },
    episodeNumber: { type: String, default: null },
    examinationId: {
      type: Schema.Types.ObjectId,
      ref: 'OpdDentalExamination',
      default: null,
    },
    toothNumber: {
      type: Number,
      default: null,
      index: true,
    },
    imagingSource: {
      type: String,
      default: 'CHAIRSIDE',
      required: true,
    },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    fileSizeBytes: { type: Number, required: true, min: 0 },
    storageKey: { type: String, required: true, trim: true },
    notes: { type: String, default: null, trim: true },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    doctorName: { type: String, required: true },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

dentalChairsideImageSchema.index({ visitId: 1, deletedAt: 1, createdAt: -1 });
dentalChairsideImageSchema.index({ episodeId: 1, deletedAt: 1, createdAt: -1 });
dentalChairsideImageSchema.index({ patientId: 1, deletedAt: 1, createdAt: -1 });

export const DentalChairsideImageModel = mongoose.model<DentalChairsideImageFields>(
  'DentalChairsideImage',
  dentalChairsideImageSchema,
);
