import { describe, expect, it } from 'vitest';
import { MpesaAttemptCreationError } from './mpesa-attempt-error.js';

describe('M-PESA creation diagnostic redaction', () => {
  it.each([
    [13, 'DATABASE_PERMISSION'], [18, 'DATABASE_AUTHENTICATION'], [20, 'TRANSACTIONS_UNSUPPORTED'],
    [26, 'COLLECTION_MISSING'], [50, 'DATABASE_TIMEOUT'], [67, 'INDEX_CREATION_FAILED'],
    [85, 'INDEX_OPTIONS_CONFLICT'], [86, 'INDEX_KEY_CONFLICT'], [112, 'WRITE_CONFLICT'],
    [121, 'DOCUMENT_VALIDATION'], [251, 'TRANSACTION_ABORTED'], [11000, 'DUPLICATE_KEY'],
  ])('exposes only allowlisted category/code for database error %s', (code, category) => {
    const failure = Object.assign(new Error('PRIVATE_URI_AND_DOCUMENT'), { code, keyValue: { payer: 'PRIVATE_PHONE' } });
    const error = new MpesaAttemptCreationError('INDEX_INITIALIZATION', failure);
    expect(error.diagnostic).toEqual({ stage: 'INDEX_INITIALIZATION', category, databaseCode: code });
    expect(JSON.stringify(error)).not.toContain('PRIVATE');
    expect(error).toMatchObject({ code: 'MPESA_ATTEMPT_UNAVAILABLE', statusCode: 503 });
    expect(error.cause).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  it.each([
    ['ValidationError', 'MODEL_VALIDATION'], ['CastError', 'MODEL_CAST'],
    ['MongoServerSelectionError', 'DATABASE_SELECTION'],
  ])('maps recognized error names to fixed categories: %s', (name, category) => {
    const error = new MpesaAttemptCreationError('ATTEMPT_WRITE', Object.assign(new Error('PRIVATE'), { name }));
    expect(error.diagnostic).toEqual({ stage: 'ATTEMPT_WRITE', category });
  });

  it.each([undefined, 'PRIVATE', { code: 'PRIVATE' }, { code: 254700000001 },
    { name: 'PRIVATE', message: 'PRIVATE', cause: 'PRIVATE' }, Object.assign(new Error('PRIVATE'), { name: 'PRIVATE' })])(
    'omits unknown names, codes, messages and nested details: %#', (failure) => {
      const error = new MpesaAttemptCreationError('AUDIT_WRITE', failure);
      expect(error.diagnostic).toEqual({ stage: 'AUDIT_WRITE', category: 'UNCLASSIFIED' });
      expect(JSON.stringify(error)).not.toContain('PRIVATE');
    });
});
