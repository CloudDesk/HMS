const advanceSourceTypeEnum = ['ADMISSION_REQUEST', 'PROCEDURE_BOOKING'] as const;

export const syncAdvancePaymentSchema = {
  type: 'object',
  required: ['patient_id', 'source_type', 'source_id', 'branch_id', 'required_amount', 'requirement_status'],
  additionalProperties: false,
  properties: {
    patient_id: { type: 'string' },
    source_type: { type: 'string', enum: advanceSourceTypeEnum },
    source_id: { type: 'string' },
    branch_id: { type: 'string' },
    required_amount: { type: 'number', minimum: 0 },
    requirement_status: { type: 'string', enum: ['NOT_REQUIRED', 'REQUIRED'] },
  },
} as const;

export const getAdvancePaymentQuerySchema = {
  type: 'object',
  required: ['source_type', 'source_id'],
  additionalProperties: false,
  properties: {
    source_type: { type: 'string', enum: advanceSourceTypeEnum },
    source_id: { type: 'string' },
  },
} as const;

export const advancePaymentRecordSchema = {
  type: 'object',
  required: [
    'id',
    'patient_id',
    'source_type',
    'source_id',
    'branch_id',
    'required_amount',
    'paid_amount',
    'balance_amount',
    'requirement_status',
    'payment_status',
  ],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    patient_id: { type: 'string' },
    source_type: { type: 'string', enum: advanceSourceTypeEnum },
    source_id: { type: 'string' },
    branch_id: { type: 'string' },
    required_amount: { type: 'number' },
    paid_amount: { type: 'number' },
    balance_amount: { type: 'number' },
    requirement_status: { type: 'string', enum: ['NOT_REQUIRED', 'REQUIRED'] },
    payment_status: { type: 'string', enum: ['PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] },
    created_by: { type: ['string', 'null'] },
    updated_by: { type: ['string', 'null'] },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
} as const;

