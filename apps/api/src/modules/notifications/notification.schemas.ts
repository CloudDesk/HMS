export const createNotificationBodySchema = {
  type: 'object',
  required: ['title', 'message', 'type'],
  additionalProperties: false,
  properties: {
    recipient_role: { type: ['string', 'null'] },
    recipient_user_id: { type: ['string', 'null'] },
    title: { type: 'string', minLength: 1 },
    message: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: ['REFERRAL', 'CALL_NEXT_PATIENT', 'GENERAL'] },
    related_entity_id: { type: ['string', 'null'] },
  },
} as const;

export const listNotificationsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recipient_role: { type: 'string' },
    recipient_user_id: { type: 'string' },
    is_read: { type: 'boolean' },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;

export const notificationIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;
