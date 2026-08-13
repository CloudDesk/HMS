import mongoose, { Schema, Types } from 'mongoose';

export type LaboratoryResultItemFields = {
  serviceId: Types.ObjectId;
  serviceName: string;
  value: string;
  unit?: string | null;
  referenceRange?: string | null;
  comments?: string | null;
};

export type LaboratoryResultFields = {
  orderId: Types.ObjectId;
  patientId: Types.ObjectId;
  visitId: Types.ObjectId;
  resultItems: LaboratoryResultItemFields[];
  remarks?: string | null;
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

const laboratoryResultItemSchema = new Schema<LaboratoryResultItemFields>({
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
  serviceName: { type: String, required: true, trim: true },
  value: { type: String, required: true, trim: true },
  unit: { type: String, default: null, trim: true },
  referenceRange: { type: String, default: null, trim: true },
  comments: { type: String, default: null, trim: true },
}, { _id: false });

const laboratoryResultSchema = new Schema<LaboratoryResultFields>({
  orderId: { type: Schema.Types.ObjectId, ref: 'OpdClinicalOrder', required: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true },
  resultItems: { type: [laboratoryResultItemSchema], required: true },
  remarks: { type: String, default: null, trim: true },
  enteredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  enteredAt: { type: Date, required: true },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deletedAt: { type: Date, default: null },
}, { collection: 'laboratory_results', timestamps: true });

laboratoryResultSchema.index({ orderId: 1 }, { unique: true });
laboratoryResultSchema.index({ patientId: 1, createdAt: -1 });
laboratoryResultSchema.index({ visitId: 1, createdAt: -1 });
laboratoryResultSchema.index({ createdAt: -1 });

export const LaboratoryResultModel = mongoose.model<LaboratoryResultFields>(
  'LaboratoryResult', laboratoryResultSchema,
);
