import mongoose, { Schema, Types } from 'mongoose';
import type { BillingInvoiceStatus, BillingPaymentMethod, BillingServiceType, BillingSourceType } from './billing.types.js';

export type BillingInvoiceFields = {
  invoiceNumber: string;
  patientId: Types.ObjectId;
  visitId: Types.ObjectId;
  sourceType?: BillingSourceType;
  encounterId?: Types.ObjectId | null;
  admissionId?: Types.ObjectId | null;
  procedureId?: Types.ObjectId | null;
  appointmentId?: Types.ObjectId | null;
  branchId: Types.ObjectId;
  contextType?: 'ADMISSION_REQUEST' | 'PROCEDURE_BOOKING' | null;
  contextId?: Types.ObjectId | null;
  invoiceDate: Date;
  status: BillingInvoiceStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BillingInvoiceItemFields = {
  invoiceId: Types.ObjectId;
  serviceId: Types.ObjectId;
  serviceName: string;
  serviceType: BillingServiceType;
  originatingOrderId?: Types.ObjectId | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BillingPaymentFields = {
  invoiceId: Types.ObjectId;
  patientId: Types.ObjectId;
  branchId: Types.ObjectId;
  paymentNumber: string;
  amount: number;
  paymentMethod: BillingPaymentMethod;
  paymentDate: Date;
  referenceNumber?: string | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
} as const;

const invoiceSchema = new Schema<BillingInvoiceFields>(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true },
    sourceType: { type: String, enum: ['OPD', 'EMERGENCY', 'PROCEDURE'], default: 'OPD', required: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', default: null },
    admissionId: { type: Schema.Types.ObjectId, ref: 'InpatientAdmission', default: null },
    procedureId: { type: Schema.Types.ObjectId, default: null },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    contextType: { type: String, enum: ['ADMISSION_REQUEST', 'PROCEDURE_BOOKING'], default: null },
    contextId: { type: Schema.Types.ObjectId, default: null },
    invoiceDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'],
      default: 'DRAFT',
      required: true,
    },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    taxAmount: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    balanceAmount: { type: Number, required: true, min: 0 },
    ...auditFields,
  },
  { collection: 'billing_invoices', timestamps: true },
);

invoiceSchema.index({ patientId: 1, createdAt: -1 });
invoiceSchema.index({ visitId: 1 });
invoiceSchema.index({ sourceType: 1, encounterId: 1 });
invoiceSchema.index({ admissionId: 1 });
invoiceSchema.index({ procedureId: 1 });
invoiceSchema.index({ status: 1, createdAt: -1 });
invoiceSchema.index({ branchId: 1, invoiceDate: -1, status: 1 });
invoiceSchema.index({ contextType: 1, contextId: 1 }, { unique: true, partialFilterExpression: { contextId: { $type: 'objectId' } } });

const invoiceItemSchema = new Schema<BillingInvoiceItemFields>(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: 'BillingInvoice', required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceName: { type: String, required: true, trim: true },
    serviceType: {
      type: String,
      enum: ['CONSULTATION', 'LAB_TEST', 'IMAGING_SERVICE', 'PHARMACY'],
      required: true,
    },
    originatingOrderId: { type: Schema.Types.ObjectId, default: null },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    ...auditFields,
  },
  { collection: 'billing_invoice_items', timestamps: true },
);

invoiceItemSchema.index({ invoiceId: 1, deletedAt: 1 });
invoiceItemSchema.index({ serviceId: 1, createdAt: -1 });

const paymentSchema = new Schema<BillingPaymentFields>(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: 'BillingInvoice', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    paymentNumber: { type: String, required: true, unique: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER'],
      required: true,
    },
    paymentDate: { type: Date, required: true },
    referenceNumber: { type: String, default: null, trim: true },
    ...auditFields,
  },
  { collection: 'billing_payments', timestamps: true },
);

paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ branchId: 1, paymentDate: -1 });

export const BillingInvoiceModel = mongoose.model<BillingInvoiceFields>('BillingInvoice', invoiceSchema);
export const BillingInvoiceItemModel = mongoose.model<BillingInvoiceItemFields>('BillingInvoiceItem', invoiceItemSchema);
export const BillingPaymentModel = mongoose.model<BillingPaymentFields>('BillingPayment', paymentSchema);

