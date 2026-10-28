import { Types } from 'mongoose';
import { closeDatabase, connectDatabase } from './client.js';
import { BranchModel } from '../modules/branches/branch.model.js';
import { DepartmentModel } from '../modules/departments/department.model.js';
import { DoctorModel } from '../modules/doctors/doctor.model.js';
import { PatientModel } from '../modules/patients/patient.model.js';
import { PatientAccessGrantModel } from '../modules/patient-portal/patient-access-grant.model.js';
import { PermissionModel } from '../modules/permissions/permission.model.js';
import { RoleModel } from '../modules/roles/role.model.js';
import { UserModel } from '../modules/users/user.model.js';
import { hashPassword } from '../shared/security/hash.js';

export const seedOphthalmologyActors = async () => {
  await connectDatabase();

  const branch = await BranchModel.findOne({ code: 'MB01', status: 'ACTIVE' }).orFail(
    () => new Error('Branch MB01 is required in the database'),
  );

  let department = await DepartmentModel.findOne({ code: 'OPT', status: 'ACTIVE' });
  if (!department) {
    department = await DepartmentModel.create({
      code: 'OPT',
      name: 'Ophthalmology',
      branchIds: [branch._id],
      isClinical: true,
      status: 'ACTIVE',
    });
  }

  // Helper to ensure role with exact system permissions
  const ensureRole = async (code: string, name: string, perms: Array<{ module: string; screen: string; action: string }>) => {
    const permDocs = await Promise.all(
      perms.map(async (p) => {
        const permCode = `${p.module}_${p.screen}_${p.action}`.replaceAll(' ', '_').toUpperCase();
        return PermissionModel.findOneAndUpdate(
          { code: permCode },
          { 
            $setOnInsert: { 
              code: permCode, 
              name: `${p.screen} ${p.action}`, 
              module: p.module, 
              screen: p.screen, 
              action: p.action, 
              type: 'system', 
              status: 'active' 
            } 
          },
          { upsert: true, returnDocument: 'after' },
        );
      }),
    );

    return RoleModel.findOneAndUpdate(
      { code },
      { $set: { name, type: 'system', status: 'active', permissionIds: permDocs.map((p) => p._id), deletedAt: null } },
      { upsert: true, returnDocument: 'after' },
    );
  };

  // 1. ROLE-REC
  const recRole = await ensureRole('ROLE-REC', 'Ophthalmology Receptionist', [
    { module: 'OPD', screen: 'OPD Visits', action: 'View' },
    { module: 'OPD', screen: 'OPD Visits', action: 'Create' },
    { module: 'Appointments', screen: 'Appointment Booking', action: 'View' },
    { module: 'Appointments', screen: 'Appointment Booking', action: 'Create' },
    { module: 'Patients', screen: 'Patient Records', action: 'View' },
    { module: 'Patients', screen: 'Patient Records', action: 'Create' },
  ]);

  // 2. ROLE-NUR
  const nurRole = await ensureRole('ROLE-NUR', 'Ophthalmology Triage Nurse', [
    { module: 'OPD', screen: 'OPD Vitals', action: 'View' },
    { module: 'OPD', screen: 'OPD Vitals', action: 'Create' },
    { module: 'OPD', screen: 'OPD Vitals', action: 'Edit' },
    { module: 'OPD', screen: 'Ophthalmology Intake', action: 'View' },
    { module: 'OPD', screen: 'Ophthalmology Intake', action: 'Edit' },
    { module: 'OPD', screen: 'Ophthalmology Intake', action: 'Escalate' },
  ]);

  // 3. ROLE-VTECH
  const vtechRole = await ensureRole('ROLE-VTECH', 'Vision Technician', [
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'View' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Start' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Edit' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Complete' },
  ]);

  // 4. ROLE-OPT
  const optRole = await ensureRole('ROLE-OPT', 'Optometrist', [
    { module: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'View' },
    { module: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'Create' },
    { module: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'Edit' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'View' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Start' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Edit' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Complete' },
  ]);

  // 5. ROLE-TONO
  const tonoRole = await ensureRole('ROLE-TONO', 'Tonometry Technician', [
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'View' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Start' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Edit' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Complete' },
  ]);

  // 6. ROLE-DTECH
  const dtechRole = await ensureRole('ROLE-DTECH', 'Diagnostic Technician', [
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'View' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Start' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Edit' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Complete' },
    { module: 'OPD', screen: 'Ophthalmology Portal Publication', action: 'View' },
  ]);

  // 7. ROLE-OPH
  const ophRole = await ensureRole('ROLE-OPH', 'Attending Ophthalmologist', [
    { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'View' },
    { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'Edit' },
    { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'Diagnose' },
    { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'Prescribe' },
    { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'Complete' },
    { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'Override' },
    { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'Reopen' },
    { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'Amend' },
    { module: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'View' },
    { module: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'Create' },
    { module: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'Edit' },
    { module: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'Approve' },
    { module: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'Cancel' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'View' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Assign' },
    { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Review' },
    { module: 'OPD', screen: 'Ophthalmology Test Review', action: 'View' },
    { module: 'OPD', screen: 'Ophthalmology Test Review', action: 'Review' },
    { module: 'OPD', screen: 'Ophthalmology Test Review', action: 'Request Repeat' },
    { module: 'OPD', screen: 'Ophthalmology Test Review', action: 'Amend' },
    { module: 'OPD', screen: 'Ophthalmology Intake', action: 'Escalate' },
    { module: 'OPD', screen: 'Ophthalmology Emergency', action: 'Clear' },
    { module: 'Surgery', screen: 'Recommendations', action: 'View' },
    { module: 'Surgery', screen: 'Recommendations', action: 'Create' },
    { module: 'OPD', screen: 'OPD Consultation', action: 'View' },
    { module: 'OPD', screen: 'OPD Consultation', action: 'Edit' },
    { module: 'OPD', screen: 'OPD Prescription', action: 'Prescribe' },
    { module: 'OPD', screen: 'OPD Prescription', action: 'Edit' },
    { module: 'OPD', screen: 'OPD Prescription', action: 'View' },
  ]);

  // 8. ROLE-COUNS
  const counsRole = await ensureRole('ROLE-COUNS', 'Surgical Counsellor', [
    { module: 'Surgery', screen: 'Recommendations', action: 'View' },
    { module: 'Surgery', screen: 'Bookings', action: 'View' },
    { module: 'Surgery', screen: 'Bookings', action: 'Schedule' },
    { module: 'Surgery', screen: 'Schedule', action: 'View' },
  ]);

  // 9. ROLE-PHARM
  const pharmRole = await ensureRole('ROLE-PHARM', 'Pharmacy Dispenser', [
    { module: 'Pharmacy', screen: 'Medicine Inventory', action: 'View' },
    { module: 'Pharmacy', screen: 'Dispensing', action: 'View' },
    { module: 'Pharmacy', screen: 'Dispensing', action: 'Dispense' },
    { module: 'OPD', screen: 'OPD Prescription', action: 'View' },
  ]);

  // 10. ROLE-BILL
  const billRole = await ensureRole('ROLE-BILL', 'Billing Officer', [
    { module: 'Billing', screen: 'Invoices', action: 'View' },
    { module: 'Billing', screen: 'Invoices', action: 'Create' },
    { module: 'Billing', screen: 'Invoices', action: 'CollectPayment' },
    { module: 'Billing', screen: 'Invoices', action: 'ViewReceipt' },
    { module: 'Reports', screen: 'Phase 2 Reports', action: 'View' },
  ]);

  // 11. ROLE-PAT
  const patRole = await RoleModel.findOneAndUpdate(
    { code: 'PATIENT' },
    { $set: { name: 'Patient', status: 'active', permissionIds: [] } },
    { upsert: true, returnDocument: 'after' },
  );

  // Helper to upsert user with clean single-name username and <Name>123! password
  const ensureUser = async (
    username: string, 
    fullName: string, 
    plainPassword: string, 
    roleId: Types.ObjectId, 
    extra?: Record<string, unknown>
  ) => {
    const passwordHash = await hashPassword(plainPassword);
    return UserModel.findOneAndUpdate(
      { username },
      {
        $set: {
          email: `${username}@hms.test`,
          fullName,
          passwordHash,
          roleIds: [roleId],
          branchIds: [branch._id],
          departmentIds: [department._id],
          status: 'active',
          deletedAt: null,
          ...extra,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  };

  // Seed Single-Word Username Accounts
  await ensureUser('priya', 'Priya', 'Priya123!', recRole._id);
  await ensureUser('anitha', 'Anitha', 'Anitha123!', nurRole._id);
  await ensureUser('karthik', 'Karthik', 'Karthik123!', vtechRole._id);
  const optomUser = await ensureUser('deepa', 'Deepa', 'Deepa123!', optRole._id);
  await ensureUser('vignesh', 'Vignesh', 'Vignesh123!', tonoRole._id);
  await ensureUser('meera', 'Meera', 'Meera123!', dtechRole._id);
  const ophUser = await ensureUser('aravind', 'Dr. Aravind', 'Aravind123!', ophRole._id);
  await ensureUser('kavitha', 'Kavitha', 'Kavitha123!', counsRole._id);
  await ensureUser('saravanan', 'Saravanan', 'Saravanan123!', pharmRole._id);
  await ensureUser('rajesh', 'Rajesh', 'Rajesh123!', billRole._id);

  // Register Doctor Provider Record for Dr. Aravind
  await DoctorModel.findOneAndUpdate(
    { userId: ophUser._id },
    {
      $set: {
        doctorNumber: 'OPH-DOC-001',
        firstName: 'Aravind',
        lastName: 'Doctor',
        displayName: 'Dr. Aravind',
        specialization: 'Ophthalmology',
        branchId: branch._id,
        departmentId: department._id,
        status: 'ACTIVE',
        availability: [],
      },
    },
    { upsert: true },
  );

  // Register Doctor Provider Record for Deepa (Optometrist)
  await DoctorModel.findOneAndUpdate(
    { userId: optomUser._id },
    {
      $set: {
        doctorNumber: 'OPT-DOC-001',
        firstName: 'Deepa',
        lastName: 'Optometrist',
        displayName: 'Deepa',
        specialization: 'Optometry',
        branchId: branch._id,
        departmentId: department._id,
        status: 'ACTIVE',
        availability: [],
      },
    },
    { upsert: true },
  );

  // Seed Synthetic Patient and Portal User
  const patient = await PatientModel.findOneAndUpdate(
    { patientNumber: 'SYN-PAT-PORTAL-01' },
    {
      $set: {
        firstName: 'Divya',
        lastName: 'Patient',
        dateOfBirth: new Date('1994-06-15'),
        gender: 'FEMALE',
        status: 'ACTIVE',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  const patUser = await ensureUser('divya', 'Divya', 'Divya123!', patRole._id, {
    patientId: patient._id,
  });

  await PatientAccessGrantModel.findOneAndUpdate(
    { userId: patUser._id, patientId: patient._id },
    { $set: { relationship: 'SELF', status: 'VERIFIED', isPrimary: true } },
    { upsert: true },
  );

  console.log('Successfully seeded all 11 single-name Ophthalmology personas into MongoDB.');
};

if (process.argv[1]?.includes('seed-ophthalmology-users')) {
  seedOphthalmologyActors()
    .then(async () => {
      await closeDatabase();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
