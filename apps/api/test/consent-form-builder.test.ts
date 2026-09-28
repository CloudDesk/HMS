import { describe, it, beforeAll as before, afterAll as after, expect } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { ConsentService } from '../src/modules/consents/consent.service.js';
import { ConsentRepository } from '../src/modules/consents/consent.repository.js';
import { ConsentTemplateModel } from '../src/modules/consents/consent.model.js';
import { PatientRepository } from '../src/modules/patients/patient.repository.js';
import { PatientService } from '../src/modules/patients/patient.service.js';
import { PatientDocumentStorageService } from '../src/shared/storage/patient-document-storage.service.js';
import { SequenceService } from '../src/shared/sequence/sequence.service.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import type { ConsentFormDefinition } from '../src/modules/consents/consent.types.js';

describe('Consent Form Builder & Structured Execution', () => {
  let consentService: ConsentService;
  let consentRepo: ConsentRepository;
  let patientService: PatientService;
  let branchId: string;
  let userId: string;

  before(async () => {
    await setupTestDatabase();
    await clearTestDatabase();

    const role = await RoleModel.create({
      name: 'Super Admin',
      code: 'SUPER_ADMIN',
      description: 'Admin role',
      status: 'active',
      permissionIds: [],
    });

    const branch = await BranchModel.create({
      name: 'Central Dental Hospital',
      code: 'CDH-01',
      type: 'HEADQUARTERS',
      contact: '1234567890',
      address: '123 Health Ave, Metropolis',
      status: 'ACTIVE',
    });
    branchId = branch._id.toString();

    const user = await UserModel.create({
      username: 'consent_admin',
      email: 'admin@dental.org',
      passwordHash: 'dummyhash',
      fullName: 'Dr. Jane Admin',
      status: 'active',
      branchIds: [branch._id],
      roleIds: [role._id],
    });
    userId = user._id.toString();

    const sequenceService = new SequenceService();
    const patientRepo = new PatientRepository(sequenceService);
    const storageService = new PatientDocumentStorageService();
    patientService = new PatientService(patientRepo, storageService, sequenceService);
    consentRepo = new ConsentRepository();
    consentService = new ConsentService(consentRepo, patientRepo);
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('creates a consent template in DRAFT status by default', async () => {
    const created = await consentService.create(
      {
        code: 'SURG_CONSENT',
        name: 'Surgical Extraction Consent',
        category: 'SURGICAL',
        context_type: 'PROCEDURE',
        mandatory: true,
        branch_id: branchId,
      },
      userId,
    );

    expect(created.status).toBe('DRAFT');
    expect(created.version).toBe(1);
    expect(created.code).toBe('SURG_CONSENT');
    expect(created.form_definition).toBeFalsy();
  });

  it('saves a structured form definition to a draft template', async () => {
    const template = await ConsentTemplateModel.findOne({ code: 'SURG_CONSENT', version: 1 });
    expect(template).toBeDefined();

    const sampleDefinition: ConsentFormDefinition = {
      sections: [
        {
          id: 'sec-1',
          title: 'Patient Identification',
          displayOrder: 0,
          required: true,
          fields: [
            {
              id: 'fld-1',
              fieldKey: 'patient_name',
              label: 'Patient Full Name',
              type: 'SYSTEM_FIELD',
              systemFieldKey: 'patient_name',
              displayOrder: 0,
              required: true,
              readOnly: true,
            },
            {
              id: 'fld-2',
              fieldKey: 'has_allergies',
              label: 'Do you have known drug or latex allergies?',
              type: 'RADIO',
              options: ['Yes', 'No'],
              displayOrder: 1,
              required: true,
            },
            {
              id: 'fld-3',
              fieldKey: 'allergy_details',
              label: 'Please specify your allergies and reactions',
              type: 'LONG_TEXT',
              displayOrder: 2,
              required: true,
              visibilityRule: {
                fieldKey: 'has_allergies',
                operator: 'EQUALS',
                value: 'Yes',
              },
            },
          ],
        },
      ],
      declaration: {
        title: 'Patient Declaration',
        text: 'I acknowledge that the procedure risks have been thoroughly explained to me.',
        requireCheckbox: true,
      },
      signatures: {
        patientRequired: true,
        guardianAllowed: false,
        doctorRequired: true,
        witnessAllowed: false,
      },
    };

    const updated = await consentService.saveFormDefinition(
      template!._id.toString(),
      branchId,
      sampleDefinition,
      userId,
    );

    expect(updated.form_definition).toBeDefined();
    expect(updated.form_definition?.sections).toHaveLength(1);
    expect(updated.form_definition?.sections[0]?.fields).toHaveLength(3);
    expect(updated.status).toBe('DRAFT');
  });

  it('publishes the consent template, transitioning to ACTIVE and stamping publishedAt', async () => {
    const template = await ConsentTemplateModel.findOne({ code: 'SURG_CONSENT', version: 1 });
    const published = await consentService.publish(template!._id.toString(), branchId, userId);

    expect(published.status).toBe('ACTIVE');
    expect(published.published_at).toBeDefined();
    expect(published.published_by).toBe(userId);
  });

  it('prevents direct modification of a published template (immutability enforcement)', async () => {
    const template = await ConsentTemplateModel.findOne({ code: 'SURG_CONSENT', version: 1 });
    
    // Attempting to modify formDefinition on published ACTIVE template should reject
    await expect(
      consentService.saveFormDefinition(
        template!._id.toString(),
        branchId,
        { sections: [], declaration: { text: 'New', requireCheckbox: true }, signatures: { patientRequired: true, doctorRequired: false } },
        userId,
      ),
    ).rejects.toThrow('Published consent template is immutable');
  });

  it('creates next version (v2 Draft) preserving the original v1 published template', async () => {
    const templateV1 = await ConsentTemplateModel.findOne({ code: 'SURG_CONSENT', version: 1 });
    const nextVersion = await consentService.createNextVersion(templateV1!._id.toString(), branchId, userId);

    expect(nextVersion.version).toBe(2);
    expect(nextVersion.status).toBe('DRAFT');
    expect(nextVersion.code).toBe('SURG_CONSENT');
    expect(nextVersion.form_definition?.sections).toHaveLength(1);

    // Verify v1 is still ACTIVE and untouched
    const v1Check = await ConsentTemplateModel.findOne({ code: 'SURG_CONSENT', version: 1 });
    expect(v1Check?.status).toBe('ACTIVE');
    expect(v1Check?.version).toBe(1);
  });

  it('executes structured patient consent submission with auto-generated HTML & signatures', async () => {
    const template = await ConsentTemplateModel.findOne({ code: 'SURG_CONSENT', version: 1 });

    // Create a test patient
    const patient = await patientService.create(
      {
        first_name: 'Arthur',
        last_name: 'Dent',
        date_of_birth: '1985-03-11',
        gender: 'MALE',
        phone: '+254712345678',
        registration_branch_id: branchId,
      },
      userId,
    );

    const completeResult = await patientService.completeStructuredConsent(
      patient.id,
      {
        branch_id: branchId,
        template_id: template!._id.toString(),
        context_type: 'PROCEDURE',
        context_id: 'PROC-101',
        form_responses: {
          patient_name: 'Arthur Dent',
          has_allergies: 'Yes',
          allergy_details: 'Penicillin allergy with mild rash',
        },
        signatures: [
          {
            signer_type: 'PATIENT',
            signer_name: 'Arthur Dent',
            signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            signed_at: new Date().toISOString(),
          },
          {
            signer_type: 'DOCTOR',
            signer_name: 'Dr. Jane Admin',
            signature_data: 'Dr. Jane Admin [Verified Digital Stamp]',
            signed_at: new Date().toISOString(),
          },
        ],
        declaration_accepted: true,
        notes: 'Signed prior to extraction',
      },
      userId,
    );

    expect(completeResult.document_type).toBe('CONSENT');
    expect(completeResult.consent_status).toBe('SIGNED');
    expect(completeResult.review_status).toBe('VERIFIED');
    expect(completeResult.consent_version).toBe(1);
    expect(completeResult.form_responses).toBeDefined();
    expect(completeResult.form_responses).toHaveProperty('has_allergies', 'Yes');
    expect(completeResult.digital_signatures).toHaveLength(2);
    expect(completeResult.mime_type).toBe('text/html');

    // Verify patient history has event
    const history = await patientService.getHistory(patient.id, userId);
    expect(history.documents).toHaveLength(1);
    expect(history.timeline.some((t) => t.event_type === 'CONSENT_VERIFIED')).toBe(true);
  });
});
