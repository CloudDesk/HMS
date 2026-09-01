import mongoose, { Schema, Types } from 'mongoose';
import type { ClinicalContextSourceType } from './clinical-context.types.js';
import type { OpdPrescriptionStatus } from './opd-prescription.types.js';

export type OpdPrescriptionItemFields = {
  _id: Types.ObjectId;
  medicineName: string;
  strength?: string | null;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity?: number | null;
  intakeTime?: string | null;
  instructions?: string | null;
};

export type OpdPrescriptionFields = {
  sourceType: ClinicalContextSourceType;
  sourceId: Types.ObjectId;
  encounterId?: Types.ObjectId | null;
  admissionId?: Types.ObjectId | null;
  procedureId?: Types.ObjectId | null;
  visitId?: Types.ObjectId | null;
  consultationId?: Types.ObjectId | null;
  branchId: Types.ObjectId;
  patientId: Types.ObjectId;
  patientNumber: string;
  patientName: string;
  doctorId: Types.ObjectId;
  doctorName: string;
  status: OpdPrescriptionStatus;
  items: OpdPrescriptionItemFields[];
  followUpDate?: Date | null;
  doctorInstructions?: string | null;
  patientInstructions?: string | null;
  submittedAt?: Date | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const prescriptionItemSchema = new Schema<OpdPrescriptionItemFields>(
  {
    medicineName: { type: String, required: true, trim: true },
    strength: { type: String, default: null, trim: true },
    dosage: { type: String, required: true, trim: true },
    route: { type: String, required: true, trim: true },
    frequency: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    quantity: { type: Number, default: null },
    intakeTime: { type: String, default: null, trim: true },
    instructions: { type: String, default: null, trim: true },
  },
  { _id: true },
);

const opdPrescriptionSchema = new Schema<OpdPrescriptionFields>(
  {
    sourceType: {
      type: String,
      enum: ['OPD_VISIT', 'EMERGENCY_ENCOUNTER', 'INPATIENT_ADMISSION', 'PROCEDURE_BOOKING'],
      default: 'OPD_VISIT',
      required: true,
    },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    encounterId: { type: Schema.Types.ObjectId, default: null },
    admissionId: { type: Schema.Types.ObjectId, ref: 'InpatientAdmission', default: null },
    procedureId: { type: Schema.Types.ObjectId, ref: 'ProcedureBooking', default: null },
    visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit' },
    consultationId: { type: Schema.Types.ObjectId, ref: 'OpdConsultation', default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientNumber: { type: String, required: true },
    patientName: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    doctorName: { type: String, required: true },
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'DISPENSED', 'CANCELLED'],
      default: 'DRAFT',
      required: true,
    },
    items: { type: [prescriptionItemSchema], default: [] },
    followUpDate: { type: Date, default: null },
    doctorInstructions: { type: String, default: null },
    patientInstructions: { type: String, default: null },
    submittedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

opdPrescriptionSchema.index(
  { visitId: 1 },
  {
    name: 'visitId_unique_objectId',
    unique: true,
    partialFilterExpression: { visitId: { $type: 'objectId' } },
  },
);
opdPrescriptionSchema.index(
  { sourceType: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $type: 'objectId' } } },
);
opdPrescriptionSchema.index({ branchId: 1, status: 1, submittedAt: -1 });
opdPrescriptionSchema.index({ admissionId: 1, status: 1, submittedAt: -1 });
opdPrescriptionSchema.index({ procedureId: 1, status: 1, submittedAt: -1 });
opdPrescriptionSchema.index({ patientId: 1, createdAt: -1 });
opdPrescriptionSchema.index({ doctorId: 1, status: 1, createdAt: -1 });
opdPrescriptionSchema.index({ status: 1, submittedAt: -1 });

export const OpdPrescriptionModel = mongoose.model<OpdPrescriptionFields>(
  'OpdPrescription',
  opdPrescriptionSchema,
);
