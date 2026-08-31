import { AppError } from '../shared/errors/app-error.js';

type MongooseValidationError = Error & {
  name: 'ValidationError';
  errors: Record<string, { message?: string }>;
};

const isMongooseValidationError = (error: Error): error is MongooseValidationError =>
  error.name === 'ValidationError' &&
  'errors' in error &&
  typeof error.errors === 'object' &&
  error.errors !== null;

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
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return new AppError('Conflict: A record with these details already exists.', 409, 'UNIQUE_VIOLATION');
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
