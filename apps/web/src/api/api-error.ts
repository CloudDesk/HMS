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
