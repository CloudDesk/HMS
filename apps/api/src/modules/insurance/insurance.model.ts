import mongoose, { Schema, Types } from 'mongoose';
import type {
  EligibilityStatus,
  HolderType,
  MemberRelationship,
  MemberStatus,
  PayerStatus,
  PayerType,
  PolicyStatus,
  SchemeStatus,
} from './insurance.types.js';

export type PayerFields = {
  payerCode: string;
  name: string;
  type: PayerType;
  status: PayerStatus;
  branchId?: Types.ObjectId | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  contactInfo?: {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    website?: string | null;
  };
  version: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type InsuranceSchemeFields = {
  payerId: Types.ObjectId;
  schemeCode: string;
  name: string;
  planType?: string | null;
  networkType?: string | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  status: SchemeStatus;
  branchId?: Types.ObjectId | null;
  version: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type InsurancePolicyFields = {
  payerId: Types.ObjectId;
  schemeId: Types.ObjectId;
  policyNumber: string;
  holderPatientId: Types.ObjectId;
  holderType: HolderType;
  startDate: Date;
  endDate?: Date | null;
  status: PolicyStatus;
  coverageDetails?: {
    copayPercentage?: number | null;
    annualLimit?: number | null;
    remarks?: string | null;
  };
  version: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type InsuranceMemberFields = {
  policyId: Types.ObjectId;
  patientId: Types.ObjectId;
  memberNumber: string;
  subscriberId?: string | null;
  relationship: MemberRelationship;
  coverageStart: Date;
  coverageEnd?: Date | null;
  status: MemberStatus;
  branchId?: Types.ObjectId | null;
  version: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const audit = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
} as const;

// 1. Payer Schema
const payerSchema = new Schema<PayerFields>(
  {
    payerCode: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['SHA', 'PRIVATE', 'TPA', 'OTHER'],
      default: 'SHA',
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      required: true,
    },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    effectiveFrom: { type: Date, default: null },
    effectiveTo: { type: Date, default: null },
    contactInfo: {
      email: { type: String, default: null, trim: true },
      phone: { type: String, default: null, trim: true },
      address: { type: String, default: null, trim: true },
      website: { type: String, default: null, trim: true },
    },
    version: { type: Number, default: 0, min: 0, required: true },
    ...audit,
  },
  { timestamps: true }
);

payerSchema.index({ payerCode: 1 }, { unique: true });
payerSchema.index({ status: 1, type: 1 });
payerSchema.index({ branchId: 1, status: 1 });

// 2. Insurance Scheme Schema
const insuranceSchemeSchema = new Schema<InsuranceSchemeFields>(
  {
    payerId: { type: Schema.Types.ObjectId, ref: 'Payer', required: true },
    schemeCode: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    planType: { type: String, default: null, trim: true },
    networkType: { type: String, default: null, trim: true },
    effectiveFrom: { type: Date, default: null },
    effectiveTo: { type: Date, default: null },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      required: true,
    },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    version: { type: Number, default: 0, min: 0, required: true },
    ...audit,
  },
  { timestamps: true }
);

insuranceSchemeSchema.index({ payerId: 1, schemeCode: 1 }, { unique: true });
insuranceSchemeSchema.index({ payerId: 1, status: 1 });
insuranceSchemeSchema.index({ branchId: 1, status: 1 });

// 3. Insurance Policy Schema
const insurancePolicySchema = new Schema<InsurancePolicyFields>(
  {
    payerId: { type: Schema.Types.ObjectId, ref: 'Payer', required: true },
    schemeId: { type: Schema.Types.ObjectId, ref: 'InsuranceScheme', required: true },
    policyNumber: { type: String, required: true, uppercase: true, trim: true },
    holderPatientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    holderType: {
      type: String,
      enum: ['SELF', 'DEPENDENT', 'OTHER'],
      default: 'SELF',
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED'],
      default: 'ACTIVE',
      required: true,
    },
    coverageDetails: {
      copayPercentage: { type: Number, default: null },
      annualLimit: { type: Number, default: null },
      remarks: { type: String, default: null, trim: true },
    },
    version: { type: Number, default: 0, min: 0, required: true },
    ...audit,
  },
  { timestamps: true }
);

insurancePolicySchema.index({ payerId: 1, policyNumber: 1 }, { unique: true });
insurancePolicySchema.index({ schemeId: 1, status: 1 });
insurancePolicySchema.index({ holderPatientId: 1, status: 1 });

// 4. Insurance Member Schema
const insuranceMemberSchema = new Schema<InsuranceMemberFields>(
  {
    policyId: { type: Schema.Types.ObjectId, ref: 'InsurancePolicy', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    memberNumber: { type: String, required: true, uppercase: true, trim: true },
    subscriberId: { type: String, default: null, trim: true },
    relationship: {
      type: String,
      enum: ['SELF', 'SPOUSE', 'CHILD', 'PARENT', 'OTHER'],
      default: 'SELF',
      required: true,
    },
    coverageStart: { type: Date, required: true },
    coverageEnd: { type: Date, default: null },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
      required: true,
    },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    version: { type: Number, default: 0, min: 0, required: true },
    ...audit,
  },
  { timestamps: true }
);

insuranceMemberSchema.index({ policyId: 1, memberNumber: 1 }, { unique: true });
insuranceMemberSchema.index(
  { policyId: 1, patientId: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);
insuranceMemberSchema.index({ patientId: 1, status: 1 });
insuranceMemberSchema.index({ policyId: 1, status: 1 });
insuranceMemberSchema.index({ branchId: 1, status: 1 });

export const PayerModel = mongoose.model<PayerFields>('Payer', payerSchema);
export const InsuranceSchemeModel = mongoose.model<InsuranceSchemeFields>('InsuranceScheme', insuranceSchemeSchema);
export const InsurancePolicyModel = mongoose.model<InsurancePolicyFields>('InsurancePolicy', insurancePolicySchema);
export const InsuranceMemberModel = mongoose.model<InsuranceMemberFields>('InsuranceMember', insuranceMemberSchema);

// 5. Eligibility Verification Schema
export type EligibilityVerificationFields = {
  memberId: Types.ObjectId;
  patientId: Types.ObjectId;
  policyId: Types.ObjectId;
  payerId: Types.ObjectId;
  schemeId?: Types.ObjectId | null;
  requestedDate: Date;
  correlationId: string;
  externalReferenceId?: string | null;
  status: EligibilityStatus;
  reasonCode: string;
  errorMessage?: string | null;
  details?: Record<string, unknown> | null;
  requestTimestamp: Date;
  responseTimestamp?: Date | null;
  branchId?: Types.ObjectId | null;
  version: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const eligibilityVerificationSchema = new Schema<EligibilityVerificationFields>(
  {
    memberId: { type: Schema.Types.ObjectId, ref: 'InsuranceMember', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    policyId: { type: Schema.Types.ObjectId, ref: 'InsurancePolicy', required: true },
    payerId: { type: Schema.Types.ObjectId, ref: 'Payer', required: true },
    schemeId: { type: Schema.Types.ObjectId, ref: 'InsuranceScheme', default: null },
    requestedDate: { type: Date, required: true },
    correlationId: { type: String, required: true, trim: true },
    externalReferenceId: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'ELIGIBLE', 'INELIGIBLE', 'FAILED'],
      required: true,
    },
    reasonCode: { type: String, required: true, trim: true },
    errorMessage: { type: String, default: null, trim: true },
    details: { type: Schema.Types.Mixed, default: null },
    requestTimestamp: { type: Date, required: true },
    responseTimestamp: { type: Date, default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    version: { type: Number, default: 0, min: 0, required: true },
    ...audit,
  },
  { timestamps: true }
);

eligibilityVerificationSchema.index({ correlationId: 1 });
eligibilityVerificationSchema.index({ memberId: 1, requestedDate: -1 });
eligibilityVerificationSchema.index({ patientId: 1, status: 1 });
eligibilityVerificationSchema.index({ status: 1, createdAt: -1 });
eligibilityVerificationSchema.index({ branchId: 1, status: 1 });

export const EligibilityVerificationModel = mongoose.model<EligibilityVerificationFields>(
  'InsuranceEligibilityVerification',
  eligibilityVerificationSchema
);

// 6. Insurance Benefit Configuration Schema
export type BenefitConfigFields = {
  payerId: Types.ObjectId;
  schemeId?: Types.ObjectId | null;
  policyId?: Types.ObjectId | null;
  serviceId?: Types.ObjectId | null;
  serviceCode?: string | null;
  category?: string | null;
  coverageRule: 'COVERED' | 'PARTIALLY_COVERED' | 'NOT_COVERED' | 'AUTHORIZATION_REQUIRED';
  authorizationRequired: boolean;
  coverageLimit?: {
    maxAmount?: number | null;
    maxQuantity?: number | null;
    frequency?: string | null;
  } | null;
  copay?: {
    type: 'FIXED' | 'PERCENTAGE';
    value: number;
  } | null;
  isExcluded: boolean;
  exclusionReason?: string | null;
  startDate: Date;
  endDate?: Date | null;
  status: 'ACTIVE' | 'INACTIVE';
  branchId?: Types.ObjectId | null;
  version: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const benefitConfigSchema = new Schema<BenefitConfigFields>(
  {
    payerId: { type: Schema.Types.ObjectId, ref: 'Payer', required: true },
    schemeId: { type: Schema.Types.ObjectId, ref: 'InsuranceScheme', default: null },
    policyId: { type: Schema.Types.ObjectId, ref: 'InsurancePolicy', default: null },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', default: null },
    serviceCode: { type: String, uppercase: true, trim: true, default: null },
    category: { type: String, trim: true, default: null },
    coverageRule: {
      type: String,
      enum: ['COVERED', 'PARTIALLY_COVERED', 'NOT_COVERED', 'AUTHORIZATION_REQUIRED'],
      default: 'COVERED',
      required: true,
    },
    authorizationRequired: { type: Boolean, default: false, required: true },
    coverageLimit: {
      maxAmount: { type: Number, default: null },
      maxQuantity: { type: Number, default: null },
      frequency: { type: String, default: null },
    },
    copay: {
      type: { type: String, enum: ['FIXED', 'PERCENTAGE'] },
      value: { type: Number },
    },
    isExcluded: { type: Boolean, default: false, required: true },
    exclusionReason: { type: String, default: null, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      required: true,
    },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    version: { type: Number, default: 0, min: 0, required: true },
    ...audit,
  },
  { timestamps: true }
);

benefitConfigSchema.index({ payerId: 1, schemeId: 1, serviceId: 1, status: 1 });
benefitConfigSchema.index({ payerId: 1, serviceCode: 1, status: 1 });
benefitConfigSchema.index({ payerId: 1, category: 1, status: 1 });
benefitConfigSchema.index({ status: 1, startDate: 1, endDate: 1 });
benefitConfigSchema.index({ branchId: 1, status: 1 });

export const BenefitConfigModel = mongoose.model<BenefitConfigFields>(
  'InsuranceBenefitConfig',
  benefitConfigSchema
);
