export const opdConsultationVisitParamsSchema = {
  type: 'object',
  required: ['visitId'],
  properties: {
    visitId: { type: 'string', minLength: 1 },
  },
} as const;

export const opdStructuredDiagnosisSchema = {
  type: 'object',
  required: ['code', 'display'],
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1 },
    display: { type: 'string', minLength: 1 },
    codingSystem: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: ['PRIMARY', 'SECONDARY'] },
    laterality: { type: ['string', 'null'], enum: ['OD', 'OS', 'OU', 'NOT_APPLICABLE', null] },
    status: { type: ['string', 'null'], enum: ['SUSPECTED', 'CONFIRMED', 'RULED_OUT', null] },
    severity: { type: ['string', 'null'], maxLength: 120 },
    stage: { type: ['string', 'null'], maxLength: 120 },
    differential: { type: 'boolean' },
    notes: { type: ['string', 'null'] },
  },
} as const;

export const saveOpdConsultationBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    expected_version: { type: 'integer', minimum: 0 },
    expected_status: { type: 'string', enum: ['DRAFT', 'COMPLETED'] },
    chief_complaint: { type: ['string', 'null'] },
    history_present_illness: { type: ['string', 'null'] },
    past_history: { type: ['string', 'null'] },
    family_history: { type: ['string', 'null'] },
    allergies: { type: ['string', 'null'] },
    physical_examination: { type: ['string', 'null'] },
    assessment: { type: ['string', 'null'] },
    diagnoses: {
      type: 'array',
      items: opdStructuredDiagnosisSchema,
    },
    treatment_plan: { type: ['string', 'null'] },
    doctor_notes: { type: ['string', 'null'] },
  },
} as const;

