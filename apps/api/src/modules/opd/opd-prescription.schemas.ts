const nullableText = (maxLength: number) => ({ type: ['string', 'null'], maxLength } as const);

export const opdPrescriptionVisitParamsSchema = {
  type: 'object',
  required: ['visitId'],
  properties: {
    visitId: { type: 'string', minLength: 1 },
  },
} as const;

export const saveOpdPrescriptionBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['medicine_name', 'dosage', 'route', 'frequency', 'duration'],
        properties: {
          medicine_name: { type: 'string', minLength: 1, maxLength: 200 },
          strength: nullableText(100),
          dosage: { type: 'string', minLength: 1, maxLength: 100 },
          route: { type: 'string', minLength: 1, maxLength: 100 },
          frequency: { type: 'string', minLength: 1, maxLength: 100 },
          duration: { type: 'string', minLength: 1, maxLength: 100 },
          quantity: { type: ['number', 'null'], minimum: 1, maximum: 100000 },
          instructions: nullableText(500),
        },
      },
    },
    follow_up_date: { type: ['string', 'null'], maxLength: 30 },
    doctor_instructions: nullableText(2000),
    patient_instructions: nullableText(2000),
  },
} as const;
