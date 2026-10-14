import { describe, expect, it, vi } from 'vitest';
import { buildPhoneMongoFilter, getPhoneVariants, isValidPhoneNumber } from '../../utils/phone.js';
import { PatientService } from './patient.service.js';
import type { PatientRepository } from './patient.repository.js';
import type { PatientDocumentStorageService } from '../../shared/storage/patient-document-storage.service.js';
import type { SequenceService } from '../../shared/sequence/sequence.service.js';
import { AppError } from '../../shared/errors/app-error.js';

describe('isValidPhoneNumber utility', () => {
  describe('1. Valid Indian (+91) numbers', () => {
    it.each([
      ['+919876543210'],
      ['+91 98765 43210'],
      ['+91-98765-43210'],
      ['+91 (98765) 43210'],
      ['+91.98765.43210'],
      ['+916234567890'],
      ['+917234567890'],
      ['+918234567890'],
    ])('accepts valid Indian phone: %s', (phone) => {
      expect(isValidPhoneNumber(phone)).toBe(true);
    });
  });

  describe('2. Valid numbers from other supported international regions', () => {
    it.each([
      ['+14155552671'], // US
      ['+1 (415) 555-2671'], // US formatted
      ['+447911123456'], // UK
      ['+44 7911 123456'], // UK formatted
      ['+254700100200'], // Kenya
      ['+254 700 100 200'], // Kenya formatted
      ['+27821234567'], // South Africa
      ['+971501234567'], // UAE
      ['+6591234567'], // Singapore
      ['+61412345678'], // Australia
    ])('accepts valid international phone: %s', (phone) => {
      expect(isValidPhoneNumber(phone)).toBe(true);
    });
  });

  describe('3. Valid numbers in existing accepted formats', () => {
    it.each([
      ['9876543210'], // Standard 10-digit national number
      ['09876543210'], // 11-digit with trunk prefix 0
      ['0712345678'], // 10-digit Kenya national with trunk prefix 0
      ['27821234567'], // Unprefixed South Africa number (11 digits)
      ['9999988888'], // 10-digit domestic
    ])('accepts accepted national/domestic format: %s', (phone) => {
      expect(isValidPhoneNumber(phone)).toBe(true);
    });
  });

  describe('4. Invalid or incomplete country calling codes', () => {
    it.each([
      ['+'],
      ['+0'],
      ['+0123456789'],
      ['+91'], // only country code
      ['+91 123'], // incomplete subscriber number
      ['++919876543210'], // double plus prefix
      ['+910987654321'], // Indian subscriber starting with 0 in international format
    ])('rejects invalid or incomplete country code: %s', (phone) => {
      expect(isValidPhoneNumber(phone)).toBe(false);
    });
  });

  describe('5. Numbers that are too short or too long', () => {
    it.each([
      ['12345'], // 5 digits (too short)
      ['123456'], // 6 digits (too short)
      ['+91 12345'], // too short for India (5 digits)
      ['1234567890123456'], // 16 digits (too long)
      ['+91123456789012345'], // 17 digits (too long)
    ])('rejects invalid length: %s', (phone) => {
      expect(isValidPhoneNumber(phone)).toBe(false);
    });
  });

  describe('6. Alphabetic and malformed input', () => {
    it.each([
      ['+9198765abcde'],
      ['phone1234567890'],
      ['invalid-phone'],
      ['+91 (98765'], // unmatched open paren
      ['+91 98765) 43210'], // unmatched close paren
      ['0000000000'], // all zeroes
      ['009876543210'], // international exit prefix '00' without '+'
      [''],
      ['   '],
      [null as unknown as string],
      [undefined as unknown as string],
    ])('rejects malformed or non-phone input: %s', (phone) => {
      expect(isValidPhoneNumber(phone)).toBe(false);
    });
  });
});

describe('PatientService phone validation on create and update', () => {
  const createMockService = () => {
    const mockRepo = {
      resolveBranchScope: vi.fn().mockResolvedValue(['branch-1']),
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1', branchIds: ['branch-1'] }),
      findDuplicateCandidates: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation((seq, data) => Promise.resolve({ id: 'patient-1', ...data })),
      addTimelineEvent: vi.fn().mockResolvedValue({}),
      getById: vi.fn().mockResolvedValue({ id: 'patient-1', phone: '+919876543210' }),
      update: vi.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
      syncPortalOwnerPhone: vi.fn().mockResolvedValue(undefined),
    } as unknown as PatientRepository;

    const mockStorage = {} as unknown as PatientDocumentStorageService;
    const mockSeq = {
      getNextSequence: vi.fn().mockResolvedValue(100),
      formatStandardSequence: vi.fn().mockReturnValue('HMS-2026-000100'),
    } as unknown as SequenceService;

    return {
      service: new PatientService(mockRepo, mockStorage, mockSeq),
      repo: mockRepo,
    };
  };

  const validPatientBase = {
    first_name: 'Aarav',
    last_name: 'Sharma',
    date_of_birth: '1995-05-15',
    gender: 'MALE' as const,
  };

  describe('Registration path (create)', () => {
    it('successfully registers patient with valid Indian +91 phone number', async () => {
      const { service, repo } = createMockService();
      const result = await service.create(
        {
          ...validPatientBase,
          phone: '+919876543210',
        },
        'user-1',
      );

      expect(result).toBeDefined();
      expect(repo.create).toHaveBeenCalled();
    });

    it('successfully registers patient with valid international +254 phone number', async () => {
      const { service, repo } = createMockService();
      const result = await service.create(
        {
          ...validPatientBase,
          phone: '+254700100200',
        },
        'user-1',
      );

      expect(result).toBeDefined();
      expect(repo.create).toHaveBeenCalled();
    });

    it('successfully registers patient with valid 10-digit domestic phone number', async () => {
      const { service, repo } = createMockService();
      const result = await service.create(
        {
          ...validPatientBase,
          phone: '9876543210',
        },
        'user-1',
      );

      expect(result).toBeDefined();
      expect(repo.create).toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR when phone is missing or blank', async () => {
      const { service } = createMockService();
      await expect(
        service.create({ ...validPatientBase, phone: '   ' }, 'user-1'),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Phone number is required',
        }),
      );
    });

    it('throws VALIDATION_ERROR when phone is malformed or invalid', async () => {
      const { service } = createMockService();
      await expect(
        service.create({ ...validPatientBase, phone: '+9198765abcde' }, 'user-1'),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Phone number must be a valid international or regional phone number',
        }),
      );
    });
  });

  describe('Profile update path (update)', () => {
    it('successfully updates phone with valid Indian +91 phone number and syncs portal owner', async () => {
      const { service, repo } = createMockService();
      const result = await service.update(
        'patient-1',
        { phone: '+919876543210' },
        'user-1',
      );

      expect(result).toBeDefined();
      expect(repo.update).toHaveBeenCalledWith('patient-1', { phone: '+919876543210' }, 'user-1', ['branch-1']);
      expect(repo.syncPortalOwnerPhone).toHaveBeenCalledWith('patient-1', '+919876543210');
    });

    it('throws VALIDATION_ERROR when updating with an invalid phone', async () => {
      const { service } = createMockService();
      await expect(
        service.update('patient-1', { phone: '12345' }, 'user-1'),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Phone number must be a valid international or regional phone number',
        }),
      );
    });

    it('allows clearing phone to null on update without throwing validation error', async () => {
      const { service, repo } = createMockService();
      const result = await service.update('patient-1', { phone: null }, 'user-1');

      expect(result).toBeDefined();
      expect(repo.update).toHaveBeenCalledWith('patient-1', { phone: null }, 'user-1', ['branch-1']);
      expect(repo.syncPortalOwnerPhone).toHaveBeenCalledWith('patient-1', null);
    });

    it('does not perform phone validation when phone is not included in update payload', async () => {
      const { service, repo } = createMockService();
      const result = await service.update('patient-1', { first_name: 'Vivaan' }, 'user-1');

      expect(result).toBeDefined();
      expect(repo.update).toHaveBeenCalledWith('patient-1', { first_name: 'Vivaan' }, 'user-1', ['branch-1']);
      expect(repo.syncPortalOwnerPhone).not.toHaveBeenCalled();
    });
  });

  describe('Existing phone lookup and duplicate-detection integrity', () => {
    it('generates proper variants and MongoDB query filter for an Indian +91 number', () => {
      const variants = getPhoneVariants('+919876543210');
      expect(variants).toContain('+919876543210');
      expect(variants).toContain('9876543210');
      expect(variants).toContain('+91 9876543210');

      const filter = buildPhoneMongoFilter('+919876543210');
      expect(filter).toHaveProperty('$or');
      expect(filter.$or).toHaveLength(2);
      expect(filter.$or[0]).toHaveProperty('phone');
      expect(filter.$or[1]).toHaveProperty('phone');
    });

    it('generates proper filter for a domestic 10-digit number', () => {
      const filter = buildPhoneMongoFilter('9876543210');
      expect(filter).toHaveProperty('$or');
      expect(filter.$or[0].phone.$in).toContain('9876543210');
      expect(filter.$or[0].phone.$in).toContain('+919876543210');
    });
  });
});
