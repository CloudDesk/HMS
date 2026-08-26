import mongoose, { Schema, Types } from 'mongoose';
import type { ClinicalOrderSourceType } from '../opd/opd-clinical-order.types.js';

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
  sourceType?: ClinicalOrderSourceType;
  encounterId?: Types.ObjectId | null;
  admissionId?: Types.ObjectId | null;
  procedureId?: Types.ObjectId | null;
  patientId: Types.ObjectId;
  visitId?: Types.ObjectId | null;
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
  sourceType: { type: String, enum: ['OPD_VISIT', 'EMERGENCY_ENCOUNTER', 'INPATIENT_ADMISSION', 'PROCEDURE_BOOKING'] },
  encounterId: { type: Schema.Types.ObjectId, default: null },
  admissionId: { type: Schema.Types.ObjectId, ref: 'InpatientAdmission', default: null },
  procedureId: { type: Schema.Types.ObjectId, default: null },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', default: null },
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
