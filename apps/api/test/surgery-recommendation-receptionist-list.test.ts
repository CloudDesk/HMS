import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Types } from "mongoose";
import { setupTestDatabase, teardownTestDatabase } from "./setup.js";
import { createObjectId } from "./factories.js";
import { SurgeryRepository } from "../src/modules/surgery/surgery.repository.js";
import { SequenceService } from "../src/shared/sequence/sequence.service.js";
import { ProcedureRecommendationModel } from "../src/modules/surgery/surgery.model.js";
import { RoleModel } from "../src/modules/roles/role.model.js";
import { UserModel } from "../src/modules/users/user.model.js";
import { BranchModel } from "../src/modules/branches/branch.model.js";

describe("Surgery Recommendation - Receptionist departmentScope is branch-wide", () => {
  let repo: SurgeryRepository;
  let receptionistUser: import('../src/modules/users/user.model.js').UserDocument;
  let doctorUser: import('../src/modules/users/user.model.js').UserDocument;

  const branchId = createObjectId();
  const cardioDeptId = createObjectId();
  const receptionDeptId = createObjectId();
  const serviceId = createObjectId();
  const patientId = createObjectId();
  const doctorId = createObjectId();

  beforeAll(async () => {
    await setupTestDatabase();

    const receptionistRole = await RoleModel.create({ code: "RECEPTIONIST", name: "Receptionist", status: "active" });
    const doctorRole = await RoleModel.create({ code: "DOCTOR", name: "Doctor", status: "active" });

    await BranchModel.create({ _id: new Types.ObjectId(branchId), name: "Main Branch", status: "ACTIVE", code: "MB" });

    receptionistUser = await UserModel.create({
      username: "receptionist_test", fullName: "Test Receptionist", email: "rec@test.com", passwordHash: "x",
      status: "active",
      roleIds: [receptionistRole._id],
      branchIds: [new Types.ObjectId(branchId)],
      departmentIds: [new Types.ObjectId(receptionDeptId)],
    });

    doctorUser = await UserModel.create({
      username: "doctor_test", fullName: "Dr. Test Doctor", email: "doc@test.com", passwordHash: "x",
      status: "active",
      roleIds: [doctorRole._id],
      branchIds: [new Types.ObjectId(branchId)],
      departmentIds: [new Types.ObjectId(cardioDeptId)],
    });

    repo = new SurgeryRepository(new SequenceService());
  }, 30000);

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("Receptionist departmentScope() returns undefined (branch-wide)", async () => {
    const scope = await repo.departmentScope(receptionistUser._id.toString());
    expect(scope).toBeUndefined();
  });

  it("Doctor departmentScope() returns undefined (branch-wide)", async () => {
    const scope = await repo.departmentScope(doctorUser._id.toString());
    expect(scope).toBeUndefined();
  });

  it("Receptionist list total equals branch-ACTIVE raw count (2 Cardiology recs)", async () => {
    const serviceId2 = createObjectId();
    await ProcedureRecommendationModel.create([
      {
        recommendationNumber: "PR-TEST-001", patientId: new Types.ObjectId(patientId),
        patientNumber: "P-001", patientName: "Test Patient A",
        branchId: new Types.ObjectId(branchId), departmentId: new Types.ObjectId(cardioDeptId),
        departmentName: "Cardiology", recommendingDoctorId: new Types.ObjectId(doctorId),
        recommendingDoctorName: "Dr. Anderson", serviceId: new Types.ObjectId(serviceId),
        serviceName: "Angioplasty", clinicalReason: "Cardiac issue", status: "ACTIVE",
        encounterType: "DIRECT", createdBy: doctorUser._id, updatedBy: doctorUser._id,
      },
      {
        recommendationNumber: "PR-TEST-002", patientId: new Types.ObjectId(patientId),
        patientNumber: "P-001", patientName: "Test Patient A",
        branchId: new Types.ObjectId(branchId), departmentId: new Types.ObjectId(cardioDeptId),
        departmentName: "Cardiology", recommendingDoctorId: new Types.ObjectId(doctorId),
        recommendingDoctorName: "Dr. Anderson", serviceId: new Types.ObjectId(serviceId2),
        serviceName: "Echocardiogram", clinicalReason: "Follow-up", status: "ACTIVE",
        encounterType: "DIRECT", createdBy: doctorUser._id, updatedBy: doctorUser._id,
      },
    ]);

    const receptionistScope = await repo.departmentScope(receptionistUser._id.toString());
    const result = await repo.listRecommendations({ branch_id: branchId, status: "ACTIVE", page: 1, limit: 50 }, receptionistScope);
    const rawCount = await ProcedureRecommendationModel.countDocuments({ branchId: new Types.ObjectId(branchId), status: "ACTIVE" });

    expect(result.meta.total).toBe(rawCount);
    expect(result.meta.total).toBe(2);
  });

  it("Reception-dept-only filter would miss Cardiology recs (proves old bug)", async () => {
    const receptionScopedResult = await repo.listRecommendations(
      { branch_id: branchId, status: "ACTIVE", page: 1, limit: 50 },
      [receptionDeptId]
    );
    expect(receptionScopedResult.meta.total).toBe(0);

    const receptionistScope = await repo.departmentScope(receptionistUser._id.toString());
    const receptionistResult = await repo.listRecommendations(
      { branch_id: branchId, status: "ACTIVE", page: 1, limit: 50 },
      receptionistScope
    );
    expect(receptionistResult.meta.total).toBe(2);
  });
});
