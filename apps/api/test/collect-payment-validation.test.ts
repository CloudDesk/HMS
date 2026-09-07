import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { BillingService } from '../src/modules/billing/billing.service.js';
import { AdvancePaymentService } from '../src/modules/advance-payment/advance-payment.service.js';
import { AdvancePaymentRepository } from '../src/modules/advance-payment/advance-payment.repository.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { AppError } from '../src/shared/errors/app-error.js';

describe('Collect Payment Amount Validation Suite', () => {
  let advancePaymentRepository: AdvancePaymentRepository;
  let advancePaymentService: AdvancePaymentService;

  beforeAll(async () => {
    await setupTestDatabase();
    advancePaymentRepository = new AdvancePaymentRepository();
    advancePaymentService = new AdvancePaymentService(advancePaymentRepository);
  }, 30000);

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  const metadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

  it('1 & 9. Payment exactly equal to outstanding balance succeeds and sets status to PAID', async () => {
    let currentBalance = 4300;
    let currentPaid = 0;
    let currentStatus = 'PENDING';

    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: vi.fn(async () => null),
      getById: vi.fn(async () => ({
        id: '507f1f77bcf86cd799439011',
        invoice_number: 'INV-001',
        patient_id: createObjectId(),
        branch_id: createObjectId(),
        status: currentStatus,
        total_amount: 4300,
        paid_amount: currentPaid,
        balance_amount: currentBalance,
      })),
      getHydratedById: vi.fn(async () => ({
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
      createPayment: vi.fn(async () => ({
        id: '507f1f77bcf86cd799439022',
        payment_number: 'PAY-001',
        amount: 4300,
        payment_method: 'CASH',
        payment_date: new Date(),
      })),
      applyPayment: vi.fn(async () => {
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
      getPaymentById: vi.fn(async () => ({
        id: '507f1f77bcf86cd799439022',
        invoice_id: '507f1f77bcf86cd799439011',
        payment_number: 'PAY-001',
        amount: 4300,
        payment_method: 'CASH',
        payment_date: new Date(),
      })),
      audit: vi.fn(async () => {}),
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

    expect(result.payment.amount).toBe(4300);
    expect(result.invoice.status).toBe('PAID');
    expect(result.invoice.balance_amount).toBe(0);
  });

  it('2 & 10. Payment less than outstanding balance succeeds and updates remaining balance', async () => {
    let currentBalance = 4300;
    let currentPaid = 0;
    let currentStatus = 'PENDING';

    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: vi.fn(async () => null),
      getById: vi.fn(async () => ({
        id: '507f1f77bcf86cd799439011',
        invoice_number: 'INV-001',
        patient_id: createObjectId(),
        branch_id: createObjectId(),
        status: currentStatus,
        total_amount: 4300,
        paid_amount: currentPaid,
        balance_amount: currentBalance,
      })),
      getHydratedById: vi.fn(async () => ({
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
      createPayment: vi.fn(async () => ({
        id: '507f1f77bcf86cd799439022',
        payment_number: 'PAY-001',
        amount: 2000,
        payment_method: 'CASH',
        payment_date: new Date(),
      })),
      applyPayment: vi.fn(async () => {
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
      getPaymentById: vi.fn(async () => ({
        id: '507f1f77bcf86cd799439022',
        invoice_id: '507f1f77bcf86cd799439011',
        payment_number: 'PAY-001',
        amount: 2000,
        payment_method: 'CASH',
        payment_date: new Date(),
      })),
      audit: vi.fn(async () => {}),
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

    expect(result.payment.amount).toBe(2000);
    expect(result.invoice.status).toBe('PARTIALLY_PAID');
    expect(result.invoice.balance_amount).toBe(2300);
  });

  it('3. Payment greater than outstanding balance is rejected with 400 PAYMENT_EXCEEDS_BALANCE', async () => {
    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: vi.fn(async () => null),
      getById: vi.fn(async () => ({
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

    await expect(
      service.collectPayment(
        '507f1f77bcf86cd799439011',
        { amount: 40000, payment_method: 'CASH' },
        createObjectId(),
        metadata,
      ),
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 400 &&
        err.code === 'PAYMENT_EXCEEDS_BALANCE' &&
        /Payment amount cannot exceed the outstanding balance/.test(err.message)
      );
    });
  });

  it('4. Zero payment is rejected with 400 INVALID_PAYMENT_AMOUNT', async () => {
    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: vi.fn(async () => null),
      getById: vi.fn(async () => ({
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

    await expect(
      service.collectPayment(
        '507f1f77bcf86cd799439011',
        { amount: 0, payment_method: 'CASH' },
        createObjectId(),
        metadata,
      ),
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError && err.statusCode === 400 && err.code === 'INVALID_PAYMENT_AMOUNT';
    });
  });

  it('5. Negative payment is rejected with 400 INVALID_PAYMENT_AMOUNT', async () => {
    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: vi.fn(async () => null),
      getById: vi.fn(async () => ({
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

    await expect(
      service.collectPayment(
        '507f1f77bcf86cd799439011',
        { amount: -500, payment_method: 'CASH' },
        createObjectId(),
        metadata,
      ),
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError && err.statusCode === 400 && err.code === 'INVALID_PAYMENT_AMOUNT';
    });
  });

  it('6. Invoice with zero balance (PAID) rejects payment', async () => {
    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: vi.fn(async () => null),
      getById: vi.fn(async () => ({
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

    await expect(
      service.collectPayment(
        '507f1f77bcf86cd799439011',
        { amount: 100, payment_method: 'CASH' },
        createObjectId(),
        metadata,
      ),
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError && err.statusCode === 409 && err.code === 'INVOICE_PAID';
    });
  });

  it('7 & 8. Stale frontend balance / concurrent payment prevents total payments from exceeding total', async () => {
    // Database balance is actually 2,300 because KES 2,000 was collected previously.
    // Client attempts to submit 4,300 based on old UI state.
    const mockRepo: Record<string, unknown> = {
      resolveBranchScope: vi.fn(async () => null),
      getById: vi.fn(async () => ({
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

    await expect(
      service.collectPayment(
        '507f1f77bcf86cd799439011',
        { amount: 4300, payment_method: 'CASH' },
        createObjectId(),
        metadata,
      ),
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 400 &&
        err.code === 'PAYMENT_EXCEEDS_BALANCE' &&
        /Payment amount cannot exceed the outstanding balance of KES 2,300.00/.test(err.message)
      );
    });
  });
});
