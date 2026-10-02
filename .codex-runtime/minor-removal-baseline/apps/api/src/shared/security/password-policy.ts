import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

export type PasswordPolicy = {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
};

export const getEnvironmentPasswordPolicy = (): PasswordPolicy => ({
  minLength: env.auth.passwordPolicy.minLength,
  requireUppercase: env.auth.passwordPolicy.requireUppercase,
  requireLowercase: env.auth.passwordPolicy.requireLowercase,
  requireNumber: env.auth.passwordPolicy.requireNumber,
  requireSymbol: env.auth.passwordPolicy.requireSymbol,
});

export const getEffectivePasswordPolicy = (
  preferences: { passwordMinLength: number; requireStrongPasswords: boolean } | null,
): PasswordPolicy => {
  const fallback = getEnvironmentPasswordPolicy();
  if (
    !preferences
    || !Number.isInteger(preferences.passwordMinLength)
    || preferences.passwordMinLength < 6
    || preferences.passwordMinLength > 32
  ) {
    return fallback;
  }

  return {
    minLength: preferences.passwordMinLength,
    requireUppercase: preferences.requireStrongPasswords && fallback.requireUppercase,
    requireLowercase: preferences.requireStrongPasswords && fallback.requireLowercase,
    requireNumber: preferences.requireStrongPasswords && fallback.requireNumber,
    requireSymbol: preferences.requireStrongPasswords && fallback.requireSymbol,
  };
};

export const assertPasswordPolicy = (
  password: string,
  policy: PasswordPolicy = getEnvironmentPasswordPolicy(),
) => {
  const errors: string[] = [];

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
