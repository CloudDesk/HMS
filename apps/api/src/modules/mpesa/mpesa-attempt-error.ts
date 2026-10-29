import { AppError } from '../../shared/errors/app-error.js';
import mongoose from 'mongoose';

export type MpesaCreationStage = 'INVOICE_READ' | 'INDEX_INITIALIZATION' | 'INDEX_INSPECTION' | 'INDEX_BUILD' | 'TRANSACTION_START' |
  'ATTEMPT_LOOKUP' | 'INVOICE_REVALIDATION' | 'INVOICE_LOCK' | 'ATTEMPT_WRITE' |
  'ATTEMPT_READBACK' | 'AUDIT_WRITE' | 'TRANSACTION_COMMIT' | 'DUPLICATE_LOOKUP' | 'RESULT_READ';

// Raw MongoDB errors can include credentials, document contents and duplicate
// index values. Only fixed categories and validated public database codes survive.
const databaseCategories = new Map<number, string>([
  [13, 'DATABASE_PERMISSION'], [18, 'DATABASE_AUTHENTICATION'],
  [20, 'TRANSACTIONS_UNSUPPORTED'], [26, 'COLLECTION_MISSING'],
  [50, 'DATABASE_TIMEOUT'], [67, 'INDEX_CREATION_FAILED'],
  [85, 'INDEX_OPTIONS_CONFLICT'], [86, 'INDEX_KEY_CONFLICT'],
  [112, 'WRITE_CONFLICT'], [121, 'DOCUMENT_VALIDATION'],
  [251, 'TRANSACTION_ABORTED'], [11000, 'DUPLICATE_KEY'],
]);

const errorCategories = new Map<string, string>([
  ['ValidationError', 'MODEL_VALIDATION'], ['CastError', 'MODEL_CAST'],
  ['MongoServerSelectionError', 'DATABASE_SELECTION'], ['MongoServerError', 'DATABASE_COMMAND'],
  ['MongoNetworkError', 'DATABASE_NETWORK'], ['MongoNetworkTimeoutError', 'DATABASE_NETWORK_TIMEOUT'],
  ['MongoParseError', 'DATABASE_URI_OPTIONS'], ['MongoCompatibilityError', 'DATABASE_COMPATIBILITY'],
  ['MongoAPIError', 'DATABASE_DRIVER_API'], ['MongoUnexpectedServerResponseError', 'DATABASE_RESPONSE'],
  ['MongooseError', 'MONGOOSE_ERROR'], ['TypeError', 'JAVASCRIPT_TYPE_ERROR'], ['ReferenceError', 'JAVASCRIPT_REFERENCE_ERROR'],
]);

export class MpesaAttemptCreationError extends AppError {
  readonly diagnostic: { stage: MpesaCreationStage; category: string; databaseCode?: number };

  constructor(stage: MpesaCreationStage, error: unknown) {
    super('M-PESA attempt storage unavailable; check status before retrying', 503, 'MPESA_ATTEMPT_UNAVAILABLE');
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    const databaseCategory = typeof code === 'number' ? databaseCategories.get(code) : undefined;
    const name = error instanceof Error ? error.name : undefined;
    // Unknown public driver codes are useful for diagnosis. Do not copy arbitrary
    // numeric properties from generic errors (which may contain application data).
    const safeDriverCode = error instanceof mongoose.mongo.MongoServerError && typeof code === 'number' &&
      Number.isInteger(code) && code >= 0 && code <= 100000;
    this.diagnostic = {
      stage,
      category: databaseCategory ?? (name ? errorCategories.get(name) : undefined) ?? 'UNCLASSIFIED',
      ...((databaseCategory || safeDriverCode) && typeof code === 'number' ? { databaseCode: code } : {}),
    };
  }
}
