import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { EmergencyService } from '../src/modules/emergency/emergency.service.js';
import { createObjectId } from './factories.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';

describe('Emergency Doctor Queue Filtering Tests', () => {
  const branchId = createObjectId();
  const doctorUserId = createObjectId();
  const doctorId = createObjectId();
  const receptionistUserId = createObjectId();
  const otherDoctorId = createObjectId();

  beforeAll(async () => {
    await setupTestDatabase();
  }, 30000);

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('Doctor user queue query filters by logged-in doctor + unassigned cases', async () => {
    let capturedDoctorId: string | undefined;

    const mockRepo = {
      hasBranchAccess: vi.fn(async () => true),
      doctorByUserId: vi.fn(async (userId: string) => {
        if (userId === doctorUserId) {
          return { _id: doctorId, userId: doctorUserId, displayName: 'Dr. Anderson' };
        }
        return null;
      }),
      list: vi.fn(async (query: unknown, departments?: string[], passedDoctorId?: string) => {
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

    expect(capturedDoctorId).toBe(doctorId);
    expect(result.data.length).toBe(2);
    expect(result.data[0]?.assigned_doctor_id).toBe(doctorId);
    expect(result.data[1]?.assigned_doctor_id).toBeNull();
  });

  it('Non-doctor user (Receptionist/Nurse) queue query does not restrict to any doctor', async () => {
    let capturedDoctorId: string | undefined;

    const mockRepo = {
      hasBranchAccess: vi.fn(async () => true),
      doctorByUserId: vi.fn(async () => null),
      list: vi.fn(async (query: unknown, departments?: string[], passedDoctorId?: string) => {
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

    expect(capturedDoctorId).toBeUndefined();
    expect(result.data.length).toBe(3);
  });
});
