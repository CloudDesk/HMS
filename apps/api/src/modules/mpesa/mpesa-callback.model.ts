import mongoose, { Schema } from 'mongoose';

export type MpesaReportedOutcome = 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';

export type MpesaCallbackEvent = {
  _id: string;
  environment: 'sandbox' | 'production';
  checkoutRequestId: string;
  merchantRequestId: string;
  resultCode: number;
  resultDescription: string;
  amount?: number;
  mpesaReceiptNumber?: string;
  phoneNumber?: string;
  transactionDate?: string;
  receivedAt: Date;
  reportedOutcome: MpesaReportedOutcome;
  processingStatus: 'UNMATCHED' | 'MATCHED' | 'CONFLICT';
  attemptId?: string;
  processedAt?: Date;
  processingError?: string;
  verificationStatus: 'UNVERIFIED';
  financialPostingEnabled: false;
};

const schema = new Schema<MpesaCallbackEvent>({
  _id: { type: String, required: true },
  environment: { type: String, enum: ['sandbox', 'production'], required: true },
  checkoutRequestId: { type: String, required: true },
  merchantRequestId: { type: String, required: true },
  resultCode: { type: Number, required: true },
  resultDescription: { type: String, required: true },
  amount: { type: Number },
  mpesaReceiptNumber: { type: String },
  phoneNumber: { type: String, select: false },
  transactionDate: { type: String },
  receivedAt: { type: Date, required: true },
  reportedOutcome: { type: String, enum: ['SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT'], required: true },
  processingStatus: { type: String, enum: ['UNMATCHED', 'MATCHED', 'CONFLICT'], required: true },
  attemptId: String,
  processedAt: Date,
  processingError: String,
  verificationStatus: { type: String, enum: ['UNVERIFIED'], required: true },
  financialPostingEnabled: { type: Boolean, validate: (value: boolean) => value === false, required: true },
}, { collection: 'mpesa_callback_events', versionKey: false, bufferCommands: false });

schema.index({ environment: 1, checkoutRequestId: 1, receivedAt: -1 });
schema.index({ environment: 1, processingStatus: 1, receivedAt: -1 });
// Not unique: an unverified public claim must never reserve a real receipt.
schema.index({ environment: 1, mpesaReceiptNumber: 1 }, { sparse: true });

export const MpesaCallbackEventModel = mongoose.model<MpesaCallbackEvent>('MpesaCallbackEvent', schema);
