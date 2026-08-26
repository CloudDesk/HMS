import mongoose, { Schema, Types } from 'mongoose';
import type { ConsentContextType, ConsentTemplateStatus } from './consent.types.js';

export type ConsentTemplateFields = {
  branchId: Types.ObjectId;
  code: string;
  name: string;
  category: string;
  contextType: ConsentContextType;
  mandatory: boolean;
  version: number;
  status: ConsentTemplateStatus;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const consentTemplateSchema = new Schema<ConsentTemplateFields>({
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  contextType: { type: String, enum: ['PATIENT', 'PROCEDURE', 'ADMISSION'], required: true },
  mandatory: { type: Boolean, default: false, required: true },
  version: { type: Number, min: 1, default: 1, required: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

consentTemplateSchema.index({ branchId: 1, code: 1, version: 1 }, { unique: true });
consentTemplateSchema.index({ branchId: 1, contextType: 1, status: 1 });

export const ConsentTemplateModel = mongoose.model<ConsentTemplateFields>('ConsentTemplate', consentTemplateSchema);
