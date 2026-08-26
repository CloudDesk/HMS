export type ServiceStatus = 'ACTIVE' | 'INACTIVE';
export type ServiceType = 'GENERAL' | 'LAB_TEST' | 'IMAGING_SERVICE' | 'PROCEDURE';

export type Service = {
  id: string;
  code: string;
  name: string;
  service_type: ServiceType;
  category: string | null;
  sample_type?: string | null;
  description: string | null;
  department_id: string;
  standard_price: number;
  default_duration_minutes: number | null;
  booking_capacity: number | null;
  requires_bed: boolean;
  requires_consent: boolean;
  requires_advance_deposit: boolean;
  minimum_advance_deposit_amount: number | null;
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
  service_type?: ServiceType;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'code' | 'service_type' | 'status' | 'created_at' | 'updated_at' | 'standard_price';
  sortOrder?: 'asc' | 'desc';
};

export type CreateServiceDTO = {
  code: string;
  name: string;
  service_type?: ServiceType;
  department_id: string;
  standard_price: number;
  default_duration_minutes?: number | null;
  booking_capacity?: number | null;
  requires_bed?: boolean;
  requires_consent?: boolean;
  requires_advance_deposit?: boolean;
  minimum_advance_deposit_amount?: number | null;
  category?: string | null;
  sample_type?: string | null;
  description?: string | null;
  status?: ServiceStatus;
};

export type UpdateServiceDTO = Partial<CreateServiceDTO>;

export type ServiceRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};
