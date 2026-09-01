import { AppError } from '../shared/errors/app-error.js';

type MongooseValidationError = Error & {
  name: 'ValidationError';
  errors: Record<string, { message?: string }>;
};

type MongoDuplicateKeyError = Error & {
  code: 11000;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
};

const isMongooseValidationError = (error: Error): error is MongooseValidationError =>
  error.name === 'ValidationError' &&
  'errors' in error &&
  typeof error.errors === 'object' &&
  error.errors !== null;

const isMongoDuplicateKeyError = (error: Error): error is MongoDuplicateKeyError =>
  'code' in error && error.code === 11000;

const hasDuplicateField = (error: MongoDuplicateKeyError, field: string) =>
  Boolean(error.keyPattern && field in error.keyPattern);

const hasStringDuplicateValue = (error: MongoDuplicateKeyError, field: string) =>
  typeof error.keyValue?.[field] === 'string';

const hasObjectIdDuplicateValue = (error: MongoDuplicateKeyError, field: string) => {
  const value = error.keyValue?.[field];
  return (
    typeof value === 'object' &&
    value !== null &&
    '_bsontype' in value &&
    value._bsontype === 'ObjectId'
  );
};

const isDuplicateFromCollection = (error: MongoDuplicateKeyError, collection: string) =>
  error.message.includes(`.${collection}`);

const duplicateKeyAppError = (error: MongoDuplicateKeyError) => {
  if (
    hasDuplicateField(error, 'confirmIdempotencyKey') &&
    hasStringDuplicateValue(error, 'confirmIdempotencyKey')
  ) {
    return new AppError(
      'This dispensing confirmation request has already been processed.',
      409,
      'DISPENSING_CONFIRMATION_IDEMPOTENCY_CONFLICT',
    );
  }

  if (
    hasDuplicateField(error, 'reverseIdempotencyKey') &&
    hasStringDuplicateValue(error, 'reverseIdempotencyKey')
  ) {
    return new AppError(
      'This dispensing reversal request has already been processed.',
      409,
      'DISPENSING_REVERSAL_IDEMPOTENCY_CONFLICT',
    );
  }

  if (
    hasDuplicateField(error, 'confirmIdempotencyKey') ||
    hasDuplicateField(error, 'reverseIdempotencyKey')
  ) {
    return new AppError(
      'The dispensing draft could not be created because of an invalid empty idempotency key.',
      409,
      'DISPENSING_IDEMPOTENCY_INDEX_CONFLICT',
    );
  }

  if (hasDuplicateField(error, 'prescriptionId')) {
    return new AppError(
      'Dispensing has already been started for this prescription.',
      409,
      'DISPENSING_ALREADY_EXISTS',
    );
  }

  if (hasDuplicateField(error, 'invoiceNumber')) {
    return new AppError(
      'An invoice with this number already exists. Please retry creating the invoice.',
      409,
      'INVOICE_NUMBER_CONFLICT',
    );
  }

  if (
    isDuplicateFromCollection(error, 'billing_invoices') &&
    (hasDuplicateField(error, 'encounterId') || hasDuplicateField(error, 'visitId'))
  ) {
    return new AppError(
      'An invoice already exists for this encounter.',
      409,
      'INVOICE_ALREADY_EXISTS_FOR_ENCOUNTER',
    );
  }

  if (
    hasDuplicateField(error, 'contextId') &&
    hasObjectIdDuplicateValue(error, 'contextId')
  ) {
    return new AppError(
      'An invoice already exists for this billing context.',
      409,
      'INVOICE_ALREADY_EXISTS_FOR_CONTEXT',
    );
  }

  if (hasDuplicateField(error, 'activeSlotKey')) {
    return new AppError(
      'This doctor already has an appointment at the selected date and time. Choose another slot.',
      409,
      'APPOINTMENT_SLOT_CONFLICT',
    );
  }

  if (hasDuplicateField(error, 'appointmentNumber')) {
    return new AppError(
      'An appointment with this number already exists. Please retry booking the appointment.',
      409,
      'APPOINTMENT_NUMBER_CONFLICT',
    );
  }

  if (hasDuplicateField(error, 'appointmentId')) {
    return new AppError(
      'An OPD visit already exists for this appointment.',
      409,
      'DUPLICATE_OPD_VISIT',
    );
  }

  if (hasDuplicateField(error, 'visitNumber')) {
    return new AppError(
      'An OPD visit with this number already exists. Please retry check-in.',
      409,
      'OPD_VISIT_NUMBER_CONFLICT',
    );
  }

  return new AppError(
    'A record with the same unique details already exists.',
    409,
    'UNIQUE_VIOLATION',
  );
};

export const toAppError = (error: unknown) => {
  if (error instanceof AppError) {
    return error;
  }

  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;
    const message =
      'message' in error && typeof error.message === 'string'
        ? error.message
        : 'Unexpected server error';
    const code =
      'code' in error && typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR';

    return new AppError(message, statusCode, code);
  }

  if (error instanceof Error) {
    // MongoDB duplicate key error
    if (isMongoDuplicateKeyError(error)) {
      return duplicateKeyAppError(error);
    }
    if (isMongooseValidationError(error)) {
      const fieldErrors = Object.entries(error.errors).reduce<Record<string, string[]>>(
        (accumulator, [field, validationError]) => {
          accumulator[field] = [validationError.message ?? 'Invalid value'];
          return accumulator;
        },
        {},
      );
      return new AppError(
        error.message || 'Validation failed',
        400,
        'VALIDATION_ERROR',
        { fieldErrors },
      );
    }
    if (error && typeof error === 'object' && 'name' in error && error.name === 'CastError') {
      return new AppError('Invalid resource identifier', 400, 'INVALID_ID');
    }
    return new AppError(error.message);
  }

  return new AppError('Unexpected server error');
};
