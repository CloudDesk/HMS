import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { BillingService } from '../src/modules/billing/billing.service.js';
import { AdvancePaymentService } from '../src/modules/advance-payment/advance-payment.service.js';
import { AdvancePaymentRepository } from '../src/modules/advance-payment/advance-payment.repository.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';

test('Billing Integration with Advance Payment', async (t) => {
  await setupTestDatabase();
  
  const advancePaymentRepository = new AdvancePaymentRepository();
  const advancePaymentService = new AdvancePaymentService(advancePaymentRepository);

  t.afterEach(async () => {
    mock.restoreAll();
    await clearTestDatabase();
  });

  t.after(async () => {
    await teardownTestDatabase();
  });

  await t.test('collectPayment updates Advance Payment', async () => {
    // 1. Pre-seed the Advance Payment requirement in the database
    const patientId = createObjectId();
    const branchId = createObjectId();
    const sourceId = createObjectId();
    const userId = createObjectId();
    
    await advancePaymentService.syncRequirement({
      patient_id: patientId,
      branch_id: branchId,
      source_type: 'ADMISSION_REQUEST',
      source_id: sourceId,
      required_amount: 10000,
      requirement_status: 'REQUIRED'
    }, userId);

    // 2. Mock Billing dependencies
    const mockBillingRepo = {
      resolveBranchScope: mock.fn(async () => null),
      getById: mock.fn(async () => ({
        id: createObjectId(),
        invoice_number: 'INV-123',
        status: 'PENDING',
        balance_amount: 10000,
        context_type: 'ADMISSION_REQUEST',
        context_id: sourceId
      })),
      getHydratedById: mock.fn(async () => ({
        id: createObjectId(),
        invoice_number: 'INV-123',
        status: 'PENDING',
        balance_amount: 10000,
        context_type: 'ADMISSION_REQUEST',
        context_id: sourceId
      })),
      createPayment: mock.fn(async () => ({
        id: createObjectId(),
        payment_number: 'PAY-123',
        amount: 5000,
        payment_method: 'CASH'
      })),
      applyPayment: mock.fn(async () => ({
        status: 'PENDING',
        balance_amount: 5000,
        context_type: 'ADMISSION_REQUEST',
        context_id: sourceId
      })),
      audit: mock.fn(async () => {}),
      getPaymentById: mock.fn(async (id) => ({ 
        id,
        invoice_id: createObjectId(),
        payment_number: 'PAY-123',
        amount: 5000,
        payment_method: 'CASH'
      }))
    } as any;

    const billingService = new BillingService(
      mockBillingRepo,
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
      advancePaymentService
    );

    // 3. Collect a payment via Billing
    await billingService.collectPayment(
      createObjectId(),
      { amount: 5000, payment_method: 'CASH' },
      userId,
      {} as any
    );

    // 4. Verify the Advance Payment was updated properly
    const advancePayment = await advancePaymentService.getBySource('ADMISSION_REQUEST', sourceId);
    assert.ok(advancePayment);
    assert.equal(advancePayment.paid_amount, 5000);
    assert.equal(advancePayment.balance_amount, 5000);
    assert.equal(advancePayment.payment_status, 'PARTIALLY_PAID');
    
    // Check that the same Mongoose session was used by spying on processPayment
    // Because we passed a mocked repo that uses a real session (mockBillingRepo.createPayment doesn't actually use the session, but billingService.collectPayment starts one and passes it down).
  });
});
