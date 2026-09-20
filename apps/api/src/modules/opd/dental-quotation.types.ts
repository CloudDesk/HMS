export type DentalQuotationStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'POSTPONED'
  | 'EXPIRED';

export type DentalQuotationItem = {
  id?: string;
  treatment_plan_item_id?: string | null;
  service_id?: string | null;
  procedure_name: string;
  tooth_number?: number | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  notes?: string | null;
};

export type DentalQuotationOption = {
  id?: string;
  name: string;
  description?: string | null;
  sequence: number;
  items: DentalQuotationItem[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
};

export type DentalTreatmentQuotation = {
  id: string;
  quotation_number: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  treatment_episode_id: string;
  treatment_episode_number?: string | null;
  doctor_id: string;
  doctor_name: string;
  branch_id: string;
  department_id: string;
  status: DentalQuotationStatus;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  items: DentalQuotationItem[];
  options: DentalQuotationOption[];
  selected_option_id?: string | null;
  selected_option_name?: string | null;
  accepted_at?: Date | null;
  accepted_by?: string | null;
  decision_reason?: string | null;
  decision_at?: Date | null;
  sent_at?: Date | null;
  sent_by?: string | null;
  notes?: string | null;
  valid_until?: Date | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CreateDentalQuotationItemDTO = {
  treatment_plan_item_id?: string | null;
  service_id?: string | null;
  procedure_name: string;
  tooth_number?: number | null;
  quantity?: number;
  unit_price?: number;
  discount_amount?: number;
  tax_amount?: number;
  notes?: string | null;
};

export type CreateDentalQuotationOptionDTO = {
  id?: string;
  name: string;
  description?: string | null;
  sequence?: number;
  discount_amount?: number;
  tax_amount?: number;
  items: CreateDentalQuotationItemDTO[];
};

export type CreateDentalQuotationDTO = {
  patient_id?: string;
  treatment_episode_id?: string;
  doctor_id?: string;
  notes?: string | null;
  valid_until?: string | Date | null;
  discount_amount?: number;
  tax_amount?: number;
  items?: CreateDentalQuotationItemDTO[];
  options?: CreateDentalQuotationOptionDTO[];
};

export type UpdateDentalQuotationDraftDTO = {
  doctor_id?: string;
  notes?: string | null;
  valid_until?: string | Date | null;
  discount_amount?: number;
  tax_amount?: number;
  items?: CreateDentalQuotationItemDTO[];
  options?: CreateDentalQuotationOptionDTO[];
};

export type AcceptDentalQuotationDTO = {
  selected_option_id: string;
  notes?: string | null;
};

export type RejectDentalQuotationDTO = {
  reason?: string | null;
};

export type PostponeDentalQuotationDTO = {
  reason?: string | null;
};


