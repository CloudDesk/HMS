export const followUpVisitParamsSchema = {
  type: 'object', required: ['visitId'], properties: { visitId: { type: 'string', minLength: 1 } },
} as const;

export const saveFollowUpBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    follow_up_type: { type: ['string', 'null'], enum: ['CLINICAL_REVIEW', 'MEDICATION_REVIEW', 'LAB_REVIEW', 'IMAGING_REVIEW', 'REFERRAL_REVIEW', null] },
    next_visit_date: { type: ['string', 'null'], maxLength: 10 },
    start_time: { type: ['string', 'null'], maxLength: 5 },
    utc_datetime: { type: ['string', 'null'], format: 'date-time' },
    duration_minutes: { type: ['integer', 'null'], minimum: 5, maximum: 240 },
    assigned_doctor_id: { type: ['string', 'null'] },
    reason: { type: ['string', 'null'], maxLength: 1000 },
    reminder_type: { type: 'string', enum: ['SMS', 'EMAIL', 'NONE'] },
    notes: { type: ['string', 'null'], maxLength: 2000 },
  },
} as const;

const objectId = { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } as const;
export const followUpComplianceQuerySchema = {
  type: 'object', additionalProperties: false, required: ['branch_id'], properties: {
    branch_id: objectId, department_id: objectId, date_from: { type: 'string', format: 'date-time' },
    date_to: { type: 'string', format: 'date-time' }, page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
} as const;
