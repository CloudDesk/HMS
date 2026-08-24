import { apiClient } from './client';

export type ConsentContextType = 'PATIENT' | 'PROCEDURE' | 'ADMISSION';
export type ConsentTemplateStatus = 'ACTIVE' | 'INACTIVE';
export type ConsentTemplate = { id: string; branch_id: string; code: string; name: string; category: string;
  context_type: ConsentContextType; mandatory: boolean; version: number; status: ConsentTemplateStatus;
  created_at: string; updated_at: string };
export type SaveConsentTemplate = Omit<ConsentTemplate, 'id' | 'version' | 'created_at' | 'updated_at'>;

const query = (params: { branch_id: string; context_type?: ConsentContextType; status?: ConsentTemplateStatus }) => {
  const values = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) values.set(key, value); });
  return `?${values.toString()}`;
};
export const consentsApi = {
  list: (params: { branch_id: string; context_type?: ConsentContextType; status?: ConsentTemplateStatus }) =>
    apiClient.request<ConsentTemplate[]>(`/consent-templates${query(params)}`),
  create: (payload: SaveConsentTemplate) => apiClient.request<ConsentTemplate>('/consent-templates', { method: 'POST', body: payload }),
  update: (id: string, payload: SaveConsentTemplate) => apiClient.request<ConsentTemplate>(`/consent-templates/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
};
