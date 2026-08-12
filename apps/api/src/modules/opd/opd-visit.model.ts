import mongoose, { Schema, Types } from 'mongoose';
import type { OpdVisitPriority, OpdVisitStatus, OpdVisitType } from './opd-visit.types.js';

export type OpdVisitFields = {
  visitNumber: string;
  appointmentId?: Types.ObjectId | null;
  patientId: Types.ObjectId;
  patientNumber: string;
  patientName: string;
  doctorId: Types.ObjectId;
  doctorName: string;
  doctorSpecialization: string;
  branchId: Types.ObjectId;
  departmentId: Types.ObjectId;
  visitDate: Date;
  checkInTime: Date;
  visitType: OpdVisitType;
  priority: OpdVisitPriority;
  status: OpdVisitStatus;
  reason?: string | null;
  notes?: string | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const opdVisitSchema = new Schema<OpdVisitFields>(
  {
    visitNumber: { type: String, required: true, unique: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientNumber: { type: String, required: true },
    patientName: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    doctorName: { type: String, required: true },
    doctorSpecialization: { type: String, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    visitDate: { type: Date, required: true },
    checkInTime: { type: Date, required: true },
    visitType: {
      type: String,
      enum: ['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE', 'EMERGENCY', 'TELEMEDICINE', 'WALK_IN', 'REVIEW'],
      required: true,
    },
    priority: { type: String, enum: ['ROUTINE', 'URGENT', 'EMERGENCY'], default: 'ROUTINE', required: true },
    status: {
      type: String,
      enum: [
        'CHECKED_IN',
        'WAITING_FOR_VITALS',
        'READY_FOR_CONSULTATION',
        'IN_CONSULTATION',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW',
      ],
      default: 'CHECKED_IN',
      required: true,
    },
    reason: { type: String, default: null },
    notes: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

opdVisitSchema.index({ visitNumber: 1 });
opdVisitSchema.index({ appointmentId: 1 }, { sparse: true, unique: true });
opdVisitSchema.index({ patientId: 1, visitDate: -1 });
opdVisitSchema.index({ doctorId: 1, visitDate: 1, status: 1 });
opdVisitSchema.index({ branchId: 1, departmentId: 1, visitDate: 1 });
opdVisitSchema.index({ status: 1, visitDate: 1 });
opdVisitSchema.index({ patientNumber: 1 });
opdVisitSchema.index({ patientName: 1 });

export const OpdVisitModel = mongoose.model<OpdVisitFields>('OpdVisit', opdVisitSchema);
