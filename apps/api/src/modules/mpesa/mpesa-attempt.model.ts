import mongoose, { Schema } from 'mongoose';
import type { MpesaReportedOutcome } from './mpesa-callback.model.js';

export type MpesaSubmissionState = 'CREATED' | 'SUBMITTING' | 'PENDING' | 'UNKNOWN' | 'REJECTED';
export type MpesaAttempt = {
  _id: string; invoiceId: string; patientId: string; branchId: string; createdBy: string;
  environment: 'sandbox' | 'production'; provider: 'MPESA'; currency: 'KES';
  businessShortCode: string; partyB: string; transactionType: string;
  amount: number; payerPhone: string; fingerprint: string; active: boolean; version: number;
  submissionState: MpesaSubmissionState; reportedOutcome: 'PENDING' | MpesaReportedOutcome;
  verificationStatus: 'UNVERIFIED'; postingStatus: 'DISABLED';
  checkoutRequestId?: string; merchantRequestId?: string; receiptNumber?: string;
  reportedEventId?: string; submittedAt?: Date; submissionError?: string;
  createdAt: Date; updatedAt: Date;
};
const schema = new Schema<MpesaAttempt>({
  _id: { type: String, required: true },
  invoiceId: { type: String, required: true }, patientId: { type: String, required: true },
  branchId: { type: String, required: true }, createdBy: { type: String, required: true },
  environment: { type: String, enum: ['sandbox', 'production'], required: true },
  provider: { type: String, enum: ['MPESA'], default: 'MPESA' },
  currency: { type: String, enum: ['KES'], default: 'KES' },
  businessShortCode: { type: String, required: true }, partyB: { type: String, required: true },
  transactionType: { type: String, required: true }, amount: { type: Number, required: true },
  payerPhone: { type: String, required: true, select: false }, fingerprint: { type: String, required: true },
  active: { type: Boolean, required: true, default: true }, version: { type: Number, default: 0, required: true },
  submissionState: { type: String, enum: ['CREATED', 'SUBMITTING', 'PENDING', 'UNKNOWN', 'REJECTED'], default: 'CREATED' },
  reportedOutcome: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT'], default: 'PENDING' },
  verificationStatus: { type: String, enum: ['UNVERIFIED'], default: 'UNVERIFIED' },
  postingStatus: { type: String, enum: ['DISABLED'], default: 'DISABLED' },
  checkoutRequestId: String, merchantRequestId: String, receiptNumber: String, reportedEventId: String,
  submittedAt: Date, submissionError: String,
}, { collection: 'mpesa_payment_attempts', timestamps: true, versionKey: false });
schema.index({ invoiceId: 1, environment: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.index({ environment: 1, checkoutRequestId: 1 }, { unique: true, partialFilterExpression: { checkoutRequestId: { $type: 'string' } } });
schema.index({ branchId: 1, createdAt: -1 });
export const MpesaAttemptModel = mongoose.model<MpesaAttempt>('MpesaAttempt', schema);
