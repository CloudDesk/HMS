/**
 * Test: Surgery Recommendation – Receptionist List Visibility
 *
 * Verifies that:
 *   1. RECEPTIONIST departmentScope() returns undefined (branch-wide, not dept-restricted)
 *   2. Receptionist can see all ACTIVE recommendations regardless of department (e.g. Cardiology recs)
 *   3. Old wrong behaviour (Reception-dept filter) would return 0 clinical recommendations
 */

import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { setupTestDatabase, teardownTestDatabase } from "./setup.js";
import { createObjectId } from "./factories.js";
import { SurgeryRepository } from "../src/modules/surgery/surgery.repository.js";
import { SequenceService } from "../src/shared/sequence/sequence.service.js";
import { ProcedureRecommendationModel } from "../src/modules/surgery/surgery.model.js";
import { RoleModel } from "../src/modules/roles/role.model.js";
import { UserModel } from "../src/modules/users/user.model.js";
import { BranchModel } from "../src/modules/branches/branch.model.js";

test("Surgery Recommendation – Receptionist departmentScope is branch-wide", async (t) => {
  await setupTestDatabase();

  const branchId = createObjectId();
  const cardioDeptId = createObjectId();
  const receptionDeptId = createObjectId();
  const serviceId = createObjectId();
  const patientId = createObjectId();
  const doctorId = createObjectId();

  // Seed roles
  const receptionistRole = await RoleModel.create({ code: "RECEPTIONIST", name: "Receptionist", status: "active" });
  const doctorRole = await RoleModel.create({ code: "DOCTOR", name: "Doctor", status: "active" });

  // Seed branch (BranchModel only needs what hasBranchAccess queries)
  await BranchModel.create({ _id: new Types.ObjectId(branchId), name: "Main Branch", status: "ACTIVE", code: "MB" });

  // Receptionist user – in Reception dept
  const receptionistUser = await UserModel.create({
    username: "receptionist_test", fullName: "Test Receptionist", email: "rec@test.com", passwordHash: "x",
    status: "active",
    roleIds: [receptionistRole._id],
    branchIds: [new Types.ObjectId(branchId)],
    departmentIds: [new Types.ObjectId(receptionDeptId)],
  });

  // Doctor user – in Cardiology dept
  const doctorUser = await UserModel.create({
    username: "doctor_test", fullName: "Dr. Test Doctor", email: "doc@test.com", passwordHash: "x",
    status: "active",
    roleIds: [doctorRole._id],
    branchIds: [new Types.ObjectId(branchId)],
    departmentIds: [new Types.ObjectId(cardioDeptId)],
  });

  const repo = new SurgeryRepository(new SequenceService());

  await t.test("Receptionist departmentScope() returns undefined (branch-wide)", async () => {
    const scope = await repo.departmentScope(receptionistUser._id.toString());
    assert.equal(scope, undefined, `Expected undefined but got: ${JSON.stringify(scope)}`);
  });

  await t.test("Doctor departmentScope() returns undefined (branch-wide)", async () => {
    const scope = await repo.departmentScope(doctorUser._id.toString());
    assert.equal(scope, undefined, `Expected undefined but got: ${JSON.stringify(scope)}`);
  });

  await t.test("Receptionist list total equals branch-ACTIVE raw count (2 Cardiology recs)", async () => {
    // Create 2 ACTIVE recommendations in Cardiology (NOT Reception dept)
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
        recommendingDoctorName: "Dr. Anderson", serviceId: new Types.ObjectId(serviceId),
        serviceName: "Angioplasty", clinicalReason: "Follow-up", status: "ACTIVE",
        encounterType: "DIRECT", createdBy: doctorUser._id, updatedBy: doctorUser._id,
      },
    ]);

    const receptionistScope = await repo.departmentScope(receptionistUser._id.toString());
    const result = await repo.listRecommendations({ branch_id: branchId, status: "ACTIVE", page: 1, limit: 50 }, receptionistScope);
    const rawCount = await ProcedureRecommendationModel.countDocuments({ branchId: new Types.ObjectId(branchId), status: "ACTIVE" });

    console.log(`Receptionist sees: ${result.meta.total} | raw ACTIVE in branch: ${rawCount}`);
    assert.equal(result.meta.total, rawCount, `Receptionist total must equal raw count`);
    assert.equal(result.meta.total, 2, "Receptionist must see both Cardiology recommendations");
    console.log("PASS: Receptionist sees all branch-ACTIVE recommendations, no dept filter");
  });

  await t.test("Reception-dept-only filter would miss Cardiology recs (proves old bug)", async () => {
    // Simulate the OLD (wrong) behaviour: scope = [receptionDeptId]
    const receptionScopedResult = await repo.listRecommendations(
      { branch_id: branchId, status: "ACTIVE", page: 1, limit: 50 },
      [receptionDeptId]
    );
    // Old behaviour would return 0 Cardiology recommendations
    assert.equal(receptionScopedResult.meta.total, 0, "Reception-dept filter must return 0 (Cardiology recs not in Reception)");

    // New correct behaviour: Receptionist gets all
    const receptionistScope = await repo.departmentScope(receptionistUser._id.toString());
    const receptionistResult = await repo.listRecommendations(
      { branch_id: branchId, status: "ACTIVE", page: 1, limit: 50 },
      receptionistScope
    );
    assert.equal(receptionistResult.meta.total, 2, "Receptionist must see 2 branch-wide recommendations");
    console.log("PASS: fix prevents Receptionist from being scoped to Reception dept only");
  });

  t.after(async () => {
    await teardownTestDatabase();
  });
});
