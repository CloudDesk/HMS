import { apiClient } from './client';

export type ApiOpdVisitStatus =
  | 'CHECKED_IN'
  | 'WAITING_FOR_VITALS'
  | 'READY_FOR_CONSULTATION'
  | 'IN_CONSULTATION'
  | 'SKIPPED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type ApiOpdVisitType =
  | 'NEW_CONSULTATION'
  | 'FOLLOW_UP'
  | 'PROCEDURE'
  | 'EMERGENCY'
  | 'WALK_IN'
  | 'REVIEW';

export type ApiOpdVisitPriority = 'ROUTINE' | 'URGENT' | 'EMERGENCY';

export type OpdVisitResponse = {
  id: string;
  visit_number: string;
  queue_token_number: number | null;
  appointment_id: string | null;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialization: string;
  branch_id: string;
  department_id: string;
  visit_date: string;
  check_in_time: string;
  visit_type: ApiOpdVisitType;
  priority: ApiOpdVisitPriority;
  status: ApiOpdVisitStatus;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OpdVisitListResponse = {
  data: OpdVisitResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type OpdDashboardSummary = {
  total: number;
  by_status: Record<ApiOpdVisitStatus, number>;
  follow_ups: number;
  walk_ins: number;
  urgent: number;
};

export type OpdVisitListParams = Partial<{
  search: string;
  status: ApiOpdVisitStatus;
  doctor_id: string;
  patient_id: string;
  branch_id: string;
  department_id: string;
  date_from: string;
  date_to: string;
  page: number;
  limit: number;
  sortBy: 'visit_number' | 'visit_date' | 'check_in_time' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}>;

export type CreateOpdVisitPayload = {
  appointment_id?: string | null;
  patient_id?: string;
  doctor_id?: string;
  visit_type?: ApiOpdVisitType;
  priority?: ApiOpdVisitPriority;
  reason?: string | null;
  notes?: string | null;
};

export type UpdateOpdVisitStatusPayload = {
  status: ApiOpdVisitStatus;
  notes?: string | null;
};

export type OpdVitalsResponse = {
  id: string;
  visit_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  recorded_at: string;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  blood_pressure: string;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number;
  temperature_c: number | null;
  pulse_bpm: number | null;
  respiratory_rate_per_min: number | null;
  oxygen_saturation_percent: number | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OpdVitalsListResponse = {
  data: OpdVitalsResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type OpdVitalsListParams = Partial<{
  page: number;
  limit: number;
  sortBy: 'recorded_at' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}>;

export type CreateOpdVitalsPayload = {
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  temperature_c?: number | null;
  pulse_bpm?: number | null;
  respiratory_rate_per_min?: number | null;
  oxygen_saturation_percent?: number | null;
  notes?: string | null;
};

export type ApiOpdConsultationStatus = 'DRAFT' | 'COMPLETED';

export type OpdConsultationResponse = {
  id: string;
  visit_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  status: ApiOpdConsultationStatus;
  chief_complaint: string | null;
  history_present_illness: string | null;
  past_history: string | null;
  family_history: string | null;
  allergies: string | null;
  physical_examination: string | null;
  assessment: string | null;
  treatment_plan: string | null;
  doctor_notes: string | null;
  completed_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveOpdConsultationPayload = {
  chief_complaint?: string | null;
  history_present_illness?: string | null;
  past_history?: string | null;
  family_history?: string | null;
  allergies?: string | null;
  physical_examination?: string | null;
  assessment?: string | null;
  treatment_plan?: string | null;
  doctor_notes?: string | null;
};

export type DentitionType = 'PERMANENT' | 'PRIMARY';

export type ToothStatus =
  | 'PRESENT'
  | 'MISSING'
  | 'IMPACTED'
  | 'EXTRACTED'
  | 'UNERUPTED';

export type ToothSurface =
  | 'MESIAL'
  | 'DISTAL'
  | 'OCCLUSAL'
  | 'BUCCAL'
  | 'LINGUAL';

export type ToothMobility = 'NONE' | 'GRADE_I' | 'GRADE_II' | 'GRADE_III';

export type ApiDentalExaminationStatus = 'DRAFT' | 'COMPLETED';

export type DentalHistory = {
  chief_complaint?: string | null;
  pain_scale?: number | null;
  bleeding_gums?: boolean | null;
  sensitivity_hot_cold_sweet?: boolean | null;
  bruxism?: boolean | null;
  habits?: string[];
  medical_alerts?: string[];
};

export type SoftTissueExamination = {
  gingiva_condition?: string | null;
  calculus_plaque?: string | null;
  oral_mucosa?: string | null;
  tongue_palate_floor?: string | null;
  tmj_evaluation?: string | null;
  occlusion_class?: string | null;
};

export type ToothFinding = {
  tooth_number: number;
  dentition: DentitionType;
  status: ToothStatus;
  surfaces: ToothSurface[];
  conditions: string[];
  mobility?: ToothMobility | null;
  pocket_depth_mm?: number | null;
  furcation_involvement?: string | null;
  notes?: string | null;
};

export type DentalTreatmentPriority =
  | 'ROUTINE'
  | 'URGENT'
  | 'ELECTIVE'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW';

export type DentalTreatmentStatus =
  | 'PROPOSED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DECLINED'
  | 'CANCELLED';

export type DentalTreatmentPlanItem = {
  id?: string;
  service_id?: string | null;
  tooth_number?: number | null;
  procedure_name: string;
  surfaces?: ToothSurface[];
  priority?: DentalTreatmentPriority;
  estimated_cost?: number | null;
  notes?: string | null;
  status?: DentalTreatmentStatus;
  depends_on_plan_item_id?: string | null;
};

export type DentalChairsideImage = {
  id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  visit_id: string;
  visit_number: string;
  episode_id: string | null;
  episode_number: string | null;
  examination_id: string | null;
  tooth_number: number | null;
  imaging_source: 'CHAIRSIDE';
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_key: string;
  file_url: string;
  notes: string | null;
  doctor_id: string;
  doctor_name: string;
  branch_id: string;
  department_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DentalEpisodeStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';


export type DentalEpisodeVisitSummary = {
  visit_id: string;
  visit_number: string;
  doctor_id: string;
  doctor_name: string;
  visit_date: string;
  status: string;
  notes?: string | null;
};

export type DentalTreatmentEpisodeResponse = {
  id: string;
  episode_number: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  originating_visit_id: string;
  originating_visit_number: string;
  primary_doctor_id: string;
  primary_doctor_name: string;
  branch_id: string;
  department_id: string;
  primary_tooth_number?: number | null;
  diagnosis_code?: string | null;
  diagnosis_name?: string | null;
  treatment_plan_summary?: string | null;
  status: DentalEpisodeStatus;
  visit_ids: string[];
  visits?: DentalEpisodeVisitSummary[];
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateDentalEpisodePayload = {
  patient_id: string;
  originating_visit_id: string;
  primary_tooth_number?: number | null;
  diagnosis_code?: string | null;
  diagnosis_name?: string | null;
  treatment_plan_summary?: string | null;
  notes?: string | null;
};

export type UpdateDentalEpisodeStatusPayload = {
  status: DentalEpisodeStatus;
  notes?: string | null;
};

export type DentalStageStatus =
  | 'PLANNED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED';

export type DentalTreatmentStageResponse = {
  id: string;
  episode_id: string;
  plan_item_id: string;
  tooth_number?: number | null;
  service_id?: string | null;
  stage_name: string;
  sequence: number;
  assigned_doctor_id: string;
  assigned_doctor_name: string;
  status: DentalStageStatus;
  planned_date?: string | null;
  completed_at?: string | null;
  completed_by_doctor_id?: string | null;
  completed_by_doctor_name?: string | null;
  appointment_id?: string | null;
  prosthetic_lab_order_id?: string | null;
  notes?: string | null;
  branch_id: string;
  department_id: string;
  patient_id: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProstheticType = 'CROWN' | 'BRIDGE' | 'OTHER';

export type DentalLabOrderStatus =
  | 'DRAFT'
  | 'ORDERED'
  | 'RECEIVED'
  | 'IN_PROGRESS'
  | 'QUALITY_CHECK'
  | 'READY'
  | 'CANCELLED';

export type DentalProstheticLabOrderResponse = {
  id: string;
  order_number: string;
  patient_id: string;
  treatment_episode_id: string;
  treatment_stage_id: string;
  treatment_plan_item_id?: string | null;
  tooth_number?: number | null;
  prosthetic_type: ProstheticType;
  description: string;
  assigned_lab_id?: string | null;
  requested_by: string;
  requested_by_name?: string | null;
  requested_at: string;
  received_at?: string | null;
  in_progress_at?: string | null;
  quality_check_at?: string | null;
  ready_at?: string | null;
  cancelled_at?: string | null;
  status_remarks?: string | null;
  cancellation_reason?: string | null;
  status: DentalLabOrderStatus;
  branch_id: string;
  department_id: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateDentalProstheticLabOrderDTO = {
  patient_id: string;
  treatment_episode_id: string;
  treatment_stage_id: string;
  treatment_plan_item_id?: string | null;
  tooth_number?: number | null;
  prosthetic_type: ProstheticType;
  description: string;
  assigned_lab_id?: string | null;
  status?: DentalLabOrderStatus;
};

export type UpdateDentalLabOrderStatusPayload = {
  status: DentalLabOrderStatus;
  remarks?: string | null;
  cancellation_reason?: string | null;
};

export type CreateDentalStagePayload = {
  plan_item_id: string;
  stage_name: string;
  assigned_doctor_id: string;
  tooth_number?: number | null;
  service_id?: string | null;
  sequence?: number;
  planned_date?: string | null;
  prosthetic_lab_order_id?: string | null;
  notes?: string | null;
};

export type UpdateDentalStageStatusPayload = {
  status: DentalStageStatus;
  notes?: string | null;
};

export type AssignDoctorStagePayload = {
  doctor_id: string;
  notes?: string | null;
};

export type ScheduleDentalStagePayload = {
  doctor_id?: string;
  appointment_date: string;
  start_time: string;
  utc_datetime?: string;
  duration_minutes: number;
  reason?: string | null;
  notes?: string | null;
};

export type RescheduleDentalStagePayload = {
  appointment_date: string;
  start_time: string;
  utc_datetime?: string;
  duration_minutes?: number;
  reschedule_reason?: string | null;
  notes?: string | null;
};

/** Lightweight appointment view returned by GET /stages/:id/appointment */
export type AppointmentForStage = {
  id: string;
  appointment_number: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  doctor_name: string;
  reason: string | null;
  notes: string | null;
};

export type HistoricalToothFinding = {
  tooth_number: number;
  dentition: DentitionType;
  status: ToothStatus;
  surfaces: ToothSurface[];
  conditions: string[];
  mobility?: ToothMobility | null;
  pocket_depth_mm?: number | null;
  furcation_involvement?: string | null;
  notes?: string | null;
  visit_id: string;
  visit_number: string;
  doctor_id: string;
  doctor_name: string;
  recorded_at: string;
};

export type OpdDentalExaminationResponse = {
  id: string;
  visit_id: string;
  episode_id?: string | null;
  consultation_id?: string | null;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  branch_id: string;
  department_id: string;
  status: ApiDentalExaminationStatus;
  dental_history?: DentalHistory | null;
  soft_tissue?: SoftTissueExamination | null;
  teeth: ToothFinding[];
  treatment_plan_items: DentalTreatmentPlanItem[];
  completed_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveOpdDentalExaminationPayload = {
  expected_updated_at?: string | null;
  episode_id?: string | null;
  dental_history?: DentalHistory | null;
  soft_tissue?: SoftTissueExamination | null;
  teeth?: ToothFinding[];
  treatment_plan_items?: DentalTreatmentPlanItem[];
};

export type ApiOpdPrescriptionStatus = 'DRAFT' | 'SUBMITTED' | 'DISPENSED' | 'CANCELLED';

export type OpdPrescriptionItemResponse = {
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

export type OpdPrescriptionResponse = {
  id: string;
  visit_id: string;
  consultation_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  status: ApiOpdPrescriptionStatus;
  items: OpdPrescriptionItemResponse[];
  follow_up_date: string | null;
  doctor_instructions: string | null;
  patient_instructions: string | null;
  submitted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveOpdPrescriptionPayload = {
  items: Omit<OpdPrescriptionItemResponse, 'id'>[];
  follow_up_date?: string | null;
  doctor_instructions?: string | null;
  patient_instructions?: string | null;
};

export type ApiClinicalOrderType = 'LABORATORY' | 'IMAGING';
export type ApiClinicalOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RECEIVED'
  | 'SAMPLE_COLLECTED'
  | 'IN_PROGRESS'
  | 'RESULT_ENTERED'
  | 'REPORT_ENTERED'
  | 'VERIFIED'
  | 'COMPLETED';
export type ApiClinicalOrderPriority = 'ROUTINE' | 'URGENT' | 'STAT';

export type ApiClinicalOrderDentalContext = {
  treatment_episode_id?: string | null;
  treatment_stage_id?: string | null;
  tooth_number?: number | null;
};

export type OpdClinicalOrderItemResponse = {
  id: string;
  service_id: string;
  service_name: string;
  investigation_name: string;
  category: string;
  tooth_number?: number | null;
};

export type OpdClinicalOrderResponse = {
  id: string;
  originating_order_id: string;
  visit_id: string | null;
  consultation_id: string | null;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  branch_id: string;
  order_type: ApiClinicalOrderType;
  status: ApiClinicalOrderStatus;
  priority: ApiClinicalOrderPriority;
  destination: string | null;
  specimen_type: string | null;
  items: OpdClinicalOrderItemResponse[];
  dental_context?: ApiClinicalOrderDentalContext | null;
  clinical_notes: string | null;
  instructions: string | null;
  submitted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveOpdClinicalOrderPayload = {
  expected_updated_at?: string;
  priority: ApiClinicalOrderPriority;
  destination?: string | null;
  specimen_type?: string | null;
  items: Omit<OpdClinicalOrderItemResponse, 'id' | 'service_name'>[];
  dental_context?: ApiClinicalOrderDentalContext | null;
  clinical_notes?: string | null;
  instructions?: string | null;
};

export type ApiOpdFollowUpStatus = 'DRAFT' | 'SCHEDULED';
export type ApiOpdFollowUpType = 'CLINICAL_REVIEW' | 'MEDICATION_REVIEW' | 'LAB_REVIEW' | 'IMAGING_REVIEW' | 'REFERRAL_REVIEW';
export type ApiOpdFollowUpReminderType = 'SMS' | 'EMAIL' | 'NONE';

export type OpdFollowUpResponse = {
  id: string;
  visit_id: string;
  consultation_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  originating_doctor_id: string;
  originating_doctor_name: string;
  assigned_doctor_id: string | null;
  assigned_doctor_name: string | null;
  appointment_id: string | null;
  appointment_number: string | null;
  follow_up_type: ApiOpdFollowUpType | null;
  next_visit_date: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  reason: string | null;
  reminder_type: ApiOpdFollowUpReminderType;
  notes: string | null;
  status: ApiOpdFollowUpStatus;
  scheduled_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveOpdFollowUpPayload = {
  follow_up_type?: ApiOpdFollowUpType | null;
  next_visit_date?: string | null;
  start_time?: string | null;
  utc_datetime?: string | null;
  duration_minutes?: number | null;
  assigned_doctor_id?: string | null;
  reason?: string | null;
  reminder_type?: ApiOpdFollowUpReminderType;
  notes?: string | null;
};

export type ApiOpdReferralStatus = 'DRAFT' | 'SUBMITTED';
export type ApiOpdReferralType = 'INTERNAL' | 'EXTERNAL' | 'EMERGENCY';
export type ApiOpdReferralPriority = 'ROUTINE' | 'URGENT' | 'EMERGENCY';

export type OpdReferralResponse = {
  id: string;
  visit_id: string;
  branch_id: string;
  consultation_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  referring_doctor_id: string;
  referring_doctor_name: string;
  referral_type: ApiOpdReferralType | null;
  specialty: string | null;
  priority: ApiOpdReferralPriority;
  facility: string | null;
  referred_doctor_id: string | null;
  referred_doctor_name: string | null;
  reason: string | null;
  clinical_summary: string | null;
  appointment_id: string | null;
  appointment_number: string | null;
  appointment_date: string | null;
  appointment_start_time: string | null;
  appointment_duration_minutes: number | null;
  status: ApiOpdReferralStatus;
  submitted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveOpdReferralPayload = {
  referral_type?: ApiOpdReferralType | null;
  specialty?: string | null;
  priority?: ApiOpdReferralPriority;
  facility?: string | null;
  referred_doctor_id?: string | null;
  referred_doctor_name?: string | null;
  reason?: string | null;
  clinical_summary?: string | null;
  appointment_date?: string | null;
  appointment_start_time?: string | null;
  appointment_duration_minutes?: number | null;
};

export type OpdReferralListResponse = { data: OpdReferralResponse[]; meta: { total: number; page: number; limit: number; totalPages: number } };
export type BookOpdReferralPayload = { appointment_date: string; start_time: string; utc_datetime?: string; duration_minutes: number;
  visit_type: 'NEW_CONSULTATION' | 'FOLLOW_UP' | 'PROCEDURE'; priority?: ApiOpdReferralPriority; notes?: string | null };

const toQueryString = (params: Record<string, unknown>) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const opdApi = {
  dashboardSummary(params: OpdVisitListParams = {}) {
    return apiClient.request<OpdDashboardSummary>(`/opd/dashboard-summary${toQueryString(params)}`);
  },
  listReferrals(params: { booked?: boolean; page?: number; limit?: number } = {}) {
    return apiClient.request<OpdReferralListResponse>(`/opd/referrals${toQueryString(params)}`);
  },

  bookReferral(referralId: string, payload: BookOpdReferralPayload) {
    return apiClient.request<OpdReferralResponse>(`/opd/referrals/${encodeURIComponent(referralId)}/book`, { method: 'POST', body: payload });
  },
  listVisits(params: OpdVisitListParams = {}) {
    return apiClient.request<OpdVisitListResponse>(`/opd/visits${toQueryString(params)}`);
  },

  getVisitById(id: string) {
    return apiClient.request<OpdVisitResponse>(`/opd/visits/${encodeURIComponent(id)}`);
  },

  createVisit(payload: CreateOpdVisitPayload) {
    return apiClient.request<OpdVisitResponse>('/opd/visits', {
      body: payload,
      method: 'POST',
    });
  },

  updateVisitStatus(id: string, payload: UpdateOpdVisitStatusPayload) {
    return apiClient.request<OpdVisitResponse>(`/opd/visits/${encodeURIComponent(id)}/status`, {
      body: payload,
      method: 'PATCH',
    });
  },

  callNextPatient(id: string) {
    return apiClient.request<OpdVisitResponse>(`/opd/visits/${encodeURIComponent(id)}/call-next`, {
      method: 'POST',
    });
  },

  listVitals(visitId: string, params: OpdVitalsListParams = {}) {
    return apiClient.request<OpdVitalsListResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/vitals${toQueryString(params)}`,
    );
  },

  getLatestVitals(visitId: string) {
    return apiClient.request<OpdVitalsResponse | null>(`/opd/visits/${encodeURIComponent(visitId)}/vitals/latest`);
  },

  createVitals(visitId: string, payload: CreateOpdVitalsPayload) {
    return apiClient.request<OpdVitalsResponse>(`/opd/visits/${encodeURIComponent(visitId)}/vitals`, {
      body: payload,
      method: 'POST',
    });
  },

  getConsultation(visitId: string) {
    return apiClient.request<OpdConsultationResponse | null>(
      `/opd/visits/${encodeURIComponent(visitId)}/consultation`,
    );
  },

  saveConsultationDraft(visitId: string, payload: SaveOpdConsultationPayload) {
    return apiClient.request<OpdConsultationResponse>(`/opd/visits/${encodeURIComponent(visitId)}/consultation`, {
      body: payload,
      method: 'PUT',
    });
  },

  completeConsultation(visitId: string, payload: SaveOpdConsultationPayload) {
    return apiClient.request<OpdConsultationResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/consultation/complete`,
      {
        body: payload,
        method: 'POST',
      },
    );
  },

  listPrescriptions(params: Partial<{ status: ApiOpdPrescriptionStatus; limit: number; skip: number; search: string; sortBy: string; sortOrder: 'asc' | 'desc' }> = {}) {
    return apiClient.request<{ data: OpdPrescriptionResponse[]; total: number }>(`/opd/prescriptions${toQueryString(params)}`);
  },

  getPrescription(visitId: string) {
    return apiClient.request<OpdPrescriptionResponse | null>(
      `/opd/visits/${encodeURIComponent(visitId)}/prescription`,
    );
  },

  savePrescriptionDraft(visitId: string, payload: SaveOpdPrescriptionPayload) {
    return apiClient.request<OpdPrescriptionResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/prescription`,
      { body: payload, method: 'PUT' },
    );
  },

  submitPrescription(visitId: string, payload: SaveOpdPrescriptionPayload) {
    return apiClient.request<OpdPrescriptionResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/prescription/submit`,
      { body: payload, method: 'POST' },
    );
  },

  getClinicalOrder(visitId: string, orderType: ApiClinicalOrderType) {
    return apiClient.request<OpdClinicalOrderResponse | null>(
      `/opd/visits/${encodeURIComponent(visitId)}/clinical-orders/${orderType}`,
    );
  },

  saveClinicalOrderDraft(
    visitId: string,
    orderType: ApiClinicalOrderType,
    payload: SaveOpdClinicalOrderPayload,
  ) {
    return apiClient.request<OpdClinicalOrderResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/clinical-orders/${orderType}`,
      { body: payload, method: 'PUT' },
    );
  },

  submitClinicalOrder(
    visitId: string,
    orderType: ApiClinicalOrderType,
    payload: SaveOpdClinicalOrderPayload,
  ) {
    return apiClient.request<OpdClinicalOrderResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/clinical-orders/${orderType}/submit`,
      { body: payload, method: 'POST' },
    );
  },

  getEpisodeImagingOrders(episodeId: string) {
    return apiClient.request<OpdClinicalOrderResponse[]>(
      `/opd/dental/episodes/${encodeURIComponent(episodeId)}/imaging-orders`,
    );
  },

  getFollowUp(visitId: string) {
    return apiClient.request<OpdFollowUpResponse | null>(`/opd/visits/${encodeURIComponent(visitId)}/follow-up`);
  },

  saveFollowUpDraft(visitId: string, payload: SaveOpdFollowUpPayload) {
    return apiClient.request<OpdFollowUpResponse>(`/opd/visits/${encodeURIComponent(visitId)}/follow-up`, {
      body: payload,
      method: 'PUT',
    });
  },

  scheduleFollowUp(visitId: string, payload: SaveOpdFollowUpPayload) {
    return apiClient.request<OpdFollowUpResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/follow-up/schedule`,
      { body: payload, method: 'POST' },
    );
  },

  getReferral(visitId: string) {
    return apiClient.request<OpdReferralResponse | null>(`/opd/visits/${encodeURIComponent(visitId)}/referral`);
  },

  saveReferralDraft(visitId: string, payload: SaveOpdReferralPayload) {
    return apiClient.request<OpdReferralResponse>(`/opd/visits/${encodeURIComponent(visitId)}/referral`, {
      body: payload,
      method: 'PUT',
    });
  },

  submitReferral(visitId: string, payload: SaveOpdReferralPayload) {
    return apiClient.request<OpdReferralResponse>(`/opd/visits/${encodeURIComponent(visitId)}/referral/submit`, {
      body: payload,
      method: 'POST',
    });
  },

  getDentalExamination(visitId: string) {
    return apiClient.request<OpdDentalExaminationResponse | null>(
      `/opd/visits/${encodeURIComponent(visitId)}/dental-examination`,
    );
  },

  saveDentalExaminationDraft(visitId: string, payload: SaveOpdDentalExaminationPayload) {
    return apiClient.request<OpdDentalExaminationResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/dental-examination`,
      {
        body: payload,
        method: 'PUT',
      },
    );
  },

  completeDentalExamination(visitId: string, payload: SaveOpdDentalExaminationPayload) {
    return apiClient.request<OpdDentalExaminationResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/dental-examination/complete`,
      {
        body: payload,
        method: 'POST',
      },
    );
  },

  uploadDentalChairsideImage(visitId: string, formData: FormData) {
    return apiClient.request<DentalChairsideImage>(
      `/opd/visits/${encodeURIComponent(visitId)}/dental-chairside-images`,
      {
        body: formData,
        method: 'POST',
      },
    );
  },

  listDentalChairsideImages(visitId: string, params?: { tooth_number?: number; episode_id?: string }) {
    return apiClient.request<DentalChairsideImage[]>(
      `/opd/visits/${encodeURIComponent(visitId)}/dental-chairside-images${toQueryString(params ?? {})}`,
    );
  },

  listEpisodeChairsideImages(episodeId: string) {
    return apiClient.request<DentalChairsideImage[]>(
      `/opd/dental-episodes/${encodeURIComponent(episodeId)}/dental-chairside-images`,
    );
  },

  getDentalChairsideImageDownloadUrl(imageId: string) {
    return `/api/opd/dental-chairside-images/${encodeURIComponent(imageId)}/download`;
  },

  deleteDentalChairsideImage(imageId: string) {
    return apiClient.request<{ message: string }>(
      `/opd/dental-chairside-images/${encodeURIComponent(imageId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  createDentalEpisode(payload: CreateDentalEpisodePayload) {
    return apiClient.request<DentalTreatmentEpisodeResponse>(
      '/opd/dental/episodes',
      {
        body: payload,
        method: 'POST',
      },
    );
  },

  getDentalEpisode(episodeId: string) {
    return apiClient.request<DentalTreatmentEpisodeResponse>(
      `/opd/dental/episodes/${encodeURIComponent(episodeId)}`,
    );
  },

  listPatientDentalEpisodes(patientId: string) {
    return apiClient.request<DentalTreatmentEpisodeResponse[]>(
      `/opd/dental/patients/${encodeURIComponent(patientId)}/episodes`,
    );
  },

  linkVisitToDentalEpisode(episodeId: string, visitId: string) {
    return apiClient.request<DentalTreatmentEpisodeResponse>(
      `/opd/dental/episodes/${encodeURIComponent(episodeId)}/link-visit`,
      {
        body: { visit_id: visitId },
        method: 'POST',
      },
    );
  },

  updateDentalEpisodeStatus(episodeId: string, payload: UpdateDentalEpisodeStatusPayload) {
    return apiClient.request<DentalTreatmentEpisodeResponse>(
      `/opd/dental/episodes/${encodeURIComponent(episodeId)}/status`,
      {
        body: payload,
        method: 'PATCH',
      },
    );
  },

  getPatientToothHistory(patientId: string, excludeVisitId?: string) {
    const query = excludeVisitId ? `?exclude_visit_id=${encodeURIComponent(excludeVisitId)}` : '';
    return apiClient.request<HistoricalToothFinding[]>(
      `/opd/dental/patients/${encodeURIComponent(patientId)}/tooth-history${query}`,
    );
  },

  createDentalStage(episodeId: string, payload: CreateDentalStagePayload) {
    return apiClient.request<DentalTreatmentStageResponse>(
      `/opd/dental/episodes/${encodeURIComponent(episodeId)}/stages`,
      {
        body: payload,
        method: 'POST',
      },
    );
  },

  listDentalStages(episodeId: string, planItemId?: string) {
    const query = planItemId ? `?plan_item_id=${encodeURIComponent(planItemId)}` : '';
    return apiClient.request<DentalTreatmentStageResponse[]>(
      `/opd/dental/episodes/${encodeURIComponent(episodeId)}/stages${query}`,
    );
  },

  getDentalStage(stageId: string) {
    return apiClient.request<DentalTreatmentStageResponse>(
      `/opd/dental/stages/${encodeURIComponent(stageId)}`,
    );
  },

  assignDoctorToDentalStage(stageId: string, payload: AssignDoctorStagePayload) {
    return apiClient.request<DentalTreatmentStageResponse>(
      `/opd/dental/stages/${encodeURIComponent(stageId)}/doctor`,
      {
        body: payload,
        method: 'PATCH',
      },
    );
  },

  updateDentalStageStatus(stageId: string, payload: UpdateDentalStageStatusPayload) {
    return apiClient.request<DentalTreatmentStageResponse>(
      `/opd/dental/stages/${encodeURIComponent(stageId)}/status`,
      {
        body: payload,
        method: 'PATCH',
      },
    );
  },

  deleteDentalStage(stageId: string) {
    return apiClient.request<{ success: boolean }>(
      `/opd/dental/stages/${encodeURIComponent(stageId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  scheduleDentalStage(stageId: string, payload: ScheduleDentalStagePayload) {
    return apiClient.request<DentalTreatmentStageResponse>(
      `/opd/dental/stages/${encodeURIComponent(stageId)}/schedule`,
      {
        body: payload,
        method: 'POST',
      },
    );
  },

  rescheduleDentalStage(stageId: string, payload: RescheduleDentalStagePayload) {
    return apiClient.request<DentalTreatmentStageResponse>(
      `/opd/dental/stages/${encodeURIComponent(stageId)}/reschedule`,
      {
        body: payload,
        method: 'POST',
      },
    );
  },

  cancelDentalStageAppointment(stageId: string, reason?: string) {
    return apiClient.request<DentalTreatmentStageResponse>(
      `/opd/dental/stages/${encodeURIComponent(stageId)}/cancel-appointment`,
      {
        body: { reason: reason ?? null },
        method: 'POST',
      },
    );
  },

  getDentalStageAppointment(stageId: string) {
    return apiClient.request<AppointmentForStage | null>(
      `/opd/dental/stages/${encodeURIComponent(stageId)}/appointment`,
    );
  },

  createDentalLabOrder(payload: CreateDentalProstheticLabOrderDTO) {
    return apiClient.request<DentalProstheticLabOrderResponse>(
      '/opd/dental/lab-orders',
      {
        body: payload,
        method: 'POST',
      },
    );
  },

  getDentalLabOrder(orderId: string) {
    return apiClient.request<DentalProstheticLabOrderResponse>(
      `/opd/dental/lab-orders/${encodeURIComponent(orderId)}`,
    );
  },

  getEpisodeDentalLabOrders(episodeId: string) {
    return apiClient.request<DentalProstheticLabOrderResponse[]>(
      `/opd/dental/episodes/${encodeURIComponent(episodeId)}/lab-orders`,
    );
  },

  updateDentalLabOrderStatus(orderId: string, payload: UpdateDentalLabOrderStatusPayload) {
    return apiClient.request<DentalProstheticLabOrderResponse>(
      `/opd/dental/lab-orders/${encodeURIComponent(orderId)}/status`,
      {
        body: payload,
        method: 'PATCH',
      },
    );
  },

  createDentalQuotation(episodeId: string, payload: CreateDentalQuotationDTO) {
    return apiClient.request<DentalTreatmentQuotationResponse>(
      `/opd/dental/episodes/${encodeURIComponent(episodeId)}/quotations`,
      {
        body: payload,
        method: 'POST',
      },
    );
  },

  getEpisodeDentalQuotations(episodeId: string) {
    return apiClient.request<DentalTreatmentQuotationResponse[]>(
      `/opd/dental/episodes/${encodeURIComponent(episodeId)}/quotations`,
    );
  },

  getDentalQuotation(quotationId: string) {
    return apiClient.request<DentalTreatmentQuotationResponse>(
      `/opd/dental/quotations/${encodeURIComponent(quotationId)}`,
    );
  },

  updateDentalQuotationDraft(quotationId: string, payload: UpdateDentalQuotationDraftDTO) {
    return apiClient.request<DentalTreatmentQuotationResponse>(
      `/opd/dental/quotations/${encodeURIComponent(quotationId)}`,
      {
        body: payload,
        method: 'PUT',
      },
    );
  },

  sendDentalQuotation(quotationId: string) {
    return apiClient.request<DentalTreatmentQuotationResponse>(
      `/opd/dental/quotations/${encodeURIComponent(quotationId)}/send`,
      {
        method: 'POST',
      },
    );
  },

  acceptDentalQuotation(quotationId: string, payload: AcceptDentalQuotationDTO) {
    return apiClient.request<DentalTreatmentQuotationResponse>(
      `/opd/dental/quotations/${encodeURIComponent(quotationId)}/accept`,
      {
        body: payload,
        method: 'POST',
      },
    );
  },

  rejectDentalQuotation(quotationId: string, payload: RejectDentalQuotationDTO) {
    return apiClient.request<DentalTreatmentQuotationResponse>(
      `/opd/dental/quotations/${encodeURIComponent(quotationId)}/reject`,
      {
        body: payload,
        method: 'POST',
      },
    );
  },

  postponeDentalQuotation(quotationId: string, payload: PostponeDentalQuotationDTO) {
    return apiClient.request<DentalTreatmentQuotationResponse>(
      `/opd/dental/quotations/${encodeURIComponent(quotationId)}/postpone`,
      {
        body: payload,
        method: 'POST',
      },
    );
  },

  getPatientDentalQuotations(patientId: string) {
    return apiClient.request<DentalTreatmentQuotationResponse[]>(
      `/opd/dental/quotations/patient/${encodeURIComponent(patientId)}`,
    );
  },
};

export type DentalQuotationStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'POSTPONED'
  | 'EXPIRED';

export type DentalQuotationItemResponse = {
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

export type DentalQuotationOptionResponse = {
  id?: string;
  name: string;
  description?: string | null;
  sequence: number;
  items: DentalQuotationItemResponse[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
};

export type DentalTreatmentQuotationResponse = {
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
  items: DentalQuotationItemResponse[];
  options?: DentalQuotationOptionResponse[];
  selected_option_id?: string | null;
  selected_option_name?: string | null;
  accepted_at?: string | null;
  accepted_by?: string | null;
  decision_reason?: string | null;
  decision_at?: string | null;
  sent_at?: string | null;
  sent_by?: string | null;
  notes?: string | null;
  valid_until?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
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
  valid_until?: string | null;
  discount_amount?: number;
  tax_amount?: number;
  items?: CreateDentalQuotationItemDTO[];
  options?: CreateDentalQuotationOptionDTO[];
};

export type UpdateDentalQuotationDraftDTO = {
  doctor_id?: string;
  notes?: string | null;
  valid_until?: string | null;
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


