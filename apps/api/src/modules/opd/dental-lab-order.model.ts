import mongoose, { Schema, Types } from 'mongoose';
import type { DentalLabOrderStatus, ProstheticType } from './dental-lab-order.types.js';

export type DentalProstheticLabOrderFields = {
  orderNumber: string;
  patientId: Types.ObjectId;
  treatmentEpisodeId: Types.ObjectId;
  treatmentStageId: Types.ObjectId;
  treatmentPlanItemId?: string | null;
  toothNumber?: number | null;
  prostheticType: ProstheticType;
  description: string;
  assignedLabId?: Types.ObjectId | null;
  requestedBy: Types.ObjectId;
  requestedByName?: string | null;
  requestedAt: Date;
  status: DentalLabOrderStatus;
  receivedAt?: Date | null;
  inProgressAt?: Date | null;
  qualityCheckAt?: Date | null;
  readyAt?: Date | null;
  cancelledAt?: Date | null;
  statusRemarks?: string | null;
  cancellationReason?: string | null;
  branchId: Types.ObjectId;
  departmentId: Types.ObjectId;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const dentalProstheticLabOrderSchema = new Schema<DentalProstheticLabOrderFields>(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    treatmentEpisodeId: {
      type: Schema.Types.ObjectId,
      ref: 'DentalTreatmentEpisode',
      required: true,
      index: true,
    },
    treatmentStageId: {
      type: Schema.Types.ObjectId,
      ref: 'DentalTreatmentStage',
      required: true,
      index: true,
    },
    treatmentPlanItemId: { type: String, default: null, trim: true },
    toothNumber: { type: Number, default: null },
    prostheticType: {
      type: String,
      enum: ['CROWN', 'BRIDGE', 'OTHER'],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    assignedLabId: {
      type: Schema.Types.ObjectId,
      ref: 'Laboratory',
      default: null,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedByName: { type: String, default: null, trim: true },
    requestedAt: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'ORDERED',
        'RECEIVED',
        'IN_PROGRESS',
        'QUALITY_CHECK',
        'READY',
        'CANCELLED',
      ],
      default: 'ORDERED',
      required: true,
      index: true,
    },
    receivedAt: { type: Date, default: null },
    inProgressAt: { type: Date, default: null },
    qualityCheckAt: { type: Date, default: null },
    readyAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    statusRemarks: { type: String, default: null, trim: true },
    cancellationReason: { type: String, default: null, trim: true },
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
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    collection: 'dental_prosthetic_lab_orders',
    timestamps: true,
  },
);

dentalProstheticLabOrderSchema.index({ treatmentEpisodeId: 1, createdAt: -1 });
dentalProstheticLabOrderSchema.index({ patientId: 1, status: 1 });
dentalProstheticLabOrderSchema.index({ branchId: 1, departmentId: 1 });

export const DentalProstheticLabOrderModel = mongoose.model<DentalProstheticLabOrderFields>(
  'DentalProstheticLabOrder',
  dentalProstheticLabOrderSchema,
);
