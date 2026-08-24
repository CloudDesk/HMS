import mongoose, { Schema, Types } from 'mongoose';
import type { OpdConsultationStatus } from './opd-consultation.types.js';

export type OpdConsultationFields = {
  visitId: Types.ObjectId;
  patientId: Types.ObjectId;
  patientNumber: string;
  patientName: string;
  doctorId: Types.ObjectId;
  doctorName: string;
  status: OpdConsultationStatus;
  chiefComplaint?: string | null;
  historyPresentIllness?: string | null;
  pastHistory?: string | null;
  familyHistory?: string | null;
  allergies?: string | null;
  physicalExamination?: string | null;
  assessment?: string | null;
  treatmentPlan?: string | null;
  doctorNotes?: string | null;
  completedAt?: Date | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const opdConsultationSchema = new Schema<OpdConsultationFields>(
  {
    visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true, unique: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientNumber: { type: String, required: true },
    patientName: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    doctorName: { type: String, required: true },
    status: { type: String, enum: ['DRAFT', 'COMPLETED'], default: 'DRAFT', required: true },
    chiefComplaint: { type: String, default: null },
    historyPresentIllness: { type: String, default: null },
    pastHistory: { type: String, default: null },
    familyHistory: { type: String, default: null },
    allergies: { type: String, default: null },
    physicalExamination: { type: String, default: null },
    assessment: { type: String, default: null },
    treatmentPlan: { type: String, default: null },
    doctorNotes: { type: String, default: null },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

opdConsultationSchema.index({ patientId: 1, createdAt: -1 });
opdConsultationSchema.index({ doctorId: 1, createdAt: -1 });
opdConsultationSchema.index({ status: 1, createdAt: -1 });

export const OpdConsultationModel = mongoose.model<OpdConsultationFields>('OpdConsultation', opdConsultationSchema);
