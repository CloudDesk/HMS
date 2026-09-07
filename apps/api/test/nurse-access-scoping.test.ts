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

import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
import type { DoctorService } from "../src/modules/doctors/doctor.service.js";
import type { PatientService } from "../src/modules/patients/patient.service.js";
import type { BillingService } from "../src/modules/billing/billing.service.js";
import type { AdmissionsConfigurationService } from "../src/modules/admissions-configuration/admissions-configuration.service.js";
import type { PharmacyDispensingService } from "../src/modules/pharmacy-dispensing/pharmacy-dispensing.service.js";
import type { LaboratoryService } from "../src/modules/laboratory/laboratory.service.js";
import type { ImagingService } from "../src/modules/imaging/imaging.service.js";
import type { OpdVisitService } from "../src/modules/opd/opd-visit.service.js";
import type { AppError } from "../src/shared/errors/app-error.js";

type PopulatedPermission = { module: string; screen: string; action: string };

describe("Nurse Role Access & Inpatient Scoping Tests", () => {
  const mbBranchId = createObjectId();
  const sbBranchId = createObjectId();
  const dentalDeptId = createObjectId();
  const cardioDeptId = createObjectId();
  const receptionDeptId = createObjectId();
  const nursingDeptId = createObjectId();
  const pharmacyDeptId = createObjectId();
  const labDeptId = createObjectId();
  const imagingDeptId = createObjectId();
  const billingDeptId = createObjectId();
  const patient1Id = createObjectId();
  const patient2Id = createObjectId();
  const generalNurseUserId = createObjectId();
  const cardioNurseUserId = createObjectId();
  const dentalNurseUserId = createObjectId();
  const doctorAUserId = createObjectId();
  const doctorADocId = createObjectId();
  const doctorBUserId = createObjectId();
  const doctorBDocId = createObjectId();
  const receptionistUserId = createObjectId();

  let service: InpatientAdmissionService;
  let nurseRoleId: Types.ObjectId;

  beforeAll(async () => {
    await setupTestDatabase();

    await BranchModel.create([
      { _id: new Types.ObjectId(mbBranchId), name: "Main Branch", status: "ACTIVE", code: "MB01" },
      { _id: new Types.ObjectId(sbBranchId), name: "Secondary Branch", status: "ACTIVE", code: "SB01" },
    ]);

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
    if (!nurseRole) throw new Error("CLINICIAN_NURSE role must exist");
    nurseRoleId = nurseRole._id;

    const doctorRole = await RoleModel.findOne({ code: "DOCTOR" }).lean();
    if (!doctorRole) throw new Error("DOCTOR role must exist");

    const receptionistRole = await RoleModel.findOne({ code: "RECEPTIONIST" }).lean();
    if (!receptionistRole) throw new Error("RECEPTIONIST role must exist");

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
    service = new InpatientAdmissionService(
      repo,
      {} as unknown as DoctorService,
      {} as unknown as PatientService,
      {} as unknown as BillingService,
      {} as unknown as AdmissionsConfigurationService,
      {} as unknown as PharmacyDispensingService,
      {} as unknown as LaboratoryService,
      {} as unknown as ImagingService,
      {} as unknown as OpdVisitService,
    );
  }, 30000);

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("1. CLINICIAN_NURSE does NOT have Admission Requests View permission", async () => {
    const nurseRoleWithPerms = await RoleModel.findById(nurseRoleId).populate("permissionIds").lean();
    const perms = (nurseRoleWithPerms?.permissionIds as unknown as PopulatedPermission[]) || [];
    const hasAdmissionRequestsView = perms.some((p) => p.module === "Admissions" && p.screen === "Admission Requests" && p.action === "View");
    const hasBedsView = perms.some((p) => p.module === "Admissions" && p.screen === "Beds" && p.action === "View");
    const hasInpatientsView = perms.some((p) => p.module === "Admissions" && p.screen === "Inpatient Admissions" && p.action === "View");

    expect(hasAdmissionRequestsView).toBe(false);
    expect(hasBedsView).toBe(true);
    expect(hasInpatientsView).toBe(true);
  });

  it("2. General Nurse (Nursing department) sees all admitted patients in branch wards", async () => {
    const list = await service.list({ branch_id: mbBranchId, status: "ADMITTED" }, generalNurseUserId);
    expect(list.meta.total).toBe(2);
  });

  it("3. Cardiology Nurse sees only Cardiology patients and cannot see Dental patients", async () => {
    const list = await service.list({ branch_id: mbBranchId, status: "ADMITTED" }, cardioNurseUserId);
    expect(list.meta.total).toBe(1);
    expect(list.data[0].department_id).toBe(cardioDeptId);
    expect(list.data[0].patient_name).toBe("Patient One");
  });

  it("4. Dental Nurse sees only Dental patients and cannot see Cardiology patients", async () => {
    const list = await service.list({ branch_id: mbBranchId, status: "ADMITTED" }, dentalNurseUserId);
    expect(list.meta.total).toBe(1);
    expect(list.data[0].department_id).toBe(dentalDeptId);
    expect(list.data[0].patient_name).toBe("Patient Two");
  });

  it("5. Doctor scoping remains doctor-assigned", async () => {
    const doctorAList = await service.list({ branch_id: mbBranchId, status: "ADMITTED" }, doctorAUserId);
    expect(doctorAList.meta.total).toBe(1);
    expect(doctorAList.data[0].admitting_doctor_id).toBe(doctorADocId);

    const doctorBList = await service.list({ branch_id: mbBranchId, status: "ADMITTED" }, doctorBUserId);
    expect(doctorBList.meta.total).toBe(1);
    expect(doctorBList.data[0].admitting_doctor_id).toBe(doctorBDocId);
  });

  it("6. Receptionist sees all branch admissions", async () => {
    const recList = await service.list({ branch_id: mbBranchId, status: "ADMITTED" }, receptionistUserId);
    expect(recList.meta.total).toBe(2);
  });

  it("7. Nurse is restricted to authorized branch (branch isolation)", async () => {
    await expect(
      service.list({ branch_id: sbBranchId, status: "ADMITTED" }, generalNurseUserId),
    ).rejects.toSatisfy((err: unknown) => {
      const appErr = err as AppError;
      return appErr.code === "BRANCH_ACCESS_DENIED";
    });
  });
});
