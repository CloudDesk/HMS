import { apiClient } from './client';

export type ApiMedicineStatus = 'ACTIVE' | 'INACTIVE';

export type MedicineResponse = {
  id: string;
  code: string;
  name: string;
  generic_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  unit: string | null;
  description: string | null;
  status: ApiMedicineStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MedicineListResponse = {
  data: MedicineResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type MedicineListParams = Partial<{
  search: string;
  status: ApiMedicineStatus;
  dosage_form: string;
  page: number;
  limit: number;
  sortBy: 'name' | 'code' | 'generic_name' | 'status' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}>;

export type SaveMedicinePayload = {
  code: string;
  name: string;
  generic_name?: string | null;
  strength?: string | null;
  dosage_form?: string | null;
  unit?: string | null;
  description?: string | null;
  status?: ApiMedicineStatus;
};

export type MedicineSummary = {
  total: number;
  active: number;
  inactive: number;
  dosageForms: number;
  addedThisMonth: number;
};

const queryString = (params: MedicineListParams) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) query.set(key, String(value));
  });
  const value = query.toString();
  return value ? `?${value}` : '';
};

export const medicinesApi = {
  list(params: MedicineListParams = {}) {
    return apiClient.request<MedicineListResponse>(`/medicines${queryString(params)}`);
  },
  summary() {
    return apiClient.request<MedicineSummary>('/medicines/summary');
  },
  getById(id: string) {
    return apiClient.request<MedicineResponse>(`/medicines/${encodeURIComponent(id)}`);
  },
  create(payload: SaveMedicinePayload) {
    return apiClient.request<MedicineResponse>('/medicines', { method: 'POST', body: payload });
  },
  update(id: string, payload: Partial<SaveMedicinePayload>) {
    return apiClient.request<MedicineResponse>(`/medicines/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    });
  },
  updateStatus(id: string, status: ApiMedicineStatus) {
    return apiClient.request<MedicineResponse>(`/medicines/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { status },
    });
  },
  delete(id: string) {
    return apiClient.request<{ success: true }>(`/medicines/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  export(params: MedicineListParams = {}) {
    return apiClient.requestBlob(`/medicines/export${queryString(params)}`);
  },
};
