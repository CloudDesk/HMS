export const healthResponseSchema = {
  type: 'object',
  required: ['data'],
  properties: {
    data: {
      type: 'object',
      required: ['status', 'service', 'environment'],
      properties: {
        status: { type: 'string' },
        service: { type: 'string' },
        environment: { type: 'string' },
      },
    },
  },
} as const;

export const databaseHealthResponseSchema = {
  type: 'object',
  required: ['data'],
  properties: {
    data: {
      type: 'object',
      required: ['status', 'database'],
      properties: {
        status: { type: 'string' },
        database: { type: 'string' },
      },
    },
  },
} as const;

export const apiResponseSchema = <TDataSchema>(dataSchema: TDataSchema) => ({
  type: 'object',
  required: ['data'],
  additionalProperties: false,
  properties: {
    data: dataSchema,
  },
} as const);
