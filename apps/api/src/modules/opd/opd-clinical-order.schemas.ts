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
  required: ['priority', 'items'],
  properties: {
    priority: { type: 'string', enum: ['ROUTINE', 'URGENT', 'STAT'] },
    destination: nullableText(200),
    specimen_type: nullableText(100),
    items: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['investigation_name', 'category'],
        properties: {
          investigation_name: { type: 'string', minLength: 1, maxLength: 200 },
          category: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
    },
    clinical_notes: nullableText(2000),
    instructions: nullableText(2000),
  },
} as const;
