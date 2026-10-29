import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
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
    ['MongoServerError', 'DATABASE_COMMAND'], ['MongoNetworkError', 'DATABASE_NETWORK'],
    ['MongoNetworkTimeoutError', 'DATABASE_NETWORK_TIMEOUT'], ['MongoParseError', 'DATABASE_URI_OPTIONS'],
    ['MongoCompatibilityError', 'DATABASE_COMPATIBILITY'], ['MongoAPIError', 'DATABASE_DRIVER_API'],
    ['MongoUnexpectedServerResponseError', 'DATABASE_RESPONSE'], ['MongooseError', 'MONGOOSE_ERROR'],
    ['TypeError', 'JAVASCRIPT_TYPE_ERROR'], ['ReferenceError', 'JAVASCRIPT_REFERENCE_ERROR'],
  ])('maps recognized error names to fixed categories: %s', (name, category) => {
    const error = new MpesaAttemptCreationError('ATTEMPT_WRITE', Object.assign(new Error('PRIVATE'), { name }));
    expect(error.diagnostic).toEqual({ stage: 'ATTEMPT_WRITE', category });
  });

  it.each([197, 303, 8000])('preserves bounded public driver code %s without its private payload', (code) => {
    const failure = new mongoose.mongo.MongoServerError({ message: 'PRIVATE_URI_DOCUMENT_AND_KEYS', code,
      keyValue: { phone: 'PRIVATE_PHONE' } });
    const error = new MpesaAttemptCreationError('INDEX_INSPECTION', failure);
    expect(error.diagnostic).toEqual({ stage: 'INDEX_INSPECTION', category: 'DATABASE_COMMAND', databaseCode: code });
    expect(JSON.stringify(error)).not.toContain('PRIVATE');
  });

  it.each([-1, 8000.5, 254700000001])('omits invalid or data-like driver code %s', (code) => {
    const error = new MpesaAttemptCreationError('INDEX_BUILD', new mongoose.mongo.MongoServerError({ message: 'PRIVATE', code }));
    expect(error.diagnostic).toEqual({ stage: 'INDEX_BUILD', category: 'DATABASE_COMMAND' });
  });

  it('does not copy an unknown numeric code from a generic error', () => {
    const error = new MpesaAttemptCreationError('INDEX_BUILD', Object.assign(new Error('PRIVATE'), { code: 8000 }));
    expect(error.diagnostic).toEqual({ stage: 'INDEX_BUILD', category: 'UNCLASSIFIED' });
  });

  it.each([undefined, 'PRIVATE', { code: 'PRIVATE' }, { code: 254700000001 },
    { name: 'PRIVATE', message: 'PRIVATE', cause: 'PRIVATE' }, Object.assign(new Error('PRIVATE'), { name: 'PRIVATE' })])(
    'omits unknown names, codes, messages and nested details: %#', (failure) => {
      const error = new MpesaAttemptCreationError('AUDIT_WRITE', failure);
      expect(error.diagnostic).toEqual({ stage: 'AUDIT_WRITE', category: 'UNCLASSIFIED' });
      expect(JSON.stringify(error)).not.toContain('PRIVATE');
    });
});
