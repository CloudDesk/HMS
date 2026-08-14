import { connectDatabase, closeDatabase } from '../src/database/client.js';
import { UserModel } from '../src/modules/users/user.model.js';

async function main() {
  await connectDatabase();
  try {
    const user = await UserModel.updateOne({ username: 'kamesh' }, { $set: { deletedAt: null, deletedBy: null } });
    console.log("Restored user kamesh from soft deletion:", user);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closeDatabase();
  }
}
main();
