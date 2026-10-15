import {
  consentsApi,
  type ConsentContextType,
  type ConsentFormDefinition,
  type ConsentTemplateStatus,
  type SaveConsentTemplate,
  type SubmitStructuredConsentPayload,
  type AttachConsentTemplatePayload,
} from '../api/consents';

export const consentsService = {
  list: (params: { branch_id: string; context_type?: ConsentContextType; status?: ConsentTemplateStatus }) =>
    consentsApi.list(params),
  getById: (id: string) => consentsApi.getById(id),
  create: (payload: SaveConsentTemplate) => consentsApi.create(payload),
  update: (id: string, payload: SaveConsentTemplate) => consentsApi.update(id, payload),
  saveFormDefinition: (id: string, branchId: string, formDefinition: ConsentFormDefinition) =>
    consentsApi.saveFormDefinition(id, branchId, formDefinition),
  publish: (id: string, branchId: string) => consentsApi.publish(id, branchId),
  createNextVersion: (id: string, branchId: string) => consentsApi.createNextVersion(id, branchId),
  completeStructuredConsent: (patientId: string, payload: SubmitStructuredConsentPayload) =>
    consentsApi.completeStructuredConsent(patientId, payload),
  attachConsentTemplate: (patientId: string, payload: AttachConsentTemplatePayload) =>
    consentsApi.attachConsentTemplate(patientId, payload),
};
