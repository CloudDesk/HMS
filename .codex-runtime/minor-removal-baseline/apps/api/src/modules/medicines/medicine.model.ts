import mongoose, { Schema, Types } from 'mongoose';
import type { MedicineStatus } from './medicine.types.js';

export type MedicineFields = {
  code: string;
  name: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  unit?: string | null;
  description?: string | null;
  status: MedicineStatus;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  deletedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const medicineSchema = new Schema<MedicineFields>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    genericName: { type: String, default: null, trim: true },
    strength: { type: String, default: null, trim: true },
    dosageForm: { type: String, default: null, trim: true },
    unit: { type: String, default: null, trim: true },
    description: { type: String, default: null, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

medicineSchema.index({ name: 1 });
medicineSchema.index({ genericName: 1 });
medicineSchema.index({ dosageForm: 1 });
medicineSchema.index({ deletedAt: 1, status: 1, createdAt: -1 });

export const MedicineModel = mongoose.model<MedicineFields>('Medicine', medicineSchema);
