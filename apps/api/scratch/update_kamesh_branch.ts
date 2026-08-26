import { connectDatabase, closeDatabase } from '../src/database/client.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';

async function main() {
  await connectDatabase();
  try {
    const mainBranch = await BranchModel.findOne({ name: 'Main Branch' });
    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' });
    
    if (!mainBranch) {
      console.log('Main branch not found!');
      return;
    }

    // Since department is cardiology in the screenshot, let's keep the user's existing department if valid for main branch, or find Cardiology in Main Branch.
    const dept = await DepartmentModel.findOne({ name: 'Cardiology', branchId: mainBranch._id });

    const updateData: Record<string, unknown> = { 
      branchIds: [mainBranch._id],
    };

    if (doctorRole) {
      updateData.roleIds = [doctorRole._id];
    }
    
    if (dept) {
      updateData.departmentIds = [dept._id];
    } else {
       // if Cardiology doesn't exist in Main Branch, find any department in Main Branch just to be safe, or leave it.
       const anyDept = await DepartmentModel.findOne({ branchId: mainBranch._id });
       if (anyDept) updateData.departmentIds = [anyDept._id];
    }

    const user = await UserModel.updateOne({ username: 'kamesh' }, { $set: updateData });
    console.log("Updated user kamesh to Main Branch:", user);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closeDatabase();
  }
}
main();
