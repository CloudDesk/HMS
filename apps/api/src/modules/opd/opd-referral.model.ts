import mongoose, { Schema, Types } from 'mongoose';
import type { OpdReferralPriority, OpdReferralStatus, OpdReferralType } from './opd-referral.types.js';

export type OpdReferralFields = {
  visitId: Types.ObjectId;
  consultationId: Types.ObjectId;
  patientId: Types.ObjectId;
  patientNumber: string;
  patientName: string;
  referringDoctorId: Types.ObjectId;
  referringDoctorName: string;
  referralType?: OpdReferralType | null;
  specialty?: string | null;
  priority: OpdReferralPriority;
  facility?: string | null;
  referredDoctorId?: Types.ObjectId | null;
  referredDoctorName?: string | null;
  reason?: string | null;
  clinicalSummary?: string | null;
  appointmentId?: Types.ObjectId | null;
  appointmentNumber?: string | null;
  appointmentDate?: Date | null;
  appointmentStartTime?: string | null;
  appointmentDurationMinutes?: number | null;
  status: OpdReferralStatus;
  submittedAt?: Date | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const opdReferralSchema = new Schema<OpdReferralFields>(
  {
    visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true },
    consultationId: { type: Schema.Types.ObjectId, ref: 'OpdConsultation', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientNumber: { type: String, required: true },
    patientName: { type: String, required: true },
    referringDoctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    referringDoctorName: { type: String, required: true },
    referralType: { type: String, enum: ['INTERNAL', 'EXTERNAL', 'EMERGENCY'], default: null },
    specialty: { type: String, default: null },
    priority: { type: String, enum: ['ROUTINE', 'URGENT', 'EMERGENCY'], default: 'ROUTINE', required: true },
    facility: { type: String, default: null },
    referredDoctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', default: null },
    referredDoctorName: { type: String, default: null },
    reason: { type: String, default: null },
    clinicalSummary: { type: String, default: null },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null },
    appointmentNumber: { type: String, default: null },
    appointmentDate: { type: Date, default: null },
    appointmentStartTime: { type: String, default: null },
    appointmentDurationMinutes: { type: Number, default: null },
    status: { type: String, enum: ['DRAFT', 'SUBMITTED'], default: 'DRAFT', required: true },
    submittedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

opdReferralSchema.index({ visitId: 1 }, { unique: true });
opdReferralSchema.index({ patientId: 1, createdAt: -1 });
opdReferralSchema.index({ referredDoctorId: 1, status: 1, createdAt: -1 });
opdReferralSchema.index({ referralType: 1, status: 1, priority: 1, submittedAt: -1 });

export const OpdReferralModel = mongoose.model<OpdReferralFields>('OpdReferral', opdReferralSchema);
