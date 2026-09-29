import { apiClient } from './client';

export type ConsentContextType = 'PATIENT' | 'PROCEDURE' | 'ADMISSION';
export type ConsentTemplateStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export type ConsentFieldType =
  | 'TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'DATE_TIME'
  | 'DROPDOWN'
  | 'RADIO'
  | 'CHECKBOX'
  | 'CHECKBOX_GROUP'
  | 'YES_NO'
  | 'EMAIL'
  | 'PHONE'
  | 'ADDRESS'
  | 'INSTRUCTION'
  | 'PATIENT_INFO'
  | 'DOCTOR_INFO'
  | 'PROCEDURE_INFO'
  | 'SIGNATURE';

export type SystemFieldSource =
  | 'patient_name'
  | 'patient_number'
  | 'date_of_birth'
  | 'gender'
  | 'phone'
  | 'address'
  | 'doctor_name'
  | 'department_name'
  | 'branch_name'
  | 'encounter_number'
  | 'encounter_date'
  | 'procedure_name'
  | 'admission_number';

export type ConsentVisibilityCondition = {
  fieldKey: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS';
  value: string;
};

export type ConsentFormField = {
  id: string;
  fieldKey: string;
  label: string;
  type: ConsentFieldType;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  readOnly?: boolean;
  defaultValue?: string | boolean | number | string[];
  options?: string[];
  systemFieldKey?: SystemFieldSource;
  visibilityRule?: ConsentVisibilityCondition;
  displayOrder: number;
};

export type ConsentFormSection = {
  id: string;
  title: string;
  description?: string;
  displayOrder: number;
  required?: boolean;
  fields: ConsentFormField[];
};

export type ConsentDeclarationConfig = {
  text: string;
  required: boolean;
};

export type ConsentSignaturesConfig = {
  requiredSignatures: Array<'PATIENT' | 'GUARDIAN' | 'DOCTOR' | 'WITNESS'>;
};

export type ConsentFormDefinition = {
  sections: ConsentFormSection[];
  declaration?: ConsentDeclarationConfig;
  signatures?: ConsentSignaturesConfig;
};

export type ConsentTemplate = {
  id: string;
  branch_id: string;
  code: string;
  name: string;
  category: string;
  context_type: ConsentContextType;
  mandatory: boolean;
  version: number;
  status: ConsentTemplateStatus;
  form_definition?: ConsentFormDefinition | null;
  published_at?: string | null;
  published_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveConsentTemplate = {
  branch_id: string;
  code: string;
  name: string;
  category: string;
  context_type: ConsentContextType;
  mandatory: boolean;
  status?: ConsentTemplateStatus;
  form_definition?: ConsentFormDefinition | null;
};

export type ConsentDigitalSignature = {
  signer_type: 'PATIENT' | 'GUARDIAN' | 'DOCTOR' | 'WITNESS';
  signer_name: string;
  signature_data: string;
  signed_at?: string;
};

export type SubmitStructuredConsentPayload = {
  branch_id: string;
  template_id: string;
  context_type: ConsentContextType;
  context_id: string;
  visit_id?: string | null;
  procedure_id?: string | null;
  admission_id?: string | null;
  form_responses: Record<string, unknown>;
  signatures: ConsentDigitalSignature[];
  declaration_accepted?: boolean;
  notes?: string | null;
};

export type AttachConsentTemplatePayload = {
  template_id: string;
  title?: string;
  context_type?: ConsentContextType;
  context_id?: string | null;
  description?: string | null;
  consent_status?: 'PENDING' | 'ATTACHED' | 'SIGNED';
  valid_until?: string | null;
  branch_id?: string;
  form_responses?: Record<string, unknown>;
  visit_id?: string | null;
  procedure_id?: string | null;
  admission_id?: string | null;
};

const query = (params: { branch_id: string; context_type?: ConsentContextType; status?: ConsentTemplateStatus }) => {
  const values = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) values.set(key, value); });
  return `?${values.toString()}`;
};

export const consentsApi = {
  list: (params: { branch_id: string; context_type?: ConsentContextType; status?: ConsentTemplateStatus }) =>
    apiClient.request<ConsentTemplate[]>(`/consent-templates${query(params)}`),
  getById: (id: string) =>
    apiClient.request<ConsentTemplate>(`/consent-templates/${encodeURIComponent(id)}`),
  create: (payload: SaveConsentTemplate) =>
    apiClient.request<ConsentTemplate>('/consent-templates', { method: 'POST', body: payload }),
  update: (id: string, payload: SaveConsentTemplate) =>
    apiClient.request<ConsentTemplate>(`/consent-templates/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
  saveFormDefinition: (id: string, branchId: string, formDefinition: ConsentFormDefinition) =>
    apiClient.request<ConsentTemplate>(`/consent-templates/${encodeURIComponent(id)}/form-definition`, {
      method: 'POST',
      body: { branch_id: branchId, form_definition: formDefinition },
    }),
  publish: (id: string, branchId: string) =>
    apiClient.request<ConsentTemplate>(`/consent-templates/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: { branch_id: branchId },
    }),
  createNextVersion: (id: string, branchId: string) =>
    apiClient.request<ConsentTemplate>(`/consent-templates/${encodeURIComponent(id)}/versions`, {
      method: 'POST',
      body: { branch_id: branchId },
    }),
  completeStructuredConsent: (patientId: string, payload: SubmitStructuredConsentPayload) =>
    apiClient.request<any>(`/patients/${encodeURIComponent(patientId)}/consents/complete`, {
      method: 'POST',
      body: payload,
    }),
  attachConsentTemplate: (patientId: string, payload: AttachConsentTemplatePayload) =>
    apiClient.request<any>(`/patients/${encodeURIComponent(patientId)}/consents/attach-template`, {
      method: 'POST',
      body: payload,
    }),
};
