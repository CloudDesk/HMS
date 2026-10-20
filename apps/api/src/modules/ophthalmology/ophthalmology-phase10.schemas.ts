const objectId = { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } as const;
const reportTypes = ['STATION_QUEUE', 'TEST_TURNAROUND', 'PENDING_REVIEW', 'REPEAT_UNABLE', 'CLINICAL_VOLUME', 'DIAGNOSTIC_UTILIZATION'] as const;

export const ophthalmologyPublicationBodySchema = {
  type: 'object', additionalProperties: false, required: ['source_type', 'source_id', 'source_version'],
  properties: { source_type: { type: 'string', enum: ['CONSULTATION_SUMMARY', 'OPTICAL_PRESCRIPTION', 'TEST_RESULT'] },
    source_id: objectId, source_version: { type: 'integer', minimum: 1 } },
} as const;
export const ophthalmologyPublicationHeadersSchema = {
  type: 'object', required: ['idempotency-key'], properties: { 'idempotency-key': { type: 'string', minLength: 8, maxLength: 200 } },
} as const;
export const withdrawOphthalmologyPublicationBodySchema = {
  type: 'object', additionalProperties: false, required: ['expected_version', 'expected_status', 'reason'],
  properties: { expected_version: { type: 'integer', minimum: 0 }, expected_status: { const: 'APPROVED_FOR_PORTAL' },
    reason: { type: 'string', minLength: 1, maxLength: 2000 } },
} as const;
export const ophthalmologyReportParamsSchema = {
  type: 'object', additionalProperties: false, required: ['reportType'], properties: { reportType: { type: 'string', enum: reportTypes } },
} as const;
export const ophthalmologyReportQuerySchema = {
  type: 'object', additionalProperties: false, required: ['branch_id'], properties: { branch_id: objectId, station_id: objectId, volume_basis: { type: 'string', enum: ['VISITS', 'ORDERED_ENCOUNTERS'] },
    date_from: { type: 'string', format: 'date-time' }, date_to: { type: 'string', format: 'date-time' },
    page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
} as const;
export const ophthalmologyDashboardQuerySchema = {
  type: 'object', additionalProperties: false, required: ['branch_id'], properties: { branch_id: objectId },
} as const;
export const ophthalmologyAttachmentListQuerySchema = {
  type: 'object', additionalProperties: false, required: ['branch_id'], properties: { branch_id: objectId,
    task_id: objectId, result_id: objectId, visit_id: objectId,
    page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
} as const;

export const ophthalmologyPublicationListQuerySchema = {
  type: 'object', additionalProperties: false, required: ['branch_id'], properties: {
    branch_id: objectId, visit_id: objectId, source_id: objectId, source_version: { type: 'integer', minimum: 1 }, source_type: { type: 'string', enum: ['CONSULTATION_SUMMARY', 'OPTICAL_PRESCRIPTION', 'TEST_RESULT'] },
    status: { type: 'string', enum: ['APPROVED_FOR_PORTAL', 'WITHDRAWN'] },
    page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
} as const;
