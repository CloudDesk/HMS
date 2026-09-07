import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { EmergencyService } from '../src/modules/emergency/emergency.service.js';
import { createObjectId } from './factories.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';

test('Emergency Doctor Queue Filtering Tests', async (t) => {
  await setupTestDatabase();

  const branchId = createObjectId();
  const doctorUserId = createObjectId();
  const doctorId = createObjectId();
  const receptionistUserId = createObjectId();
  const otherDoctorId = createObjectId();

  t.afterEach(async () => {
    mock.restoreAll();
    await clearTestDatabase();
  });

  t.after(async () => {
    await teardownTestDatabase();
  });

  await t.test('Doctor user queue query filters by logged-in doctor + unassigned cases', async () => {
    let capturedDoctorId: string | undefined;

    const mockRepo = {
      hasBranchAccess: mock.fn(async () => true),
      doctorByUserId: mock.fn(async (userId: string) => {
        if (userId === doctorUserId) {
          return { _id: doctorId, userId: doctorUserId, displayName: 'Dr. Anderson' };
        }
        return null;
      }),
      list: mock.fn(async (query: unknown, departments?: string[], passedDoctorId?: string) => {
        capturedDoctorId = passedDoctorId;
        return {
          data: [
            { id: '1', patient_name: 'Patient A', assigned_doctor_id: doctorId },
            { id: '4', patient_name: 'Patient D', assigned_doctor_id: null },
          ],
          meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
        };
      }),
    };

    const service = new EmergencyService(
      mockRepo as unknown as ConstructorParameters<typeof EmergencyService>[0],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[1],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[2],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[3],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[4],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[5],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[6],
    );

    const result = await service.list({ branch_id: branchId }, doctorUserId);

    assert.equal(capturedDoctorId, doctorId);
    assert.equal(result.data.length, 2);
    assert.equal(result.data[0]?.assigned_doctor_id, doctorId);
    assert.equal(result.data[1]?.assigned_doctor_id, null);
  });

  await t.test('Non-doctor user (Receptionist/Nurse) queue query does not restrict to any doctor', async () => {
    let capturedDoctorId: string | undefined;

    const mockRepo = {
      hasBranchAccess: mock.fn(async () => true),
      doctorByUserId: mock.fn(async () => null),
      list: mock.fn(async (query: unknown, departments?: string[], passedDoctorId?: string) => {
        capturedDoctorId = passedDoctorId;
        return {
          data: [
            { id: '1', patient_name: 'Patient A', assigned_doctor_id: doctorId },
            { id: '2', patient_name: 'Patient B', assigned_doctor_id: otherDoctorId },
            { id: '4', patient_name: 'Patient D', assigned_doctor_id: null },
          ],
          meta: { total: 3, page: 1, limit: 20, totalPages: 1 },
        };
      }),
    };

    const service = new EmergencyService(
      mockRepo as unknown as ConstructorParameters<typeof EmergencyService>[0],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[1],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[2],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[3],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[4],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[5],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[6],
    );

    const result = await service.list({ branch_id: branchId }, receptionistUserId);

    assert.equal(capturedDoctorId, undefined);
    assert.equal(result.data.length, 3);
  });
});
