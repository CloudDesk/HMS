import type {
  ClinicalOrderDentalContext,
  ClinicalOrderListQuery,
  ClinicalOrderSourceType,
} from '../opd/opd-clinical-order.types.js';

export type ImagingOrderListQuery = ClinicalOrderListQuery;

export type ImagingAttachment = {
  id: string;
  file_name: string;
  file_size_bytes?: number | null;
  mime_type: string;
  storage_key: string;
  file_url?: string | null;
  uploaded_at: Date;
  uploaded_by?: string | null;
};

export type SaveImagingAttachmentDTO = {
  file_name: string;
  file_size_bytes?: number | null;
  mime_type: string;
  storage_key: string;
  file_url?: string | null;
};

export type SaveImagingReportDTO = {
  findings: string;
  impression: string;
  recommendations?: string | null;
  attachments?: SaveImagingAttachmentDTO[] | null;
};

export type ImagingReport = {
  id: string;
  order_id: string;
  patient_id: string;
  source_type: ClinicalOrderSourceType;
  encounter_id: string | null;
  admission_id: string | null;
  procedure_id: string | null;
  visit_id: string | null;
  dental_context?: ClinicalOrderDentalContext | null;
  findings: string;
  impression: string;
  recommendations: string | null;
  attachments: ImagingAttachment[];
  entered_by: string;
  entered_at: Date;
  verified_by: string | null;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type UpdateImagingStatusDTO = {
  status: 'RECEIVED' | 'IN_PROGRESS' | 'VERIFIED' | 'COMPLETED';
};
