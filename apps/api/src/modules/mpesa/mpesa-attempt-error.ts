import { AppError } from '../../shared/errors/app-error.js';

export type MpesaCreationStage = 'INVOICE_READ' | 'INDEX_INITIALIZATION' | 'TRANSACTION_START' |
  'ATTEMPT_LOOKUP' | 'INVOICE_REVALIDATION' | 'INVOICE_LOCK' | 'ATTEMPT_WRITE' |
  'ATTEMPT_READBACK' | 'AUDIT_WRITE' | 'TRANSACTION_COMMIT' | 'DUPLICATE_LOOKUP' | 'RESULT_READ';

// Raw MongoDB errors can include credentials, document contents and duplicate
// index values. Only fixed categories and explicitly recognized codes survive.
const databaseCategories = new Map<number, string>([
  [13, 'DATABASE_PERMISSION'], [18, 'DATABASE_AUTHENTICATION'],
  [20, 'TRANSACTIONS_UNSUPPORTED'], [26, 'COLLECTION_MISSING'],
  [50, 'DATABASE_TIMEOUT'], [67, 'INDEX_CREATION_FAILED'],
  [85, 'INDEX_OPTIONS_CONFLICT'], [86, 'INDEX_KEY_CONFLICT'],
  [112, 'WRITE_CONFLICT'], [121, 'DOCUMENT_VALIDATION'],
  [251, 'TRANSACTION_ABORTED'], [11000, 'DUPLICATE_KEY'],
]);

export class MpesaAttemptCreationError extends AppError {
  readonly diagnostic: { stage: MpesaCreationStage; category: string; databaseCode?: number };

  constructor(stage: MpesaCreationStage, error: unknown) {
    super('M-PESA attempt storage unavailable; check status before retrying', 503, 'MPESA_ATTEMPT_UNAVAILABLE');
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    const databaseCategory = typeof code === 'number' ? databaseCategories.get(code) : undefined;
    const name = error instanceof Error ? error.name : undefined;
    this.diagnostic = {
      stage,
      category: databaseCategory ?? (name === 'ValidationError' ? 'MODEL_VALIDATION' :
        name === 'CastError' ? 'MODEL_CAST' : name === 'MongoServerSelectionError' ? 'DATABASE_SELECTION' : 'UNCLASSIFIED'),
      ...(databaseCategory && typeof code === 'number' ? { databaseCode: code } : {}),
    };
  }
}
