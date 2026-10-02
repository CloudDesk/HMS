import mongoose, { Schema, Types } from 'mongoose';
import type { DentalQuotationStatus } from './dental-quotation.types.js';

export type DentalQuotationItemFields = {
  treatmentPlanItemId?: string | null;
  serviceId?: Types.ObjectId | null;
  procedureName: string;
  toothNumber?: number | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  notes?: string | null;
};

export type DentalQuotationOptionFields = {
  _id?: Types.ObjectId;
  name: string;
  description?: string | null;
  sequence: number;
  items: DentalQuotationItemFields[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
};

export type DentalTreatmentQuotationFields = {
  quotationNumber: string;
  patientId: Types.ObjectId;
  patientNumber: string;
  patientName: string;
  treatmentEpisodeId: Types.ObjectId;
  treatmentEpisodeNumber?: string | null;
  doctorId: Types.ObjectId;
  doctorName: string;
  branchId: Types.ObjectId;
  departmentId: Types.ObjectId;
  status: DentalQuotationStatus;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes?: string | null;
  validUntil?: Date | null;
  items: DentalQuotationItemFields[];
  options: DentalQuotationOptionFields[];
  selectedOptionId?: Types.ObjectId | null;
  selectedOptionName?: string | null;
  acceptedAt?: Date | null;
  acceptedBy?: Types.ObjectId | null;
  decisionReason?: string | null;
  decisionAt?: Date | null;
  sentAt?: Date | null;
  sentBy?: Types.ObjectId | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const dentalQuotationItemSchema = new Schema<DentalQuotationItemFields>(
  {
    treatmentPlanItemId: { type: String, default: null },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      default: null,
    },
    procedureName: { type: String, required: true, trim: true },
    toothNumber: { type: Number, default: null },
    quantity: { type: Number, required: true, default: 1, min: 1 },
    unitPrice: { type: Number, required: true, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, default: 0, min: 0 },
    notes: { type: String, default: null, trim: true },
  },
  { _id: true },
);

const dentalQuotationOptionSchema = new Schema<DentalQuotationOptionFields>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    sequence: { type: Number, required: true, default: 1 },
    items: { type: [dentalQuotationItemSchema], default: [] },
    subtotal: { type: Number, required: true, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: true },
);

const dentalTreatmentQuotationSchema = new Schema<DentalTreatmentQuotationFields>(
  {
    quotationNumber: { type: String, required: true, trim: true, unique: true },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    patientNumber: { type: String, required: true, trim: true },
    patientName: { type: String, required: true, trim: true },
    treatmentEpisodeId: {
      type: Schema.Types.ObjectId,
      ref: 'DentalTreatmentEpisode',
      required: true,
      index: true,
    },
    treatmentEpisodeNumber: { type: String, default: null, trim: true },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    doctorName: { type: String, required: true, trim: true },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'POSTPONED', 'EXPIRED'],
      default: 'DRAFT',
      required: true,
      index: true,
    },
    currency: { type: String, required: true, default: 'KES', trim: true },
    subtotal: { type: Number, required: true, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, default: 0, min: 0 },
    notes: { type: String, default: null, trim: true },
    validUntil: { type: Date, default: null },
    items: { type: [dentalQuotationItemSchema], default: [] },
    options: { type: [dentalQuotationOptionSchema], default: [] },
    selectedOptionId: { type: Schema.Types.ObjectId, default: null },
    selectedOptionName: { type: String, default: null, trim: true },
    acceptedAt: { type: Date, default: null },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decisionReason: { type: String, default: null, trim: true },
    decisionAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'dental_treatment_quotations',
  },
);

dentalTreatmentQuotationSchema.index({ treatmentEpisodeId: 1, createdAt: -1 });
dentalTreatmentQuotationSchema.index({ patientId: 1, createdAt: -1 });
dentalTreatmentQuotationSchema.index({ branchId: 1, departmentId: 1, status: 1 });

export const DentalTreatmentQuotationModel = mongoose.model<DentalTreatmentQuotationFields>(
  'DentalTreatmentQuotation',
  dentalTreatmentQuotationSchema,
);
