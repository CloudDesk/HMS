import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDatabase, teardownTestDatabase } from './setup.js';
import { AdministrationDashboardRepository } from '../src/modules/administration-dashboard/administration-dashboard.repository.js';
import { AppointmentModel } from '../src/modules/appointments/appointment.model.js';
import { BillingInvoiceModel } from '../src/modules/billing/billing.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import { OpdVisitModel } from '../src/modules/opd/opd-visit.model.js';
import { PatientModel } from '../src/modules/patients/patient.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { UserModel } from '../src/modules/users/user.model.js';

describe('Executive Dashboard Aggregation Suite', () => {
  let repo: AdministrationDashboardRepository;

  const branch1Id = new Types.ObjectId();
  const branch2Id = new Types.ObjectId();
  const superAdminRoleId = new Types.ObjectId();
  const doctorRoleId = new Types.ObjectId();

  const superAdminUserId = new Types.ObjectId();
  const branch1UserId = new Types.ObjectId();

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 0, 0));

  beforeAll(async () => {
    await setupTestDatabase();
    repo = new AdministrationDashboardRepository();

    await Promise.all([
      BranchModel.deleteMany({}),
      RoleModel.deleteMany({}),
      UserModel.deleteMany({}),
      PatientModel.deleteMany({}),
      DoctorModel.deleteMany({}),
      AppointmentModel.deleteMany({}),
      OpdVisitModel.deleteMany({}),
      BillingInvoiceModel.deleteMany({}),
    ]);

    await BranchModel.create([
      { _id: branch1Id, name: 'Main Hospital', code: 'MH', status: 'ACTIVE' },
      { _id: branch2Id, name: 'Branch Clinic', code: 'BC', status: 'ACTIVE' },
    ]);

    await RoleModel.create([
      { _id: superAdminRoleId, code: 'SUPER_ADMIN', name: 'Super Admin', status: 'active', permissions: [] },
      { _id: doctorRoleId, code: 'DOCTOR', name: 'Doctor', status: 'active', permissions: [] },
    ]);

    await UserModel.create([
      { _id: superAdminUserId, username: 'admin', email: 'admin@hms.local', passwordHash: 'hash', fullName: 'Super Admin', status: 'active', roleIds: [superAdminRoleId], branchIds: [branch1Id, branch2Id] },
      { _id: branch1UserId, username: 'b1user', email: 'b1user@hms.local', passwordHash: 'hash', fullName: 'Branch 1 User', status: 'active', roleIds: [doctorRoleId], branchIds: [branch1Id] },
    ]);

    // Seed Patients (2 in Branch 1, 1 in Branch 2, 1 deleted)
    await PatientModel.create([
      { patientNumber: 'P001', firstName: 'John', lastName: 'Doe', dateOfBirth: new Date(1990, 1, 1), gender: 'MALE', registrationBranchId: branch1Id, status: 'ACTIVE' },
      { patientNumber: 'P002', firstName: 'Jane', lastName: 'Smith', dateOfBirth: new Date(1992, 2, 2), gender: 'FEMALE', registrationBranchId: branch1Id, status: 'ACTIVE' },
      { patientNumber: 'P003', firstName: 'Alice', lastName: 'Wong', dateOfBirth: new Date(1985, 3, 3), gender: 'FEMALE', registrationBranchId: branch2Id, status: 'ACTIVE' },
      { patientNumber: 'P004', firstName: 'Deleted', lastName: 'User', dateOfBirth: new Date(1980, 4, 4), gender: 'MALE', registrationBranchId: branch1Id, status: 'ACTIVE', deletedAt: new Date() },
    ]);

    // Seed Doctors (2 active in Branch 1, 1 inactive in Branch 1, 1 active in Branch 2)
    await DoctorModel.create([
      { doctorNumber: 'D001', firstName: 'Gregory', lastName: 'House', displayName: 'Dr. House', specialization: 'Diagnostic', branchId: branch1Id, departmentId: new Types.ObjectId(), status: 'ACTIVE' },
      { doctorNumber: 'D002', firstName: 'James', lastName: 'Wilson', displayName: 'Dr. Wilson', specialization: 'Oncology', branchId: branch1Id, departmentId: new Types.ObjectId(), status: 'ACTIVE' },
      { doctorNumber: 'D003', firstName: 'Inactive', lastName: 'Doctor', displayName: 'Dr. Inactive', specialization: 'General', branchId: branch1Id, departmentId: new Types.ObjectId(), status: 'INACTIVE' },
      { doctorNumber: 'D004', firstName: 'Branch2', lastName: 'Doctor', displayName: 'Dr. B2', specialization: 'General', branchId: branch2Id, departmentId: new Types.ObjectId(), status: 'ACTIVE' },
    ]);

    // Seed Today's Appointments (2 in Branch 1, 1 cancelled, 1 in Branch 2)
    await AppointmentModel.create([
      { appointmentNumber: 'APP001', patientId: new Types.ObjectId(), patientNumber: 'P001', patientName: 'John Doe', doctorId: new Types.ObjectId(), doctorName: 'Dr. House', doctorSpecialization: 'Diagnostic', branchId: branch1Id, departmentId: new Types.ObjectId(), appointmentDate: todayUtc, durationMinutes: 30, visitType: 'NEW_CONSULTATION', priority: 'ROUTINE', status: 'SCHEDULED' },
      { appointmentNumber: 'APP002', patientId: new Types.ObjectId(), patientNumber: 'P002', patientName: 'Jane Smith', doctorId: new Types.ObjectId(), doctorName: 'Dr. Wilson', doctorSpecialization: 'Oncology', branchId: branch1Id, departmentId: new Types.ObjectId(), appointmentDate: todayUtc, durationMinutes: 30, visitType: 'FOLLOW_UP', priority: 'ROUTINE', status: 'CONFIRMED' },
      { appointmentNumber: 'APP003', patientId: new Types.ObjectId(), patientNumber: 'P001', patientName: 'John Doe', doctorId: new Types.ObjectId(), doctorName: 'Dr. House', doctorSpecialization: 'Diagnostic', branchId: branch1Id, departmentId: new Types.ObjectId(), appointmentDate: todayUtc, durationMinutes: 30, visitType: 'NEW_CONSULTATION', priority: 'ROUTINE', status: 'CANCELLED' },
      { appointmentNumber: 'APP004', patientId: new Types.ObjectId(), patientNumber: 'P003', patientName: 'Alice Wong', doctorId: new Types.ObjectId(), doctorName: 'Dr. B2', doctorSpecialization: 'General', branchId: branch2Id, departmentId: new Types.ObjectId(), appointmentDate: todayUtc, durationMinutes: 30, visitType: 'NEW_CONSULTATION', priority: 'ROUTINE', status: 'SCHEDULED' },
    ]);

    // Seed OPD Visits (2 today in Branch 1: 1 checked-in, 1 completed; 1 in Branch 2)
    await OpdVisitModel.create([
      { visitNumber: 'OPD001', patientId: new Types.ObjectId(), patientNumber: 'P001', patientName: 'John Doe', doctorId: new Types.ObjectId(), doctorName: 'Dr. House', doctorSpecialization: 'Diagnostic', branchId: branch1Id, departmentId: new Types.ObjectId(), visitDate: todayUtc, checkInTime: todayUtc, visitType: 'NEW_CONSULTATION', priority: 'ROUTINE', status: 'CHECKED_IN' },
      { visitNumber: 'OPD002', patientId: new Types.ObjectId(), patientNumber: 'P002', patientName: 'Jane Smith', doctorId: new Types.ObjectId(), doctorName: 'Dr. Wilson', doctorSpecialization: 'Oncology', branchId: branch1Id, departmentId: new Types.ObjectId(), visitDate: todayUtc, checkInTime: todayUtc, visitType: 'NEW_CONSULTATION', priority: 'ROUTINE', status: 'COMPLETED' },
      { visitNumber: 'OPD003', patientId: new Types.ObjectId(), patientNumber: 'P003', patientName: 'Alice Wong', doctorId: new Types.ObjectId(), doctorName: 'Dr. B2', doctorSpecialization: 'General', branchId: branch2Id, departmentId: new Types.ObjectId(), visitDate: todayUtc, checkInTime: todayUtc, visitType: 'NEW_CONSULTATION', priority: 'ROUTINE', status: 'CHECKED_IN' },
    ]);

    // Seed Billing Invoices (Today: 1 Paid KES 2000, 1 Draft total KES 5000 paid 1000, 1 Cancelled KES 9999)
    await BillingInvoiceModel.create([
      { invoiceNumber: 'INV001', patientId: new Types.ObjectId(), visitId: new Types.ObjectId(), branchId: branch1Id, invoiceDate: todayUtc, status: 'PAID', subtotal: 2000, discountAmount: 0, taxAmount: 0, totalAmount: 2000, paidAmount: 2000, balanceAmount: 0 },
      { invoiceNumber: 'INV002', patientId: new Types.ObjectId(), visitId: new Types.ObjectId(), branchId: branch1Id, invoiceDate: todayUtc, status: 'PARTIALLY_PAID', subtotal: 5000, discountAmount: 0, taxAmount: 0, totalAmount: 5000, paidAmount: 1000, balanceAmount: 4000 },
      { invoiceNumber: 'INV003', patientId: new Types.ObjectId(), visitId: new Types.ObjectId(), branchId: branch1Id, invoiceDate: todayUtc, status: 'CANCELLED', subtotal: 9999, discountAmount: 0, taxAmount: 0, totalAmount: 9999, paidAmount: 0, balanceAmount: 9999 },
      { invoiceNumber: 'INV004', patientId: new Types.ObjectId(), visitId: new Types.ObjectId(), branchId: branch2Id, invoiceDate: todayUtc, status: 'PAID', subtotal: 3000, discountAmount: 0, taxAmount: 0, totalAmount: 3000, paidAmount: 3000, balanceAmount: 0 },
    ]);
  }, 30000);

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('1 & 11. Correct registered patient count (excluding soft deleted)', async () => {
    const overview = await repo.getExecutiveOverview(superAdminUserId.toString());
    expect(overview.kpis.registeredPatients).toBe(3);
  });

  it('2. Correct active doctor count (excluding inactive)', async () => {
    const overview = await repo.getExecutiveOverview(superAdminUserId.toString());
    expect(overview.kpis.activeDoctors).toBe(3);
  });

  it('3 & 10. Correct today appointment count (excluding cancelled)', async () => {
    const overview = await repo.getExecutiveOverview(superAdminUserId.toString());
    expect(overview.kpis.todayAppointments).toBe(3);
  });

  it('4. Correct today OPD visit count', async () => {
    const overview = await repo.getExecutiveOverview(superAdminUserId.toString());
    expect(overview.kpis.todayOpdVisits).toBe(3);
  });

  it('5 & 10. Correct today billed revenue (excluding cancelled invoices)', async () => {
    const overview = await repo.getExecutiveOverview(superAdminUserId.toString());
    expect(overview.kpis.todayBilledRevenue).toBe(10000); // 2000 + 5000 + 3000
  });

  it('6 & 7. 7-Day Revenue & Encounter Trend has 7 items', async () => {
    const overview = await repo.getExecutiveOverview(superAdminUserId.toString());
    expect(overview.trend.length).toBe(7);
    const todayItem = overview.trend[overview.trend.length - 1];
    expect(todayItem.revenue).toBe(10000);
    expect(todayItem.encounters).toBe(3);
  });

  it('8. Correct collected funds across active invoices', async () => {
    const overview = await repo.getExecutiveOverview(superAdminUserId.toString());
    expect(overview.financialSummary?.collectedFunds).toBe(6000); // 2000 + 1000 + 3000
  });

  it('9. Correct pending outstanding (totalBilled - collectedFunds >= 0)', async () => {
    const overview = await repo.getExecutiveOverview(superAdminUserId.toString());
    expect(overview.financialSummary?.pendingOutstanding).toBe(4000); // 10000 - 6000
  });

  it('12 & 13. Branch filtering restricts metrics to requested branch', async () => {
    const b1Overview = await repo.getExecutiveOverview(superAdminUserId.toString(), branch1Id.toString());
    expect(b1Overview.kpis.registeredPatients).toBe(2);
    expect(b1Overview.kpis.activeDoctors).toBe(2);
    expect(b1Overview.kpis.todayAppointments).toBe(2);
    expect(b1Overview.kpis.todayOpdVisits).toBe(2);
    expect(b1Overview.kpis.todayBilledRevenue).toBe(7000); // 2000 + 5000
  });

  it('14. Financial access restriction hides financialSummary', async () => {
    const overview = await repo.getExecutiveOverview(superAdminUserId.toString(), undefined, false);
    expect(overview.kpis.todayBilledRevenue).toBeNull();
    expect(overview.financialSummary).toBeNull();
  });
});
