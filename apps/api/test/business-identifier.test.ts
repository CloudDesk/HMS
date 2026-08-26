import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { SequenceService } from '../src/shared/sequence/sequence.service.js';
import { SequenceModel } from '../src/shared/sequence/sequence.model.js';
import { PatientService } from '../src/modules/patients/patient.service.js';
import { PatientRepository } from '../src/modules/patients/patient.repository.js';
import { PatientDocumentStorageService } from '../src/shared/storage/patient-document-storage.service.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';

describe('Business Identifier Concurrency', () => {
  let patientService: PatientService;
  let sequenceService: SequenceService;

  before(async () => {
    await setupTestDatabase();
    await clearTestDatabase();
    
    sequenceService = new SequenceService();
    const patientRepository = new PatientRepository(sequenceService);
    const patientDocumentStorageService = new PatientDocumentStorageService();
    patientService = new PatientService(patientRepository, patientDocumentStorageService, sequenceService);
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('generates unique patient numbers concurrently without duplicate key errors', async () => {
    const role = await RoleModel.create({
      name: 'Super Admin',
      code: 'SUPER_ADMIN',
      description: 'Admin role',
      status: 'active',
      permissionIds: []
    });

    const branch = await BranchModel.create({
      name: 'Main Branch',
      code: 'MAIN',
      type: 'HEADQUARTERS',
      contact: '123',
      address: '123 Main St',
      status: 'ACTIVE'
    });

    const user = await UserModel.create({
      email: 'test@admin.com',
      username: 'testadmin',
      passwordHash: 'dummyhash',
      fullName: 'Test Admin',
      roleIds: [role._id],
      branchIds: [branch._id],
      status: 'active'
    });

    const promises = Array.from({ length: 50 }).map((_, i) => 
      patientService.create({
        first_name: `John${i}`,
        last_name: 'Doe',
        date_of_birth: '1990-01-01',
        gender: 'MALE',
        registration_branch_id: branch._id.toString(),
        contact_number: `55512345${i.toString().padStart(2, '0')}`
      }, user._id.toString())
    );
    
    const results = await Promise.allSettled(promises);
    
    // Check none failed
    const rejected = results.filter(r => r.status === 'rejected');
    if (rejected.length > 0) {
      console.error(rejected);
    }
    assert.strictEqual(rejected.length, 0);

    const patients = results
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(Boolean);

    // Extract numbers
    const numbers = patients.map(p => p!.patient_number);
    
    // Ensure all 50 generated
    assert.strictEqual(numbers.length, 50);

    // Ensure all 50 are unique
    const uniqueNumbers = new Set(numbers);
    assert.strictEqual(uniqueNumbers.size, 50);
  });
});
