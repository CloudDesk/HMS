import mongoose, { Schema } from 'mongoose';
import type { AdvancePaymentFields } from './advance-payment.types.js';

const advancePaymentSchema = new Schema<AdvancePaymentFields>(
  {
    patient_id: { type: String, required: true },
    source_type: { type: String, enum: ['ADMISSION_REQUEST', 'PROCEDURE_BOOKING'], required: true },
    source_id: { type: String, required: true },
    branch_id: { type: String, required: true },
    required_amount: { type: Number, required: true, default: 0 },
    paid_amount: { type: Number, required: true, default: 0 },
    balance_amount: { type: Number, required: true, default: 0 },
    requirement_status: { type: String, enum: ['NOT_REQUIRED', 'REQUIRED'], required: true, default: 'NOT_REQUIRED' },
    payment_status: { type: String, enum: ['PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'], required: true, default: 'PENDING' },
    created_by: { type: String, default: null },
    updated_by: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

// One advance payment tracker per source
advancePaymentSchema.index({ source_type: 1, source_id: 1 }, { unique: true });
advancePaymentSchema.index({ patient_id: 1, created_at: -1 });
advancePaymentSchema.index({ branch_id: 1, payment_status: 1 });

export const AdvancePaymentModel = mongoose.model<AdvancePaymentFields>(
  'AdvancePayment',
  advancePaymentSchema,
);
