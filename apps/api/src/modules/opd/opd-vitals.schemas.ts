export const opdVitalsVisitParamsSchema = {
  type: 'object',
  required: ['visitId'],
  properties: {
    visitId: { type: 'string', minLength: 1 },
  },
} as const;

export const listOpdVitalsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    sortBy: {
      type: 'string',
      enum: ['recorded_at', 'created_at', 'updated_at'],
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
} as const;

export const createOpdVitalsBodySchema = {
  type: 'object',
  required: [],
  additionalProperties: false,
  properties: {
    blood_pressure_systolic: {
      anyOf: [{ type: 'number', minimum: 50, maximum: 260 }, { type: 'null' }],
    },
    blood_pressure_diastolic: {
      anyOf: [{ type: 'number', minimum: 30, maximum: 160 }, { type: 'null' }],
    },
    weight_kg: {
      anyOf: [{ type: 'number', minimum: 1, maximum: 350 }, { type: 'null' }],
    },
    height_cm: {
      anyOf: [{ type: 'number', minimum: 30, maximum: 250 }, { type: 'null' }],
    },
    temperature_c: {
      anyOf: [{ type: 'number', minimum: 30, maximum: 45 }, { type: 'null' }],
    },
    pulse_bpm: {
      anyOf: [{ type: 'number', minimum: 20, maximum: 240 }, { type: 'null' }],
    },
    respiratory_rate_per_min: {
      anyOf: [{ type: 'number', minimum: 5, maximum: 80 }, { type: 'null' }],
    },
    oxygen_saturation_percent: {
      anyOf: [{ type: 'number', minimum: 50, maximum: 100 }, { type: 'null' }],
    },
    notes: { type: ['string', 'null'] },
  },
} as const;
