import { apiClient } from './client';

export type ApiServiceStatus = 'ACTIVE' | 'INACTIVE';

export type ServiceResponse = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  department_id: string;
  standard_price: number;
  duration_minutes: number;
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
  page: number;
  limit: number;
  sortBy: 'name' | 'code' | 'status' | 'created_at' | 'standard_price';
  sortOrder: 'asc' | 'desc';
}>;

export type CreateServicePayload = {
  code: string;
  name: string;
  department_id: string;
  standard_price: number;
  duration_minutes: number;
  category?: string | null;
  description?: string | null;
  status?: ApiServiceStatus;
};

export type UpdateServicePayload = Partial<Omit<CreateServicePayload, 'code'>>;

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
    return apiClient.request<{ data: ServiceResponse }>(`/services/${encodeURIComponent(id)}`);
  },

  create(payload: CreateServicePayload) {
    return apiClient.request<{ data: ServiceResponse }>('/services', {
      body: payload,
      method: 'POST',
    });
  },

  update(id: string, payload: UpdateServicePayload) {
    return apiClient.request<{ data: ServiceResponse }>(`/services/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  delete(id: string) {
    return apiClient.request<{ ok: true }>(`/services/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
