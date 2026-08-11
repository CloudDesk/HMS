import { AppError } from '../shared/errors/app-error.js';

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
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ValidationError') {
      return new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    if (error && typeof error === 'object' && 'name' in error && error.name === 'CastError') {
      return new AppError('Invalid resource identifier', 400, 'INVALID_ID');
    }
    return new AppError(error.message);
  }

  return new AppError('Unexpected server error');
};
