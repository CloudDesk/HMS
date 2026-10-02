import mongoose, { Schema, Types } from 'mongoose';
import type { DoctorLeaveStatus } from './doctor.types.js';
import type { DoctorWorkingBlockFields } from './doctor.model.js';

export type DoctorLeaveFields = {
  doctorId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: DoctorLeaveStatus;
  createdBy?: Types.ObjectId;
  cancelledBy?: Types.ObjectId | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DoctorAvailabilityExceptionFields = {
  doctorId: Types.ObjectId;
  date: Date;
  isAvailable: boolean;
  workingBlocks: DoctorWorkingBlockFields[];
  reason: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type DoctorSequenceFields = {
  _id: string;
  value: number;
};

const workingBlockSchema = new Schema<DoctorWorkingBlockFields>(
  {
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    slotDurationMinutes: { type: Number, required: true, default: 30 },
  },
  { _id: true },
);

const doctorLeaveSchema = new Schema<DoctorLeaveFields>(
  {
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'CANCELLED'], default: 'ACTIVE', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

doctorLeaveSchema.index({ doctorId: 1, status: 1, startDate: 1, endDate: 1 });

const doctorAvailabilityExceptionSchema = new Schema<DoctorAvailabilityExceptionFields>(
  {
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    date: { type: Date, required: true },
    isAvailable: { type: Boolean, required: true },
    workingBlocks: { type: [workingBlockSchema], default: [] },
    reason: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

doctorAvailabilityExceptionSchema.index({ doctorId: 1, date: 1 }, { unique: true });

const doctorSequenceSchema = new Schema<DoctorSequenceFields>(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { versionKey: false },
);

export const DoctorLeaveModel = mongoose.model<DoctorLeaveFields>('DoctorLeave', doctorLeaveSchema);
export const DoctorAvailabilityExceptionModel = mongoose.model<DoctorAvailabilityExceptionFields>(
  'DoctorAvailabilityException',
  doctorAvailabilityExceptionSchema,
);
export const DoctorSequenceModel = mongoose.model<DoctorSequenceFields>('DoctorSequence', doctorSequenceSchema);
