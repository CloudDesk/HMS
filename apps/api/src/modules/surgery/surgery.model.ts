import mongoose, { Schema, Types } from 'mongoose';
import type { ProcedureBookingStatus, ProcedureRecommendationStatus } from './surgery.types.js';

export type ProcedureRecommendationFields = {
  recommendationNumber: string; patientId: Types.ObjectId; patientNumber: string; patientName: string;
  branchId: Types.ObjectId; departmentId: Types.ObjectId; departmentName: string; recommendingDoctorId: Types.ObjectId; recommendingDoctorName: string;
  serviceId: Types.ObjectId; serviceName: string; encounterType?: 'OPD_VISIT' | 'DIRECT' | 'EMERGENCY' | null; encounterId?: Types.ObjectId | null; clinicalReason: string; notes?: string | null;
  status: ProcedureRecommendationStatus; bookingId?: Types.ObjectId | null; cancellationReason?: string | null; cancelledAt?: Date | null; cancelledBy?: Types.ObjectId | null;
  createdBy: Types.ObjectId; updatedBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};
const recommendationSchema = new Schema<ProcedureRecommendationFields>({
  recommendationNumber: { type: String, required: true, unique: true }, patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true }, patientNumber: { type: String, required: true }, patientName: { type: String, required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true }, departmentName: { type: String, required: true }, recommendingDoctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true }, recommendingDoctorName: { type: String, required: true },
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true }, serviceName: { type: String, required: true }, encounterType: { type: String, enum: ['OPD_VISIT', 'DIRECT', 'EMERGENCY'], default: 'DIRECT' }, encounterId: { type: Schema.Types.ObjectId, default: null }, clinicalReason: { type: String, required: true, trim: true }, notes: { type: String, default: null },
  status: { type: String, enum: ['ACTIVE', 'BOOKED', 'CANCELLED'], default: 'ACTIVE', required: true }, bookingId: { type: Schema.Types.ObjectId, ref: 'ProcedureBooking', default: null }, cancellationReason: { type: String, default: null }, cancelledAt: { type: Date, default: null }, cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
recommendationSchema.index({ branchId: 1, status: 1, createdAt: -1 });
recommendationSchema.index({ patientId: 1, status: 1, createdAt: -1 });
recommendationSchema.index({ encounterType: 1, encounterId: 1, serviceId: 1 }, { unique: true, partialFilterExpression: { status: 'ACTIVE', encounterId: { $ne: null } } });
export const ProcedureRecommendationModel = mongoose.model<ProcedureRecommendationFields>('ProcedureRecommendation', recommendationSchema);

export type ProcedureBookingFields = {
  bookingNumber: string; recommendationId: Types.ObjectId; patientId: Types.ObjectId; patientNumber: string; patientName: string;
  branchId: Types.ObjectId; departmentId: Types.ObjectId; departmentName: string; serviceId: Types.ObjectId; serviceName: string;
  doctorId: Types.ObjectId; doctorName: string; scheduledStart: Date; scheduledEnd: Date; durationMinutes: number; status: ProcedureBookingStatus;
  holdId?: Types.ObjectId | null; consentDocumentId?: Types.ObjectId | null; depositInvoiceId?: Types.ObjectId | null; prerequisiteSnapshot?: Record<string, unknown> | null; notes?: string | null;
  scheduleHistory: Array<{ previousStart: Date; previousEnd: Date; newStart: Date; newEnd: Date; previousDoctorId: Types.ObjectId; newDoctorId: Types.ObjectId; reason: string; changedBy: Types.ObjectId; changedAt: Date }>;
  cancellationReason?: string | null; cancelledAt?: Date | null; cancelledBy?: Types.ObjectId | null; completedAt?: Date | null; completedBy?: Types.ObjectId | null;
  createdBy: Types.ObjectId; updatedBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};
const bookingSchema = new Schema<ProcedureBookingFields>({
  bookingNumber: { type: String, required: true, unique: true }, recommendationId: { type: Schema.Types.ObjectId, ref: 'ProcedureRecommendation', required: true }, patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true }, patientNumber: { type: String, required: true }, patientName: { type: String, required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true }, departmentName: { type: String, required: true }, serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true }, serviceName: { type: String, required: true }, doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true }, doctorName: { type: String, required: true },
  scheduledStart: { type: Date, required: true }, scheduledEnd: { type: Date, required: true }, durationMinutes: { type: Number, required: true, min: 5, max: 720 }, status: { type: String, enum: ['PENDING_CONFIRMATION', 'BOOKED', 'COMPLETED', 'CANCELLED'], default: 'PENDING_CONFIRMATION', required: true },
  holdId: { type: Schema.Types.ObjectId, ref: 'BedHold', default: null }, consentDocumentId: { type: Schema.Types.ObjectId, ref: 'PatientDocument', default: null }, depositInvoiceId: { type: Schema.Types.ObjectId, ref: 'BillingInvoice', default: null }, prerequisiteSnapshot: { type: Schema.Types.Mixed, default: null }, notes: { type: String, default: null },
  scheduleHistory: { type: [{ previousStart: Date, previousEnd: Date, newStart: Date, newEnd: Date, previousDoctorId: Schema.Types.ObjectId, newDoctorId: Schema.Types.ObjectId, reason: String, changedBy: Schema.Types.ObjectId, changedAt: Date }], default: [] },
  cancellationReason: { type: String, default: null }, cancelledAt: { type: Date, default: null }, cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, completedAt: { type: Date, default: null }, completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
bookingSchema.index({ branchId: 1, status: 1, scheduledStart: 1 });
bookingSchema.index({ doctorId: 1, status: 1, scheduledStart: 1, scheduledEnd: 1 });
bookingSchema.index({ serviceId: 1, status: 1, scheduledStart: 1, scheduledEnd: 1 });
bookingSchema.index({ recommendationId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['PENDING_CONFIRMATION', 'BOOKED'] } } });
export const ProcedureBookingModel = mongoose.model<ProcedureBookingFields>('ProcedureBooking', bookingSchema);
