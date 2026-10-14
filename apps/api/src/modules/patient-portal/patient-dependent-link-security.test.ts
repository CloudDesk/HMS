import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { env } from '../../config/env.js';
import { signJwt } from '../../shared/security/jwt.js';
import { AuthRateLimitModel } from '../auth/auth-rate-limit.model.js';
import { AuthRateLimitRepository } from '../auth/auth-rate-limit.repository.js';
import { PatientModel } from '../patients/patient.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { PatientAccessGrantModel } from './patient-access-grant.model.js';
import { PatientPortalRepository } from './patient-portal.repository.js';

describe('C1 dependent linking security', () => {
  let mongo: MongoMemoryReplSet;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let guardianId: Types.ObjectId;
  let patientId: Types.ObjectId;
  let token: string;
  const repository = new PatientPortalRepository();
  const payload = {
    patient_number: 'HMS-2026-000001', date_of_birth: '2018-01-01',
    relationship: 'PARENT', legal_consent_accepted: true,
  };
  const link = (body = payload, ip = '127.0.0.1', bearer = token) => app.inject({
    method: 'POST', url: '/api/patient-portal/dependents/link', remoteAddress: ip,
    headers: { authorization: `Bearer ${bearer}` }, payload: body,
  });

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    ({ app } = await buildApp());
    app.log.level = 'silent';
    await PatientAccessGrantModel.init();
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
    await mongoose.disconnect();
    await mongo?.stop();
  });
  beforeEach(async () => {
    await Promise.all([
      PatientModel.deleteMany({}), UserModel.deleteMany({}), RoleModel.deleteMany({}),
      PatientAccessGrantModel.deleteMany({}), AuthRateLimitModel.deleteMany({}),
    ]);
    const role = await RoleModel.create({ name: 'Guardian', code: 'GUARDIAN', permissionIds: [], status: 'active' });
    const guardian = await UserModel.create({
      username: 'guardian', email: 'guardian@example.com', fullName: 'Guardian', passwordHash: 'unused',
      roleIds: [role._id], status: 'active',
    });
    guardianId = guardian._id;
    token = signJwt({ sub: String(guardianId), username: guardian.username }, env.auth.accessTokenSecret, 300);
    const patient = await PatientModel.create({
      patientNumber: payload.patient_number, firstName: 'Child', lastName: 'Test',
      dateOfBirth: new Date(payload.date_of_birth), gender: 'UNKNOWN', status: 'ACTIVE',
    });
    patientId = patient._id;
  });

  it('accepts a valid request only as pending and hides it from patient context and protected access', async () => {
    const response = await link();
    expect(response.statusCode).toBe(202);
    expect(response.json().data.status).toBe('PENDING');
    expect(response.json().data.patientId).toBeUndefined();
    expect(await PatientAccessGrantModel.findOne({ userId: guardianId }).lean())
      .toMatchObject({ status: 'PENDING', verifiedAt: null, verifiedBy: null });
    expect((await repository.listAccessiblePatients(String(guardianId)))?.patients).toEqual([]);
    expect(await repository.resolveAccessiblePatientId(String(guardianId), String(patientId))).toBeNull();
    const denied = await app.inject({ method: 'GET', url: `/api/patient-portal/overview?patient_id=${patientId}`,
      headers: { authorization: `Bearer ${token}` } });
    expect(denied.statusCode).toBe(404);
  });

  it('returns the same response for correct details, incorrect DOB and nonexistent MRN', async () => {
    const valid = await link();
    const wrongDob = await link({ ...payload, date_of_birth: '2017-01-01' });
    const missing = await link({ ...payload, patient_number: 'HMS-2026-999999' });
    expect(wrongDob.statusCode).toBe(valid.statusCode);
    expect(missing.statusCode).toBe(valid.statusCode);
    expect(wrongDob.json().data).toEqual(valid.json().data);
    expect(missing.json().data).toEqual(valid.json().data);
    expect(await PatientAccessGrantModel.countDocuments()).toBe(1);
  });

  it('requires independent verification; retries cannot verify or revive a grant', async () => {
    await link();
    await link();
    expect(await repository.resolveAccessiblePatientId(String(guardianId), String(patientId))).toBeNull();
    // A trusted approval is represented by VERIFIED; the public link endpoint cannot perform it.
    await PatientAccessGrantModel.updateOne({ userId: guardianId }, { $set: {
      status: 'VERIFIED', verifiedBy: new Types.ObjectId(), verifiedAt: new Date(),
    } });
    expect(await repository.resolveAccessiblePatientId(String(guardianId), String(patientId))).toBe(String(patientId));
    await link();
    expect(await repository.resolveAccessiblePatientId(String(guardianId), String(patientId))).toBe(String(patientId));
    await PatientAccessGrantModel.updateOne({ userId: guardianId }, { $set: { status: 'REVOKED', revokedAt: new Date() } });
    await link();
    expect(await repository.resolveAccessiblePatientId(String(guardianId), String(patientId))).toBeNull();
  });

  it('preserves existing valid access but rejects another guardian or changed patient identifier', async () => {
    await PatientAccessGrantModel.create({ userId: guardianId, patientId, relationship: 'PARENT', status: 'VERIFIED' });
    await link();
    expect(await repository.resolveAccessiblePatientId(String(guardianId), String(patientId))).toBe(String(patientId));
    expect(await repository.resolveAccessiblePatientId(String(new Types.ObjectId()), String(patientId))).toBeNull();
    expect(await repository.resolveAccessiblePatientId(String(guardianId), String(new Types.ObjectId()))).toBeNull();
  });

  it('limits invalid attempts per account even when the client IP changes', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await link({ ...payload, patient_number: 'HMS-2026-999999' }, `192.0.2.${i + 1}`)).statusCode).toBe(202);
    }
    expect((await link(payload, '192.0.2.99')).statusCode).toBe(429);
    expect(await PatientAccessGrantModel.countDocuments()).toBe(0);
  });

  it('limits a shared client IP across authenticated accounts', async () => {
    const role = await RoleModel.findOne({ code: 'GUARDIAN' }).orFail();
    for (let i = 0; i < 21; i++) {
      const user = await UserModel.create({ username: `guardian${i}`, email: `guardian${i}@example.com`, fullName: 'Guardian',
        passwordHash: 'unused', roleIds: [role._id], status: 'active' });
      const bearer = signJwt({ sub: String(user._id), username: user.username }, env.auth.accessTokenSecret, 300);
      const response = await link({ ...payload, patient_number: 'HMS-2026-999999' }, '192.0.2.1', bearer);
      expect(response.statusCode).toBe(i < 20 ? 202 : 429);
    }
  });

  it.each(['PENDING', 'REJECTED', 'REVOKED'] as const)(
    'denies %s access through context, document, invoice and photo endpoints with the same login token', async (status) => {
      await PatientAccessGrantModel.create({ userId: guardianId, patientId, relationship: 'PARENT', status: 'VERIFIED' });
      const headers = { authorization: `Bearer ${token}` };
      const before = await app.inject({ method: 'GET', url: '/api/patient-portal/context', headers });
      expect(before.json().data.patients).toHaveLength(1);
      await PatientAccessGrantModel.updateOne({ userId: guardianId }, { $set: {
        status, revokedAt: status === 'REVOKED' ? new Date() : null,
      } });
      const context = await app.inject({ method: 'GET', url: '/api/patient-portal/context', headers });
      expect(context.json().data.patients).toEqual([]);
      const resourceId = new Types.ObjectId();
      for (const url of [
        `/api/patient-portal/documents?patient_id=${patientId}`,
        `/api/patient-portal/patients/${patientId}/invoices/${resourceId}`,
        `/api/patient-portal/patients/${patientId}/documents/${resourceId}/download`,
        `/api/patient-portal/patients/${patientId}/profile-photo`,
      ]) {
        const response = await app.inject({ method: 'GET', url, headers });
        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe('PATIENT_ACCESS_DENIED');
      }
      expect((await app.inject({ method: 'GET', url: '/api/patient-portal/overview', headers })).statusCode).toBe(404);
    },
  );

  it('does not accept caller-supplied approval or fill in uncertain legacy provenance', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/patient-portal/dependents/link',
      headers: { authorization: `Bearer ${token}` }, payload: {
        ...payload, status: 'VERIFIED', verifiedBy: String(guardianId), verifiedAt: new Date().toISOString(),
      } });
    expect(response.statusCode).toBe(202);
    expect(await PatientAccessGrantModel.findOne({ userId: guardianId }).lean())
      .toMatchObject({ status: 'PENDING', verifiedBy: null, verifiedAt: null });
    // Preserve evidence for controlled review, without treating a retry as new verification.
    await PatientAccessGrantModel.updateOne({ userId: guardianId }, { $set: { status: 'VERIFIED' } });
    await link();
    expect(await PatientAccessGrantModel.findOne({ userId: guardianId }).lean())
      .toMatchObject({ status: 'VERIFIED', verifiedBy: null, verifiedAt: null });
  });

  it('does not let staff without guardian authority use linking to approve a relationship', async () => {
    const role = await RoleModel.create({ name: 'Staff', code: 'STAFF', permissionIds: [], status: 'active' });
    const user = await UserModel.create({ username: 'staff', email: 'staff@example.com', fullName: 'Staff',
      passwordHash: 'unused', roleIds: [role._id], status: 'active' });
    const bearer = signJwt({ sub: String(user._id), username: user.username }, env.auth.accessTokenSecret, 300);
    expect((await link(payload, '192.0.2.1', bearer)).statusCode).toBe(403);
    expect(await PatientAccessGrantModel.countDocuments()).toBe(0);
  });

  it('shares atomic limits across repository instances and starts new windows independently of TTL cleanup', async () => {
    const now = new Date('2026-10-12T10:00:00Z');
    const attempts = await Promise.all(Array.from({ length: 20 }, () =>
      new AuthRateLimitRepository().consume('dependent-link-account', 'test-key', 5, 900, now)));
    expect(attempts.filter(Boolean).length).toBeLessThanOrEqual(5);
    const row = await AuthRateLimitModel.findOne({ scope: 'dependent-link-account' }).orFail();
    expect(row.count).toBe(attempts.filter(Boolean).length);
    expect(row.expiresAt).toEqual(new Date('2026-10-12T10:30:00Z'));
    const otherInstance = new AuthRateLimitRepository();
    while (await otherInstance.consume('dependent-link-account', 'test-key', 5, 900, now)) { /* Fill any first-insert race rejections. */ }
    expect(await otherInstance.consume('dependent-link-account', 'test-key', 5, 900, now)).toBe(false);
    expect(await otherInstance.consume('dependent-link-account', 'test-key', 5, 900, new Date('2026-10-12T10:15:00Z'))).toBe(true);
  });

  it('fails closed before patient lookup if the shared limiter is unavailable', async () => {
    vi.spyOn(AuthRateLimitRepository.prototype, 'consume').mockRejectedValue(new Error('Limiter unavailable'));
    const lookup = vi.spyOn(PatientPortalRepository.prototype, 'findPatientToLinkAsDependent');
    expect((await link()).statusCode).toBe(500);
    expect(lookup).not.toHaveBeenCalled();
    expect(await PatientAccessGrantModel.countDocuments()).toBe(0);
  });
});
