import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { ConsentService } from '../src/modules/consents/consent.service.js';
import { ConsentRepository } from '../src/modules/consents/consent.repository.js';
import { ConsentTemplateModel } from '../src/modules/consents/consent.model.js';
import { AuditLogModel } from '../src/modules/auth/auth.model.js';
import { PatientRepository } from '../src/modules/patients/patient.repository.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import type { ConsentFormDefinition } from '../src/modules/consents/consent.types.js';

describe('Consent Publishing Transaction Safety & Audit Atomicity (Fix H12)', () => {
  let consentRepo: ConsentRepository;
  let consentService: ConsentService;
  let patientRepo: PatientRepository;

  const branchId = createObjectId();
  const branchId2 = createObjectId();
  const superAdminUserId = createObjectId();
  const unauthorizedUserId = createObjectId();

  const dummyMetadata = {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  const validFormDefinition: ConsentFormDefinition = {
    sections: [
      {
        id: 'sec-1',
        title: 'Information & Consent',
        displayOrder: 0,
        required: true,
        fields: [
          {
            id: 'fld-1',
            fieldKey: 'patient_consent',
            label: 'I hereby consent to the procedure',
            fieldType: 'CHECKBOX',
            required: true,
          },
        ],
      },
    ],
    declaration: {
      title: 'Declaration',
      text: 'I understand the risks and benefits.',
      requireCheckbox: true,
    },
    signatures: {
      patientRequired: true,
      guardianAllowed: false,
      doctorRequired: false,
      witnessAllowed: false,
    },
  };

  beforeAll(async () => {
    await setupTestDatabase();
    consentRepo = new ConsentRepository();
    patientRepo = new PatientRepository({} as any);
    consentService = new ConsentService(consentRepo, patientRepo);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    await BranchModel.create([
      {
        _id: new Types.ObjectId(branchId),
        name: 'Main Dental Hospital',
        code: 'MDH-01',
        type: 'HEADQUARTERS',
        contact: '1234567890',
        address: '123 Main St',
        status: 'ACTIVE',
      },
      {
        _id: new Types.ObjectId(branchId2),
        name: 'Secondary Branch',
        code: 'SEC-02',
        type: 'BRANCH',
        contact: '0987654321',
        address: '456 Side St',
        status: 'ACTIVE',
      },
    ]);

    const superAdminRole = await RoleModel.create({
      name: 'Super Admin',
      code: 'SUPER_ADMIN',
      description: 'Super administrator',
      status: 'active',
      permissionIds: [],
    });

    await UserModel.create([
      {
        _id: new Types.ObjectId(superAdminUserId),
        username: 'superadmin',
        email: 'superadmin@dental.org',
        passwordHash: 'dummyhash',
        fullName: 'Super Admin',
        status: 'active',
        branchIds: [new Types.ObjectId(branchId), new Types.ObjectId(branchId2)],
        roleIds: [superAdminRole._id],
      },
      {
        _id: new Types.ObjectId(unauthorizedUserId),
        username: 'unauth_user',
        email: 'unauth@dental.org',
        passwordHash: 'dummyhash',
        fullName: 'Unauthorized User',
        status: 'active',
        branchIds: [],
        roleIds: [],
      },
    ]);

    // Ensure database indexes are set up
    await consentRepo.ensureActiveUniquenessIndex();
  });

  it('1. Publishing is rejected fail-closed when transactional guarantees are unavailable (standalone topology)', async () => {
    // Create v1 and publish it on replica set
    const v1 = await consentRepo.create(
      {
        branch_id: branchId,
        code: 'STANDALONE_TEST',
        name: 'Standalone Test Consent',
        category: 'SURGERY',
        context_type: 'PROCEDURE',
        mandatory: true,
        form_definition: validFormDefinition,
      },
      superAdminUserId,
    );
    await consentService.publish(v1.id, branchId, superAdminUserId, dummyMetadata);

    // Create v2 draft
    const v2 = await consentRepo.createNextVersion(v1.id, branchId, superAdminUserId);

    // Mock session to simulate standalone topology where withTransaction throws unsupported topology error
    const originalSession = consentRepo.session.bind(consentRepo);
    consentRepo.session = async () => {
      const realSession = await originalSession();
      realSession.withTransaction = async () => {
        throw new Error('Transaction numbers are only allowed on a replica set member or mongos');
      };
      return realSession;
    };

    try {
      // Publishing must be rejected fail-closed with 503 TRANSACTION_UNAVAILABLE
      await expect(
        consentService.publish(v2.id, branchId, superAdminUserId, dummyMetadata),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'TRANSACTION_UNAVAILABLE',
      });
    } finally {
      consentRepo.session = originalSession;
    }

    // CRITICAL: verify that the rejection left existing active version (v1) ACTIVE and draft (v2) DRAFT!
    const v1Check = await ConsentTemplateModel.findById(v1.id).lean();
    const v2Check = await ConsentTemplateModel.findById(v2.id).lean();

    expect(v1Check?.status).toBe('ACTIVE');
    expect(v2Check?.status).toBe('DRAFT');
  });

  it('2. Publishing a new version deactivates the previous active version in the same scope', async () => {
    const v1 = await consentRepo.create(
      {
        branch_id: branchId,
        code: 'SURG_EXTRACT',
        name: 'Surgical Extraction Consent',
        category: 'SURGERY',
        context_type: 'PROCEDURE',
        mandatory: true,
        form_definition: validFormDefinition,
      },
      superAdminUserId,
    );
    const pubV1 = await consentService.publish(v1.id, branchId, superAdminUserId, dummyMetadata);
    expect(pubV1.status).toBe('ACTIVE');

    const v2 = await consentRepo.createNextVersion(v1.id, branchId, superAdminUserId);
    expect(v2.version).toBe(2);
    expect(v2.status).toBe('DRAFT');

    const pubV2 = await consentService.publish(v2.id, branchId, superAdminUserId, dummyMetadata);
    expect(pubV2.status).toBe('ACTIVE');
    expect(pubV2.version).toBe(2);

    const v1Check = await ConsentTemplateModel.findById(v1.id).lean();
    expect(v1Check?.status).toBe('INACTIVE');

    const activeTemplates = await ConsentTemplateModel.find({
      branchId: new Types.ObjectId(branchId),
      code: 'SURG_EXTRACT',
      status: 'ACTIVE',
    }).lean();

    expect(activeTemplates).toHaveLength(1);
    expect(activeTemplates[0]._id.toString()).toBe(v2.id);
  });

  it('3. Publishing a version does not deactivate an unrelated consent scope', async () => {
    const tA = await consentRepo.create(
      {
        branch_id: branchId,
        code: 'TEMPLATE_A',
        name: 'Template A',
        category: 'GENERAL',
        context_type: 'PATIENT',
        mandatory: false,
        form_definition: validFormDefinition,
      },
      superAdminUserId,
    );
    await consentService.publish(tA.id, branchId, superAdminUserId, dummyMetadata);

    const tB = await consentRepo.create(
      {
        branch_id: branchId,
        code: 'TEMPLATE_B',
        name: 'Template B',
        category: 'GENERAL',
        context_type: 'PATIENT',
        mandatory: false,
        form_definition: validFormDefinition,
      },
      superAdminUserId,
    );
    await consentService.publish(tB.id, branchId, superAdminUserId, dummyMetadata);

    const tA_Branch2 = await consentRepo.create(
      {
        branch_id: branchId2,
        code: 'TEMPLATE_A',
        name: 'Template A Branch 2',
        category: 'GENERAL',
        context_type: 'PATIENT',
        mandatory: false,
        form_definition: validFormDefinition,
      },
      superAdminUserId,
    );
    await consentService.publish(tA_Branch2.id, branchId2, superAdminUserId, dummyMetadata);

    const activeTA1 = await ConsentTemplateModel.findOne({ branchId: new Types.ObjectId(branchId), code: 'TEMPLATE_A', status: 'ACTIVE' }).lean();
    const activeTB1 = await ConsentTemplateModel.findOne({ branchId: new Types.ObjectId(branchId), code: 'TEMPLATE_B', status: 'ACTIVE' }).lean();
    const activeTA2 = await ConsentTemplateModel.findOne({ branchId: new Types.ObjectId(branchId2), code: 'TEMPLATE_A', status: 'ACTIVE' }).lean();

    expect(activeTA1).toBeDefined();
    expect(activeTB1).toBeDefined();
    expect(activeTA2).toBeDefined();
    expect(activeTA1?._id.toString()).toBe(tA.id);
    expect(activeTB1?._id.toString()).toBe(tB.id);
    expect(activeTA2?._id.toString()).toBe(tA_Branch2.id);
  });

  it('4. Draft or invalid versions cannot become active', async () => {
    const draftWithoutSections = await consentRepo.create(
      {
        branch_id: branchId,
        code: 'INVALID_EMPTY',
        name: 'Empty Draft',
        category: 'GENERAL',
        context_type: 'PATIENT',
        mandatory: false,
      },
      superAdminUserId,
    );

    await expect(
      consentService.publish(draftWithoutSections.id, branchId, superAdminUserId, dummyMetadata),
    ).rejects.toThrow('Cannot publish consent template without at least one configured section');

    const check1 = await ConsentTemplateModel.findById(draftWithoutSections.id).lean();
    expect(check1?.status).toBe('DRAFT');

    await ConsentTemplateModel.updateOne({ _id: draftWithoutSections.id }, { $set: { status: 'INACTIVE', formDefinition: validFormDefinition } });

    await expect(
      consentService.publish(draftWithoutSections.id, branchId, superAdminUserId, dummyMetadata),
    ).rejects.toThrow('Archived consent templates cannot be published');
  });

  it('5. Audit failure rolls back publishing atomically without leaving a committed-without-audit state', async () => {
    const v1 = await consentRepo.create(
      {
        branch_id: branchId,
        code: 'AUDIT_ROLLBACK_TEST',
        name: 'Audit Rollback Test',
        category: 'SURGERY',
        context_type: 'PROCEDURE',
        mandatory: true,
        form_definition: validFormDefinition,
      },
      superAdminUserId,
    );
    await consentService.publish(v1.id, branchId, superAdminUserId, dummyMetadata);

    const v2 = await consentRepo.createNextVersion(v1.id, branchId, superAdminUserId);

    // Mock AuditLogModel.prototype.save to throw an error inside the transaction
    const originalSave = AuditLogModel.prototype.save;
    AuditLogModel.prototype.save = async function (...args: any[]) {
      throw new Error('Audit storage disk full');
    };

    try {
      await expect(
        consentService.publish(v2.id, branchId, superAdminUserId, dummyMetadata),
      ).rejects.toThrow('Audit storage disk full');
    } finally {
      AuditLogModel.prototype.save = originalSave;
    }

    // Because audit was inside the transaction, the entire publication rolled back!
    // v1 is still ACTIVE, v2 is still DRAFT!
    const v1Post = await ConsentTemplateModel.findById(v1.id).lean();
    const v2Post = await ConsentTemplateModel.findById(v2.id).lean();

    expect(v1Post?.status).toBe('ACTIVE');
    expect(v2Post?.status).toBe('DRAFT');
  });

  it('6. Concurrent publish attempts cannot leave multiple active versions for the same scope', async () => {
    const v1 = await consentRepo.create(
      {
        branch_id: branchId,
        code: 'CONCURRENCY_TEST',
        name: 'Concurrency Test',
        category: 'SURGERY',
        context_type: 'PROCEDURE',
        mandatory: true,
        form_definition: validFormDefinition,
      },
      superAdminUserId,
    );

    const v2 = await ConsentTemplateModel.create({
      branchId: new Types.ObjectId(branchId),
      code: 'CONCURRENCY_TEST',
      name: 'Concurrency Test v2',
      category: 'SURGERY',
      contextType: 'PROCEDURE',
      mandatory: true,
      version: 2,
      status: 'DRAFT',
      formDefinition: validFormDefinition,
      createdBy: new Types.ObjectId(superAdminUserId),
      updatedBy: new Types.ObjectId(superAdminUserId),
    });

    const v3 = await ConsentTemplateModel.create({
      branchId: new Types.ObjectId(branchId),
      code: 'CONCURRENCY_TEST',
      name: 'Concurrency Test v3',
      category: 'SURGERY',
      contextType: 'PROCEDURE',
      mandatory: true,
      version: 3,
      status: 'DRAFT',
      formDefinition: validFormDefinition,
      createdBy: new Types.ObjectId(superAdminUserId),
      updatedBy: new Types.ObjectId(superAdminUserId),
    });

    const results = await Promise.allSettled([
      consentService.publish(v2._id.toString(), branchId, superAdminUserId, dummyMetadata),
      consentService.publish(v3._id.toString(), branchId, superAdminUserId, dummyMetadata),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    const activeTemplates = await ConsentTemplateModel.find({
      branchId: new Types.ObjectId(branchId),
      code: 'CONCURRENCY_TEST',
      status: 'ACTIVE',
    }).lean();

    expect(activeTemplates).toHaveLength(1);
  });

  it('7. Existing duplicate active versions are detected without automatically reconciling production records', async () => {
    // Drop unique index temporarily to simulate unindexed legacy state
    try {
      await ConsentTemplateModel.collection.dropIndex('branchId_1_code_1');
    } catch {
      // index might not exist
    }

    const legacy1 = await ConsentTemplateModel.create({
      branchId: new Types.ObjectId(branchId),
      code: 'LEGACY_DUP',
      name: 'Legacy Duplicate v1',
      category: 'SURGERY',
      contextType: 'PROCEDURE',
      mandatory: true,
      version: 1,
      status: 'ACTIVE',
      formDefinition: validFormDefinition,
      createdBy: new Types.ObjectId(superAdminUserId),
      updatedBy: new Types.ObjectId(superAdminUserId),
    });

    const legacy2 = await ConsentTemplateModel.create({
      branchId: new Types.ObjectId(branchId),
      code: 'LEGACY_DUP',
      name: 'Legacy Duplicate v2',
      category: 'SURGERY',
      contextType: 'PROCEDURE',
      mandatory: true,
      version: 2,
      status: 'ACTIVE',
      formDefinition: validFormDefinition,
      createdBy: new Types.ObjectId(superAdminUserId),
      updatedBy: new Types.ObjectId(superAdminUserId),
    });

    // 1. Detection does NOT modify any records
    const detected = await consentRepo.detectDuplicateActiveScopes();
    expect(detected).toHaveLength(1);
    expect(detected[0].code).toBe('LEGACY_DUP');
    expect(detected[0].count).toBe(2);

    // Verify records remain untouched after detection
    const countAfterDetection = await ConsentTemplateModel.countDocuments({
      branchId: new Types.ObjectId(branchId),
      code: 'LEGACY_DUP',
      status: 'ACTIVE',
    });
    expect(countAfterDetection).toBe(2);

    // 2. ensureActiveUniquenessIndex rejects rather than silently rewriting
    await expect(
      consentRepo.ensureActiveUniquenessIndex(),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'DUPLICATE_ACTIVE_CONSENTS_REQUIRE_APPROVAL',
    });

    // 3. Resolving without an approved selection is rejected
    await expect(
      consentRepo.resolveDuplicateActiveScopesWithApprovedSelection({}, superAdminUserId),
    ).rejects.toThrow('An approved selection decision is required');

    // 4. Resolving WITH explicit approved selection (e.g. specifically selecting v1, NOT assuming highest)
    const resolved = await consentRepo.resolveDuplicateActiveScopesWithApprovedSelection(
      { [`${branchId}:LEGACY_DUP`]: legacy1._id.toString() },
      superAdminUserId,
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0].approvedId).toBe(legacy1._id.toString());

    // Legacy1 is ACTIVE, Legacy2 is retired
    const leg1Post = await ConsentTemplateModel.findById(legacy1._id).lean();
    const leg2Post = await ConsentTemplateModel.findById(legacy2._id).lean();
    expect(leg1Post?.status).toBe('ACTIVE');
    expect(leg2Post?.status).toBe('INACTIVE');

    // Now index creation succeeds cleanly!
    await consentRepo.ensureActiveUniquenessIndex();
  });

  it('8. Authorization and audit behavior remain intact', async () => {
    const template = await consentRepo.create(
      {
        branch_id: branchId,
        code: 'AUTH_TEST',
        name: 'Auth Test',
        category: 'GENERAL',
        context_type: 'PATIENT',
        mandatory: false,
        form_definition: validFormDefinition,
      },
      superAdminUserId,
    );

    await expect(
      consentService.publish(template.id, branchId, unauthorizedUserId, dummyMetadata),
    ).rejects.toThrow('Branch access denied');

    const published = await consentService.publish(template.id, branchId, superAdminUserId, dummyMetadata);
    expect(published.status).toBe('ACTIVE');

    const auditLogs = await AuditLogModel.find({
      eventType: 'consent.template.published',
      actorUserId: new Types.ObjectId(superAdminUserId),
    }).lean();

    expect(auditLogs.length).toBeGreaterThan(0);
    const log = auditLogs[auditLogs.length - 1];
    expect(log.metadataJson).toHaveProperty('templateId', template.id);
    expect(log.metadataJson).toHaveProperty('code', 'AUTH_TEST');
  });
});
