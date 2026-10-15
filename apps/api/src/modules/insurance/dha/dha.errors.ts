import { AppError } from '../../../shared/errors/app-error.js';
import type { DhaErrorCode } from './dha.types.js';

export class DhaError extends AppError {
  constructor(
    message: string,
    public override readonly code: DhaErrorCode,
    statusCode = 502,
    details?: unknown,
  ) {
    super(message, statusCode, code, details);
    this.name = 'DhaError';
  }
}
