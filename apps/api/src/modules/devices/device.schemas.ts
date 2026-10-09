export const registerDeviceBodySchema = {
  type: 'object',
  required: ['installationId', 'platform', 'pushToken'],
  additionalProperties: false,
  properties: {
    installationId: { type: 'string', minLength: 1 },
    deviceId: { type: 'string' },
    platform: { type: 'string', enum: ['android', 'ios'] },
    pushToken: { type: 'string', minLength: 1 },
    appVersion: { type: 'string' },
    osVersion: { type: 'string' },
  },
} as const;

export const unregisterDeviceBodySchema = {
  type: 'object',
  additionalProperties: false,
  anyOf: [
    { required: ['installationId'] },
    { required: ['pushToken'] },
  ],
  properties: {
    installationId: { type: 'string', minLength: 1 },
    pushToken: { type: 'string', minLength: 1 },
  },
} as const;

export const refreshPushTokenBodySchema = {
  type: 'object',
  required: ['installationId', 'pushToken'],
  additionalProperties: false,
  properties: {
    installationId: { type: 'string', minLength: 1 },
    pushToken: { type: 'string', minLength: 1 },
  },
} as const;
