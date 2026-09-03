import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { BillingService } from '../src/modules/billing/billing.service.js';
import { AdvancePaymentService } from '../src/modules/advance-payment/advance-payment.service.js';
import { AdvancePaymentRepository } from '../src/modules/advance-payment/advance-payment.repository.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { AppError } from '../src/shared/errors/app-error.js';

test('Collect Payment Amount Validation Suite', async (t) => {
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

  const metadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

  await t.test('1 & 9. Payment exactly equal to outstanding balance succeeds and sets status to PAID', async () => {
    let currentBalance = 4300;
    let currentPaid = 0;
    let currentStatus = 'PENDING';

    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: mock.fn(async () => null),
      getById: mock.fn(async () => ({
        id: '507f1f77bcf86cd799439011',
        invoice_number: 'INV-001',
        patient_id: createObjectId(),
        branch_id: createObjectId(),
        status: currentStatus,
        total_amount: 4300,
        paid_amount: currentPaid,
        balance_amount: currentBalance,
      })),
      getHydratedById: mock.fn(async () => ({
        id: '507f1f77bcf86cd799439011',
        invoice_number: 'INV-001',
        patient_id: createObjectId(),
        branch_id: createObjectId(),
        status: currentStatus,
        total_amount: 4300,
        paid_amount: currentPaid,
        balance_amount: currentBalance,
        items: [],
      })),
      createPayment: mock.fn(async () => ({
        id: '507f1f77bcf86cd799439022',
        payment_number: 'PAY-001',
        amount: 4300,
        payment_method: 'CASH',
        payment_date: new Date(),
      })),
      applyPayment: mock.fn(async () => {
        currentPaid = 4300;
        currentBalance = 0;
        currentStatus = 'PAID';
        return {
          id: '507f1f77bcf86cd799439011',
          status: 'PAID',
          paid_amount: 4300,
          balance_amount: 0,
        };
      }),
      getPaymentById: mock.fn(async () => ({
        id: '507f1f77bcf86cd799439022',
        invoice_id: '507f1f77bcf86cd799439011',
        payment_number: 'PAY-001',
        amount: 4300,
        payment_method: 'CASH',
        payment_date: new Date(),
      })),
      audit: mock.fn(async () => {}),
    };

    const service = new BillingService(
      mockRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      advancePaymentService,
    );

    const result = await service.collectPayment(
      '507f1f77bcf86cd799439011',
      { amount: 4300, payment_method: 'CASH' },
      createObjectId(),
      metadata,
    );

    assert.equal(result.payment.amount, 4300);
    assert.equal(result.invoice.status, 'PAID');
    assert.equal(result.invoice.balance_amount, 0);
  });

  await t.test('2 & 10. Payment less than outstanding balance succeeds and updates remaining balance', async () => {
    let currentBalance = 4300;
    let currentPaid = 0;
    let currentStatus = 'PENDING';

    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: mock.fn(async () => null),
      getById: mock.fn(async () => ({
        id: '507f1f77bcf86cd799439011',
        invoice_number: 'INV-001',
        patient_id: createObjectId(),
        branch_id: createObjectId(),
        status: currentStatus,
        total_amount: 4300,
        paid_amount: currentPaid,
        balance_amount: currentBalance,
      })),
      getHydratedById: mock.fn(async () => ({
        id: '507f1f77bcf86cd799439011',
        invoice_number: 'INV-001',
        patient_id: createObjectId(),
        branch_id: createObjectId(),
        status: currentStatus,
        total_amount: 4300,
        paid_amount: currentPaid,
        balance_amount: currentBalance,
        items: [],
      })),
      createPayment: mock.fn(async () => ({
        id: '507f1f77bcf86cd799439022',
        payment_number: 'PAY-001',
        amount: 2000,
        payment_method: 'CASH',
        payment_date: new Date(),
      })),
      applyPayment: mock.fn(async () => {
        currentPaid = 2000;
        currentBalance = 2300;
        currentStatus = 'PARTIALLY_PAID';
        return {
          id: '507f1f77bcf86cd799439011',
          status: 'PARTIALLY_PAID',
          paid_amount: 2000,
          balance_amount: 2300,
        };
      }),
      getPaymentById: mock.fn(async () => ({
        id: '507f1f77bcf86cd799439022',
        invoice_id: '507f1f77bcf86cd799439011',
        payment_number: 'PAY-001',
        amount: 2000,
        payment_method: 'CASH',
        payment_date: new Date(),
      })),
      audit: mock.fn(async () => {}),
    };

    const service = new BillingService(
      mockRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      advancePaymentService,
    );

    const result = await service.collectPayment(
      '507f1f77bcf86cd799439011',
      { amount: 2000, payment_method: 'CASH' },
      createObjectId(),
      metadata,
    );

    assert.equal(result.payment.amount, 2000);
    assert.equal(result.invoice.status, 'PARTIALLY_PAID');
    assert.equal(result.invoice.balance_amount, 2300);
  });

  await t.test('3. Payment greater than outstanding balance is rejected with 400 PAYMENT_EXCEEDS_BALANCE', async () => {
    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: mock.fn(async () => null),
      getById: mock.fn(async () => ({
        id: '507f1f77bcf86cd799439011',
        invoice_number: 'INV-001',
        status: 'PENDING',
        total_amount: 4300,
        paid_amount: 0,
        balance_amount: 4300,
      })),
    };

    const service = new BillingService(
      mockRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      advancePaymentService,
    );

    await assert.rejects(
      async () => {
        await service.collectPayment(
          '507f1f77bcf86cd799439011',
          { amount: 40000, payment_method: 'CASH' },
          createObjectId(),
          metadata,
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'PAYMENT_EXCEEDS_BALANCE');
        assert.match(err.message, /Payment amount cannot exceed the outstanding balance/);
        return true;
      },
    );
  });

  await t.test('4. Zero payment is rejected with 400 INVALID_PAYMENT_AMOUNT', async () => {
    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: mock.fn(async () => null),
      getById: mock.fn(async () => ({
        id: '507f1f77bcf86cd799439011',
        invoice_number: 'INV-001',
        status: 'PENDING',
        balance_amount: 4300,
      })),
    };

    const service = new BillingService(
      mockRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      advancePaymentService,
    );

    await assert.rejects(
      async () => {
        await service.collectPayment(
          '507f1f77bcf86cd799439011',
          { amount: 0, payment_method: 'CASH' },
          createObjectId(),
          metadata,
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'INVALID_PAYMENT_AMOUNT');
        return true;
      },
    );
  });

  await t.test('5. Negative payment is rejected with 400 INVALID_PAYMENT_AMOUNT', async () => {
    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: mock.fn(async () => null),
      getById: mock.fn(async () => ({
        id: '507f1f77bcf86cd799439011',
        invoice_number: 'INV-001',
        status: 'PENDING',
        balance_amount: 4300,
      })),
    };

    const service = new BillingService(
      mockRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      advancePaymentService,
    );

    await assert.rejects(
      async () => {
        await service.collectPayment(
          '507f1f77bcf86cd799439011',
          { amount: -500, payment_method: 'CASH' },
          createObjectId(),
          metadata,
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'INVALID_PAYMENT_AMOUNT');
        return true;
      },
    );
  });

  await t.test('6. Invoice with zero balance (PAID) rejects payment', async () => {
    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: mock.fn(async () => null),
      getById: mock.fn(async () => ({
        id: '507f1f77bcf86cd799439011',
        invoice_number: 'INV-001',
        status: 'PAID',
        total_amount: 4300,
        paid_amount: 4300,
        balance_amount: 0,
      })),
    };

    const service = new BillingService(
      mockRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      advancePaymentService,
    );

    await assert.rejects(
      async () => {
        await service.collectPayment(
          '507f1f77bcf86cd799439011',
          { amount: 100, payment_method: 'CASH' },
          createObjectId(),
          metadata,
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'INVOICE_PAID');
        return true;
      },
    );
  });

  await t.test('7 & 8. Stale frontend balance / concurrent payment prevents total payments from exceeding total', async () => {
    // Database balance is actually 2,300 because KES 2,000 was collected previously.
    // Client attempts to submit 4,300 based on old UI state.
    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: mock.fn(async () => null),
      getById: mock.fn(async () => ({
        id: '507f1f77bcf86cd799439011',
        invoice_number: 'INV-001',
        status: 'PARTIALLY_PAID',
        total_amount: 4300,
        paid_amount: 2000,
        balance_amount: 2300,
      })),
    };

    const service = new BillingService(
      mockRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      advancePaymentService,
    );

    await assert.rejects(
      async () => {
        await service.collectPayment(
          '507f1f77bcf86cd799439011',
          { amount: 4300, payment_method: 'CASH' },
          createObjectId(),
          metadata,
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'PAYMENT_EXCEEDS_BALANCE');
        assert.match(err.message, /Payment amount cannot exceed the outstanding balance of KES 2,300.00/);
        return true;
      },
    );
  });
});
