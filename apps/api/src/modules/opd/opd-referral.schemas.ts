export const referralVisitParamsSchema = {
  type: 'object', required: ['visitId'], properties: { visitId: { type: 'string', minLength: 1 } },
} as const;

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
