import { describe, expect, it } from 'vitest';
import { assertDispensingCanBeConfirmed } from './pharmacy-dispensing.service.js';

describe('assertDispensingCanBeConfirmed', () => {
  it('preserves the already-dispensed conflict for a genuinely confirmed dispensing', () => {
    expect(() => assertDispensingCanBeConfirmed({ status: 'CONFIRMED' })).toThrowError(
      expect.objectContaining({
        statusCode: 409,
        code: 'PRESCRIPTION_ALREADY_DISPENSED',
        message: 'This prescription has already been dispensed.',
      }),
    );
  });

  it('allows a DRAFT dispensing to continue to confirmation validation', () => {
    expect(() => assertDispensingCanBeConfirmed({ status: 'DRAFT' })).not.toThrow();
  });
});
