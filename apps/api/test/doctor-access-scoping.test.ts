/**
 * Test: Doctor Role Access & Scoping
 *
 * Verifies:
 *   1. DOCTOR role seed does not contain Admissions.Beds.View.
 *   2. Doctor A can create a surgery recommendation for another clinical department (cross-department creation).
 *   3. Doctor A cannot see Doctor B's surgery recommendations.
 *   4. Receptionist sees all recommendations in the branch.
 *   5. Inpatient Workspace: Doctor A sees only Doctor A's admitted patients.
 *   6. Receptionist sees all inpatient admissions in the branch.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { setupTestDatabase, teardownTestDatabase } from "./setup.js";
import { createObjectId } from "./factories.js";
import { SurgeryRepository } from "../src/modules/surgery/surgery.repository.js";
import { SurgeryService } from "../src/modules/surgery/surgery.service.js";
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
import { ServiceModel } from "../src/modules/services/service.model.js";
import { seedDatabase } from "../src/database/seed.js";

test("Doctor Role Access & Scoping Tests", async (t) => {
  await setupTestDatabase();

  const mbBranchId = createObjectId();
  const sbBranchId = createObjectId();

  // Create required seed branches first
  await BranchModel.create([
    { _id: new Types.ObjectId(mbBranchId), name: "Main Branch", status: "ACTIVE", code: "MB01" },
    { _id: new Types.ObjectId(sbBranchId), name: "Secondary Branch", status: "ACTIVE", code: "SB01" },
  ]);

  // Create required seed departments
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

  // Now seedDatabase
  await seedDatabase();

  const doctorRole = await RoleModel.findOne({ code: "DOCTOR" }).lean();
  assert.ok(doctorRole, "DOCTOR role must exist");
  const receptionistRole = await RoleModel.findOne({ code: "RECEPTIONIST" }).lean();
  assert.ok(receptionistRole, "RECEPTIONIST role must exist");

  const patientId = createObjectId();
  const patient2Id = createObjectId();
  const cardioServiceId = createObjectId();

  // Create Patients
  await PatientModel.create([
    {
      _id: new Types.ObjectId(patientId),
      patientNumber: "P-001",
      firstName: "John",
      lastName: "Doe",
      gender: "MALE",
      dateOfBirth: new Date("1990-01-01"),
      branchId: new Types.ObjectId(mbBranchId),
      status: "ACTIVE",
    },
    {
      _id: new Types.ObjectId(patient2Id),
      patientNumber: "P-002",
      firstName: "Jane",
      lastName: "Smith",
      gender: "FEMALE",
      dateOfBirth: new Date("1992-02-02"),
      branchId: new Types.ObjectId(mbBranchId),
      status: "ACTIVE",
    },
  ]);

  // Create Procedure Service in Cardiology
  await ServiceModel.create({
    _id: new Types.ObjectId(cardioServiceId),
    name: "Angioplasty",
    code: "CARD-001",
    departmentId: new Types.ObjectId(cardioDeptId),
    serviceType: "PROCEDURE",
    status: "ACTIVE",
    standardPrice: 1000,
    defaultDurationMinutes: 60,
    bookingCapacity: 5,
  });

  // Create Doctor A (Dental)
  const doctorAUserId = createObjectId();
  const doctorADocId = createObjectId();
  await UserModel.create({
    _id: new Types.ObjectId(doctorAUserId),
    username: "doctor_a",
    fullName: "Dr. Doctor A",
    email: "docA@test.com",
    passwordHash: "dummy",
    status: "active",
    roleIds: [doctorRole._id],
    branchIds: [new Types.ObjectId(mbBranchId)],
    departmentIds: [new Types.ObjectId(dentalDeptId)],
  });
  await DoctorModel.create({
    _id: new Types.ObjectId(doctorADocId),
    userId: new Types.ObjectId(doctorAUserId),
    doctorNumber: "DOC-A",
    firstName: "Doctor",
    lastName: "A",
    displayName: "Dr. Doctor A",
    specialization: "Dentistry",
    branchId: new Types.ObjectId(mbBranchId),
    departmentId: new Types.ObjectId(dentalDeptId),
    status: "ACTIVE",
    availability: [],
  });

  // Create Doctor B (Cardiology)
  const doctorBUserId = createObjectId();
  const doctorBDocId = createObjectId();
  await UserModel.create({
    _id: new Types.ObjectId(doctorBUserId),
    username: "doctor_b",
    fullName: "Dr. Doctor B",
    email: "docB@test.com",
    passwordHash: "dummy",
    status: "active",
    roleIds: [doctorRole._id],
    branchIds: [new Types.ObjectId(mbBranchId)],
    departmentIds: [new Types.ObjectId(cardioDeptId)],
  });
  await DoctorModel.create({
    _id: new Types.ObjectId(doctorBDocId),
    userId: new Types.ObjectId(doctorBUserId),
    doctorNumber: "DOC-B",
    firstName: "Doctor",
    lastName: "B",
    displayName: "Dr. Doctor B",
    specialization: "Cardiology",
    branchId: new Types.ObjectId(mbBranchId),
    departmentId: new Types.ObjectId(cardioDeptId),
    status: "ACTIVE",
    availability: [],
  });

  // Create Receptionist
  const receptionistUserId = createObjectId();
  await UserModel.create({
    _id: new Types.ObjectId(receptionistUserId),
    username: "receptionist_user",
    fullName: "Receptionist User",
    email: "rec@test.com",
    passwordHash: "dummy",
    status: "active",
    roleIds: [receptionistRole._id],
    branchIds: [new Types.ObjectId(mbBranchId)],
    departmentIds: [new Types.ObjectId(receptionDeptId)],
  });

  const surgeryRepo = new SurgeryRepository(new SequenceService());
  const surgeryService = new SurgeryService(
    surgeryRepo,
    { getById: async () => null, list: async () => ({ data: [] }), hasActiveLeave: async () => false, getExceptionByDate: async () => null } as any,
    { addProcedureTimeline: async () => {}, verifyContextConsent: async () => null, addDownstreamTimeline: async () => {} } as any,
    { createProcedureBookingInvoice: async () => null, verifyProcedureDeposit: async () => ({ satisfied: true }) } as any,
    { releaseHoldSafe: async () => {} } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );

  const inpatientRepo = new InpatientAdmissionRepository(new SequenceService());
  const inpatientService = new InpatientAdmissionService(
    inpatientRepo,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );

  await t.test("1. DOCTOR role seed does not contain Admissions.Beds.View", async () => {
    const doctorRoleWithPerms = await RoleModel.findById(doctorRole._id).populate("permissionIds").lean();
    const perms = (doctorRoleWithPerms?.permissionIds as any[]) || [];
    const hasBedsView = perms.some((p) => p.module === "Admissions" && p.screen === "Beds" && p.action === "View");
    const hasWardsView = perms.some((p) => p.module === "Admissions" && p.screen === "Wards" && p.action === "View");
    assert.equal(hasBedsView, false, "DOCTOR must NOT have Admissions.Beds.View permission");
    assert.equal(hasWardsView, true, "DOCTOR must retain Admissions.Wards.View permission");
  });

  await t.test("2. Doctor A can create surgery recommendation in Cardiology (cross-department)", async () => {
    const rec = await surgeryService.createRecommendation(
      {
        patient_id: patientId,
        branch_id: mbBranchId,
        department_id: cardioDeptId,
        service_id: cardioServiceId,
        clinical_reason: "Cross-department surgery test",
      },
      doctorAUserId,
      { ipAddress: "127.0.0.1", userAgent: "test" }
    );
    assert.ok(rec);
    assert.equal(rec.recommending_doctor_id, doctorADocId);
    assert.equal(rec.department_id, cardioDeptId);
  });

  await t.test("3. Doctor B creates surgery recommendation in Cardiology", async () => {
    const recB = await surgeryService.createRecommendation(
      {
        patient_id: patient2Id,
        branch_id: mbBranchId,
        department_id: cardioDeptId,
        service_id: cardioServiceId,
        clinical_reason: "Doctor B recommendation",
      },
      doctorBUserId,
      { ipAddress: "127.0.0.1", userAgent: "test" }
    );
    assert.ok(recB);
    assert.equal(recB.recommending_doctor_id, doctorBDocId);
  });

  await t.test("4. Doctor A sees only Doctor A's recommendations; Doctor B sees only Doctor B's", async () => {
    const listForDoctorA = await surgeryService.listRecommendations({ branch_id: mbBranchId, status: "ACTIVE" }, doctorAUserId);
    assert.equal(listForDoctorA.meta.total, 1, "Doctor A should only see 1 recommendation (their own)");
    assert.equal(listForDoctorA.data[0].recommending_doctor_id, doctorADocId);

    const listForDoctorB = await surgeryService.listRecommendations({ branch_id: mbBranchId, status: "ACTIVE" }, doctorBUserId);
    assert.equal(listForDoctorB.meta.total, 1, "Doctor B should only see 1 recommendation (their own)");
    assert.equal(listForDoctorB.data[0].recommending_doctor_id, doctorBDocId);
  });

  await t.test("5. Receptionist sees all recommendations across all doctors", async () => {
    const listForReceptionist = await surgeryService.listRecommendations({ branch_id: mbBranchId, status: "ACTIVE" }, receptionistUserId);
    assert.equal(listForReceptionist.meta.total, 2, "Receptionist must see both recommendations in the branch");
  });

  await t.test("6. Inpatient Workspace: Doctor A sees only Doctor A's admitted patients", async () => {
    const wardId = createObjectId();
    const bed1Id = createObjectId();
    const bed2Id = createObjectId();

    await InpatientAdmissionModel.create([
      {
        admissionNumber: "ADM-DOC-A",
        patientId: new Types.ObjectId(patientId),
        patientNumber: "P-001",
        patientName: "John Doe",
        branchId: new Types.ObjectId(mbBranchId),
        wardId: new Types.ObjectId(wardId),
        bedId: new Types.ObjectId(bed1Id),
        admittingDoctorId: new Types.ObjectId(doctorADocId),
        admittingDoctorName: "Dr. Doctor A",
        departmentId: new Types.ObjectId(dentalDeptId),
        departmentName: "Dental",
        admissionDate: new Date(),
        admissionType: "INPATIENT",
        reason: "Observation Doctor A",
        status: "ADMITTED",
        sourceType: "DIRECT",
        createdBy: new Types.ObjectId(doctorAUserId),
        updatedBy: new Types.ObjectId(doctorAUserId),
      },
      {
        admissionNumber: "ADM-DOC-B",
        patientId: new Types.ObjectId(patient2Id),
        patientNumber: "P-002",
        patientName: "Jane Smith",
        branchId: new Types.ObjectId(mbBranchId),
        wardId: new Types.ObjectId(wardId),
        bedId: new Types.ObjectId(bed2Id),
        admittingDoctorId: new Types.ObjectId(doctorBDocId),
        admittingDoctorName: "Dr. Doctor B",
        departmentId: new Types.ObjectId(cardioDeptId),
        departmentName: "Cardiology",
        admissionDate: new Date(),
        admissionType: "INPATIENT",
        reason: "Observation Doctor B",
        status: "ADMITTED",
        sourceType: "DIRECT",
        createdBy: new Types.ObjectId(doctorBUserId),
        updatedBy: new Types.ObjectId(doctorBUserId),
      },
    ]);

    const doctorAList = await inpatientService.list({ branch_id: mbBranchId, status: "ADMITTED" }, doctorAUserId);
    assert.equal(doctorAList.meta.total, 1, "Doctor A should only see their own admitted patient");
    assert.equal(doctorAList.data[0].admitting_doctor_id, doctorADocId);

    const doctorBList = await inpatientService.list({ branch_id: mbBranchId, status: "ADMITTED" }, doctorBUserId);
    assert.equal(doctorBList.meta.total, 1, "Doctor B should only see their own admitted patient");
    assert.equal(doctorBList.data[0].admitting_doctor_id, doctorBDocId);

    const receptionistList = await inpatientService.list({ branch_id: mbBranchId, status: "ADMITTED" }, receptionistUserId);
    assert.equal(receptionistList.meta.total, 2, "Receptionist should see all 2 admissions in the branch");
  });

  t.after(async () => {
    await teardownTestDatabase();
  });
});
