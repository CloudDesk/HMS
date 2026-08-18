import { apiClient } from './client';

export type DispensingStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'REVERSED';
export type DispensingItem = { id: string; prescription_item_id: string; medicine_id: string; batch_id: string; medicine_name: string; batch_number: string; requested_quantity: number | null; confirmed_quantity: number; available_quantity: number; unit_price: number; line_total: number; pharmacist_instructions: string | null };
export type Dispensing = { id: string; prescription_id: string; patient_id: string; patient_number: string; patient_name: string; doctor_name: string; visit_id: string; branch_id: string; status: DispensingStatus; version: number; items: DispensingItem[]; invoice_id: string | null; submitted_at: string | null; confirmed_at: string | null; cancelled_at: string | null; reversed_at: string | null; reversal_reason: string | null; created_at: string; updated_at: string };
export type DispensingPage = { data: Dispensing[]; meta: { page: number; limit: number; total: number; totalPages: number } };
export type SaveDispensingPayload = { version: number; items: Array<{ prescription_item_id: string; medicine_id: string; batch_id: string; confirmed_quantity: number; pharmacist_instructions?: string | null }> };

const queryString = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
  return `?${query.toString()}`;
};

export const pharmacyDispensingApi = {
  list: (params: { branch_id: string; search?: string; status?: string; page?: number; limit?: number }) => apiClient.request<DispensingPage>(`/pharmacy/dispensings${queryString(params)}`),
  get: (prescriptionId: string) => apiClient.request<Dispensing>(`/pharmacy/dispensings/${prescriptionId}`),
  save: (prescriptionId: string, body: SaveDispensingPayload) => apiClient.request<Dispensing>(`/pharmacy/dispensings/${prescriptionId}`, { method: 'PUT', body }),
  confirm: (prescriptionId: string, body: { version: number; idempotency_key: string }) => apiClient.request<Dispensing>(`/pharmacy/dispensings/${prescriptionId}/confirm`, { method: 'POST', body }),
  cancel: (prescriptionId: string, body: { version: number; reason: string }) => apiClient.request<Dispensing>(`/pharmacy/dispensings/${prescriptionId}/cancel`, { method: 'POST', body }),
  reverse: (prescriptionId: string, body: { version: number; reason: string; idempotency_key: string }) => apiClient.request<Dispensing>(`/pharmacy/dispensings/${prescriptionId}/reverse`, { method: 'POST', body }),
};
