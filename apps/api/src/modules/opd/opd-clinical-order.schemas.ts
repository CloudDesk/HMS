const nullableText = (maxLength: number) => ({ type: ['string', 'null'], maxLength } as const);

export const clinicalOrderParamsSchema = {
  type: 'object',
  required: ['visitId', 'orderType'],
  properties: {
    visitId: { type: 'string', minLength: 1 },
    orderType: { type: 'string', enum: ['LABORATORY', 'IMAGING'] },
  },
} as const;

export const saveClinicalOrderBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    priority: { type: ['string', 'null'], enum: ['ROUTINE', 'URGENT', 'STAT', 'EMERGENCY', null] },
    destination: nullableText(200),
    specimen_type: nullableText(100),
    items: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          service_id: { type: ['string', 'null'] },
          investigation_name: { type: ['string', 'null'], maxLength: 200 },
          category: { type: ['string', 'null'], maxLength: 100 },
        },
      },
    },
    clinical_notes: nullableText(2000),
    instructions: nullableText(2000),
  },
} as const;
