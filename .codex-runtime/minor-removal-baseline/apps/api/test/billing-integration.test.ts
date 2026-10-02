import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { BillingService } from '../src/modules/billing/billing.service.js';
import { AdvancePaymentService } from '../src/modules/advance-payment/advance-payment.service.js';
import { AdvancePaymentRepository } from '../src/modules/advance-payment/advance-payment.repository.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';

describe('Billing Integration with Advance Payment', () => {
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

  it('collectPayment updates Advance Payment', async () => {
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
      resolveBranchScope: vi.fn(async () => null),
      getById: vi.fn(async () => ({
        id: createObjectId(),
        invoice_number: 'INV-123',
        status: 'PENDING',
        balance_amount: 10000,
        context_type: 'ADMISSION_REQUEST',
        context_id: sourceId
      })),
      getHydratedById: vi.fn(async () => ({
        id: createObjectId(),
        invoice_number: 'INV-123',
        status: 'PENDING',
        balance_amount: 10000,
        context_type: 'ADMISSION_REQUEST',
        context_id: sourceId
      })),
      createPayment: vi.fn(async () => ({
        id: createObjectId(),
        payment_number: 'PAY-123',
        amount: 5000,
        payment_method: 'CASH'
      })),
      applyPayment: vi.fn(async () => ({
        status: 'PENDING',
        balance_amount: 5000,
        context_type: 'ADMISSION_REQUEST',
        context_id: sourceId
      })),
      audit: vi.fn(async () => {}),
      getPaymentById: vi.fn(async (id: string) => ({ 
        id,
        invoice_id: createObjectId(),
        payment_number: 'PAY-123',
        amount: 5000,
        payment_method: 'CASH'
      }))
    } as unknown as ConstructorParameters<typeof BillingService>[0];

    const billingService = new BillingService(
      mockBillingRepo,
      {} as unknown as ConstructorParameters<typeof BillingService>[1], {} as unknown as ConstructorParameters<typeof BillingService>[2], {} as unknown as ConstructorParameters<typeof BillingService>[3], {} as unknown as ConstructorParameters<typeof BillingService>[4], {} as unknown as ConstructorParameters<typeof BillingService>[5], {} as unknown as ConstructorParameters<typeof BillingService>[6],
      advancePaymentService
    );

    // 3. Collect a payment via Billing
    await billingService.collectPayment(
      createObjectId(),
      { amount: 5000, payment_method: 'CASH' },
      userId,
      {} as unknown as import('../src/modules/billing/billing.types.js').BillingRequestMetadata
    );

    // 4. Verify the Advance Payment was updated properly
    const advancePayment = await advancePaymentService.getBySource('ADMISSION_REQUEST', sourceId);
    expect(advancePayment).toBeDefined();
    expect(advancePayment?.paid_amount).toBe(5000);
    expect(advancePayment?.balance_amount).toBe(5000);
    expect(advancePayment?.payment_status).toBe('PARTIALLY_PAID');
  });
});
