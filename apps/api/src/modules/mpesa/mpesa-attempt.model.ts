import mongoose, { Schema } from 'mongoose';
import type { MpesaReportedOutcome } from './mpesa-callback.model.js';

export type MpesaSubmissionState = 'CREATED' | 'SUBMITTING' | 'PENDING' | 'UNKNOWN' | 'REJECTED';
export type MpesaVerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'FAILED' | 'CONFLICT' | 'UNRESOLVED';
export type MpesaVerificationSource = 'QUERY' | 'CALLBACK' | 'MANUAL_REVIEW' | 'RECONCILIATION';
export type MpesaQueryOutcome = 'NONE' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'TIMEOUT' | 'UNKNOWN';
export type MpesaRecoveryStatus = 'NONE' | 'IN_RECOVERY' | 'RESOLVED' | 'MANUAL_REVIEW_REQUIRED' | 'ABANDONED';
export type MpesaPostingStatus = 'DISABLED' | 'READY' | 'POSTING' | 'POSTED' | 'POSTING_FAILED' | 'MANUAL_REVIEW_REQUIRED';

export type MpesaQueryResultRecord = {
  state: string;
  resultCode?: number;
  resultDesc?: string;
  queriedAt: Date;
};

export type MpesaAttempt = {
  _id: string;
  invoiceId: string;
  patientId: string;
  branchId: string;
  createdBy: string;
  environment: 'sandbox' | 'production';
  provider: 'MPESA';
  currency: 'KES';
  businessShortCode: string;
  partyB: string;
  transactionType: string;
  amount: number;
  payerPhone: string;
  fingerprint: string;
  active: boolean;
  version: number;
  submissionState: MpesaSubmissionState;
  reportedOutcome: 'PENDING' | MpesaReportedOutcome;
  verificationStatus: MpesaVerificationStatus;
  postingStatus: MpesaPostingStatus;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  receiptNumber?: string;
  reportedEventId?: string;
  submittedAt?: Date;
  submissionError?: string;

  // Verification and reconciliation evidence:
  verificationSource?: MpesaVerificationSource;
  verificationAttempts: number;
  lastVerifiedAt?: Date;
  lastQueryResult?: MpesaQueryResultRecord;
  queryOutcome: MpesaQueryOutcome;
  conflictingEvidence?: string;
  recoveryStatus: MpesaRecoveryStatus;
  nextReconciliationAt?: Date;
  reconciliationClaimedAt?: Date;
  reconciliationClaimedBy?: string;
  reconciliationRetries: number;

  // Financial Posting linkage (Phase 2):
  billingPaymentId?: string;
  billingPaymentNumber?: string;
  postedAt?: Date;
  postingError?: string;

  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<MpesaAttempt>({
  _id: { type: String, required: true },
  invoiceId: { type: String, required: true },
  patientId: { type: String, required: true },
  branchId: { type: String, required: true },
  createdBy: { type: String, required: true },
  environment: { type: String, enum: ['sandbox', 'production'], required: true },
  provider: { type: String, enum: ['MPESA'], default: 'MPESA' },
  currency: { type: String, enum: ['KES'], default: 'KES' },
  businessShortCode: { type: String, required: true },
  partyB: { type: String, required: true },
  transactionType: { type: String, required: true },
  amount: { type: Number, required: true },
  payerPhone: { type: String, required: true, select: false },
  fingerprint: { type: String, required: true },
  active: { type: Boolean, required: true, default: true },
  version: { type: Number, default: 0, required: true },
  submissionState: {
    type: String,
    enum: ['CREATED', 'SUBMITTING', 'PENDING', 'UNKNOWN', 'REJECTED'],
    default: 'CREATED',
  },
  reportedOutcome: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT'],
    default: 'PENDING',
  },
  verificationStatus: {
    type: String,
    enum: ['UNVERIFIED', 'VERIFIED', 'FAILED', 'CONFLICT', 'UNRESOLVED'],
    default: 'UNVERIFIED',
  },
  postingStatus: {
    type: String,
    enum: ['DISABLED', 'READY', 'POSTING', 'POSTED', 'POSTING_FAILED', 'MANUAL_REVIEW_REQUIRED'],
    default: 'DISABLED',
  },
  checkoutRequestId: String,
  merchantRequestId: String,
  receiptNumber: String,
  reportedEventId: String,
  submittedAt: Date,
  submissionError: String,

  // Verification and reconciliation fields:
  verificationSource: {
    type: String,
    enum: ['QUERY', 'CALLBACK', 'MANUAL_REVIEW', 'RECONCILIATION'],
  },
  verificationAttempts: { type: Number, default: 0 },
  lastVerifiedAt: Date,
  lastQueryResult: {
    state: String,
    resultCode: Number,
    resultDesc: String,
    queriedAt: Date,
  },
  queryOutcome: {
    type: String,
    enum: ['NONE', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT', 'UNKNOWN'],
    default: 'NONE',
  },
  conflictingEvidence: String,
  recoveryStatus: {
    type: String,
    enum: ['NONE', 'IN_RECOVERY', 'RESOLVED', 'MANUAL_REVIEW_REQUIRED', 'ABANDONED'],
    default: 'NONE',
  },
  nextReconciliationAt: Date,
  reconciliationClaimedAt: Date,
  reconciliationClaimedBy: String,
  reconciliationRetries: { type: Number, default: 0 },

  // Financial Posting fields:
  billingPaymentId: String,
  billingPaymentNumber: String,
  postedAt: Date,
  postingError: String,
}, { collection: 'mpesa_payment_attempts', timestamps: true, versionKey: false });

schema.index({ invoiceId: 1, environment: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.index({ environment: 1, checkoutRequestId: 1 }, { unique: true, partialFilterExpression: { checkoutRequestId: { $type: 'string' } } });
schema.index({ branchId: 1, createdAt: -1 });
schema.index({ active: 1, nextReconciliationAt: 1, recoveryStatus: 1 });
schema.index({ branchId: 1, verificationStatus: 1, createdAt: -1 });
schema.index({ postingStatus: 1, active: 1 });

export const MpesaAttemptModel = mongoose.model<MpesaAttempt>('MpesaAttempt', schema);
