export type ApiErrorCategory =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'HTTP_400'
  | 'HTTP_401'
  | 'HTTP_403'
  | 'HTTP_404'
  | 'HTTP_409'
  | 'HTTP_413'
  | 'HTTP_415'
  | 'HTTP_422'
  | 'HTTP_429'
  | 'HTTP_5XX'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN_ERROR';

export type LegacyApiKind = 'offline' | 'network' | 'server' | 'auth' | 'validation' | 'contract';

export interface ApiFailureOptions {
  category?: ApiErrorCategory;
  kind?: LegacyApiKind;
  status?: number;
  httpStatus?: number;
  code?: string;
  userMessage?: string;
  requestId?: string;
  diagnosticId?: string;
  endpoint?: string;
  method?: string;
  retryable?: boolean;
  timestamp?: string;
  originalError?: unknown;
}

export function generateDiagnosticId(): string {
  const chars = '0123456789ABCDEF';
  let id = 'MOB-';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function resolveCategoryFromKind(kind: LegacyApiKind, status?: number, code?: string): ApiErrorCategory {
  if (kind === 'offline') return 'NETWORK_ERROR';
  if (kind === 'network') return code === 'TIMEOUT' ? 'TIMEOUT' : 'NETWORK_ERROR';
  if (kind === 'server') return 'HTTP_5XX';
  if (kind === 'contract') return 'INVALID_RESPONSE';
  if (kind === 'auth') return status === 403 ? 'HTTP_403' : 'HTTP_401';
  if (kind === 'validation') {
    if (status === 404) return 'HTTP_404';
    if (status === 409) return 'HTTP_409';
    if (status === 413) return 'HTTP_413';
    if (status === 415) return 'HTTP_415';
    if (status === 422) return 'HTTP_422';
    if (status === 429) return 'HTTP_429';
    return 'HTTP_400';
  }
  return 'UNKNOWN_ERROR';
}

function resolveKindFromCategory(category: ApiErrorCategory): LegacyApiKind {
  switch (category) {
    case 'NETWORK_ERROR':
    case 'TIMEOUT':
      return 'network';
    case 'HTTP_401':
    case 'HTTP_403':
      return 'auth';
    case 'HTTP_5XX':
      return 'server';
    case 'INVALID_RESPONSE':
      return 'contract';
    case 'HTTP_400':
    case 'HTTP_404':
    case 'HTTP_409':
    case 'HTTP_413':
    case 'HTTP_415':
    case 'HTTP_422':
    case 'HTTP_429':
      return 'validation';
    default:
      return 'server';
  }
}

function resolveDefaultUserMessage(category: ApiErrorCategory, code?: string, status?: number): string {
  if (code === 'INVALID_OTP' || code === 'INVALID_CREDENTIALS' || code === 'INVALID_PHONE') {
    return 'Invalid phone number or verification code. Please try again.';
  }
  if (code === 'AUTH_RATE_LIMITED') {
    return 'Too many attempts. Please wait before trying again.';
  }
  if (code === 'MAX_ATTEMPTS_EXCEEDED') {
    return 'Too many incorrect codes. Request a new code after the cooldown.';
  }
  if (code === 'SLOT_ALREADY_BOOKED' || code === 'SLOT_UNAVAILABLE') {
    return 'This appointment slot is no longer available. Please select another time.';
  }
  if (code === 'IMAGE_TOO_LARGE' || status === 413) {
    return 'Profile photo must be 5MB or smaller.';
  }
  if (code === 'INVALID_IMAGE_TYPE' || code === 'INVALID_FILE_TYPE' || status === 415) {
    return 'Please select a valid image file (JPG, PNG, WebP, or HEIC).';
  }
  if (code === 'PHOTO_REQUIRED') {
    return 'Please choose a photo to upload.';
  }
  if (code === 'PATIENT_ACCESS_DENIED') {
    return 'You do not have permission to update this patient profile.';
  }
  if (code === 'DUPLICATE_PATIENT') {
    return 'A possible existing patient record was found. Contact hospital staff to link it safely.';
  }
  if (code === 'EXISTING_PATIENT_REQUIRES_ACTIVATION') {
    return 'An existing patient record uses this email or mobile number. Contact hospital staff to activate portal access.';
  }
  if (code === 'DUPLICATE_EMAIL') {
    return 'An account already exists with this email address.';
  }
  if (code === 'DUPLICATE_PHONE') {
    return 'An account already exists with this mobile number.';
  }
  if (code === 'DUPLICATE_USERNAME') {
    return 'An account already exists with this username.';
  }
  if (code === 'INVALID_BRANCH') {
    return 'Please select an active hospital branch.';
  }
  if (code === 'INVALID_REGISTRATION_TOKEN') {
    return 'The registration session is invalid or has expired. Please verify your mobile number again.';
  }
  if (status === 409) {
    return 'Please complete your account setup in Patient Web or contact reception.';
  }

  switch (category) {
    case 'TIMEOUT':
      return 'The service is taking longer than expected to respond. Please check your connection and try again.';
    case 'NETWORK_ERROR':
      return 'Unable to connect. Check your internet connection and try again.';
    case 'HTTP_401':
      return 'Your session has expired. Please sign in again.';
    case 'HTTP_403':
      return 'You do not have permission to perform this action. Please check your patient profile.';
    case 'HTTP_404':
      return 'The requested information or service could not be found.';
    case 'HTTP_409':
      return 'Please complete your account setup in Patient Web or contact reception.';
    case 'HTTP_413':
      return 'Profile photo must be 5MB or smaller.';
    case 'HTTP_415':
      return 'Please select a valid image file (JPG, PNG, WebP, or HEIC).';
    case 'HTTP_422':
      return 'Please check your details and try again.';
    case 'HTTP_429':
      return 'Too many requests. Please wait a moment before trying again.';
    case 'HTTP_5XX':
      return 'Service is temporarily unavailable. Please try again.';
    case 'INVALID_RESPONSE':
      return 'Received an unexpected response from the service. Please try again.';
    case 'HTTP_400':
      return 'Check your details and try again.';
    case 'UNKNOWN_ERROR':
    default:
      return 'Unable to complete this action. Please try again.';
  }
}

function resolveDefaultRetryable(category: ApiErrorCategory, status?: number): boolean {
  if (category === 'NETWORK_ERROR' || category === 'TIMEOUT') return true;
  if (category === 'HTTP_429') return true;
  if (category === 'HTTP_5XX') return true;
  if (status !== undefined && status >= 500) return true;
  return false;
}

export class ApiFailure extends Error {
  readonly category: ApiErrorCategory;
  readonly kind: LegacyApiKind;
  readonly status?: number;
  readonly httpStatus?: number;
  readonly code?: string;
  readonly userMessage: string;
  readonly requestId?: string;
  readonly diagnosticId: string;
  readonly endpoint?: string;
  readonly method?: string;
  readonly retryable: boolean;
  readonly timestamp: string;
  readonly originalError?: unknown;

  constructor(
    kindOrOptions: LegacyApiKind | ApiFailureOptions,
    status?: number,
    code?: string
  ) {
    if (typeof kindOrOptions === 'object' && kindOrOptions !== null) {
      const opts = kindOrOptions;
      const effectiveCategory: ApiErrorCategory =
        opts.category ?? (opts.kind ? resolveCategoryFromKind(opts.kind, opts.status ?? opts.httpStatus, opts.code) : 'UNKNOWN_ERROR');
      const effectiveKind: LegacyApiKind =
        opts.kind ?? resolveKindFromCategory(effectiveCategory);
      const effectiveStatus = opts.status ?? opts.httpStatus;
      const defaultForCode = opts.code ? resolveDefaultUserMessage(effectiveCategory, opts.code, effectiveStatus) : undefined;
      const isKnownCode =
        defaultForCode !== undefined &&
        defaultForCode !== resolveDefaultUserMessage(effectiveCategory, undefined, effectiveStatus);
      const effectiveUserMessage =
        (isKnownCode ? defaultForCode : opts.userMessage) ??
        resolveDefaultUserMessage(effectiveCategory, opts.code, effectiveStatus);

      super(effectiveCategory);

      this.category = effectiveCategory;
      this.kind = effectiveKind;
      this.status = effectiveStatus;
      this.httpStatus = effectiveStatus;
      this.code = opts.code;
      this.userMessage = effectiveUserMessage;
      this.requestId = opts.requestId;
      this.diagnosticId = opts.diagnosticId ?? generateDiagnosticId();
      this.endpoint = opts.endpoint;
      this.method = opts.method;
      this.retryable = opts.retryable ?? resolveDefaultRetryable(effectiveCategory, effectiveStatus);
      this.timestamp = opts.timestamp ?? new Date().toISOString();
      this.originalError = opts.originalError;
    } else {
      const legacyKind = kindOrOptions;
      const effectiveCategory = resolveCategoryFromKind(legacyKind, status, code);
      const effectiveUserMessage = resolveDefaultUserMessage(effectiveCategory, code, status);

      super(legacyKind);

      this.category = effectiveCategory;
      this.kind = legacyKind;
      this.status = status;
      this.httpStatus = status;
      this.code = code;
      this.userMessage = effectiveUserMessage;
      this.diagnosticId = generateDiagnosticId();
      this.retryable = resolveDefaultRetryable(effectiveCategory, status);
      this.timestamp = new Date().toISOString();
    }
  }
}

export function friendlyError(error: unknown): string {
  if (error instanceof ApiFailure) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    if (
      error.name === 'AbortError' ||
      error.message.toLowerCase().includes('timeout') ||
      error.message.toLowerCase().includes('timed out')
    ) {
      return 'The service is taking longer than expected to respond. Please check your connection and try again.';
    }
    if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('fetch')) {
      return 'Unable to connect. Check your internet connection and try again.';
    }
  }
  return 'Unable to complete this action. Please try again.';
}

export function getDiagnosticId(error: unknown): string | undefined {
  if (error instanceof ApiFailure) {
    return error.diagnosticId;
  }
  return undefined;
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiFailure) {
    return error.retryable;
  }
  return false;
}

export function formatDiagnosticDetails(error: unknown): string {
  if (error instanceof ApiFailure) {
    const lines = [
      '--- HMS Mobile Diagnostic Info ---',
      `Diagnostic ID: ${error.diagnosticId}`,
      `Timestamp: ${error.timestamp}`,
      `Category: ${error.category}`,
      `HTTP Status: ${error.status ?? 'N/A'}`,
      `Error Code: ${error.code ?? 'N/A'}`,
      `Server Request ID: ${error.requestId ?? 'N/A'}`,
      `Endpoint: ${error.method ?? 'GET'} ${error.endpoint ?? 'N/A'}`,
      `Retryable: ${error.retryable ? 'Yes' : 'No'}`,
      `User Message: ${error.userMessage}`,
      '-----------------------------------',
    ];
    return lines.join('\n');
  }
  if (error instanceof Error) {
    return [
      '--- HMS Mobile Diagnostic Info ---',
      `Type: ${error.name}`,
      `Message: ${error.message}`,
      '-----------------------------------',
    ].join('\n');
  }
  return `--- HMS Mobile Diagnostic Info ---\nMessage: ${String(error ?? 'Unknown error')}\n-----------------------------------`;
}

export function toApiFailure(error: unknown, fallbackEndpoint?: string, fallbackMethod?: string): ApiFailure {
  if (error instanceof ApiFailure) {
    if ((!error.endpoint && fallbackEndpoint) || (!error.method && fallbackMethod)) {
      return new ApiFailure({
        category: error.category,
        kind: error.kind,
        status: error.status,
        code: error.code,
        userMessage: error.userMessage,
        requestId: error.requestId,
        diagnosticId: error.diagnosticId,
        endpoint: error.endpoint ?? fallbackEndpoint,
        method: error.method ?? fallbackMethod,
        retryable: error.retryable,
        timestamp: error.timestamp,
        originalError: error.originalError,
      });
    }
    return error;
  }

  if (error instanceof Error) {
    if (
      error.name === 'AbortError' ||
      error.message.toLowerCase().includes('timeout') ||
      error.message.toLowerCase().includes('timed out')
    ) {
      return new ApiFailure({
        category: 'TIMEOUT',
        kind: 'network',
        status: 408,
        code: 'TIMEOUT',
        endpoint: fallbackEndpoint,
        method: fallbackMethod,
        retryable: true,
        originalError: error,
      });
    }
    if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('fetch')) {
      return new ApiFailure({
        category: 'NETWORK_ERROR',
        kind: 'network',
        code: 'NETWORK_ERROR',
        endpoint: fallbackEndpoint,
        method: fallbackMethod,
        retryable: true,
        originalError: error,
      });
    }
  }

  return new ApiFailure({
    category: 'UNKNOWN_ERROR',
    kind: 'server',
    code: 'UNKNOWN_ERROR',
    endpoint: fallbackEndpoint,
    method: fallbackMethod,
    retryable: false,
    originalError: error,
  });
}
