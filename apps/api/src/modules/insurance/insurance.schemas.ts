import { z } from 'zod';

export const idParamsSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

// Payers
export const createPayerSchema = z.object({
  payerCode: z.string().min(1, 'Payer code is required'),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['SHA', 'PRIVATE', 'TPA', 'OTHER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  branchId: z.string().nullable().optional(),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
  contactInfo: z
    .object({
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      website: z.string().nullable().optional(),
    })
    .optional(),
});

export const updatePayerSchema = createPayerSchema.partial();

export const listPayersSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  type: z.enum(['SHA', 'PRIVATE', 'TPA', 'OTHER']).optional(),
  search: z.string().optional(),
  branchId: z.string().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

// Schemes
export const createSchemeSchema = z.object({
  payerId: z.string().min(1, 'Payer ID is required'),
  schemeCode: z.string().min(1, 'Scheme code is required'),
  name: z.string().min(1, 'Name is required'),
  planType: z.string().nullable().optional(),
  networkType: z.string().nullable().optional(),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  branchId: z.string().nullable().optional(),
});

export const updateSchemeSchema = createSchemeSchema.omit({ payerId: true }).partial();

export const listSchemesSchema = z.object({
  payerId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

// Policies
export const createPolicySchema = z.object({
  payerId: z.string().min(1, 'Payer ID is required'),
  schemeId: z.string().min(1, 'Scheme ID is required'),
  policyNumber: z.string().min(1, 'Policy number is required'),
  holderPatientId: z.string().min(1, 'Holder patient ID is required'),
  holderType: z.enum(['SELF', 'DEPENDENT', 'OTHER']).optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED']).optional(),
  coverageDetails: z
    .object({
      copayPercentage: z.number().nullable().optional(),
      annualLimit: z.number().nullable().optional(),
      remarks: z.string().nullable().optional(),
    })
    .optional(),
});

export const updatePolicySchema = createPolicySchema
  .omit({ payerId: true, schemeId: true, holderPatientId: true })
  .partial();

export const listPoliciesSchema = z.object({
  payerId: z.string().optional(),
  schemeId: z.string().optional(),
  patientId: z.string().optional(),
  policyNumber: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED']).optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

// Members
export const createMemberSchema = z.object({
  policyId: z.string().min(1, 'Policy ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  memberNumber: z.string().min(1, 'Member number is required'),
  subscriberId: z.string().nullable().optional(),
  relationship: z.enum(['SELF', 'SPOUSE', 'CHILD', 'PARENT', 'OTHER']),
  coverageStart: z.string().min(1, 'Coverage start date is required'),
  coverageEnd: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  branchId: z.string().nullable().optional(),
});

export const updateMemberSchema = createMemberSchema
  .omit({ policyId: true, patientId: true })
  .partial();

export const listMembersSchema = z.object({
  policyId: z.string().optional(),
  patientId: z.string().optional(),
  memberNumber: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  branchId: z.string().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

// Coverage Check Schema
export const checkCoverageSchema = z.object({
  memberId: z.string().optional(),
  policyId: z.string().optional(),
  patientId: z.string().optional(),
  memberNumber: z.string().optional(),
  asOfDate: z.string().optional(),
});

// Eligibility Verification Schemas
export const verifyEligibilitySchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  requestedDate: z.string().optional(),
  forceRefresh: z.boolean().optional(),
  correlationId: z.string().optional(),
});

export const listEligibilityVerificationsSchema = z.object({
  memberId: z.string().optional(),
  patientId: z.string().optional(),
  status: z.enum(['PENDING', 'ELIGIBLE', 'INELIGIBLE', 'FAILED']).optional(),
  correlationId: z.string().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

// ================= BENEFIT CONFIGURATION & VERIFICATION SCHEMAS =================
export const createBenefitConfigSchema = z.object({
  payerId: z.string().min(1, 'Payer ID is required'),
  schemeId: z.string().nullable().optional(),
  policyId: z.string().nullable().optional(),
  serviceId: z.string().nullable().optional(),
  serviceCode: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  coverageRule: z.enum(['COVERED', 'PARTIALLY_COVERED', 'NOT_COVERED', 'AUTHORIZATION_REQUIRED']),
  authorizationRequired: z.boolean().optional(),
  coverageLimit: z
    .object({
      maxAmount: z.number().nullable().optional(),
      maxQuantity: z.number().nullable().optional(),
      frequency: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  copay: z
    .object({
      type: z.enum(['FIXED', 'PERCENTAGE']),
      value: z.number().min(0),
    })
    .nullable()
    .optional(),
  isExcluded: z.boolean().optional(),
  exclusionReason: z.string().nullable().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  branchId: z.string().nullable().optional(),
});

export const updateBenefitConfigSchema = createBenefitConfigSchema.partial();

export const listBenefitConfigsSchema = z.object({
  payerId: z.string().optional(),
  schemeId: z.string().optional(),
  serviceId: z.string().optional(),
  serviceCode: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  branchId: z.string().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

export const verifyBenefitSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  serviceId: z.string().optional(),
  serviceCode: z.string().optional(),
  requestedDate: z.string().optional(),
  quantity: z.number().positive().optional(),
});
