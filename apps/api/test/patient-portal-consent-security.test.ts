import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';
import { buildApp } from '../src/app.js';
import { setupTestDatabase, teardownTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { PatientModel, PatientDocumentModel } from '../src/modules/patients/patient.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { PatientAccessGrantModel } from '../src/modules/patient-portal/patient-access-grant.model.js';
import { seedDatabase } from '../src/database/seed.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

function createMultipartPayload(
  fields: Record<string, string>,
  fileField: { name: string; filename: string; contentType: string; data: Buffer }
) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  const chunks: Buffer[] = [];

  for (const [key, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}${crlf}Content-Disposition: form-data; name="${key}"${crlf}${crlf}${value}${crlf}`
      )
    );
  }

  chunks.push(
    Buffer.from(
      `--${boundary}${crlf}Content-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"${crlf}Content-Type: ${fileField.contentType}${crlf}${crlf}`
    )
  );
  chunks.push(fileField.data);
  chunks.push(Buffer.from(`${crlf}--${boundary}--${crlf}`));

  return {
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat(chunks),
  };
}

import { PatientDocumentStorageService } from '../src/shared/storage/patient-document-storage.service.js';

describe('HMS Patient Portal Consent Security & Authorization Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  const storageService = new PatientDocumentStorageService();

  const branchId = createObjectId();

  // Patient A
  const patientAId = createObjectId();
  const patientAUserId = createObjectId();

  // Patient B
  const patientBId = createObjectId();
  const patientBUserId = createObjectId();

  // Guardian user (authorized for Minor Dependent C, but NOT authorized for Patient A or B)
  const guardianUserId = createObjectId();
  const minorDependentCId = createObjectId();

  let patientAToken: string;
  let patientBToken: string;
  let guardianToken: string;

  let consentFormPatientAId: string;
  let consentFormPatientBId: string;
  let consentFormDependentCId: string;
  let clinicalDocPatientAId: string;

  beforeAll(async () => {
    await setupTestDatabase();

    await BranchModel.create([
      { _id: new Types.ObjectId(branchId), name: 'Main Branch', code: 'MB01', status: 'ACTIVE' },
      { _id: new Types.ObjectId(createObjectId()), name: 'Secondary Branch', code: 'SB01', status: 'ACTIVE' },
    ]);

    await seedDatabase();

    const patientRole = await RoleModel.findOne({ code: 'PATIENT' }).lean();
    const guardianRole = await RoleModel.findOne({ code: 'GUARDIAN' }).lean();

    // Create User & Patient A
    await UserModel.create({
      _id: new Types.ObjectId(patientAUserId),
      branchIds: [new Types.ObjectId(branchId)],
      departmentIds: [],
      username: 'patient_a_consent',
      email: 'patient_a@example.com',
      passwordHash: await hashPassword('password123'),
      firstName: 'Alice',
      lastName: 'Patient',
      fullName: 'Alice Patient',
      patientId: new Types.ObjectId(patientAId),
      roleIds: [patientRole!._id],
      status: 'active',
    });

    await PatientModel.create({
      _id: new Types.ObjectId(patientAId),
      userId: new Types.ObjectId(patientAUserId),
      patientNumber: 'HMS-2026-000001',
      firstName: 'Alice',
      lastName: 'Patient',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'FEMALE',
      contactNumber: '+254700000001',
      primaryBranchId: new Types.ObjectId(branchId),
      registeredBranchId: new Types.ObjectId(branchId),
      status: 'ACTIVE',
    });

    // Create User & Patient B
    await UserModel.create({
      _id: new Types.ObjectId(patientBUserId),
      branchIds: [new Types.ObjectId(branchId)],
      departmentIds: [],
      username: 'patient_b_consent',
      email: 'patient_b@example.com',
      passwordHash: await hashPassword('password123'),
      firstName: 'Bob',
      lastName: 'Patient',
      fullName: 'Bob Patient',
      patientId: new Types.ObjectId(patientBId),
      roleIds: [patientRole!._id],
      status: 'active',
    });

    await PatientModel.create({
      _id: new Types.ObjectId(patientBId),
      userId: new Types.ObjectId(patientBUserId),
      patientNumber: 'HMS-2026-000002',
      firstName: 'Bob',
      lastName: 'Patient',
      dateOfBirth: new Date('1985-05-15'),
      gender: 'MALE',
      contactNumber: '+254700000002',
      primaryBranchId: new Types.ObjectId(branchId),
      registeredBranchId: new Types.ObjectId(branchId),
      status: 'ACTIVE',
    });

    // Create Guardian User & Minor Dependent C
    await UserModel.create({
      _id: new Types.ObjectId(guardianUserId),
      branchIds: [new Types.ObjectId(branchId)],
      departmentIds: [],
      username: 'guardian_consent',
      email: 'guardian@example.com',
      passwordHash: await hashPassword('password123'),
      firstName: 'Grace',
      lastName: 'Guardian',
      fullName: 'Grace Guardian',
      roleIds: [guardianRole!._id],
      status: 'active',
    });

    await PatientModel.create({
      _id: new Types.ObjectId(minorDependentCId),
      patientNumber: 'HMS-2026-000003',
      firstName: 'Charlie',
      lastName: 'Minor',
      dateOfBirth: new Date('2020-03-10'),
      gender: 'OTHER',
      contactNumber: '+254700000003',
      primaryBranchId: new Types.ObjectId(branchId),
      registeredBranchId: new Types.ObjectId(branchId),
      status: 'ACTIVE',
    });

    // Authorize Guardian for Dependent C via PatientAccessGrantModel
    await PatientAccessGrantModel.create({
      userId: new Types.ObjectId(guardianUserId),
      patientId: new Types.ObjectId(minorDependentCId),
      relationship: 'PARENT',
      status: 'VERIFIED',
      isPrimary: true,
      verifiedAt: new Date(),
    });

    // Create Sample Consent Documents in DB & Storage
    const uploadedA = await storageService.uploadPatientDocument({
      patientId: patientAId,
      fileName: 'admission_consent_a.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('consent_pdf_data_a'),
    });

    const consentDocA = await PatientDocumentModel.create({
      patientId: new Types.ObjectId(patientAId),
      documentType: 'CONSENT',
      title: 'Inpatient Admission Consent - Patient A',
      fileName: 'admission_consent_a.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 102400,
      storageKey: uploadedA.storageKey,
      source: 'HOSPITAL',
      consentStatus: 'PENDING',
      status: 'ACTIVE',
    });
    consentFormPatientAId = String(consentDocA._id);

    const uploadedClinicalA = await storageService.uploadPatientDocument({
      patientId: patientAId,
      fileName: 'discharge_a.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('clinical_pdf_data_a'),
    });

    const clinicalDocA = await PatientDocumentModel.create({
      patientId: new Types.ObjectId(patientAId),
      documentType: 'CLINICAL',
      title: 'Discharge Summary - Patient A',
      fileName: 'discharge_a.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 204800,
      storageKey: uploadedClinicalA.storageKey,
      source: 'HOSPITAL',
      status: 'ACTIVE',
    });
    clinicalDocPatientAId = String(clinicalDocA._id);

    const uploadedB = await storageService.uploadPatientDocument({
      patientId: patientBId,
      fileName: 'surgery_consent_b.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('consent_pdf_data_b'),
    });

    const consentDocB = await PatientDocumentModel.create({
      patientId: new Types.ObjectId(patientBId),
      documentType: 'CONSENT',
      title: 'Surgical Informed Consent - Patient B',
      fileName: 'surgery_consent_b.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 150000,
      storageKey: uploadedB.storageKey,
      source: 'HOSPITAL',
      consentStatus: 'PENDING',
      status: 'ACTIVE',
    });
    consentFormPatientBId = String(consentDocB._id);

    const uploadedC = await storageService.uploadPatientDocument({
      patientId: minorDependentCId,
      fileName: 'pediatric_consent_c.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('consent_pdf_data_c'),
    });

    const consentDocC = await PatientDocumentModel.create({
      patientId: new Types.ObjectId(minorDependentCId),
      documentType: 'CONSENT',
      title: 'Pediatric Dental Procedure Consent - Dependent C',
      fileName: 'pediatric_consent_c.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 95000,
      storageKey: uploadedC.storageKey,
      source: 'HOSPITAL',
      consentStatus: 'PENDING',
      status: 'ACTIVE',
    });
    consentFormDependentCId = String(consentDocC._id);

    // Create Tokens
    patientAToken = signJwt(
      { sub: patientAUserId, username: 'patient_a_consent' },
      env.auth.accessTokenSecret,
      3600
    );

    patientBToken = signJwt(
      { sub: patientBUserId, username: 'patient_b_consent' },
      env.auth.accessTokenSecret,
      3600
    );

    guardianToken = signJwt(
      { sub: guardianUserId, username: 'guardian_consent' },
      env.auth.accessTokenSecret,
      3600
    );

    const appInstance = await buildApp();
    app = appInstance.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await teardownTestDatabase();
  });

  describe('Scenario A: Own Patient Consent Access & Signing', () => {
    it('Patient A can retrieve own consent documents list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/patient-portal/documents?patient_id=${patientAId}`,
        headers: { authorization: `Bearer ${patientAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.data).toBeDefined();
      const consentDoc = json.data.data.find((d: { id: string }) => d.id === consentFormPatientAId);
      expect(consentDoc).toBeDefined();
      expect(consentDoc.title).toBe('Inpatient Admission Consent - Patient A');
      expect(consentDoc.document_type).toBe('CONSENT');
    });

    it('Patient A can upload signature image for own consent document', async () => {
      const multipart = createMultipartPayload(
        {
          patient_id: patientAId,
          consent_document_id: consentFormPatientAId,
        },
        {
          name: 'file',
          filename: 'sig.png',
          contentType: 'image/png',
          data: Buffer.from('mock_signature_png_data'),
        }
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/patient-portal/consent-signature',
        headers: {
          authorization: `Bearer ${patientAToken}`,
          ...multipart.headers,
        },
        payload: multipart.payload,
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.data.document_type).toBe('CONSENT');
      expect(json.data.consent_kind).toBe('PATIENT_SIGNATURE');
      expect(json.data.context_id).toBe(consentFormPatientAId);
      expect(json.data.consent_status).toBe('SIGNED');
      expect(json.data.signed_by_name).toBe('Alice Patient');
    });
  });

  describe('Scenario B: Authorized Guardian / Dependent Access & Signing', () => {
    it('Guardian can retrieve authorized dependent consent documents', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/patient-portal/documents?patient_id=${minorDependentCId}`,
        headers: { authorization: `Bearer ${guardianToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      const consentDoc = json.data.data.find((d: { id: string }) => d.id === consentFormDependentCId);
      expect(consentDoc).toBeDefined();
      expect(consentDoc.title).toBe('Pediatric Dental Procedure Consent - Dependent C');
    });

    it('Guardian can upload signature for authorized dependent consent', async () => {
      const multipart = createMultipartPayload(
        {
          patient_id: minorDependentCId,
          consent_document_id: consentFormDependentCId,
        },
        {
          name: 'file',
          filename: 'guardian_sig.png',
          contentType: 'image/png',
          data: Buffer.from('mock_guardian_sig_png_data'),
        }
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/patient-portal/consent-signature',
        headers: {
          authorization: `Bearer ${guardianToken}`,
          ...multipart.headers,
        },
        payload: multipart.payload,
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.data.consent_kind).toBe('PATIENT_SIGNATURE');
      expect(json.data.context_id).toBe(consentFormDependentCId);
      expect(json.data.signed_by_name).toBe('Grace Guardian');
    });
  });

  describe('Scenario C: Unauthorized Cross-Patient Access Rejection', () => {
    it('Patient A cannot list Patient B consent documents (403)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/patient-portal/documents?patient_id=${patientBId}`,
        headers: { authorization: `Bearer ${patientAToken}` },
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.error.code).toBe('PATIENT_ACCESS_DENIED');
    });

    it('Guardian cannot list unlinked Patient A or Patient B documents (403)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/patient-portal/documents?patient_id=${patientAId}`,
        headers: { authorization: `Bearer ${guardianToken}` },
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.error.code).toBe('PATIENT_ACCESS_DENIED');
    });
  });

  describe('Scenario D: Consent Document Ownership Mismatch (ID Substitution)', () => {
    it('Patient A cannot upload signature for Patient B consent document even when passing patientAId', async () => {
      const multipart = createMultipartPayload(
        {
          patient_id: patientAId,
          consent_document_id: consentFormPatientBId, // Patient B's consent document!
        },
        {
          name: 'file',
          filename: 'tampered_sig.png',
          contentType: 'image/png',
          data: Buffer.from('mock_signature_data'),
        }
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/patient-portal/consent-signature',
        headers: {
          authorization: `Bearer ${patientAToken}`,
          ...multipart.headers,
        },
        payload: multipart.payload,
      });

      // Backend fails to find consentFormPatientBId under patientAId -> 404 NOT_FOUND
      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Scenario E: Non-Consent Document Signing Rejection', () => {
    it('Rejects signature upload when target document is not a consent form (400)', async () => {
      const multipart = createMultipartPayload(
        {
          patient_id: patientAId,
          consent_document_id: clinicalDocPatientAId, // CLINICAL discharge document!
        },
        {
          name: 'file',
          filename: 'sig.png',
          contentType: 'image/png',
          data: Buffer.from('mock_signature_data'),
        }
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/patient-portal/consent-signature',
        headers: {
          authorization: `Bearer ${patientAToken}`,
          ...multipart.headers,
        },
        payload: multipart.payload,
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error.code).toBe('INVALID_CONSENT_DOCUMENT');
    });
  });

  describe('Scenario F: Unauthenticated Request Rejection', () => {
    it('Rejects unauthenticated consent documents request (401)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/patient-portal/documents?patient_id=${patientAId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('Rejects unauthenticated consent signature upload (401)', async () => {
      const multipart = createMultipartPayload(
        {
          patient_id: patientAId,
          consent_document_id: consentFormPatientAId,
        },
        {
          name: 'file',
          filename: 'sig.png',
          contentType: 'image/png',
          data: Buffer.from('mock_data'),
        }
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/patient-portal/consent-signature',
        headers: multipart.headers,
        payload: multipart.payload,
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
