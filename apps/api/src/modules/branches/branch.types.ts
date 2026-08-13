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
