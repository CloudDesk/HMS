import { apiClient } from './client';

export type ApiServiceStatus = 'ACTIVE' | 'INACTIVE';
export type ApiServiceType = 'GENERAL' | 'LAB_TEST' | 'IMAGING_SERVICE' | 'PROCEDURE';

export type ServiceResponse = {
  id: string;
  code: string;
  name: string;
  service_type: ApiServiceType;
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
  status: ApiServiceStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type ServiceListResponse = {
  data: ServiceResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ServiceListParams = Partial<{
  search: string;
  status: ApiServiceStatus;
  department_id: string;
  service_type: ApiServiceType;
  page: number;
  limit: number;
  sortBy: 'name' | 'code' | 'service_type' | 'status' | 'created_at' | 'updated_at' | 'standard_price';
  sortOrder: 'asc' | 'desc';
}>;

export type CreateServicePayload = {
  code: string;
  name: string;
  service_type?: ApiServiceType;
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
  status?: ApiServiceStatus;
};

export type UpdateServicePayload = Partial<CreateServicePayload>;

export type ServiceSummary = {
  total: number;
  active: number;
  inactive: number;
  addedThisMonth: number;
  departmentsCovered: number;
  byType: Record<ApiServiceType, number>;
};

const toQueryString = (params: ServiceListParams): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const servicesApi = {
  list(params: ServiceListParams = {}) {
    return apiClient.request<ServiceListResponse>(`/services${toQueryString(params)}`);
  },

  getById(id: string) {
    return apiClient.request<ServiceResponse>(`/services/${encodeURIComponent(id)}`);
  },

  summary() {
    return apiClient.request<ServiceSummary>('/services/summary');
  },

  export(params: ServiceListParams = {}) {
    return apiClient.requestBlob(`/services/export${toQueryString(params)}`);
  },

  create(payload: CreateServicePayload) {
    return apiClient.request<ServiceResponse>('/services', {
      body: payload,
      method: 'POST',
    });
  },

  update(id: string, payload: UpdateServicePayload) {
    return apiClient.request<ServiceResponse>(`/services/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  updateStatus(id: string, status: ApiServiceStatus) {
    return apiClient.request<ServiceResponse>(`/services/${encodeURIComponent(id)}/status`, {
      body: { status },
      method: 'PATCH',
    });
  },

  delete(id: string) {
    return apiClient.request<{ success: true }>(`/services/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
