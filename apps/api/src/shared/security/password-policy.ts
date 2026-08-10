import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

export const assertPasswordPolicy = (password: string) => {
  const errors: string[] = [];
  const policy = env.auth.passwordPolicy;

  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must include an uppercase letter');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must include a lowercase letter');
  }

  if (policy.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must include a number');
  }

  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must include a symbol');
  }

  if (errors.length > 0) {
    throw new AppError('Password policy failed', 400, 'PASSWORD_POLICY_FAILED', errors);
  }
};
