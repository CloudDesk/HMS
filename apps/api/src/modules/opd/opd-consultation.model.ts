import mongoose, { Schema, Types } from 'mongoose';
import type { OpdConsultationStatus, OpdStructuredDiagnosis } from './opd-consultation.types.js';

type OpdConsultationClinicalHistoryFields = {
  consultationVersion: number;
  diagnoses: OpdStructuredDiagnosis[];
  treatmentPlan?: string | null;
  changedBy: Types.ObjectId;
  changedAt: Date;
};

export type OpdConsultationFields = {
  visitId: Types.ObjectId;
  patientId: Types.ObjectId;
  patientNumber: string;
  patientName: string;
  doctorId: Types.ObjectId;
  doctorName: string;
  status: OpdConsultationStatus;
  version?: number;
  chiefComplaint?: string | null;
  historyPresentIllness?: string | null;
  pastHistory?: string | null;
  familyHistory?: string | null;
  allergies?: string | null;
  physicalExamination?: string | null;
  assessment?: string | null;
  diagnoses?: OpdStructuredDiagnosis[];
  clinicalHistory?: OpdConsultationClinicalHistoryFields[];
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

const opdStructuredDiagnosisSchema = new Schema<OpdStructuredDiagnosis>(
  {
    code: { type: String, required: true },
    display: { type: String, required: true },
    codingSystem: { type: String, required: true, default: 'ICD-11' },
    type: { type: String, enum: ['PRIMARY', 'SECONDARY'], default: 'PRIMARY', required: true },
    laterality: { type: String, enum: ['OD', 'OS', 'OU', 'NOT_APPLICABLE'], default: null },
    status: { type: String, enum: ['SUSPECTED', 'CONFIRMED', 'RULED_OUT'], default: null },
    severity: { type: String, default: null },
    stage: { type: String, default: null },
    differential: { type: Boolean, default: false },
    notes: { type: String, default: null },
  },
  { _id: false },
);

const opdConsultationClinicalHistorySchema = new Schema<OpdConsultationClinicalHistoryFields>(
  {
    consultationVersion: { type: Number, min: 1, required: true },
    diagnoses: { type: [opdStructuredDiagnosisSchema], default: [] },
    treatmentPlan: { type: String, default: null },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, required: true },
  },
  { _id: false },
);

const opdConsultationSchema = new Schema<OpdConsultationFields>(
  {
    visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true, unique: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientNumber: { type: String, required: true },
    patientName: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    doctorName: { type: String, required: true },
    status: { type: String, enum: ['DRAFT', 'COMPLETED'], default: 'DRAFT', required: true },
    version: { type: Number, default: 0, min: 0, required: true },
    chiefComplaint: { type: String, default: null },
    historyPresentIllness: { type: String, default: null },
    pastHistory: { type: String, default: null },
    familyHistory: { type: String, default: null },
    allergies: { type: String, default: null },
    physicalExamination: { type: String, default: null },
    assessment: { type: String, default: null },
    diagnoses: { type: [opdStructuredDiagnosisSchema], default: [] },
    clinicalHistory: { type: [opdConsultationClinicalHistorySchema], default: [] },
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
