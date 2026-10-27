import { describe, expect, it } from 'vitest';
import { parseMpesaOutboundConfiguration } from './mpesa-outbound.js';

const valid = (): NodeJS.ProcessEnv => ({
  MPESA_STK_ENABLED: 'true', MPESA_CONSUMER_KEY: 'synthetic-key',
  MPESA_CONSUMER_SECRET: 'synthetic-secret', MPESA_PASSKEY: 'synthetic-passkey',
  MPESA_BUSINESS_SHORT_CODE: '174379', MPESA_PARTY_B: '174379',
  MPESA_TRANSACTION_TYPE: 'CustomerPayBillOnline',
  MPESA_CALLBACK_URL: 'https://sandbox-hms.example.test/api/payments/mpesa/callback',
  MPESA_BRANCH_IDS: '507f1f77bcf86cd799439011',
});

describe('M-PESA outbound configuration diagnostics', () => {
  it('accepts configured HTTPS callback and branch IDs', () => {
    expect(parseMpesaOutboundConfiguration(valid())).toMatchObject({ branchIds: ['507f1f77bcf86cd799439011'] });
  });
  it.each([
    'https://localhost/api/payments/mpesa/callback',
    'http://sandbox-hms.example.test/api/payments/mpesa/callback',
    'https://sandbox-hms.example.test/wrong-path',
    'https://sandbox-hms.example.test/api/payments/mpesa/callback?secret=synthetic',
    'not a URL',
  ])('reports the callback setting safely for invalid URL %s', (url) => {
    expect(() => parseMpesaOutboundConfiguration({ ...valid(), MPESA_CALLBACK_URL: url }))
      .toThrow('MPESA_CALLBACK_URL must use a public HTTPS host');
  });
  it('lists failed settings without exposing values', () => {
    const values = { ...valid(), MPESA_CONSUMER_SECRET: '', MPESA_BRANCH_IDS: 'synthetic-bad-id',
      MPESA_CALLBACK_URL: 'https://localhost/api/payments/mpesa/callback' };
    let message = '';
    try { parseMpesaOutboundConfiguration(values); } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toContain('MPESA_CONSUMER_SECRET must be set');
    expect(message).toContain('MPESA_BRANCH_IDS must contain');
    expect(message).toContain('MPESA_CALLBACK_URL must use');
    expect(message).not.toContain('synthetic');
  });
  it('allows callback-only startup when outbound STK is disabled', () => {
    expect(parseMpesaOutboundConfiguration({ MPESA_STK_ENABLED: 'false' })).toBeUndefined();
  });
});
