import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { NotificationRepository } from '../src/modules/notifications/notification.repository.js';
import { NotificationService } from '../src/modules/notifications/notification.service.js';
import { NotificationModel } from '../src/modules/notifications/notification.model.js';
import { PatientAccessGrantModel } from '../src/modules/patient-portal/patient-access-grant.model.js';
import { PatientPortalRepository } from '../src/modules/patient-portal/patient-portal.repository.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';

describe('C1/H11 current-access notification boundary', () => {
  const repo = new NotificationRepository();
  const portal = new PatientPortalRepository();
  const patient = new Types.ObjectId();
  let user: Types.ObjectId;
  const payload = () => ({ patientId: String(patient), type: 'LAB_RESULT' as const, title: 'Update', message: 'An update is available.', relatedEntityId: String(new Types.ObjectId()) });
  beforeAll(async () => { await setupTestDatabase(); await NotificationModel.init(); await PatientAccessGrantModel.init(); });
  afterAll(teardownTestDatabase);
  afterEach(() => vi.restoreAllMocks());
  beforeEach(async () => {
    await clearTestDatabase();
    const role = await RoleModel.create({code:'GUARDIAN',name:'Guardian',status:'active',permissionIds:[]});
    const account = await UserModel.create({username:'security-fixture',email:'security-fixture@example.test',fullName:'Synthetic Account',passwordHash:'unused',status:'active',roleIds:[role._id],branchIds:[]});
    user = account._id;
  });
  it.each(['PENDING', 'REJECTED', 'REVOKED'] as const)('%s grants cannot receive or expose historical notifications or authorize destinations', async (status) => {
    await PatientAccessGrantModel.create({userId:user,patientId:patient,relationship:'PARENT',status});
    const old = await NotificationModel.create({recipientUserId:user,recipientRole:'PATIENT',patientId:patient,type:'LAB_RESULT',title:'Update',message:'Update'});
    expect(await repo.createPatientNotifications(payload())).toEqual([]);
    expect((await repo.listForUser(String(user), {})).meta.total).toBe(0);
    expect(await repo.markAsReadForUser(String(old._id), String(user))).toBeUndefined();
    expect(await portal.resolveAccessiblePatientId(String(user),String(patient))).toBeNull();
  });
  it('revocation timestamp alone denies new delivery, old reads, mark-read and destination access', async () => {
    const grant = await PatientAccessGrantModel.create({userId:user,patientId:patient,relationship:'PARENT',status:'VERIFIED'});
    const created = await repo.createPatientNotifications(payload());
    expect(created).toHaveLength(1);
    expect((await repo.listForUser(String(user), {})).meta.total).toBe(1);
    await PatientAccessGrantModel.updateOne({_id:grant._id},{$set:{revokedAt:new Date()}});
    expect(await repo.createPatientNotifications(payload())).toEqual([]);
    expect((await repo.listForUser(String(user), {})).meta.total).toBe(0);
    expect(await repo.markAsReadForUser(created[0].id,String(user))).toBeUndefined();
    expect(await portal.resolveAccessiblePatientId(String(user),String(patient))).toBeNull();
  });
  it('inactive accounts cannot receive or read notifications even with a verified grant', async () => {
    await PatientAccessGrantModel.create({userId:user,patientId:patient,relationship:'PARENT',status:'VERIFIED'});
    await repo.createPatientNotifications(payload());
    await UserModel.updateOne({_id:user},{$set:{status:'inactive'}});
    expect(await repo.createPatientNotifications(payload())).toEqual([]);
    expect((await repo.listForUser(String(user),{})).data).toEqual([]);
    await repo.syncPatientNotifications(String(user));
  });
  it('a targeted patient notification is not broadcast to another patient-role account', async () => {
    const role = await RoleModel.findOne({code:'GUARDIAN'});
    await RoleModel.updateOne({_id:role?._id},{$set:{code:'PATIENT'}});
    await NotificationModel.create({recipientUserId:new Types.ObjectId(),recipientRole:'PATIENT',type:'LAB_RESULT',title:'Update',message:'Update'});
    expect((await repo.listForUser(String(user),{})).data).toEqual([]);
  });
  it('missing status fails closed and activation cannot promote pending/revoked legacy rows', async () => {
    const grant = await PatientAccessGrantModel.create({userId:user,patientId:patient,relationship:'PARENT'});
    expect(grant.status).toBe('PENDING');
    await expect(portal.ensureAccessGrant(String(user),String(patient),'PARENT')).rejects.toMatchObject({code:'PATIENT_RELATIONSHIP_CONFLICT'});
    await PatientAccessGrantModel.updateOne({_id:grant._id},{$set:{status:'REVOKED',revokedAt:new Date()}});
    await expect(portal.ensureAccessGrant(String(user),String(patient),'PARENT')).rejects.toMatchObject({code:'PATIENT_RELATIONSHIP_CONFLICT'});
    expect((await PatientAccessGrantModel.findById(grant._id))?.status).toBe('REVOKED');
  });
  it('suppresses only duplicate-only errors and preserves repeated-trigger idempotency', async () => {
    await PatientAccessGrantModel.create({userId:user,patientId:patient,relationship:'PARENT',status:'VERIFIED'});
    const data = payload();
    expect(await repo.createPatientNotifications(data)).toHaveLength(1);
    expect(await repo.createPatientNotifications(data)).toEqual([]);
    const insert = vi.spyOn(NotificationModel,'insertMany');
    insert.mockRejectedValueOnce({code:11000,writeErrors:[{code:11000}]});
    expect(await repo.createPatientNotifications(payload())).toEqual([]);
    const mixed = {code:11000,writeErrors:[{code:11000},{code:121}]};
    insert.mockRejectedValueOnce(mixed);
    await expect(repo.createPatientNotifications(payload())).rejects.toBe(mixed);
    insert.mockRejectedValueOnce({code:91});
    await expect(repo.createPatientNotifications(payload())).rejects.toMatchObject({code:91});
  });
  it('service boundary contains delivery failures without claiming a queued retry', async () => {
    vi.spyOn(repo,'createPatientNotifications').mockRejectedValueOnce(new Error('synthetic failure'));
    const warning = vi.spyOn(console,'warn').mockImplementation(() => {});
    expect(await new NotificationService(repo).notifyPatient(payload())).toEqual([]);
    expect(warning).toHaveBeenCalledWith('Patient notification persistence failed; delivery is not queued for retry.');
  });
});
