import { apiClient } from './client';

export type WardStatus = 'ACTIVE' | 'INACTIVE';
export type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED' | 'UNDER_MAINTENANCE' | 'INACTIVE';
export type Ward = { id: string; branch_id: string; name: string; ward_type: string; floor: string; description: string | null; status: WardStatus; created_at: string; updated_at: string };
export type Bed = { id: string; branch_id: string; ward_id: string; ward_name: string; bed_number: string; bed_category: string; room_number: string | null; status: BedStatus; created_at: string; updated_at: string };
type PageMeta = { total: number; page: number; limit: number; totalPages: number };
export type WardPage = { data: Ward[]; meta: PageMeta };
export type BedPage = { data: Bed[]; meta: PageMeta };
export type BedSummary = { total: number; available: number; occupied: number; reserved: number; blocked: number; under_maintenance: number; inactive: number };
export type WardPayload = { branch_id: string; name: string; ward_type: string; floor: string; description?: string | null };
export type BedPayload = { branch_id: string; ward_id: string; bed_number: string; bed_category: string; room_number?: string | null };

const query = (params: Record<string, string | number | undefined>) => { const value = new URLSearchParams(); Object.entries(params).forEach(([key, item]) => { if (item !== undefined && item !== '') value.set(key, String(item)); }); return `?${value.toString()}`; };
export const admissionsConfigurationApi = {
  wards: (params: { branch_id: string; search?: string; status?: WardStatus; page?: number; limit?: number }) => apiClient.request<WardPage>(`/admissions/wards${query(params)}`),
  createWard: (body: WardPayload) => apiClient.request<Ward>('/admissions/wards', { method: 'POST', body }),
  updateWardStatus: (id: string, body: { branch_id: string; status: WardStatus }) => apiClient.request<Ward>(`/admissions/wards/${id}/status`, { method: 'PATCH', body }),
  beds: (params: { branch_id: string; ward_id?: string; search?: string; status?: BedStatus; page?: number; limit?: number }) => apiClient.request<BedPage>(`/admissions/beds${query(params)}`),
  summary: (branchId: string) => apiClient.request<BedSummary>(`/admissions/beds/summary${query({ branch_id: branchId })}`),
  createBed: (body: BedPayload) => apiClient.request<Bed>('/admissions/beds', { method: 'POST', body }),
  updateBedStatus: (id: string, body: { branch_id: string; status: BedStatus }) => apiClient.request<Bed>(`/admissions/beds/${id}/status`, { method: 'PATCH', body }),
};
