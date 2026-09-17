import { apiClient } from './client';

export type ApiDepartmentStatus = 'ACTIVE' | 'INACTIVE';

export const departmentModuleOptions = [
  { key: 'patients', label: 'Patients' },
  { key: 'doctors', label: 'Doctors' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'opd', label: 'OPD' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'admissions', label: 'Admissions' },
  { key: 'surgery', label: 'Surgery' },
  { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'laboratory', label: 'Laboratory' },
  { key: 'imaging', label: 'Imaging' },
  { key: 'billing', label: 'Billing' },
  { key: 'reports', label: 'Reports' },
  { key: 'administration', label: 'Administration' },
] as const;

export type DepartmentModuleKey = (typeof departmentModuleOptions)[number]['key'];

export type DepartmentResponse = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  branch_ids: string[];
  status: ApiDepartmentStatus;
  isClinical: boolean;
  hiddenModules: DepartmentModuleKey[];
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
  hiddenModules?: DepartmentModuleKey[];
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
