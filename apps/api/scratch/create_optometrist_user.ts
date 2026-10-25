import { connectDatabase, closeDatabase } from '../src/database/client.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { PermissionModel } from '../src/modules/permissions/permission.model.js';
import { hashPassword } from '../src/shared/security/hash.js';

async function main() {
  await connectDatabase();

  try {
    const branch = await BranchModel.findOne({ code: 'MB01', status: 'ACTIVE' });
    if (!branch) {
      throw new Error('Main Branch (MB01) not found');
    }
    console.log('Branch found:', branch.name, branch._id.toString());

    // 1. Department: Optometric Technician
    let dept = await DepartmentModel.findOne({
      $or: [{ code: 'OPTO_TECH' }, { name: /^Optometric Technician$/i }],
    });
    if (!dept) {
      dept = await DepartmentModel.create({
        code: 'OPTO_TECH',
        name: 'Optometric Technician',
        description: 'Optometric examination and clinical vision testing department',
        branchIds: [branch._id],
        isClinical: true,
        status: 'ACTIVE',
        hiddenModules: [],
      });
      console.log('Created Department:', dept.name, dept._id.toString());
    } else {
      if (!dept.branchIds.some((id) => id.toString() === branch._id.toString())) {
        dept.branchIds.push(branch._id);
        await dept.save();
      }
      console.log('Using Department:', dept.name, dept._id.toString());
    }

    // 2. Permissions for Comprehensive Examination Tab View & Edit
    const permCodes = [
      'OPD_OPHTHALMOLOGY_TEST_QUEUE_VIEW',
      'OPD_OPHTHALMOLOGY_TEST_QUEUE_EDIT',
      'OPD_OPHTHALMOLOGY_TEST_QUEUE_START',
      'OPD_OPHTHALMOLOGY_TEST_QUEUE_COMPLETE',
      'OPD_OPHTHALMOLOGY_INTAKE_VIEW',
      'OPD_OPD_VISITS_VIEW',
    ];
    const permissions = await PermissionModel.find({ code: { $in: permCodes }, status: 'active', deletedAt: null });
    console.log('Found permissions:', permissions.map((p) => `${p.code} (${p.name})`));
    const permissionIds = permissions.map((p) => p._id);

    // 3. Role: Optometrist
    let role = await RoleModel.findOne({ code: 'OPTOMETRIST', deletedAt: null });
    if (!role) {
      role = await RoleModel.create({
        code: 'OPTOMETRIST',
        name: 'Optometrist',
        description: 'Optometrist with access to view and edit comprehensive examination tests and findings',
        type: 'custom',
        color: '#0284c7',
        permissionIds,
        status: 'active',
      });
      console.log('Created Role:', role.name, role._id.toString());
    } else {
      role.permissionIds = permissionIds;
      role.status = 'active';
      await role.save();
      console.log('Updated Role:', role.name, role._id.toString());
    }

    // 4. User: Real Kenya Name (Faith Wanjiku Mwangi)
    const username = 'faith.wanjiku';
    const email = 'faith.wanjiku@nairobigeneral.org';
    const fullName = 'Faith Wanjiku Mwangi';
    const password = 'Password123!';

    let user = await UserModel.findOne({ username: new RegExp(`^${username}$`, 'i') });
    const passwordHash = await hashPassword(password);

    if (!user) {
      user = await UserModel.create({
        username,
        email,
        fullName,
        employeeCode: 'EMP-OPTO-001',
        jobTitle: 'Optometric Technician',
        employeeType: 'Full-time',
        passwordHash,
        status: 'active',
        roleIds: [role._id],
        branchIds: [branch._id],
        departmentIds: [dept._id],
      });
      console.log(`Created User: ${fullName} (${username}) with password: ${password}`);
    } else {
      user.fullName = fullName;
      user.email = email;
      user.passwordHash = passwordHash;
      user.roleIds = [role._id];
      user.branchIds = [branch._id];
      user.departmentIds = [dept._id];
      user.status = 'active';
      await user.save();
      console.log(`Updated User: ${fullName} (${username}) with password: ${password}`);
    }

    console.log('--- Summary of Created Optometrist ---');
    console.log('Full Name:', fullName);
    console.log('Username:', username);
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Role:', role.name);
    console.log('Department:', dept.name);
    console.log('Branch:', branch.name);
    console.log('Permissions:', permissions.map((p) => p.name).join(', '));
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await closeDatabase();
  }
}

main();
