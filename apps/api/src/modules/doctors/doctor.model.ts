import mongoose, { Schema, Types } from 'mongoose';
import type { DoctorAvailabilityDay, DoctorStatus } from './doctor.types.js';

export type DoctorWorkingBlockFields = {
  _id: Types.ObjectId;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxPatientsPerSlot?: number;
};

export type DoctorAvailabilityFields = {
  _id: Types.ObjectId;
  dayOfWeek: DoctorAvailabilityDay;
  isAvailable: boolean;
  workingBlocks: DoctorWorkingBlockFields[];

// Retained temporarily so existing single-range records can be read and normalized.
startTime?: string;
endTime?: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
};

export type DoctorFields = {
  doctorNumber: string;
  userId?: Types.ObjectId | null;
  firstName: string;
  lastName: string;
  displayName: string;
  specialization: string;
  qualification?: string | null;
  registrationNumber?: string | null;
  experienceYears?: number | null;
  branchId: Types.ObjectId;
  departmentId: Types.ObjectId;
  consultationRoom?: string | null;
  phone?: string | null;
  email?: string | null;
  status: DoctorStatus;
  notes?: string | null;
  availability: DoctorAvailabilityFields[];
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const doctorWorkingBlockSchema = new Schema<DoctorWorkingBlockFields>(
  {
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    slotDurationMinutes: { type: Number, required: true, default: 30 },
    maxPatientsPerSlot: { type: Number, default: 1 },
  },
  { _id: true },
);

const doctorAvailabilitySchema = new Schema<DoctorAvailabilityFields>(
  {
    dayOfWeek: {
      type: String,
      enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      required: true,
    },
    isAvailable: { type: Boolean, default: true, required: true },
workingBlocks: { type: [doctorWorkingBlockSchema], default: [] },
startTime: { type: String },
endTime: { type: String },
    breakStartTime: { type: String, default: null },
    breakEndTime: { type: String, default: null },
  },
  { _id: true },
);

const doctorSchema = new Schema<DoctorFields>(
  {
    doctorNumber: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    displayName: { type: String, required: true },
    specialization: { type: String, required: true },
    qualification: { type: String, default: null },
    registrationNumber: { type: String, default: null },
    experienceYears: { type: Number, default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    consultationRoom: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'], default: 'ACTIVE', required: true },
    notes: { type: String, default: null },
    availability: { type: [doctorAvailabilitySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// doctorNumber already receives its unique index from the field declaration.
doctorSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });
doctorSchema.index({ displayName: 1 });
doctorSchema.index({ branchId: 1, departmentId: 1, status: 1 });
doctorSchema.index({ specialization: 1 });
doctorSchema.index({ registrationNumber: 1 }, { sparse: true });
doctorSchema.index({ email: 1 }, { sparse: true });

export const DoctorModel = mongoose.model<DoctorFields>('Doctor', doctorSchema);
