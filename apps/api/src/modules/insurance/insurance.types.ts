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
