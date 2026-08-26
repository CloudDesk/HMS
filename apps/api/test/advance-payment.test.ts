import test from 'node:test';
import assert from 'node:assert/strict';
import { AdvancePaymentService } from '../src/modules/advance-payment/advance-payment.service.js';
import { AdvancePaymentRepository } from '../src/modules/advance-payment/advance-payment.repository.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';

test('AdvancePaymentService', async (t) => {
  await setupTestDatabase();
  
  const repository = new AdvancePaymentRepository();
  const service = new AdvancePaymentService(repository);

  t.afterEach(async () => {
    await clearTestDatabase();
  });

  t.after(async () => {
    await teardownTestDatabase();
  });

  await t.test('syncRequirement - NOT_REQUIRED', async () => {
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
    
    assert.equal(doc.requirement_status, 'NOT_REQUIRED');
    assert.equal(doc.required_amount, 0);
    assert.equal(doc.paid_amount, 0);
    assert.equal(doc.balance_amount, 0);
    assert.equal(doc.payment_status, 'PENDING'); // Or irrelevant
  });

  await t.test('syncRequirement - REQUIRED', async () => {
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
    
    assert.equal(doc.requirement_status, 'REQUIRED');
    assert.equal(doc.required_amount, 10000);
    assert.equal(doc.paid_amount, 0);
    assert.equal(doc.balance_amount, 10000);
    assert.equal(doc.payment_status, 'PENDING');
  });

  await t.test('Payment states and calculations', async () => {
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
    assert.ok(updated);
    assert.equal(updated.paid_amount, 5000);
    assert.equal(updated.balance_amount, 5000);
    assert.equal(updated.payment_status, 'PARTIALLY_PAID');

    // 3. Full Payment
    updated = await service.processPayment('PROCEDURE_BOOKING', sourceId, 5000, userId);
    assert.ok(updated);
    assert.equal(updated.paid_amount, 10000);
    assert.equal(updated.balance_amount, 0);
    assert.equal(updated.payment_status, 'PAID');
    
    // 4. Overpayment (no negative balance)
    updated = await service.processPayment('PROCEDURE_BOOKING', sourceId, 2000, userId);
    assert.ok(updated);
    assert.equal(updated.paid_amount, 12000);
    assert.equal(updated.balance_amount, 0);
    assert.equal(updated.payment_status, 'PAID');
  });

  await t.test('Requirement Changes and Idempotency', async () => {
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

    assert.equal(req2.required_amount, 15000);
    assert.equal(req2.paid_amount, 5000);
    assert.equal(req2.balance_amount, 10000);
    assert.equal(req2.payment_status, 'PARTIALLY_PAID');
    assert.equal(req2.id, req1.id); // Same document, no duplicates
    
    // Sync 3: Decrease Requirement
    const req3 = await service.syncRequirement({
      patient_id: req1.patient_id,
      branch_id: req1.branch_id,
      source_type: 'ADMISSION_REQUEST',
      source_id: sourceId,
      required_amount: 4000, // They paid 5000, so now they're fully paid
      requirement_status: 'REQUIRED'
    }, userId);

    assert.equal(req3.required_amount, 4000);
    assert.equal(req3.paid_amount, 5000);
    assert.equal(req3.balance_amount, 0);
    assert.equal(req3.payment_status, 'PAID');
  });
});
