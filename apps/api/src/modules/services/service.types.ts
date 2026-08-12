export type ServiceStatus = 'ACTIVE' | 'INACTIVE';

export type Service = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  department_id: string;
  standard_price: number;
  duration_minutes: number;
  status: ServiceStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ServiceListQuery = {
  search?: string;
  status?: ServiceStatus;
  department_id?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'code' | 'status' | 'created_at' | 'updated_at' | 'standard_price';
  sortOrder?: 'asc' | 'desc';
};

export type CreateServiceDTO = {
  code: string;
  name: string;
  department_id: string;
  standard_price: number;
  duration_minutes: number;
  category?: string | null;
  description?: string | null;
  status?: ServiceStatus;
};

export type UpdateServiceDTO = Partial<CreateServiceDTO>;

export type ServiceRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};
