import { apiClient } from './client';

export type ApiDepartmentStatus = 'ACTIVE' | 'INACTIVE';

export type DepartmentResponse = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  branch_id: string;
  status: ApiDepartmentStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type DepartmentListResponse = {
  data: DepartmentResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type DepartmentListParams = Partial<{
  search: string;
  status: ApiDepartmentStatus;
  branch_id: string;
  page: number;
  limit: number;
  sortBy: 'name' | 'code' | 'created_at';
  sortOrder: 'asc' | 'desc';
}>;

export type SaveDepartmentPayload = {
  code: string;
  name: string;
  branch_id: string;
  description?: string | null;
  status?: ApiDepartmentStatus;
};

const toQueryString = (params: DepartmentListParams) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const departmentsApi = {
  list(params: DepartmentListParams = {}) {
    return apiClient.request<DepartmentListResponse>(`/departments${toQueryString(params)}`);
  },

  getById(id: string) {
    return apiClient.request<{ data: DepartmentResponse }>(`/departments/${encodeURIComponent(id)}`);
  },

  create(payload: SaveDepartmentPayload) {
    return apiClient.request<{ data: DepartmentResponse }>('/departments', {
      body: payload,
      method: 'POST',
    });
  },

  update(id: string, payload: Partial<SaveDepartmentPayload>) {
    return apiClient.request<{ data: DepartmentResponse }>(`/departments/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  delete(id: string) {
    return apiClient.request<{ ok: true }>(`/departments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
