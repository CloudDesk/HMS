import { describe, expect, it, vi } from 'vitest';
import { parseMpesaOutboundConfiguration, type MpesaMerchant } from '../../config/mpesa-outbound.js';
import { MpesaDarajaClient } from './mpesa-daraja.client.js';

const merchant: MpesaMerchant = { consumerKey: 'test-key', consumerSecret: 'test-secret', passkey: 'test-passkey',
  businessShortCode: '174379', partyB: '174379', transactionType: 'CustomerPayBillOnline',
  callbackUrl: 'https://example.test/api/payments/mpesa/callback', branchIds: ['012345678901234567890123'] };
const attempt = { _id: 'a'.repeat(64), environment: 'sandbox' as const, businessShortCode: '174379',
  partyB: '174379', transactionType: 'CustomerPayBillOnline' as const, amount: 10, payerPhone: '254700000001' };

describe('Daraja client transport boundary', () => {
  it('uses server credentials and the sandbox contract, preserving provider IDs', async () => {
    const http = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: 'test-token' }))
      .mockResolvedValueOnce(Response.json({ ResponseCode: '0', MerchantRequestID: 'merchant-1', CheckoutRequestID: 'checkout-1' }));
    const client = new MpesaDarajaClient(http);
    expect(await client.token(merchant, 'sandbox')).toBe('test-token');
    expect(http.mock.calls[0][0]).toBe('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials');
    expect(http.mock.calls[0][1]?.headers).toEqual({ Authorization: `Basic ${Buffer.from('test-key:test-secret').toString('base64')}` });
    expect(await client.submit(merchant, attempt, 'test-token')).toEqual({ state: 'PENDING', merchantRequestId: 'merchant-1', checkoutRequestId: 'checkout-1' });
    const request = http.mock.calls[1][1];
    expect(request?.redirect).toBe('error');
    expect(request?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({ BusinessShortCode: '174379', Amount: 10, PhoneNumber: attempt.payerPhone,
      CallBackURL: merchant.callbackUrl, AccountReference: 'aaaaaaaaaaaa' });
    expect(body.Timestamp).toMatch(/^\d{14}$/);
    expect(Buffer.from(body.Password, 'base64').toString()).toBe(`174379test-passkey${body.Timestamp}`);
  });
  it.each([500, 408, 200])('retains ambiguous response %s as UNKNOWN without retries', async (status) => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ message: 'ambiguous' }, { status }));
    expect(await new MpesaDarajaClient(http).submit(merchant, attempt, 'test-token')).toEqual({ state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' });
    expect(http).toHaveBeenCalledOnce();
  });
  it('retains transport timeouts as UNKNOWN and never exposes raw failures', async () => {
    const http = vi.fn<typeof fetch>().mockRejectedValue(new Error('sensitive synthetic error'));
    expect(await new MpesaDarajaClient(http).submit(merchant, attempt, 'test-token')).toEqual({ state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' });
    expect(http).toHaveBeenCalledOnce();
  });
  it('recognizes explicit provider rejection and handles OAuth failure before sending', async () => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ errorCode: 'test', errorMessage: 'rejected' }, { status: 400 }));
    const client = new MpesaDarajaClient(http);
    expect(await client.submit(merchant, attempt, 'test-token')).toEqual({ state: 'REJECTED', error: 'PROVIDER_REJECTED' });
    expect(await client.token(merchant, 'production')).toBeUndefined();
    expect(http.mock.calls[1][0]).toContain('https://api.safaricom.co.ke/');
  });
  it('disables outbound calls by default and rejects incomplete configuration', () => {
    expect(parseMpesaOutboundConfiguration({})).toBeUndefined();
    expect(() => parseMpesaOutboundConfiguration({ MPESA_STK_ENABLED: 'true' })).toThrow('Invalid or incomplete');
  });
});
