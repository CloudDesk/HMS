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
  form_definition: ConsentFormDefinition | null;
  published_at: Date | null;
  published_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ConsentTemplateListQuery = {
  branch_id: string;
  context_type?: ConsentContextType;
  status?: ConsentTemplateStatus;
};

export type SaveConsentTemplateDTO = {
  branch_id: string;
  code: string;
  name: string;
  category: string;
  context_type: ConsentContextType;
  mandatory: boolean;
  status?: ConsentTemplateStatus;
  form_definition?: ConsentFormDefinition | null;
};

export type ConsentRequestMetadata = { ipAddress?: string; userAgent?: string };
export type ConsentRequirementQuery = {
  branch_id: string;
  patient_id: string;
  context_type: ConsentContextType;
  context_id: string;
};
