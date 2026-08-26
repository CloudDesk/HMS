import mongoose, { Schema, Document, Types } from 'mongoose';
import type { ServiceType } from './service.types.js';

export interface IService extends Document {
  id: string;
  code: string;
  name: string;
  serviceType: ServiceType;
  category?: string;
  sampleType?: string | null;
  description?: string;
  departmentId: Types.ObjectId;
  standardPrice: number;
  defaultDurationMinutes?: number | null;
  bookingCapacity?: number | null;
  requiresBed: boolean;
  requiresConsent: boolean;
  requiresAdvanceDeposit: boolean;
  minimumAdvanceDepositAmount?: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    serviceType: {
      type: String,
      enum: ['GENERAL', 'LAB_TEST', 'IMAGING_SERVICE', 'PROCEDURE'],
      default: 'GENERAL',
      required: true,
    },
    category: { type: String },
    sampleType: { type: String, default: null },
    description: { type: String },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    standardPrice: { type: Number, required: true },
    defaultDurationMinutes: { type: Number, min: 5, max: 720, default: null },
    bookingCapacity: { type: Number, min: 1, max: 100, default: null },
    requiresBed: { type: Boolean, default: false },
    requiresConsent: { type: Boolean, default: false },
    requiresAdvanceDeposit: { type: Boolean, default: false },
    minimumAdvanceDepositAmount: { type: Number, min: 0, default: null },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: Record<string, unknown>) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

serviceSchema.index({ name: 1 });
serviceSchema.index({ departmentId: 1 });
serviceSchema.index({ deletedAt: 1, status: 1, createdAt: -1 });
serviceSchema.index({ deletedAt: 1, serviceType: 1, status: 1, departmentId: 1, createdAt: -1 });

export const ServiceModel = mongoose.model<IService>('Service', serviceSchema);
