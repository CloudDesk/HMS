import { z } from 'zod';
const visitSubtypes = ['NEW_CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'POST_OPERATIVE', 'SCREENING', 'PROCEDURE_REVIEW'];
const contextLaterality = ['OD', 'OS', 'OU', 'NOT_SPECIFIED'];
const configurationTypes = ['SUB_SPECIALITY', 'COMPLAINT', 'TEST_CATALOGUE', 'VISUAL_ACUITY_SCALE', 'DIAGNOSIS_REFERENCE', 'DRUG_OPTION', 'OPTICAL_PRODUCT', 'IOL_CATALOGUE', 'CLINICAL_THRESHOLD', 'GRADE', 'REASON', 'FORM_PROFILE', 'COMPLETION_PROFILE'];
const configurationStatuses = ['DRAFT', 'ACTIVE', 'INACTIVE'];
const objectId = { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } as const;
const nullableText = (maxLength: number) => ({ type: ['string', 'null'], maxLength } as const);
const version = { type: 'integer', minimum: 0 } as const;

export const ophthalmologyVisitParamsSchema = { type: 'object', required: ['visitId'], properties: { visitId: objectId } } as const;
export const ophthalmologyIdParamsSchema = { type: 'object', required: ['id'], properties: { id: objectId } } as const;
export const ophthalmologyVisitAlertParamsSchema = {
  type: 'object', additionalProperties: false, required: ['visitId', 'id'], properties: { visitId: objectId, id: objectId },
} as const;

export const createOphthalmologyContextBodySchema = {
  type: 'object', additionalProperties: false,
  required: ['visit_subtype', 'affected_eye', 'configuration_version_id', 'workflow_profile_version_id'],
  properties: {
    visit_subtype: { type: 'string', enum: visitSubtypes }, affected_eye: { type: 'string', enum: contextLaterality },
    configuration_version_id: objectId, workflow_profile_version_id: objectId,
  },
} as const;
export const updateOphthalmologyContextBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_version'], minProperties: 2,
  properties: {
    expected_version: version, visit_subtype: { type: 'string', enum: visitSubtypes },
    affected_eye: { type: 'string', enum: contextLaterality }, workflow_profile_version_id: objectId,
  },
} as const;

export const ophthalmologyConfigurationListQuerySchema = {
  type: 'object', additionalProperties: false, required: ['branch_id'], properties: {
    branch_id: objectId, type: { type: 'string', enum: configurationTypes }, status: { type: 'string', enum: configurationStatuses },
    code: { type: 'string', maxLength: 80 }, search: { type: 'string', maxLength: 120 },
    page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;
export const createOphthalmologyConfigurationBodySchema = {
  type: 'object', additionalProperties: false, required: ['branch_id', 'type', 'code', 'name'], properties: {
    branch_id: objectId, type: { type: 'string', enum: configurationTypes }, code: { type: 'string', minLength: 1, maxLength: 80 },
    name: { type: 'string', minLength: 1, maxLength: 160 }, description: nullableText(1000),
    effective_from: { type: ['string', 'null'], format: 'date-time' }, values: { type: 'object', additionalProperties: true },
  },
} as const;
export const updateOphthalmologyConfigurationBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_version'], minProperties: 2, properties: {
    expected_version: version, name: { type: 'string', minLength: 1, maxLength: 160 }, description: nullableText(1000),
    effective_from: { type: ['string', 'null'], format: 'date-time' }, values: { type: 'object', additionalProperties: true },
  },
} as const;
export const versionActionBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_version', 'expected_status'], properties: {
    expected_version: version, expected_status: { type: 'string', enum: configurationStatuses }, reason: nullableText(1000),
  },
} as const;

const deviceSchema = {
  type: 'object', additionalProperties: false, required: ['code', 'name'], properties: {
    code: { type: 'string', minLength: 1, maxLength: 80 }, name: { type: 'string', minLength: 1, maxLength: 160 },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    calibration_status: { type: 'string', enum: ['CURRENT', 'DUE', 'EXPIRED', 'NOT_REQUIRED'] },
    calibrated_at: { type: ['string', 'null'], format: 'date-time' }, calibration_due_at: { type: ['string', 'null'], format: 'date-time' },
  },
} as const;
const stationProperties = {
  name: { type: 'string', minLength: 1, maxLength: 160 }, description: nullableText(1000),
  supported_test_types: { type: 'array', maxItems: 100, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 80 } },
  devices: { type: 'array', maxItems: 100, items: deviceSchema },
  member_user_ids: { type: 'array', maxItems: 200, uniqueItems: true, items: objectId },
} as const;
export const ophthalmologyStationListQuerySchema = {
  type: 'object', additionalProperties: false, required: ['branch_id'], properties: {
    branch_id: objectId, status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] }, test_type: { type: 'string', maxLength: 80 },
    search: { type: 'string', maxLength: 120 }, page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;
export const createOphthalmologyStationBodySchema = {
  type: 'object', additionalProperties: false, required: ['branch_id', 'department_id', 'code', 'name'], properties: {
    branch_id: objectId, department_id: objectId, code: { type: 'string', minLength: 1, maxLength: 80 }, ...stationProperties,
  },
} as const;
export const updateOphthalmologyStationBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_version'], minProperties: 2,
  properties: { expected_version: version, ...stationProperties },
} as const;

const workflowStageSchema = {
  type: 'object', additionalProperties: false, required: ['code', 'name', 'mode', 'test_codes', 'bypass_allowed'], properties: {
    code: { type: 'string', minLength: 1, maxLength: 80 }, name: { type: 'string', minLength: 1, maxLength: 160 },
    mode: { type: 'string', enum: ['SEQUENTIAL', 'PARALLEL'] },
    test_codes: { type: 'array', maxItems: 100, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 80 } },
    bypass_allowed: { type: 'boolean' },
  },
} as const;
export const ophthalmologyWorkflowProfileListQuerySchema = {
  type: 'object', additionalProperties: false, required: ['branch_id'], properties: {
    branch_id: objectId, visit_subtype: { type: 'string', enum: visitSubtypes }, status: { type: 'string', enum: configurationStatuses },
    page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;
export const createOphthalmologyWorkflowProfileBodySchema = {
  type: 'object', additionalProperties: false, required: ['branch_id', 'visit_subtype', 'name', 'stages'], properties: {
    branch_id: objectId, visit_subtype: { type: 'string', enum: visitSubtypes }, name: { type: 'string', minLength: 1, maxLength: 160 },
    effective_from: { type: ['string', 'null'], format: 'date-time' }, stages: { type: 'array', minItems: 1, maxItems: 50, items: workflowStageSchema },
  },
} as const;
export const updateOphthalmologyWorkflowProfileBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_version'], minProperties: 2, properties: {
    expected_version: version, name: { type: 'string', minLength: 1, maxLength: 160 },
    effective_from: { type: ['string', 'null'], format: 'date-time' }, stages: { type: 'array', minItems: 1, maxItems: 50, items: workflowStageSchema },
  },
} as const;

const codeArray = { type: 'array', maxItems: 100, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 80 } } as const;
const historyLaterality = { type: 'string', enum: ['OD', 'OS', 'OU', 'NOT_APPLICABLE'] } as const;
const visionCorrectionUseSchema = {
  type: 'object', additionalProperties: false, properties: {
    uses: { type: 'boolean' }, age_months: { type: ['integer', 'null'], minimum: 0, maximum: 1200 },
    wearing_pattern: nullableText(500),
  },
} as const;
export const saveOphthalmologyIntakeDraftBodySchema = {
  type: 'object', additionalProperties: false,
  required: ['expected_version', 'complaint_configuration_version_id', 'emergency_configuration_version_id', 'complaint_codes', 'affected_eye', 'no_significant_ophthalmic_history'],
  properties: {
    expected_version: { type: ['integer', 'null'], minimum: 0 }, complaint_configuration_version_id: objectId,
    emergency_configuration_version_id: objectId, complaint_codes: codeArray,
    affected_eye: { type: 'string', enum: contextLaterality }, duration_value: { type: ['number', 'null'], minimum: 0, maximum: 1000 },
    duration_unit: { type: ['string', 'null'], enum: ['DAY', 'WEEK', 'MONTH', 'YEAR', null] },
    onset: { type: ['string', 'null'], enum: ['SUDDEN', 'GRADUAL', 'UNKNOWN', null] },
    progression: { type: ['string', 'null'], enum: ['IMPROVING', 'STABLE', 'WORSENING', 'INTERMITTENT', null] },
    severity: { type: ['string', 'null'], enum: ['MILD', 'MODERATE', 'SEVERE', null] }, associated_symptom_codes: codeArray,
    description: nullableText(4000), no_significant_ophthalmic_history: { type: 'boolean' }, previous_eye_disease_codes: codeArray,
    previous_eye_surgeries: { type: 'array', maxItems: 50, items: { type: 'object', additionalProperties: false,
      required: ['procedure', 'laterality', 'date'], properties: { procedure: { type: 'string', minLength: 1, maxLength: 250 },
        laterality: historyLaterality, date: { type: 'string', format: 'date-time' } } } },
    current_eye_treatments: { type: 'array', maxItems: 50, items: { type: 'object', additionalProperties: false,
      required: ['type', 'details'], properties: { type: { type: 'string', minLength: 1, maxLength: 120 }, details: { type: 'string', minLength: 1, maxLength: 1000 } } } },
    previous_eye_injury_or_laser: { type: 'array', maxItems: 50, items: { type: 'object', additionalProperties: false,
      required: ['type', 'laterality', 'details'], properties: { type: { type: 'string', enum: ['INJURY', 'LASER'] }, laterality: historyLaterality,
        date: { type: ['string', 'null'], format: 'date-time' }, details: { type: 'string', minLength: 1, maxLength: 1000 } } } },
    spectacle_use: visionCorrectionUseSchema, contact_lens_use: visionCorrectionUseSchema,
    long_term_steroid_use: { type: 'boolean' }, long_term_steroid_details: nullableText(1000), family_history_codes: codeArray,
    previous_report_document_ids: { type: 'array', maxItems: 100, uniqueItems: true, items: objectId },
    shared_medical_history_reviewed: { type: 'boolean' }, shared_allergy_reviewed: { type: 'boolean' },
    emergency_criterion_codes: codeArray, other_urgent_condition_detail: nullableText(2000),
  },
} as const;
export const completeOphthalmologyIntakeBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_version', 'expected_status', 'expected_context_version'],
  properties: { expected_version: version, expected_status: { const: 'DRAFT' }, expected_context_version: version },
} as const;
export const clearEmergencyAlertSchema = z
  .object({
    disposition: z.enum(['RESUME_ROUTINE_OPD', 'ADMIT_TO_INPATIENT', 'TRANSFER_EXTERNAL']),
    clearance_rationale: z.string().trim().min(1, 'Clearance rationale is required').optional(),
    clearanceRationale: z.string().trim().min(1, 'Clearance rationale is required').optional(),
    resumption_permitted: z.boolean().optional(),
    resumptionPermitted: z.boolean().optional(),
    expected_version: z.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    const rationale = data.clearance_rationale ?? data.clearanceRationale;
    if (!rationale || !rationale.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Clearance rationale is required',
        path: ['clearance_rationale'],
      });
    }
    const permitted = data.resumption_permitted ?? data.resumptionPermitted;
    if (typeof permitted !== 'boolean') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'resumption_permitted is required',
        path: ['resumption_permitted'],
      });
    }
  });

export const clearOphthalmologyEmergencyAlertBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['disposition'],
  properties: {
    disposition: {
      type: 'string',
      enum: ['RESUME_ROUTINE_OPD', 'ADMIT_TO_INPATIENT', 'TRANSFER_EXTERNAL'],
    },
    clearance_rationale: { type: 'string', minLength: 1, maxLength: 5000 },
    clearanceRationale: { type: 'string', minLength: 1, maxLength: 5000 },
    resumption_permitted: { type: 'boolean' },
    resumptionPermitted: { type: 'boolean' },
    expected_version: version,
  },
} as const;

export const acknowledgeOphthalmologyAlertBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_version', 'expected_status'],
  properties: { expected_version: version, expected_status: { const: 'ACTIVE' }, note: nullableText(2000) },
} as const;
export const routeOphthalmologyEmergencyBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_version', 'expected_status'],
  properties: { expected_version: version, expected_status: { const: 'ACTIVE' } },
} as const;

const taskStatuses = ['ORDERED', 'PATIENT_WAITING', 'PATIENT_CALLED', 'IN_PROGRESS', 'DRAFT', 'COMPLETED',
  'SUBMITTED_FOR_REVIEW', 'REVIEWED', 'REPEAT_REQUIRED', 'UNABLE_TO_PERFORM', 'CANCELLED'] as const;
const taskPriorities = ['ROUTINE', 'PRIORITY', 'EMERGENCY'] as const;
const taskExpected = {
  expected_version: version,
  expected_status: { type: 'string', enum: taskStatuses },
} as const;
export const ophthalmologyTestTaskHeadersSchema = {
  type: 'object', required: ['idempotency-key'], properties: {
    'idempotency-key': { type: 'string', minLength: 8, maxLength: 120, pattern: '^[A-Za-z0-9._:-]+$' },
  },
} as const;
export const ophthalmologyTestTaskListQuerySchema = {
  type: 'object', additionalProperties: false, properties: {
    branch_id: objectId, station_id: objectId, assigned_user_id: objectId, status: { type: 'string', enum: taskStatuses },
    test_code: { type: 'string', maxLength: 80 }, priority: { type: 'string', enum: taskPriorities },
    source_type: { type: 'string', enum: ['WORKFLOW', 'CLINICAL_ORDER_ITEM'] }, visit_id: objectId, patient_id: objectId,
    search: { type: 'string', maxLength: 120 }, sort: { type: 'string', enum: ['assigned_at', 'waiting_since', 'priority', 'updated_at'] },
    direction: { type: 'string', enum: ['asc', 'desc'] }, page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;
export const createOphthalmologyTestTaskBodySchema = {
  type: 'object', additionalProperties: false,
  required: ['expected_context_version', 'test_catalogue_version_id', 'test_code', 'laterality', 'priority', 'source_type'],
  properties: {
    expected_context_version: version, test_catalogue_version_id: objectId,
    test_code: { type: 'string', minLength: 1, maxLength: 80 }, workflow_stage_code: nullableText(80),
    laterality: { type: 'string', enum: ['OD', 'OS', 'OU', 'NOT_APPLICABLE'] }, priority: { type: 'string', enum: taskPriorities },
    special_instructions: nullableText(2000), source_type: { type: 'string', enum: ['WORKFLOW', 'CLINICAL_ORDER_ITEM'] },
    source_order_id: { ...objectId, type: ['string', 'null'] }, source_order_item_id: { ...objectId, type: ['string', 'null'] },
  },
} as const;
export const assignOphthalmologyTestTaskBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_status', 'expected_version', 'station_id'], properties: {
    expected_status: { const: 'ORDERED' }, expected_version: version, station_id: objectId,
    assigned_user_id: { ...objectId, type: ['string', 'null'] },
  },
} as const;
export const reassignOphthalmologyTestTaskBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_status', 'expected_version', 'station_id', 'reason'], properties: {
    expected_status: { type: 'string', enum: ['PATIENT_WAITING', 'PATIENT_CALLED', 'DRAFT'] }, expected_version: version,
    station_id: objectId, assigned_user_id: { ...objectId, type: ['string', 'null'] }, reason: { type: 'string', minLength: 1, maxLength: 1000 },
  },
} as const;
const stateActionSchema = (statuses: readonly string[]) => ({
  type: 'object', additionalProperties: false, required: ['expected_status', 'expected_version'],
  properties: { expected_status: { type: 'string', enum: statuses }, expected_version: version },
} as const);
export const submitOphthalmologyTestTaskBodySchema = stateActionSchema(['COMPLETED']);
export const callOphthalmologyTestTaskBodySchema = stateActionSchema(['PATIENT_WAITING']);
export const patientUnavailableOphthalmologyTestTaskBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_status', 'expected_version', 'reason'],
  properties: { expected_status: { const: 'PATIENT_CALLED' }, expected_version: version, reason: { type: 'string', minLength: 1, maxLength: 1000 } },
} as const;
export const startOphthalmologyTestTaskBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_status', 'expected_version'], properties: {
    expected_status: { const: 'PATIENT_CALLED' }, expected_version: version, device_code: nullableText(80),
  },
} as const;
export const unableOphthalmologyTestTaskBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_status', 'expected_version', 'reason'], properties: {
    expected_status: { type: 'string', enum: ['IN_PROGRESS', 'DRAFT'] }, expected_version: version,
    reason: { type: 'string', minLength: 1, maxLength: 1000 },
  },
} as const;
export const cancelOphthalmologyTestTaskBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_status', 'expected_version', 'reason'], properties: {
    expected_status: { type: 'string', enum: ['ORDERED', 'PATIENT_WAITING', 'PATIENT_CALLED', 'DRAFT'] }, expected_version: version,
    reason: { type: 'string', minLength: 1, maxLength: 1000 },
  },
} as const;
export const repeatOphthalmologyTestTaskBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_status', 'expected_version', 'station_id', 'reason'], properties: {
    expected_status: { type: 'string', enum: ['COMPLETED', 'SUBMITTED_FOR_REVIEW'] }, expected_version: version, station_id: objectId,
    assigned_user_id: { ...objectId, type: ['string', 'null'] }, reason: { type: 'string', minLength: 1, maxLength: 1000 },
  },
} as const;
export const routeOphthalmologyTestTaskBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_status', 'expected_version', 'target'], properties: {
    ...taskExpected, expected_status: { type: 'string', enum: ['COMPLETED', 'REVIEWED', 'UNABLE_TO_PERFORM'] },
    target: { type: 'string', enum: ['NEXT_STATION', 'OPHTHALMOLOGIST'] }, next_task_id: { ...objectId, type: ['string', 'null'] },
    station_id: { ...objectId, type: ['string', 'null'] }, assigned_user_id: { ...objectId, type: ['string', 'null'] },
    reason: nullableText(1000),
  },
} as const;

const testFormTypes = ['VISUAL_ACUITY', 'LENSOMETRY', 'AUTOREFRACTION_KERATOMETRY', 'OBJECTIVE_REFRACTION',
  'SUBJECTIVE_REFRACTION', 'INTRAOCULAR_PRESSURE', 'SLIT_LAMP_ANTERIOR_SEGMENT', 'POSTERIOR_FUNDUS_EXAM', 'PACHYMETRY',
  'COLOUR_VISION', 'MOTILITY_SQUINT_BINOCULAR', 'DRY_EYE', 'VISUAL_FIELD', 'OCT', 'FUNDUS_PHOTOGRAPHY',
  'CORNEAL_TOPOGRAPHY', 'BIOMETRY_IOL', 'B_SCAN', 'GONIOSCOPY', 'CONTACT_LENS', 'PAEDIATRIC_VISION'] as const;
const resultWriteProperties = {
  expected_task_version: version, expected_result_version: { type: ['integer', 'null'], minimum: 0 },
  form_type: { type: 'string', enum: testFormTypes }, form_schema_version: { type: 'string', minLength: 1, maxLength: 40 },
  form_profile_version_id: objectId, performed_at: { type: 'string', format: 'date-time' },
  source_type: { type: 'string', enum: ['MANUAL', 'DEVICE_IMPORT', 'MANUAL_CORRECTION'] },
  reliability: { type: 'string', enum: ['GOOD', 'FAIR', 'POOR'] }, reliability_reason: nullableText(1000), comments: nullableText(4000),
  document_ids: { type: 'array', maxItems: 50, uniqueItems: true, items: objectId },
  payload: { type: 'object', maxProperties: 80 },
} as const;
const resultWriteRequired = ['expected_task_status', 'expected_task_version', 'expected_result_version', 'form_type', 'form_schema_version',
  'form_profile_version_id', 'performed_at', 'source_type', 'reliability', 'payload'] as const;
export const saveOphthalmologyTestResultDraftBodySchema = {
  type: 'object', additionalProperties: false, required: resultWriteRequired,
  properties: { ...resultWriteProperties, expected_task_status: { type: 'string', enum: ['IN_PROGRESS', 'DRAFT'] } },
} as const;
export const completeOphthalmologyTestResultBodySchema = {
  type: 'object', additionalProperties: false,
  required: ['expected_task_status', 'expected_task_version', 'expected_result_version'],
  properties: { expected_task_status: { const: 'DRAFT' }, expected_task_version: version, expected_result_version: version },
} as const;
export const amendOphthalmologyTestResultBodySchema = {
  type: 'object', additionalProperties: false, required: [...resultWriteRequired, 'reason'],
  properties: { ...resultWriteProperties, expected_result_version: version, expected_task_status: { const: 'COMPLETED' },
    source_type: { const: 'MANUAL_CORRECTION' }, reason: { type: 'string', minLength: 1, maxLength: 1000 } },
} as const;

const reviewReference = { ...objectId, type: ['string', 'null'] } as const;
const treatmentPlanSchema = {
  type: 'object', additionalProperties: false,
  required: ['diagnosis_code', 'diagnosis_laterality', 'treatment', 'category', 'priority', 'status'],
  properties: {
    diagnosis_code: { type: 'string', minLength: 1, maxLength: 80 },
    diagnosis_laterality: { type: 'string', enum: ['OD', 'OS', 'OU', 'NOT_APPLICABLE'] },
    treatment: { type: 'string', minLength: 1, maxLength: 4000 }, category: { type: 'string', minLength: 1, maxLength: 80 },
    priority: { type: 'string', enum: ['ROUTINE', 'URGENT', 'EMERGENCY'] },
    status: { type: 'string', enum: ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] },
    medication_prescription_id: reviewReference,
    clinical_order_ids: { type: 'array', maxItems: 50, uniqueItems: true, items: objectId },
    procedure_recommendation_id: reviewReference, referral_id: reviewReference, follow_up_id: reviewReference,
  },
} as const;
export const saveOphthalmologyClinicalReviewDraftBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_version', 'clinical_summary', 'treatment_plans'],
  properties: { expected_version: version, clinical_summary: { type: 'string', minLength: 1, maxLength: 10000 },
    treatment_plans: { type: 'array', maxItems: 100, items: treatmentPlanSchema },
    follow_up_decision: { type: ['string', 'null'], enum: ['FOLLOW_UP_RECORDED', 'NO_FOLLOW_UP', null] },
    patient_instructions: nullableText(4000) },
} as const;

const opticalPowerSchema = {
  type: 'object', additionalProperties: false, required: ['sphere'], properties: {
    sphere: { type: 'number', minimum: -40, maximum: 40 }, cylinder: { type: ['number', 'null'], minimum: -20, maximum: 20 },
    axis: { type: ['number', 'null'], minimum: 0, maximum: 180 }, addition: { type: ['number', 'null'], minimum: 0, maximum: 10 },
    prism: { type: ['number', 'null'], minimum: 0, maximum: 30 }, prism_base: nullableText(40),
  },
} as const;
export const saveOphthalmologyOpticalPrescriptionDraftBodySchema = {
  type: 'object', additionalProperties: false,
  required: ['expected_version', 'prescription_type', 'power', 'pupillary_distance', 'lens_type', 'material', 'coating_codes',
    'usage_instructions', 'valid_until'],
  properties: {
    expected_version: version, prescription_type: { type: 'string', enum: ['DISTANCE', 'NEAR', 'BIFOCAL', 'PROGRESSIVE', 'OCCUPATIONAL'] },
    power: { type: 'object', additionalProperties: false, minProperties: 1,
      properties: { OD: { anyOf: [opticalPowerSchema, { type: 'null' }] }, OS: { anyOf: [opticalPowerSchema, { type: 'null' }] } } },
    pupillary_distance: { type: 'object', additionalProperties: false, required: ['format'], properties: {
      format: { type: 'string', enum: ['BINOCULAR', 'MONOCULAR'] }, binocular: { type: ['number', 'null'], minimum: 30, maximum: 90 },
      OD: { type: ['number', 'null'], minimum: 15, maximum: 50 }, OS: { type: ['number', 'null'], minimum: 15, maximum: 50 },
    } },
    segment_height: { anyOf: [{ type: 'object', additionalProperties: false, properties: {
      OD: { type: ['number', 'null'], minimum: 5, maximum: 50 }, OS: { type: ['number', 'null'], minimum: 5, maximum: 50 },
    } }, { type: 'null' }] },
    lens_type: { type: 'string', minLength: 1, maxLength: 80 }, material: { type: 'string', minLength: 1, maxLength: 80 },
    coating_codes: { type: 'array', maxItems: 20, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 80 } },
    usage_instructions: { type: 'string', minLength: 1, maxLength: 2000 }, valid_until: { type: 'string', format: 'date-time' },
    review_date: { type: ['string', 'null'], format: 'date-time' },
  },
} as const;
export const approveOphthalmologyOpticalPrescriptionBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_version', 'expected_status'],
  properties: { expected_version: version, expected_status: { const: 'DRAFT' } },
} as const;

const completionRequirementCodes = ['INTAKE_COMPLETED', 'MANDATORY_TESTS_REVIEWED', 'ALL_RESULTS_RESOLVED', 'ALERTS_ACKNOWLEDGED',
  'DIAGNOSIS_RECORDED', 'CLINICAL_REVIEW_RECORDED', 'TREATMENT_PLAN_RECORDED', 'OPTICAL_APPROVED_IF_PRESENT',
  'FOLLOW_UP_DECISION_RECORDED'] as const;
export const reviewOphthalmologyTestResultBodySchema = {
  type: 'object', additionalProperties: false,
  required: ['expected_task_version', 'expected_result_version', 'expected_clinical_version'],
  properties: { expected_task_version: version, expected_result_version: version, expected_clinical_version: { type: 'integer', minimum: 1 },
    comment: nullableText(2000) },
} as const;
export const deferOphthalmologyResultBodySchema = {
  type: 'object', additionalProperties: false,
  required: ['expected_version', 'source_type', 'source_id', 'reason', 'responsible_doctor_id'],
  properties: { expected_version: version, source_type: { type: 'string', enum: ['TEST_TASK', 'CLINICAL_ORDER'] }, source_id: objectId,
    reason: { type: 'string', minLength: 1, maxLength: 1000 }, review_plan: nullableText(2000),
    due_at: { type: ['string', 'null'], format: 'date-time' }, responsible_doctor_id: objectId },
} as const;
export const overrideOphthalmologyCompletionBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_version', 'expected_unmet_codes', 'reason'],
  properties: { expected_version: version, expected_unmet_codes: { type: 'array', minItems: 1, uniqueItems: true,
    items: { type: 'string', enum: completionRequirementCodes } }, reason: { type: 'string', minLength: 1, maxLength: 2000 } },
} as const;
export const completeOphthalmologyConsultationBodySchema = {
  type: 'object', additionalProperties: false,
  required: ['expected_version', 'expected_context_version', 'expected_consultation_version', 'expected_clinical_review_version'],
  properties: { expected_version: version, expected_context_version: version, expected_consultation_version: version,
    expected_clinical_review_version: version, expected_optical_prescription_version: { type: ['integer', 'null'], minimum: 0 } },
} as const;
export const reopenOphthalmologyConsultationBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_version', 'expected_status', 'reason'],
  properties: { expected_version: version, expected_status: { const: 'COMPLETED' }, reason: { type: 'string', minLength: 1, maxLength: 2000 } },
} as const;
export const amendOphthalmologyConsultationBodySchema = {
  type: 'object', additionalProperties: false,
  required: ['expected_version', 'expected_status', 'episode_id', 'section', 'before_value', 'after_value', 'reason'],
  properties: { expected_version: version, expected_status: { const: 'AMENDMENT_OPEN' }, episode_id: objectId,
    section: { type: 'string', minLength: 1, maxLength: 120 }, before_value: {}, after_value: {},
    reason: { type: 'string', minLength: 1, maxLength: 2000 } },
} as const;

export const ophthalmologyAssignmentLookupQuerySchema = { type: 'object', additionalProperties: false, properties: {
  target_task_id: objectId, station_id: objectId, search: { type: 'string', maxLength: 120 },
  page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
} } as const;
export const ophthalmologyTaskStationParamsSchema = { type: 'object', additionalProperties: false, required: ['id', 'stationId'], properties: { id: objectId, stationId: objectId } } as const;

export const ophthalmologyTaskClinicalConfigurationQuerySchema = { type: 'object', additionalProperties: false, required: ['type'], properties: { type: { type: 'string', enum: ['FORM_PROFILE', 'OPTICAL_PRODUCT', 'DRUG_OPTION'] }, page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 } } } as const;

export const escalateOphthalmologyEmergencyBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reason'],
  properties: {
    reason: { type: 'string', minLength: 1, maxLength: 2000 },
    trigger_findings: { type: 'array', items: { type: 'string', maxLength: 200 }, maxItems: 20 },
    urgency: { type: 'string', enum: ['ROUTINE', 'URGENT', 'EMERGENCY'] },
  },
} as const;
