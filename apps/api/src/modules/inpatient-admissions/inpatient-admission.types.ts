export type AdmissionType = 'MEDICAL' | 'SURGICAL' | 'MATERNITY' | 'PAEDIATRIC' | 'OBSERVATION' | 'OTHER';
export type AdmissionStatus = 'DRAFT' | 'ADMITTED' | 'CANCELLED';

export type CreateInpatientAdmissionDTO = {
  patient_id: string;
  branch_id: string;
  ward_id: string;
  bed_id: string;
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
  created_at: Date;
  updated_at: Date;
};

export type InpatientAdmissionListQuery = { branch_id: string; status?: AdmissionStatus; page?: number; limit?: number };
export type AdmissionRequestMetadata = { ipAddress?: string; userAgent?: string };
