import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { AdvancePaymentService } from '../src/modules/advance-payment/advance-payment.service.js';
import { AdvancePaymentRepository } from '../src/modules/advance-payment/advance-payment.repository.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';

describe('AdvancePaymentService', () => {
  let repository: AdvancePaymentRepository;
  let service: AdvancePaymentService;

  beforeAll(async () => {
    await setupTestDatabase();
    repository = new AdvancePaymentRepository();
    service = new AdvancePaymentService(repository);
  }, 30000);

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('syncRequirement - NOT_REQUIRED', async () => {
    const patientId = createObjectId();
    const branchId = createObjectId();
    const sourceId = createObjectId();
    
    const doc = await service.syncRequirement({
      patient_id: patientId,
      branch_id: branchId,
      source_type: 'ADMISSION_REQUEST',
      source_id: sourceId,
      required_amount: 0,
      requirement_status: 'NOT_REQUIRED'
    }, createObjectId());
    
    expect(doc.requirement_status).toBe('NOT_REQUIRED');
    expect(doc.required_amount).toBe(0);
    expect(doc.paid_amount).toBe(0);
    expect(doc.balance_amount).toBe(0);
    expect(doc.payment_status).toBe('PENDING');
  });

  it('syncRequirement - REQUIRED', async () => {
    const patientId = createObjectId();
    const branchId = createObjectId();
    const sourceId = createObjectId();
    
    const doc = await service.syncRequirement({
      patient_id: patientId,
      branch_id: branchId,
      source_type: 'ADMISSION_REQUEST',
      source_id: sourceId,
      required_amount: 10000,
      requirement_status: 'REQUIRED'
    }, createObjectId());
    
    expect(doc.requirement_status).toBe('REQUIRED');
    expect(doc.required_amount).toBe(10000);
    expect(doc.paid_amount).toBe(0);
    expect(doc.balance_amount).toBe(10000);
    expect(doc.payment_status).toBe('PENDING');
  });

  it('Payment states and calculations', async () => {
    const sourceId = createObjectId();
    const userId = createObjectId();
    
    // 1. Initial Sync
    await service.syncRequirement({
      patient_id: createObjectId(),
      branch_id: createObjectId(),
      source_type: 'PROCEDURE_BOOKING',
      source_id: sourceId,
      required_amount: 10000,
      requirement_status: 'REQUIRED'
    }, userId);

    // 2. Partial Payment
    let updated = await service.processPayment('PROCEDURE_BOOKING', sourceId, 5000, userId);
    expect(updated).toBeDefined();
    expect(updated.paid_amount).toBe(5000);
    expect(updated.balance_amount).toBe(5000);
    expect(updated.payment_status).toBe('PARTIALLY_PAID');

    // 3. Full Payment
    updated = await service.processPayment('PROCEDURE_BOOKING', sourceId, 5000, userId);
    expect(updated).toBeDefined();
    expect(updated.paid_amount).toBe(10000);
    expect(updated.balance_amount).toBe(0);
    expect(updated.payment_status).toBe('PAID');
    
    // 4. Overpayment (no negative balance)
    updated = await service.processPayment('PROCEDURE_BOOKING', sourceId, 2000, userId);
    expect(updated).toBeDefined();
    expect(updated.paid_amount).toBe(12000);
    expect(updated.balance_amount).toBe(0);
    expect(updated.payment_status).toBe('PAID');
  });

  it('Requirement Changes and Idempotency', async () => {
    const sourceId = createObjectId();
    const userId = createObjectId();
    
    // Sync 1
    const req1 = await service.syncRequirement({
      patient_id: createObjectId(),
      branch_id: createObjectId(),
      source_type: 'ADMISSION_REQUEST',
      source_id: sourceId,
      required_amount: 10000,
      requirement_status: 'REQUIRED'
    }, userId);

    await service.processPayment('ADMISSION_REQUEST', sourceId, 5000, userId);

    // Sync 2: Increase Requirement
    const req2 = await service.syncRequirement({
      patient_id: req1.patient_id,
      branch_id: req1.branch_id,
      source_type: 'ADMISSION_REQUEST',
      source_id: sourceId,
      required_amount: 15000,
      requirement_status: 'REQUIRED'
    }, userId);

    expect(req2.required_amount).toBe(15000);
    expect(req2.paid_amount).toBe(5000);
    expect(req2.balance_amount).toBe(10000);
    expect(req2.payment_status).toBe('PARTIALLY_PAID');
    expect(req2.id).toBe(req1.id); // Same document, no duplicates
    
    // Sync 3: Decrease Requirement
    const req3 = await service.syncRequirement({
      patient_id: req1.patient_id,
      branch_id: req1.branch_id,
      source_type: 'ADMISSION_REQUEST',
      source_id: sourceId,
      required_amount: 4000, // They paid 5000, so now they're fully paid
      requirement_status: 'REQUIRED'
    }, userId);

    expect(req3.required_amount).toBe(4000);
    expect(req3.paid_amount).toBe(5000);
    expect(req3.balance_amount).toBe(0);
    expect(req3.payment_status).toBe('PAID');
  });
});
