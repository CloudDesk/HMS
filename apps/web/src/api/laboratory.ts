import { apiClient } from './client';

export type LaboratoryStatus = 'SUBMITTED' | 'RECEIVED' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'RESULT_ENTERED' | 'VERIFIED' | 'COMPLETED';
export type DiagnosticPriority = 'ROUTINE' | 'URGENT' | 'STAT';
export type DiagnosticSourceType = 'OPD' | 'EMERGENCY' | 'IP_ADMISSION' | 'PROCEDURE' | 'SURGERY';
export type DiagnosticOrder = {
  id: string; originating_order_id: string; source_type: DiagnosticSourceType; encounter_id: string | null;
  admission_id: string | null; procedure_id: string | null;
  visit_id: string; consultation_id: string; patient_id: string; patient_number: string; patient_name: string;
  doctor_id: string; doctor_name: string; branch_id: string; order_type: 'LABORATORY' | 'IMAGING'; status: LaboratoryStatus | ImagingStatus;
  priority: DiagnosticPriority; destination: string | null; specimen_type: string | null;
  items: Array<{ id: string; service_id: string; service_name: string; investigation_name: string; category: string }>;
  clinical_notes: string | null; instructions: string | null; submitted_at: string | null; created_at: string; updated_at: string;
};
export type ImagingStatus = 'SUBMITTED' | 'RECEIVED' | 'IN_PROGRESS' | 'REPORT_ENTERED' | 'VERIFIED' | 'COMPLETED';
export type DiagnosticListParams = Partial<{
  search: string; status: string; priority: DiagnosticPriority; date_from: string; date_to: string;
  patient_id: string; doctor_id: string; branch_id: string; page: number; limit: number;
}>;
export type LaboratoryResultPayload = {
  result_items: Array<{ service_id: string; service_name: string; value: string; unit?: string | null; reference_range?: string | null; comments?: string | null }>;
  remarks?: string | null;
};
export type LaboratoryResult = LaboratoryResultPayload & {
  id: string; order_id: string; source_type: DiagnosticSourceType; encounter_id: string | null;
  admission_id: string | null; procedure_id: string | null;
  patient_id: string; visit_id: string; entered_by: string; entered_at: string;
  verified_by: string | null; verified_at: string | null; created_at: string; updated_at: string;
};
export type DiagnosticPage = { data: DiagnosticOrder[]; meta: { page: number; limit: number; total: number; totalPages: number } };
export type DiagnosticSummary = { total: number; by_status: Record<string, number> };

export const diagnosticQuery = (params: Record<string, unknown>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) query.set(key, String(value));
  });
  return query.size ? `?${query.toString()}` : '';
};

export const laboratoryApi = {
  list(params: DiagnosticListParams = {}) { return apiClient.request<DiagnosticPage>(`/laboratory/orders${diagnosticQuery(params)}`); },
  summary(branchId?: string) { return apiClient.request<DiagnosticSummary>(`/laboratory/summary${diagnosticQuery({ branch_id: branchId })}`); },
  get(id: string) { return apiClient.request<DiagnosticOrder>(`/laboratory/orders/${encodeURIComponent(id)}`); },
  updateStatus(id: string, status: Exclude<LaboratoryStatus, 'SUBMITTED' | 'RESULT_ENTERED'>) {
    return apiClient.request<DiagnosticOrder>(`/laboratory/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } });
  },
  getResult(id: string) { return apiClient.request<LaboratoryResult>(`/laboratory/orders/${encodeURIComponent(id)}/results`); },
  enterResult(id: string, payload: LaboratoryResultPayload) {
    return apiClient.request<LaboratoryResult>(`/laboratory/orders/${encodeURIComponent(id)}/results`, { method: 'POST', body: payload });
  },
  updateResult(id: string, payload: LaboratoryResultPayload) {
    return apiClient.request<LaboratoryResult>(`/laboratory/orders/${encodeURIComponent(id)}/results`, { method: 'PATCH', body: payload });
  },
};
