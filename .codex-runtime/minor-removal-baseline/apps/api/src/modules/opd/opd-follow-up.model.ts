import mongoose, { Schema, Types } from 'mongoose';
import type { OpdFollowUpReminderType, OpdFollowUpStatus, OpdFollowUpType } from './opd-follow-up.types.js';

export type OpdFollowUpFields = {
  visitId: Types.ObjectId;
  consultationId: Types.ObjectId;
  patientId: Types.ObjectId;
  patientNumber: string;
  patientName: string;
  originatingDoctorId: Types.ObjectId;
  originatingDoctorName: string;
  assignedDoctorId?: Types.ObjectId | null;
  assignedDoctorName?: string | null;
  appointmentId?: Types.ObjectId | null;
  appointmentNumber?: string | null;
  followUpType?: OpdFollowUpType | null;
  nextVisitDate?: Date | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  reason?: string | null;
  reminderType: OpdFollowUpReminderType;
  notes?: string | null;
  status: OpdFollowUpStatus;
  scheduledAt?: Date | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const opdFollowUpSchema = new Schema<OpdFollowUpFields>(
  {
    visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true },
    consultationId: { type: Schema.Types.ObjectId, ref: 'OpdConsultation', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientNumber: { type: String, required: true },
    patientName: { type: String, required: true },
    originatingDoctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    originatingDoctorName: { type: String, required: true },
    assignedDoctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', default: null },
    assignedDoctorName: { type: String, default: null },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null },
    appointmentNumber: { type: String, default: null },
    followUpType: {
      type: String,
      enum: ['CLINICAL_REVIEW', 'MEDICATION_REVIEW', 'LAB_REVIEW', 'IMAGING_REVIEW', 'REFERRAL_REVIEW'],
      default: null,
    },
    nextVisitDate: { type: Date, default: null },
    startTime: { type: String, default: null },
    durationMinutes: { type: Number, default: null },
    reason: { type: String, default: null },
    reminderType: { type: String, enum: ['SMS', 'EMAIL', 'NONE'], default: 'SMS', required: true },
    notes: { type: String, default: null },
    status: { type: String, enum: ['DRAFT', 'SCHEDULED'], default: 'DRAFT', required: true },
    scheduledAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

opdFollowUpSchema.index({ visitId: 1 }, { unique: true });
opdFollowUpSchema.index({ patientId: 1, nextVisitDate: -1 });
opdFollowUpSchema.index({ assignedDoctorId: 1, status: 1, nextVisitDate: 1 });
opdFollowUpSchema.index({ status: 1, nextVisitDate: 1 });

export const OpdFollowUpModel = mongoose.model<OpdFollowUpFields>('OpdFollowUp', opdFollowUpSchema);
