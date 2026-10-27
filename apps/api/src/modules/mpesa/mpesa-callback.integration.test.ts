import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { MpesaCallbackEventModel } from './mpesa-callback.model.js';
import { AuthRateLimitModel } from '../auth/auth-rate-limit.model.js';
import { BillingInvoiceModel, BillingPaymentModel } from '../billing/billing.model.js';

const callback = (code = 0, amount = 1) => ({ Body: { stkCallback: {
  MerchantRequestID: 'synthetic-merchant', CheckoutRequestID: 'synthetic-checkout',
  ResultCode: code, ResultDesc: 'Synthetic test',
  ...(code === 0 ? { CallbackMetadata: { Item: [
    { Name: 'Amount', Value: amount }, { Name: 'MpesaReceiptNumber', Value: 'SYNTHETIC123' },
    { Name: 'PhoneNumber', Value: 254700000001 }, { Name: 'TransactionDate', Value: 20261026150000 },
  ] } } : {}),
} } });

describe('M-PESA durable intake with real isolated MongoDB', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    ({ app } = await buildApp());
    await Promise.all([MpesaCallbackEventModel.init(), AuthRateLimitModel.init(), BillingInvoiceModel.init(), BillingPaymentModel.init()]);
  });
  beforeEach(async () => {
    await Promise.all([MpesaCallbackEventModel.deleteMany({}), AuthRateLimitModel.deleteMany({}), BillingInvoiceModel.deleteMany({}), BillingPaymentModel.deleteMany({})]);
  });
  afterAll(async () => {
    await app?.close();
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('registers in the full application and preserves authentication on billing', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/payments/mpesa/callback', payload: callback() });
    expect(response.statusCode).toBe(200);
    const saved = await MpesaCallbackEventModel.findOne().lean();
    expect(saved).toMatchObject({ processingStatus: 'UNMATCHED', verificationStatus: 'UNVERIFIED', amount: 1, financialPostingEnabled: false });
    expect(saved?.phoneNumber).toBeUndefined();
    expect((await app.inject({ method: 'GET', url: '/api/billing/invoices' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/payments/mpesa/callback' })).statusCode).toBe(404);
  });

  it('deduplicates concurrent deliveries and reordered metadata durably', async () => {
    const responses = await Promise.all(Array.from({ length: 12 }, () => app.inject({
      method: 'POST', url: '/api/payments/mpesa/callback', payload: callback(),
    })));
    expect(responses.map((response) => response.statusCode)).toEqual(Array(12).fill(200));
    const original = await MpesaCallbackEventModel.findOne().lean();
    const reordered = callback();
    reordered.Body.stkCallback.CallbackMetadata?.Item.reverse();
    expect((await app.inject({ method: 'POST', url: '/api/payments/mpesa/callback', payload: reordered })).statusCode).toBe(200);
    expect(await MpesaCallbackEventModel.countDocuments()).toBe(1);
    expect((await MpesaCallbackEventModel.findOne().lean())?.receivedAt).toEqual(original?.receivedAt);
  });

  it('preserves conflicting events without overwriting success or changing existing billing', async () => {
    const invoice = await BillingInvoiceModel.create({
      invoiceNumber: 'SYNTHETIC-INVOICE', patientId: new Types.ObjectId(), visitId: new Types.ObjectId(),
      branchId: new Types.ObjectId(), invoiceDate: new Date(), status: 'PENDING',
      subtotal: 10, totalAmount: 10, paidAmount: 0, balanceAmount: 10,
    });
    // A free-text reference is not an originating provider-attempt relationship.
    await BillingPaymentModel.create({
      invoiceId: invoice._id, patientId: invoice.patientId, branchId: invoice.branchId,
      paymentNumber: 'SYNTHETIC-PAYMENT', amount: 2, paymentMethod: 'CASH',
      paymentDate: new Date(), referenceNumber: 'synthetic-checkout',
    });
    const before = await BillingInvoiceModel.findById(invoice._id).lean();
    for (const payload of [callback(), callback(1032), callback(0, 999)]) {
      expect((await app.inject({ method: 'POST', url: '/api/payments/mpesa/callback', payload })).statusCode).toBe(200);
    }
    expect(await MpesaCallbackEventModel.countDocuments()).toBe(3);
    expect(await MpesaCallbackEventModel.countDocuments({ processingStatus: 'UNMATCHED' })).toBe(3);
    expect(await BillingInvoiceModel.findById(invoice._id).lean()).toEqual(before);
    expect(await BillingPaymentModel.countDocuments()).toBe(1);
  });

  it('survives application restart and uses a real HTTP listener', async () => {
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP address');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/payments/mpesa/callback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(callback()),
    });
    expect(response.status).toBe(200);
    await response.arrayBuffer();
    await app.close();
    ({ app } = await buildApp());
    expect((await app.inject({ method: 'POST', url: '/api/payments/mpesa/callback', payload: callback() })).statusCode).toBe(200);
    expect(await MpesaCallbackEventModel.countDocuments()).toBe(1);
  });

  it('limits shared IP requests even with spoofed forwarding headers', async () => {
    const windowMs = 60000;
    const bucketStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    // Consume through the real route, then fill its real bucket to avoid 120 HTTP requests.
    expect((await app.inject({ method: 'POST', url: '/api/payments/mpesa/callback', payload: callback() })).statusCode).toBe(200);
    await AuthRateLimitModel.updateMany({ scope: 'mpesa-callback-ip', bucketStart }, { $set: { count: 120 } });
    const response = await app.inject({ method: 'POST', url: '/api/payments/mpesa/callback', headers: { 'x-forwarded-for': '203.0.113.45' }, payload: callback() });
    expect(response.statusCode).toBe(429);
  });
});
