export type ConsentContextType = 'PATIENT' | 'PROCEDURE' | 'ADMISSION';
export type ConsentTemplateStatus = 'ACTIVE' | 'INACTIVE';

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
};

export type ConsentRequestMetadata = { ipAddress?: string; userAgent?: string };
export type ConsentRequirementQuery = {
  branch_id: string;
  patient_id: string;
  context_type: ConsentContextType;
  context_id: string;
};
