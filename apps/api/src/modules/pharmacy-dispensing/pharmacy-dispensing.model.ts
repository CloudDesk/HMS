import mongoose, { Schema, Types } from 'mongoose';
import type { PharmacyDispensingStatus } from './pharmacy-dispensing.types.js';

export type PharmacyDispensingItemFields = {
  _id: Types.ObjectId;
  prescriptionItemId: Types.ObjectId;
  medicineId: Types.ObjectId;
  batchId: Types.ObjectId;
  medicineName: string;
  batchNumber: string;
  requestedQuantity?: number | null;
  confirmedQuantity: number;
  availableQuantity: number;
  unitPrice: number;
  lineTotal: number;
  pharmacistInstructions?: string | null;
};

export type PharmacyDispensingFields = {
  prescriptionId: Types.ObjectId;
  patientId: Types.ObjectId;
  visitId: Types.ObjectId;
  branchId: Types.ObjectId;
  status: PharmacyDispensingStatus;
  version: number;
  items: PharmacyDispensingItemFields[];
  invoiceId?: Types.ObjectId | null;
  confirmIdempotencyKey?: string | null;
  reverseIdempotencyKey?: string | null;
  confirmedAt?: Date | null;
  confirmedBy?: Types.ObjectId | null;
  cancelledAt?: Date | null;
  cancelledBy?: Types.ObjectId | null;
  cancellationReason?: string | null;
  reversedAt?: Date | null;
  reversedBy?: Types.ObjectId | null;
  reversalReason?: string | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const itemSchema = new Schema<PharmacyDispensingItemFields>({
  prescriptionItemId: { type: Schema.Types.ObjectId, required: true },
  medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'PharmacyMedicineBatch', required: true },
  medicineName: { type: String, required: true, trim: true },
  batchNumber: { type: String, required: true, trim: true },
  requestedQuantity: { type: Number, default: null },
  confirmedQuantity: { type: Number, required: true, min: 1 },
  availableQuantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  pharmacistInstructions: { type: String, default: null, trim: true },
}, { _id: true });

const schema = new Schema<PharmacyDispensingFields>({
  prescriptionId: { type: Schema.Types.ObjectId, ref: 'OpdPrescription', required: true, unique: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  status: { type: String, enum: ['DRAFT', 'CONFIRMED', 'CANCELLED', 'REVERSED'], default: 'DRAFT', required: true },
  version: { type: Number, default: 0, required: true },
  items: { type: [itemSchema], default: [] },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'BillingInvoice', default: null },
  confirmIdempotencyKey: { type: String, default: null },
  reverseIdempotencyKey: { type: String, default: null },
  confirmedAt: { type: Date, default: null }, confirmedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledAt: { type: Date, default: null }, cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  cancellationReason: { type: String, default: null },
  reversedAt: { type: Date, default: null }, reversedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reversalReason: { type: String, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

schema.index({ branchId: 1, status: 1, createdAt: -1 });
schema.index({ patientId: 1, createdAt: -1 });
schema.index({ confirmIdempotencyKey: 1 }, { unique: true, sparse: true });
schema.index({ reverseIdempotencyKey: 1 }, { unique: true, sparse: true });

export const PharmacyDispensingModel = mongoose.model<PharmacyDispensingFields>('PharmacyDispensing', schema);
