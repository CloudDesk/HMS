import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BranchModel } from './branch.model.js';
import { BranchRepository } from './branch.repository.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { evaluateFacilityIdentifierReadiness } from './branch-identifier.utils.js';

describe('Branch/Facility External Identifier & DHA/SHA Readiness Foundation', () => {
  let mongo: MongoMemoryReplSet;
  const repository = new BranchRepository();
  const userId = new Types.ObjectId().toString();

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await BranchModel.init();
    await AuditLogModel.init();
  });

  beforeEach(async () => {
    await BranchModel.deleteMany({});
    await AuditLogModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  const createTestBranch = async (code = 'MAIN-01', name = 'Main Branch') => {
    return BranchModel.create({
      code,
      name,
      status: 'ACTIVE',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });
  };

  describe('1. CRUD & Backward Compatibility', () => {
    it('8. Existing facilities without identifiers remain valid', async () => {
      const branch = await createTestBranch('BRANCH-NO-ID', 'Branch Without ID');
      expect(branch.code).toBe('BRANCH-NO-ID');

      const fetched = await repository.getById(branch._id.toString());
      expect(fetched).toBeDefined();
      expect(fetched?.code).toBe('BRANCH-NO-ID');

      const identifiers = await repository.getIdentifiers(branch._id.toString());
      expect(identifiers).toEqual([]);
    });

    it('1 & 2. Add facility external identifier and retrieve it cleanly', async () => {
      const branch = await createTestBranch();
      const identifier = await repository.addIdentifier(
        branch._id.toString(),
        {
          identifier_type: 'DHA_FACILITY_ID',
          value: 'SYNTH-DHA-FAC-001',
          issuing_authority: 'DHA',
          status: 'ACTIVE',
        },
        userId,
      );

      expect(identifier.id).toBeDefined();
      expect(identifier.identifier_type).toBe('DHA_FACILITY_ID');
      expect(identifier.value).toBe('SYNTH-DHA-FAC-001');
      expect(identifier.issuing_authority).toBe('DHA');
      expect(identifier.status).toBe('ACTIVE');

      const all = await repository.getIdentifiers(branch._id.toString());
      expect(all).toHaveLength(1);
      expect(all[0]?.value).toBe('SYNTH-DHA-FAC-001');
    });

    it('3. Update identifier status between ACTIVE and INACTIVE', async () => {
      const branch = await createTestBranch();
      const identifier = await repository.addIdentifier(
        branch._id.toString(),
        {
          identifier_type: 'SHA_FACILITY_ID',
          value: 'SYNTH-SHA-FAC-999',
          issuing_authority: 'SHA',
          status: 'ACTIVE',
        },
        userId,
      );

      const updated = await repository.updateIdentifierStatus(
        branch._id.toString(),
        identifier.id,
        { status: 'INACTIVE', effective_to: '2026-12-31' },
        userId,
      );

      expect(updated.status).toBe('INACTIVE');
      expect(updated.effective_to).not.toBeNull();

      const all = await repository.getIdentifiers(branch._id.toString());
      expect(all[0]?.status).toBe('INACTIVE');
    });
  });

  describe('2. Validation & Conflict Prevention', () => {
    it('4 & 5. Rejects blank value, authority, or type', async () => {
      const branch = await createTestBranch();

      await expect(
        repository.addIdentifier(
          branch._id.toString(),
          { identifier_type: 'SHA_FACILITY_ID', value: '   ', issuing_authority: 'SHA' },
          userId,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

      await expect(
        repository.addIdentifier(
          branch._id.toString(),
          { identifier_type: 'SHA_FACILITY_ID', value: 'SYNTH-FAC', issuing_authority: '   ' },
          userId,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

      await expect(
        repository.addIdentifier(
          branch._id.toString(),
          { identifier_type: '   ', value: 'SYNTH-FAC', issuing_authority: 'SHA' },
          userId,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('6. Duplicate ACTIVE identifier across facilities rejected', async () => {
      const branchA = await createTestBranch('BRANCH-A', 'Branch Alpha');
      const branchB = await createTestBranch('BRANCH-B', 'Branch Beta');

      await repository.addIdentifier(
        branchA._id.toString(),
        { identifier_type: 'DHA_FACILITY_ID', value: 'SYNTH-FAC-DUP', issuing_authority: 'DHA' },
        userId,
      );

      await expect(
        repository.addIdentifier(
          branchB._id.toString(),
          { identifier_type: 'DHA_FACILITY_ID', value: 'SYNTH-FAC-DUP', issuing_authority: 'DHA' },
          userId,
        ),
      ).rejects.toMatchObject({ code: 'IDENTIFIER_CONFLICT' });
    });

    it('7. Duplicate ACTIVE identifier within the same facility rejected', async () => {
      const branch = await createTestBranch();

      await repository.addIdentifier(
        branch._id.toString(),
        { identifier_type: 'DHA_FACILITY_ID', value: 'SYNTH-FAC-1', issuing_authority: 'DHA' },
        userId,
      );

      await expect(
        repository.addIdentifier(
          branch._id.toString(),
          { identifier_type: 'DHA_FACILITY_ID', value: 'SYNTH-FAC-2', issuing_authority: 'DHA' },
          userId,
        ),
      ).rejects.toMatchObject({ code: 'ACTIVE_IDENTIFIER_CONFLICT' });
    });
  });

  describe('3. Privacy & Security Protection', () => {
    it('12. Raw identifier value never appears in audit metadata', async () => {
      const branch = await createTestBranch();
      const sensitiveFacilityCode = 'SECRET-FACILITY-CODE-777';

      await repository.addIdentifier(
        branch._id.toString(),
        { identifier_type: 'DHA_FACILITY_ID', value: sensitiveFacilityCode, issuing_authority: 'DHA' },
        userId,
      );

      const logs = await AuditLogModel.find({ eventType: 'branch.identifier.added' }).lean();
      expect(logs).toHaveLength(1);

      const serializedLogs = JSON.stringify(logs);
      expect(serializedLogs).not.toContain(sensitiveFacilityCode);
      expect(logs[0]?.metadataJson).toMatchObject({
        branchId: branch._id.toString(),
        identifierType: 'DHA_FACILITY_ID',
        issuingAuthority: 'DHA',
        status: 'ACTIVE',
      });
    });
  });

  describe('4. Deterministic Facility Identifier Readiness Evaluation', () => {
    it('9. SHA identifier system unconfigured readiness', () => {
      const readiness = evaluateFacilityIdentifierReadiness(
        [{ identifierType: 'DHA_FACILITY_ID', issuingAuthority: 'DHA', status: 'ACTIVE', value: 'FAC-01' }],
        '', // unconfigured
      );

      expect(readiness.status).toBe('SHA_FACILITY_IDENTIFIER_SYSTEM_UNCONFIGURED');
      expect(readiness.identifierSystemConfigured).toBe(false);
      expect(readiness.identifierAvailable).toBe(false);
      expect(readiness.identifierSystem).toBeNull();
    });

    it('10. SHA facility identifier unavailable readiness', () => {
      const readiness = evaluateFacilityIdentifierReadiness(
        [{ identifierType: 'LICENSE_NUMBER', issuingAuthority: 'MOH', status: 'ACTIVE', value: 'LIC-01' }],
        'DHA', // configured for DHA
      );

      expect(readiness.status).toBe('SHA_FACILITY_IDENTIFIER_NOT_AVAILABLE');
      expect(readiness.identifierSystemConfigured).toBe(true);
      expect(readiness.identifierAvailable).toBe(false);
      expect(readiness.identifierSystem).toBe('DHA');
    });

    it('11. SHA facility identifier available readiness without raw identifier value', () => {
      const readiness = evaluateFacilityIdentifierReadiness(
        [
          { identifierType: 'LICENSE_NUMBER', issuingAuthority: 'MOH', status: 'ACTIVE', value: 'LIC-01' },
          { identifierType: 'DHA_FACILITY_ID', issuingAuthority: 'DHA', status: 'ACTIVE', value: 'SYNTH-DHA-999' },
        ],
        'DHA',
      );

      expect(readiness.status).toBe('SHA_FACILITY_IDENTIFIER_AVAILABLE');
      expect(readiness.identifierSystemConfigured).toBe(true);
      expect(readiness.identifierAvailable).toBe(true);
      expect(readiness.identifierType).toBe('DHA_FACILITY_ID');
      expect(readiness.identifierSystem).toBe('DHA');
      expect(readiness).not.toHaveProperty('value');
    });
  });
});
