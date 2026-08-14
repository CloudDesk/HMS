import { connectDatabase, closeDatabase } from '../src/database/client.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { hashPassword } from '../src/shared/security/hash.js';

async function main() {
  await connectDatabase();

  try {
    const doctor = await DoctorModel.findOne({ firstName: { $regex: /Kamesh/i } });
    if (!doctor) {
      console.log('Doctor Kamesh not found.');
      return;
    }
    console.log('Found doctor:', doctor.firstName, doctor.lastName);

    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' });
    if (!doctorRole) {
      console.log('DOCTOR role not found.');
      return;
    }

    let user = await UserModel.findOne({ username: 'kamesh' });
    if (!user) {
      const passwordHash = await hashPassword('Password123!');
      user = await UserModel.create({
        username: 'kamesh',
        email: doctor.email || 'kamesh@example.com',
        fullName: `${doctor.firstName} ${doctor.lastName}`,
        employeeCode: 'EMP-' + doctor.doctorNumber,
        passwordHash,
        status: 'active',
        roleIds: [doctorRole._id]
      });
      console.log("Created user Kamesh with username 'kamesh' and password 'Password123!'");
    } else {
      console.log("User kamesh already exists.");
    }

    doctor.userId = user._id;
    await doctor.save();
    console.log('Successfully linked user to doctor Kamesh.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closeDatabase();
  }
}

main();
