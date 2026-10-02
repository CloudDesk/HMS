import mongoose, { Schema, Types } from 'mongoose';
import type { ConsentContextType, ConsentFormDefinition, ConsentTemplateStatus } from './consent.types.js';

export type ConsentTemplateFields = {
  branchId: Types.ObjectId;
  code: string;
  name: string;
  category: string;
  contextType: ConsentContextType;
  mandatory: boolean;
  version: number;
  status: ConsentTemplateStatus;
  formDefinition?: ConsentFormDefinition | null;
  publishedAt?: Date | null;
  publishedBy?: Types.ObjectId | null;
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
  status: { type: String, enum: ['DRAFT', 'ACTIVE', 'INACTIVE'], default: 'DRAFT', required: true },
  formDefinition: { type: Schema.Types.Mixed, default: null },
  publishedAt: { type: Date, default: null },
  publishedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

consentTemplateSchema.index({ branchId: 1, code: 1, version: 1 }, { unique: true });
consentTemplateSchema.index({ branchId: 1, contextType: 1, status: 1 });

export const ConsentTemplateModel = mongoose.model<ConsentTemplateFields>('ConsentTemplate', consentTemplateSchema);
