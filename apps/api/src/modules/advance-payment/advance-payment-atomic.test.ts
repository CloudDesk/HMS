import { describe, expect, it } from 'vitest';
import { AdvancePaymentRepository } from './advance-payment.repository.js';

describe('AdvancePaymentRepository Atomic Payment Update', () => {
  it('rejects negative or zero payment amounts', async () => {
    const repo = new AdvancePaymentRepository();
    await expect(repo.addPayment('ADMISSION', 'source-1', 0, 'user-1')).rejects.toThrow(
      'Payment amount must be greater than zero',
    );
    await expect(repo.addPayment('ADMISSION', 'source-1', -50, 'user-1')).rejects.toThrow(
      'Payment amount must be greater than zero',
    );
  });

  it('rejects negative required amounts on syncRequirement', async () => {
    const repo = new AdvancePaymentRepository();
    await expect(
      repo.syncRequirement(
        {
          patient_id: 'patient-1',
          branch_id: 'branch-1',
          source_type: 'ADMISSION_REQUEST',
          source_id: 'source-1',
          required_amount: -100,
          requirement_status: 'REQUIRED',
        },
        'user-1',
      ),
    ).rejects.toThrow('Required amount cannot be negative');
  });
});
