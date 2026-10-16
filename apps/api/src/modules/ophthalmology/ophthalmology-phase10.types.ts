export type OphthalmologyPublicationSourceType =
  | 'CONSULTATION_SUMMARY'
  | 'OPTICAL_PRESCRIPTION'
  | 'TEST_RESULT';

export type OphthalmologyPublicationStatus = 'APPROVED_FOR_PORTAL' | 'WITHDRAWN';

export type CreateOphthalmologyPublicationDTO = {
  source_type: OphthalmologyPublicationSourceType;
  source_id: string;
  source_version: number;
};

export type WithdrawOphthalmologyPublicationDTO = {
  expected_version: number;
  expected_status: 'APPROVED_FOR_PORTAL';
  reason: string;
};

export type OphthalmologyPublication = {
  id: string;
  context_id: string;
  visit_id: string;
  patient_id: string;
  branch_id: string;
  department_id: string;
  source_type: OphthalmologyPublicationSourceType;
  source_id: string;
  source_version: number;
  status: OphthalmologyPublicationStatus;
  portal_payload: Record<string, unknown>;
  published_by: string;
  published_at: Date;
  withdrawn_by: string | null;
  withdrawn_at: Date | null;
  withdrawal_reason: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
};

export type OphthalmologyReportType =
  | 'STATION_QUEUE'
  | 'TEST_TURNAROUND'
  | 'PENDING_REVIEW'
  | 'REPEAT_UNABLE'
  | 'CLINICAL_VOLUME'
  | 'DIAGNOSTIC_UTILIZATION';

export type OphthalmologyReportQuery = {
  branch_id: string;
  station_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
};

export type OphthalmologyDashboardQuery = { branch_id: string };

export type OphthalmologyAttachmentProvenance = 'MANUAL_UPLOAD' | 'DEVICE_IMPORT';
export type OphthalmologyAttachmentReviewState = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type OphthalmologyAttachmentPublicationState = 'INTERNAL' | 'APPROVED_FOR_PORTAL' | 'WITHDRAWN';

export type UploadOphthalmologyAttachmentDTO = {
  task_id: string;
  result_id?: string | null;
  title: string;
  acquired_at: string;
  provenance: OphthalmologyAttachmentProvenance;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  data: Buffer;
};

export type OphthalmologyAttachment = {
  id: string;
  context_id: string;
  visit_id: string;
  patient_id: string;
  branch_id: string;
  department_id: string;
  task_id: string;
  result_id: string | null;
  patient_document_id: string;
  test_code: string;
  laterality: string;
  device_code: string | null;
  acquired_at: Date;
  provenance: OphthalmologyAttachmentProvenance;
  checksum_sha256: string;
  mime_type: string;
  file_size_bytes: number;
  original_file_name: string;
  review_state: OphthalmologyAttachmentReviewState;
  publication_state: OphthalmologyAttachmentPublicationState;
  uploaded_by: string;
  created_at: Date;
  updated_at: Date;
};

export type OphthalmologyAttachmentListQuery = {
  branch_id: string;
  task_id?: string;
  result_id?: string;
  visit_id?: string;
  page?: number;
  limit?: number;
};

