export type OpdPrescriptionStatus = 'DRAFT' | 'SUBMITTED' | 'DISPENSED' | 'CANCELLED';

export type OpdPrescriptionItem = {
  id: string;
  medicine_name: string;
  strength: string | null;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: number | null;
  intake_time?: string | null;
  instructions?: string | null;
};

export type OpdPrescription = {
  id: string;
  source_type: ClinicalContextSourceType;
  source_id: string;
  encounter_id: string | null;
  admission_id: string | null;
  procedure_id: string | null;
  visit_id: string | null;
  consultation_id: string | null;
  branch_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  status: OpdPrescriptionStatus;
  items: OpdPrescriptionItem[];
  follow_up_date: Date | null;
  doctor_instructions: string | null;
  patient_instructions: string | null;
  submitted_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type SaveOpdPrescriptionItemDTO = Omit<OpdPrescriptionItem, 'id'>;

export type SaveOpdPrescriptionDTO = {
  items: SaveOpdPrescriptionItemDTO[];
  follow_up_date?: string | null;
  doctor_instructions?: string | null;
  patient_instructions?: string | null;
};

export type ListPrescriptionsParams = {
  status?: OpdPrescriptionStatus;
  limit?: number;
  skip?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};
import type { ClinicalContextSourceType } from './clinical-context.types.js';
