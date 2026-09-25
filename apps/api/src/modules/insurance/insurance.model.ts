import mongoose, { Schema, Types } from 'mongoose';
import type {
  InsuranceApprovalRequestStatus,
  InsuranceApprovalResourceType,
  InsuranceApprovalRuleStatus,
  InsuranceApprovalTransactionType,
  InsuranceContractStatus,
  InsuranceOperatingMode,
  InsuranceMemberNumberScope,
  InsurancePayerStatus,
  InsurancePayerType,
  InsuranceProviderBranchStatus,
  InsuranceProviderStatus,
  InsuranceProviderType,
  InsuranceSubmissionMode,
} from './insurance.types.js';

export type InsuranceConfigurationFields = {
  key: 'system';
  operatingMode: InsuranceOperatingMode;
  version: number;
  approvalRuleRevision: number;
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

export type InsurancePayerFields = {
  payerCode: string;
  name: string;
  legalName?: string | null;
  payerType: InsurancePayerType;
  registrationNumber?: string | null;
  taxId?: string | null;
  claimsContactName?: string | null;
  claimsContactPhone?: string | null;
  claimsContactEmail?: string | null;
  financeContactName?: string | null;
  financeContactPhone?: string | null;
  financeContactEmail?: string | null;
  address?: string | null;
  submissionMode: InsuranceSubmissionMode;
  portalUrl?: string | null;
  apiEnabled: boolean;
  ediEnabled: boolean;
  portalEnabled: boolean;
  memberNumberScope: InsuranceMemberNumberScope;
  status: InsurancePayerStatus;
  version: number;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  deletedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsuranceApprovalRuleFields = {
  branchId?: Types.ObjectId | null;
  payerId?: Types.ObjectId | null;
  schemeId?: Types.ObjectId | null;
  transactionType: InsuranceApprovalTransactionType;
  requiredPermission: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  status: InsuranceApprovalRuleStatus;
  version: number;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsuranceApprovalRequestFields = {
  approvalRuleId: Types.ObjectId;
  branchId?: Types.ObjectId | null;
  transactionType: InsuranceApprovalTransactionType;
  resourceType: InsuranceApprovalResourceType;
  resourceId: Types.ObjectId;
  resourceVersion: number;
  requestedBy: Types.ObjectId;
  requestedAt: Date;
  status: InsuranceApprovalRequestStatus;
  decidedBy?: Types.ObjectId | null;
  decidedAt?: Date | null;
  decisionReason?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type InsuranceContractFields = {
  contractNumber: string;
  payerId: Types.ObjectId;
  providerId: Types.ObjectId;
  branchId: Types.ObjectId;
  name: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  providerNetwork?: string | null;
  claimSubmissionDays?: number | null;
  status: InsuranceContractStatus;
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
    approvalRuleRevision: { type: Number, default: 0, min: 0, required: true, select: false },
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

const insurancePayerSchema = new Schema<InsurancePayerFields>(
  {
    payerCode: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    legalName: { type: String, default: null, trim: true },
    payerType: { type: String, enum: ['INSURER', 'TPA', 'GOVERNMENT', 'EMPLOYER'], required: true },
    registrationNumber: { type: String, default: null, trim: true },
    taxId: { type: String, default: null, trim: true },
    claimsContactName: { type: String, default: null, trim: true },
    claimsContactPhone: { type: String, default: null, trim: true },
    claimsContactEmail: { type: String, default: null, trim: true, lowercase: true },
    financeContactName: { type: String, default: null, trim: true },
    financeContactPhone: { type: String, default: null, trim: true },
    financeContactEmail: { type: String, default: null, trim: true, lowercase: true },
    address: { type: String, default: null, trim: true },
    submissionMode: { type: String, enum: ['MANUAL', 'PORTAL', 'API', 'FILE'], default: 'MANUAL', required: true },
    portalUrl: { type: String, default: null, trim: true },
    apiEnabled: { type: Boolean, default: false, required: true },
    ediEnabled: { type: Boolean, default: false, required: true },
    portalEnabled: { type: Boolean, default: false, required: true },
    memberNumberScope: { type: String, enum: ['PAYER', 'PAYER_POLICY'], default: 'PAYER', required: true },
    status: { type: String, enum: ['DRAFT', 'ACTIVE', 'INACTIVE'], default: 'DRAFT', required: true },
    version: { type: Number, default: 0, min: 0, required: true },
    ...actorFields,
    ...softDeleteFields,
  },
  { collection: 'insurance_payers', timestamps: true },
);

insurancePayerSchema.index(
  { payerCode: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null }, name: 'insurance_payer_code_active_unique' },
);
insurancePayerSchema.index({ status: 1, createdAt: -1 });
insurancePayerSchema.index({ payerType: 1, status: 1, createdAt: -1 });
insurancePayerSchema.index({ submissionMode: 1, status: 1, createdAt: -1 });
insurancePayerSchema.index({ name: 1 });

const insuranceApprovalRuleSchema = new Schema<InsuranceApprovalRuleFields>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    payerId: { type: Schema.Types.ObjectId, ref: 'InsurancePayer', default: null },
    schemeId: { type: Schema.Types.ObjectId, default: null },
    transactionType: { type: String, enum: ['PROVIDER_ACTIVATION', 'PAYER_ACTIVATION', 'CONTRACT_ACTIVATION'], required: true },
    requiredPermission: { type: String, required: true, trim: true, uppercase: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true },
    version: { type: Number, default: 0, min: 0, required: true },
    ...actorFields,
  },
  { collection: 'insurance_approval_rules', timestamps: true },
);

insuranceApprovalRuleSchema.index({ transactionType: 1, status: 1, effectiveFrom: -1 });
insuranceApprovalRuleSchema.index({ payerId: 1, transactionType: 1, status: 1, effectiveFrom: -1 });
insuranceApprovalRuleSchema.index(
  { transactionType: 1, payerId: 1, effectiveFrom: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' }, name: 'insurance_active_approval_rule_start_unique' },
);

const insuranceApprovalRequestSchema = new Schema<InsuranceApprovalRequestFields>(
  {
    approvalRuleId: { type: Schema.Types.ObjectId, ref: 'InsuranceApprovalRule', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    transactionType: { type: String, enum: ['PROVIDER_ACTIVATION', 'PAYER_ACTIVATION', 'CONTRACT_ACTIVATION'], required: true },
    resourceType: { type: String, enum: ['PROVIDER', 'PAYER', 'CONTRACT'], required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    resourceVersion: { type: Number, min: 0, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedAt: { type: Date, required: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PENDING', required: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionReason: { type: String, default: null, trim: true },
    version: { type: Number, default: 0, min: 0, required: true },
  },
  { collection: 'insurance_approval_requests', timestamps: true },
);

insuranceApprovalRequestSchema.index(
  { resourceType: 1, resourceId: 1, transactionType: 1, resourceVersion: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' }, name: 'insurance_pending_approval_request_unique' },
);
insuranceApprovalRequestSchema.index({ status: 1, requestedAt: -1 });
insuranceApprovalRequestSchema.index({ requestedBy: 1, requestedAt: -1 });
insuranceApprovalRequestSchema.index({ approvalRuleId: 1, status: 1, requestedAt: -1 });
insuranceApprovalRequestSchema.index({ branchId: 1, status: 1, requestedAt: -1 });

const insuranceContractSchema = new Schema<InsuranceContractFields>(
  {
    contractNumber: { type: String, required: true, trim: true, uppercase: true },
    payerId: { type: Schema.Types.ObjectId, ref: 'InsurancePayer', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'InsuranceProvider', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    name: { type: String, required: true, trim: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    providerNetwork: { type: String, default: null, trim: true },
    claimSubmissionDays: { type: Number, default: null, min: 1, max: 3650 },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED'],
      default: 'DRAFT',
      required: true,
    },
    version: { type: Number, default: 0, min: 0, required: true },
    ...actorFields,
    ...softDeleteFields,
  },
  { collection: 'insurance_contracts', timestamps: true },
);

insuranceContractSchema.index(
  { branchId: 1, payerId: 1, contractNumber: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null }, name: 'insurance_contract_branch_payer_number_unique' },
);
insuranceContractSchema.index({ branchId: 1, status: 1, effectiveFrom: -1 });
insuranceContractSchema.index({ payerId: 1, status: 1, effectiveFrom: -1 });
insuranceContractSchema.index({ providerId: 1, status: 1, effectiveFrom: -1 });

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
export const InsurancePayerModel = mongoose.model<InsurancePayerFields>(
  'InsurancePayer',
  insurancePayerSchema,
);
export const InsuranceApprovalRuleModel = mongoose.model<InsuranceApprovalRuleFields>(
  'InsuranceApprovalRule',
  insuranceApprovalRuleSchema,
);
export const InsuranceApprovalRequestModel = mongoose.model<InsuranceApprovalRequestFields>(
  'InsuranceApprovalRequest',
  insuranceApprovalRequestSchema,
);
export const InsuranceContractModel = mongoose.model<InsuranceContractFields>(
  'InsuranceContract',
  insuranceContractSchema,
);
