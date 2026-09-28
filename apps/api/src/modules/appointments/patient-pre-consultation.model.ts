import mongoose, { Schema, Types } from 'mongoose';

export type PatientPreConsultationFields = {
  appointmentId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId?: Types.ObjectId | null;
  chiefComplaint?: string | null;
  historyPresentIllness?: string | null;
  pastMedicalHistory?: string | null;
  familyHistory?: string | null;
  allergies?: string | null;
  submittedAt: Date;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const patientPreConsultationSchema = new Schema<PatientPreConsultationFields>(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', default: null },
    chiefComplaint: { type: String, default: null, trim: true },
    historyPresentIllness: { type: String, default: null, trim: true },
    pastMedicalHistory: { type: String, default: null, trim: true },
    familyHistory: { type: String, default: null, trim: true },
    allergies: { type: String, default: null, trim: true },
    submittedAt: { type: Date, default: Date.now, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

patientPreConsultationSchema.index({ appointmentId: 1 }, { unique: true });
patientPreConsultationSchema.index({ patientId: 1, submittedAt: -1 });

export const PatientPreConsultationModel = mongoose.model<PatientPreConsultationFields>(
  'PatientPreConsultation',
  patientPreConsultationSchema,
  'patient_pre_consultations',
);
