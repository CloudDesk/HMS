import mongoose, { Schema, Types } from 'mongoose';
import type { AdmissionStatus, AdmissionType } from './inpatient-admission.types.js';

export type InpatientAdmissionFields = {
  admissionNumber: string; patientId: Types.ObjectId; patientNumber: string; patientName: string;
  branchId: Types.ObjectId; wardId: Types.ObjectId; bedId: Types.ObjectId;
  admittingDoctorId: Types.ObjectId; admittingDoctorName: string; departmentId: Types.ObjectId; departmentName: string;
  admissionDate: Date; admissionType: AdmissionType; reason: string; notes?: string | null; status: AdmissionStatus;
  createdBy: Types.ObjectId; updatedBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};

const schema = new Schema<InpatientAdmissionFields>({
  admissionNumber: { type: String, required: true, unique: true }, patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  patientNumber: { type: String, required: true }, patientName: { type: String, required: true }, branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  wardId: { type: Schema.Types.ObjectId, ref: 'HmsWard', required: true }, bedId: { type: Schema.Types.ObjectId, ref: 'HmsBed', required: true },
  admittingDoctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true }, admittingDoctorName: { type: String, required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true }, departmentName: { type: String, required: true },
  admissionDate: { type: Date, required: true }, admissionType: { type: String, enum: ['MEDICAL', 'SURGICAL', 'MATERNITY', 'PAEDIATRIC', 'OBSERVATION', 'OTHER'], required: true },
  reason: { type: String, required: true, trim: true }, notes: { type: String, default: null }, status: { type: String, enum: ['DRAFT', 'ADMITTED', 'CANCELLED'], required: true, default: 'ADMITTED' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.index({ branchId: 1, status: 1, admissionDate: -1 });
schema.index({ patientId: 1, status: 1, admissionDate: -1 });
schema.index({ bedId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'ADMITTED' } });
export const InpatientAdmissionModel = mongoose.model<InpatientAdmissionFields>('InpatientAdmission', schema);
