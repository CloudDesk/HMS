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
