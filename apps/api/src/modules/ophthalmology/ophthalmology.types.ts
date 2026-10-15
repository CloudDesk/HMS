export type OphthalmologyVisitSubtype =
  | 'NEW_CONSULTATION'
  | 'FOLLOW_UP'
  | 'EMERGENCY'
  | 'POST_OPERATIVE'
  | 'SCREENING'
  | 'PROCEDURE_REVIEW';

export type OphthalmologyLaterality = 'OD' | 'OS' | 'OU' | 'NOT_APPLICABLE' | 'NOT_SPECIFIED';
export type OphthalmologyContextLaterality = Exclude<OphthalmologyLaterality, 'NOT_APPLICABLE'>;
export type OphthalmologyWorkflowStatus =
  | 'CHECKED_IN'
  | 'PRELIMINARY_EXAMINATION'
  | 'AWAITING_DOCTOR'
  | 'UNDER_CONSULTATION'
  | 'TESTS_ORDERED'
  | 'AWAITING_RESULTS'
  | 'CLINICAL_REVIEW'
  | 'REVIEW_COMPLETED'
  | 'CONSULTATION_COMPLETED';

export type OphthalmologyContext = {
  id: string;
  visit_id: string;
  patient_id: string;
  branch_id: string;
  department_id: string;
  doctor_id: string;
  visit_subtype: OphthalmologyVisitSubtype;
  affected_eye: OphthalmologyContextLaterality;
  workflow_status: OphthalmologyWorkflowStatus;
  configuration_version_id: string;
  workflow_profile_version_id: string;
  version: number;
  created_at: Date;
  updated_at: Date;
};

export type CreateOphthalmologyContextDTO = {
  visit_subtype: OphthalmologyVisitSubtype;
  affected_eye: OphthalmologyContextLaterality;
  configuration_version_id: string;
  workflow_profile_version_id: string;
};

export type UpdateOphthalmologyContextDTO = {
  expected_version: number;
  visit_subtype?: OphthalmologyVisitSubtype;
  affected_eye?: OphthalmologyContextLaterality;
  workflow_profile_version_id?: string;
};

export type OphthalmologyConfigurationType =
  | 'SUB_SPECIALITY'
  | 'COMPLAINT'
  | 'TEST_CATALOGUE'
  | 'VISUAL_ACUITY_SCALE'
  | 'DIAGNOSIS_REFERENCE'
  | 'DRUG_OPTION'
  | 'OPTICAL_PRODUCT'
  | 'IOL_CATALOGUE'
  | 'CLINICAL_THRESHOLD'
  | 'GRADE'
  | 'REASON'
  | 'FORM_PROFILE'
  | 'COMPLETION_PROFILE';
export type OphthalmologyConfigurationStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export type OphthalmologyConfiguration = {
  id: string;
  branch_id: string;
  type: OphthalmologyConfigurationType;
  code: string;
  name: string;
  description: string | null;
  revision: number;
  status: OphthalmologyConfigurationStatus;
  effective_from: Date | null;
  effective_to: Date | null;
  values: Record<string, unknown>;
  version: number;
  created_at: Date;
  updated_at: Date;
};

export type OphthalmologyConfigurationListQuery = {
  branch_id: string;
  type?: OphthalmologyConfigurationType;
  status?: OphthalmologyConfigurationStatus;
  code?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type CreateOphthalmologyConfigurationDTO = {
  branch_id: string;
  type: OphthalmologyConfigurationType;
  code: string;
  name: string;
  description?: string | null;
  effective_from?: string | null;
  values?: Record<string, unknown>;
};

export type UpdateOphthalmologyConfigurationDTO = {
  expected_version: number;
  name?: string;
  description?: string | null;
  effective_from?: string | null;
  values?: Record<string, unknown>;
};

export type VersionActionDTO = {
  expected_version: number;
  expected_status: OphthalmologyConfigurationStatus;
  reason?: string | null;
};

export type OphthalmologyDevice = {
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  calibration_status: 'CURRENT' | 'DUE' | 'EXPIRED' | 'NOT_REQUIRED';
  calibrated_at: Date | null;
  calibration_due_at: Date | null;
};

export type OphthalmologyStation = {
  id: string;
  branch_id: string;
  department_id: string;
  code: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  supported_test_types: string[];
  devices: OphthalmologyDevice[];
  member_user_ids: string[];
  version: number;
  created_at: Date;
  updated_at: Date;
};

export type OphthalmologyStationListQuery = {
  branch_id: string;
  status?: 'ACTIVE' | 'INACTIVE';
  test_type?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type SaveOphthalmologyDeviceDTO = {
  code: string;
  name: string;
  status?: 'ACTIVE' | 'INACTIVE';
  calibration_status?: OphthalmologyDevice['calibration_status'];
  calibrated_at?: string | null;
  calibration_due_at?: string | null;
};

export type CreateOphthalmologyStationDTO = {
  branch_id: string;
  department_id: string;
  code: string;
  name: string;
  description?: string | null;
  supported_test_types?: string[];
  devices?: SaveOphthalmologyDeviceDTO[];
  member_user_ids?: string[];
};

export type UpdateOphthalmologyStationDTO = {
  expected_version: number;
  name?: string;
  description?: string | null;
  supported_test_types?: string[];
  devices?: SaveOphthalmologyDeviceDTO[];
  member_user_ids?: string[];
};

export type OphthalmologyWorkflowStage = {
  code: string;
  name: string;
  mode: 'SEQUENTIAL' | 'PARALLEL';
  test_codes: string[];
  bypass_allowed: boolean;
};

export type OphthalmologyWorkflowProfile = {
  id: string;
  branch_id: string;
  visit_subtype: OphthalmologyVisitSubtype;
  name: string;
  revision: number;
  status: OphthalmologyConfigurationStatus;
  effective_from: Date | null;
  effective_to: Date | null;
  stages: OphthalmologyWorkflowStage[];
  version: number;
  created_at: Date;
  updated_at: Date;
};

export type OphthalmologyWorkflowProfileListQuery = {
  branch_id: string;
  visit_subtype?: OphthalmologyVisitSubtype;
  status?: OphthalmologyConfigurationStatus;
  page?: number;
  limit?: number;
};

export type CreateOphthalmologyWorkflowProfileDTO = {
  branch_id: string;
  visit_subtype: OphthalmologyVisitSubtype;
  name: string;
  effective_from?: string | null;
  stages: OphthalmologyWorkflowStage[];
};

export type UpdateOphthalmologyWorkflowProfileDTO = {
  expected_version: number;
  name?: string;
  effective_from?: string | null;
  stages?: OphthalmologyWorkflowStage[];
};

export type OphthalmologyRequestMetadata = { ipAddress?: string; userAgent?: string };

export type OphthalmologyIntakeStatus = 'DRAFT' | 'COMPLETED';
export type OphthalmologyAlertStatus = 'ACTIVE' | 'ACKNOWLEDGED';
export type OphthalmologyAlertType = 'EMERGENCY_SCREENING';
export type OphthalmologyDurationUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
export type OphthalmologyComplaintOnset = 'SUDDEN' | 'GRADUAL' | 'UNKNOWN';
export type OphthalmologyComplaintProgression = 'IMPROVING' | 'STABLE' | 'WORSENING' | 'INTERMITTENT';
export type OphthalmologyComplaintSeverity = 'MILD' | 'MODERATE' | 'SEVERE';

export type OphthalmologyEyeSurgery = { procedure: string; laterality: Exclude<OphthalmologyLaterality, 'NOT_SPECIFIED'>; date: Date };
export type OphthalmologyEyeTreatment = { type: string; details: string };
export type OphthalmologyEyeInjuryOrLaser = {
  type: 'INJURY' | 'LASER';
  laterality: Exclude<OphthalmologyLaterality, 'NOT_SPECIFIED'>;
  date: Date | null;
  details: string;
};
export type OphthalmologyVisionCorrectionUse = { uses: boolean; age_months: number | null; wearing_pattern: string | null };

export type OphthalmologyIntake = {
  id: string;
  context_id: string;
  visit_id: string;
  patient_id: string;
  branch_id: string;
  department_id: string;
  status: OphthalmologyIntakeStatus;
  complaint_configuration_version_id: string;
  emergency_configuration_version_id: string;
  complaint_codes: string[];
  affected_eye: OphthalmologyContextLaterality;
  duration_value: number | null;
  duration_unit: OphthalmologyDurationUnit | null;
  onset: OphthalmologyComplaintOnset | null;
  progression: OphthalmologyComplaintProgression | null;
  severity: OphthalmologyComplaintSeverity | null;
  associated_symptom_codes: string[];
  description: string | null;
  no_significant_ophthalmic_history: boolean;
  previous_eye_disease_codes: string[];
  previous_eye_surgeries: OphthalmologyEyeSurgery[];
  current_eye_treatments: OphthalmologyEyeTreatment[];
  previous_eye_injury_or_laser: OphthalmologyEyeInjuryOrLaser[];
  spectacle_use: OphthalmologyVisionCorrectionUse;
  contact_lens_use: OphthalmologyVisionCorrectionUse;
  long_term_steroid_use: boolean;
  long_term_steroid_details: string | null;
  family_history_codes: string[];
  previous_report_document_ids: string[];
  shared_medical_history_reviewed: boolean;
  shared_allergy_reviewed: boolean;
  emergency_criterion_codes: string[];
  other_urgent_condition_detail: string | null;
  completed_by: string | null;
  completed_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
};

export type SaveOphthalmologyIntakeDraftDTO = {
  expected_version: number | null;
  complaint_configuration_version_id: string;
  emergency_configuration_version_id: string;
  complaint_codes: string[];
  affected_eye: OphthalmologyContextLaterality;
  duration_value?: number | null;
  duration_unit?: OphthalmologyDurationUnit | null;
  onset?: OphthalmologyComplaintOnset | null;
  progression?: OphthalmologyComplaintProgression | null;
  severity?: OphthalmologyComplaintSeverity | null;
  associated_symptom_codes?: string[];
  description?: string | null;
  no_significant_ophthalmic_history: boolean;
  previous_eye_disease_codes?: string[];
  previous_eye_surgeries?: Array<{ procedure: string; laterality: OphthalmologyEyeSurgery['laterality']; date: string }>;
  current_eye_treatments?: OphthalmologyEyeTreatment[];
  previous_eye_injury_or_laser?: Array<Omit<OphthalmologyEyeInjuryOrLaser, 'date'> & { date?: string | null }>;
  spectacle_use?: Partial<OphthalmologyVisionCorrectionUse>;
  contact_lens_use?: Partial<OphthalmologyVisionCorrectionUse>;
  long_term_steroid_use?: boolean;
  long_term_steroid_details?: string | null;
  family_history_codes?: string[];
  previous_report_document_ids?: string[];
  shared_medical_history_reviewed?: boolean;
  shared_allergy_reviewed?: boolean;
  emergency_criterion_codes?: string[];
  other_urgent_condition_detail?: string | null;
};

export type CompleteOphthalmologyIntakeDTO = {
  expected_version: number;
  expected_status: 'DRAFT';
  expected_context_version: number;
};

export type OphthalmologyAlert = {
  id: string;
  context_id: string;
  intake_id: string;
  visit_id: string;
  patient_id: string;
  branch_id: string;
  department_id: string;
  type: OphthalmologyAlertType;
  status: OphthalmologyAlertStatus;
  source_version: number;
  criterion_codes: string[];
  reason: string;
  notified_user_ids: string[];
  triggered_by: string;
  triggered_at: Date;
  acknowledged_by: string | null;
  acknowledged_at: Date | null;
  acknowledgement_note: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
};

export type AcknowledgeOphthalmologyAlertDTO = {
  expected_version: number;
  expected_status: 'ACTIVE';
  note?: string | null;
};

export type RouteOphthalmologyEmergencyDTO = {
  expected_version: number;
  expected_status: 'ACTIVE';
};

export type OphthalmologySharedHistoryProjection = {
  history_present_illness: string | null;
  past_history: string | null;
  family_history: string | null;
  allergies: string | null;
};

export type OphthalmologyTestTaskStatus =
  | 'ORDERED'
  | 'PATIENT_WAITING'
  | 'PATIENT_CALLED'
  | 'IN_PROGRESS'
  | 'DRAFT'
  | 'COMPLETED'
  | 'SUBMITTED_FOR_REVIEW'
  | 'REVIEWED'
  | 'REPEAT_REQUIRED'
  | 'UNABLE_TO_PERFORM'
  | 'CANCELLED';
export type OphthalmologyTestTaskPriority = 'ROUTINE' | 'PRIORITY' | 'EMERGENCY';
export type OphthalmologyTestTaskSourceType = 'WORKFLOW' | 'CLINICAL_ORDER_ITEM';
export type OphthalmologyTaskRoutingTarget = 'NEXT_STATION' | 'OPHTHALMOLOGIST';

export type OphthalmologyAssignmentHistoryEntry = {
  action: 'ASSIGNED' | 'REASSIGNED';
  from_station_id: string | null;
  to_station_id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  reason: string | null;
  actor_user_id: string;
  occurred_at: Date;
};

export type OphthalmologyTaskTransitionEntry = {
  action: 'CALLED' | 'PATIENT_UNAVAILABLE' | 'STARTED' | 'DRAFT_SAVED' | 'COMPLETED' | 'AMENDED' | 'UNABLE_TO_PERFORM' | 'CANCELLED' | 'REPEAT_REQUESTED';
  from_status: OphthalmologyTestTaskStatus;
  to_status: OphthalmologyTestTaskStatus;
  reason: string | null;
  actor_user_id: string;
  occurred_at: Date;
};

export type OphthalmologyTaskRoutingEntry = {
  target: OphthalmologyTaskRoutingTarget;
  target_task_id: string | null;
  target_station_id: string | null;
  reason: string | null;
  actor_user_id: string;
  occurred_at: Date;
};

export type OphthalmologyTestTask = {
  id: string;
  context_id: string;
  visit_id: string;
  patient_id: string;
  branch_id: string;
  department_id: string;
  test_catalogue_version_id: string;
  workflow_profile_version_id: string;
  workflow_stage_code: string | null;
  test_code: string;
  test_name: string;
  laterality: Exclude<OphthalmologyLaterality, 'NOT_SPECIFIED'>;
  priority: OphthalmologyTestTaskPriority;
  source_type: OphthalmologyTestTaskSourceType;
  source_order_id: string | null;
  source_order_item_id: string | null;
  source_order_type: 'LABORATORY' | 'IMAGING' | null;
  status: OphthalmologyTestTaskStatus;
  station_id: string | null;
  assigned_user_id: string | null;
  device_code: string | null;
  special_instructions: string | null;
  doctor_review_required: boolean;
  repeat_of_task_id: string | null;
  repeat_task_id: string | null;
  repeat_root_task_id: string | null;
  assignment_history: OphthalmologyAssignmentHistoryEntry[];
  transition_history: OphthalmologyTaskTransitionEntry[];
  routing_history: OphthalmologyTaskRoutingEntry[];
  ordered_at: Date;
  assigned_at: Date | null;
  waiting_since: Date | null;
  called_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  unable_at: Date | null;
  cancelled_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
};

export type CreateOphthalmologyTestTaskDTO = {
  expected_context_version: number;
  test_catalogue_version_id: string;
  test_code: string;
  workflow_stage_code?: string | null;
  laterality: Exclude<OphthalmologyLaterality, 'NOT_SPECIFIED'>;
  priority: OphthalmologyTestTaskPriority;
  special_instructions?: string | null;
  source_type: OphthalmologyTestTaskSourceType;
  source_order_id?: string | null;
  source_order_item_id?: string | null;
};

export type OphthalmologyTestTaskListQuery = {
  branch_id?: string;
  station_id?: string;
  assigned_user_id?: string;
  status?: OphthalmologyTestTaskStatus;
  test_code?: string;
  priority?: OphthalmologyTestTaskPriority;
  source_type?: OphthalmologyTestTaskSourceType;
  visit_id?: string;
  patient_id?: string;
  search?: string;
  sort?: 'assigned_at' | 'waiting_since' | 'priority' | 'updated_at';
  direction?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

export type AssignOphthalmologyTestTaskDTO = {
  expected_status: 'ORDERED';
  expected_version: number;
  station_id: string;
  assigned_user_id?: string | null;
};
export type ReassignOphthalmologyTestTaskDTO = {
  expected_status: 'PATIENT_WAITING' | 'PATIENT_CALLED' | 'DRAFT';
  expected_version: number;
  station_id: string;
  assigned_user_id?: string | null;
  reason: string;
};
export type TaskStateActionDTO = { expected_status: OphthalmologyTestTaskStatus; expected_version: number };
export type ReasonedTaskStateActionDTO = TaskStateActionDTO & { reason: string };
export type StartOphthalmologyTestTaskDTO = TaskStateActionDTO & { device_code?: string | null };
export type RepeatOphthalmologyTestTaskDTO = TaskStateActionDTO & { station_id: string; assigned_user_id?: string | null; reason: string };
export type RouteOphthalmologyTestTaskDTO = TaskStateActionDTO & {
  target: OphthalmologyTaskRoutingTarget;
  next_task_id?: string | null;
  station_id?: string | null;
  assigned_user_id?: string | null;
  reason?: string | null;
};

export type OphthalmologyIntakeView = {
  intake: OphthalmologyIntake | null;
  alerts: OphthalmologyAlert[];
  shared_history: OphthalmologySharedHistoryProjection;
};

export type OphthalmologyCoreTestFormType =
  | 'VISUAL_ACUITY'
  | 'LENSOMETRY'
  | 'AUTOREFRACTION_KERATOMETRY'
  | 'OBJECTIVE_REFRACTION'
  | 'SUBJECTIVE_REFRACTION'
  | 'INTRAOCULAR_PRESSURE'
  | 'SLIT_LAMP_ANTERIOR_SEGMENT'
  | 'POSTERIOR_FUNDUS_EXAM';
export type OphthalmologyTestResultStatus = 'DRAFT' | 'COMPLETED';
export type OphthalmologyResultSourceType = 'MANUAL' | 'DEVICE_IMPORT' | 'MANUAL_CORRECTION';
export type OphthalmologyResultReliability = 'GOOD' | 'FAIR' | 'POOR';

export type OphthalmologyEyeRefraction = { sphere?: number | null; cylinder?: number | null; axis?: number | null };
export type OphthalmologyEyeResult<T = Record<string, unknown>> = { OD?: T | null; OS?: T | null };
export type OphthalmologyVisualAcuityEye = { unaided_or_presenting?: string | null; current_glasses?: string | null;
  pinhole?: string | null; bcva?: string | null };
export type OphthalmologyLowVisionEye = { counting_fingers_distance?: { value: number; unit: string } | null;
  hand_movement?: boolean | null; perception_of_light?: boolean | null; projection_of_rays?: Record<string, 'ACCURATE' | 'INACCURATE'> | null };
export type OphthalmologyNearVisionEye = { unaided?: string | null; existing_correction?: string | null; best_correction?: string | null;
  chart?: string | null; distance?: { value: number; unit: string } | null };
export type OphthalmologyKeratometryEye = { k1?: number | null; k1_axis?: number | null; k2?: number | null; k2_axis?: number | null;
  average_k?: number | null; corneal_astigmatism?: number | null };
export type OphthalmologySlitLampStructure = 'lids_lashes' | 'lacrimal' | 'conjunctiva' | 'sclera' | 'cornea'
  | 'anterior_chamber' | 'iris' | 'pupil' | 'lens' | 'anterior_vitreous' | 'tear_film';
export type OphthalmologySlitLampFinding = { status?: 'NORMAL' | 'ABNORMAL'; finding?: string | null; location?: string | null;
  grade?: string | null; diagram_document_id?: string | null; image_document_ids?: string[]; remarks?: string | null };
export type OphthalmologyFundusEye = { media?: Record<string, unknown>; vitreous?: Record<string, unknown>; media_vitreous?: Record<string, unknown>;
  optic_disc?: Record<string, unknown>; macula?: Record<string, unknown>; fovea?: Record<string, unknown>;
  macula_fovea?: Record<string, unknown>; vessels?: Record<string, unknown>; retina?: Record<string, unknown>;
  vessels_retina?: Record<string, unknown>; diagram_document_id?: string | null;
  image_document_ids?: string[]; remarks?: string | null };
export type OphthalmologyCoreTestPayloads = {
  VISUAL_ACUITY: { chart_type?: string; test_distance?: { value: number; unit: string }; lighting?: string; correction_used?: string;
    distance?: OphthalmologyEyeResult<OphthalmologyVisualAcuityEye>; low_vision?: OphthalmologyEyeResult<OphthalmologyLowVisionEye>;
    near?: OphthalmologyEyeResult<OphthalmologyNearVisionEye>; conclusion_codes?: string[] };
  LENSOMETRY: { optical_power?: OphthalmologyEyeResult<OphthalmologyEyeRefraction & { addition?: number | null; prism?: number | null; prism_base?: string | null }>;
    lens_type?: string; material?: string; coating_codes?: string[]; optical_centre_pd?: OphthalmologyEyeResult;
    segment_height?: OphthalmologyEyeResult; lens_condition?: string; condition_notes?: string; spectacle_age?: { value: number; unit: string };
    usage_type?: string; comfortable?: boolean; change_reason_codes?: string[]; existing_prescription_document_id?: string | null };
  AUTOREFRACTION_KERATOMETRY: { cycloplegic?: boolean; cycloplegic_medication?: Record<string, unknown> | null;
    readings?: OphthalmologyEyeResult<Array<OphthalmologyEyeRefraction>>; selected_reading_index?: OphthalmologyEyeResult;
    spherical_equivalent?: OphthalmologyEyeResult; pd?: Record<string, unknown>; pupil_diameter?: OphthalmologyEyeResult;
    keratometry?: OphthalmologyEyeResult<OphthalmologyKeratometryEye>; observations?: string[] };
  OBJECTIVE_REFRACTION: { method?: string; retinoscopy_type?: string | null; working_distance?: { value: number; unit: string };
    cycloplegic_drug?: Record<string, unknown> | null; administration_at?: string | null; examination_at?: string | null;
    raw_power?: OphthalmologyEyeResult<OphthalmologyEyeRefraction>; final_power?: OphthalmologyEyeResult<OphthalmologyEyeRefraction>;
    reflex_media?: OphthalmologyEyeResult; observation_codes?: string[] };
  SUBJECTIVE_REFRACTION: { starting_power?: OphthalmologyEyeResult<OphthalmologyEyeRefraction>; final_power?: OphthalmologyEyeResult<OphthalmologyEyeRefraction>;
    bcva?: OphthalmologyEyeResult; duochrome?: OphthalmologyEyeResult; jcc?: OphthalmologyEyeResult; fogging?: boolean;
    acceptance?: string; binocular_balance?: Record<string, unknown>; dominant_eye?: string | null; diplopia?: boolean;
    near_addition?: OphthalmologyEyeResult; working_distance?: { value: number; unit: string }; near_acuity?: OphthalmologyEyeResult;
    usage_requirement_codes?: string[]; impression?: string };
  INTRAOCULAR_PRESSURE: { method?: string; measured_at?: string; position?: string; anesthetic_used?: boolean;
    fluorescein_used?: boolean; drug?: string | null; readings?: OphthalmologyEyeResult<number[]>;
    selected_reading_index?: OphthalmologyEyeResult; final_iop?: OphthalmologyEyeResult<number>; unit?: 'mmHg'; alert_interpretation?: string[] };
  SLIT_LAMP_ANTERIOR_SEGMENT: { eyes?: OphthalmologyEyeResult<Partial<Record<OphthalmologySlitLampStructure, OphthalmologySlitLampFinding>>> };
  POSTERIOR_FUNDUS_EXAM: { dilation_required?: boolean; dilation_confirmation?: boolean | null; contraindication?: string | null;
    dilation_medications?: Array<{ drug: string; dose: string; laterality: string; instilled_at: string; ready_at?: string | null }>;
    method?: string; eyes?: OphthalmologyEyeResult<OphthalmologyFundusEye> };
};

export type SaveOphthalmologyTestResultDraftDTO<T extends OphthalmologyCoreTestFormType = OphthalmologyCoreTestFormType> = {
  expected_task_status: 'IN_PROGRESS' | 'DRAFT';
  expected_task_version: number;
  expected_result_version: number | null;
  form_type: T;
  form_schema_version: string;
  form_profile_version_id: string;
  performed_at: string;
  source_type: OphthalmologyResultSourceType;
  reliability: OphthalmologyResultReliability;
  reliability_reason?: string | null;
  comments?: string | null;
  document_ids?: string[];
  payload: OphthalmologyCoreTestPayloads[T];
};
export type CompleteOphthalmologyTestResultDTO = {
  expected_task_status: 'DRAFT'; expected_task_version: number; expected_result_version: number;
};
export type AmendOphthalmologyTestResultDTO<T extends OphthalmologyCoreTestFormType = OphthalmologyCoreTestFormType> =
  Omit<SaveOphthalmologyTestResultDraftDTO<T>, 'expected_task_status' | 'expected_result_version' | 'source_type'> & {
    expected_task_status: 'COMPLETED'; expected_result_version: number; source_type: 'MANUAL_CORRECTION'; reason: string;
  };

export type OphthalmologyTestResultVersion = {
  clinical_version: number; status: OphthalmologyTestResultStatus; form_type: OphthalmologyCoreTestFormType;
  form_schema_version: string; form_profile_version_id: string; form_profile_revision: number;
  form_profile_snapshot: Record<string, unknown>; laterality: Exclude<OphthalmologyLaterality, 'NOT_SPECIFIED'>;
  station_id: string; device_code: string | null; device_snapshot: { code: string; name: string; calibration_status: OphthalmologyDevice['calibration_status'];
    calibrated_at: Date | null; calibration_due_at: Date | null } | null; performer_user_id: string; performed_at: Date;
  source_type: OphthalmologyResultSourceType; reliability: OphthalmologyResultReliability; reliability_reason: string | null;
  comments: string | null; document_ids: string[]; payload: Record<string, unknown>; supersedes_clinical_version: number | null;
  amendment_reason: string | null; completed_at: Date | null; created_by: string; created_at: Date;
};
export type OphthalmologyTestResult = {
  id: string; task_id: string; context_id: string; visit_id: string; patient_id: string; branch_id: string; department_id: string;
  current_clinical_version: number; status: OphthalmologyTestResultStatus; current: OphthalmologyTestResultVersion;
  history: OphthalmologyTestResultVersion[]; version: number; created_at: Date; updated_at: Date;
};
