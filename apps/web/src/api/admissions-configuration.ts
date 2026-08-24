import { apiClient } from './client';

export type WardStatus = 'ACTIVE' | 'INACTIVE';
export type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED' | 'UNDER_MAINTENANCE' | 'INACTIVE';
export type Ward = {
  id: string;
  branch_id: string;
  name: string;
  ward_type: string;
  floor: string;
  description: string | null;
  status: WardStatus;
  created_at: string;
  updated_at: string;
};

export type Bed = {
  id: string;
  branch_id: string;
  ward_id: string;
  ward_name: string;
  bed_number: string;
  bed_category: string;
  room_number: string | null;
  status: BedStatus;
  block_reason_code: string | null;
  current_hold_id: string | null;
  current_admission_id: string | null;
  hold_number: string | null;
  hold_expires_at: string | null;
  admission_number: string | null;
  patient_id: string | null;
  patient_number: string | null;
  patient_name: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type AdmissionPolicy = {
  id: string;
  branch_id: string;
  bed_hold_duration_minutes: number;
  admission_consent_required: boolean;
  admission_advance_deposit_required: boolean;
  admission_minimum_deposit_amount: number;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  created_at: string;
  updated_at: string;
};

export type AdmissionPolicyPayload = Omit<
  AdmissionPolicy,
  'id' | 'status' | 'version' | 'created_at' | 'updated_at'
>;

export type BedHold = {
  id: string;
  hold_number: string;
  idempotency_key: string;
  patient_id: string;
  branch_id: string;
  ward_id: string;
  bed_id: string;
  admission_id: string | null;
  bed_number: string;
  ward_name: string;
  room_number: string | null;
  status: 'ACTIVE' | 'CONSUMED' | 'RELEASED' | 'EXPIRED' | 'CANCELLED';
  held_at: string;
  expires_at: string;
  reason: string;
  terminal_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type BedTransfer = {
  id: string;
  admission_id: string;
  patient_id: string;
  source_branch_id: string;
  source_ward_id: string;
  source_bed_id: string;
  destination_branch_id: string;
  destination_ward_id: string;
  destination_bed_id: string;
  source_bed_number: string;
  destination_bed_number: string;
  reason: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  requested_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};
type PageMeta = { total: number; page: number; limit: number; totalPages: number };
export type WardPage = { data: Ward[]; meta: PageMeta };
export type BedPage = { data: Bed[]; meta: PageMeta };
export type BedSummary = { total: number; available: number; occupied: number; reserved: number; blocked: number; under_maintenance: number; inactive: number };
export type WardPayload = { branch_id: string; name: string; ward_type: string; room_type?: string | null; floor: string; capacity?: number | null; description?: string | null };
export type BedPayload = { branch_id: string; ward_id: string; bed_number: string; bed_category: string; bed_type?: string; charge_category?: string; gender_restriction?: BedGenderRestriction; room_number?: string | null };
export type UpdateBedPayload = Omit<Partial<BedPayload>, 'branch_id' | 'ward_id'> & { branch_id: string };

const query = (params: Record<string, string | number | undefined>) => { const value = new URLSearchParams(); Object.entries(params).forEach(([key, item]) => { if (item !== undefined && item !== '') value.set(key, String(item)); }); return `?${value.toString()}`; };
export const admissionsConfigurationApi = {
  wards: (params: { branch_id: string; search?: string; status?: WardStatus; page?: number; limit?: number }) => apiClient.request<WardPage>(`/admissions/wards${query(params)}`),
  createWard: (body: WardPayload) => apiClient.request<Ward>('/admissions/wards', { method: 'POST', body }),
  updateWard: (id: string, body: WardPayload) => apiClient.request<Ward>(`/admissions/wards/${id}`, { method: 'PATCH', body }),
  updateWardStatus: (id: string, body: { branch_id: string; status: WardStatus }) => apiClient.request<Ward>(`/admissions/wards/${id}/status`, { method: 'PATCH', body }),
  beds: (params: { branch_id: string; ward_id?: string; search?: string; status?: BedStatus; page?: number; limit?: number }) => apiClient.request<BedPage>(`/admissions/beds${query(params)}`),
  bed: (id: string, branchId: string) => apiClient.request<Bed>(`/admissions/beds/${id}${query({ branch_id: branchId })}`),
  summary: (branchId: string) => apiClient.request<BedSummary>(`/admissions/beds/summary${query({ branch_id: branchId })}`),
  createBed: (body: BedPayload) => apiClient.request<Bed>('/admissions/beds', { method: 'POST', body }),
  updateBed: (id: string, body: UpdateBedPayload) =>
  apiClient.request<Bed>(`/admissions/beds/${id}`, {
    method: 'PATCH',
    body,
  }),

updateBedStatus: (
  id: string,
  body: {
    branch_id: string;
    status: Exclude<BedStatus, 'OCCUPIED' | 'RESERVED'>;
    reason?: string | null;
  },
) =>
  apiClient.request<Bed>(`/admissions/beds/${id}/status`, {
    method: 'PATCH',
    body,
  }),

policy: (branchId: string) =>
  apiClient.request<AdmissionPolicy>(
    `/admissions/policy${query({ branch_id: branchId })}`,
  ),

savePolicy: (body: AdmissionPolicyPayload) =>
  apiClient.request<AdmissionPolicy>('/admissions/policy', {
    method: 'PUT',
    body,
  }),

createHold: (
  bedId: string,
  body: {
    branch_id: string;
    patient_id: string;
    admission_id?: string | null;
    reason: string;
    idempotency_key: string;
  },
) =>
  apiClient.request<BedHold>(`/admissions/beds/${bedId}/holds`, {
    method: 'POST',
    body,
  }),

releaseHold: (
  holdId: string,
  body: { branch_id: string; reason: string },
) =>
  apiClient.request<BedHold>(
    `/admissions/bed-holds/${holdId}/release`,
    {
      method: 'POST',
      body,
    },
  ),

cancelHold: (
  holdId: string,
  body: { branch_id: string; reason: string },
) =>
  apiClient.request<BedHold>(
    `/admissions/bed-holds/${holdId}/cancel`,
    {
      method: 'POST',
      body,
    },
  ),

createTransfer: (
  admissionId: string,
  body: {
    branch_id: string;
    destination_branch_id: string;
    destination_ward_id: string;
    destination_bed_id: string;
    reason: string;
  },
  crossBranch = false,
) =>
  apiClient.request<BedTransfer>(
    `/admissions/inpatients/${admissionId}/${
      crossBranch ? 'cross-branch-transfers' : 'transfers'
    }`,
    {
      method: 'POST',
      body,
    },
  ),

completeTransfer: (
  transferId: string,
  body: { branch_id: string },
  crossBranch = false,
) =>
  apiClient.request<BedTransfer>(
    `/admissions/bed-transfers/${transferId}/${
      crossBranch ? 'complete-cross-branch' : 'complete'
    }`,
    {
      method: 'POST',
      body,
    },
  ),

cancelTransfer: (
  transferId: string,
  body: { branch_id: string; reason: string },
) =>
  apiClient.request<BedTransfer>(
    `/admissions/bed-transfers/${transferId}/cancel`,
    {
      method: 'POST',
      body,
    },
  ),
};
