export type ClinicalOrderType = 'LABORATORY' | 'IMAGING';
export type ClinicalOrderStatus = 'DRAFT' | 'SUBMITTED';
export type ClinicalOrderPriority = 'ROUTINE' | 'URGENT' | 'STAT';

export type ClinicalOrderItem = {
  id: string;
  investigation_name: string;
  category: string;
};

export type OpdClinicalOrder = {
  id: string;
  visit_id: string;
  consultation_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  order_type: ClinicalOrderType;
  status: ClinicalOrderStatus;
  priority: ClinicalOrderPriority;
  destination: string | null;
  specimen_type: string | null;
  items: ClinicalOrderItem[];
  clinical_notes: string | null;
  instructions: string | null;
  submitted_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type SaveClinicalOrderItemDTO = Omit<ClinicalOrderItem, 'id'>;

export type SaveOpdClinicalOrderDTO = {
  priority: ClinicalOrderPriority;
  destination?: string | null;
  specimen_type?: string | null;
  items: SaveClinicalOrderItemDTO[];
  clinical_notes?: string | null;
  instructions?: string | null;
};
