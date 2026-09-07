export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code = 'API_ERROR', requestId?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

export const getFriendlyAuthMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS' || error.status === 401) {
      return 'The username or password you entered is not valid.';
    }

    if (error.status === 403) {
      return 'Your account is not allowed to start a session. Please contact your administrator.';
    }

    if (error.status >= 500) {
      return 'The authentication service is currently unavailable. Please try again shortly.';
    }
  }

  return 'We could not complete the sign in request. Please try again.';
};

export type GenericSetError<T = Record<string, unknown>> = (
  field: keyof T | string,
  error: { type?: string; message?: string },
) => void;

export function applyApiValidationErrors<T extends Record<string, unknown> = Record<string, unknown>>(
  error: unknown,
  setError: GenericSetError<T>,
): boolean {
  if (!(error instanceof ApiError) || !error.details) {
    return false;
  }

  let applied = false;
  const raw = error.details;

  // 1. Array format (Ajv / Fastify validation / Zod error array)
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null && Array.isArray((raw as Record<string, unknown>).validation)
      ? (raw as Record<string, unknown>).validation as unknown[]
      : typeof raw === 'object' && raw !== null && Array.isArray((raw as Record<string, unknown>).errors)
        ? (raw as Record<string, unknown>).errors as unknown[]
        : null;

  if (list && Array.isArray(list)) {
    for (const item of list) {
      if (typeof item === 'object' && item !== null) {
        const itemObj = item as Record<string, unknown>;
        // Ajv instancePath e.g. "/fieldName" or "/nested/field"
        let fieldName: string | undefined;
        if (typeof itemObj.instancePath === 'string' && itemObj.instancePath.length > 1) {
          fieldName = itemObj.instancePath.replace(/^\//, '').replace(/\//g, '.');
        } else if (itemObj.params && typeof itemObj.params === 'object' && (itemObj.params as Record<string, unknown>).missingProperty) {
          fieldName = String((itemObj.params as Record<string, unknown>).missingProperty);
        } else if (Array.isArray(itemObj.path) && itemObj.path.length > 0) {
          fieldName = itemObj.path.join('.');
        } else if (typeof itemObj.field === 'string') {
          fieldName = itemObj.field;
        }

        const msg = typeof itemObj.message === 'string' ? itemObj.message : 'Invalid value';
        if (fieldName) {
          setError(fieldName as keyof T, { type: 'server', message: msg });
          applied = true;
        }
      }
    }
    return applied;
  }

  // 2. Object format (key-value map e.g. { email: 'Email already exists' })
  if (typeof raw === 'object' && raw !== null) {
    const rawObj = raw as Record<string, unknown>;
    const targetMap = (typeof rawObj.validation === 'object' && rawObj.validation !== null && !Array.isArray(rawObj.validation))
      ? rawObj.validation as Record<string, unknown>
      : (typeof rawObj.errors === 'object' && rawObj.errors !== null && !Array.isArray(rawObj.errors))
        ? rawObj.errors as Record<string, unknown>
        : rawObj;

    for (const [field, message] of Object.entries(targetMap)) {
      if (typeof message === 'string' && message) {
        setError(field as keyof T, { type: 'server', message });
        applied = true;
      } else if (Array.isArray(message) && message.length > 0 && typeof message[0] === 'string') {
        setError(field as keyof T, { type: 'server', message: message[0] });
        applied = true;
      }
    }
  }

  return applied;
}

