import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { toAppError } from './errors.js';

const duplicateKeyError = (
  keyPattern: Record<string, number>,
  keyValue: Record<string, unknown> = {},
  collection = '',
) =>
  Object.assign(new Error(`E11000 duplicate key error collection: hms.${collection}`), {
    code: 11000,
    keyPattern,
    keyValue,
  });

describe('duplicate conflict error mapping', () => {
  it('identifies reuse of a real confirmation idempotency key', () => {
    const error = toAppError(duplicateKeyError(
      { confirmIdempotencyKey: 1 },
      { confirmIdempotencyKey: 'confirm-key' },
    ));

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('DISPENSING_CONFIRMATION_IDEMPOTENCY_CONFLICT');
    expect(error.message).toBe('This dispensing confirmation request has already been processed.');
  });

  it('identifies reuse of a real reversal idempotency key', () => {
    const error = toAppError(duplicateKeyError(
      { reverseIdempotencyKey: 1 },
      { reverseIdempotencyKey: 'reverse-key' },
    ));

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('DISPENSING_REVERSAL_IDEMPOTENCY_CONFLICT');
    expect(error.message).toBe('This dispensing reversal request has already been processed.');
  });

  it('does not report a legacy null idempotency collision as already dispensed', () => {
    const error = toAppError(duplicateKeyError(
      { confirmIdempotencyKey: 1 },
      { confirmIdempotencyKey: null },
    ));

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('DISPENSING_IDEMPOTENCY_INDEX_CONFLICT');
    expect(error.message).not.toContain('already been dispensed');
  });

  it('identifies a billing invoice that already exists for an encounter', () => {
    const error = toAppError(duplicateKeyError({ visitId: 1 }, {}, 'billing_invoices'));

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('INVOICE_ALREADY_EXISTS_FOR_ENCOUNTER');
    expect(error.message).toBe('An invoice already exists for this encounter.');
  });

  it('identifies a duplicate real billing context', () => {
    const error = toAppError(duplicateKeyError(
      { contextType: 1, contextId: 1 },
      { contextType: 'ADMISSION_REQUEST', contextId: new Types.ObjectId() },
      'billing_invoices',
    ));

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('INVOICE_ALREADY_EXISTS_FOR_CONTEXT');
    expect(error.message).toBe('An invoice already exists for this billing context.');
  });

  it('does not classify a legacy null pair as a real billing context', () => {
    const error = toAppError(duplicateKeyError(
      { contextType: 1, contextId: 1 },
      { contextType: null, contextId: null },
      'billing_invoices',
    ));

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('UNIQUE_VIOLATION');
    expect(error.message).not.toContain('billing context');
  });

  it('identifies a duplicate active appointment slot', () => {
    const error = toAppError(duplicateKeyError({ activeSlotKey: 1 }));

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('APPOINTMENT_SLOT_CONFLICT');
    expect(error.message).toBe(
      'This doctor already has an appointment at the selected date and time. Choose another slot.',
    );
  });

  it('identifies the existing OPD visit linked to an appointment', () => {
    const error = toAppError(duplicateKeyError({ appointmentId: 1 }));

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('DUPLICATE_OPD_VISIT');
    expect(error.message).toBe('An OPD visit already exists for this appointment.');
  });

  it('keeps invoice-number collisions distinct from encounter duplicates', () => {
    const error = toAppError(duplicateKeyError({ invoiceNumber: 1 }, {}, 'billing_invoices'));

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('INVOICE_NUMBER_CONFLICT');
    expect(error.message).toBe(
      'An invoice with this number already exists. Please retry creating the invoice.',
    );
  });
});
