export type AdmissionType = 'MEDICAL' | 'SURGICAL' | 'MATERNITY' | 'PAEDIATRIC' | 'OBSERVATION' | 'OTHER';
export type AdmissionStatus = 'DRAFT' | 'ADMITTED' | 'CANCELLED';
export type AdmissionSourceType = 'DIRECT' | 'OPD_VISIT' | 'EMERGENCY_ENCOUNTER' | 'PROCEDURE_BOOKING';
export type AdmissionRequestStatus = 'PENDING_VALIDATION' | 'READY_FOR_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED';
export type AdmissionPriority = 'ROUTINE' | 'URGENT' | 'EMERGENCY';

export type CreateInpatientAdmissionDTO = {
  patient_id: string;
  branch_id: string;
  ward_id: string;
  bed_id: string;
  hold_id?: string | null;
  admitting_doctor_id: string;
  department_id: string;
  admission_date: string;
  admission_type: AdmissionType;
  reason: string;
  notes?: string | null;
};

export type InpatientAdmission = {
  id: string;
  admission_number: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  branch_id: string;
  ward_id: string;
  ward_name: string;
  bed_id: string;
  bed_number: string;
  admitting_doctor_id: string;
  admitting_doctor_name: string;
  department_id: string;
  department_name: string;
  admission_date: Date;
  admission_type: AdmissionType;
  reason: string;
  notes: string | null;
  status: AdmissionStatus;
  request_id: string | null;
  source_type: AdmissionSourceType;
  source_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type AdmissionPrerequisiteSnapshot = {
  consent_required: boolean;
  consent_satisfied: boolean;
  consent_document_id: string | null;
  consent_kind: string | null;
  consent_signed_at: Date | null;
  deposit_required: boolean;
  deposit_satisfied: boolean;
  deposit_required_amount: number;
  deposit_paid_amount: number;
  deposit_invoice_id: string | null;
  deposit_payment_ids: string[];
  verified_at: Date;
};

export type AdmissionRequest = {
  id: string;
  request_number: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  branch_id: string;
  department_id: string;
  department_name: string;
  recommending_doctor_id: string;
  recommending_doctor_name: string;
  source_type: AdmissionSourceType;
  source_id: string | null;
  source_reference: string | null;
  admission_type: AdmissionType;
  priority: AdmissionPriority;
  reason: string;
  notes: string | null;
  status: AdmissionRequestStatus;
  hold_id: string | null;
  ward_id: string | null;
  bed_id: string | null;
  consent_document_id: string | null;
  deposit_invoice_id: string | null;
  prerequisite_snapshot: AdmissionPrerequisiteSnapshot | null;
  admission_id: string | null;
  cancellation_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CreateAdmissionRequestDTO = {
  patient_id: string;
  branch_id: string;
  department_id: string;
  recommending_doctor_id: string;
  source_type: 'DIRECT' | 'OPD_VISIT' | 'EMERGENCY_ENCOUNTER';
  source_id?: string | null;
  admission_type: AdmissionType;
  priority: AdmissionPriority;
  reason: string;
  notes?: string | null;
};

export type ValidateAdmissionRequestDTO = {
  ward_id: string;
  bed_id: string;
  hold_id?: string | null;
  consent_document_id?: string | null;
  deposit_invoice_id?: string | null;
};

export type ConfirmAdmissionRequestDTO = ValidateAdmissionRequestDTO & { admission_date: string };
export type CancelAdmissionRequestDTO = { reason: string };

export interface AdmissionRequestListQuery {
  branch_id: string;
  status?: string;
  source_type?: string;
  patient_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AdmissionRequestStats {
  pendingValidation: number;
  readyForConfirmation: number;
  confirmed: number;
  cancelled: number;
}

export type InpatientAdmissionListQuery = { branch_id: string; status?: AdmissionStatus; page?: number; limit?: number };
export type AdmissionRequestMetadata = { ipAddress?: string; userAgent?: string };
