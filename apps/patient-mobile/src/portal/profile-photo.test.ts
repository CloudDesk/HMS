import { describe, expect, it, vi } from 'vitest';
import { getInitials } from './formatters';
import { PortalApi, normalizeImageUpload } from './portal-api';
import { portalPatientSchema, portalPatientDetailSchema } from './contracts';
import type { SessionManager } from '../auth/session-manager';

describe('Patient Mobile Profile Photo Unit Tests', () => {
  describe('1. Initials Generation for Fallback Avatar', () => {
    it('generates initials for standard two-word name', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('generates initials from first and last words of multi-word name', () => {
      expect(getInitials('Jane Marie Smith')).toBe('JS');
    });

    it('generates single initial for single-word name', () => {
      expect(getInitials('Alice')).toBe('A');
    });

    it('returns placeholder for empty or whitespace-only name', () => {
      expect(getInitials('')).toBe('—');
      expect(getInitials('   ')).toBe('—');
    });

    it('handles lowercase names and trims extra whitespace', () => {
      expect(getInitials('  kamesh   kumar  ')).toBe('KK');
    });
  });

  describe('2. Contract Schema Validation with profile_photo_url', () => {
    it('validates portal patient with profile_photo_url present', () => {
      const parsed = portalPatientSchema.parse({
        id: 'p-101',
        patient_number: 'HMS-2026-000001',
        full_name: 'John Doe',
        date_of_birth: '1990-05-15',
        gender: 'MALE',
        relationship: 'SELF',
        is_primary: true,
        profile_photo_url: '/api/patient-portal/patients/p-101/profile-photo?v=12345',
      });
      expect(parsed.profile_photo_url).toBe('/api/patient-portal/patients/p-101/profile-photo?v=12345');
    });

    it('validates portal patient with profile_photo_url as null or omitted', () => {
      const parsed = portalPatientSchema.parse({
        id: 'p-102',
        patient_number: 'HMS-2026-000002',
        full_name: 'Baby Doe',
        date_of_birth: '2022-01-01',
        gender: 'FEMALE',
        relationship: 'PARENT',
        is_primary: false,
        profile_photo_url: null,
      });
      expect(parsed.profile_photo_url).toBeNull();
    });

    it('validates portal patient detail with profile_photo_url', () => {
      const parsed = portalPatientDetailSchema.parse({
        id: 'p-101',
        patient_number: 'HMS-2026-000001',
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1990-05-15',
        gender: 'MALE',
        status: 'ACTIVE',
        created_at: '2026-01-01T00:00:00.000Z',
        profile_photo_url: '/api/patient-portal/patients/p-101/profile-photo?v=99999',
      });
      expect(parsed.profile_photo_url).toBe('/api/patient-portal/patients/p-101/profile-photo?v=99999');
    });
  });

  describe('3. normalizeImageUpload normalization for mobile uploads', () => {
    it('handles image with full details', () => {
      const normalized = normalizeImageUpload({
        uri: 'file:///data/user/0/com.hms.mycare/cache/ImagePicker/test.png',
        name: 'avatar.png',
        type: 'image/png',
      });
      expect(normalized.uri).toBe('file:///data/user/0/com.hms.mycare/cache/ImagePicker/test.png');
      expect(normalized.name).toBe('avatar.png');
      expect(normalized.type).toBe('image/png');
    });

    it('derives MIME type and extension when name and type are missing', () => {
      const normalized = normalizeImageUpload({
        uri: 'file:///data/user/0/com.hms.mycare/cache/ImagePicker/image.webp',
      });
      expect(normalized.type).toBe('image/webp');
      expect(normalized.name).toMatch(/^profile-\d+\.webp$/);
    });

    it('normalizes image/jpg to image/jpeg', () => {
      const normalized = normalizeImageUpload({
        uri: 'file:///data/user/0/com.hms.mycare/cache/ImagePicker/image.jpg',
        name: 'photo',
        type: 'image/jpg',
      });
      expect(normalized.type).toBe('image/jpeg');
      expect(normalized.name).toBe('photo.jpg');
    });

    it('defaults to image/jpeg and generates name when no metadata is provided', () => {
      const normalized = normalizeImageUpload({
        uri: 'file:///data/user/0/com.hms.mycare/cache/ImagePicker/captured_camera_asset',
      });
      expect(normalized.type).toBe('image/jpeg');
      expect(normalized.name).toMatch(/^profile-\d+\.jpg$/);
    });
  });

  describe('4. PortalApi Profile Photo Methods', () => {
    it('calls authenticatedMultipartRequest when uploading photo', async () => {
      const mockSessionManager = {
        authenticatedMultipartRequest: vi.fn().mockResolvedValue({
          success: true,
          patient_id: 'p-101',
          profile_photo_url: '/api/patient-portal/patients/p-101/profile-photo?v=170000000',
        }),
      } as unknown as SessionManager;

      const api = new PortalApi(mockSessionManager);
      const result = await api.uploadProfilePhoto('p-101', {
        uri: 'file:///data/user/0/com.hms.patient/cache/photo.jpg',
        name: 'my-avatar.jpg',
        type: 'image/jpeg',
      });

      expect(result.success).toBe(true);
      expect(result.profile_photo_url).toBe('/api/patient-portal/patients/p-101/profile-photo?v=170000000');
      expect(mockSessionManager.authenticatedMultipartRequest).toHaveBeenCalledWith(
        '/patient-portal/patients/p-101/profile-photo',
        expect.anything(),
        expect.any(FormData),
      );
    });

    it('calls authenticatedRequest with DELETE method when removing photo', async () => {
      const mockSessionManager = {
        authenticatedRequest: vi.fn().mockResolvedValue({
          success: true,
          patient_id: 'p-101',
        }),
      } as unknown as SessionManager;

      const api = new PortalApi(mockSessionManager);
      const result = await api.deleteProfilePhoto('p-101');

      expect(result.success).toBe(true);
      expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
        '/patient-portal/patients/p-101/profile-photo',
        expect.anything(),
        { method: 'DELETE' },
      );
    });
  });
});

