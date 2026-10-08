export type DhaConfig = {
  enabled: boolean;
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
};

export type DhaTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

export type DhaTokenCache = {
  accessToken: string;
  tokenType: string;
  expiresAt: number; // Unix timestamp in milliseconds
};

export type DhaRequestOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  skipAuth?: boolean;
  correlationId?: string;
  signal?: AbortSignal;
};

export type DhaResponse<T = unknown> = {
  status: number;
  data: T;
  headers: Headers;
};

export type DhaErrorCode =
  | 'DHA_INTEGRATION_DISABLED'
  | 'DHA_CONFIGURATION_MISSING'
  | 'DHA_AUTHENTICATION_FAILED'
  | 'DHA_AUTHENTICATION_TIMEOUT'
  | 'DHA_AUTHENTICATION_UNAVAILABLE'
  | 'DHA_INVALID_TOKEN_RESPONSE'
  | 'DHA_REQUEST_TIMEOUT'
  | 'DHA_REQUEST_FAILED';
