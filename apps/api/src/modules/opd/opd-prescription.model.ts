import mongoose, { Schema, Types } from 'mongoose';
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
  instructions?: string | null;
};

export type OpdPrescriptionFields = {
  visitId: Types.ObjectId;
  consultationId: Types.ObjectId;
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
    instructions: { type: String, default: null, trim: true },
  },
  { _id: true },
);

const opdPrescriptionSchema = new Schema<OpdPrescriptionFields>(
  {
    visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true },
    consultationId: { type: Schema.Types.ObjectId, ref: 'OpdConsultation', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientNumber: { type: String, required: true },
    patientName: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    doctorName: { type: String, required: true },
    status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'DISPENSED', 'CANCELLED'], default: 'DRAFT', required: true },
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

opdPrescriptionSchema.index({ visitId: 1 }, { unique: true });
opdPrescriptionSchema.index({ patientId: 1, createdAt: -1 });
opdPrescriptionSchema.index({ doctorId: 1, status: 1, createdAt: -1 });
opdPrescriptionSchema.index({ status: 1, submittedAt: -1 });

export const OpdPrescriptionModel = mongoose.model<OpdPrescriptionFields>(
  'OpdPrescription',
  opdPrescriptionSchema,
);
