import mongoose, { Schema, Types } from 'mongoose';
import type { AppointmentPriority, AppointmentStatus, AppointmentVisitType } from './appointment.types.js';

export type AppointmentFields = {
  appointmentNumber: string;
  patientId: Types.ObjectId;
  patientNumber: string;
  patientName: string;
  doctorId: Types.ObjectId;
  doctorName: string;
  doctorSpecialization: string;
  branchId: Types.ObjectId;
  departmentId: Types.ObjectId;
  appointmentDate: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  visitType: AppointmentVisitType;
  priority: AppointmentPriority;
  status: AppointmentStatus;
  reason?: string | null;
  notes?: string | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const appointmentSchema = new Schema<AppointmentFields>(
  {
    appointmentNumber: { type: String, required: true, unique: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientNumber: { type: String, required: true },
    patientName: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    doctorName: { type: String, required: true },
    doctorSpecialization: { type: String, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    appointmentDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    visitType: {
      type: String,
      enum: ['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE', 'EMERGENCY'],
      required: true,
    },
    priority: { type: String, enum: ['ROUTINE', 'URGENT', 'EMERGENCY'], default: 'ROUTINE', required: true },
    status: {
      type: String,
      enum: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW', 'SKIPPED', 'COMPLETED'],
      default: 'SCHEDULED',
      required: true,
    },
    reason: { type: String, default: null },
    notes: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

appointmentSchema.index({ doctorId: 1, appointmentDate: 1, startTime: 1 });
appointmentSchema.index({ patientId: 1, appointmentDate: -1 });
appointmentSchema.index({ status: 1, appointmentDate: 1 });
appointmentSchema.index({ branchId: 1, departmentId: 1, appointmentDate: 1 });
appointmentSchema.index({ patientNumber: 1 });
appointmentSchema.index({ patientName: 1 });
appointmentSchema.index({ doctorName: 1 });

export const AppointmentModel = mongoose.model<AppointmentFields>('Appointment', appointmentSchema);
