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
    blood_pressure_systolic: { type: ['number', 'null'], minimum: 50, maximum: 260 },
    blood_pressure_diastolic: { type: ['number', 'null'], minimum: 30, maximum: 160 },
    weight_kg: { type: ['number', 'null'], minimum: 1, maximum: 350 },
    height_cm: { type: ['number', 'null'], minimum: 30, maximum: 250 },
    temperature_c: { type: ['number', 'null'], minimum: 30, maximum: 45 },
    pulse_bpm: { type: ['number', 'null'], minimum: 20, maximum: 240 },
    respiratory_rate_per_min: { type: ['number', 'null'], minimum: 5, maximum: 80 },
    oxygen_saturation_percent: { type: ['number', 'null'], minimum: 50, maximum: 100 },
    notes: { type: ['string', 'null'] },
  },
} as const;
