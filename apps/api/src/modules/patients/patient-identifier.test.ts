import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PatientModel, PatientTimelineEventModel } from './patient.model.js';
import { PatientRepository } from './patient.repository.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { evaluatePatientIdentifierReadiness } from './patient-identifier.utils.js';

describe('Patient National ID / SHA UPI Readiness Foundation', () => {
  let mongo: MongoMemoryReplSet;
  const repository = new PatientRepository();
  const userId = new Types.ObjectId().toString();

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await PatientModel.init();
    await PatientTimelineEventModel.init();
    await AuditLogModel.init();
  });

  beforeEach(async () => {
    await PatientModel.deleteMany({});
    await PatientTimelineEventModel.deleteMany({});
    await AuditLogModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  const createTestPatient = async (patientNumber = 'HMS-0001') => {
    return PatientModel.create({
      patientNumber,
      firstName: 'Alice',
      lastName: 'Smith',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'FEMALE',
      phone: '+254712345678',
      status: 'ACTIVE',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });
  };

  describe('1. CRUD & Backward Compatibility', () => {
    it('creates and updates patient without identifier cleanly', async () => {
      const patient = await createTestPatient();
      expect(patient.patientNumber).toBe('HMS-0001');

      const fetched = await repository.getById(patient._id.toString());
      expect(fetched).not.toBeNull();
      expect(fetched?.patient_number).toBe('HMS-0001');

      const identifiers = await repository.getIdentifiers(patient._id.toString());
      expect(identifiers).toEqual([]);
    });

    it('adds a synthetic national identifier and retrieves it cleanly', async () => {
      const patient = await createTestPatient();
      const identifier = await repository.addIdentifier(
        patient._id.toString(),
        {
          identifier_type: 'NATIONAL_ID',
          value: 'SYNTH-NAT-12345',
          issuing_authority: 'GOV_KE',
          status: 'ACTIVE',
        },
        userId,
      );

      expect(identifier.id).toBeDefined();
      expect(identifier.identifier_type).toBe('NATIONAL_ID');
      expect(identifier.value).toBe('SYNTH-NAT-12345');
      expect(identifier.issuing_authority).toBe('GOV_KE');
      expect(identifier.status).toBe('ACTIVE');

      const all = await repository.getIdentifiers(patient._id.toString());
      expect(all).toHaveLength(1);
      expect(all[0]?.value).toBe('SYNTH-NAT-12345');
    });

    it('updates identifier status between ACTIVE and INACTIVE', async () => {
      const patient = await createTestPatient();
      const identifier = await repository.addIdentifier(
        patient._id.toString(),
        {
          identifier_type: 'NATIONAL_ID',
          value: 'SYNTH-NAT-99999',
          issuing_authority: 'GOV_KE',
          status: 'ACTIVE',
        },
        userId,
      );

      const updated = await repository.updateIdentifierStatus(
        patient._id.toString(),
        identifier.id,
        { status: 'INACTIVE', effective_to: '2026-12-31' },
        userId,
      );

      expect(updated.status).toBe('INACTIVE');
      expect(updated.effective_to).not.toBeNull();

      const all = await repository.getIdentifiers(patient._id.toString());
      expect(all[0]?.status).toBe('INACTIVE');
    });
  });

  describe('2. Validation & Conflict Prevention', () => {
    it('rejects empty identifier value or authority', async () => {
      const patient = await createTestPatient();
      await expect(
        repository.addIdentifier(
          patient._id.toString(),
          { identifier_type: 'NATIONAL_ID', value: '   ', issuing_authority: 'GOV_KE' },
          userId,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

      await expect(
        repository.addIdentifier(
          patient._id.toString(),
          { identifier_type: 'NATIONAL_ID', value: 'SYNTH-VAL', issuing_authority: '   ' },
          userId,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects duplicate active identifier across different patients', async () => {
      const patientA = await createTestPatient('HMS-0001');
      const patientB = await createTestPatient('HMS-0002');

      await repository.addIdentifier(
        patientA._id.toString(),
        { identifier_type: 'NATIONAL_ID', value: 'SYNTH-DUP-01', issuing_authority: 'GOV_KE' },
        userId,
      );

      await expect(
        repository.addIdentifier(
          patientB._id.toString(),
          { identifier_type: 'NATIONAL_ID', value: 'SYNTH-DUP-01', issuing_authority: 'GOV_KE' },
          userId,
        ),
      ).rejects.toMatchObject({ code: 'IDENTIFIER_CONFLICT' });
    });

    it('rejects conflicting active identifier within the same patient for same authority and type', async () => {
      const patient = await createTestPatient();

      await repository.addIdentifier(
        patient._id.toString(),
        { identifier_type: 'NATIONAL_ID', value: 'SYNTH-P1-01', issuing_authority: 'GOV_KE' },
        userId,
      );

      await expect(
        repository.addIdentifier(
          patient._id.toString(),
          { identifier_type: 'NATIONAL_ID', value: 'SYNTH-P1-02', issuing_authority: 'GOV_KE' },
          userId,
        ),
      ).rejects.toMatchObject({ code: 'ACTIVE_IDENTIFIER_CONFLICT' });
    });
  });

  describe('3. Privacy & Security Protection', () => {
    it('does NOT write raw sensitive identifier value to AuditLogModel', async () => {
      const patient = await createTestPatient();
      const sensitiveValue = 'SECRET-NATIONAL-ID-777';

      await repository.addIdentifier(
        patient._id.toString(),
        { identifier_type: 'NATIONAL_ID', value: sensitiveValue, issuing_authority: 'GOV_KE' },
        userId,
      );

      const logs = await AuditLogModel.find({ eventType: 'patient.identifier.added' }).lean();
      expect(logs).toHaveLength(1);

      const serializedLogs = JSON.stringify(logs);
      expect(serializedLogs).not.toContain(sensitiveValue);
      expect(logs[0]?.metadataJson).toMatchObject({
        patientId: patient._id.toString(),
        identifierType: 'NATIONAL_ID',
        issuingAuthority: 'GOV_KE',
        status: 'ACTIVE',
      });
    });
  });

  describe('4. Deterministic SHA Identifier Readiness Evaluation', () => {
    it('returns SHA_IDENTIFIER_SYSTEM_UNCONFIGURED when identifier system is not configured', () => {
      const readiness = evaluatePatientIdentifierReadiness(
        [{ identifierType: 'NATIONAL_ID', issuingAuthority: 'GOV_KE', status: 'ACTIVE', value: '12345' }],
        '', // not configured
      );

      expect(readiness.status).toBe('SHA_IDENTIFIER_SYSTEM_UNCONFIGURED');
      expect(readiness.identifierSystemConfigured).toBe(false);
      expect(readiness.identifierAvailable).toBe(false);
      expect(readiness.identifierSystem).toBeNull();
    });

    it('does NOT treat arbitrary national identifier as SHA UPI when system is configured', () => {
      const readiness = evaluatePatientIdentifierReadiness(
        [{ identifierType: 'NATIONAL_ID', issuingAuthority: 'GOV_KE', status: 'ACTIVE', value: '12345' }],
        'SHA_UPI', // configured for SHA_UPI
      );

      expect(readiness.status).toBe('SHA_PATIENT_IDENTIFIER_NOT_AVAILABLE');
      expect(readiness.identifierSystemConfigured).toBe(true);
      expect(readiness.identifierAvailable).toBe(false);
      expect(readiness.identifierSystem).toBe('SHA_UPI');
    });

    it('returns SHA_PATIENT_IDENTIFIER_AVAILABLE when matching active identifier exists with non-empty value', () => {
      const readiness = evaluatePatientIdentifierReadiness(
        [
          { identifierType: 'NATIONAL_ID', issuingAuthority: 'GOV_KE', status: 'ACTIVE', value: '12345' },
          { identifierType: 'SHA_UPI', issuingAuthority: 'SHA', status: 'ACTIVE', value: 'SYNTH-UPI-987' },
        ],
        'SHA_UPI',
      );

      expect(readiness.status).toBe('SHA_PATIENT_IDENTIFIER_AVAILABLE');
      expect(readiness.identifierSystemConfigured).toBe(true);
      expect(readiness.identifierAvailable).toBe(true);
      expect(readiness.identifierType).toBe('SHA_UPI');
      // Verify raw value is NOT returned
      expect(readiness).not.toHaveProperty('value');
    });

    it('returns SHA_PATIENT_IDENTIFIER_NOT_AVAILABLE when matching identifier is INACTIVE', () => {
      const readiness = evaluatePatientIdentifierReadiness(
        [{ identifierType: 'SHA_UPI', issuingAuthority: 'SHA', status: 'INACTIVE', value: 'SYNTH-UPI-987' }],
        'SHA_UPI',
      );

      expect(readiness.status).toBe('SHA_PATIENT_IDENTIFIER_NOT_AVAILABLE');
      expect(readiness.identifierAvailable).toBe(false);
    });
  });
});
