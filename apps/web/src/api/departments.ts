import { apiClient } from './client';

export type ApiDepartmentStatus = 'ACTIVE' | 'INACTIVE';

export type DepartmentResponse = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  branch_ids: string[];
  status: ApiDepartmentStatus;
  isClinical: boolean;
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
  isClinical: boolean;
  branch_id: string;
  page: number;
  limit: number;
  sortBy: 'name' | 'code' | 'status' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}>;

export type SaveDepartmentPayload = {
  code: string;
  name: string;
  branch_ids: string[];
  description?: string | null;
  status?: ApiDepartmentStatus;
  isClinical?: boolean;
};

export type DepartmentSummary = {
  total: number;
  active: number;
  inactive: number;
  addedThisMonth: number;
  branchesCovered: number;
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
    return apiClient.request<DepartmentResponse>(`/departments/${encodeURIComponent(id)}`);
  },

  summary() {
    return apiClient.request<DepartmentSummary>('/departments/summary');
  },

  export(params: DepartmentListParams = {}) {
    return apiClient.requestBlob(`/departments/export${toQueryString(params)}`);
  },

  create(payload: SaveDepartmentPayload) {
    return apiClient.request<DepartmentResponse>('/departments', {
      body: payload,
      method: 'POST',
    });
  },

  update(id: string, payload: Partial<SaveDepartmentPayload>) {
    return apiClient.request<DepartmentResponse>(`/departments/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  updateStatus(id: string, status: ApiDepartmentStatus) {
    return apiClient.request<DepartmentResponse>(`/departments/${encodeURIComponent(id)}/status`, {
      body: { status },
      method: 'PATCH',
    });
  },

  delete(id: string) {
    return apiClient.request<{ ok: true }>(`/departments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
