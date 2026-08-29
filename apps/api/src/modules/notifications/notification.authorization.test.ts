import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { env } from '../../config/env.js';
import { signJwt } from '../../shared/security/jwt.js';
import { BranchModel } from '../branches/branch.model.js';
import { PermissionModel } from '../permissions/permission.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { NotificationModel } from './notification.model.js';

type TestActor = {
  id: string;
  token: string;
};

type TestContext = {
  branchAId: string;
  branchBId: string;
  patient: TestActor;
  otherPatient: TestActor;
  staffWithoutPermission: TestActor;
  authorizedStaff: TestActor;
  branchBStaffId: string;
};

const createToken = (id: string, username: string) => signJwt(
  { sub: id, username },
  env.auth.accessTokenSecret,
  300,
);

const authorization = (actor: TestActor) => ({ authorization: `Bearer ${actor.token}` });

describe('notification authorization boundary', () => {
  let mongodb: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let context: TestContext;

  beforeAll(async () => {
    mongodb = await MongoMemoryServer.create();
    await mongoose.connect(mongodb.getUri());
    ({ app } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongodb.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();

    const [branchA, branchB] = await BranchModel.create([
      { code: 'NA01', name: 'Notification Branch A', status: 'ACTIVE' },
      { code: 'NB01', name: 'Notification Branch B', status: 'ACTIVE' },
    ]);
    const [viewPermission, createPermission] = await PermissionModel.create([
      {
        code: 'ADMINISTRATION_NOTIFICATIONS_VIEW',
        name: 'Notifications View',
        module: 'Administration',
        screen: 'Notifications',
        action: 'View',
        type: 'system',
        status: 'active',
      },
      {
        code: 'ADMINISTRATION_NOTIFICATIONS_CREATE',
        name: 'Notifications Create',
        module: 'Administration',
        screen: 'Notifications',
        action: 'Create',
        type: 'system',
        status: 'active',
      },
    ]);
    const [patientRole, staffRole, authorizedRole, receptionistRole] = await RoleModel.create([
      { code: 'PATIENT', name: 'Patient', permissionIds: [], status: 'active' },
      { code: 'STAFF_WITHOUT_NOTIFICATION_ACCESS', name: 'Staff', permissionIds: [], status: 'active' },
      {
        code: 'NOTIFICATION_ADMIN',
        name: 'Notification Administrator',
        permissionIds: [viewPermission._id, createPermission._id],
        status: 'active',
      },
      { code: 'RECEPTIONIST', name: 'Receptionist', permissionIds: [], status: 'active' },
    ]);

    const patientId = new mongoose.Types.ObjectId();
    const [patient, otherPatient, staffWithoutPermission, authorizedStaff, branchBStaff] =
      await UserModel.create([
        {
          username: 'notification.patient',
          email: 'notification.patient@example.test',
          fullName: 'Notification Patient',
          passwordHash: 'unused',
          patientId,
          roleIds: [patientRole._id],
          branchIds: [],
          departmentIds: [],
          status: 'active',
        },
        {
          username: 'notification.other.patient',
          email: 'notification.other.patient@example.test',
          fullName: 'Other Notification Patient',
          passwordHash: 'unused',
          patientId: new mongoose.Types.ObjectId(),
          roleIds: [patientRole._id],
          branchIds: [],
          departmentIds: [],
          status: 'active',
        },
        {
          username: 'notification.staff.denied',
          email: 'notification.staff.denied@example.test',
          fullName: 'Notification Staff Denied',
          passwordHash: 'unused',
          roleIds: [staffRole._id],
          branchIds: [branchA._id],
          departmentIds: [],
          status: 'active',
        },
        {
          username: 'notification.staff.allowed',
          email: 'notification.staff.allowed@example.test',
          fullName: 'Notification Staff Allowed',
          passwordHash: 'unused',
          roleIds: [authorizedRole._id],
          branchIds: [branchA._id],
          departmentIds: [],
          status: 'active',
        },
        {
          username: 'notification.branch.b.staff',
          email: 'notification.branch.b.staff@example.test',
          fullName: 'Notification Branch B Staff',
          passwordHash: 'unused',
          roleIds: [receptionistRole._id],
          branchIds: [branchB._id],
          departmentIds: [],
          status: 'active',
        },
      ]);

    await NotificationModel.create([
      {
        recipientRole: 'RECEPTIONIST',
        recipientBranchId: branchA._id,
        title: 'Branch A staff notification',
        message: 'Visible in authorized Branch A global scope.',
        type: 'GENERAL',
      },
      {
        recipientRole: 'RECEPTIONIST',
        recipientBranchId: branchB._id,
        title: 'Branch B staff notification',
        message: 'Must not be visible in Branch A global scope.',
        type: 'GENERAL',
      },
      {
        recipientRole: 'RECEPTIONIST',
        recipientBranchId: null,
        title: 'Unscoped staff notification',
        message: 'Must not be visible to a branch-scoped global viewer.',
        type: 'GENERAL',
      },
      {
        recipientUserId: patient._id,
        title: 'Patient own notification',
        message: 'Visible only to the patient.',
        type: 'GENERAL',
      },
      {
        recipientUserId: otherPatient._id,
        title: 'Other patient notification',
        message: 'Must not be visible to the first patient.',
        type: 'GENERAL',
      },
    ]);

    context = {
      branchAId: branchA._id.toString(),
      branchBId: branchB._id.toString(),
      patient: {
        id: patient._id.toString(),
        token: createToken(patient._id.toString(), patient.username),
      },
      otherPatient: {
        id: otherPatient._id.toString(),
        token: createToken(otherPatient._id.toString(), otherPatient.username),
      },
      staffWithoutPermission: {
        id: staffWithoutPermission._id.toString(),
        token: createToken(staffWithoutPermission._id.toString(), staffWithoutPermission.username),
      },
      authorizedStaff: {
        id: authorizedStaff._id.toString(),
        token: createToken(authorizedStaff._id.toString(), authorizedStaff.username),
      },
      branchBStaffId: branchBStaff._id.toString(),
    };
  });

  it('rejects unauthenticated global list requests', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/notifications' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects patient global list requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: authorization(context.patient),
    });
    expect(response.statusCode).toBe(403);
  });

  it('rejects staff global list requests without permission', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: authorization(context.staffWithoutPermission),
    });
    expect(response.statusCode).toBe(403);
  });

  it('allows an authorized staff user to list only assigned-branch notifications', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: authorization(context.authorizedStaff),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: { data: Array<{ title: string; recipient_branch_id: string | null }> } }>();
    expect(body.data.data.map((item) => item.title)).toEqual(['Branch A staff notification']);
    expect(body.data.data[0]?.recipient_branch_id).toBe(context.branchAId);
  });

  it('rejects a global list filter outside the authorized branch scope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/notifications?recipient_branch_id=${context.branchBId}`,
      headers: authorization(context.authorizedStaff),
    });
    expect(response.statusCode).toBe(403);
  });

  it('rejects unauthenticated global create requests', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications',
      payload: {
        recipient_role: 'RECEPTIONIST',
        recipient_branch_id: context.branchAId,
        title: 'Denied',
        message: 'Denied',
        type: 'GENERAL',
      },
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects patient global create requests', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications',
      headers: authorization(context.patient),
      payload: {
        recipient_role: 'RECEPTIONIST',
        recipient_branch_id: context.branchAId,
        title: 'Denied',
        message: 'Denied',
        type: 'GENERAL',
      },
    });
    expect(response.statusCode).toBe(403);
  });

  it('rejects staff global create requests without permission', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications',
      headers: authorization(context.staffWithoutPermission),
      payload: {
        recipient_role: 'RECEPTIONIST',
        recipient_branch_id: context.branchAId,
        title: 'Denied',
        message: 'Denied',
        type: 'GENERAL',
      },
    });
    expect(response.statusCode).toBe(403);
  });

  it('allows authorized branch-scoped creation and derives the actor server-side', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications',
      headers: authorization(context.authorizedStaff),
      payload: {
        recipient_role: 'RECEPTIONIST',
        recipient_branch_id: context.branchAId,
        title: 'Authorized notification',
        message: 'Created in Branch A.',
        type: 'GENERAL',
      },
    });
    expect(response.statusCode).toBe(200);
    const notification = await NotificationModel.findOne({ title: 'Authorized notification' }).lean();
    expect(notification?.createdBy?.toString()).toBe(context.authorizedStaff.id);
  });

  it('ignores client attempts to spoof sender or actor identity', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications',
      headers: authorization(context.authorizedStaff),
      payload: {
        recipient_role: 'RECEPTIONIST',
        recipient_branch_id: context.branchAId,
        title: 'Spoofed notification',
        message: 'The authenticated actor must be recorded.',
        type: 'GENERAL',
        createdBy: context.patient.id,
      },
    });
    expect(response.statusCode).toBe(200);
    const notification = await NotificationModel.findOne({ title: 'Spoofed notification' }).lean();
    expect(notification?.createdBy?.toString()).toBe(context.authorizedStaff.id);
    expect(notification?.createdBy?.toString()).not.toBe(context.patient.id);
  });

  it('rejects malformed recipient ObjectIds', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications',
      headers: authorization(context.authorizedStaff),
      payload: {
        recipient_user_id: 'not-an-object-id',
        recipient_branch_id: context.branchAId,
        title: 'Invalid recipient',
        message: 'Must be rejected.',
        type: 'GENERAL',
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects notification creation outside the actor branch scope', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications',
      headers: authorization(context.authorizedStaff),
      payload: {
        recipient_role: 'RECEPTIONIST',
        recipient_branch_id: context.branchBId,
        title: 'Wrong branch',
        message: 'Must be rejected.',
        type: 'GENERAL',
      },
    });
    expect(response.statusCode).toBe(403);
  });

  it('rejects a recipient user outside the selected branch', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications',
      headers: authorization(context.authorizedStaff),
      payload: {
        recipient_user_id: context.branchBStaffId,
        recipient_branch_id: context.branchAId,
        title: 'Wrong recipient scope',
        message: 'Must be rejected.',
        type: 'GENERAL',
      },
    });
    expect(response.statusCode).toBe(403);
  });

  it('keeps /notifications/me scoped to the authenticated patient', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/notifications/me',
      headers: authorization(context.patient),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: { data: Array<{ title: string }> } }>();
    expect(body.data.data.map((item) => item.title)).toEqual(['Patient own notification']);
  });

  it('ignores another user id on /notifications/me and remains self-scoped', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/notifications/me?user_id=${context.otherPatient.id}`,
      headers: authorization(context.patient),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: { data: Array<{ title: string }> } }>();
    expect(body.data.data.map((item) => item.title)).toEqual(['Patient own notification']);
  });
});
