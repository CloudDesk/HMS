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
});
