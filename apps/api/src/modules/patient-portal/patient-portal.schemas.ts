import { authSessionResponseSchema } from '../auth/auth.schemas.js';
import { apiResponseSchema } from '../../validators/common-schemas.js';

const nullableTextProperties = {
  line1: { type: ['string', 'null'] },
  line2: { type: ['string', 'null'] },
  city: { type: ['string', 'null'] },
  state: { type: ['string', 'null'] },
  country: { type: ['string', 'null'] },
  postalCode: { type: ['string', 'null'] },
} as const;

export const patientPortalSessionResponseSchema = authSessionResponseSchema;

export const patientOtpRequestResponseSchema = apiResponseSchema({
  type: 'object',
  required: ['success', 'resendAvailableAt'],
  additionalProperties: false,
  properties: {
    success: { type: 'boolean' },
    resendAvailableAt: { type: 'string' },
  },
});

export const patientOtpVerifyResponseSchema = apiResponseSchema({
  type: 'object',
  required: ['success', 'registrationToken'],
  additionalProperties: false,
  properties: {
    success: { type: 'boolean' },
    registrationToken: { type: 'string' },
  },
});

export const patientPortalContextResponseSchema = apiResponseSchema({
  type: 'object',
  required: ['account', 'patients'],
  additionalProperties: false,
  properties: {
    account: {
      type: 'object',
      required: ['type', 'full_name', 'email', 'phone', 'guardian_profile'],
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['PATIENT', 'GUARDIAN'] },
        full_name: { type: 'string' },
        email: { type: ['string', 'null'] },
        phone: { type: ['string', 'null'] },
        guardian_profile: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              required: ['relationship', 'address', 'identification', 'legal_consent_accepted', 'legal_consent_accepted_at'],
              additionalProperties: false,
              properties: {
                relationship: { type: 'string', enum: ['PARENT', 'LEGAL_GUARDIAN'] },
                address: { type: 'object', additionalProperties: false, properties: nullableTextProperties },
                identification: {
                  type: 'object',
                  additionalProperties: false,
                  properties: { type: { type: ['string', 'null'] }, number: { type: ['string', 'null'] } },
                },
                legal_consent_accepted: { type: 'boolean' },
                legal_consent_accepted_at: { type: 'string' },
              },
            },
          ],
        },
      },
    },
    patients: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'patient_number', 'full_name', 'date_of_birth', 'gender', 'relationship', 'is_primary', 'preferred_branch'],
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          patient_number: { type: 'string' },
          full_name: { type: 'string' },
          date_of_birth: { type: 'string' },
          gender: { type: 'string' },
          relationship: { type: 'string', enum: ['SELF', 'PARENT', 'LEGAL_GUARDIAN'] },
          is_primary: { type: 'boolean' },
          preferred_branch: {
            anyOf: [
              { type: 'null' },
              {
                type: 'object',
                required: ['id', 'name', 'city', 'address'],
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  city: { type: ['string', 'null'] },
                  address: { type: ['string', 'null'] },
                },
              },
            ],
          },
        },
      },
    },
  },
});
