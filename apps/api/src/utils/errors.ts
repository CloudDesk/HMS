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
    return new AppError(error.message);
  }

  return new AppError('Unexpected server error');
};
