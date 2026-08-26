import { apiClient } from './client';

export type AdvanceRequirementStatus = 'NOT_REQUIRED' | 'REQUIRED';
export type AdvancePaymentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type AdvanceSourceType = 'ADMISSION_REQUEST' | 'PROCEDURE_BOOKING';

export interface AdvancePayment {
  id: string;
  patient_id: string;
  source_type: AdvanceSourceType;
  source_id: string;
  branch_id: string;
  required_amount: number;
  paid_amount: number;
  balance_amount: number;
  requirement_status: AdvanceRequirementStatus;
  payment_status: AdvancePaymentStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncAdvancePaymentPayload {
  patient_id: string;
  source_type: AdvanceSourceType;
  source_id: string;
  branch_id: string;
  required_amount: number;
  requirement_status: AdvanceRequirementStatus;
}

const queryString = (params: Record<string, unknown>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

export const advancePaymentApi = {
  get(sourceType: AdvanceSourceType, sourceId: string) {
    return apiClient.request<AdvancePayment>(
      `/advance-payment${queryString({ source_type: sourceType, source_id: sourceId })}`
    );
  },
  sync(payload: SyncAdvancePaymentPayload) {
    return apiClient.request<AdvancePayment>('/advance-payment/sync', {
      method: 'POST',
      body: payload,
    });
  },
};
