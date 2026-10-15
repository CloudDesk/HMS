export type BranchStatus = 'ACTIVE' | 'INACTIVE';

export type Branch = {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  status: BranchStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type BranchListQuery = {
  search?: string;
  status?: BranchStatus;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'code' | 'status' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type CreateBranchDTO = {
  code: string;
  name: string;
  short_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  status?: BranchStatus;
};

export type UpdateBranchDTO = Partial<CreateBranchDTO>;

export type BranchRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

export type BranchIdentifierStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED';

export type BranchIdentifier = {
  id: string;
  identifier_type: string;
  value: string;
  issuing_authority: string;
  status: BranchIdentifierStatus;
  effective_from: string | null;
  effective_to: string | null;
  verified_at: string | null;
  verified_by: string | null;
};

export type AddBranchIdentifierDTO = {
  identifier_type: string;
  value: string;
  issuing_authority: string;
  status?: BranchIdentifierStatus;
  effective_from?: string | null;
  effective_to?: string | null;
};

export type UpdateBranchIdentifierDTO = {
  status: BranchIdentifierStatus;
  effective_to?: string | null;
};

export type ShaFacilityIdentifierReadinessStatus =
  | 'SHA_FACILITY_IDENTIFIER_SYSTEM_UNCONFIGURED'
  | 'SHA_FACILITY_IDENTIFIER_AVAILABLE'
  | 'SHA_FACILITY_IDENTIFIER_NOT_AVAILABLE';

export type ShaFacilityIdentifierReadiness = {
  status: ShaFacilityIdentifierReadinessStatus;
  identifierSystemConfigured: boolean;
  identifierAvailable: boolean;
  identifierSystem: string | null;
  identifierType: string | null;
};

