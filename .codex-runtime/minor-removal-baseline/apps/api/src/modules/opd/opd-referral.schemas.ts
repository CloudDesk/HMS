export const referralVisitParamsSchema = {
  type: 'object', required: ['visitId'], properties: { visitId: { type: 'string', minLength: 1 } },
} as const;
export const referralIdParamsSchema = { type: 'object', required: ['referralId'], properties: { referralId: { type: 'string', minLength: 1 } } } as const;
export const listSubmittedReferralsSchema = { type: 'object', additionalProperties: false, properties: {
  booked: { type: 'boolean' }, page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 },
} } as const;
export const bookReferralBodySchema = { type: 'object', additionalProperties: false,
  required: ['appointment_date', 'start_time', 'duration_minutes', 'visit_type'], properties: {
    appointment_date: { type: 'string', minLength: 10, maxLength: 10 }, start_time: { type: 'string', minLength: 5, maxLength: 5 },
    duration_minutes: { type: 'integer', minimum: 5, maximum: 240 },
    visit_type: { type: 'string', enum: ['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE'] },
    priority: { type: 'string', enum: ['ROUTINE', 'URGENT', 'EMERGENCY'] }, notes: { type: ['string', 'null'], maxLength: 1000 },
  } } as const;

export const saveReferralBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    referral_type: { type: ['string', 'null'], enum: ['INTERNAL', 'EXTERNAL', 'EMERGENCY', null] },
    specialty: { type: ['string', 'null'], maxLength: 200 },
    priority: { type: 'string', enum: ['ROUTINE', 'URGENT', 'EMERGENCY'] },
    facility: { type: ['string', 'null'], maxLength: 300 },
    referred_doctor_id: { type: ['string', 'null'] },
    referred_doctor_name: { type: ['string', 'null'], maxLength: 200 },
    reason: { type: ['string', 'null'], maxLength: 2000 },
    clinical_summary: { type: ['string', 'null'], maxLength: 4000 },
    appointment_date: { type: ['string', 'null'], maxLength: 10 },
    appointment_start_time: { type: ['string', 'null'], maxLength: 5 },
    appointment_duration_minutes: { type: ['integer', 'null'], minimum: 5, maximum: 240 },
  },
} as const;
