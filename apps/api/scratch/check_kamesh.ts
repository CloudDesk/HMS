import { connectDatabase, closeDatabase } from '../src/database/client.js';
import { UserModel } from '../src/modules/users/user.model.js';

async function main() {
  await connectDatabase();
  try {
    const user = await UserModel.findOne({ username: 'kamesh' });
    console.log(user);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closeDatabase();
  }
}
main();
