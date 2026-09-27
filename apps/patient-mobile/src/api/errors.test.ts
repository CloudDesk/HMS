import { describe, expect, it } from 'vitest';
import {
  ApiFailure,
  formatDiagnosticDetails,
  friendlyError,
  generateDiagnosticId,
  getDiagnosticId,
  isRetryable,
  toApiFailure,
  type ApiErrorCategory,
} from './errors';

describe('Centralized API Error & Diagnostic System', () => {
  describe('generateDiagnosticId', () => {
    it('generates a MOB- prefixed alphanumeric string', () => {
      const id = generateDiagnosticId();
      expect(id).toMatch(/^MOB-[0-9A-F]{6}$/);
    });

    it('generates unique IDs across calls', () => {
      const id1 = generateDiagnosticId();
      const id2 = generateDiagnosticId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('ApiFailure construction & taxonomy mapping', () => {
    it('supports legacy constructor: (kind, status, code)', () => {
      const err = new ApiFailure('auth', 401, 'INVALID_OTP');
      expect(err.kind).toBe('auth');
      expect(err.category).toBe('HTTP_401');
      expect(err.status).toBe(401);
      expect(err.httpStatus).toBe(401);
      expect(err.code).toBe('INVALID_OTP');
      expect(err.userMessage).toBe('Invalid phone number or verification code. Please try again.');
      expect(err.diagnosticId).toMatch(/^MOB-[0-9A-F]{6}$/);
      expect(err.retryable).toBe(false);
    });

    it('maps offline kind to NETWORK_ERROR with retryable=true', () => {
      const err = new ApiFailure('offline');
      expect(err.category).toBe('NETWORK_ERROR');
      expect(err.kind).toBe('offline');
      expect(err.retryable).toBe(true);
      expect(err.userMessage).toBe('Unable to connect. Check your internet connection and try again.');
    });

    it('maps network kind with TIMEOUT code to TIMEOUT category', () => {
      const err = new ApiFailure('network', 408, 'TIMEOUT');
      expect(err.category).toBe('TIMEOUT');
      expect(err.kind).toBe('network');
      expect(err.retryable).toBe(true);
      expect(err.userMessage).toBe(
        'The service is taking longer than expected to respond. Please check your connection and try again.'
      );
    });

    it('maps server kind to HTTP_5XX with retryable=true', () => {
      const err = new ApiFailure('server', 503);
      expect(err.category).toBe('HTTP_5XX');
      expect(err.status).toBe(503);
      expect(err.retryable).toBe(true);
      expect(err.userMessage).toBe('Service is temporarily unavailable. Please try again.');
    });

    it('maps contract kind to INVALID_RESPONSE with retryable=false', () => {
      const err = new ApiFailure('contract');
      expect(err.category).toBe('INVALID_RESPONSE');
      expect(err.retryable).toBe(false);
      expect(err.userMessage).toBe('Received an unexpected response from the service. Please try again.');
    });

    it('supports options object constructor with rich metadata', () => {
      const err = new ApiFailure({
        category: 'HTTP_429',
        code: 'AUTH_RATE_LIMITED',
        status: 429,
        requestId: 'req-prod-9876',
        endpoint: '/patient-portal/login/otp',
        method: 'POST',
        diagnosticId: 'MOB-TEST01',
      });

      expect(err.category).toBe('HTTP_429');
      expect(err.kind).toBe('validation');
      expect(err.status).toBe(429);
      expect(err.code).toBe('AUTH_RATE_LIMITED');
      expect(err.requestId).toBe('req-prod-9876');
      expect(err.endpoint).toBe('/patient-portal/login/otp');
      expect(err.method).toBe('POST');
      expect(err.diagnosticId).toBe('MOB-TEST01');
      expect(err.retryable).toBe(true);
      expect(err.userMessage).toBe('Too many attempts. Please wait before trying again.');
    });

    it('covers all standard categories: 400, 403, 404, 409, 422', () => {
      const categories: ApiErrorCategory[] = [
        'HTTP_400',
        'HTTP_403',
        'HTTP_404',
        'HTTP_409',
        'HTTP_422',
      ];

      for (const cat of categories) {
        const err = new ApiFailure({ category: cat });
        expect(err.category).toBe(cat);
        expect(typeof err.userMessage).toBe('string');
        expect(err.userMessage.length).toBeGreaterThan(5);
      }
    });
  });

  describe('friendlyError', () => {
    it('extracts userMessage from ApiFailure', () => {
      const err = new ApiFailure('auth', 401, 'INVALID_CREDENTIALS');
      expect(friendlyError(err)).toBe('Invalid phone number or verification code. Please try again.');
    });

    it('handles generic Error objects gracefully', () => {
      const netErr = new Error('Network request failed');
      expect(friendlyError(netErr)).toBe('Unable to connect. Check your internet connection and try again.');

      const timeoutErr = new Error('The operation timed out');
      expect(friendlyError(timeoutErr)).toBe(
        'The service is taking longer than expected to respond. Please check your connection and try again.'
      );

      const unknownErr = new Error('Random runtime glitch');
      expect(friendlyError(unknownErr)).toBe('Unable to complete this action. Please try again.');
    });

    it('handles non-error objects gracefully', () => {
      expect(friendlyError(null)).toBe('Unable to complete this action. Please try again.');
      expect(friendlyError('string error')).toBe('Unable to complete this action. Please try again.');
    });
  });

  describe('formatDiagnosticDetails & sensitive data safety', () => {
    it('formats clean, redacted diagnostic string with no secrets', () => {
      const err = new ApiFailure({
        category: 'HTTP_5XX',
        status: 504,
        code: 'GATEWAY_TIMEOUT',
        requestId: 'req-fastify-1234',
        endpoint: '/patient-portal/appointments',
        method: 'POST',
        diagnosticId: 'MOB-SEC001',
      });

      const formatted = formatDiagnosticDetails(err);
      expect(formatted).toContain('Diagnostic ID: MOB-SEC001');
      expect(formatted).toContain('Category: HTTP_5XX');
      expect(formatted).toContain('HTTP Status: 504');
      expect(formatted).toContain('Error Code: GATEWAY_TIMEOUT');
      expect(formatted).toContain('Server Request ID: req-fastify-1234');
      expect(formatted).toContain('Endpoint: POST /patient-portal/appointments');
      expect(formatted).toContain('Retryable: Yes');

      // Ensure no passwords, tokens, cookies, or Mongo IDs leaked
      expect(formatted).not.toContain('Bearer');
      expect(formatted).not.toContain('password');
      expect(formatted).not.toContain('cookie');
      expect(formatted).not.toContain('token');
    });

    it('formats plain Error objects safely', () => {
      const err = new Error('Socket closed abruptly');
      const formatted = formatDiagnosticDetails(err);
      expect(formatted).toContain('Type: Error');
      expect(formatted).toContain('Message: Socket closed abruptly');
    });
  });

  describe('helper functions: getDiagnosticId, isRetryable, toApiFailure', () => {
    it('getDiagnosticId extracts ID if available', () => {
      const err = new ApiFailure('server', 500);
      expect(getDiagnosticId(err)).toBe(err.diagnosticId);
      expect(getDiagnosticId(new Error())).toBeUndefined();
    });

    it('isRetryable checks transient error conditions', () => {
      expect(isRetryable(new ApiFailure('offline'))).toBe(true);
      expect(isRetryable(new ApiFailure('server', 500))).toBe(true);
      expect(isRetryable(new ApiFailure('auth', 401))).toBe(false);
      expect(isRetryable(new ApiFailure({ category: 'HTTP_400' }))).toBe(false);
      expect(isRetryable(new Error())).toBe(false);
    });

    it('toApiFailure normalizes various error types', () => {
      const abort = new Error('AbortError: user cancelled');
      abort.name = 'AbortError';
      const failure1 = toApiFailure(abort, '/patient-portal/test', 'GET');
      expect(failure1.category).toBe('TIMEOUT');
      expect(failure1.endpoint).toBe('/patient-portal/test');
      expect(failure1.method).toBe('GET');

      const net = new Error('TypeError: Failed to fetch');
      const failure2 = toApiFailure(net);
      expect(failure2.category).toBe('NETWORK_ERROR');

      const existing = new ApiFailure('auth', 401);
      const failure3 = toApiFailure(existing, '/patient-portal/login', 'POST');
      expect(failure3.endpoint).toBe('/patient-portal/login');
      expect(failure3.method).toBe('POST');
    });
  });
});
