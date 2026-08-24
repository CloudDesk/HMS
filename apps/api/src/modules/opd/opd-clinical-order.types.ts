export type ClinicalOrderType = 'LABORATORY' | 'IMAGING';
export type ClinicalOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RECEIVED'
  | 'SAMPLE_COLLECTED'
  | 'IN_PROGRESS'
  | 'RESULT_ENTERED'
  | 'REPORT_ENTERED'
  | 'VERIFIED'
  | 'COMPLETED';
export type ClinicalOrderPriority = 'ROUTINE' | 'URGENT' | 'STAT';
export type ClinicalOrderSourceType = 'OPD' | 'EMERGENCY' | 'IP_ADMISSION' | 'PROCEDURE' | 'SURGERY';

export type ClinicalOrderItem = {
  id: string;
  service_id: string;
  service_name: string;
  investigation_name: string;
  category: string;
};

export type OpdClinicalOrder = {
  id: string;
  source_type: 'OPD_VISIT' | 'EMERGENCY_ENCOUNTER';
  source_id: string;
  visit_id: string | null;
  consultation_id: string | null;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  branch_id: string;
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

export type SaveClinicalOrderItemDTO = Omit<ClinicalOrderItem, 'id' | 'service_name'>;

export type SaveOpdClinicalOrderDTO = {
  priority: ClinicalOrderPriority;
  destination?: string | null;
  specimen_type?: string | null;
  items: SaveClinicalOrderItemDTO[];
  clinical_notes?: string | null;
  instructions?: string | null;
};

export type ClinicalOrderListQuery = {
  search?: string;
  status?: ClinicalOrderStatus;
  priority?: ClinicalOrderPriority;
  date_from?: string;
  date_to?: string;
  patient_id?: string;
  doctor_id?: string;
  branch_id?: string;
  page?: number;
  limit?: number;
};

export type ClinicalOrderRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};
