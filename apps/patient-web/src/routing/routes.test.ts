import { describe, it, expect } from 'vitest';
import {
  patientRoutes,
  buildPortalBookingUrl,
  parseBookingRouteParams,
  getSafeReturnPath,
} from './routes';

describe('Booking Route Utilities', () => {
  it('builds standard portal booking url with all parameters', () => {
    const url = buildPortalBookingUrl({
      doctorId: 'doc-123',
      branchId: 'branch-456',
      departmentId: 'dept-789',
    });
    expect(url).toBe('/portal?book=doc-123&branch=branch-456&department=dept-789');
  });

  it('builds portal booking url with partial parameters', () => {
    expect(buildPortalBookingUrl({ doctorId: 'doc-123' })).toBe('/portal?book=doc-123');
    expect(buildPortalBookingUrl({})).toBe('/portal');
  });

  it('parses booking parameters from query string in modern and legacy formats', () => {
    const modern = parseBookingRouteParams('?book=doc-1&branch=br-1&department=dp-1');
    expect(modern).toEqual({
      doctorId: 'doc-1',
      branchId: 'br-1',
      departmentId: 'dp-1',
    });

    const legacy = parseBookingRouteParams('?doctor_id=doc-2&branch_id=br-2&department_id=dp-2');
    expect(legacy).toEqual({
      doctorId: 'doc-2',
      branchId: 'br-2',
      departmentId: 'dp-2',
    });
  });

  it('extracts safe return paths and normalizes direct booking query parameters', () => {
    expect(getSafeReturnPath('?return=%2Fportal%3Fbook%3Ddoc-1')).toBe('/portal?book=doc-1');
    expect(getSafeReturnPath('?doctor_id=doc-1&branch_id=br-1')).toBe('/portal?book=doc-1&branch=br-1');
    expect(getSafeReturnPath('?book=doc-2')).toBe('/portal?book=doc-2');
    expect(getSafeReturnPath('?return=https://evil.com')).toBe(null);
    expect(getSafeReturnPath('?return=//evil.com')).toBe(null);
    expect(getSafeReturnPath('')).toBe(null);
  });

  it('provides typed route builders through patientRoutes', () => {
    expect(patientRoutes.home()).toBe('/');
    expect(patientRoutes.login()).toBe('/login');
    expect(patientRoutes.login({ returnUrl: '/portal?tab=billing', reason: 'session-expired' })).toBe(
      '/login?return=%2Fportal%3Ftab%3Dbilling&reason=session-expired'
    );
    expect(patientRoutes.signup({ returnUrl: '/portal' })).toBe('/signup?return=%2Fportal');
    expect(patientRoutes.portal()).toBe('/portal');
    expect(patientRoutes.portal({ tab: 'appointments', book: 'doc-5' })).toBe(
      '/portal?tab=appointments&book=doc-5'
    );
  });
});
