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

  it('Concurrent payment and requirement sync maintains accurate balance and status', async () => {
    const sourceId = createObjectId();
    const patientId = createObjectId();
    const branchId = createObjectId();
    const user1 = createObjectId();
    const user2 = createObjectId();

    // Initial setup with requirement of 10000
    await service.syncRequirement({
      patient_id: patientId,
      branch_id: branchId,
      source_type: 'PROCEDURE_BOOKING',
      source_id: sourceId,
      required_amount: 10000,
      requirement_status: 'REQUIRED',
    }, user1);

    // Fire concurrent operations:
    // 1. Payment of 2500
    // 2. Sync requirement change to 12000
    // 3. Payment of 3500
    await Promise.all([
      service.processPayment('PROCEDURE_BOOKING', sourceId, 2500, user2),
      service.syncRequirement({
        patient_id: patientId,
        branch_id: branchId,
        source_type: 'PROCEDURE_BOOKING',
        source_id: sourceId,
        required_amount: 12000,
        requirement_status: 'REQUIRED',
      }, user1),
      service.processPayment('PROCEDURE_BOOKING', sourceId, 3500, user2),
    ]);

    const finalRecord = await service.getBySource('PROCEDURE_BOOKING', sourceId);
    expect(finalRecord).not.toBeNull();
    expect(finalRecord!.required_amount).toBe(12000);
    expect(finalRecord!.paid_amount).toBe(6000); // 2500 + 3500
    expect(finalRecord!.balance_amount).toBe(6000); // 12000 - 6000
    expect(finalRecord!.payment_status).toBe('PARTIALLY_PAID');
    expect(finalRecord!.created_by).toBe(user1);
  });

  it('Preserves CANCELLED status on syncRequirement and rejects negative required amounts', async () => {
    const sourceId = createObjectId();
    const patientId = createObjectId();
    const branchId = createObjectId();
    const userId = createObjectId();

    // Rejects negative requirement
    await expect(
      service.syncRequirement({
        patient_id: patientId,
        branch_id: branchId,
        source_type: 'ADMISSION_REQUEST',
        source_id: sourceId,
        required_amount: -500,
        requirement_status: 'REQUIRED',
      }, userId),
    ).rejects.toThrow('Required amount cannot be negative');

    // Create record and cancel it
    await service.syncRequirement({
      patient_id: patientId,
      branch_id: branchId,
      source_type: 'ADMISSION_REQUEST',
      source_id: sourceId,
      required_amount: 5000,
      requirement_status: 'REQUIRED',
    }, userId);

    // Manually mark CANCELLED to test status preservation
    const { AdvancePaymentModel } = await import('../src/modules/advance-payment/advance-payment.model.js');
    await AdvancePaymentModel.updateOne(
      { source_type: 'ADMISSION_REQUEST', source_id: sourceId },
      { $set: { payment_status: 'CANCELLED' } },
    );

    // Syncing requirement should not un-cancel it
    const afterSync = await service.syncRequirement({
      patient_id: patientId,
      branch_id: branchId,
      source_type: 'ADMISSION_REQUEST',
      source_id: sourceId,
      required_amount: 8000,
      requirement_status: 'REQUIRED',
    }, userId);

    expect(afterSync.payment_status).toBe('CANCELLED');
    expect(afterSync.required_amount).toBe(8000);
  });
});
