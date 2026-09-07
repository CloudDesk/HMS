/**
 * Test: Nurse Role Access & Inpatient Scoping
 *
 * Verifies:
 *   1. CLINICIAN_NURSE role does NOT have Admissions.Admission Requests.View permission.
 *   2. CLINICIAN_NURSE role retains Admissions.Beds.View and Admissions.Inpatient Admissions.View.
 *   3. General Nurse (Nursing department) sees all active admitted inpatients across branch wards.
 *   4. Department-scoped Nurse (Cardiology) sees only Cardiology inpatients and cannot see Dental patients.
 *   5. Department-scoped Nurse (Dental) sees only Dental inpatients and cannot see Cardiology patients.
 *   6. Doctor scoping remains assigned-doctor scoped.
 *   7. Receptionist admission access remains branch-wide.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { setupTestDatabase, teardownTestDatabase } from "./setup.js";
import { createObjectId } from "./factories.js";
import { InpatientAdmissionRepository } from "../src/modules/inpatient-admissions/inpatient-admission.repository.js";
import { InpatientAdmissionService } from "../src/modules/inpatient-admissions/inpatient-admission.service.js";
import { SequenceService } from "../src/shared/sequence/sequence.service.js";
import { InpatientAdmissionModel } from "../src/modules/inpatient-admissions/inpatient-admission.model.js";
import { RoleModel } from "../src/modules/roles/role.model.js";
import { UserModel } from "../src/modules/users/user.model.js";
import { BranchModel } from "../src/modules/branches/branch.model.js";
import { DepartmentModel } from "../src/modules/departments/department.model.js";
import { DoctorModel } from "../src/modules/doctors/doctor.model.js";
import { PatientModel } from "../src/modules/patients/patient.model.js";
import { seedDatabase } from "../src/database/seed.js";

test("Nurse Role Access & Inpatient Scoping Tests", async (t) => {
  await setupTestDatabase();

  const mbBranchId = createObjectId();
  const sbBranchId = createObjectId();

  await BranchModel.create([
    { _id: new Types.ObjectId(mbBranchId), name: "Main Branch", status: "ACTIVE", code: "MB01" },
    { _id: new Types.ObjectId(sbBranchId), name: "Secondary Branch", status: "ACTIVE", code: "SB01" },
  ]);

  const dentalDeptId = createObjectId();
  const cardioDeptId = createObjectId();
  const receptionDeptId = createObjectId();
  const nursingDeptId = createObjectId();
  const pharmacyDeptId = createObjectId();
  const labDeptId = createObjectId();
  const imagingDeptId = createObjectId();
  const billingDeptId = createObjectId();

  await DepartmentModel.create([
    { _id: new Types.ObjectId(dentalDeptId), name: "Dental Department", code: "DENT", branchIds: [new Types.ObjectId(mbBranchId)], status: "ACTIVE" },
    { _id: new Types.ObjectId(cardioDeptId), name: "Cardiology Department", code: "CARD", branchIds: [new Types.ObjectId(mbBranchId)], status: "ACTIVE" },
    { _id: new Types.ObjectId(receptionDeptId), name: "Reception Department", code: "RECP", branchIds: [new Types.ObjectId(mbBranchId), new Types.ObjectId(sbBranchId)], status: "ACTIVE" },
    { _id: new Types.ObjectId(nursingDeptId), name: "Nursing Department", code: "NURS", branchIds: [new Types.ObjectId(mbBranchId), new Types.ObjectId(sbBranchId)], status: "ACTIVE" },
    { _id: new Types.ObjectId(pharmacyDeptId), name: "Pharmacy Department", code: "PHAR", branchIds: [new Types.ObjectId(mbBranchId), new Types.ObjectId(sbBranchId)], status: "ACTIVE" },
    { _id: new Types.ObjectId(labDeptId), name: "Laboratory Department", code: "LAB", branchIds: [new Types.ObjectId(mbBranchId), new Types.ObjectId(sbBranchId)], status: "ACTIVE" },
    { _id: new Types.ObjectId(imagingDeptId), name: "Imaging Radiology Department", code: "RAD", branchIds: [new Types.ObjectId(mbBranchId), new Types.ObjectId(sbBranchId)], status: "ACTIVE" },
    { _id: new Types.ObjectId(billingDeptId), name: "Billing Finance Department", code: "BILL", branchIds: [new Types.ObjectId(mbBranchId), new Types.ObjectId(sbBranchId)], status: "ACTIVE" },
  ]);

  await seedDatabase();

  const nurseRole = await RoleModel.findOne({ code: "CLINICIAN_NURSE" }).lean();
  assert.ok(nurseRole, "CLINICIAN_NURSE role must exist");
  const doctorRole = await RoleModel.findOne({ code: "DOCTOR" }).lean();
  assert.ok(doctorRole, "DOCTOR role must exist");
  const receptionistRole = await RoleModel.findOne({ code: "RECEPTIONIST" }).lean();
  assert.ok(receptionistRole, "RECEPTIONIST role must exist");

  const patient1Id = createObjectId();
  const patient2Id = createObjectId();

  await PatientModel.create([
    {
      _id: new Types.ObjectId(patient1Id),
      patientNumber: "P-001",
      firstName: "Patient",
      lastName: "One",
      gender: "MALE",
      dateOfBirth: new Date("1985-01-01"),
      branchId: new Types.ObjectId(mbBranchId),
      status: "ACTIVE",
    },
    {
      _id: new Types.ObjectId(patient2Id),
      patientNumber: "P-002",
      firstName: "Patient",
      lastName: "Two",
      gender: "FEMALE",
      dateOfBirth: new Date("1990-02-02"),
      branchId: new Types.ObjectId(mbBranchId),
      status: "ACTIVE",
    },
  ]);

  // Create General Nurse (Mensha - Nursing Dept)
  const generalNurseUserId = createObjectId();
  await UserModel.create({
    _id: new Types.ObjectId(generalNurseUserId),
    username: "mensha_nurse",
    fullName: "Nurse Mensha",
    email: "mensha@test.com",
    passwordHash: "dummy",
    status: "active",
    roleIds: [nurseRole._id],
    branchIds: [new Types.ObjectId(mbBranchId)],
    departmentIds: [new Types.ObjectId(nursingDeptId)],
  });

  // Create Cardiology Nurse (Cardio Dept)
  const cardioNurseUserId = createObjectId();
  await UserModel.create({
    _id: new Types.ObjectId(cardioNurseUserId),
    username: "cardio_nurse",
    fullName: "Cardiology Nurse",
    email: "cardionurse@test.com",
    passwordHash: "dummy",
    status: "active",
    roleIds: [nurseRole._id],
    branchIds: [new Types.ObjectId(mbBranchId)],
    departmentIds: [new Types.ObjectId(cardioDeptId)],
  });

  // Create Dental Nurse (Dental Dept)
  const dentalNurseUserId = createObjectId();
  await UserModel.create({
    _id: new Types.ObjectId(dentalNurseUserId),
    username: "dental_nurse",
    fullName: "Dental Nurse",
    email: "dentalnurse@test.com",
    passwordHash: "dummy",
    status: "active",
    roleIds: [nurseRole._id],
    branchIds: [new Types.ObjectId(mbBranchId)],
    departmentIds: [new Types.ObjectId(dentalDeptId)],
  });

  // Create Doctor A (Cardiology)
  const doctorAUserId = createObjectId();
  const doctorADocId = createObjectId();
  await UserModel.create({
    _id: new Types.ObjectId(doctorAUserId),
    username: "doc_cardio",
    fullName: "Dr. Cardio",
    email: "cardiodoc@test.com",
    passwordHash: "dummy",
    status: "active",
    roleIds: [doctorRole._id],
    branchIds: [new Types.ObjectId(mbBranchId)],
    departmentIds: [new Types.ObjectId(cardioDeptId)],
  });
  await DoctorModel.create({
    _id: new Types.ObjectId(doctorADocId),
    userId: new Types.ObjectId(doctorAUserId),
    doctorNumber: "DOC-CARD",
    firstName: "Doctor",
    lastName: "Cardio",
    displayName: "Dr. Cardio",
    specialization: "Cardiology",
    branchId: new Types.ObjectId(mbBranchId),
    departmentId: new Types.ObjectId(cardioDeptId),
    status: "ACTIVE",
    availability: [],
  });

  // Create Doctor B (Dental)
  const doctorBUserId = createObjectId();
  const doctorBDocId = createObjectId();
  await UserModel.create({
    _id: new Types.ObjectId(doctorBUserId),
    username: "doc_dental",
    fullName: "Dr. Dental",
    email: "dentaldoc@test.com",
    passwordHash: "dummy",
    status: "active",
    roleIds: [doctorRole._id],
    branchIds: [new Types.ObjectId(mbBranchId)],
    departmentIds: [new Types.ObjectId(dentalDeptId)],
  });
  await DoctorModel.create({
    _id: new Types.ObjectId(doctorBDocId),
    userId: new Types.ObjectId(doctorBUserId),
    doctorNumber: "DOC-DENT",
    firstName: "Doctor",
    lastName: "Dental",
    displayName: "Dr. Dental",
    specialization: "Dentistry",
    branchId: new Types.ObjectId(mbBranchId),
    departmentId: new Types.ObjectId(dentalDeptId),
    status: "ACTIVE",
    availability: [],
  });

  // Create Receptionist
  const receptionistUserId = createObjectId();
  await UserModel.create({
    _id: new Types.ObjectId(receptionistUserId),
    username: "receptionist_test",
    fullName: "Receptionist",
    email: "rec@test.com",
    passwordHash: "dummy",
    status: "active",
    roleIds: [receptionistRole._id],
    branchIds: [new Types.ObjectId(mbBranchId)],
    departmentIds: [new Types.ObjectId(receptionDeptId)],
  });

  const ward1Id = createObjectId();
  const ward2Id = createObjectId();
  const bed1Id = createObjectId();
  const bed2Id = createObjectId();

  // Create 2 admissions: Patient 1 in Cardiology, Patient 2 in Dental
  await InpatientAdmissionModel.create([
    {
      admissionNumber: "ADM-CARD-001",
      patientId: new Types.ObjectId(patient1Id),
      patientNumber: "P-001",
      patientName: "Patient One",
      branchId: new Types.ObjectId(mbBranchId),
      wardId: new Types.ObjectId(ward1Id),
      bedId: new Types.ObjectId(bed1Id),
      admittingDoctorId: new Types.ObjectId(doctorADocId),
      admittingDoctorName: "Dr. Cardio",
      departmentId: new Types.ObjectId(cardioDeptId),
      departmentName: "Cardiology",
      admissionDate: new Date(),
      admissionType: "INPATIENT",
      reason: "Cardiology Treatment",
      status: "ADMITTED",
      sourceType: "DIRECT",
      createdBy: new Types.ObjectId(doctorAUserId),
      updatedBy: new Types.ObjectId(doctorAUserId),
    },
    {
      admissionNumber: "ADM-DENT-001",
      patientId: new Types.ObjectId(patient2Id),
      patientNumber: "P-002",
      patientName: "Patient Two",
      branchId: new Types.ObjectId(mbBranchId),
      wardId: new Types.ObjectId(ward2Id),
      bedId: new Types.ObjectId(bed2Id),
      admittingDoctorId: new Types.ObjectId(doctorBDocId),
      admittingDoctorName: "Dr. Dental",
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: "Dental",
      admissionDate: new Date(),
      admissionType: "INPATIENT",
      reason: "Dental Surgery Inpatient",
      status: "ADMITTED",
      sourceType: "DIRECT",
      createdBy: new Types.ObjectId(doctorBUserId),
      updatedBy: new Types.ObjectId(doctorBUserId),
    },
  ]);

  const repo = new InpatientAdmissionRepository(new SequenceService());
  const service = new InpatientAdmissionService(
    repo,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );

  await t.test("1. CLINICIAN_NURSE does NOT have Admission Requests View permission", async () => {
    const nurseRoleWithPerms = await RoleModel.findById(nurseRole._id).populate("permissionIds").lean();
    const perms = (nurseRoleWithPerms?.permissionIds as any[]) || [];
    const hasAdmissionRequestsView = perms.some((p) => p.module === "Admissions" && p.screen === "Admission Requests" && p.action === "View");
    const hasBedsView = perms.some((p) => p.module === "Admissions" && p.screen === "Beds" && p.action === "View");
    const hasInpatientsView = perms.some((p) => p.module === "Admissions" && p.screen === "Inpatient Admissions" && p.action === "View");

    assert.equal(hasAdmissionRequestsView, false, "CLINICIAN_NURSE must NOT have Admission Requests View permission");
    assert.equal(hasBedsView, true, "CLINICIAN_NURSE must retain Bed Management View permission");
    assert.equal(hasInpatientsView, true, "CLINICIAN_NURSE must retain Inpatient Admissions View permission");
  });

  await t.test("2. General Nurse (Nursing department) sees all admitted patients in branch wards", async () => {
    const list = await service.list({ branch_id: mbBranchId, status: "ADMITTED" }, generalNurseUserId);
    assert.equal(list.meta.total, 2, "General nurse in Nursing department should see both branch inpatients");
  });

  await t.test("3. Cardiology Nurse sees only Cardiology patients and cannot see Dental patients", async () => {
    const list = await service.list({ branch_id: mbBranchId, status: "ADMITTED" }, cardioNurseUserId);
    assert.equal(list.meta.total, 1, "Cardiology nurse should see exactly 1 patient");
    assert.equal(list.data[0].department_id, cardioDeptId, "Cardiology nurse sees Cardiology patient");
    assert.equal(list.data[0].patient_name, "Patient One");
  });

  await t.test("4. Dental Nurse sees only Dental patients and cannot see Cardiology patients", async () => {
    const list = await service.list({ branch_id: mbBranchId, status: "ADMITTED" }, dentalNurseUserId);
    assert.equal(list.meta.total, 1, "Dental nurse should see exactly 1 patient");
    assert.equal(list.data[0].department_id, dentalDeptId, "Dental nurse sees Dental patient");
    assert.equal(list.data[0].patient_name, "Patient Two");
  });

  await t.test("5. Doctor scoping remains doctor-assigned", async () => {
    const doctorAList = await service.list({ branch_id: mbBranchId, status: "ADMITTED" }, doctorAUserId);
    assert.equal(doctorAList.meta.total, 1);
    assert.equal(doctorAList.data[0].admitting_doctor_id, doctorADocId);

    const doctorBList = await service.list({ branch_id: mbBranchId, status: "ADMITTED" }, doctorBUserId);
    assert.equal(doctorBList.meta.total, 1);
    assert.equal(doctorBList.data[0].admitting_doctor_id, doctorBDocId);
  });

  await t.test("6. Receptionist sees all branch admissions", async () => {
    const recList = await service.list({ branch_id: mbBranchId, status: "ADMITTED" }, receptionistUserId);
    assert.equal(recList.meta.total, 2);
  });

  await t.test("7. Nurse is restricted to authorized branch (branch isolation)", async () => {
    await assert.rejects(
      async () => {
        await service.list({ branch_id: sbBranchId, status: "ADMITTED" }, generalNurseUserId);
      },
      (err: any) => {
        assert.equal(err.code, "BRANCH_ACCESS_DENIED");
        return true;
      }
    );
  });

  t.after(async () => {
    await teardownTestDatabase();
  });
});
