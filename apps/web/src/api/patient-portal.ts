import { apiClient } from './client';

export const patientPortalApi = {
  provisionAccount(input: { patient_id: string; username: string; email: string; password: string }) {
    return apiClient.request<{ id: string; username: string; email: string; status: string }>('/patient-portal/accounts', { method: 'POST', body: input });
  },
};
