const objectIdPattern = '^[a-fA-F0-9]{24}$';

export const createNotificationBodySchema = {
  type: 'object',
  required: ['title', 'message', 'type'],
  additionalProperties: false,
  properties: {
    recipient_role: { type: ['string', 'null'] },
    recipient_user_id: { type: ['string', 'null'], pattern: objectIdPattern },
    recipient_branch_id: { type: ['string', 'null'], pattern: objectIdPattern },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    message: { type: 'string', minLength: 1, maxLength: 2000 },
    type: { type: 'string', enum: ['REFERRAL', 'CALL_NEXT_PATIENT', 'GENERAL'] },
    related_entity_id: { type: ['string', 'null'], pattern: objectIdPattern },
  },
} as const;

export const listNotificationsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recipient_role: { type: 'string' },
    recipient_user_id: { type: 'string', pattern: objectIdPattern },
    recipient_branch_id: { type: 'string', pattern: objectIdPattern },
    is_read: { type: 'boolean' },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;

export const notificationIdParamsSchema = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', pattern: objectIdPattern },
  },
} as const;
