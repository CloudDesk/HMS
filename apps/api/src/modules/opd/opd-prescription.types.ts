export type OpdPrescriptionStatus = 'DRAFT' | 'SUBMITTED';

export type OpdPrescriptionItem = {
  id: string;
  medicine_name: string;
  strength: string | null;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: number | null;
  instructions: string | null;
};

export type OpdPrescription = {
  id: string;
  visit_id: string;
  consultation_id: string;
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
