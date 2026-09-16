import { z } from 'zod';

export const dentalImagingDraftSchema = z.object({
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']),
  expected_updated_at: z.iso.datetime().nullable().optional(),
  destination: z.string().max(200).nullable().optional(),
  specimen_type: z.string().max(100).nullable().optional(),
  clinical_notes: z.string().max(2000).nullable().optional(),
  instructions: z.string().max(2000).nullable().optional(),
  items: z.array(z.object({
    service_id: z.string().regex(/^[a-f\d]{24}$/i),
    investigation_name: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(100),
    tooth_number: z.number().int().nullable().optional(),
  }).strict()).max(50),
}).strict();

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
    expected_updated_at: { type: ['string', 'null'], format: 'date-time' },
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
          tooth_number: { type: ['integer', 'null'] },
        },
      },
    },
    clinical_notes: nullableText(2000),
    instructions: nullableText(2000),
  },
} as const;
