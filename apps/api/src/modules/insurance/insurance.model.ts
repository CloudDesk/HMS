import mongoose, { Schema, Types } from 'mongoose';
import type {
  InsuranceOperatingMode,
  InsuranceProviderBranchStatus,
  InsuranceProviderStatus,
  InsuranceProviderType,
} from './insurance.types.js';

export type InsuranceConfigurationFields = {
  key: 'system';
  operatingMode: InsuranceOperatingMode;
  version: number;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsuranceProviderFields = {
  providerCode: string;
  legalName: string;
  tradingName?: string | null;
  providerType: InsuranceProviderType;
  registrationNumber?: string | null;
  taxId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: InsuranceProviderStatus;
  version: number;
  branchMappingRevision: number;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  deletedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsuranceProviderBranchFields = {
  providerId: Types.ObjectId;
  branchId: Types.ObjectId;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  status: InsuranceProviderBranchStatus;
  version: number;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  deletedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const actorFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
} as const;

const softDeleteFields = {
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deletedAt: { type: Date, default: null },
} as const;

const insuranceConfigurationSchema = new Schema<InsuranceConfigurationFields>(
  {
    key: { type: String, enum: ['system'], default: 'system', required: true, unique: true },
    operatingMode: {
      type: String,
      enum: ['PROVIDER', 'PAYER', 'TPA', 'HYBRID'],
      default: 'PROVIDER',
      required: true,
    },
    version: { type: Number, default: 0, min: 0, required: true },
    ...actorFields,
  },
  { collection: 'insurance_configuration', timestamps: true },
);

const insuranceProviderSchema = new Schema<InsuranceProviderFields>(
  {
    providerCode: { type: String, required: true, trim: true, uppercase: true },
    legalName: { type: String, required: true, trim: true },
    tradingName: { type: String, default: null, trim: true },
    providerType: {
      type: String,
      enum: ['HOSPITAL', 'CLINIC', 'PHARMACY', 'LABORATORY', 'IMAGING', 'DENTAL', 'OPTICAL', 'OTHER'],
      required: true,
    },
    registrationNumber: { type: String, default: null, trim: true },
    taxId: { type: String, default: null, trim: true },
    contactName: { type: String, default: null, trim: true },
    phone: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
    address: { type: String, default: null, trim: true },
    status: { type: String, enum: ['DRAFT', 'ACTIVE', 'INACTIVE'], default: 'DRAFT', required: true },
    version: { type: Number, default: 0, min: 0, required: true },
    branchMappingRevision: { type: Number, default: 0, min: 0, required: true, select: false },
    ...actorFields,
    ...softDeleteFields,
  },
  { collection: 'insurance_providers', timestamps: true },
);

insuranceProviderSchema.index(
  { providerCode: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null }, name: 'insurance_provider_code_active_unique' },
);
insuranceProviderSchema.index({ status: 1, createdAt: -1 });
insuranceProviderSchema.index({ providerType: 1, status: 1, createdAt: -1 });
insuranceProviderSchema.index({ legalName: 1 });

const insuranceProviderBranchSchema = new Schema<InsuranceProviderBranchFields>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'InsuranceProvider', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'EXPIRED'], default: 'ACTIVE', required: true },
    version: { type: Number, default: 0, min: 0, required: true },
    ...actorFields,
    ...softDeleteFields,
  },
  { collection: 'insurance_provider_branches', timestamps: true },
);

insuranceProviderBranchSchema.index(
  { providerId: 1, branchId: 1, effectiveFrom: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null, status: 'ACTIVE' },
    name: 'insurance_provider_branch_active_effective_start_unique',
  },
);
insuranceProviderBranchSchema.index({ providerId: 1, status: 1, effectiveFrom: -1 });
insuranceProviderBranchSchema.index({ branchId: 1, status: 1, effectiveFrom: -1 });

export const InsuranceConfigurationModel = mongoose.model<InsuranceConfigurationFields>(
  'InsuranceConfiguration',
  insuranceConfigurationSchema,
);
export const InsuranceProviderModel = mongoose.model<InsuranceProviderFields>(
  'InsuranceProvider',
  insuranceProviderSchema,
);
export const InsuranceProviderBranchModel = mongoose.model<InsuranceProviderBranchFields>(
  'InsuranceProviderBranch',
  insuranceProviderBranchSchema,
);
