import { connectDatabase, closeDatabase } from '../src/database/client.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { hashPassword } from '../src/shared/security/hash.js';

async function main() {
  await connectDatabase();
  try {
    const passwordHash = await hashPassword('Password123!');
    await UserModel.updateOne({ username: 'kamesh' }, { $set: { passwordHash } });
    console.log("Password for user kamesh has been reset to Password123!");
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closeDatabase();
  }
}
main();
