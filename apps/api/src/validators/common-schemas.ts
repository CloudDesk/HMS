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
      required: ['status', 'database', 'user'],
      properties: {
        status: { type: 'string' },
        database: { type: 'string' },
        user: { type: 'string' },
      },
    },
  },
} as const;
