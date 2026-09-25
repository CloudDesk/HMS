export type InsuranceOperatingMode = 'PROVIDER' | 'PAYER' | 'TPA' | 'HYBRID';

export type InsuranceConfiguration = {
  id: string | null;
  operating_mode: InsuranceOperatingMode;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

export type UpdateInsuranceConfigurationDTO = {
  operating_mode: InsuranceOperatingMode;
  version: number;
  reason: string;
};

export type InsuranceProviderType =
  | 'HOSPITAL'
  | 'CLINIC'
  | 'PHARMACY'
  | 'LABORATORY'
  | 'IMAGING'
  | 'DENTAL'
  | 'OPTICAL'
  | 'OTHER';

export type InsuranceProviderStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export type InsuranceProvider = {
  id: string;
  provider_code: string;
  legal_name: string;
  trading_name: string | null;
  provider_type: InsuranceProviderType;
  registration_number: string | null;
  tax_id: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: InsuranceProviderStatus;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type InsuranceProviderListQuery = {
  search?: string;
  provider_type?: InsuranceProviderType;
  status?: InsuranceProviderStatus;
  page?: number;
  limit?: number;
  sortBy?: 'provider_code' | 'legal_name' | 'provider_type' | 'status' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type CreateInsuranceProviderDTO = {
  provider_code: string;
  legal_name: string;
  trading_name?: string | null;
  provider_type: InsuranceProviderType;
  registration_number?: string | null;
  tax_id?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export type UpdateInsuranceProviderDTO = Partial<CreateInsuranceProviderDTO> & {
  version: number;
};

export type InsuranceProviderAction = 'activate' | 'deactivate';

export type InsuranceStatusActionDTO = {
  version: number;
  reason: string;
  approval_request_id?: string;
};

export type InsuranceProviderBranchStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export type InsuranceProviderBranch = {
  id: string;
  provider_id: string;
  branch_id: string;
  branch_code: string | null;
  branch_name: string | null;
  effective_from: Date;
  effective_to: Date | null;
  status: InsuranceProviderBranchStatus;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type InsuranceProviderBranchListQuery = {
  branch_id?: string;
  status?: InsuranceProviderBranchStatus;
  effective_on?: string;
  page?: number;
  limit?: number;
  sortBy?: 'effective_from' | 'effective_to' | 'status' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type InsurancePayerType = 'INSURER' | 'TPA' | 'GOVERNMENT' | 'EMPLOYER';
export type InsuranceSubmissionMode = 'MANUAL' | 'PORTAL' | 'API' | 'FILE';
export type InsuranceMemberNumberScope = 'PAYER' | 'PAYER_POLICY';
export type InsurancePayerStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export type InsurancePayer = {
  id: string;
  payer_code: string;
  name: string;
  legal_name: string | null;
  payer_type: InsurancePayerType;
  registration_number: string | null;
  tax_id: string | null;
  claims_contact_name: string | null;
  claims_contact_phone: string | null;
  claims_contact_email: string | null;
  finance_contact_name: string | null;
  finance_contact_phone: string | null;
  finance_contact_email: string | null;
  address: string | null;
  submission_mode: InsuranceSubmissionMode;
  portal_url: string | null;
  api_enabled: boolean;
  edi_enabled: boolean;
  portal_enabled: boolean;
  member_number_scope: InsuranceMemberNumberScope;
  status: InsurancePayerStatus;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type InsurancePayerListQuery = {
  search?: string;
  payer_type?: InsurancePayerType;
  submission_mode?: InsuranceSubmissionMode;
  status?: InsurancePayerStatus;
  page?: number;
  limit?: number;
  sortBy?: 'payer_code' | 'name' | 'payer_type' | 'submission_mode' | 'status' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type CreateInsurancePayerDTO = {
  payer_code: string;
  name: string;
  legal_name?: string | null;
  payer_type: InsurancePayerType;
  registration_number?: string | null;
  tax_id?: string | null;
  claims_contact_name?: string | null;
  claims_contact_phone?: string | null;
  claims_contact_email?: string | null;
  finance_contact_name?: string | null;
  finance_contact_phone?: string | null;
  finance_contact_email?: string | null;
  address?: string | null;
  submission_mode?: InsuranceSubmissionMode;
  portal_url?: string | null;
  api_enabled?: boolean;
  edi_enabled?: boolean;
  portal_enabled?: boolean;
  member_number_scope?: InsuranceMemberNumberScope;
};

export type UpdateInsurancePayerDTO = Partial<CreateInsurancePayerDTO> & {
  version: number;
};

export type InsuranceApprovalTransactionType = 'PROVIDER_ACTIVATION' | 'PAYER_ACTIVATION' | 'CONTRACT_ACTIVATION';
export type InsuranceApprovalRuleStatus = 'ACTIVE' | 'INACTIVE';

export type InsuranceApprovalRule = {
  id: string;
  branch_id: string | null;
  payer_id: string | null;
  scheme_id: string | null;
  transaction_type: InsuranceApprovalTransactionType;
  required_permission: string;
  effective_from: Date;
  effective_to: Date | null;
  status: InsuranceApprovalRuleStatus;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type InsuranceApprovalRuleListQuery = {
  branch_id?: string;
  transaction_type?: InsuranceApprovalTransactionType;
  status?: InsuranceApprovalRuleStatus;
  effective_on?: string;
  page?: number;
  limit?: number;
  sortBy?: 'transaction_type' | 'effective_from' | 'effective_to' | 'status' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type CreateInsuranceApprovalRuleDTO = {
  branch_id?: string | null;
  payer_id?: string | null;
  scheme_id?: null;
  transaction_type: InsuranceApprovalTransactionType;
  required_permission: string;
  effective_from: string;
  effective_to?: string | null;
  status?: InsuranceApprovalRuleStatus;
};

export type UpdateInsuranceApprovalRuleDTO = {
  required_permission?: string;
  effective_from?: string;
  effective_to?: string | null;
  status?: InsuranceApprovalRuleStatus;
  version: number;
};

export type InsuranceApprovalResourceType = 'PROVIDER' | 'PAYER' | 'CONTRACT';
export type InsuranceApprovalRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type InsuranceApprovalRequest = {
  id: string;
  approval_rule_id: string;
  branch_id: string | null;
  transaction_type: InsuranceApprovalTransactionType;
  resource_type: InsuranceApprovalResourceType;
  resource_id: string;
  resource_version: number;
  requested_by: string;
  requested_at: Date;
  status: InsuranceApprovalRequestStatus;
  decided_by: string | null;
  decided_at: Date | null;
  decision_reason: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
};

export type InsuranceApprovalRequestListQuery = {
  transaction_type?: InsuranceApprovalTransactionType;
  resource_type?: InsuranceApprovalResourceType;
  resource_id?: string;
  status?: InsuranceApprovalRequestStatus;
  requested_by?: string;
  page?: number;
  limit?: number;
  sortBy?: 'requested_at' | 'status' | 'transaction_type' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type CreateInsuranceApprovalRequestDTO = {
  approval_rule_id: string;
  resource_type: InsuranceApprovalResourceType;
  resource_id: string;
  resource_version: number;
};

export type DecideInsuranceApprovalRequestDTO = {
  version: number;
  decision_reason?: string | null;
};

export type CancelInsuranceApprovalRequestDTO = {
  version: number;
  decision_reason: string;
};

export type InsuranceContractStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'TERMINATED';

export type InsuranceContract = {
  id: string;
  contract_number: string;
  payer_id: string;
  provider_id: string;
  branch_id: string;
  name: string;
  effective_from: Date;
  effective_to: Date | null;
  provider_network: string | null;
  claim_submission_days: number | null;
  status: InsuranceContractStatus;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type InsuranceContractListQuery = {
  branch_id?: string;
  payer_id?: string;
  provider_id?: string;
  status?: InsuranceContractStatus;
  effective_on?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'contract_number' | 'name' | 'effective_from' | 'effective_to' | 'status' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type CreateInsuranceContractDTO = {
  contract_number: string;
  payer_id: string;
  provider_id: string;
  branch_id: string;
  name: string;
  effective_from: string;
  effective_to?: string | null;
  provider_network?: string | null;
  claim_submission_days?: number | null;
};

export type UpdateInsuranceContractDTO = Partial<Omit<CreateInsuranceContractDTO, 'payer_id' | 'provider_id' | 'branch_id'>> & {
  version: number;
};

export type InsuranceContractAction = 'submit' | 'activate' | 'suspend' | 'expire' | 'terminate';

export type InsuranceContractActionDTO = {
  version: number;
  reason?: string | null;
  approval_request_id?: string;
};

export type CreateInsuranceProviderBranchDTO = {
  branch_id: string;
  effective_from: string;
  effective_to?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
};

export type UpdateInsuranceProviderBranchDTO = {
  effective_from?: string;
  effective_to?: string | null;
  status?: InsuranceProviderBranchStatus;
  version: number;
};

export type InsuranceRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
};

export type InsurancePage<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};
