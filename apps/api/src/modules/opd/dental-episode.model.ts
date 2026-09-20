import mongoose, { Schema, Types } from 'mongoose';
import type { DentalEpisodeStatus } from './dental-episode.types.js';

export type DentalTreatmentEpisodeFields = {
  episodeNumber: string;
  patientId: Types.ObjectId;
  patientNumber: string;
  patientName: string;
  originatingVisitId: Types.ObjectId;
  originatingVisitNumber: string;
  primaryDoctorId: Types.ObjectId;
  primaryDoctorName: string;
  branchId: Types.ObjectId;
  departmentId: Types.ObjectId;
  primaryToothNumber?: number | null;
  diagnosisCode?: string | null;
  diagnosisName?: string | null;
  treatmentPlanSummary?: string | null;
  status: DentalEpisodeStatus;
  visitIds: Types.ObjectId[];
  notes?: string | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const dentalTreatmentEpisodeSchema = new Schema<DentalTreatmentEpisodeFields>(
  {
    episodeNumber: { type: String, required: true, trim: true },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    patientNumber: { type: String, required: true, trim: true },
    patientName: { type: String, required: true, trim: true },
    originatingVisitId: {
      type: Schema.Types.ObjectId,
      ref: 'OpdVisit',
      required: true,
    },
    originatingVisitNumber: { type: String, required: true, trim: true },
    primaryDoctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    primaryDoctorName: { type: String, required: true, trim: true },
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
    primaryToothNumber: { type: Number, default: null },
    diagnosisCode: { type: String, default: null, trim: true },
    diagnosisName: { type: String, default: null, trim: true },
    treatmentPlanSummary: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    visitIds: [{ type: Schema.Types.ObjectId, ref: 'OpdVisit' }],
    notes: { type: String, default: null, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    collection: 'dental_treatment_episodes',
    timestamps: true,
  },
);

dentalTreatmentEpisodeSchema.index({ episodeNumber: 1 }, { unique: true });
dentalTreatmentEpisodeSchema.index({ patientId: 1, status: 1 });
dentalTreatmentEpisodeSchema.index({ branchId: 1, departmentId: 1, createdAt: -1 });
dentalTreatmentEpisodeSchema.index({ visitIds: 1 });

export const DentalTreatmentEpisodeModel = mongoose.model<DentalTreatmentEpisodeFields>(
  'DentalTreatmentEpisode',
  dentalTreatmentEpisodeSchema,
);
