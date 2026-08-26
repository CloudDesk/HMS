import { consentsApi, type ConsentContextType, type ConsentTemplateStatus, type SaveConsentTemplate } from '../api/consents';
export const consentsService = {
  list: (params: { branch_id: string; context_type?: ConsentContextType; status?: ConsentTemplateStatus }) => consentsApi.list(params),
  create: (payload: SaveConsentTemplate) => consentsApi.create(payload),
  update: (id: string, payload: SaveConsentTemplate) => consentsApi.update(id, payload),
};
