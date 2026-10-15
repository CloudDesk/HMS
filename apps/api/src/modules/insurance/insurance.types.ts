export type PayerType = 'SHA' | 'PRIVATE' | 'TPA' | 'OTHER';
export type PayerStatus = 'ACTIVE' | 'INACTIVE';
export type SchemeStatus = 'ACTIVE' | 'INACTIVE';
export type PolicyStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED';
export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type HolderType = 'SELF' | 'DEPENDENT' | 'OTHER';
export type MemberRelationship = 'SELF' | 'SPOUSE' | 'CHILD' | 'PARENT' | 'OTHER';

export type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

// Payer DTOs
export type CreatePayerInput = {
  payerCode: string;
  name: string;
  type?: PayerType;
  status?: PayerStatus;
  branchId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  contactInfo?: {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    website?: string | null;
  };
};

export type UpdatePayerInput = Partial<CreatePayerInput>;

export type ListPayersQuery = {
  status?: PayerStatus;
  type?: PayerType;
  search?: string;
  branchId?: string;
  limit?: number;
  offset?: number;
};

// Scheme DTOs
export type CreateSchemeInput = {
  payerId: string;
  schemeCode: string;
  name: string;
  planType?: string | null;
  networkType?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  status?: SchemeStatus;
  branchId?: string | null;
};

export type UpdateSchemeInput = Partial<Omit<CreateSchemeInput, 'payerId'>>;

export type ListSchemesQuery = {
  payerId?: string;
  status?: SchemeStatus;
  search?: string;
  limit?: number;
  offset?: number;
};

// Policy DTOs
export type CreatePolicyInput = {
  payerId: string;
  schemeId: string;
  policyNumber: string;
  holderPatientId: string;
  holderType?: HolderType;
  startDate: string;
  endDate?: string | null;
  status?: PolicyStatus;
  coverageDetails?: {
    copayPercentage?: number | null;
    annualLimit?: number | null;
    remarks?: string | null;
  };
};

export type UpdatePolicyInput = Partial<Omit<CreatePolicyInput, 'payerId' | 'schemeId' | 'holderPatientId'>>;

export type ListPoliciesQuery = {
  payerId?: string;
  schemeId?: string;
  patientId?: string;
  policyNumber?: string;
  status?: PolicyStatus;
  limit?: number;
  offset?: number;
};

// Member DTOs
export type CreateMemberInput = {
  policyId: string;
  patientId: string;
  memberNumber: string;
  subscriberId?: string | null;
  relationship: MemberRelationship;
  coverageStart: string;
  coverageEnd?: string | null;
  status?: MemberStatus;
  branchId?: string | null;
};

export type UpdateMemberInput = Partial<Omit<CreateMemberInput, 'policyId' | 'patientId'>>;

export type ListMembersQuery = {
  policyId?: string;
  patientId?: string;
  memberNumber?: string;
  status?: MemberStatus;
  branchId?: string;
  limit?: number;
  offset?: number;
};

// Coverage Check Types
export type CoverageCheckReasonCode =
  | 'LOCAL_COVERAGE_VALID'
  | 'MEMBER_NOT_FOUND'
  | 'MEMBER_INACTIVE'
  | 'MEMBER_SUSPENDED'
  | 'MEMBER_COVERAGE_NOT_STARTED'
  | 'MEMBER_COVERAGE_EXPIRED'
  | 'POLICY_NOT_FOUND'
  | 'POLICY_INACTIVE'
  | 'POLICY_EXPIRED'
  | 'POLICY_SUSPENDED'
  | 'POLICY_NOT_EFFECTIVE'
  | 'PATIENT_MISMATCH'
  | 'PATIENT_NOT_FOUND'
  | 'COVERAGE_OUTSIDE_POLICY_PERIOD';

export type ShaEligibilityStatus = 'NOT_VERIFIED' | 'PENDING';

export type CoverageCheckResult = {
  valid: boolean;
  reasonCode: CoverageCheckReasonCode;
  shaEligibilityStatus: ShaEligibilityStatus;
  memberId?: string;
  policyId?: string;
  patientId?: string;
  payerId?: string;
  schemeId?: string;
  memberNumber?: string;
  policyNumber?: string;
  payerCode?: string;
  schemeCode?: string;
  message: string;
  checkedAt: string;
  details?: Record<string, unknown>;
};

export type CheckCoverageInput = {
  memberId?: string;
  policyId?: string;
  patientId?: string;
  memberNumber?: string;
  asOfDate?: string;
};

// Eligibility Verification Types
export type EligibilityStatus = 'PENDING' | 'ELIGIBLE' | 'INELIGIBLE' | 'FAILED';

export type VerifyEligibilityInput = {
  memberId: string;
  requestedDate?: string;
  forceRefresh?: boolean;
  correlationId?: string;
};

export type EligibilityVerificationResult = {
  id: string;
  memberId: string;
  patientId: string;
  policyId: string;
  payerId: string;
  schemeId?: string | null;
  memberNumber: string;
  policyNumber: string;
  payerCode: string;
  schemeCode?: string | null;
  requestedDate: string;
  correlationId: string;
  externalReferenceId?: string | null;
  status: EligibilityStatus;
  reasonCode: string;
  message: string;
  errorMessage?: string | null;
  details?: Record<string, unknown>;
  requestTimestamp: string;
  responseTimestamp?: string | null;
  createdAt: string;
};

export type ListEligibilityVerificationsQuery = {
  memberId?: string;
  patientId?: string;
  status?: EligibilityStatus;
  correlationId?: string;
  limit?: number;
  offset?: number;
};

// ================= BENEFIT CONFIGURATION & VERIFICATION =================
export type CoverageRule = 'COVERED' | 'PARTIALLY_COVERED' | 'NOT_COVERED' | 'AUTHORIZATION_REQUIRED';

export type BenefitLimit = {
  maxAmount?: number | null;
  maxQuantity?: number | null;
  frequency?: string | null;
};

/** Configured copay terms, never calculated or adjudicated financial liability. */
export type ConfiguredPatientResponsibility = {
  type: 'FIXED' | 'PERCENTAGE';
  value: number;
};

/** @deprecated Use ConfiguredPatientResponsibility. */
export type PatientResponsibility = ConfiguredPatientResponsibility;

export type BenefitStatus = 'ACTIVE' | 'INACTIVE';

export type CreateBenefitConfigInput = {
  payerId: string;
  schemeId?: string | null;
  policyId?: string | null;
  serviceId?: string | null;
  serviceCode?: string | null;
  category?: string | null;
  coverageRule: CoverageRule;
  authorizationRequired?: boolean;
  coverageLimit?: BenefitLimit | null;
  copay?: ConfiguredPatientResponsibility | null;
  isExcluded?: boolean;
  exclusionReason?: string | null;
  startDate: string;
  endDate?: string | null;
  status?: BenefitStatus;
  branchId?: string | null;
};

export type UpdateBenefitConfigInput = Partial<CreateBenefitConfigInput>;

export type ListBenefitConfigsQuery = {
  payerId?: string;
  schemeId?: string;
  serviceId?: string;
  serviceCode?: string;
  category?: string;
  status?: BenefitStatus;
  branchId?: string;
  limit?: number;
  offset?: number;
};

export type VerifyBenefitInput = {
  memberId: string;
  serviceId?: string;
  serviceCode?: string;
  requestedDate?: string;
  quantity?: number;
};

export type VerifyBenefitResult = {
  eligible: boolean;
  benefitStatus: CoverageRule;
  memberId: string;
  serviceId?: string;
  serviceCode?: string;
  serviceName?: string;
  benefitId?: string;
  /** Configured limits, not remaining balances or approved amounts. */
  coverageLimit?: BenefitLimit | null;
  configuredPatientResponsibility?: ConfiguredPatientResponsibility | null;
  financialTermsBasis?: 'CONFIGURED_ONLY';
  /** @deprecated Configured copay alias only; never final patient liability. */
  patientResponsibility?: ConfiguredPatientResponsibility | null;
  reasonCode: string;
  message: string;
  authorizationRequired: boolean;
  verifiedAt: string;
};
