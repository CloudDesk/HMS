import { describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { PatientPortalService } from './patient-portal.service.js';
import type { PatientPortalRepository } from './patient-portal.repository.js';
import { PatientService } from '../patients/patient.service.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { PatientDocumentStorageService } from '../../shared/storage/patient-document-storage.service.js';
import type { SequenceService } from '../../shared/sequence/sequence.service.js';
import type { UserService } from '../users/user.service.js';
import type { AppointmentService } from '../appointments/appointment.service.js';
import type { DoctorService } from '../doctors/doctor.service.js';
import type { PatientOtpService } from './patient-otp.service.js';

describe('Patient Profile Photo End-to-End Unit Tests', () => {
  const userId = new Types.ObjectId().toString();
  const primaryPatientId = new Types.ObjectId().toString();
  const dependentPatientId = new Types.ObjectId().toString();
  const unlinkedPatientId = new Types.ObjectId().toString();

  const mockStorageService = {
    uploadPatientDocument: vi.fn().mockResolvedValue({ storageKey: 'patients/p1/profile-photo/photo.jpg' }),
    download: vi.fn().mockResolvedValue({ data: Buffer.from('fake-jpeg-bytes'), contentType: null }),
    deleteIfExists: vi.fn().mockResolvedValue(undefined),
  } as unknown as PatientDocumentStorageService;

  const mockPatientRepo = {} as PatientRepository;
  const mockSequenceService = {} as SequenceService;

  const patientService = new PatientService(
    mockPatientRepo,
    mockStorageService,
    mockSequenceService,
  );

  describe('1. PatientService Profile Photo Storage and Validation', () => {
    it('successfully uploads valid JPEG profile photo', async () => {
      const buffer = Buffer.from('valid-image-bytes');
      const result = await patientService.uploadProfilePhotoFile(primaryPatientId, {
        fileName: 'avatar.jpg',
        mimeType: 'image/jpeg',
        data: buffer,
      });

      expect(result.storageKey).toBe('patients/p1/profile-photo/photo.jpg');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.fileSizeBytes).toBe(buffer.byteLength);
      expect(result.uploadedAt).toBeInstanceOf(Date);
      expect(mockStorageService.uploadPatientDocument).toHaveBeenCalledWith({
        patientId: primaryPatientId,
        fileName: 'avatar.jpg',
        mimeType: 'image/jpeg',
        data: buffer,
      });
    });

    it('rejects invalid image MIME types (e.g. application/pdf)', async () => {
      await expect(
        patientService.uploadProfilePhotoFile(primaryPatientId, {
          fileName: 'document.pdf',
          mimeType: 'application/pdf',
          data: Buffer.from('pdf-bytes'),
        })
      ).rejects.toThrow(new AppError('Only JPEG, PNG, WEBP, or HEIC image files are supported', 400, 'INVALID_IMAGE_TYPE'));
    });

    it('rejects images larger than 5MB', async () => {
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024);
      await expect(
        patientService.uploadProfilePhotoFile(primaryPatientId, {
          fileName: 'huge.png',
          mimeType: 'image/png',
          data: oversizedBuffer,
        })
      ).rejects.toThrow(new AppError('Profile photo must be 5MB or smaller', 400, 'IMAGE_TOO_LARGE'));
    });

    it('downloads profile photo data from storage', async () => {
      const downloaded = await patientService.downloadProfilePhotoFile('patients/p1/profile-photo/photo.jpg');
      expect(downloaded.data.toString()).toBe('fake-jpeg-bytes');
      expect(downloaded.contentType).toBeNull();
    });

    it('deletes profile photo from storage', async () => {
      await patientService.deleteProfilePhotoFile('patients/p1/profile-photo/photo.jpg');
      expect(mockStorageService.deleteIfExists).toHaveBeenCalledWith('patients/p1/profile-photo/photo.jpg');
    });
  });

  describe('2. PatientPortalService Authorization and Profile Photo Lifecycle', () => {
    const mockPortalRepo = {
      resolveAccessiblePatientId: vi.fn().mockImplementation((uid: string, pid?: string) => {
        if (uid === userId && (pid === primaryPatientId || pid === dependentPatientId)) {
          return pid;
        }
        return null;
      }),
      getPatientProfilePhoto: vi.fn(),
      updatePatientProfilePhoto: vi.fn(),
      deletePatientProfilePhoto: vi.fn(),
    } as unknown as PatientPortalRepository;

    const portalService = new PatientPortalService(
      mockPortalRepo,
      {} as UserService,
      {} as AppointmentService,
      {} as DoctorService,
      patientService,
      {} as PatientOtpService,
    );

    it('uploads new profile photo for authorized patient and cleans up previous file', async () => {
      const previousStorageKey = 'patients/p1/profile-photo/old.jpg';
      vi.mocked(mockPortalRepo.getPatientProfilePhoto).mockResolvedValueOnce({
        storageKey: previousStorageKey,
        mimeType: 'image/jpeg',
        fileSizeBytes: 1024,
        uploadedAt: new Date(),
      });
      vi.mocked(mockPortalRepo.updatePatientProfilePhoto).mockResolvedValueOnce({
        _id: new Types.ObjectId(primaryPatientId),
        patientNumber: 'HMS-2026-000001',
      } as unknown as { _id: Types.ObjectId; patientNumber: string });

      const buffer = Buffer.from('new-photo-bytes');
      const result = await portalService.replaceProfilePhoto(userId, primaryPatientId, {
        fileName: 'selfie.jpg',
        mimeType: 'image/jpeg',
        data: buffer,
      });

      expect(result.success).toBe(true);
      expect(result.patient_id).toBe(primaryPatientId);
      expect(result.profile_photo_url).toContain(`/api/patient-portal/patients/${primaryPatientId}/profile-photo`);
      expect(mockStorageService.deleteIfExists).toHaveBeenCalledWith(previousStorageKey);
    });

    it('denies upload if user does not have access to patient record', async () => {
      await expect(
        portalService.replaceProfilePhoto(userId, unlinkedPatientId, {
          fileName: 'photo.jpg',
          mimeType: 'image/jpeg',
          data: Buffer.from('image-bytes'),
        })
      ).rejects.toThrow(new AppError('You do not have access to this patient record', 403, 'PATIENT_ACCESS_DENIED'));
    });

    it('retrieves profile photo for authorized patient', async () => {
      vi.mocked(mockPortalRepo.getPatientProfilePhoto).mockResolvedValueOnce({
        storageKey: 'patients/p1/profile-photo/photo.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 2048,
        uploadedAt: new Date(),
      });

      const photo = await portalService.getProfilePhoto(userId, primaryPatientId);
      expect(photo.contentType).toBe('image/jpeg');
      expect(photo.data.toString()).toBe('fake-jpeg-bytes');
    });

    it('throws 404 when patient does not have a profile photo', async () => {
      vi.mocked(mockPortalRepo.getPatientProfilePhoto).mockResolvedValueOnce(null);

      await expect(
        portalService.getProfilePhoto(userId, primaryPatientId)
      ).rejects.toThrow(new AppError('Profile photo not found', 404, 'PROFILE_PHOTO_NOT_FOUND'));
    });

    it('denies photo retrieval for unlinked patient', async () => {
      await expect(
        portalService.getProfilePhoto(userId, unlinkedPatientId)
      ).rejects.toThrow(new AppError('You do not have access to this patient record', 403, 'PATIENT_ACCESS_DENIED'));
    });

    it('deletes profile photo, removes storage file, and updates DB', async () => {
      const storageKey = 'patients/p1/profile-photo/to-delete.jpg';
      vi.mocked(mockPortalRepo.getPatientProfilePhoto).mockResolvedValueOnce({
        storageKey,
        mimeType: 'image/jpeg',
        fileSizeBytes: 2048,
        uploadedAt: new Date(),
      });
      vi.mocked(mockPortalRepo.deletePatientProfilePhoto).mockResolvedValueOnce(true);

      const result = await portalService.deleteProfilePhoto(userId, primaryPatientId);
      expect(result.success).toBe(true);
      expect(result.patient_id).toBe(primaryPatientId);
      expect(mockStorageService.deleteIfExists).toHaveBeenCalledWith(storageKey);
      expect(mockPortalRepo.deletePatientProfilePhoto).toHaveBeenCalledWith(userId, primaryPatientId);
    });
  });

  describe('3. Multi-Patient Profile Isolation', () => {
    it('isolates photo management between primary account holder and dependent', async () => {
      const mockPortalRepo = {
        resolveAccessiblePatientId: vi.fn().mockImplementation((uid: string, pid?: string) => {
          if (uid === userId && (pid === primaryPatientId || pid === dependentPatientId)) return pid;
          return null;
        }),
        getPatientProfilePhoto: vi.fn().mockImplementation(async (pid: string) => {
          if (pid === primaryPatientId) {
            return { storageKey: 'photos/primary.jpg', mimeType: 'image/jpeg', fileSizeBytes: 1000, uploadedAt: new Date(1000) };
          }
          if (pid === dependentPatientId) {
            return { storageKey: 'photos/dependent.png', mimeType: 'image/png', fileSizeBytes: 2000, uploadedAt: new Date(2000) };
          }
          return null;
        }),
      } as unknown as PatientPortalRepository;

      const portalService = new PatientPortalService(
        mockPortalRepo,
        {} as UserService,
        {} as AppointmentService,
        {} as DoctorService,
        patientService,
        {} as PatientOtpService,
      );

      const primaryPhoto = await portalService.getProfilePhoto(userId, primaryPatientId);
      const dependentPhoto = await portalService.getProfilePhoto(userId, dependentPatientId);

      expect(primaryPhoto.contentType).toBe('image/jpeg');
      expect(dependentPhoto.contentType).toBe('image/png');
    });
  });
});
