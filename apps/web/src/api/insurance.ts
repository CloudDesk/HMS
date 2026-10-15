import { apiClient } from './client';

export type InsurancePaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

// ── 1. PAYERS ───────────────────────────────────────────────────────────────

export type PayerType = 'SHA' | 'PRIVATE' | 'TPA' | 'OTHER';
export type PayerStatus = 'ACTIVE' | 'INACTIVE';

export type PayerContactInfo = {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
};

export type InsurancePayer = {
  _id: string;
  payerCode: string;
  name: string;
  type: PayerType;
  status: PayerStatus;
  branchId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  contactInfo?: PayerContactInfo;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreatePayerPayload = {
  payerCode: string;
  name: string;
  type?: PayerType;
  status?: PayerStatus;
  branchId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  contactInfo?: PayerContactInfo;
};

export type UpdatePayerPayload = Partial<CreatePayerPayload>;

export type ListPayersParams = Partial<{
  status: PayerStatus;
  type: PayerType;
  search: string;
  branchId: string;
  limit: number;
  offset: number;
}>;

// ── 2. SCHEMES ──────────────────────────────────────────────────────────────

export type SchemeStatus = 'ACTIVE' | 'INACTIVE';

export type InsuranceScheme = {
  _id: string;
  payerId: string;
  schemeCode: string;
  name: string;
  planType?: string | null;
  networkType?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  status: SchemeStatus;
  branchId?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateSchemePayload = {
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

export type UpdateSchemePayload = Partial<Omit<CreateSchemePayload, 'payerId'>>;

export type ListSchemesParams = Partial<{
  payerId: string;
  status: SchemeStatus;
  search: string;
  limit: number;
  offset: number;
}>;

// ── 3. POLICIES ─────────────────────────────────────────────────────────────

export type PolicyHolderType = 'SELF' | 'DEPENDENT' | 'OTHER';
export type PolicyStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED';

export type PolicyCoverageDetails = {
  copayPercentage?: number | null;
  annualLimit?: number | null;
  remarks?: string | null;
};

export type InsurancePolicy = {
  _id: string;
  payerId: string;
  schemeId: string;
  policyNumber: string;
  holderPatientId: string;
  holderType?: PolicyHolderType;
  startDate: string;
  endDate?: string | null;
  status: PolicyStatus;
  coverageDetails?: PolicyCoverageDetails;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreatePolicyPayload = {
  payerId: string;
  schemeId: string;
  policyNumber: string;
  holderPatientId: string;
  holderType?: PolicyHolderType;
  startDate: string;
  endDate?: string | null;
  status?: PolicyStatus;
  coverageDetails?: PolicyCoverageDetails;
};

export type UpdatePolicyPayload = Partial<
  Omit<CreatePolicyPayload, 'payerId' | 'schemeId' | 'holderPatientId'>
>;

export type ListPoliciesParams = Partial<{
  payerId: string;
  schemeId: string;
  patientId: string;
  policyNumber: string;
  status: PolicyStatus;
  limit: number;
  offset: number;
}>;

// ── 4. MEMBERS ──────────────────────────────────────────────────────────────

export type MemberRelationship = 'SELF' | 'SPOUSE' | 'CHILD' | 'PARENT' | 'OTHER';
export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type InsuranceMember = {
  _id: string;
  policyId: string;
  patientId: string;
  memberNumber: string;
  subscriberId?: string | null;
  relationship: MemberRelationship;
  coverageStart: string;
  coverageEnd?: string | null;
  status: MemberStatus;
  branchId?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateMemberPayload = {
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

export type UpdateMemberPayload = Partial<
  Omit<CreateMemberPayload, 'policyId' | 'patientId'>
>;

export type ListMembersParams = Partial<{
  policyId: string;
  patientId: string;
  memberNumber: string;
  status: MemberStatus;
  branchId: string;
  limit: number;
  offset: number;
}>;

export type CoverageCheckResult = {
  valid: boolean;
  reasonCode: string;
  shaEligibilityStatus: 'NOT_VERIFIED' | 'PENDING';
  message: string;
  checkedAt: string;
  memberId?: string;
  policyId?: string;
  patientId?: string;
  payerId?: string;
  schemeId?: string;
  memberNumber?: string;
  policyNumber?: string;
  payerCode?: string;
  schemeCode?: string;
  details?: Record<string, unknown>;
};

export type CheckCoveragePayload = {
  memberId?: string;
  policyId?: string;
  patientId?: string;
  memberNumber?: string;
  asOfDate?: string;
};

// ── 5. BENEFITS ─────────────────────────────────────────────────────────────

export type CoverageRule =
  | 'COVERED'
  | 'PARTIALLY_COVERED'
  | 'NOT_COVERED'
  | 'AUTHORIZATION_REQUIRED';

export type BenefitStatus = 'ACTIVE' | 'INACTIVE';

export type BenefitLimit = {
  maxAmount?: number | null;
  maxQuantity?: number | null;
  frequency?: string | null;
};

export type BenefitCopay = {
  type: 'FIXED' | 'PERCENTAGE';
  value: number;
};

export type BenefitConfig = {
  _id: string;
  payerId: string;
  schemeId?: string | null;
  policyId?: string | null;
  serviceId?: string | null;
  serviceCode?: string | null;
  category?: string | null;
  coverageRule: CoverageRule;
  authorizationRequired?: boolean;
  coverageLimit?: BenefitLimit | null;
  copay?: BenefitCopay | null;
  isExcluded?: boolean;
  exclusionReason?: string | null;
  startDate: string;
  endDate?: string | null;
  status: BenefitStatus;
  branchId?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateBenefitConfigPayload = {
  payerId: string;
  schemeId?: string | null;
  policyId?: string | null;
  serviceId?: string | null;
  serviceCode?: string | null;
  category?: string | null;
  coverageRule: CoverageRule;
  authorizationRequired?: boolean;
  coverageLimit?: BenefitLimit | null;
  copay?: BenefitCopay | null;
  isExcluded?: boolean;
  exclusionReason?: string | null;
  startDate: string;
  endDate?: string | null;
  status?: BenefitStatus;
  branchId?: string | null;
};

export type UpdateBenefitConfigPayload = Partial<CreateBenefitConfigPayload>;

export type ListBenefitConfigsParams = Partial<{
  payerId: string;
  schemeId: string;
  serviceId: string;
  serviceCode: string;
  category: string;
  status: BenefitStatus;
  branchId: string;
  limit: number;
  offset: number;
}>;

export type VerifyBenefitPayload = {
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
  coverageLimit?: BenefitLimit | null;
  configuredPatientResponsibility?: BenefitCopay | null;
  financialTermsBasis?: 'CONFIGURED_ONLY';
  patientResponsibility?: BenefitCopay | null;
  reasonCode: string;
  message: string;
  authorizationRequired: boolean;
  verifiedAt: string;
};

// ── 6. SHA SERVICE MAPPINGS ─────────────────────────────────────────────────

export type ShaServiceMapping = {
  _id: string;
  serviceId: string;
  interventionCode: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateShaServiceMappingPayload = {
  serviceId: string;
  interventionCode: string;
  effectiveFrom: string;
  effectiveTo?: string;
};

export type ListShaServiceMappingsParams = Partial<{
  serviceId: string;
  limit: number;
  offset: number;
}>;

export type DeactivateShaServiceMappingPayload = {
  version: number;
  reason: string;
};

// ── Query String Helper ─────────────────────────────────────────────────────

const toQueryString = (params: Record<string, unknown>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim().length > 0) {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

// ── API CLIENT ──────────────────────────────────────────────────────────────

export const insuranceApi = {
  // Payers
  listPayers(params: ListPayersParams = {}) {
    return apiClient.request<InsurancePaginatedResponse<InsurancePayer>>(
      `/insurance/payers${toQueryString(params)}`
    );
  },

  getPayer(id: string) {
    return apiClient.request<InsurancePayer>(`/insurance/payers/${encodeURIComponent(id)}`);
  },

  createPayer(payload: CreatePayerPayload) {
    return apiClient.request<InsurancePayer>('/insurance/payers', {
      body: payload,
      method: 'POST',
    });
  },

  updatePayer(id: string, payload: UpdatePayerPayload) {
    return apiClient.request<InsurancePayer>(`/insurance/payers/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  // Schemes
  listSchemes(params: ListSchemesParams = {}) {
    return apiClient.request<InsurancePaginatedResponse<InsuranceScheme>>(
      `/insurance/schemes${toQueryString(params)}`
    );
  },

  getScheme(id: string) {
    return apiClient.request<InsuranceScheme>(`/insurance/schemes/${encodeURIComponent(id)}`);
  },

  createScheme(payload: CreateSchemePayload) {
    return apiClient.request<InsuranceScheme>('/insurance/schemes', {
      body: payload,
      method: 'POST',
    });
  },

  updateScheme(id: string, payload: UpdateSchemePayload) {
    return apiClient.request<InsuranceScheme>(`/insurance/schemes/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  // Policies
  listPolicies(params: ListPoliciesParams = {}) {
    return apiClient.request<InsurancePaginatedResponse<InsurancePolicy>>(
      `/insurance/policies${toQueryString(params)}`
    );
  },

  getPolicy(id: string) {
    return apiClient.request<InsurancePolicy>(`/insurance/policies/${encodeURIComponent(id)}`);
  },

  createPolicy(payload: CreatePolicyPayload) {
    return apiClient.request<InsurancePolicy>('/insurance/policies', {
      body: payload,
      method: 'POST',
    });
  },

  updatePolicy(id: string, payload: UpdatePolicyPayload) {
    return apiClient.request<InsurancePolicy>(`/insurance/policies/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  // Members
  listMembers(params: ListMembersParams = {}) {
    return apiClient.request<InsurancePaginatedResponse<InsuranceMember>>(
      `/insurance/members${toQueryString(params)}`
    );
  },

  getMember(id: string) {
    return apiClient.request<InsuranceMember>(`/insurance/members/${encodeURIComponent(id)}`);
  },

  createMember(payload: CreateMemberPayload) {
    return apiClient.request<InsuranceMember>('/insurance/members', {
      body: payload,
      method: 'POST',
    });
  },

  updateMember(id: string, payload: UpdateMemberPayload) {
    return apiClient.request<InsuranceMember>(`/insurance/members/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  getMemberCoverageStatus(id: string, asOfDate?: string) {
    const qs = asOfDate ? `?asOfDate=${encodeURIComponent(asOfDate)}` : '';
    return apiClient.request<CoverageCheckResult>(
      `/insurance/members/${encodeURIComponent(id)}/coverage-status${qs}`
    );
  },

  checkCoverage(payload: CheckCoveragePayload) {
    return apiClient.request<CoverageCheckResult>('/insurance/coverage/check', {
      body: payload,
      method: 'POST',
    });
  },

  // Benefits
  listBenefitConfigs(params: ListBenefitConfigsParams = {}) {
    return apiClient.request<InsurancePaginatedResponse<BenefitConfig>>(
      `/insurance/benefits${toQueryString(params)}`
    );
  },

  getBenefitConfig(id: string) {
    return apiClient.request<BenefitConfig>(`/insurance/benefits/${encodeURIComponent(id)}`);
  },

  createBenefitConfig(payload: CreateBenefitConfigPayload) {
    return apiClient.request<BenefitConfig>('/insurance/benefits', {
      body: payload,
      method: 'POST',
    });
  },

  updateBenefitConfig(id: string, payload: UpdateBenefitConfigPayload) {
    return apiClient.request<BenefitConfig>(`/insurance/benefits/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PUT',
    });
  },

  verifyBenefit(payload: VerifyBenefitPayload) {
    return apiClient.request<VerifyBenefitResult>('/insurance/benefits/verify', {
      body: payload,
      method: 'POST',
    });
  },

  // SHA Service Mappings
  listShaServiceMappings(params: ListShaServiceMappingsParams = {}) {
    return apiClient.request<InsurancePaginatedResponse<ShaServiceMapping>>(
      `/insurance/sha-service-mappings${toQueryString(params)}`
    );
  },

  createShaServiceMapping(payload: CreateShaServiceMappingPayload) {
    return apiClient.request<ShaServiceMapping>('/insurance/sha-service-mappings', {
      body: payload,
      method: 'POST',
    });
  },

  deactivateShaServiceMapping(id: string, payload: DeactivateShaServiceMappingPayload) {
    return apiClient.request<ShaServiceMapping>(
      `/insurance/sha-service-mappings/${encodeURIComponent(id)}/deactivate`,
      {
        body: payload,
        method: 'POST',
      }
    );
  },
};
