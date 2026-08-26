import { apiClient } from './client';
import { diagnosticQuery, type DiagnosticListParams, type DiagnosticOrder, type DiagnosticPage, type DiagnosticSourceType, type DiagnosticSummary, type ImagingStatus } from './laboratory';

export type ImagingReportPayload = { findings: string; impression: string; recommendations?: string | null };
export type ImagingReport = ImagingReportPayload & {
  id: string; order_id: string; source_type: DiagnosticSourceType; encounter_id: string | null;
  admission_id: string | null; procedure_id: string | null;
  patient_id: string; visit_id: string; entered_by: string; entered_at: string;
  verified_by: string | null; verified_at: string | null; created_at: string; updated_at: string;
};

export const imagingApi = {
  list(params: DiagnosticListParams = {}) { return apiClient.request<DiagnosticPage>(`/imaging/orders${diagnosticQuery(params)}`); },
  summary(branchId?: string) { return apiClient.request<DiagnosticSummary>(`/imaging/summary${diagnosticQuery({ branch_id: branchId })}`); },
  get(id: string) { return apiClient.request<DiagnosticOrder>(`/imaging/orders/${encodeURIComponent(id)}`); },
  updateStatus(id: string, status: Exclude<ImagingStatus, 'SUBMITTED' | 'REPORT_ENTERED'>) {
    return apiClient.request<DiagnosticOrder>(`/imaging/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } });
  },
  getReport(id: string) { return apiClient.request<ImagingReport>(`/imaging/orders/${encodeURIComponent(id)}/report`); },
  enterReport(id: string, payload: ImagingReportPayload) {
    return apiClient.request<ImagingReport>(`/imaging/orders/${encodeURIComponent(id)}/report`, { method: 'POST', body: payload });
  },
  updateReport(id: string, payload: ImagingReportPayload) {
    return apiClient.request<ImagingReport>(`/imaging/orders/${encodeURIComponent(id)}/report`, { method: 'PATCH', body: payload });
  },
};
