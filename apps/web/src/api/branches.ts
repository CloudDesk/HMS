import { apiClient } from './client';

export type ApiBranchStatus = 'ACTIVE' | 'INACTIVE';

export type BranchResponse = {
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
  status: ApiBranchStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type BranchListResponse = {
  data: BranchResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type BranchListParams = Partial<{
  search: string;
  status: ApiBranchStatus;
  page: number;
  limit: number;
  sortBy: 'name' | 'code' | 'status' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}>;

export type SaveBranchPayload = {
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
  status?: ApiBranchStatus;
};

export type UpdateBranchPayload = Partial<SaveBranchPayload>;

export type BranchSummary = {
  total: number;
  active: number;
  inactive: number;
  assignedUsers: number;
  cities: number;
};

const toQueryString = (params: BranchListParams) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const branchesApi = {
  list(params: BranchListParams = {}) {
    return apiClient.request<BranchListResponse>(`/branches${toQueryString(params)}`);
  },

  getById(id: string) {
    return apiClient.request<BranchResponse>(`/branches/${encodeURIComponent(id)}`);
  },

  summary() {
    return apiClient.request<BranchSummary>('/branches/summary');
  },

  export(params: BranchListParams = {}) {
    return apiClient.requestBlob(`/branches/export${toQueryString(params)}`);
  },

  create(payload: SaveBranchPayload) {
    return apiClient.request<BranchResponse>('/branches', {
      body: payload,
      method: 'POST',
    });
  },

  update(id: string, payload: UpdateBranchPayload) {
    return apiClient.request<BranchResponse>(`/branches/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  updateStatus(id: string, status: ApiBranchStatus) {
    return apiClient.request<BranchResponse>(`/branches/${encodeURIComponent(id)}/status`, {
      body: { status },
      method: 'PATCH',
    });
  },

  delete(id: string) {
    return apiClient.request<{ success: true }>(`/branches/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
