import mongoose, { Schema, Types } from 'mongoose';
import type { DentalStageStatus } from './dental-stage.types.js';

export type DentalTreatmentStageFields = {
  episodeId: Types.ObjectId;
  planItemId: string;
  toothNumber?: number | null;
  serviceId?: Types.ObjectId | null;
  stageName: string;
  sequence: number;
  assignedDoctorId: Types.ObjectId;
  assignedDoctorName: string;
  status: DentalStageStatus;
  plannedDate?: Date | null;
  completedAt?: Date | null;
  completedByDoctorId?: Types.ObjectId | null;
  completedByDoctorName?: string | null;
  appointmentId?: Types.ObjectId | null;
  prostheticLabOrderId?: Types.ObjectId | null;
  notes?: string | null;
  branchId: Types.ObjectId;
  departmentId: Types.ObjectId;
  patientId: Types.ObjectId;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const dentalTreatmentStageSchema = new Schema<DentalTreatmentStageFields>(
  {
    episodeId: {
      type: Schema.Types.ObjectId,
      ref: 'DentalTreatmentEpisode',
      required: true,
      index: true,
    },
    planItemId: { type: String, required: true, trim: true, index: true },
    toothNumber: { type: Number, default: null },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      default: null,
    },
    stageName: { type: String, required: true, trim: true },
    sequence: { type: Number, required: true },
    assignedDoctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    assignedDoctorName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'],
      default: 'PLANNED',
      required: true,
      index: true,
    },
    plannedDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    completedByDoctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
    },
    completedByDoctorName: { type: String, default: null, trim: true },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    prostheticLabOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'DentalProstheticLabOrder',
      default: null,
    },
    notes: { type: String, default: null, trim: true },
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
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    collection: 'dental_treatment_stages',
    timestamps: true,
  },
);

dentalTreatmentStageSchema.index(
  { episodeId: 1, planItemId: 1, sequence: 1 },
  { unique: true },
);
dentalTreatmentStageSchema.index({ episodeId: 1, planItemId: 1 });
dentalTreatmentStageSchema.index({ patientId: 1, status: 1 });
dentalTreatmentStageSchema.index({ assignedDoctorId: 1, status: 1 });
dentalTreatmentStageSchema.index({ branchId: 1, departmentId: 1 });

export const DentalTreatmentStageModel = mongoose.model<DentalTreatmentStageFields>(
  'DentalTreatmentStage',
  dentalTreatmentStageSchema,
);
