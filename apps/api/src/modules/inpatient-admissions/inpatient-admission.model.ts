import mongoose, { Schema, Types } from 'mongoose';
import type { AdmissionPriority, AdmissionRequestStatus, AdmissionSourceType, AdmissionStatus, AdmissionType } from './inpatient-admission.types.js';

export type InpatientAdmissionFields = {
  admissionNumber: string; patientId: Types.ObjectId; patientNumber: string; patientName: string;
  branchId: Types.ObjectId; wardId: Types.ObjectId; bedId: Types.ObjectId;
  admittingDoctorId: Types.ObjectId; admittingDoctorName: string; departmentId: Types.ObjectId; departmentName: string;
  admissionDate: Date; admissionType: AdmissionType; reason: string; notes?: string | null; status: AdmissionStatus;
  requestId?: Types.ObjectId | null; sourceType: AdmissionSourceType; sourceId?: Types.ObjectId | null;
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
  requestId: { type: Schema.Types.ObjectId, ref: 'AdmissionRequest', default: null },
  sourceType: { type: String, enum: ['DIRECT', 'OPD_VISIT', 'EMERGENCY_ENCOUNTER', 'PROCEDURE_BOOKING'], required: true, default: 'DIRECT' },
  sourceId: { type: Schema.Types.ObjectId, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.index({ branchId: 1, status: 1, admissionDate: -1 });
schema.index({ patientId: 1, status: 1, admissionDate: -1 });
schema.index({ patientId: 1 }, { unique: true, partialFilterExpression: { status: 'ADMITTED' } });
schema.index(
  { requestId: 1 },
  { unique: true, partialFilterExpression: { requestId: { $type: 'objectId' } } },
);
schema.index({ sourceType: 1, sourceId: 1 }, { unique: true, partialFilterExpression: { sourceId: { $type: 'objectId' }, status: 'ADMITTED' } });
schema.index({ bedId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'ADMITTED' } });
export const InpatientAdmissionModel = mongoose.model<InpatientAdmissionFields>('InpatientAdmission', schema);

export type AdmissionRequestFields = {
  requestNumber: string; patientId: Types.ObjectId; patientNumber: string; patientName: string;
  branchId: Types.ObjectId; departmentId: Types.ObjectId; departmentName: string;
  recommendingDoctorId: Types.ObjectId; recommendingDoctorName: string;
  sourceType: AdmissionSourceType; sourceId?: Types.ObjectId | null; sourceReference?: string | null;
  activeSourceKey?: string | null;
  admissionType: AdmissionType; priority: AdmissionPriority; reason: string; notes?: string | null;
  status: AdmissionRequestStatus; holdId?: Types.ObjectId | null; wardId?: Types.ObjectId | null; bedId?: Types.ObjectId | null;
  consentDocumentId?: Types.ObjectId | null; depositInvoiceId?: Types.ObjectId | null;
  prerequisiteSnapshot?: Record<string, unknown> | null; admissionId?: Types.ObjectId | null;
  cancellationReason?: string | null; cancelledBy?: Types.ObjectId | null; cancelledAt?: Date | null;
  createdBy: Types.ObjectId; updatedBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};

const admissionRequestSchema = new Schema<AdmissionRequestFields>({
  requestNumber: { type: String, required: true, unique: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true }, patientNumber: { type: String, required: true }, patientName: { type: String, required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true }, departmentName: { type: String, required: true },
  recommendingDoctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true }, recommendingDoctorName: { type: String, required: true },
  sourceType: { type: String, enum: ['DIRECT', 'OPD_VISIT', 'EMERGENCY_ENCOUNTER', 'PROCEDURE_BOOKING'], required: true }, sourceId: { type: Schema.Types.ObjectId, default: null }, sourceReference: { type: String, default: null },
  activeSourceKey: { type: String, default: null },
  admissionType: { type: String, enum: ['MEDICAL', 'SURGICAL', 'MATERNITY', 'PAEDIATRIC', 'OBSERVATION', 'OTHER'], required: true }, priority: { type: String, enum: ['ROUTINE', 'URGENT', 'EMERGENCY'], required: true },
  reason: { type: String, required: true, trim: true }, notes: { type: String, default: null },
  status: { type: String, enum: ['PENDING_VALIDATION', 'READY_FOR_CONFIRMATION', 'CONFIRMED', 'CANCELLED'], required: true, default: 'PENDING_VALIDATION' },
  holdId: { type: Schema.Types.ObjectId, ref: 'BedHold', default: null }, wardId: { type: Schema.Types.ObjectId, ref: 'HmsWard', default: null }, bedId: { type: Schema.Types.ObjectId, ref: 'HmsBed', default: null },
  consentDocumentId: { type: Schema.Types.ObjectId, ref: 'PatientDocument', default: null }, depositInvoiceId: { type: Schema.Types.ObjectId, ref: 'BillingInvoice', default: null },
  prerequisiteSnapshot: { type: Schema.Types.Mixed, default: null }, admissionId: { type: Schema.Types.ObjectId, ref: 'InpatientAdmission', default: null },
  cancellationReason: { type: String, default: null }, cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, cancelledAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
admissionRequestSchema.index({ branchId: 1, status: 1, createdAt: -1 });
admissionRequestSchema.index({ patientId: 1, status: 1, createdAt: -1 });
admissionRequestSchema.index(
  { activeSourceKey: 1 },
  { unique: true, partialFilterExpression: { activeSourceKey: { $type: 'string' } } },
);
export const AdmissionRequestModel = mongoose.model<AdmissionRequestFields>('AdmissionRequest', admissionRequestSchema);
